export type CaptureColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'lavender';

export interface CaptureEntry {
  id: string;
  text: string;
  color: CaptureColor;
  createdAt: string; // ISO 8601
}

export type TaskSource = 'asana' | 'local';

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  due_on: string | null;
  projects: { gid: string; name: string }[];
  tags: { gid: string; name: string }[];
  notes: string;
  custom_fields: { name: string; display_value: string | null }[];
}

export interface GCalEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  colorId?: string;
  calendarId?: string;
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

export interface CalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  accessRole?: string;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  color: string;
  why?: string;
  countdownId?: string;
}

export interface DailyRitual {
  id: string;
  title: string;
  completedDates: string[];
  estimateMins?: number;
  skippedDates?: string[];
}

export interface Countdown {
  id: string;
  title: string;
  dueDate: string;
}

/**
 * Lifecycle status for a planned task.
 *
 * - `candidate`  — In the inbox/backlog; not yet committed to any day.
 * - `committed`  — Added to a specific day's plan but not yet on the calendar.
 * - `scheduled`  — Committed AND linked to a Google Calendar focus block.
 * - `done`       — Completed by the user on any day.
 * - `migrated`   — Deliberately deferred; removed from the active day plan.
 * - `cancelled`  — Released from the plan entirely (soft delete; kept for history).
 */
export type TaskStatus =
  | 'candidate'
  | 'committed'
  | 'scheduled'
  | 'done'
  | 'migrated'
  | 'cancelled';

export type WorkMode = 'deep_work' | 'collaborative' | 'admin' | 'quick_win';

export interface PlannedTask {
  id: string;
  title: string;
  source: TaskSource;
  /** Asana GID when source === 'asana'. */
  sourceId?: string;
  /** Which weekly goal this task belongs to, or null if unassigned. */
  weeklyGoalId: string | null;
  status: TaskStatus;
  estimateMins: number;
  priority?: string;
  notes?: string;
  asanaProject?: string;
  dueOn?: string | null;
  workMode?: WorkMode;
  /** True while this task is the active focus (timer running). */
  active: boolean;
  /** Google Calendar event ID when a focus block has been synced. */
  scheduledEventId?: string;
  /** The calendar the focus block was created in. */
  scheduledCalendarId?: string;
  /** The most recent date (YYYY-MM-DD) this task was committed or scheduled. Used to detect staleness across week boundaries. */
  lastCommittedDate?: string;
  /** Parent task ID for nested subtasks. */
  parentId?: string;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  startHour: number;
  startMin: number;
  durationMins: number;
  /**
   * - `hard`  — A GCal event that cannot be moved (meeting, appointment).
   * - `focus` — A focus block linked to a PlannedTask (moveable, syncable).
   * - `break` — A ritual/buffer block (readOnly: true, source: 'local').
   */
  kind: 'hard' | 'focus' | 'break';
  /**
   * Whether the block can be moved or resized.
   * - gcal hard blocks: always true
   * - rituals (break blocks): true
   * - focus blocks created by the user: false
   */
  readOnly: boolean;
  /** PlannedTask.id for focus blocks. */
  linkedTaskId?: string;
  /** Cached WeeklyGoal.id for linked focus blocks, used to preserve color during sync races. */
  linkedGoalId?: string | null;
  /** Google Calendar event ID (set after sync). */
  eventId?: string;
  calendarId?: string;
  source: 'gcal' | 'local';
  /** undefined = legacy/manual block (treated as accepted). */
  proposal?: 'draft' | 'accepted';
  /** Task IDs nested inside this block as a checklist. */
  nestedTaskIds?: string[];
}

export interface PomodoroState {
  isRunning: boolean;
  isPaused: boolean;
  isBreak: boolean;
  timeRemaining: number;
  totalTime: number;
  currentTaskId: string | null;
  currentTaskTitle?: string | null;
  pomodoroCount: number;
}

export interface InboxItem {
  id: string;
  source: 'asana' | 'gcal' | 'gmail' | 'local';
  title: string;
  time: string;
  priority?: string;
  active?: boolean;
  workMode?: WorkMode;
}

export interface DailyPlan {
  date: string;
  committedTaskIds: string[];
  hasEverCommitted?: boolean;
  dayStarted?: boolean;
}

export interface PlanningDateOption {
  date: string;
  label: string;
  shortLabel: string;
  isToday: boolean;
}

// ---------------------------------------------------------------------------
// Day Commit State — derived state machine for the Today's Commit view
// ---------------------------------------------------------------------------

export type DayCommitState = 'briefing' | 'committed' | 'started' | 'closed';

export interface DayCommitInfo {
  state: DayCommitState;
  focusMins: number;
  completedFocusMins: number;
  openMins: number;
  totalBlocks: number;
  completedBlocks: number;
  minutesPastClose: number;
  hadBlocks: boolean;
}

export interface MonthlyPlan {
  month: string;
  reflection: string;
  oneThing: string;
  why: string;
  completedAt?: string;
  /** Revenue target for the month (USD). Used on the Intentions screen. */
  monthlyTarget?: number;
}

export interface DayEntry {
  date: string;          // YYYY-MM-DD — unique key per calendar day
  journalText: string;
  chapterNumber: number; // 1-indexed running count across all entries
  savedAt?: string;      // ISO timestamp of last save
}

export interface TimeLogEntry {
  id: string;
  objectiveId: string | null;
  objectiveTitle: string;
  taskId?: string;
  taskTitle?: string;
  startedAt: string;
  endedAt: string;
  durationMins: number;
  kind: 'focus';
}

// ---------------------------------------------------------------------------
// Ink Context — persistent AI memory layer
// ---------------------------------------------------------------------------

export type InkMode = 'morning' | 'midday' | 'evening' | 'sunday-interview';

// ---------------------------------------------------------------------------
// Shared AI / IPC types — single source of truth for renderer + main process
// ---------------------------------------------------------------------------

export interface ChatImageAttachment {
  kind: 'image';
  dataUrl: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
  name: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: ChatImageAttachment[];
}

export interface ChatThread {
  id: string;
  date: string;
  mode: 'briefing' | 'chat' | 'eod';
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatThreadSummary {
  id: string;
  date: string;
  mode: 'briefing' | 'chat' | 'eod';
  title: string;
  preview: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GCalEventContext {
  title: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
}

export interface UserPhysics {
  focusBlockLength: number;
  peakEnergyWindow: string;
  commonDerailers: string[];
  planningStyle: string;
  recoveryPattern: string;
  warningSignals: string[];
}

export interface BriefingContext {
  date: string;
  planningDate: string;
  planningDateLabel: string;
  planningDateIsToday: boolean;
  currentTime: string;
  currentHour: number;
  currentMinute: number;
  weeklyGoals: Array<{ title: string; why?: string }>;
  interviewStep?: number;
  interviewAnswers?: string[];
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
  remainingWorkdayMinutes: number;
  availableFocusMinutes: number;
  scheduledMinutes: number;
  committedTasks: Array<{ title: string; estimateMins: number; weeklyGoal: string }>;
  doneTasks: Array<{ title: string; estimateMins: number; weeklyGoal: string }>;
  countdowns: Array<{ title: string; daysUntil: number }>;
  workdayStartHour: number;
  workdayStartMin: number;
  workdayEndHour: number;
  workdayEndMin: number;
  isAfterWorkday: boolean;
  minutesPastClose: number;
  userPhysics?: UserPhysics;
  monthlyOneThing?: string;
  monthlyWhy?: string;
  inkMode?: InkMode;
  finance?: {
    weeklyRemaining: number;
    weeklyRemainingContext: 'normal' | 'tight' | 'comfortable';
    billsCovered: boolean;
    cognitiveState: 'calm' | 'alert' | 'compressed';
    upcoming: Array<{
      name: string;
      amount: number;
      daysUntil: number;
      covered: boolean;
      category: 'personal' | 'business';
    }>;
    actionItems: Array<{
      description: string;
      daysOverdue?: number;
      amount?: number;
    }>;
    recommendations: Array<{
      action: string;
      target: string;
      amount: number;
      reason: string;
    }>;
    businessPipeline?: {
      confirmedThisMonth: number;
      invoicedOutstanding: number;
      overdueInvoices: number;
    };
  };
  rituals?: Array<{ title: string; estimateMins: number }>;
}

export interface InkJournalEntry {
  date: string;                    // YYYY-MM-DD
  excites: string;                 // "What excites you today?"
  needleMovers: Array<{            // "One thing that moves [Goal] forward"
    goalTitle: string;             // From weekly intentions (Three Threads)
    action: string;                // User's answer
  }>;
  artistDate: string;              // "What's just for you?"
  eveningReflection?: string;      // Filled by evening close (Sprint 6)
  createdAt: string;               // ISO timestamp
}

export interface InkContext {
  // Weekly context (written by Sunday Interview)
  weeklyContext?: string;
  hierarchy?: string;              // "writing > client work > infrastructure"
  musts?: string;
  currentPriority?: string;
  protectedBlocks?: string;
  tells?: string;
  artistDate?: string;
  honestAudit?: string;
  weekUpdatedAt?: string;

  // Three Threads snapshot
  threadsRaw?: string;

  // Journal entries (rolling 7-day window)
  journalEntries: InkJournalEntry[];

  // Metadata
  lastUpdated: string;
}
