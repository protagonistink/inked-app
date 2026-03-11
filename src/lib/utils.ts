import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function roundToQuarterHour(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.max(15, Math.round(minutes / 15) * 15);
}

export function formatRoundedHours(minutes: number, compact = false): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return compact ? '0h' : '0 hr';
  }

  const hours = roundToQuarterHour(minutes) / 60;
  const value = hours.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return compact ? `${value}h` : `${value} hr`;
}
