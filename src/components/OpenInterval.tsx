// src/components/OpenInterval.tsx
import { timeToTop } from './timelineUtils';

export function OpenInterval({
  startMins,
  durationMins,
  dayStartMins,
  hourHeight,
}: {
  startMins: number;
  durationMins: number;
  dayStartMins: number;
  hourHeight: number;
}) {
  const top = timeToTop(startMins, dayStartMins, hourHeight);
  const height = (durationMins / 60) * hourHeight;
  if (height < 12) return null;

  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;
  const label = hours > 0
    ? `${hours}h${mins > 0 ? ` ${mins}m` : ''} open`
    : `${mins}m open`;

  return (
    <div
      className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
      style={{
        top,
        height,
        border: '1px dashed rgba(156,158,162,0.15)',
        borderRadius: 8,
      }}
    >
      <span
        className="font-sans text-[10px]"
        style={{ color: 'rgba(156,158,162,0.3)' }}
      >
        {label}
      </span>
    </div>
  );
}
