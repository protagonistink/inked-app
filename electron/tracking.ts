import { format } from 'date-fns';

export function formatPomodoroComment(count: number, totalMins: number): string {
  const tomatoes = '\u{1F345}'.repeat(Math.min(count, 8));
  const date = format(new Date(), 'MMM d, yyyy');
  return `${tomatoes} ${count} pomodoro${count !== 1 ? 's' : ''} \u00B7 ${totalMins} min \u2014 ${date}`;
}
