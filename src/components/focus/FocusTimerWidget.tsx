import { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import type { PomodoroState } from '@/types';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusTimerWidget() {
  const [state, setState] = useState<PomodoroState | null>(null);

  useEffect(() => {
    const cleanup = window.api.pomodoro.onTick((next) => {
      setState(next as PomodoroState);
    });
    return cleanup;
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        void window.api.focusTimer.hide();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!state) return null;

  const progress =
    state.totalTime > 0 ? 1 - state.timeRemaining / state.totalTime : 0;
  const isBreak = state.isBreak;
  const accentColor = isBreak ? 'rgb(45,212,191)' : 'var(--color-accent-warm)';
  const label = isBreak
    ? 'Break'
    : state.currentTaskTitle || 'Focus';

  return (
    <div
      className="flex flex-col w-full h-full select-none overflow-hidden bg-bg border border-border-subtle"
      style={{ borderRadius: 12 }}
    >
      {/* Drag region */}
      <div className="h-2 drag-region" />

      <div className="flex flex-col px-4 pb-2.5 flex-1 gap-1">
        {/* Timer — the reason this window exists */}
        <div className="flex items-center justify-between drag-region">
          <span
            className="font-mono font-medium text-[24px] tracking-wider leading-none no-drag"
            style={{ color: accentColor }}
          >
            {formatTimer(state.timeRemaining)}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-0.5 shrink-0 no-drag">
            <button
              onClick={() => void window.api.pomodoro.pause()}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              title={state.isPaused ? 'Resume' : 'Pause'}
            >
              {state.isPaused ? (
                <Play className="w-3.5 h-3.5" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={() => void window.api.pomodoro.stop()}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              title="Stop"
            >
              <Square className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Task label — secondary line */}
        <button
          onClick={() => void window.api.window.showMain()}
          className="text-left text-[11px] text-text-secondary truncate hover:text-text-primary transition-colors no-drag cursor-pointer leading-snug"
          title="Show Inked"
        >
          {label}
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-b-[12px] overflow-hidden" style={{ background: 'var(--color-border-subtle)' }}>
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progress * 100}%`,
            background: accentColor,
          }}
        />
      </div>
    </div>
  );
}
