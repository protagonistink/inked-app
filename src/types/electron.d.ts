import type {
  ApiResult,
  AsanaTask,
  CalendarEventInput,
  CalendarListEntry,
  GCalEvent,
  PomodoroState,
} from './index';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
    daysSinceAdded?: number;
  }>;
  gcalEvents: GCalEventContext[];
  availableFocusMinutes: number;
  scheduledMinutes: number;
  committedTasks: Array<{ title: string; estimateMins: number; weeklyGoal: string }>;
  countdowns: Array<{ title: string; daysUntil: number }>;
  workdayEndHour: number;
  workdayEndMin: number;
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
  getTasks: (options?: { daysAhead?: number; limit?: number }) => Promise<ApiResult<AsanaTask[]>>;
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
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

interface StoreAPI {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
}

interface WindowAPI {
  showPomodoro: () => Promise<void>;
  hidePomodoro: () => Promise<void>;
  activate: () => Promise<void>;
}

declare global {
  interface Window {
    api: {
      asana: AsanaAPI;
      gcal: GCalAPI;
      pomodoro: PomodoroAPI;
      focus: FocusAPI;
      store: StoreAPI;
      window: WindowAPI;
      ai: AIAPI;
    };
  }
}

export {};
