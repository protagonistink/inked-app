import { vi } from 'vitest';

/** Install a full window.api mock. Call in beforeEach. */
export function installMockApi() {
  (window as unknown as { api: typeof window.api }).api = {
    asana: {
      getTasks: vi.fn(),
      addComment: vi.fn(),
      completeTask: vi.fn(),
    },
    gcal: {
      getEvents: vi.fn(),
      listCalendars: vi.fn(),
      createEvent: vi.fn(),
      updateEvent: vi.fn(),
      deleteEvent: vi.fn().mockResolvedValue({ success: true }),
      auth: vi.fn(),
    },
    pomodoro: {
      start: vi.fn(),
      load: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      skip: vi.fn(),
      onTick: vi.fn(),
    },
    focus: {
      enable: vi.fn(),
      disable: vi.fn(),
    },
    store: {
      get: vi.fn(),
      set: vi.fn(),
    },
    settings: {
      load: vi.fn().mockResolvedValue({
        anthropic: { configured: false },
        asana: { configured: false },
        gcal: { configured: false, clientId: '', calendarIds: [], writeCalendarId: '' },
        plaid: { configured: false },
        stripe: { configured: false },
        day: { startHour: 9, startMin: 0, endHour: 18, endMin: 0, timeboxDefault: 60, syncFrequencyMins: 2 },
        pomodoro: { workMins: 25, breakMins: 5, longBreakMins: 15, blockedSites: '' },
        tasks: { priorityRule: 'balanced', notificationIntensity: 'standard', distractionFiltering: 'show_all' },
        money: { dueDateWindowDays: 7, alertSeverity: 'warning', financialSensitivity: 'soft', timeHorizonDays: 7 },
        story: { narrativeStyle: 'practical', storyDepth: 'summary', tone: 'direct', accountabilityLevel: 'firm' },
        privacy: { sensitiveDataMasking: false, auditLog: false },
      }),
      save: vi.fn(),
    },
    window: {
      activate: vi.fn(),
      setFocusSize: vi.fn(),
      showMain: vi.fn(),
    },
    ai: {
      chat: vi.fn(),
      streamStart: vi.fn(),
      onToken: vi.fn().mockReturnValue(() => {}),
      onDone: vi.fn().mockReturnValue(() => {}),
      onError: vi.fn().mockReturnValue(() => {}),
    },
    physics: {
      get: vi.fn(),
      update: vi.fn(),
      log: vi.fn(),
    },
    shell: {
      openExternal: vi.fn(),
    },
    ink: {
      readContext: vi.fn().mockResolvedValue({ journalEntries: [] }),
      writeContext: vi.fn(),
      appendJournal: vi.fn(),
    },
    chat: {
      load: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(true),
      clear: vi.fn().mockResolvedValue(true),
    },
    stripe: {
      getDashboard: vi.fn().mockResolvedValue({ success: false }),
      testConnection: vi.fn().mockResolvedValue({ success: false }),
    },
    finance: {
      getState: vi.fn().mockResolvedValue(null),
      getAccounts: vi.fn().mockResolvedValue([]),
      refresh: vi.fn().mockResolvedValue(null),
      plaidLink: vi.fn().mockResolvedValue({ success: false }),
      plaidExchange: vi.fn().mockResolvedValue({ success: false }),
    },
    menu: {
      onNewTask: vi.fn().mockReturnValue(() => {}),
      onNewEvent: vi.fn().mockReturnValue(() => {}),
      onSetView: vi.fn().mockReturnValue(() => {}),
      onToggleSidebar: vi.fn().mockReturnValue(() => {}),
      onGoToday: vi.fn().mockReturnValue(() => {}),
      onStartDay: vi.fn().mockReturnValue(() => {}),
      onOpenInk: vi.fn().mockReturnValue(() => {}),
      onOpenSettings: vi.fn().mockReturnValue(() => {}),
    },
  };
}
