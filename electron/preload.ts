import { contextBridge, ipcRenderer } from 'electron';
import type { CalendarEventInput, PomodoroState } from '../src/types';

contextBridge.exposeInMainWorld('api', {
  // Asana
  asana: {
    getTasks: (options?: unknown) => ipcRenderer.invoke('asana:get-tasks', options),
    addComment: (taskId: string, text: string) =>
      ipcRenderer.invoke('asana:add-comment', taskId, text),
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
  // AI (Morning Briefing)
  ai: {
    chat: (messages: unknown[], context: unknown) =>
      ipcRenderer.invoke('ai:chat', messages, context),
    streamStart: (messages: unknown[], context: unknown) =>
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
  },
  window: {
    showPomodoro: () => ipcRenderer.invoke('window:show-pomodoro'),
    hidePomodoro: () => ipcRenderer.invoke('window:hide-pomodoro'),
    activate: () => ipcRenderer.invoke('window:activate'),
  },
});
