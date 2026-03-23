import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isBefore, isSameDay, parseISO, startOfDay } from 'date-fns';
import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { MAX_WEEKLY_GOALS } from '@/context/plannerState';
import {
  useWeeklyMode,
  useAttentionBalance,
  formatActivityLine,
  type GoalAttention,
} from '@/hooks/useWeeklyMode';
import { getPlanningWeekStart } from '@/lib/planner';
import type { WeeklyGoal } from '@/types';

const THREAD_COLORS = ['bg-accent-warm', 'bg-done', 'bg-accent-green'];
const THREAD_HEX: Record<string, string> = {
  'bg-accent-warm': '#E55547',
  'bg-done': '#828282',
  'bg-accent-green': '#5B8A5E',
};

const modeTransition = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
};

// ---------------------------------------------------------------------------
// Mode 1: Month Not Set
// ---------------------------------------------------------------------------

function MonthNotSetPrompt() {
  const monthYear = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="editorial-card rounded-[24px] px-10 py-12 text-center max-w-md">
        <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-text-muted">
          {monthYear}
        </div>
        <h3 className="mt-5 font-display italic text-[26px] font-light text-text-primary leading-snug">
          What needs to move this month?
        </h3>
        <p className="mt-3 text-[13px] text-text-muted leading-relaxed">
          The monthly aim frames everything. Set it first, plan the week second.
        </p>
        <p className="mt-5 text-[12px] text-text-muted italic">
          Ask Ink to help you plan the month.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 2: Week Not Planned
// ---------------------------------------------------------------------------

function WeekNotPlannedPrompt() {
  const { monthlyPlan, weeklyGoals } = useApp();
  const hasStaleGoals = weeklyGoals.length > 0;

  return (
    <div className="flex flex-col gap-8 px-8 py-8">
      {monthlyPlan && (
        <div className="editorial-card rounded-[24px] px-7 py-5 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-text-muted">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <p className="mt-2 font-display italic text-[20px] font-light text-text-primary leading-snug">
              {monthlyPlan.oneThing}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-1 items-center justify-center">
        <div className="editorial-card rounded-[24px] px-10 py-12 text-center max-w-md">
          <h3 className="font-display italic text-[26px] font-light text-text-primary leading-snug">
            Three threads for this week.
          </h3>
          <p className="mt-3 text-[13px] text-text-muted leading-relaxed">
            Which intentions will hold your attention?
          </p>
          {hasStaleGoals && (
            <p className="mt-2 text-[12px] text-text-muted italic">
              You have intentions from last week. Ask Ink to help you review them.
            </p>
          )}
          <p className="mt-5 text-[12px] text-text-muted italic">
            Ask Ink to help you plan the week.
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread Entry — left-bordered card for each intention
// ---------------------------------------------------------------------------

function ThreadEntry({
  goal,
  attention,
}: {
  goal: WeeklyGoal;
  attention: GoalAttention;
}) {
  const { renameWeeklyGoal, updateGoalWhy, removeWeeklyGoal, countdowns } = useApp();
  const [title, setTitle] = useState(goal.title);
  const [why, setWhy] = useState(goal.why || '');
  const [editingField, setEditingField] = useState<'title' | 'why' | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const whyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTitle(goal.title);
    setWhy(goal.why || '');
  }, [goal]);

  useEffect(() => {
    if (editingField === 'title') titleRef.current?.focus();
    if (editingField === 'why') whyRef.current?.focus();
  }, [editingField]);

  const hex = THREAD_HEX[goal.color] || '#E55547';
  const linkedDeadline = goal.countdownId
    ? countdowns.find((c) => c.id === goal.countdownId)
    : null;

  const deadlinePillText = (() => {
    if (!linkedDeadline || attention.deadlineDaysLeft === null) return null;
    if (attention.deadlineDaysLeft <= 0) return 'Due today';
    if (attention.deadlineDaysLeft === 1) return 'Due tomorrow';
    if (attention.deadlineDaysLeft <= 5) {
      return `Due ${format(parseISO(linkedDeadline.dueDate), 'EEE')}`;
    }
    return `${attention.deadlineDaysLeft}d left`;
  })();

  return (
    <div
      className="group rounded-r-lg bg-bg-card/30 pl-4 pr-4 py-3 border-l-[3px] transition-all"
      style={{ borderLeftColor: hex }}
    >
      {/* Title row */}
      <div className="flex items-center gap-2">
        {editingField === 'title' ? (
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              renameWeeklyGoal(goal.id, title);
              setEditingField(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                renameWeeklyGoal(goal.id, title);
                setEditingField(null);
              }
            }}
            className="flex-1 bg-transparent border-none outline-none text-[18px] font-medium text-text-primary leading-snug"
          />
        ) : (
          <h4
            onClick={() => setEditingField('title')}
            className="flex-1 text-[18px] font-medium text-text-primary leading-snug cursor-text"
          >
            {title}
          </h4>
        )}
        {deadlinePillText && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: hex + '15', color: hex }}
          >
            {deadlinePillText}
          </span>
        )}
        <button
          onClick={() => removeWeeklyGoal(goal.id)}
          className="opacity-0 group-hover:opacity-100 text-text-muted/40 hover:text-accent-warm transition-all text-[11px] shrink-0"
        >
          remove
        </button>
      </div>

      {/* Why */}
      {editingField === 'why' ? (
        <textarea
          ref={whyRef}
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          onBlur={() => {
            updateGoalWhy(goal.id, why);
            setEditingField(null);
          }}
          rows={1}
          placeholder="Why this holds."
          className="mt-0.5 w-full resize-none bg-transparent border-none outline-none text-[13px] leading-relaxed text-text-muted placeholder:text-text-muted/30 focus:text-text-primary transition-colors"
        />
      ) : (
        why ? (
          <p
            onClick={() => setEditingField('why')}
            className="mt-0.5 text-[13px] leading-relaxed text-text-muted italic cursor-text"
          >
            {why}
          </p>
        ) : (
          <button
            onClick={() => setEditingField('why')}
            className="mt-0.5 text-[12px] leading-relaxed text-text-muted/55 italic cursor-text hover:text-text-primary transition-colors"
          >
            Add why
          </button>
        )
      )}

      {/* Nudge + Activity — only when tasks are committed */}
      {attention.tasksThisWeek > 0 && (
        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
          <span
            className={cn(
              'italic',
              attention.nudgeUrgent ? 'text-accent-warm' : 'text-text-muted/60'
            )}
          >
            {attention.nudgeLine}
          </span>
          <span className="text-text-muted/15">·</span>
          <span className="font-mono text-text-muted/35">
            {formatActivityLine(attention)}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Thread — inline input at the bottom of the thread list
// ---------------------------------------------------------------------------

function AddThreadInput({
  index,
  onAdd,
}: {
  index: number;
  onAdd: (title: string) => void;
}) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const placeholders = ["What's the first thread?", "What's the second thread?", "What's the third thread?"];

  return (
    <div className="relative pl-7 pt-3">
      {/* Outlined dot (empty slot) */}
      <div className="absolute left-0 top-[18px] w-[11px] h-[11px] rounded-full -translate-x-1/2 border border-border" />

      <div className="flex items-center gap-2">
        <Plus className="w-3.5 h-3.5 text-text-muted/25 shrink-0" />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) {
              e.preventDefault();
              onAdd(title.trim());
              setTitle('');
            }
          }}
          placeholder={placeholders[index] || 'Add a thread'}
          className="flex-1 bg-transparent border-none outline-none text-[14px] text-text-primary placeholder:text-text-muted/25"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Committed Week Map — the hero calendar showing the week at a glance
// ---------------------------------------------------------------------------

function CommittedWeekMap() {
  const { countdowns, weeklyGoals } = useApp();
  const weekStart = getPlanningWeekStart();
  const weekEnd = addDays(weekStart, 6);
  const today = startOfDay(new Date());

  const countdownColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    weeklyGoals.forEach((g) => {
      if (g.countdownId) map[g.countdownId] = THREAD_HEX[g.color] || '#E55547';
    });
    return map;
  }, [weeklyGoals]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    const dayKey = format(day, 'yyyy-MM-dd');
    const deadlines = countdowns.filter((c) => c.dueDate === dayKey);
    const isToday = isSameDay(day, today);
    const isPast = isBefore(day, today) && !isToday;
    return { day, dayKey, deadlines, isToday, isPast };
  });

  // Deadlines beyond this week
  const upcomingDeadlines = countdowns.filter((c) => {
    const d = startOfDay(parseISO(c.dueDate));
    return isBefore(weekEnd, d);
  });

  return (
    <div className="mt-5 border-t border-border-subtle/50 pt-4">
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ day, dayKey, deadlines, isToday, isPast }) => (
          <div
            key={dayKey}
            className={cn(
              'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg min-h-[80px]',
              isToday && 'bg-accent-warm/[0.08]',
              isPast && 'opacity-40'
            )}
          >
            <span
              className={cn(
                'text-[10px] font-mono uppercase tracking-[0.12em]',
                isToday ? 'text-accent-warm' : 'text-text-muted/40'
              )}
            >
              {format(day, 'EEE')}
            </span>
            <span
              className={cn(
                'text-[18px] font-medium',
                isToday ? 'text-accent-warm' : 'text-text-primary/60'
              )}
            >
              {format(day, 'd')}
            </span>
            {deadlines.map((d) => {
              const color = countdownColorMap[d.id] || '#E55547';
              return (
                <span
                  key={d.id}
                  className="text-[11px] font-medium leading-tight truncate max-w-full text-center px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: color + '18', color }}
                >
                  {d.title}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* Upcoming deadlines beyond this week */}
      {upcomingDeadlines.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-text-muted/40 font-mono uppercase tracking-[0.1em]">
            Ahead:
          </span>
          {upcomingDeadlines.map((d) => {
            const color = countdownColorMap[d.id] || '#E55547';
            return (
              <span
                key={d.id}
                className="font-medium px-2 py-0.5 rounded"
                style={{ backgroundColor: color + '15', color }}
              >
                {d.title} · {format(parseISO(d.dueDate), 'EEE MMM d')}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode 3: Active Week — the thread narrative
// ---------------------------------------------------------------------------

function formatMins(m: number): string {
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }
  return `${m}m`;
}

function ActiveWeekContent() {
  const {
    weeklyGoals,
    monthlyPlan,
    addWeeklyGoal,
    weeklyPlanningLastCompleted,
    rituals,
    workdayStart,
    workdayEnd,
    setView,
  } = useApp();
  const attentionData = useAttentionBalance();

  const ritualMins = rituals.reduce((sum, r) => sum + (r.estimateMins ?? 0), 0);
  const totalWorkMins = (workdayEnd.hour * 60 + workdayEnd.min) - (workdayStart.hour * 60 + workdayStart.min);
  const focusMins = Math.max(0, totalWorkMins - ritualMins);

  return (
    <div className="flex-1 overflow-y-auto flex flex-col hide-scrollbar">
      <div className="max-w-2xl mx-auto w-full px-10 py-10">
        {/* North star: Monthly aim */}
        {monthlyPlan && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-muted/60">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <h3 className="mt-2 font-display italic text-[26px] font-light text-text-primary leading-snug">
              {monthlyPlan.oneThing}
            </h3>
          </div>
        )}

        {/* Week map — the hero: see your week at a glance */}
        <CommittedWeekMap />

        {/* Thread cards */}
        <div className="flex flex-col gap-3 mt-5">
          {weeklyGoals.map((goal) => {
            const attention = attentionData.find((a) => a.goalId === goal.id);
            if (!attention) return null;
            return (
              <ThreadEntry
                key={goal.id}
                goal={goal}
                attention={attention}
              />
            );
          })}

          {weeklyGoals.length < MAX_WEEKLY_GOALS && (
            <AddThreadInput
              index={weeklyGoals.length}
              onAdd={(title) =>
                addWeeklyGoal(title, THREAD_COLORS[weeklyGoals.length % THREAD_COLORS.length])
              }
            />
          )}
        </div>

        {/* Daily practices */}
        {rituals.length > 0 && (
          <div className="mt-4 text-[13px] text-text-muted">
            <span className="font-mono uppercase tracking-widest text-[11px] text-text-muted/40">
              Daily:{' '}
            </span>
            {rituals.map((r, i) => (
              <span key={r.id}>
                {r.title}
                {r.estimateMins ? ` ${formatMins(r.estimateMins)}` : ''}
                {i < rituals.length - 1 ? ' · ' : ''}
              </span>
            ))}
            <span className="text-text-muted/40">
              {' '}— ~{formatMins(focusMins)}/day for goals
            </span>
          </div>
        )}

        {/* Plan your day CTA — only on the day planning was completed */}
        {weeklyPlanningLastCompleted === format(new Date(), 'yyyy-MM-dd') && (
          <div className="mt-6 text-center">
            <p className="font-display italic text-[14px] text-text-muted/50 mb-3">
              Looks right?
            </p>
            <button
              onClick={() => setView('flow')}
              className="px-5 py-2 rounded-md bg-accent-warm/10 border border-accent-warm/20 text-[13px] font-medium text-accent-warm hover:bg-accent-warm/15 transition-colors"
            >
              Plan your day →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const MODE_SUBTITLES: Record<string, string> = {
  'month-not-set': 'Start here.',
  'week-not-planned': 'Your month has direction. Now plan the week.',
};

export function WeeklyIntentions() {
  const mode = useWeeklyMode();

  return (
    <div className="editorial-panel flex-1 glass paper-texture flex flex-col h-full">
      <div className="h-14 px-8 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-display italic text-[22px] font-light tracking-wide text-text-emphasis">
            Weekly Intentions
          </h2>
          {mode !== 'active-week' && MODE_SUBTITLES[mode] && (
            <p className="text-[12px] text-text-muted mt-0.5">{MODE_SUBTITLES[mode]}</p>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          className="flex flex-1 flex-col min-h-0"
          {...modeTransition}
        >
          {mode === 'month-not-set' && <MonthNotSetPrompt />}
          {mode === 'week-not-planned' && <WeekNotPlannedPrompt />}
          {mode === 'active-week' && <ActiveWeekContent />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
