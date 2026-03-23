// src/components/BeforeHoursVeil.tsx
import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { timeToTop, formatTime } from './timelineUtils';

export function BeforeHoursVeil({
  workdayStart,
  onDragBoundaryStart,
  isLight,
  dayStartMins,
  hourHeight,
}: {
  workdayStart: { hour: number; min: number };
  onDragBoundaryStart: (event: MouseEvent<HTMLElement>) => void;
  isLight: boolean;
  dayStartMins: number;
  hourHeight: number;
}) {
  const startMinutes = workdayStart.hour * 60 + workdayStart.min;
  const height = timeToTop(startMinutes, dayStartMins, hourHeight);

  // Don't render if workday starts at the beginning of visible range
  if (height <= 0) return null;

  return (
    <div
      className="absolute left-14 right-0 top-0 pointer-events-none z-[5]"
      style={{ height: `${height}px` }}
    >
      <div
        className={cn(
          'absolute inset-0',
          isLight
            ? 'bg-[rgba(176,112,88,0.03)]'
            : 'bg-[rgba(10,10,10,0.55)]'
        )}
      />
      <div className="absolute inset-x-0 bottom-0 h-0.5">
        <svg className="absolute bottom-[-5px] left-0 right-0 w-full h-[10px] pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 10">
          <path
            d="M0 5 Q 25 5.5, 50 4 T 100 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.6"
            strokeLinecap="round"
            className={cn(isLight ? 'text-stone-300' : 'text-border')}
          />
        </svg>
      </div>
      <button
        onMouseDown={onDragBoundaryStart}
        className={cn(
          'pointer-events-auto absolute left-4 -bottom-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-all hover:text-text-primary',
          isLight
            ? 'border-stone-300/70 bg-white/92 text-stone-500 hover:border-stone-400/80'
            : 'border-border bg-bg-elevated/90 text-text-muted hover:border-border'
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-accent-warm/70" />
        Day starts {formatTime(workdayStart.hour, workdayStart.min)}
      </button>
      <div
        onMouseDown={onDragBoundaryStart}
        className="pointer-events-auto absolute inset-x-0 bottom-[-8px] h-4 cursor-row-resize"
        title="Drag to move day start"
      />
    </div>
  );
}
