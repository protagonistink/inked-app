import { useState, useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import { usePlanner } from '@/context/AppContext';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import { cn } from '@/lib/utils';

interface FocusViewProps {
  taskId: string;
  onExit: () => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatMinsLeft(minsLeft: number): string {
  if (minsLeft <= 1) return 'less than a minute left in this block';
  return `${minsLeft} minute${minsLeft === 1 ? '' : 's'} left in this block`;
}

export function FocusView({ taskId, onExit }: FocusViewProps) {
  const { plannedTasks, weeklyGoals, scheduleBlocks, toggleTask } = usePlanner();

  const [timerProgress, setTimerProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const cleanup = window.api.pomodoro.onTick((state) => {
      setIsRunning(state.isRunning);
      setTimeRemaining(state.timeRemaining);
      if (state.isRunning && state.totalTime > 0) {
        setTimerProgress(1 - state.timeRemaining / state.totalTime);
      } else {
        setTimerProgress(0);
      }
    });
    return cleanup;
  }, []);

  const task = useMemo(
    () => plannedTasks.find((t) => t.id === taskId) ?? null,
    [plannedTasks, taskId]
  );

  const linkedGoal = useMemo(() => {
    if (!task?.weeklyGoalId) return null;
    return weeklyGoals.find((g) => g.id === task.weeklyGoalId) ?? null;
  }, [task, weeklyGoals]);

  const timeInfo = useMemo(() => {
    const now = new Date();
    const timeStr = formatTime(now);

    const block = scheduleBlocks.find((b) => b.linkedTaskId === taskId);
    if (!block) return { timeStr, minsLeft: null };

    const blockEndMins = block.startHour * 60 + block.startMin + block.durationMins;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const minsLeft = Math.max(0, blockEndMins - nowMins);

    return { timeStr, minsLeft };
  }, [scheduleBlocks, taskId]);

  // ESC key exits focus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onExit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  async function handleDone() {
    await toggleTask(taskId);
    onExit();
  }

  // Last 5 minutes: intensify bleed slightly
  const isUrgent = timeRemaining <= 300 && timeRemaining > 0 && isRunning;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg overflow-hidden">
      {/* Ink bleed background */}
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear pointer-events-none"
        style={{
          width: `${timerProgress * 100}%`,
          background: isUrgent
            ? 'linear-gradient(90deg, rgba(200,60,47,0.11) 0%, rgba(200,60,47,0.07) 70%, transparent 100%)'
            : 'linear-gradient(90deg, rgba(200,60,47,0.07) 0%, rgba(200,60,47,0.04) 70%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-y-0 blur-[8px] transition-[left] duration-1000 ease-linear pointer-events-none"
        style={{
          left: `${timerProgress * 100}%`,
          width: '40px',
          background: isUrgent
            ? 'linear-gradient(90deg, rgba(200,60,47,0.07), transparent)'
            : 'linear-gradient(90deg, rgba(200,60,47,0.04), transparent)',
        }}
      />

      {/* Center stage */}
      <div className="relative z-10 flex flex-col items-center gap-8 max-w-xl w-full px-8 text-center">

        {/* Task title row with circle check */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleDone()}
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              style={{
                borderColor: task?.status === 'done' ? 'var(--color-accent-warm)' : 'var(--color-text-muted)',
                background: task?.status === 'done' ? 'var(--color-accent-warm)' : 'transparent',
              }}
              title="Mark done and exit focus"
            >
              {task?.status === 'done' && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
            </button>
            <h1 className="font-display text-3xl text-text-emphasis leading-tight">
              {task?.title ?? 'Focus'}
            </h1>
          </div>

          {/* Goal badge (unchanged) */}
          {linkedGoal && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1',
                'text-[11px] uppercase tracking-[0.16em] font-medium',
                'border border-border-subtle'
              )}
              style={{
                color: linkedGoal.color,
                borderColor: `${linkedGoal.color}40`,
                backgroundColor: `${linkedGoal.color}18`,
              }}
            >
              {linkedGoal.title}
            </span>
          )}
        </div>

        {/* Pomodoro timer — prominent, centered */}
        <div className="scale-125 origin-center">
          <PomodoroTimer />
        </div>

        {/* Start work CTA — only when not yet running */}
        {!isRunning && (
          <button
            onClick={() => void window.api.pomodoro.start(taskId, task?.title ?? 'Focus')}
            className="w-full max-w-xs rounded-xl py-3 text-[14px] font-medium transition-colors"
            style={{
              background: 'var(--color-accent-warm)',
              color: 'var(--color-text-on-accent)',
            }}
          >
            Start work
          </button>
        )}

        {/* Time-of-day awareness */}
        <div className="text-[13px] text-text-muted tabular-nums">
          {timeInfo.timeStr}
          {timeInfo.minsLeft !== null && (
            <span className="text-text-muted/60 ml-1">
              — {formatMinsLeft(timeInfo.minsLeft)}
            </span>
          )}
        </div>

      </div>

      {/* ESC hint */}
      <p className="absolute bottom-8 text-[11px] uppercase tracking-[0.18em] text-text-muted/40 select-none">
        Press ESC to exit focus
      </p>
    </div>
  );
}
