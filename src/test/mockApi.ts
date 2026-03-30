import { vi } from 'vitest';

/** Install a full window.api mock. Call in beforeEach. Returns the mock for per-test overrides. */
export function installMockApi(): typeof window.api {
  const mock: typeof window.api = {
    asana: {
      getTasks: vi.fn(),
      addComment: vi.fn(),
      completeTask: vi.fn(),
      updateTaskDue: vi.fn().mockResolvedValue({ success: true, data: {} }),
      createTask: vi.fn().mockResolvedValue({ success: true, data: {} }),
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
        ui: { themeMode: 'dark' },
        day: { startHour: 9, startMin: 0, endHour: 18, endMin: 0, timeboxDefault: 60, syncFrequencyMins: 2 },
        pomodoro: { workMins: 25, breakMins: 5, longBreakMins: 15, blockedSites: '' },
        tasks: { priorityRule: 'balanced', notificationIntensity: 'standard', distractionFiltering: 'show_all' },
        money: { dueDateWindowDays: 7, alertSeverity: 'warning', financialSensitivity: 'soft', timeHorizonDays: 7 },
        story: { narrativeStyle: 'practical', storyDepth: 'summary', tone: 'direct', accountabilityLevel: 'firm' },
        privacy: { sensitiveDataMasking: false, auditLog: false },
        notion: { configured: false, capturePageId: '' },
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
      list: vi.fn().mockResolvedValue([]),
      loadThread: vi.fn().mockResolvedValue(null),
      createThread: vi.fn().mockImplementation(async ({ date, mode, seedTitle }) => ({
        id: 'thread-1',
        date,
        mode,
        title: seedTitle || 'New conversation',
        messages: [],
        createdAt: `${date}T09:00:00.000Z`,
        updatedAt: `${date}T09:00:00.000Z`,
      })),
      saveThread: vi.fn().mockResolvedValue({
        id: 'thread-1',
        date: '2026-03-24',
        mode: 'chat',
        title: 'New conversation',
        preview: '',
        messageCount: 0,
        createdAt: '2026-03-24T09:00:00.000Z',
        updatedAt: '2026-03-24T09:00:00.000Z',
      }),
      deleteThread: vi.fn().mockResolvedValue(true),
      clearOld: vi.fn().mockResolvedValue(true),
    },
    focusTimer: {
      hide: vi.fn().mockResolvedValue(undefined),
    },
    capture: {
      list: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockImplementation(async (text: string) => ({
        id: 'cap-1',
        text,
        color: 'yellow',
        createdAt: new Date().toISOString(),
      })),
      remove: vi.fn().mockResolvedValue(true),
      purgeStale: vi.fn().mockResolvedValue(true),
      onOpenOverlay: vi.fn().mockReturnValue(() => {}),
      sendToNotion: vi.fn().mockResolvedValue({ success: true }),
      hideCaptureWindow: vi.fn().mockResolvedValue(undefined),
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
      onOpenPlot: vi.fn().mockReturnValue(() => {}),
    },
  };
  (window as unknown as { api: typeof window.api }).api = mock;
  return mock;
}
