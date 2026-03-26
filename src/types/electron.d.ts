import type {
  ApiResult,
  AsanaTask,
  BriefingContext,
  CalendarEventInput,
  CalendarListEntry,
  ChatMessage,
  ChatThread,
  ChatThreadSummary,
  GCalEvent,
  InkContext,
  InkJournalEntry,
  InkMode,
  PomodoroState,
  UserPhysics,
} from './index';

export type { BriefingContext, ChatMessage, GCalEventContext, UserPhysics } from './index';

export interface AsanaTaskQuery {
  daysAhead?: number;
  limit?: number;
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
  onError: (callback: (error: string) => void) => () => void;
}

declare module '*.png' {
  const src: string;
  export default src;
}

interface AsanaAPI {
  getTasks: (options?: AsanaTaskQuery) => Promise<ApiResult<AsanaTask[]>>;
  addComment: (taskId: string, text: string) => Promise<ApiResult<null>>;
  completeTask: (taskId: string, completed: boolean) => Promise<ApiResult<null>>;
  createTask: (name: string) => Promise<ApiResult<AsanaTask>>;
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

export type SafeStoreKey =
  | 'plannerState'
  | 'dayLocked'
  | 'dayLockedDate'
  | 'monthlyPlanDismissedDate'
  | 'appMode'
  | 'appModeDate'
  | 'appModeView'
  | 'appModeFocusTaskId'
  | 'appModeInboxOpen'
  | 'startOfDay.shownDate'
  | 'endOfDay.shownDate'
  | 'finance.configured'
  | `briefing.dismissed.${string}`;

interface StoreAPI {
  get: (key: SafeStoreKey) => Promise<unknown>;
  set: (key: SafeStoreKey, value: unknown) => Promise<void>;
}

export interface LoadedSettings {
  app: {
    version: string;
    buildDate: string | null;
  };
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
  stripe: {
    configured: boolean;
  };
  finance: {
    configured: boolean;
    provider: 'plaid';
    institutionName: string;
    lastSync: string;
    plaidClientIdConfigured: boolean;
    plaidSecretConfigured: boolean;
  };
  ui: {
    themeMode: 'light' | 'dark';
  };
  // User preferences
  day: {
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
    timeboxDefault: number;
    syncFrequencyMins: number;
  };
  story: {
    narrativeStyle: 'concise' | 'practical' | 'reflective' | 'screenwriter';
    storyDepth: 'summary' | 'chapters' | 'full';
    tone: 'direct' | 'encouraging' | 'blunt' | 'coach';
    accountabilityLevel: 'gentle' | 'firm' | 'blunt';
  };
  tasks: {
    priorityRule: 'deadlines' | 'energy' | 'revenue' | 'balanced';
    notificationIntensity: 'minimal' | 'standard' | 'high';
    distractionFiltering: 'show_all' | 'top_priorities' | 'today_only';
  };
  privacy: {
    sensitiveDataMasking: boolean;
    auditLog: boolean;
  };
  moneyPrefs: {
    dueDateWindowDays: number;
    alertSeverity: 'quiet' | 'warning' | 'urgent';
    financialSensitivity: 'soft' | 'hard';
    timeHorizonDays: number;
  };
  notion: {
    configured: boolean;
    capturePageId: string;
  };
}

export interface SettingsUpdate {
  anthropicApiKey?: string;
  asanaToken?: string;
  stripeSecretKey?: string;
  gcalClientId?: string;
  gcalClientSecret?: string;
  gcalCalendarIds?: string[];
  gcalWriteCalendarId?: string;
  workMins?: number;
  breakMins?: number;
  longBreakMins?: number;
  blockedSites?: string[];
  plaidClientId?: string;
  plaidSecret?: string;
  // User preferences
  themeMode?: 'light' | 'dark';
  dayStartHour?: number;
  dayStartMin?: number;
  dayEndHour?: number;
  dayEndMin?: number;
  timeboxDefault?: number;
  syncFrequencyMins?: number;
  narrativeStyle?: string;
  storyDepth?: string;
  tone?: string;
  accountabilityLevel?: string;
  priorityRule?: string;
  notificationIntensity?: string;
  distractionFiltering?: string;
  sensitiveDataMasking?: boolean;
  auditLog?: boolean;
  dueDateWindowDays?: number;
  alertSeverity?: string;
  financialSensitivity?: string;
  timeHorizonDays?: number;
  notionApiKey?: string;
  notionCapturePageId?: string;
}

interface SettingsAPI {
  load: () => Promise<LoadedSettings>;
  save: (payload: SettingsUpdate) => Promise<void>;
}

interface WindowAPI {
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

interface ChatHistoryAPI {
  list: () => Promise<ChatThreadSummary[]>;
  loadThread: (threadId: string) => Promise<ChatThread | null>;
  createThread: (params: { date: string; mode: 'briefing' | 'chat' | 'eod'; seedTitle?: string }) => Promise<ChatThread>;
  saveThread: (threadId: string, messages: ChatMessage[]) => Promise<ChatThreadSummary | null>;
  deleteThread: (threadId: string) => Promise<boolean>;
  clearOld: (today: string) => Promise<boolean>;
}

interface StripeDashboardData {
  received: number;
  pending: number;
  overdue: number;
  upcoming: number;
  availableBalance: number;
  pendingBalance: number;
  recentCharges: Array<{
    id: string;
    amount: number;
    description: string | null;
    created: number;
    status: string;
    customerEmail: string | null;
  }>;
  openInvoices: Array<{
    id: string;
    amount: number;
    description: string | null;
    dueDate: number | null;
    status: string;
    customerEmail: string | null;
    isOverdue: boolean;
  }>;
}

interface StripeAPI {
  getDashboard: () => Promise<ApiResult<StripeDashboardData>>;
  testConnection: () => Promise<ApiResult<{ currency: string }>>;
}

interface FinanceAPI {
  getState: () => Promise<import('../../engine/types').EngineState | null>;
  getAccounts: () => Promise<{ id: string; name: string; type: string; current_balance: number; available_balance: number; institution: string; last_synced: string }[]>;
  refresh: () => Promise<import('../../engine/types').EngineState | null>;
  plaidLink: () => Promise<{ success: boolean }>;
  plaidExchange: (publicToken: string) => Promise<{ success: boolean }>;
}

interface MenuAPI {
  onNewTask: (cb: () => void) => () => void;
  onNewEvent: (cb: () => void) => () => void;
  onSetView: (cb: (view: string) => void) => () => void;
  onToggleSidebar: (cb: () => void) => () => void;
  onGoToday: (cb: () => void) => () => void;
  onStartDay: (cb: () => void) => () => void;
  onOpenInk: (cb: () => void) => () => void;
  onOpenSettings: (cb: () => void) => () => void;
  onOpenPlot: (cb: () => void) => () => void;
}

interface CaptureAPI {
  list: () => Promise<import('./index').CaptureEntry[]>;
  add: (text: string) => Promise<import('./index').CaptureEntry>;
  remove: (id: string) => Promise<boolean>;
  purgeStale: () => Promise<boolean>;
  onOpenOverlay: (cb: () => void) => () => void;
  sendToNotion: (text: string) => Promise<{ success: boolean }>;
  hideCaptureWindow: () => Promise<void>;
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
      chat: ChatHistoryAPI;
      stripe: StripeAPI;
      capture: CaptureAPI;
      finance: FinanceAPI;
      menu: MenuAPI;
    };
  }
}

export {};
