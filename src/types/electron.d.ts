import type {
  ApiResult,
  AsanaTask,
  CalendarEventInput,
  CalendarListEntry,
  GCalEvent,
  InkContext,
  InkJournalEntry,
  InkMode,
  PomodoroState,
} from './index';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AsanaTaskQuery {
  daysAhead?: number;
  limit?: number;
}

export interface GCalEventContext {
  title: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
}

export interface BriefingContext {
  date: string;
  weeklyGoals: Array<{ title: string; why?: string }>;
  asanaTasks: Array<{
    title: string;
    dueOn: string | null;
    priority?: string;
    project?: string;
    notes?: string;
    tags?: string[];
    daysSinceAdded?: number;
  }>;
  gcalEvents: GCalEventContext[];
  availableFocusMinutes: number;
  scheduledMinutes: number;
  committedTasks: Array<{ title: string; estimateMins: number; weeklyGoal: string }>;
  countdowns: Array<{ title: string; daysUntil: number }>;
  workdayEndHour: number;
  workdayEndMin: number;
  monthlyOneThing?: string;
  monthlyWhy?: string;
  inkMode?: InkMode;
}

export interface UserPhysics {
  focusBlockLength: number;
  peakEnergyWindow: string;
  commonDerailers: string[];
  planningStyle: string;
  recoveryPattern: string;
  warningSignals: string[];
}

export interface PhysicsLogEntry {
  date: string;
  source: 'morning' | 'session' | 'eod' | 'weekly';
  observation: string;
  data?: Record<string, unknown>;
}

interface PhysicsAPI {
  get: () => Promise<{ physics: UserPhysics; log: PhysicsLogEntry[] }>;
  update: (patch: Partial<UserPhysics>) => Promise<UserPhysics>;
  log: (entry: { source: 'morning' | 'session' | 'eod' | 'weekly'; observation: string; data?: Record<string, unknown> }) => Promise<PhysicsLogEntry>;
}

interface AIAPI {
  chat: (messages: ChatMessage[], context: BriefingContext) => Promise<{ success: boolean; content?: string; error?: string }>;
  streamStart: (messages: ChatMessage[], context: BriefingContext) => Promise<{ success: boolean; error?: string }>;
  onToken: (callback: (token: string) => void) => () => void;
  onDone: (callback: () => void) => () => void;
}

declare module '*.png' {
  const src: string;
  export default src;
}

interface AsanaAPI {
  getTasks: (options?: AsanaTaskQuery) => Promise<ApiResult<AsanaTask[]>>;
  addComment: (taskId: string, text: string) => Promise<ApiResult<null>>;
}

interface GCalAPI {
  getEvents: (date: string) => Promise<ApiResult<GCalEvent[]>>;
  listCalendars: () => Promise<ApiResult<CalendarListEntry[]>>;
  createEvent: (event: CalendarEventInput, calendarId?: string) => Promise<ApiResult<GCalEvent>>;
  updateEvent: (eventId: string, event: CalendarEventInput, calendarId?: string) => Promise<ApiResult<GCalEvent>>;
  deleteEvent: (eventId: string, calendarId?: string) => Promise<ApiResult<null>>;
  auth: () => Promise<ApiResult<null>>;
}

interface PomodoroAPI {
  start: (taskId: string, taskTitle?: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  skip: () => Promise<void>;
  onTick: (callback: (state: PomodoroState) => void) => () => void;
}

interface FocusAPI {
  enable: () => Promise<ApiResult<null>>;
  disable: () => Promise<ApiResult<null>>;
}

interface StoreAPI {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
}

export interface LoadedSettings {
  anthropic: {
    configured: boolean;
  };
  asana: {
    configured: boolean;
  };
  gcal: {
    clientId: string;
    clientSecretConfigured: boolean;
    calendarId: string;
    calendarIds: string[];
    writeCalendarId: string;
  };
  pomodoro: {
    workMins: number;
    breakMins: number;
    longBreakMins: number;
  };
  focus: {
    blockedSites: string[];
  };
}

export interface SettingsUpdate {
  anthropicApiKey?: string;
  asanaToken?: string;
  gcalClientId?: string;
  gcalClientSecret?: string;
  gcalCalendarIds?: string[];
  gcalWriteCalendarId?: string;
  workMins?: number;
  breakMins?: number;
  longBreakMins?: number;
  blockedSites?: string[];
}

interface SettingsAPI {
  load: () => Promise<LoadedSettings>;
  save: (payload: SettingsUpdate) => Promise<void>;
}

interface WindowAPI {
  showPomodoro: () => Promise<void>;
  hidePomodoro: () => Promise<void>;
  activate: () => Promise<void>;
  setFocusSize: (locked: boolean) => Promise<void>;
  showMain: () => Promise<void>;
}

interface ShellAPI {
  openExternal: (url: string) => Promise<void>;
}

interface InkAPI {
  readContext: () => Promise<InkContext>;
  writeContext: (data: Partial<InkContext>) => Promise<InkContext>;
  appendJournal: (entry: InkJournalEntry) => Promise<InkJournalEntry[]>;
}

declare global {
  interface Window {
    api: {
      asana: AsanaAPI;
      gcal: GCalAPI;
      pomodoro: PomodoroAPI;
      focus: FocusAPI;
      store: StoreAPI;
      settings: SettingsAPI;
      window: WindowAPI;
      ai: AIAPI;
      physics: PhysicsAPI;
      shell: ShellAPI;
      ink: InkAPI;
    };
  }
}

export {};
