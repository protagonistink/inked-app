interface FocusCapacityProps {
  hoursRemaining: number;
  scheduledHours: number;
  totalHours: number;
  occupancyRatio: number;
  label: string;
  pastWorkday?: boolean;
}

function formatHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded.toFixed(0)}h` : `${rounded.toFixed(1)}h`;
}

export function FocusCapacity({
  hoursRemaining,
  scheduledHours,
  occupancyRatio,
  pastWorkday,
}: FocusCapacityProps) {
  return (
    <div className={`select-none transition-opacity duration-300 ${pastWorkday ? 'opacity-40' : ''}`}>
      <div className="flex items-end gap-4">
        <div className="min-w-0">
          <div className="ui-section-label">Open</div>
          <span className="ui-metric mt-2 block">
            {formatHours(hoursRemaining)}
          </span>
        </div>
        <div className="min-w-0">
          <div className="ui-section-label">Booked</div>
          <span className="ui-metric mt-2 block text-text-secondary/60">
            {formatHours(scheduledHours)}
          </span>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-accent-warm/70 transition-all duration-500"
          style={{ width: `${occupancyRatio * 100}%` }}
        />
      </div>
    </div>
  );
}
