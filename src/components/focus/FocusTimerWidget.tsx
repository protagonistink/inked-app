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
  const accentColor = isBreak ? 'rgb(45,212,191)' : 'rgb(200,60,47)';
  const label = isBreak
    ? 'Break'
    : state.currentTaskTitle || 'Focus';

  return (
    <div
      className="flex flex-col w-full h-full select-none overflow-hidden"
      style={{
        background: '#0A0A0A',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2 flex-1 drag-region">
        {/* Timer */}
        <span
          className="font-mono font-medium text-[20px] tracking-wider shrink-0 no-drag"
          style={{ color: accentColor }}
        >
          {formatTimer(state.timeRemaining)}
        </span>

        {/* Task title */}
        <button
          onClick={() => void window.api.window.showMain()}
          className="flex-1 min-w-0 truncate text-left text-[12px] text-white/70 hover:text-white/90 transition-colors no-drag cursor-pointer"
          title="Show Inked"
        >
          {label}
        </button>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0 no-drag">
          <button
            onClick={() => void window.api.pomodoro.pause()}
            className="p-1.5 rounded-md text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
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
            className="p-1.5 rounded-md text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Stop"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
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
