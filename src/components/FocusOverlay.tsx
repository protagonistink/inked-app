import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { PomodoroTimer } from './PomodoroTimer';
import { cn } from '@/lib/utils';

export function FocusOverlay() {
  const { mode } = useTheme();
  const { currentTask, nextBlock } = useApp();
  const isFocus = mode === 'focus';

  if (!isFocus) return null;

  return (
    <div className={cn('fixed bottom-8 right-8 z-[60] transition-all duration-700 ease-in-out')}>
      <div className="relative bg-bg-card border border-border shadow-2xl rounded-[24px] p-6 w-[260px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <PomodoroTimer />
          <div className="flex flex-col gap-1 items-center">
            <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-accent-warm">
              Here Now
            </span>
            <h3 className="text-text-emphasis leading-tight px-4 text-center text-[14px] font-medium truncate max-w-[220px]">
              {currentTask?.title || 'No active thread'}
            </h3>
          </div>
        </div>
        <div className="w-full rounded-2xl border border-border-subtle bg-bg px-4 py-3 mt-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Next</div>
          <div className="text-[13px] text-text-primary mt-1 truncate">
            {nextBlock?.title || 'No next block yet'}
          </div>
        </div>
      </div>
    </div>
  );
}
