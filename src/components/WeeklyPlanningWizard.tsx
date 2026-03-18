import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { addDays, endOfWeek, format, getDate, getDaysInMonth, getDay, isBefore, isSameDay, isWithinInterval, parseISO, startOfMonth } from 'date-fns';
import { Check, GripVertical, Plus, X } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import type { MonthlyPlan, PlannedTask } from '@/types';
import { getPlanningWeekStart } from '@/lib/planner';

const GOAL_COLORS = [
  { label: 'Warm', value: 'bg-accent-warm' },
  { label: 'Muted', value: 'bg-done' },
  { label: 'Green', value: 'bg-accent-green' },
];

const PRACTICE_SUGGESTIONS = [
  { title: 'Workout', defaultMins: 45 },
  { title: 'Journal', defaultMins: 15 },
  { title: 'Budget', defaultMins: 15 },
  { title: 'School run', defaultMins: 30 },
  { title: 'Lunch', defaultMins: 30 },
];

const THREAD_ORDINALS = ['first', 'second', 'third'];
const THREAD_SLOT_TYPE = 'THREAD_SLOT';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

function StepIndicator({ step, total, label }: { step: number; total: number; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              i < step ? 'bg-accent-warm' : 'bg-border'
            )}
          />
        ))}
      </div>
      {label && (
        <span className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

// ─── Step 1: Last Week ───────────────────────────────────────────────────────

function StepReview({
  migratedTasks,
  onDrop,
}: {
  migratedTasks: PlannedTask[];
  onDrop: (id: string) => void;
}) {
  const [droppedSet, setDroppedSet] = useState<Set<string>>(new Set());

  function handleToggle(id: string) {
    if (droppedSet.has(id)) {
      setDroppedSet((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      onDrop(id);
      setDroppedSet((prev) => new Set([...prev, id]));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          What carries forward
        </h2>
        <p className="text-[13px] text-text-muted mt-2">
          These didn't finish last week. Keep what still matters.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {migratedTasks.map((task) => {
          const isDropped = droppedSet.has(task.id);
          return (
            <div
              key={task.id}
              className={cn(
                'flex items-center gap-3 rounded-md border px-4 py-3 transition-all duration-200',
                isDropped
                  ? 'border-border-subtle bg-bg-card/50 opacity-50'
                  : 'border-border bg-bg-card'
              )}
            >
              <button
                onClick={() => handleToggle(task.id)}
                className={cn(
                  'w-5 h-5 rounded flex items-center justify-center shrink-0 transition-colors',
                  isDropped
                    ? 'bg-transparent border border-border-subtle text-text-muted'
                    : 'bg-accent-warm/15 text-accent-warm'
                )}
                aria-label={isDropped ? 'Keep task' : 'Drop task'}
              >
                {!isDropped && <Check className="w-3 h-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className={cn(
                  'text-[13px] leading-snug truncate',
                  isDropped ? 'text-text-muted line-through' : 'text-text-primary'
                )}>
                  {task.title}
                </div>
                {task.asanaProject && (
                  <div className="text-[11px] text-text-muted mt-0.5">{task.asanaProject}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2: Three Threads ──────────────────────────────────────────────────

const THREAD_HEX_WIZARD = ['#E55547', '#828282', '#5B8A5E'];

function ThreadSlot({
  index,
  goal,
  onRename,
  onUpdateWhy,
  onAdd,
  onRemove,
  onReorder,
}: {
  index: number;
  goal?: { id: string; title: string; color: string; why?: string };
  onRename: (id: string, title: string) => void;
  onUpdateWhy: (id: string, why: string) => void;
  onAdd: (title: string, color: string) => void;
  onRemove?: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}) {
  const [title, setTitle] = useState(goal?.title || '');
  const [why, setWhy] = useState(goal?.why || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTitle(goal?.title || '');
    setWhy(goal?.why || '');
  }, [goal]);

  const hex = THREAD_HEX_WIZARD[index] || '#E55547';

  // DnD — only active when slot has a goal
  const [{ isDragging }, dragRef, previewRef] = useDrag({
    type: THREAD_SLOT_TYPE,
    item: { index },
    canDrag: () => Boolean(goal),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [{ isOver }, dropRef] = useDrop({
    accept: THREAD_SLOT_TYPE,
    canDrop: () => Boolean(goal),
    drop: (item: { index: number }) => {
      if (item.index !== index && onReorder) {
        onReorder(item.index, index);
      }
    },
    collect: (monitor) => ({ isOver: monitor.isOver() && monitor.canDrop() }),
  });

  // Combine refs
  dropRef(previewRef(slotRef));

  function handleTitleSubmit() {
    if (!goal && title.trim()) {
      onAdd(title.trim(), GOAL_COLORS[index % GOAL_COLORS.length].value);
      setTitle('');
    } else if (goal && title.trim()) {
      onRename(goal.id, title);
    } else if (goal && !title.trim()) {
      setTitle(goal.title);
    }
  }

  return (
    <div
      ref={slotRef}
      className={cn(
        'relative pl-7 pb-6 last:pb-0 transition-opacity',
        isDragging && 'opacity-40',
        isOver && 'bg-accent-warm/[0.04] rounded-lg'
      )}
    >
      {/* Dot on the thread line */}
      <div
        className="absolute left-0 top-[7px] w-[11px] h-[11px] rounded-full -translate-x-1/2 transition-all duration-300"
        style={{
          background: goal ? hex : 'transparent',
          border: goal ? 'none' : '1.5px solid var(--color-border)',
        }}
      />

      {goal ? (
        <>
          {/* Title + Grip + Remove */}
          <div className="flex items-center gap-2">
            <div ref={dragRef} className="cursor-grab active:cursor-grabbing text-text-muted/20 hover:text-text-muted/50 transition-colors -ml-1 shrink-0">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTitleSubmit(); } }}
              className="flex-1 bg-transparent border-none outline-none text-[15px] font-medium text-text-primary leading-snug"
            />
            {onRemove && (
              <button
                onClick={onRemove}
                className="text-text-muted/30 hover:text-accent-warm transition-colors p-0.5"
                aria-label="Remove thread"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Why — revealed after goal is named */}
          <div className="flex items-baseline gap-2 mt-1 pl-[18px]">
            <span className="text-[11px] text-text-muted/40 shrink-0 select-none">why</span>
            <input
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              onBlur={() => onUpdateWhy(goal.id, why)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
              placeholder="One sentence. Why this thread, this week?"
              className="flex-1 bg-transparent border-none outline-none text-[12px] text-text-muted placeholder:text-text-muted/25 focus:text-text-primary transition-colors"
            />
          </div>
        </>
      ) : (
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim()) handleTitleSubmit(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) {
              e.preventDefault();
              handleTitleSubmit();
            }
          }}
          placeholder={`What's the ${THREAD_ORDINALS[index] || 'next'} thread?`}
          className="w-full bg-transparent border-none outline-none text-[15px] text-text-primary placeholder:text-text-muted/30"
        />
      )}
    </div>
  );
}

function StepGoals({ monthlyPlan }: { monthlyPlan: MonthlyPlan | null }) {
  const { weeklyGoals, addWeeklyGoal, renameWeeklyGoal, updateGoalWhy, removeWeeklyGoal, reorderWeeklyGoals, openMonthlyPlanning } = useApp();
  const hasMonthlyAim = Boolean(monthlyPlan?.oneThing);

  return (
    <div className="flex flex-col gap-6">
      {/* Headline — the action, not the monthly aim */}
      <div>
        <h2 className="font-display italic text-[28px] font-light text-text-primary leading-snug">
          What's important this week?
        </h2>
        {hasMonthlyAim ? (
          <p className="mt-2 text-[12px] text-text-muted">
            <span className="font-mono uppercase tracking-widest text-[10px]">
              {format(new Date(), 'MMMM')}:
            </span>{' '}
            <span className="italic">{monthlyPlan!.oneThing}</span>
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-text-muted">
            <button
              onClick={openMonthlyPlanning}
              className="text-accent-warm hover:text-accent-warm/80 transition-colors"
            >
              Set your monthly aim first →
            </button>
          </p>
        )}
        <p className="text-[13px] text-text-muted/70 mt-4 leading-relaxed">
          Name three threads — the things you'll keep returning to.
          One sentence each. That's all you need.
        </p>
      </div>

      {/* Thread slots with connecting line */}
      <div className="relative ml-[5px]">
        {/* Thread line */}
        <div className="absolute left-0 top-[7px] bottom-[7px] w-px bg-border" />

        {[0, 1, 2].map((i) => {
          const goal = weeklyGoals[i];
          return (
            <ThreadSlot
              key={goal?.id || `slot-${i}`}
              index={i}
              goal={goal}
              onRename={renameWeeklyGoal}
              onUpdateWhy={updateGoalWhy}
              onAdd={addWeeklyGoal}
              onRemove={goal ? () => removeWeeklyGoal(goal.id) : undefined}
              onReorder={reorderWeeklyGoals}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 3: Daily Practices ─────────────────────────────────────────────────

function StepPractices() {
  const { rituals, addRitual, removeRitual, updateRitualEstimate, workdayStart, workdayEnd } = useApp();
  const [draft, setDraft] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalMins = rituals.reduce((sum, r) => sum + (r.estimateMins ?? 0), 0);
  const workdayMins = (workdayEnd.hour * 60 + workdayEnd.min) - (workdayStart.hour * 60 + workdayStart.min);
  const focusMins = Math.max(0, workdayMins - totalMins);

  function getStepMins(current: number): number {
    if (current < 60) return 15;
    if (current < 120) return 30;
    return 60;
  }

  const isAdded = (title: string) =>
    rituals.some((r) => r.title.toLowerCase() === title.toLowerCase());

  function toggleSuggestion(suggestion: (typeof PRACTICE_SUGGESTIONS)[0]) {
    if (isAdded(suggestion.title)) {
      const ritual = rituals.find(
        (r) => r.title.toLowerCase() === suggestion.title.toLowerCase()
      );
      if (ritual) removeRitual(ritual.id);
    } else {
      addRitual(suggestion.title);
    }
  }

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    if (draft.trim()) {
      addRitual(draft.trim());
      setDraft('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  // Set default estimate for newly added rituals
  useEffect(() => {
    rituals.forEach((r) => {
      if (r.estimateMins === undefined || r.estimateMins === null) {
        const suggestion = PRACTICE_SUGGESTIONS.find(
          (s) => s.title.toLowerCase() === r.title.toLowerCase()
        );
        updateRitualEstimate(r.id, suggestion?.defaultMins ?? 30);
      }
    });
  }, [rituals.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          What happens every day?
        </h2>
        <p className="text-[13px] text-text-muted mt-2">
          Routines, rituals, and recurring project blocks — anything that needs
          a protected slot before the week starts. You can adjust the time after.
        </p>
      </div>

      {/* Suggestion pills */}
      <div className="flex flex-wrap gap-2">
        {PRACTICE_SUGGESTIONS.map((suggestion) => {
          const added = isAdded(suggestion.title);
          return (
            <button
              key={suggestion.title}
              onClick={() => toggleSuggestion(suggestion)}
              className={cn(
                'px-4 py-2 rounded-full text-[13px] transition-all duration-200',
                added
                  ? 'bg-accent-warm/15 text-accent-warm border border-accent-warm/25'
                  : 'border border-border text-text-muted hover:text-text-primary hover:border-border-hover'
              )}
            >
              {added && <Check className="w-3 h-3 inline mr-1.5 -mt-0.5" />}
              {suggestion.title}
            </button>
          );
        })}
        {!showCustom && (
          <button
            onClick={() => {
              setShowCustom(true);
              setTimeout(() => inputRef.current?.focus(), 50);
            }}
            className="px-4 py-2 rounded-full text-[13px] border border-dashed border-border text-text-muted/50 hover:text-text-muted hover:border-border-hover transition-colors"
          >
            <Plus className="w-3 h-3 inline mr-1 -mt-0.5" />
            Add your own
          </button>
        )}
      </div>

      <p className="text-[12px] text-text-muted/45 -mt-2">
        Add project blocks here too — Writing time, LinkedIn posts, Upwork — anything that needs a daily slot.
      </p>

      {/* Custom input — shown after clicking "Add your own" */}
      {showCustom && (
        <form
          onSubmit={handleAddCustom}
          className="flex items-center gap-2 rounded-full border border-border px-4 py-2"
        >
          <Plus className="w-3.5 h-3.5 text-text-muted/30 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Writing time, LinkedIn posts, Upwork"
            className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted/30 outline-none"
          />
          {draft.trim() && (
            <span className="text-[10px] text-text-muted/40 shrink-0">Enter ↵</span>
          )}
        </form>
      )}

      {/* Added practices with time adjusters */}
      {rituals.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted/40">
            Your practices
          </div>
          {rituals.map((ritual) => (
            <div
              key={ritual.id}
              className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-2.5"
            >
              <span className="flex-1 text-[13px] text-text-primary">{ritual.title}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const current = ritual.estimateMins ?? 0;
                    const stepSize = getStepMins(current);
                    updateRitualEstimate(ritual.id, Math.max(0, current - stepSize));
                  }}
                  disabled={(ritual.estimateMins ?? 0) === 0}
                  className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg transition-colors disabled:opacity-30 text-[14px] leading-none"
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="text-[12px] font-mono text-text-muted w-10 text-center">
                  {formatMins(ritual.estimateMins ?? 0)}
                </span>
                <button
                  onClick={() => {
                    const current = ritual.estimateMins ?? 0;
                    const stepSize = getStepMins(current);
                    updateRitualEstimate(ritual.id, current + stepSize);
                  }}
                  className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-bg transition-colors text-[14px] leading-none"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => removeRitual(ritual.id)}
                className="text-text-muted/30 hover:text-accent-warm transition-colors p-1"
                aria-label="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capacity — updates live as practices are added */}
      {rituals.length > 0 && (
        <div className="text-[13px] text-text-muted">
          You have{' '}
          <span
            className={
              focusMins < 180
                ? 'text-accent-warm font-medium'
                : 'text-text-primary font-medium'
            }
          >
            ~{formatMins(focusMins)}
          </span>{' '}
          for focused work after your practices.
        </div>
      )}
    </div>
  );
}

// ─── Mini Month Calendar ─────────────────────────────────────────────────────

function MiniMonthCalendar() {
  const today = new Date();
  const dayOfMonth = getDate(today);
  const totalDays = getDaysInMonth(today);
  const daysLeft = totalDays - dayOfMonth;

  // Build the calendar grid — start on Monday
  const monthStart = startOfMonth(today);
  // getDay: 0=Sun, adjust so Mon=0
  const startDayOfWeek = (getDay(monthStart) + 6) % 7;

  const cells: { day: number; past: boolean; isToday: boolean; thisWeek: boolean }[] = [];
  const weekStart = getPlanningWeekStart(today);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Empty cells before month starts
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: 0, past: false, isToday: false, thisWeek: false });
  }

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), d);
    cells.push({
      day: d,
      past: d < dayOfMonth,
      isToday: d === dayOfMonth,
      thisWeek: isWithinInterval(date, { start: weekStart, end: weekEnd }),
    });
  }

  return (
    <div className="shrink-0">
      {/* Day labels */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="w-4 h-3 flex items-center justify-center text-[7px] font-mono text-text-muted/30">
            {d}
          </div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {cells.map((cell, i) => (
          <div
            key={i}
            className={cn(
              'w-4 h-4 flex items-center justify-center text-[8px] font-mono rounded-[2px] transition-colors',
              cell.day === 0 && 'invisible',
              cell.past && 'text-text-muted/20',
              cell.isToday && 'bg-accent-warm text-bg font-medium',
              cell.thisWeek && !cell.isToday && !cell.past && 'bg-accent-warm/10 text-text-primary',
              !cell.past && !cell.isToday && !cell.thisWeek && cell.day > 0 && 'text-text-muted/50'
            )}
          >
            {cell.day > 0 ? cell.day : ''}
          </div>
        ))}
      </div>
      <div className="mt-1.5 text-[9px] font-mono text-text-muted/40 text-center">
        {daysLeft}d left
      </div>
    </div>
  );
}

// ─── Week Strip with Deadline Markers ────────────────────────────────────────

function WeekDeadlineStrip({
  addingDay,
  onDayClick,
}: {
  addingDay: string | null;
  onDayClick: (dateStr: string) => void;
}) {
  const { countdowns, weeklyGoals } = useApp();
  const today = new Date();
  const weekStart = getPlanningWeekStart(today);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const isToday = isSameDay(date, today);
    const isPast = isBefore(date, today) && !isToday;
    const dayDeadlines = countdowns.filter((c) => c.dueDate === dateStr);
    const isSelected = addingDay === dateStr;
    return { date, dateStr, isToday, isPast, dayDeadlines, isSelected };
  });

  return (
    <div className="flex items-start gap-1">
      {days.map(({ date, dateStr, isToday, isPast, dayDeadlines, isSelected }) => (
        <button
          key={dateStr}
          onClick={() => onDayClick(dateStr)}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg transition-all min-w-0',
            isToday && 'bg-accent-warm/[0.08]',
            isSelected && !isToday && 'bg-accent-warm/[0.04] ring-1 ring-accent-warm/20',
            !isToday && !isSelected && 'hover:bg-bg-card/50',
            isPast && 'opacity-40'
          )}
        >
          <span className={cn(
            'text-[9px] uppercase tracking-[0.1em]',
            isToday ? 'text-accent-warm font-medium' : 'text-text-muted/40'
          )}>
            {format(date, 'EEE')}
          </span>
          <span className={cn(
            'text-[14px] font-medium',
            isToday ? 'text-accent-warm' : 'text-text-primary/60'
          )}>
            {format(date, 'd')}
          </span>
          {/* Deadline dot markers */}
          {dayDeadlines.length > 0 ? (
            <div className="flex items-center gap-1 justify-center">
              {dayDeadlines.map((c) => {
                const linkedGoal = weeklyGoals.find((g) => g.countdownId === c.id);
                const dotColor = linkedGoal
                  ? (THREAD_HEX_WIZARD[GOAL_COLORS.findIndex(gc => gc.value === linkedGoal.color)] || '#E55547')
                  : 'var(--color-accent-warm)';
                return (
                  <div
                    key={c.id}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: dotColor }}
                    title={c.title}
                  />
                );
              })}
            </div>
          ) : (
            <div className="h-1.5" />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Step 4: Your Week ───────────────────────────────────────────────────────

function StepYourWeek({ carriedForwardCount }: { carriedForwardCount: number }) {
  const { weeklyGoals, rituals, workdayStart, workdayEnd, monthlyPlan, addCountdown } = useApp();
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [deadlineTitle, setDeadlineTitle] = useState('');
  const deadlineInputRef = useRef<HTMLInputElement>(null);

  const totalMins = rituals.reduce((sum, r) => sum + (r.estimateMins ?? 0), 0);
  const workdayMins = workdayEnd.hour * 60 + workdayEnd.min - (workdayStart.hour * 60 + workdayStart.min);
  const focusMins = Math.max(0, workdayMins - totalMins);
  const today = new Date();

  function handleDayClick(dateStr: string) {
    setAddingDay(addingDay === dateStr ? null : dateStr);
    setDeadlineTitle('');
    setTimeout(() => deadlineInputRef.current?.focus(), 50);
  }

  function handleAddDeadline(e: React.FormEvent) {
    e.preventDefault();
    if (deadlineTitle.trim() && addingDay) {
      addCountdown(deadlineTitle.trim(), addingDay);
      setDeadlineTitle('');
      setAddingDay(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Headline + mini calendar side by side */}
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary leading-tight">
            Does this get you there?
          </h2>
          {monthlyPlan?.oneThing && (
            <p className="mt-2 text-[13px] text-text-muted leading-relaxed">
              <span className="font-mono uppercase tracking-widest text-[10px] text-text-muted/50">
                {format(today, 'MMMM')}:
              </span>{' '}
              <span className="italic">{monthlyPlan.oneThing}</span>
            </p>
          )}
        </div>
        <MiniMonthCalendar />
      </div>

      {/* Three threads — compact: thread line instead of cards */}
      <div className="relative ml-[5px]">
        <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted mb-2 ml-2">
          Three Threads
        </div>
        {weeklyGoals.length > 1 && (
          <div className="absolute left-0 top-[38px] w-px bg-border" style={{ height: `${(weeklyGoals.length - 1) * 40}px` }} />
        )}
        {weeklyGoals.map((goal, index) => (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: index * 0.08, ease: 'easeOut' }}
            className="relative pl-5 pb-2.5 last:pb-0"
          >
            <div
              className={cn('absolute left-0 top-[5px] w-2 h-2 rounded-full -translate-x-1/2', goal.color)}
            />
            <div className="text-[14px] font-medium text-text-primary leading-snug">{goal.title}</div>
            <div className="text-[11px] italic mt-0.5 leading-snug">
              {goal.why
                ? <span className="text-text-muted/60">{goal.why}</span>
                : <span className="text-text-muted/30">Add your why →</span>
              }
            </div>
          </motion.div>
        ))}
      </div>

      {/* Daily practices — single line */}
      {rituals.length > 0 && (
        <div className="text-[12px] text-text-muted">
          <span className="font-mono uppercase tracking-widest text-[10px] text-text-muted/40">Practices: </span>
          {rituals.map((r, i) => (
            <span key={r.id}>
              {r.title} {formatMins(r.estimateMins ?? 0)}
              {i < rituals.length - 1 ? ' · ' : ''}
            </span>
          ))}
          <span className="text-text-muted/40"> — ~{formatMins(focusMins)}/day for goals</span>
        </div>
      )}

      {/* Carried forward — inline */}
      {carriedForwardCount > 0 && (
        <div className="text-[11px] text-text-muted/50">
          {carriedForwardCount} {carriedForwardCount === 1 ? 'task' : 'tasks'} carried from last week
        </div>
      )}

      {/* Week strip with deadline markers */}
      <div className="pt-3 border-t border-border-subtle/50">
        <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted mb-2">
          Anything important this week?
        </div>
        <WeekDeadlineStrip addingDay={addingDay} onDayClick={handleDayClick} />
        <p className="text-[10px] text-text-muted/30 mt-1.5 text-center">
          Tap a day to add a deadline
        </p>

        {/* Inline add form — appears below the strip when a day is selected */}
        {addingDay && (
          <motion.form
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleAddDeadline}
            className="mt-2 flex items-center gap-2"
          >
            <span className="text-[11px] font-mono text-accent-warm shrink-0">
              {format(parseISO(addingDay), 'EEE d')}:
            </span>
            <input
              ref={deadlineInputRef}
              type="text"
              value={deadlineTitle}
              onChange={(e) => setDeadlineTitle(e.target.value)}
              placeholder="What's due?"
              className="flex-1 bg-transparent border-b border-border text-[13px] text-text-primary placeholder:text-text-muted/30 outline-none py-1"
              onKeyDown={(e) => { if (e.key === 'Escape') { setAddingDay(null); setDeadlineTitle(''); } }}
            />
            {deadlineTitle.trim() && (
              <span className="text-[11px] text-text-muted/40 shrink-0">↵</span>
            )}
            <button
              type="button"
              onClick={() => { setAddingDay(null); setDeadlineTitle(''); }}
              className="text-text-muted/30 hover:text-text-muted transition-colors p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.form>
        )}
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function WeeklyPlanningWizard() {
  const {
    isWeeklyPlanningOpen,
    closeWeeklyPlanning,
    completeWeeklyPlanning,
    migrateOldTasks,
    dropTask,
    monthlyPlan,
  } = useApp();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [migratedTasks, setMigratedTasks] = useState<PlannedTask[]>([]);
  const [droppedIds, setDroppedIds] = useState<Set<string>>(new Set());
  const [hasCarryForward, setHasCarryForward] = useState(false);

  // Run migration when wizard opens — auto-skip step 1 if no carry-forward tasks
  useEffect(() => {
    if (isWeeklyPlanningOpen) {
      setDroppedIds(new Set());
      const tasks = migrateOldTasks();
      setMigratedTasks(tasks);
      const hasTasks = tasks.length > 0;
      setHasCarryForward(hasTasks);
      setStep(hasTasks ? 1 : 2);
    }
  }, [isWeeklyPlanningOpen, migrateOldTasks]);

  if (!isWeeklyPlanningOpen) return null;

  const visibleMigrated = migratedTasks.filter((t) => !droppedIds.has(t.id));

  // Dynamic step configuration
  const steps = hasCarryForward
    ? [
        { num: 1, label: 'Last Week' },
        { num: 2, label: 'Three Threads' },
        { num: 3, label: 'Daily Practices' },
        { num: 4, label: 'Your Week' },
      ]
    : [
        { num: 2, label: 'Three Threads' },
        { num: 3, label: 'Daily Practices' },
        { num: 4, label: 'Your Week' },
      ];

  const totalSteps = steps.length;
  const currentStepIndex = steps.findIndex((s) => s.num === step);
  const currentLabel = steps[currentStepIndex]?.label || '';
  const isLastStep = currentStepIndex === totalSteps - 1;

  function handleDrop(id: string) {
    dropTask(id);
    setDroppedIds((prev) => new Set([...prev, id]));
  }

  function handleNext() {
    if (isLastStep) {
      completeWeeklyPlanning();
    } else {
      setDirection(1);
      setStep(steps[currentStepIndex + 1].num);
    }
  }

  function handleBack() {
    if (currentStepIndex > 0) {
      setDirection(-1);
      setStep(steps[currentStepIndex - 1].num);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeWeeklyPlanning}
      />

      {/* Card */}
      <motion.div
        layout
        className={cn(
          'relative z-10 w-full mx-6 editorial-card paper-texture rounded-2xl flex flex-col max-h-[85vh]',
          step === 4 ? 'max-w-2xl' : 'max-w-xl'
        )}
        transition={{ layout: { duration: 0.3, ease: 'easeOut' } }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-0 shrink-0">
          <StepIndicator step={currentStepIndex + 1} total={totalSteps} label={currentLabel} />
          <button
            onClick={closeWeeklyPlanning}
            className="text-text-muted hover:text-text-primary transition-colors p-1"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-7 hide-scrollbar">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={{
                initial: (d: number) => ({ x: d * 16, opacity: 0 }),
                animate: { x: 0, opacity: 1 },
                exit: (d: number) => ({ x: d * -16, opacity: 0 }),
              }}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
              {step === 1 && (
                <StepReview
                  migratedTasks={visibleMigrated}
                  onDrop={handleDrop}
                />
              )}
              {step === 2 && <StepGoals monthlyPlan={monthlyPlan} />}
              {step === 3 && <StepPractices />}
              {step === 4 && <StepYourWeek carriedForwardCount={visibleMigrated.length} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 pb-7 pt-4 border-t border-border-subtle shrink-0">
          {currentStepIndex > 0 ? (
            <button
              onClick={handleBack}
              className="text-[13px] text-text-muted hover:text-text-primary transition-colors"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {isLastStep ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-md bg-accent-warm text-bg text-[13px] font-medium hover:bg-accent-warm/90 transition-colors"
            >
              Begin the Week
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-md bg-accent-warm/10 border border-accent-warm/20 text-[13px] font-medium text-accent-warm hover:bg-accent-warm/15 transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
