import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import type {
  AsanaTask,
  DailyRitual,
  GCalEvent,
  InboxItem,
  PlannedTask,
  ScheduleBlock,
  CalendarEventInput,
  WorkMode,
} from '@/types';
import { formatRoundedHours } from '@/lib/utils';

export const FOCUS_EVENT_MARKER = '[Inked]';
export const CALENDAR_GRID_SNAP_MINS = 15;

export function getToday(date = new Date()): string {
  return format(date, 'yyyy-MM-dd');
}

export function asInboxItem(task: PlannedTask): InboxItem {
  const today = getToday();
  return {
    id: task.id,
    source: task.source === 'asana' ? 'asana' : 'local',
    title: task.title || 'Untitled task',
    time: task.lastCommittedDate === today ? 'Held for today' : formatRoundedHours(task.estimateMins),
    priority: task.priority,
    workMode: task.workMode,
    asanaProject: task.asanaProject,
  };
}

export function getPriority(task: AsanaTask): string | undefined {
  return task.custom_fields?.find((field) => field.name?.toLowerCase() === 'priority')?.display_value || undefined;
}

export function isDueSoon(task: AsanaTask): boolean {
  if (!task.due_on) return false;
  const due = parseISO(task.due_on);
  const now = new Date();
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000);
  return diffDays <= 7;
}

const WORK_MODE_MAP: Record<string, WorkMode> = {
  'deep work': 'deep_work',
  'collaborative': 'collaborative',
  'admin': 'admin',
  'quick win': 'quick_win',
};

export function asPlannedTask(task: AsanaTask, existing?: PlannedTask): PlannedTask {
  const workModeValue = task.custom_fields?.find(
    (f) => f.name?.toLowerCase() === 'work mode'
  )?.display_value;
  const workMode = workModeValue
    ? WORK_MODE_MAP[workModeValue.toLowerCase()]
    : existing?.workMode;

  return {
    id: existing?.id || `asana-${task.gid}`,
    title: task.name || 'Untitled task',
    source: 'asana',
    sourceId: task.gid,
    weeklyGoalId: existing?.weeklyGoalId || null,
    status: existing?.status || 'candidate',
    estimateMins: existing?.estimateMins || 60,
    priority: getPriority(task) || existing?.priority,
    notes: task.notes || existing?.notes,
    asanaProject: task.projects?.[0]?.name || existing?.asanaProject,
    dueOn: task.due_on ?? existing?.dueOn ?? null,
    workMode,
    active: existing?.active || false,
    scheduledEventId: existing?.scheduledEventId,
    scheduledCalendarId: existing?.scheduledCalendarId,
    lastCommittedDate: existing?.lastCommittedDate,
  };
}

interface InboxSortOptions {
  primaryGoalId: string | null;
  planningDate?: string;
}

function compareNullableDate(a?: string | null, b?: string | null) {
  if (a && b) return a.localeCompare(b);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

export function compareInboxTasks(
  aTask: PlannedTask | undefined,
  bTask: PlannedTask | undefined,
  options: InboxSortOptions,
) {
  const today = options.planningDate ?? getToday();

  const aIsOverdue = Boolean(aTask?.dueOn && aTask.dueOn < today);
  const bIsOverdue = Boolean(bTask?.dueOn && bTask.dueOn < today);
  if (aIsOverdue !== bIsOverdue) return aIsOverdue ? -1 : 1;
  if (aIsOverdue && bIsOverdue) {
    const overdueDateOrder = compareNullableDate(aTask?.dueOn, bTask?.dueOn);
    if (overdueDateOrder !== 0) return overdueDateOrder;
  }

  const aIsRollover = Boolean(aTask?.lastCommittedDate && aTask.lastCommittedDate < today);
  const bIsRollover = Boolean(bTask?.lastCommittedDate && bTask.lastCommittedDate < today);
  if (aIsRollover !== bIsRollover) return aIsRollover ? -1 : 1;
  if (aIsRollover && bIsRollover) {
    const rolloverDateOrder = compareNullableDate(aTask?.lastCommittedDate, bTask?.lastCommittedDate);
    if (rolloverDateOrder !== 0) return rolloverDateOrder;
  }

  const aIsInk = options.primaryGoalId != null && aTask?.weeklyGoalId === options.primaryGoalId;
  const bIsInk = options.primaryGoalId != null && bTask?.weeklyGoalId === options.primaryGoalId;
  if (aIsInk !== bIsInk) return aIsInk ? -1 : 1;

  const aDueOrder = compareNullableDate(aTask?.dueOn, bTask?.dueOn);
  if (aDueOrder !== 0) return aDueOrder;

  const WORK_MODE_SORT_ORDER: Record<string, number> = {
    deep_work: 0,
    collaborative: 1,
    quick_win: 2,
    admin: 3,
  };
  const aMode = aTask?.workMode ? (WORK_MODE_SORT_ORDER[aTask.workMode] ?? 4) : 4;
  const bMode = bTask?.workMode ? (WORK_MODE_SORT_ORDER[bTask.workMode] ?? 4) : 4;
  if (aMode !== bMode) return aMode - bMode;

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const aPri = aTask?.priority ? (priorityOrder[aTask.priority.toLowerCase()] ?? 3) : 3;
  const bPri = bTask?.priority ? (priorityOrder[bTask.priority.toLowerCase()] ?? 3) : 3;
  if (aPri !== bPri) return aPri - bPri;

  return (aTask?.title ?? '').localeCompare(bTask?.title ?? '');
}

export function eventDurationMins(event: GCalEvent): number {
  const start = new Date(event.start.dateTime || event.start.date || '');
  const end = new Date(event.end.dateTime || event.end.date || '');
  return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function eventToBlock(event: GCalEvent, tasks: PlannedTask[]): ScheduleBlock | null {
  if (!event.start?.dateTime || !event.end?.dateTime) return null;

  const start = new Date(event.start.dateTime);
  const isSchedulableTask = (task: PlannedTask) => task.status !== 'done' && task.status !== 'cancelled';
  const descTaskId = (() => {
    if (!event.description?.includes(FOCUS_EVENT_MARKER)) return undefined;
    const match = /\[Inked\]\s*\n([^\n]+)/.exec(event.description);
    return match?.[1]?.trim();
  })();
  const linkedTask = tasks.find((task) => task.scheduledEventId === event.id && isSchedulableTask(task))
    ?? (descTaskId ? tasks.find((task) => task.id === descTaskId && isSchedulableTask(task)) : undefined);
  const isFocus = Boolean(linkedTask);

  return {
    id: event.id,
    title: event.summary || 'Untitled',
    startHour: start.getHours(),
    startMin: start.getMinutes(),
    durationMins: eventDurationMins(event),
    kind: isFocus ? 'focus' : 'hard',
    readOnly: !isFocus,
    linkedTaskId: linkedTask?.id,
    linkedGoalId: linkedTask?.weeklyGoalId ?? null,
    eventId: event.id,
    calendarId: event.calendarId,
    source: 'gcal',
  };
}

export function blockStartMinutes(block: ScheduleBlock): number {
  return block.startHour * 60 + block.startMin;
}

export function blockEndMinutes(block: ScheduleBlock): number {
  return blockStartMinutes(block) + block.durationMins;
}

export function snapToCalendarGrid(totalMinutes: number, snapMins = CALENDAR_GRID_SNAP_MINS): number {
  return Math.round(totalMinutes / snapMins) * snapMins;
}

export function getPlanningWeekStart(today = new Date()): Date {
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  return today.getDay() === 0 ? addDays(weekStart, 7) : weekStart;
}

export function currentWeekStart(): string {
  return format(getPlanningWeekStart(new Date()), 'yyyy-MM-dd');
}

export function buildRitualBlocks(
  rituals: DailyRitual[],
  workdayStart: { hour: number; min: number },
  dateKey = getToday()
): ScheduleBlock[] {
  let cursorMinutes = workdayStart.hour * 60 + workdayStart.min;

  return rituals
    .filter((ritual) => !(ritual.skippedDates ?? []).includes(dateKey))
    .map((ritual) => {
    const durationMins = ritual.estimateMins ?? 30;
    const block: ScheduleBlock = {
      id: `ritual-${ritual.id}`,
      title: ritual.title,
      startHour: Math.floor(cursorMinutes / 60),
      startMin: cursorMinutes % 60,
      durationMins,
      kind: 'break',
      readOnly: true,
      source: 'local',
    };

    cursorMinutes += durationMins;
    return block;
  });
}

export function mergeScheduleBlocksWithRituals(
  blocks: ScheduleBlock[],
  rituals: DailyRitual[],
  workdayStart: { hour: number; min: number },
  dateKey = getToday()
): ScheduleBlock[] {
  const nonRitualBlocks = blocks.filter((block) => !block.id.startsWith('ritual-'));
  return [...nonRitualBlocks, ...buildRitualBlocks(rituals, workdayStart, dateKey)].sort(sortBlocksByStart);
}

function overlapsWindow(start: number, durationMins: number, block: ScheduleBlock): boolean {
  const end = start + durationMins;
  return start < blockEndMinutes(block) && end > blockStartMinutes(block);
}

export function sortBlocksByStart(a: ScheduleBlock, b: ScheduleBlock): number {
  return blockStartMinutes(a) - blockStartMinutes(b);
}

function findOverlap(start: number, durationMins: number, blocks: ScheduleBlock[]): ScheduleBlock | null {
  return blocks
    .slice()
    .sort(sortBlocksByStart)
    .find((block) => overlapsWindow(start, durationMins, block)) || null;
}

export function planFocusCascade(
  startHour: number,
  startMin: number,
  durationMins: number,
  blocks: ScheduleBlock[],
  targetBlockId?: string
) {
  const desiredStart = startHour * 60 + startMin;
  let placedStart = desiredStart;
  const otherBlocks = blocks.filter((block) => block.id !== targetBlockId);
  const immovableBlocks = otherBlocks.filter((block) => block.readOnly || block.kind === 'hard');
  const earlierFocusBlocks = otherBlocks
    .filter((block) => !block.readOnly && block.kind === 'focus' && blockStartMinutes(block) < desiredStart)
    .sort(sortBlocksByStart);

  while (true) {
    const conflict = findOverlap(placedStart, durationMins, [...immovableBlocks, ...earlierFocusBlocks]);
    if (!conflict) break;
    placedStart = blockEndMinutes(conflict);
  }

  const occupied: ScheduleBlock[] = [
    ...immovableBlocks,
    ...earlierFocusBlocks,
    {
      id: targetBlockId || '__new-focus-block__',
      title: '',
      startHour: Math.floor(placedStart / 60),
      startMin: placedStart % 60,
      durationMins,
      kind: 'focus',
      readOnly: false,
      source: 'local',
    },
  ];

  const cascadeUpdates = new Map<string, { startHour: number; startMin: number }>();
  const subsequentFocusBlocks = otherBlocks
    .filter((block) => !block.readOnly && block.kind === 'focus' && !earlierFocusBlocks.some((earlier) => earlier.id === block.id))
    .sort(sortBlocksByStart);

  for (const block of subsequentFocusBlocks) {
    let nextStart = blockStartMinutes(block);

    while (true) {
      const conflict = findOverlap(nextStart, block.durationMins, occupied);
      if (!conflict) break;
      nextStart = blockEndMinutes(conflict);
    }

    occupied.push({
      ...block,
      startHour: Math.floor(nextStart / 60),
      startMin: nextStart % 60,
    });

    if (nextStart !== blockStartMinutes(block)) {
      cascadeUpdates.set(block.id, {
        startHour: Math.floor(nextStart / 60),
        startMin: nextStart % 60,
      });
    }
  }

  return {
    startHour: Math.floor(placedStart / 60),
    startMin: placedStart % 60,
    cascadeUpdates,
  };
}

export function buildFocusEventPayload(
  title: string,
  taskId: string,
  startHour: number,
  startMin: number,
  durationMins: number,
  date = getToday()
): CalendarEventInput {
  const startDateTime = new Date(`${date}T00:00:00`);
  startDateTime.setHours(startHour, startMin, 0, 0);

  const endDateTime = new Date(startDateTime);
  endDateTime.setMinutes(endDateTime.getMinutes() + durationMins);

  const formatLocalDateTime = (value: Date) => (
    `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    + `T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:00`
  );

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    summary: title,
    description: `${FOCUS_EVENT_MARKER}\n${taskId}`,
    start: { dateTime: formatLocalDateTime(startDateTime), timeZone },
    end: { dateTime: formatLocalDateTime(endDateTime), timeZone },
  };
}
