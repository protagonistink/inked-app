import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, isSameDay, startOfWeek } from 'date-fns';
import { CalendarRange, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import type { PlannedTask, WeeklyGoal } from '@/types';

const GOAL_COLORS = [
  { label: 'Warm', value: 'bg-accent-warm' },
  { label: 'Muted', value: 'bg-done' },
  { label: 'Green', value: 'bg-done' },
];

function WeekOverview() {
  const { countdowns, committedTasks, scheduleBlocks } = useApp();
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const today = new Date();
  const todayFocusMins = scheduleBlocks
    .filter((block) => block.kind === 'focus')
    .reduce((sum, block) => sum + block.durationMins, 0);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const dayKey = format(day, 'yyyy-MM-dd');
    const deadlines = countdowns.filter((countdown) => countdown.dueDate === dayKey);
    const isToday = isSameDay(day, today);

    return {
      day,
      dayKey,
      deadlines,
      isToday,
      summary: isToday
        ? todayFocusMins > 0
          ? `${todayFocusMins}m in focus blocks`
          : `${committedTasks.length} tasks held`
        : index === 0
          ? 'Weekly planning window'
          : deadlines.length > 0
            ? `${deadlines.length} deadline${deadlines.length === 1 ? '' : 's'}`
            : 'Protect the thread',
    };
  });

  return (
    <section className="editorial-card rounded-[24px] px-7 py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Week View</div>
          <h3 className="mt-2 text-[16px] font-medium text-text-primary">The week at a glance</h3>
          <p className="mt-1 text-[12px] text-text-muted">Monday frames it. The rest of the week protects it.</p>
        </div>
        <div className="rounded-full bg-bg-elevated/70 p-3 text-text-muted">
          <CalendarRange className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map(({ day, dayKey, deadlines, isToday, summary }, index) => (
          <div
            key={dayKey}
            className={cn(
              'rounded-2xl border px-3 py-3 min-h-[132px] transition-all duration-300',
              isToday
                ? 'border-accent-warm/28 bg-accent-warm/[0.05] shadow-[0_0_24px_rgba(200,60,47,0.08)]'
                : 'editorial-inset'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">
                  {format(day, 'EEE')}
                </div>
                <div className="mt-1 text-[14px] font-medium text-text-primary">{format(day, 'd')}</div>
              </div>
              {index === 0 && (
                <span className="rounded-full border border-border-subtle px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-text-muted">
                  Plan
                </span>
              )}
              {isToday && (
                <span className="rounded-full border border-accent-warm/30 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-accent-warm">
                  Today
                </span>
              )}
            </div>

            <div className="mt-4 text-[12px] leading-relaxed text-text-primary">{summary}</div>

            <div className="mt-3 flex flex-col gap-1.5">
              {deadlines.slice(0, 2).map((deadline) => (
                <div key={deadline.id} className="editorial-inset rounded-xl px-2.5 py-2 text-[11px] text-text-muted">
                  <span className="block truncate text-text-primary">{deadline.title}</span>
                  <span className="mt-1 block uppercase tracking-[0.14em] text-[9px]">Deadline</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyIntentionCard({
  index,
  onAdd,
}: {
  index: number;
  onAdd: (title: string, color: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(GOAL_COLORS[index % GOAL_COLORS.length].value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="editorial-card rounded-[24px] border-dashed p-6">
      <div className="flex items-center gap-3">
        <Plus className="w-4 h-4 text-text-muted" />
        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && title.trim()) {
              e.preventDefault();
              onAdd(title.trim(), color);
            }
          }}
          placeholder={`Add intention ${index + 1}...`}
          className="flex-1 bg-transparent border-none outline-none text-[15px] text-text-primary placeholder:text-text-muted"
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        {GOAL_COLORS.map((option) => (
          <button
            key={option.value}
            onClick={() => setColor(option.value)}
            className={cn(
              'w-4 h-4 rounded-full transition-all',
              option.value,
              color === option.value ? 'ring-2 ring-offset-2 ring-text-muted ring-offset-bg-card' : 'opacity-50 hover:opacity-80'
            )}
            aria-label={option.label}
          />
        ))}
      </div>
    </div>
  );
}

function IntentionCard({
  goal,
  tasks,
  index,
}: {
  goal: WeeklyGoal;
  tasks: PlannedTask[];
  index: number;
}) {
  const { renameWeeklyGoal, updateGoalWhy, updateGoalColor } = useApp();
  const [title, setTitle] = useState(goal.title);
  const [why, setWhy] = useState(goal.why || '');

  useEffect(() => {
    setTitle(goal.title);
    setWhy(goal.why || '');
  }, [goal]);

  const doneCount = tasks.filter((task) => task.status === 'done').length;

  return (
    <div className="editorial-card rounded-[24px] p-6">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex flex-col gap-2">
          {GOAL_COLORS.map((option) => (
            <button
              key={option.value}
              onClick={() => updateGoalColor(goal.id, option.value)}
              className={cn(
                'w-3.5 h-3.5 rounded-full transition-all',
                option.value,
                goal.color === option.value ? 'ring-2 ring-offset-2 ring-text-muted ring-offset-bg-card' : 'opacity-45 hover:opacity-80'
              )}
              aria-label={option.label}
            />
          ))}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => renameWeeklyGoal(goal.id, title)}
              className="flex-1 bg-transparent border-none outline-none text-[18px] font-medium text-text-primary"
            />
            <div className="text-[11px] font-mono text-text-muted">
              {doneCount}/{tasks.length || 0}
            </div>
          </div>

          <textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            onBlur={() => updateGoalWhy(goal.id, why)}
            rows={2}
            placeholder="Why this must hold this week."
            className="editorial-inset mt-3 w-full resize-none rounded-2xl px-3 py-3 text-[13px] leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-border"
          />
        </div>
      </div>

      <div className="editorial-inset mt-4 rounded-2xl px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-text-muted">Held inside this lane</div>
          <div className="text-[11px] text-text-muted">Intention {index + 1}</div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-subtle px-3 py-4 text-[12px] text-text-muted">
              Nothing assigned here yet.
            </div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="editorial-card rounded-xl px-3 py-2.5">
                <div className="text-[13px] leading-snug text-text-primary">{task.title}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  {task.status === 'scheduled' ? 'on calendar' : task.status}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function WeeklyIntentions() {
  const { weeklyGoals, plannedTasks, addWeeklyGoal, monthlyPlan, openMonthlyPlanning } = useApp();

  const groupedGoals = useMemo(
    () => weeklyGoals.map((goal) => ({
      goal,
      tasks: plannedTasks.filter(
        (task) =>
          task.weeklyGoalId === goal.id &&
          task.status !== 'candidate' &&
          task.status !== 'cancelled'
      ),
    })),
    [plannedTasks, weeklyGoals]
  );

  return (
    <div className="editorial-panel flex-1 glass paper-texture flex flex-col h-full">
      <div className="h-16 px-8 border-b border-border-subtle flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-display italic text-[24px] font-light tracking-wide text-text-emphasis transition-all duration-700">
            Weekly Intentions
          </h2>
          <p className="text-[12px] text-text-muted mt-1">
            Set the week upstairs. Edit it here when the week changes shape.
          </p>
        </div>
        <div className="text-[11px] font-mono text-text-muted">
          {weeklyGoals.length}/3 held
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col gap-8 hide-scrollbar">
        <WeekOverview />

        {monthlyPlan ? (
          <div className="border-b border-border-subtle pb-5 mb-2 flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
              <p className="mt-1 font-display italic text-[18px] font-light text-text-primary leading-snug">
                {monthlyPlan.oneThing}
              </p>
            </div>
            <button
              onClick={openMonthlyPlanning}
              className="shrink-0 text-[12px] text-text-muted hover:text-text-primary transition-colors mt-0.5"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="border-b border-border-subtle pb-5 mb-2 flex items-baseline justify-between gap-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-text-muted">
              {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} hasn't been planned
            </div>
            <button
              onClick={openMonthlyPlanning}
              className="shrink-0 text-[12px] text-accent-warm hover:text-accent-warm/80 transition-colors"
            >
              Plan now
            </button>
          </div>
        )}

        <section className="editorial-card rounded-[24px] px-7 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-text-muted">Intentions</div>
              <h3 className="mt-2 text-[16px] font-display italic font-light text-text-primary">The three threads you keep returning to</h3>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            {groupedGoals.map(({ goal, tasks }, index) => (
              <IntentionCard key={goal.id} goal={goal} tasks={tasks} index={index} />
            ))}

            {weeklyGoals.length < 3 && (
              <EmptyIntentionCard
                index={weeklyGoals.length}
                onAdd={(title, color) => addWeeklyGoal(title, color)}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
