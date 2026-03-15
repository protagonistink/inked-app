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
  monthlyAimId?: string;
}

export interface DailyRitual {
  id: string;
  title: string;
  completedDates: string[];
  estimateMins?: number;
}

export interface Countdown {
  id: string;
  title: string;
  dueDate: string;
}

export type TaskStatus =
  | 'candidate'
  | 'committed'
  | 'scheduled'
  | 'done'
  | 'migrated'
  | 'cancelled';

export interface PlannedTask {
  id: string;
  title: string;
  source: TaskSource;
  sourceId?: string;
  weeklyGoalId: string | null;
  status: TaskStatus;
  estimateMins: number;
  priority?: string;
  notes?: string;
  asanaProject?: string;
  active: boolean;
  scheduledEventId?: string;
  scheduledCalendarId?: string;
  lastCommittedDate?: string;
  parentId?: string;
}

export interface ScheduleBlock {
  id: string;
  title: string;
  startHour: number;
  startMin: number;
  durationMins: number;
  kind: 'hard' | 'focus' | 'break';
  readOnly: boolean;
  linkedTaskId?: string;
  eventId?: string;
  calendarId?: string;
  source: 'gcal' | 'local';
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
  source: 'asana' | 'gcal' | 'gmail';
  title: string;
  time: string;
  priority?: string;
  active?: boolean;
}

export interface DailyPlan {
  date: string;
  committedTaskIds: string[];
}

export interface MonthlyPlan {
  month: string;
  reflection: string;
  oneThing: string;
  why: string;
  completedAt?: string;
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
