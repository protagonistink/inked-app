import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { endOfWeek, format, startOfWeek } from 'date-fns';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import type { InboxItem, MonthlyPlan, PlannedTask } from '@/types';

const WORKDAY_START_MINS = 9 * 60;

const GOAL_COLORS = [
  { label: 'Warm', value: 'bg-accent-warm' },
  { label: 'Muted', value: 'bg-done' },
  { label: 'Green', value: 'bg-accent-green' },
];

// ─── Shared helpers ────────────────────────────────────────────────────────────

function formatMins(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`;
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-1.5 h-1.5 rounded-full transition-all duration-300',
            i < step ? 'bg-text-primary' : 'bg-border'
          )}
        />
      ))}
    </div>
  );
}

// ─── Step 1: Review ───────────────────────────────────────────────────────────

function StepReview({
  migratedTasks,
  onDrop,
  candidateItems,
}: {
  migratedTasks: PlannedTask[];
  onDrop: (id: string) => void;
  candidateItems: InboxItem[];
}) {
  const candidateCount = candidateItems.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          What carries forward
        </h2>
        <p className="text-[13px] text-text-muted mt-2">
          {migratedTasks.length > 0
            ? "Keep what still matters. Drop what doesn't."
            : 'Nothing left unfinished from last week.'}
        </p>
      </div>

      {migratedTasks.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-display italic text-[18px] text-text-muted">Clean slate.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {migratedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-3"
            >
              <div className="flex-1">
                <div className="text-[13px] text-text-primary leading-snug">{task.title}</div>
                {task.asanaProject && (
                  <div className="text-[11px] text-text-muted mt-0.5">{task.asanaProject}</div>
                )}
              </div>
              <button
                onClick={() => onDrop(task.id)}
                className="text-text-muted hover:text-text-primary transition-colors p-1"
                aria-label="Drop task"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Asana Inbox Section */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
          In Your Asana Inbox
        </div>
        <div className="rounded-md border border-dashed border-border px-4 py-3">
          <div className="text-[12px] text-text-muted">
            {candidateCount > 0
              ? `${candidateCount} tasks waiting`
              : 'Inbox is clear.'}
          </div>
          {candidateItems.slice(0, 3).map((item) => (
            <div key={item.id} className="text-[11px] text-text-muted mt-1">
              · {item.title}
            </div>
          ))}
        </div>
      </div>

      {/* Asana Cleanup Nudge */}
      <div className="rounded-md border border-border bg-bg-card px-4 py-3 flex items-center justify-between">
        <span className="text-[12px] text-text-muted">
          Before you commit — go clean up Asana.
        </span>
        <button
          onClick={() => void window.api.shell.openExternal('https://app.asana.com')}
          className="text-[12px] text-accent-warm hover:text-accent-warm/80 transition-colors shrink-0 ml-4"
        >
          Open Asana →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Goals ─────────────────────────────────────────────────────────────

function IntentionCard({
  index,
  goal,
  onRename,
  onUpdateWhy,
  onUpdateColor,
  onUpdateCountdown,
  onAdd,
  countdowns,
}: {
  index: number;
  goal?: { id: string; title: string; color: string; why?: string; countdownId?: string };
  onRename: (id: string, title: string) => void;
  onUpdateWhy: (id: string, why: string) => void;
  onUpdateColor: (id: string, color: string) => void;
  onUpdateCountdown: (id: string, countdownId: string | null) => void;
  onAdd: (title: string, color: string) => void;
  countdowns: { id: string; title: string; dueDate: string }[];
}) {
  const [localTitle, setLocalTitle] = useState(goal?.title || '');
  const [localWhy, setLocalWhy] = useState(goal?.why || '');
  const [localColor, setLocalColor] = useState(goal?.color || GOAL_COLORS[index % GOAL_COLORS.length].value);
  const [isAdding, setIsAdding] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalTitle(goal?.title || '');
    setLocalWhy(goal?.why || '');
    setLocalColor(goal?.color || GOAL_COLORS[index % GOAL_COLORS.length].value);
  }, [goal, index]);

  if (!goal && !isAdding) {
    return (
      <button
        onClick={() => { setIsAdding(true); setTimeout(() => titleRef.current?.focus(), 50); }}
        className="rounded-lg border border-dashed border-border bg-bg-card p-5 flex items-center gap-3 text-left hover:border-border-hover transition-colors w-full"
      >
        <Plus className="w-4 h-4 text-text-muted" />
        <span className="text-[13px] text-text-muted">Add intention {index + 1}...</span>
      </button>
    );
  }

  const activeColor = goal?.color || localColor;
  const activeId = goal?.id;

  function handleTitleBlur() {
    if (!goal && isAdding && localTitle.trim()) {
      onAdd(localTitle.trim(), localColor);
      setIsAdding(false);
    } else if (goal && localTitle.trim()) {
      onRename(goal.id, localTitle);
    } else if (!goal && isAdding) {
      setIsAdding(false);
    }
  }

  function handleWhyBlur() {
    if (goal) onUpdateWhy(goal.id, localWhy);
  }

  function handleColorClick(color: string) {
    setLocalColor(color);
    if (activeId) onUpdateColor(activeId, color);
  }

  return (
    <div className="rounded-lg border border-border bg-bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-2">
          {GOAL_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => handleColorClick(c.value)}
              className={cn(
                'w-4 h-4 rounded-full transition-all',
                c.value,
                activeColor === c.value ? 'ring-2 ring-offset-2 ring-text-muted ring-offset-bg-card' : 'opacity-50 hover:opacity-80'
              )}
              aria-label={c.label}
            />
          ))}
        </div>
        <input
          ref={titleRef}
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onBlur={handleTitleBlur}
          placeholder="Name this intention..."
          className="flex-1 bg-transparent border-none outline-none text-[15px] font-medium text-text-primary placeholder:text-text-muted"
        />
      </div>

      <textarea
        value={localWhy}
        onChange={(e) => setLocalWhy(e.target.value)}
        onBlur={handleWhyBlur}
        placeholder="What will this give you?"
        rows={2}
        maxLength={160}
        className="bg-bg rounded-md border border-border-subtle px-3 py-2.5 text-[13px] text-text-primary placeholder:text-text-muted resize-none outline-none focus:border-border transition-colors leading-relaxed"
      />

      {goal && countdowns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onUpdateCountdown(goal.id, null)}
            className={cn(
              'px-2 py-0.5 rounded text-xs transition-colors',
              !goal.countdownId
                ? 'bg-accent-warm/15 text-accent-warm'
                : 'text-text-muted hover:text-text-primary'
            )}
          >
            No deadline
          </button>
          {countdowns.map((cd) => (
            <button
              key={cd.id}
              onClick={() => onUpdateCountdown(goal.id, cd.id)}
              className={cn(
                'px-2 py-0.5 rounded text-xs transition-colors',
                goal.countdownId === cd.id
                  ? 'bg-accent-warm/15 text-accent-warm'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              {cd.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StepGoals({ monthlyPlan }: { monthlyPlan: MonthlyPlan | null }) {
  const { weeklyGoals, addWeeklyGoal, renameWeeklyGoal, updateGoalWhy, updateGoalColor, updateGoalCountdown, countdowns } = useApp();

  const slots = [0, 1, 2];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          What you're moving toward
        </h2>
        <p className="text-[13px] text-text-muted mt-2">
          Three intentions. What you're building, making, becoming this week.
        </p>
      </div>

      {monthlyPlan?.oneThing && (
        <p className="font-display italic text-[14px] text-text-muted leading-relaxed">
          {new Date().toLocaleDateString('en-US', { month: 'long' })}: {monthlyPlan.oneThing}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {slots.map((i) => (
          <IntentionCard
            key={weeklyGoals[i]?.id || `empty-${i}`}
            index={i}
            goal={weeklyGoals[i]}
            onRename={renameWeeklyGoal}
            onUpdateWhy={updateGoalWhy}
            onUpdateColor={updateGoalColor}
            onUpdateCountdown={updateGoalCountdown}
            onAdd={(title, color) => addWeeklyGoal(title, color)}
            countdowns={countdowns}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Rituals ──────────────────────────────────────────────────────────

function StepRituals() {
  const { rituals, addRitual, removeRitual, updateRitualEstimate, workdayEnd } = useApp();
  const [ritualDraft, setRitualDraft] = useState('');

  const totalRitualMins = rituals.reduce((sum, r) => sum + (r.estimateMins ?? 0), 0);
  const workdayMins = (workdayEnd.hour * 60 + workdayEnd.min) - WORKDAY_START_MINS;
  const focusedMins = Math.max(0, workdayMins - totalRitualMins);

  function getStepMins(current: number): number {
    if (current < 60) return 15;
    if (current < 120) return 30;
    return 60;
  }

  function formatWorkdayEnd(hour: number, min: number): string {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const m = min.toString().padStart(2, '0');
    return `${h}:${m} ${suffix}`;
  }

  function handleAddRitual(e: React.FormEvent) {
    e.preventDefault();
    if (ritualDraft.trim()) {
      addRitual(ritualDraft.trim());
      setRitualDraft('');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          Account for your rituals.
        </h2>
        <p className="text-[13px] text-text-muted mt-2">
          These take real time. Name them, estimate them, plan around them.
        </p>
      </div>

      {/* Ritual list with time estimates */}
      <div className="flex flex-col gap-2">
        {rituals.map((ritual) => (
          <div key={ritual.id} className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-2.5">
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
              className="text-text-muted hover:text-text-primary transition-colors p-1"
              aria-label="Remove ritual"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add ritual form */}
      <form onSubmit={handleAddRitual} className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5">
        <Plus className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <input
          type="text"
          value={ritualDraft}
          onChange={(e) => setRitualDraft(e.target.value)}
          placeholder="Add a daily ritual..."
          className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted outline-none"
        />
      </form>

      {/* Capacity summary */}
      {rituals.length > 0 && (
        <div className="rounded-lg border border-border bg-bg-card px-4 py-4 flex flex-col gap-1">
          <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted mb-2">
            Daily Ritual Load
          </div>
          <div className="text-[13px] text-text-primary">
            {formatMins(totalRitualMins)} committed to rituals
          </div>
          <div className={`text-[13px] ${focusedMins < 180 ? 'text-accent-warm' : 'text-text-muted'}`}>
            ~{formatMins(focusedMins)} available for goal work
          </div>
          <div className="text-[12px] text-text-muted mt-1">
            Workday ends at {formatWorkdayEnd(workdayEnd.hour, workdayEnd.min)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Locked In ────────────────────────────────────────────────────────

function StepLockedIn({ carriedForwardCount }: { carriedForwardCount: number }) {
  const { weeklyGoals, rituals, workdayEnd, monthlyPlan } = useApp();

  const totalRitualMins = rituals.reduce((sum, r) => sum + (r.estimateMins ?? 0), 0);
  const workdayMins = workdayEnd.hour * 60 + workdayEnd.min - WORKDAY_START_MINS;
  const focusedMins = Math.max(0, workdayMins - totalRitualMins);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekRange = `${format(weekStart, 'MMMM d')} – ${format(weekEnd, 'd')}`;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          Your week is set.
        </h2>
        <p className="text-[13px] text-text-muted mt-1 font-mono uppercase tracking-widest">
          {weekRange}
        </p>
      </div>

      {monthlyPlan?.oneThing && (
        <div className="flex flex-col gap-1">
          <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
            {new Date().toLocaleDateString('en-US', { month: 'long' })}
          </div>
          <div className="font-display italic text-[14px] text-text-muted leading-relaxed">
            {monthlyPlan.oneThing}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
          This Week
        </div>
        {weeklyGoals.map((goal, index) => (
          <motion.div
            key={goal.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.08, ease: 'easeOut' }}
            className="rounded-lg border border-border bg-bg-card p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', goal.color)} />
              <h3 className="text-[15px] font-medium text-text-primary">{goal.title}</h3>
            </div>
            {goal.why && (
              <p className="text-[13px] text-text-muted italic pl-[22px] leading-relaxed">
                "{goal.why}"
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {(totalRitualMins > 0 || carriedForwardCount > 0) && (
        <div className="flex items-center gap-6 text-[12px] text-text-muted">
          {carriedForwardCount > 0 && (
            <span>
              <span className="font-mono uppercase tracking-widest text-[10px]">Carried </span>
              {carriedForwardCount} {carriedForwardCount === 1 ? 'task' : 'tasks'}
            </span>
          )}
          {totalRitualMins > 0 && (
            <>
              <span>
                <span className="font-mono uppercase tracking-widest text-[10px]">Rituals </span>
                {formatMins(totalRitualMins)}/day
              </span>
              <span>
                <span className="font-mono uppercase tracking-widest text-[10px]">Focus </span>
                ~{formatMins(focusedMins)}/day
              </span>
            </>
          )}
        </div>
      )}

      <p className="font-display italic text-[16px] text-text-muted text-center">
        Three things. Seven days. Make it count.
      </p>
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
    candidateItems,
    monthlyPlan,
  } = useApp();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [migratedTasks, setMigratedTasks] = useState<PlannedTask[]>([]);
  const [droppedIds, setDroppedIds] = useState<Set<string>>(new Set());

  const TOTAL_STEPS = 4;

  // Run migration when wizard opens
  useEffect(() => {
    if (isWeeklyPlanningOpen) {
      setStep(1);
      setDroppedIds(new Set());
      const tasks = migrateOldTasks();
      setMigratedTasks(tasks);
    }
  }, [isWeeklyPlanningOpen, migrateOldTasks]);

  if (!isWeeklyPlanningOpen) return null;

  const visibleMigrated = migratedTasks.filter((t) => !droppedIds.has(t.id));

  function handleDrop(id: string) {
    dropTask(id);
    setDroppedIds((prev) => new Set([...prev, id]));
  }

  function handleNext() {
    if (step < TOTAL_STEPS) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      completeWeeklyPlanning();
    }
  }

  function handleBack() {
    if (step > 1) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }

  const stepLabels = [
    "What's Live",
    'Your Goals',
    'Your Rituals',
    'Locked In',
  ];

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
          'relative z-10 w-full mx-6 bg-bg-elevated border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]',
          step === 4 ? 'max-w-2xl' : 'max-w-xl'
        )}
        transition={{ layout: { duration: 0.3, ease: 'easeOut' } }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-7 pb-0 shrink-0">
          <StepIndicator step={step} total={TOTAL_STEPS} />
          <div className="text-[11px] font-mono text-text-muted">
            {stepLabels[step - 1]}
          </div>
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
                  candidateItems={candidateItems}
                />
              )}
              {step === 2 && <StepGoals monthlyPlan={monthlyPlan} />}
              {step === 3 && <StepRituals />}
              {step === 4 && <StepLockedIn carriedForwardCount={visibleMigrated.length} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 pb-7 pt-4 border-t border-border-subtle shrink-0">
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="text-[13px] text-text-muted hover:text-text-primary transition-colors"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step === TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-md bg-accent-warm text-bg text-[13px] font-medium hover:bg-accent-warm/90 transition-colors"
            >
              Begin the Week
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-md bg-bg-card border border-border text-[13px] font-medium text-text-primary hover:bg-bg hover:border-border-hover transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
