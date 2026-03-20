// src/components/CurrentTimeIndicator.tsx
import { useEffect, useState } from 'react';
import { timeToTop, formatTime } from './timelineUtils';

export function CurrentTimeIndicator({
  dayStartMins,
  dayEndMins,
  hourHeight,
}: {
  dayStartMins: number;
  dayEndMins: number;
  hourHeight: number;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentMinutes = currentHour * 60 + currentMin;
  if (currentMinutes < dayStartMins || currentMinutes >= dayEndMins) return null;

  const top = timeToTop(currentMinutes, dayStartMins, hourHeight);

  return (
    <div className="absolute left-0 right-0 flex items-center z-10 pointer-events-none" style={{ top: `${top}px` }} id="now-indicator">
      <div className="time-lbl" style={{ color: 'rgba(229, 85, 71, 0.5)' }}>
        {formatTime(currentHour, currentMin)}
      </div>
      <div className="flex items-center flex-1 gap-0">
        <div className="now-pip" />
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(229, 85, 71, 0.3), transparent 80%)' }} />
        <span className="font-sans text-[10px] text-[#E55547]/40 pl-2">now</span>
      </div>
    </div>
  );
}
