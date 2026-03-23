import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, Square } from 'lucide-react';
import type { PomodoroState } from '@/types';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';

interface TimeboxDecisionState {
  taskId: string;
  taskTitle: string;
}

function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function PomodoroTimer() {
  const { logFocusSession, plannedTasks, setActiveTask, setActiveView, toggleTask } = useApp();
  const { setMode } = useTheme();
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

        // Work session just ended → break starting: log the session and stash task info
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

          const taskStillOpen = plannedTasks.find((task) => task.id === prevState.currentTaskId)?.status !== 'done';
          if (taskStillOpen) {
            pendingDecisionRef.current = {
              taskId: prevState.currentTaskId,
              taskTitle: prevState.currentTaskTitle || 'Focus block',
            };
          }
        }

        // Break just ended → show the rescope dialog now
        if (
          prevState.isBreak &&
          !nextState.isBreak &&
          pendingDecisionRef.current
        ) {
          const pending = pendingDecisionRef.current;
          pendingDecisionRef.current = null;
          setActiveTask(pending.taskId);
          setTimeboxDecision(pending);
          void window.api.window.showMain();
        }

        setLastWorkState(
          nextState.isBreak
            ? prevState
            : nextState.isRunning && !nextState.isBreak
              ? nextState
              : null
        );

        return nextState;
      });
    });
    return unsubscribe;
  }, [logFocusSession, plannedTasks, setActiveTask, setActiveView, setMode]);

  useEffect(() => {
    if (state.isRunning) {
      setMode('focus');
    }
  }, [setMode, state.isRunning]);

  // Auto-dismiss the timebox toast after 60s if the user ignores it
  useEffect(() => {
    if (!timeboxDecision) return;
    const timer = window.setTimeout(() => setTimeboxDecision(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [timeboxDecision]);


  const progress = state.totalTime > 0 ? 1 - state.timeRemaining / state.totalTime : 0;
  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference * (1 - progress);
  const ringColor = state.isBreak ? '#38bdf8' : '#dc2626';

  return (
    <>
      {timeboxDecision && (
        <div className="fixed bottom-6 left-1/2 z-[140] w-full max-w-[520px] -translate-x-1/2 px-4">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-bg-card/96 px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-[0.18em] text-accent-warm">Timebox ended</div>
              <div className="mt-0.5 truncate font-display text-[15px] italic text-text-emphasis">
                {timeboxDecision.taskTitle}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => {
                  void toggleTask(timeboxDecision.taskId);
                  setActiveView('flow');
                  setMode('dark');
                  setTimeboxDecision(null);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              >
                I&apos;m done
              </button>
              <button
                onClick={() => {
                  void window.api.pomodoro.start(timeboxDecision.taskId, timeboxDecision.taskTitle);
                  setMode('focus');
                  setTimeboxDecision(null);
                }}
                className="rounded-full bg-accent-warm px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-white transition-colors hover:bg-accent-warm/90"
              >
                Keep going
              </button>
              <button
                onClick={() => {
                  setActiveView('flow');
                  setMode('dark');
                  setTimeboxDecision(null);
                }}
                className="rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              >
                Re-scope
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
              className="pointer-events-none absolute rounded-full animate-breathe h-[176px] w-[176px] bg-[radial-gradient(circle,rgba(56,189,248,0.24),rgba(56,189,248,0.08)_44%,transparent_74%)]"
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
            fill={state.isBreak ? '#07111c' : '#111214'}
            stroke={state.isBreak ? '#16324a' : '#2C3035'}
            strokeWidth="3"
          />
          <circle
            cx="90"
            cy="90"
            r="80"
            fill="none"
            stroke={ringColor}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              'transition-all duration-700',
              state.isBreak && 'drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]'
            )}
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center gap-1 text-center">
          <span className="font-mono font-medium text-text-emphasis tracking-wider text-[28px]">
            {formatSeconds(state.timeRemaining)}
          </span>
          <span className={cn(
            'uppercase tracking-widest max-w-[170px] text-[10px]',
            state.isBreak ? 'text-sky-300' : state.isRunning ? 'text-accent-warm' : 'text-text-muted'
          )}>
            {state.isBreak ? 'Take a breather' : state.isRunning ? (state.currentTaskTitle || 'Focus') : 'Ready'}
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
