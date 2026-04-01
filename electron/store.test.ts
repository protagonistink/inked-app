import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0-test',
    isPackaged: false,
    getAppPath: () => process.cwd(),
  },
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      get() {
        return undefined;
      }
      set() {}
    },
  };
});

vi.mock('./secure-store', () => ({
  getSecure: vi.fn(),
  setSecure: vi.fn(),
}));

describe('normalizeGcalSettings', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('adds the write calendar to the persisted read set when missing', async () => {
    const { normalizeGcalSettings } = await import('./store');

    expect(normalizeGcalSettings(['primary'], 'work')).toEqual({
      calendarIds: ['primary', 'work'],
      writeCalendarId: 'work',
    });
  });

  it('falls back to the legacy calendar id when write calendar is empty', async () => {
    const { normalizeGcalSettings } = await import('./store');

    expect(normalizeGcalSettings([], '', 'primary')).toEqual({
      calendarIds: ['primary'],
      writeCalendarId: 'primary',
    });
  });
});
