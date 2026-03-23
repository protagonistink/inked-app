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
    start: (taskId: string, taskTitle?: string) => ipcRenderer.invoke('pomodoro:start', taskId, taskTitle),
    pause: () => ipcRenderer.invoke('pomodoro:pause'),
    stop: () => ipcRenderer.invoke('pomodoro:stop'),
    skip: () => ipcRenderer.invoke('pomodoro:skip'),
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
    showPomodoro: () => ipcRenderer.invoke('window:show-pomodoro'),
    hidePomodoro: () => ipcRenderer.invoke('window:hide-pomodoro'),
    hideCapture: () => ipcRenderer.invoke('window:hide-capture'),
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
    load: (date: string) => ipcRenderer.invoke('chat:load', date),
    save: (date: string, messages: Array<{ role: string; content: string }>) =>
      ipcRenderer.invoke('chat:save', date, messages),
    clear: (date: string) => ipcRenderer.invoke('chat:clear', date),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  // Finance (Compass engine)
  finance: {
    getState: () => ipcRenderer.invoke('finance:get-state'),
    refresh: () => ipcRenderer.invoke('finance:refresh'),
    plaidLink: () => ipcRenderer.invoke('finance:plaid-link'),
    plaidExchange: (publicToken: string) => ipcRenderer.invoke('finance:plaid-exchange', publicToken),
  },
  // Quick Capture
  capture: {
    save: (text: string) => ipcRenderer.invoke('capture:save', text),
    update: (id: string, text: string) => ipcRenderer.invoke('capture:update', id, text),
    getToday: () => ipcRenderer.invoke('capture:get-today'),
    deleteEntry: (id: string) => ipcRenderer.invoke('capture:delete', id),
    onNewEntry: (callback: (entry: { id: string; text: string; createdAt: string }) => void) => {
      const handler = (_event: unknown, entry: { id: string; text: string; createdAt: string }) => callback(entry);
      ipcRenderer.on('capture:new-entry', handler);
      return () => ipcRenderer.removeListener('capture:new-entry', handler);
    },
    onEntryUpdated: (callback: (entry: { id: string; text: string; createdAt: string }) => void) => {
      const handler = (_event: unknown, entry: { id: string; text: string; createdAt: string }) => callback(entry);
      ipcRenderer.on('capture:entry-updated', handler);
      return () => ipcRenderer.removeListener('capture:entry-updated', handler);
    },
    onEntryDeleted: (callback: (id: string) => void) => {
      const handler = (_event: unknown, id: string) => callback(id);
      ipcRenderer.on('capture:entry-deleted', handler);
      return () => ipcRenderer.removeListener('capture:entry-deleted', handler);
    },
  },
});
