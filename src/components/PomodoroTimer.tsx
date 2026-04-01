import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Square, Check, Coffee, FastForward, Plus } from 'lucide-react';
import type { PomodoroState } from '@/types';
import { cn } from '@/lib/utils';
import { useAppShell, usePlanner } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import { useGravityContext } from '@/context/GravityContext';

interface TimeboxDecisionState {
  taskId: string;
  taskTitle: string;
}

interface BreakNotification {
  taskTitle: string;
}

function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function PomodoroTimer() {
  const { setView } = useAppShell();
  const { logFocusSession, plannedTasks, setActiveTask, toggleTask } = usePlanner();
  const { enterFocusMode, exitFocusMode } = useTheme();
  const { active: gravityActive, staleGoalId, releaseGravity } = useGravityContext();
  const [state, setState] = useState<PomodoroState>({
    isRunning: false,
    isPaused: false,
    isBreak: false,
    timeRemaining: 0,
    totalTime: 0,
    currentTaskId: null,
    currentTaskTitle: null,
    pomodoroCount: 0,
  });
  const [lastWorkState, setLastWorkState] = useState<PomodoroState | null>(null);
  const [timeboxDecision, setTimeboxDecision] = useState<TimeboxDecisionState | null>(null);
  const [breakNotification, setBreakNotification] = useState<BreakNotification | null>(null);
  // Holds task info from the completed work session so we can show the dialog after the break
  const pendingDecisionRef = useRef<TimeboxDecisionState | null>(null);

  function logElapsedWorkSession(session: PomodoroState) {
    if (!session.currentTaskId || session.isBreak) return;
    const elapsedSeconds = Math.max(0, session.totalTime - session.timeRemaining);
    if (elapsedSeconds < 60) return;

    logFocusSession({
      taskId: session.currentTaskId,
      durationMins: elapsedSeconds / 60,
    });
  }

  useEffect(() => {
    const unsubscribe = window.api.pomodoro.onTick((newState) => {
      setState((prevState) => {
        const nextState = newState as PomodoroState;

        // Work session just ended → break starting: log the session, show break notification
        if (
          prevState.isRunning &&
          !prevState.isBreak &&
          nextState.isBreak &&
          prevState.currentTaskId
        ) {
          logFocusSession({
            taskId: prevState.currentTaskId,
            durationMins: prevState.totalTime / 60,
          });

          // Show break notification
          setBreakNotification({
            taskTitle: prevState.currentTaskTitle || 'Focus block',
          });

          const taskStillOpen = plannedTasks.find((task) => task.id === prevState.currentTaskId)?.status !== 'done';
          if (taskStillOpen) {
            pendingDecisionRef.current = {
              taskId: prevState.currentTaskId,
              taskTitle: prevState.currentTaskTitle || 'Focus block',
            };
          }
        }

        // Break just ended → auto-continuing to next work session
        if (
          prevState.isBreak &&
          !nextState.isBreak &&
          nextState.isRunning &&
          pendingDecisionRef.current
        ) {
          const pending = pendingDecisionRef.current;
          pendingDecisionRef.current = null;
          setActiveTask(pending.taskId);
          setTimeboxDecision(pending);
          setBreakNotification(null);
          void window.api.window.showMain();
        }

        // Timer fully stopped (user hit stop)
        if (prevState.isRunning && !nextState.isRunning) {
          setBreakNotification(null);
          if (pendingDecisionRef.current) {
            const pending = pendingDecisionRef.current;
            pendingDecisionRef.current = null;
            setActiveTask(pending.taskId);
            setTimeboxDecision(pending);
            void window.api.window.showMain();
          }
        }

        setLastWorkState(
          nextState.isBreak
            ? prevState
            : nextState.isRunning && !nextState.isBreak
              ? nextState
              : null
        );

        // Release gravity after 5 minutes on a stale-intention task
        if (gravityActive && nextState.isRunning && !nextState.isBreak && nextState.currentTaskId) {
          const elapsed = nextState.totalTime - nextState.timeRemaining;
          if (elapsed >= 300) {
            const task = plannedTasks.find((t) => t.id === nextState.currentTaskId);
            if (task?.weeklyGoalId === staleGoalId) {
              releaseGravity();
            }
          }
        }

        return nextState;
      });
    });
    return unsubscribe;
  }, [logFocusSession, plannedTasks, setActiveTask, setView, gravityActive, staleGoalId, releaseGravity]);

  useEffect(() => {
    if (state.isRunning) {
      enterFocusMode();
      return;
    }

    exitFocusMode();
  }, [enterFocusMode, exitFocusMode, state.isRunning]);

  // Auto-dismiss the timebox toast after 60s if the user ignores it
  useEffect(() => {
    if (!timeboxDecision) return;
    const timer = window.setTimeout(() => setTimeboxDecision(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [timeboxDecision]);


  const progress = state.totalTime > 0 ? 1 - state.timeRemaining / state.totalTime : 0;
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference * (1 - progress);

  // Last-5-minutes urgency shift
  const ringColor = state.isBreak
    ? 'rgba(45,212,191,0.5)'
    : (state.timeRemaining <= 300 && state.timeRemaining > 0)
      ? 'rgba(244,114,82,0.6)'
      : 'rgba(200,60,47,0.5)';

  return (
    <>
      {/* Break notification toast — shown when transitioning from work to break */}
      {breakNotification && state.isBreak && (
        <div className="fixed bottom-6 left-1/2 z-[140] w-full max-w-[520px] -translate-x-1/2 px-4 animate-slide-up">
          <div className="flex items-center gap-4 rounded-2xl border border-sky-400/20 bg-bg-card/96 px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <Coffee className="w-5 h-5 text-sky-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-[0.18em] text-sky-300">Break time</div>
              <div className="mt-0.5 truncate text-[13px] text-text-secondary">
                {formatSeconds(state.timeRemaining)} remaining
              </div>
            </div>
            <div className="flex shrink-0 gap-2 items-center">
              {/* Extend +5m */}
              <button
                onClick={() => void window.api.pomodoro.extendBreak(5)}
                title="Add 5 minutes"
                className="h-8 px-3 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center gap-1.5 hover:border-[rgba(255,255,255,0.12)] transition-colors"
              >
                <Plus className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] text-text-muted">5m</span>
              </button>
              {/* Skip break */}
              <button
                onClick={() => void window.api.pomodoro.skip()}
                title="Skip break"
                className="h-8 px-3 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center gap-1.5 hover:border-[rgba(255,255,255,0.12)] transition-colors"
              >
                <FastForward className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] text-text-muted">Skip</span>
              </button>
              {/* Stop entirely */}
              <button
                onClick={() => {
                  void window.api.pomodoro.stop();
                  setBreakNotification(null);
                }}
                title="End session"
                className="h-8 px-3 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center hover:border-[rgba(255,255,255,0.12)] transition-colors"
              >
                <Square className="w-3 h-3 text-text-muted" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timebox decision toast — shown when break ends and next session auto-starts */}
      {timeboxDecision && !state.isBreak && (
        <div className="fixed bottom-6 left-1/2 z-[140] w-full max-w-[520px] -translate-x-1/2 px-4">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-bg-card/96 px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-[0.18em] text-accent-warm">Next session started</div>
              <div className="mt-0.5 truncate font-display text-[15px] font-medium text-text-emphasis">
                {timeboxDecision.taskTitle}
              </div>
            </div>
            <div className="flex shrink-0 gap-3 items-center">
              {/* Pause/Play toggle */}
              <button
                onClick={() => void window.api.pomodoro.pause()}
                className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center hover:border-[rgba(255,255,255,0.12)] transition-colors"
              >
                {state.isPaused
                  ? <Play className="w-3.5 h-3.5 text-text-muted" />
                  : <Pause className="w-3.5 h-3.5 text-text-muted" />}
              </button>
              {/* Stop */}
              <button
                onClick={() => {
                  void window.api.pomodoro.stop();
                  setTimeboxDecision(null);
                }}
                className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center hover:border-[rgba(255,255,255,0.12)] transition-colors"
              >
                <Square className="w-3.5 h-3.5 text-text-muted" />
              </button>
              {/* Done — larger, rust-styled */}
              <button
                onClick={() => {
                  void toggleTask(timeboxDecision.taskId);
                  void window.api.pomodoro.stop();
                  setView('flow');
                  setTimeboxDecision(null);
                }}
                className="w-11 h-11 rounded-full bg-[rgba(200,60,47,0.1)] border border-[rgba(200,60,47,0.25)] flex items-center justify-center hover:bg-[rgba(200,60,47,0.15)] transition-colors"
              >
                <Check className="w-[18px] h-[18px] text-[rgba(220,100,85,0.9)]" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-center bg-transparent w-[220px] h-[220px] drag-region">
        <div className="relative flex items-center justify-center w-[180px] h-[180px]">
        {state.isBreak && (
          <>
            <div
              className="pointer-events-none absolute rounded-full animate-breathe h-[176px] w-[176px] bg-[radial-gradient(circle,rgba(45,212,191,0.24),rgba(45,212,191,0.08)_44%,transparent_74%)]"
            />
            <div
              className="pointer-events-none absolute rounded-full border border-sky-400/25 h-[152px] w-[152px]"
            />
          </>
        )}
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 180 180">
          <circle
            cx="90"
            cy="90"
            r="80"
            fill="var(--color-bg)"
            stroke="var(--color-border-subtle)"
            strokeWidth="3"
          />
          <circle
            cx="90"
            cy="90"
            r="80"
            fill="none"
            stroke={ringColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              'transition-all duration-700',
              state.isBreak && 'drop-shadow-[0_0_8px_rgba(45,212,191,0.45)]'
            )}
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center gap-1 text-center">
          <span className="font-mono font-medium text-text-emphasis tracking-wider text-[28px]">
            {formatSeconds(!state.isRunning && state.timeRemaining === 0 ? 25 * 60 : state.timeRemaining)}
          </span>
          <span className={cn(
            'uppercase tracking-widest max-w-[170px] text-[10px]',
            state.isBreak ? 'text-sky-300' : state.isRunning ? 'text-accent-warm' : 'text-text-muted'
          )}>
            {state.isBreak ? 'Take a breather' : state.isRunning ? (state.currentTaskTitle || 'Focus') : (state.currentTaskTitle || 'Ready')}
          </span>

          <div className="flex items-center gap-2 mt-1 no-drag">
            {!state.isRunning ? (
              <button
                onClick={() => void window.api.pomodoro.start(state.currentTaskId || lastWorkState?.currentTaskId || 'default', state.currentTaskTitle || lastWorkState?.currentTaskTitle || 'Focus')}
                title="Start focus session"
                className="p-2 rounded-full bg-accent-warm/20 text-accent-warm hover:bg-accent-warm/30 transition-colors"
              >
                <Play className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => void window.api.pomodoro.pause()}
                  title={state.isPaused ? 'Resume' : 'Pause'}
                  className={cn(
                    'p-2 rounded-full transition-colors',
                    state.isPaused ? 'bg-accent-warm/20 text-accent-warm' : 'bg-bg-elevated text-text-muted hover:text-text-primary'
                  )}
                >
                  {state.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => void window.api.pomodoro.skip()}
                  title="Skip to next phase"
                  className="p-2 rounded-full bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    logElapsedWorkSession(state);
                    void window.api.pomodoro.stop();
                  }}
                  title="Stop session"
                  className="p-2 rounded-full bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
