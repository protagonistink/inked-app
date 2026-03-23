import type { InkMode } from '../types';

/**
 * Determine which Ink mode to activate based on the current date/time
 * and whether the weekly interview has already been completed this week.
 *
 * @param date - Current date (defaults to now)
 * @param weekUpdatedAt - ISO date string from inkContext.weekUpdatedAt
 */
export function detectInkMode(
  date = new Date(),
  weekUpdatedAt?: string,
): InkMode {
  const day = date.getDay(); // 0 = Sunday

  // Sunday or Monday — trigger weekly interview if not yet done this week
  if (day === 0 || day === 1) {
    const needsInterview = !weekUpdatedAt || !isCurrentWeek(weekUpdatedAt, date);
    if (needsInterview) return 'sunday-interview';
  }

  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'midday';
  return 'evening';
}

/** Check if the given ISO date string falls within the same week as `now`. */
function isCurrentWeek(isoDate: string, now: Date): boolean {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return false;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Roll back to Sunday
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart;
}

/** Max tokens per mode — used by anthropic.ts when building API calls. */
export const INK_TOKEN_LIMITS: Record<InkMode, number> = {
  morning: 1500,
  midday: 600,
  evening: 1000,
  'sunday-interview': 2000,
};
