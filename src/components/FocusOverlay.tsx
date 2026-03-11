import { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { PomodoroTimer } from './PomodoroTimer';
import { cn } from '@/lib/utils';
import { Maximize2, Minimize2 } from 'lucide-react';

export function FocusOverlay() {
  const { mode } = useTheme();
  const { currentTask, nextBlock } = useApp();
  const isFocus = mode === 'focus';
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isFocus) return null;

  return (
    <div
      className={cn(
        'fixed bottom-8 right-8 z-[60] transition-all duration-700 ease-in-out',
        isExpanded ? 'inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-md bottom-0 right-0' : 'scale-100'
      )}
    >
      <div
        className={cn(
          'relative bg-bg-card border border-border shadow-2xl rounded-3xl p-6 transition-all duration-700',
          isExpanded ? 'w-full max-w-2xl flex flex-col items-center gap-8' : 'w-[260px]'
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute top-4 right-4 p-2 text-text-muted hover:text-text-primary transition-colors"
        >
          {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <div className={cn('flex flex-col items-center gap-4 text-center', isExpanded ? 'scale-125' : 'scale-100')}>
          <PomodoroTimer />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-accent-warm font-semibold">
              Here Now
            </span>
            <h3 className={cn('text-text-emphasis font-medium leading-tight px-4', isExpanded ? 'text-2xl' : 'text-[14px] truncate max-w-[220px]')}>
              {currentTask?.title || 'No active thread'}
            </h3>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-border-subtle bg-bg px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Next</div>
          <div className="text-[13px] text-text-primary mt-1">
            {nextBlock?.title || 'No next block yet'}
          </div>
        </div>
      </div>
    </div>
  );
}
