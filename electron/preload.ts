import { contextBridge, ipcRenderer } from 'electron';
import type { CalendarEventInput, PomodoroState } from '../src/types';
import type {
  AsanaTaskQuery,
  BriefingContext,
  ChatMessage,
  LoadedSettings,
  PhysicsLogEntry,
  SettingsUpdate,
  UserPhysics,
} from '../src/types/electron';
import type { InkContext, InkJournalEntry } from '../src/types';

contextBridge.exposeInMainWorld('api', {
  // Asana
  asana: {
    getTasks: (options?: AsanaTaskQuery) => ipcRenderer.invoke('asana:get-tasks', options),
    addComment: (taskId: string, text: string) =>
      ipcRenderer.invoke('asana:add-comment', taskId, text),
    completeTask: (taskId: string, completed: boolean) =>
      ipcRenderer.invoke('asana:complete-task', taskId, completed),
    updateTaskDue: (taskId: string, dueOn: string, dueAt?: string) =>
      ipcRenderer.invoke('asana:update-task-due', taskId, dueOn, dueAt),
    createTask: (name: string) => ipcRenderer.invoke('asana:create-task', name),
  },
  // Google Calendar
  gcal: {
    getEvents: (date: string) => ipcRenderer.invoke('gcal:get-events', date),
    listCalendars: () => ipcRenderer.invoke('gcal:list-calendars'),
    createEvent: (event: CalendarEventInput, calendarId?: string) => ipcRenderer.invoke('gcal:create-event', event, calendarId),
    updateEvent: (eventId: string, event: CalendarEventInput, calendarId?: string) =>
      ipcRenderer.invoke('gcal:update-event', eventId, event, calendarId),
    deleteEvent: (eventId: string, calendarId?: string) => ipcRenderer.invoke('gcal:delete-event', eventId, calendarId),
    auth: () => ipcRenderer.invoke('gcal:auth'),
  },
  // Pomodoro
  pomodoro: {
    start: (taskId: string, taskTitle?: string, durationMins?: number) => ipcRenderer.invoke('pomodoro:start', taskId, taskTitle, durationMins),
    load: (taskId: string, taskTitle?: string) => ipcRenderer.invoke('pomodoro:load', taskId, taskTitle),
    pause: () => ipcRenderer.invoke('pomodoro:pause'),
    stop: () => ipcRenderer.invoke('pomodoro:stop'),
    skip: () => ipcRenderer.invoke('pomodoro:skip'),
    extendBreak: (extraMins: number) => ipcRenderer.invoke('pomodoro:extend-break', extraMins),
    onTick: (callback: (state: PomodoroState) => void) => {
      const handler = (_event: unknown, state: PomodoroState) => callback(state);
      ipcRenderer.on('pomodoro:tick', handler);
      return () => ipcRenderer.removeListener('pomodoro:tick', handler);
    },
  },
  // Focus Mode
  focus: {
    enable: () => ipcRenderer.invoke('focus:enable'),
    disable: () => ipcRenderer.invoke('focus:disable'),
  },
  // Store
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load') as Promise<LoadedSettings>,
    save: (payload: SettingsUpdate) => ipcRenderer.invoke('settings:save', payload),
  },
  // User Physics (working pattern persistence)
  physics: {
    get: () => ipcRenderer.invoke('physics:get'),
    update: (patch: Partial<UserPhysics>) => ipcRenderer.invoke('physics:update', patch),
    log: (entry: Omit<PhysicsLogEntry, 'date'>) => ipcRenderer.invoke('physics:log', entry),
  },
  // AI (Morning Briefing)
  ai: {
    chat: (messages: ChatMessage[], context: BriefingContext) =>
      ipcRenderer.invoke('ai:chat', messages, context),
    streamStart: (messages: ChatMessage[], context: BriefingContext) =>
      ipcRenderer.invoke('ai:stream:start', messages, context),
    onToken: (callback: (token: string) => void) => {
      const handler = (_event: unknown, token: string) => callback(token);
      ipcRenderer.on('ai:stream:token', handler);
      return () => ipcRenderer.removeListener('ai:stream:token', handler);
    },
    onDone: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.once('ai:stream:done', handler);
      return () => ipcRenderer.removeListener('ai:stream:done', handler);
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_event: unknown, error: string) => callback(error);
      ipcRenderer.on('ai:stream:error', handler);
      return () => ipcRenderer.removeListener('ai:stream:error', handler);
    },
  },
  window: {
    activate: () => ipcRenderer.invoke('window:activate'),
    setFocusSize: (locked: boolean) => ipcRenderer.invoke('window:set-focus-size', locked),
    showMain: () => ipcRenderer.invoke('window:show-main'),
  },
  // Ink Context (persistent AI memory)
  ink: {
    readContext: (): Promise<InkContext> => ipcRenderer.invoke('ink:read-context'),
    writeContext: (data: Partial<InkContext>): Promise<InkContext> =>
      ipcRenderer.invoke('ink:write-context', data),
    appendJournal: (entry: InkJournalEntry): Promise<InkJournalEntry[]> =>
      ipcRenderer.invoke('ink:append-journal', entry),
  },
  // Chat history persistence
  chat: {
    list: () => ipcRenderer.invoke('chat:list'),
    loadThread: (threadId: string) => ipcRenderer.invoke('chat:load-thread', threadId),
    createThread: (params: { date: string; mode: 'briefing' | 'chat' | 'eod'; seedTitle?: string }) =>
      ipcRenderer.invoke('chat:create-thread', params),
    saveThread: (threadId: string, messages: ChatMessage[]) =>
      ipcRenderer.invoke('chat:save-thread', threadId, messages),
    deleteThread: (threadId: string) => ipcRenderer.invoke('chat:delete-thread', threadId),
    clearOld: (today: string) => ipcRenderer.invoke('chat:clearOld', today),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  // Native menu bar events
  menu: {
    onNewTask: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:new-task', handler);
      return () => ipcRenderer.removeListener('menu:new-task', handler);
    },
    onNewEvent: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:new-event', handler);
      return () => ipcRenderer.removeListener('menu:new-event', handler);
    },
    onSetView: (cb: (view: string) => void) => {
      const handler = (_e: any, view: string) => cb(view);
      ipcRenderer.on('menu:set-view', handler);
      return () => ipcRenderer.removeListener('menu:set-view', handler);
    },
    onToggleSidebar: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:toggle-sidebar', handler);
      return () => ipcRenderer.removeListener('menu:toggle-sidebar', handler);
    },
    onGoToday: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:go-today', handler);
      return () => ipcRenderer.removeListener('menu:go-today', handler);
    },
    onStartDay: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:start-day', handler);
      return () => ipcRenderer.removeListener('menu:start-day', handler);
    },
    onOpenInk: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:open-ink', handler);
      return () => ipcRenderer.removeListener('menu:open-ink', handler);
    },
    onOpenSettings: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:open-settings', handler);
      return () => ipcRenderer.removeListener('menu:open-settings', handler);
    },
    onOpenPlot: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('menu:open-plot', handler);
      return () => ipcRenderer.removeListener('menu:open-plot', handler);
    },
  },
  // Stripe
  stripe: {
    getDashboard: () => ipcRenderer.invoke('stripe:get-dashboard'),
    testConnection: () => ipcRenderer.invoke('stripe:test-connection'),
  },
  // Quick Captures
  capture: {
    list: () => ipcRenderer.invoke('capture:list'),
    add: (text: string) => ipcRenderer.invoke('capture:add', text),
    remove: (id: string) => ipcRenderer.invoke('capture:remove', id),
    purgeStale: () => ipcRenderer.invoke('capture:purge-stale'),
    onOpenOverlay: (cb: () => void) => {
      const handler = () => cb();
      ipcRenderer.on('capture:open-overlay', handler);
      return () => ipcRenderer.removeListener('capture:open-overlay', handler);
    },
    sendToNotion: (text: string) => ipcRenderer.invoke('capture:send-to-notion', text),
    hideCaptureWindow: () => ipcRenderer.invoke('capture:hide-capture-window'),
  },
  // Focus Timer Window
  focusTimer: {
    hide: () => ipcRenderer.invoke('focus-timer:hide'),
  },
  // Finance (Compass engine)
  finance: {
    getState: () => ipcRenderer.invoke('finance:get-state'),
    getAccounts: () => ipcRenderer.invoke('finance:get-accounts'),
    refresh: () => ipcRenderer.invoke('finance:refresh'),
    plaidLink: () => ipcRenderer.invoke('finance:plaid-link'),
    plaidExchange: (publicToken: string) => ipcRenderer.invoke('finance:plaid-exchange', publicToken),
  },
});
