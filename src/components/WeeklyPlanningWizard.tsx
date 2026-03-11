import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import type { PlannedTask } from '@/types';

const GOAL_COLORS = [
  { label: 'Warm', value: 'bg-accent-warm' },
  { label: 'Teal', value: 'bg-accent-teal' },
  { label: 'Green', value: 'bg-done' },
];

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

// ─── Step 1: Carry Forward ────────────────────────────────────────────────────

function StepCarryForward({
  migratedTasks,
  onDrop,
}: {
  migratedTasks: PlannedTask[];
  onDrop: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          What carries forward
        </h2>
        <p className="text-[13px] text-text-muted mt-2">
          {migratedTasks.length > 0
            ? 'Keep what still matters. Drop what doesn\'t.'
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
    </div>
  );
}

// ─── Step 2: Commitments ──────────────────────────────────────────────────────

function StepCommitments() {
  const { rituals, addRitual, removeRitual, countdowns, addCountdown, removeCountdown } = useApp();
  const [ritualDraft, setRitualDraft] = useState('');
  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownDate, setCountdownDate] = useState('');

  function handleAddRitual(e: React.FormEvent) {
    e.preventDefault();
    if (ritualDraft.trim()) {
      addRitual(ritualDraft.trim());
      setRitualDraft('');
    }
  }

  function handleAddCountdown(e: React.FormEvent) {
    e.preventDefault();
    if (countdownTitle.trim() && countdownDate) {
      addCountdown(countdownTitle.trim(), countdownDate);
      setCountdownTitle('');
      setCountdownDate('');
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          What you always do
        </h2>
        <p className="text-[13px] text-text-muted mt-2">
          The recurring work and the hard dates anchoring this week.
        </p>
      </div>

      {/* Rituals */}
      <div className="flex flex-col gap-3">
        <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
          Daily Rituals
        </div>

        {rituals.length > 0 && (
          <div className="flex flex-col gap-2">
            {rituals.map((ritual) => (
              <div key={ritual.id} className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-2.5">
                <span className="flex-1 text-[13px] text-text-primary">{ritual.title}</span>
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
        )}

        <form onSubmit={handleAddRitual} className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5">
          <Plus className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            value={ritualDraft}
            onChange={(e) => setRitualDraft(e.target.value)}
            placeholder="Add a daily ritual..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-text-primary placeholder:text-text-muted"
          />
        </form>
      </div>

      {/* Countdowns */}
      <div className="flex flex-col gap-3">
        <div className="text-[11px] font-mono uppercase tracking-widest text-text-muted">
          Upcoming Deadlines
        </div>

        {countdowns.length > 0 && (
          <div className="flex flex-col gap-2">
            {countdowns.map((cd) => (
              <div key={cd.id} className="flex items-center gap-3 rounded-md border border-border bg-bg-card px-4 py-2.5">
                <span className="flex-1 text-[13px] text-text-primary">{cd.title}</span>
                <span className="text-[11px] font-mono text-text-muted">{cd.dueDate}</span>
                <button
                  onClick={() => removeCountdown(cd.id)}
                  className="text-text-muted hover:text-text-primary transition-colors p-1"
                  aria-label="Remove deadline"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAddCountdown} className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5">
          <Plus className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <input
            value={countdownTitle}
            onChange={(e) => setCountdownTitle(e.target.value)}
            placeholder="What's due..."
            className="flex-1 bg-transparent border-none outline-none text-[13px] text-text-primary placeholder:text-text-muted"
          />
          <input
            type="date"
            value={countdownDate}
            onChange={(e) => setCountdownDate(e.target.value)}
            className="bg-transparent border-none outline-none text-[12px] font-mono text-text-muted [color-scheme:dark]"
          />
        </form>
      </div>
    </div>
  );
}

// ─── Step 3: Intentions ───────────────────────────────────────────────────────

function IntentionCard({
  index,
  goal,
  onRename,
  onUpdateWhy,
  onUpdateColor,
  onAdd,
}: {
  index: number;
  goal?: { id: string; title: string; color: string; why?: string };
  onRename: (id: string, title: string) => void;
  onUpdateWhy: (id: string, why: string) => void;
  onUpdateColor: (id: string, color: string) => void;
  onAdd: (title: string, color: string) => void;
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
    </div>
  );
}

function StepIntentions() {
  const { weeklyGoals, addWeeklyGoal, renameWeeklyGoal, updateGoalWhy, updateGoalColor } = useApp();

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

      <div className="flex flex-col gap-4">
        {slots.map((i) => (
          <IntentionCard
            key={weeklyGoals[i]?.id || `empty-${i}`}
            index={i}
            goal={weeklyGoals[i]}
            onRename={renameWeeklyGoal}
            onUpdateWhy={updateGoalWhy}
            onUpdateColor={updateGoalColor}
            onAdd={(title, color) => addWeeklyGoal(title, color)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Step 4: Locked In ────────────────────────────────────────────────────────

function StepLockedIn() {
  const { weeklyGoals } = useApp();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display italic text-[28px] font-light tracking-wide text-text-primary">
          Your week is set.
        </h2>
      </div>

      <div className="flex flex-col gap-4">
        {weeklyGoals.map((goal) => (
          <div key={goal.id} className="rounded-lg border border-border bg-bg-card p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', goal.color)} />
              <h3 className="text-[15px] font-medium text-text-primary">{goal.title}</h3>
            </div>
            {goal.why && (
              <p className="text-[13px] text-text-muted italic pl-[22px] leading-relaxed">
                "{goal.why}"
              </p>
            )}
          </div>
        ))}
      </div>

      <p className="font-display italic text-[16px] text-text-muted text-center">
        Three things. Seven days. Make it count.
      </p>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export function WeeklyPlanningWizard() {
  const { isWeeklyPlanningOpen, closeWeeklyPlanning, completeWeeklyPlanning, migrateOldTasks, dropTask } = useApp();
  const [step, setStep] = useState(1);
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
      setStep((s) => s + 1);
    } else {
      completeWeeklyPlanning();
    }
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  const stepLabels = [
    'Carry Forward',
    'Your Commitments',
    'Your Intentions',
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
      <div className="relative z-10 w-full max-w-xl mx-6 bg-bg-elevated border border-border rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
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
          {step === 1 && (
            <StepCarryForward migratedTasks={visibleMigrated} onDrop={handleDrop} />
          )}
          {step === 2 && <StepCommitments />}
          {step === 3 && <StepIntentions />}
          {step === 4 && <StepLockedIn />}
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

          <button
            onClick={handleNext}
            className="px-5 py-2 rounded-md bg-bg-card border border-border text-[13px] font-medium text-text-primary hover:bg-bg hover:border-border-hover transition-colors"
          >
            {step === TOTAL_STEPS ? 'Begin the Week' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
