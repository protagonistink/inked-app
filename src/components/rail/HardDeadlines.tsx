import { differenceInCalendarDays, parseISO } from 'date-fns';

interface Deadline {
  title: string;
  dueDate: string; // YYYY-MM-DD
}

interface HardDeadlinesProps {
  deadlines: Deadline[];
  referenceDate?: Date;
}

function relativeDate(dueDate: string, referenceDate: Date): string {
  const days = differenceInCalendarDays(parseISO(dueDate), referenceDate);
  if (days < 0) return 'past due';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

function dateColor(dueDate: string, referenceDate: Date): string {
  const days = differenceInCalendarDays(parseISO(dueDate), referenceDate);
  if (days <= 0) return 'rgba(200,60,47,0.8)';
  if (days === 1) return 'rgba(232,130,90,0.8)';
  return 'var(--color-text-muted)';
}

function isPastDue(dueDate: string, referenceDate: Date): boolean {
  return differenceInCalendarDays(parseISO(dueDate), referenceDate) < 0;
}

function isDueToday(dueDate: string, referenceDate: Date): boolean {
  return differenceInCalendarDays(parseISO(dueDate), referenceDate) === 0;
}

export function HardDeadlines({ deadlines, referenceDate = new Date() }: HardDeadlinesProps) {
  if (deadlines.length === 0) return null;

  return (
    <div className="select-none">
      {deadlines.map((deadline, i) => {
        const pastDue = isPastDue(deadline.dueDate, referenceDate);
        const dueToday = isDueToday(deadline.dueDate, referenceDate);

        return (
          <div
            key={i}
            className={`flex items-center justify-between gap-2 py-2 border-b border-dashed border-border-subtle last:border-b-0 rounded-sm ${
              pastDue ? 'bg-accent-warm/[0.06] px-2 -mx-2' : ''
            }`}
          >
            <span className="font-sans text-[12px] text-text-muted/60 leading-tight line-clamp-1 flex-1">
              {deadline.title}
            </span>
            <span
              className={`font-sans text-[10px] flex-shrink-0 ${
                pastDue ? 'font-semibold' : dueToday ? 'font-medium' : ''
              }`}
              style={{ color: dateColor(deadline.dueDate, referenceDate) }}
            >
              {relativeDate(deadline.dueDate, referenceDate)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
