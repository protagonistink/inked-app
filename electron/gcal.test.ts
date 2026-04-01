import { describe, expect, it, vi } from 'vitest';
import { buildLocalDayWindow } from './gcalDayWindow';
import { normalizeCalendarSelection } from './gcal';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: vi.fn(),
  shell: { openExternal: vi.fn() },
}));

vi.mock('./store', () => ({
  store: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('./secure-store', () => ({
  getSecure: vi.fn(),
  setSecure: vi.fn(),
}));

vi.mock('./security', () => ({
  assertRateLimit: vi.fn(),
  logSecurityEvent: vi.fn(),
}));

describe('buildLocalDayWindow', () => {
  it('creates a UTC query window that preserves the requested local day', () => {
    const { timeMin, timeMax } = buildLocalDayWindow('2026-03-11');

    const start = new Date(timeMin);
    const end = new Date(timeMax);

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2);
    expect(start.getDate()).toBe(11);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);

    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(2);
    expect(end.getDate()).toBe(11);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });
});

describe('normalizeCalendarSelection', () => {
  it('includes the write calendar in the effective read set', () => {
    expect(normalizeCalendarSelection(['primary'], 'work')).toEqual(['primary', 'work']);
  });

  it('falls back to primary when no calendars are configured', () => {
    expect(normalizeCalendarSelection([], '')).toEqual(['primary']);
  });
});
