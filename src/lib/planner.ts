import { format, startOfWeek } from 'date-fns';
import type {
  AsanaTask,
  GCalEvent,
  InboxItem,
  PlannedTask,
  ScheduleBlock,
  CalendarEventInput,
} from '@/types';
import { formatRoundedHours } from '@/lib/utils';

export const FOCUS_EVENT_MARKER = '[TimeFocus]';
export const TODAY = format(new Date(), 'yyyy-MM-dd');

export function asInboxItem(task: PlannedTask): InboxItem {
  return {
    id: task.id,
    source: task.source === 'asana' ? 'asana' : 'gmail',
    title: task.title,
    time: task.lastCommittedDate === TODAY ? 'Held for today' : formatRoundedHours(task.estimateMins),
    priority: task.priority,
  };
}

export function getPriority(task: AsanaTask): string | undefined {
  return task.custom_fields?.find((field) => field.name?.toLowerCase() === 'priority')?.display_value || undefined;
}

export function isDueSoon(task: AsanaTask): boolean {
  if (!task.due_on) return false;
  const due = new Date(task.due_on);
  const now = new Date();
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86400000);
  return diffDays <= 7;
}

export function asPlannedTask(task: AsanaTask, existing?: PlannedTask): PlannedTask {
  return {
    id: existing?.id || `asana-${task.gid}`,
    title: task.name,
    source: 'asana',
    sourceId: task.gid,
    weeklyGoalId: existing?.weeklyGoalId || null,
    status: existing?.status || 'candidate',
    estimateMins: existing?.estimateMins || 60,
    priority: getPriority(task) || existing?.priority,
    notes: task.notes || existing?.notes,
    asanaProject: task.projects?.[0]?.name || existing?.asanaProject,
    active: existing?.active || false,
    scheduledEventId: existing?.scheduledEventId,
    scheduledCalendarId: existing?.scheduledCalendarId,
    lastCommittedDate: existing?.lastCommittedDate,
  };
}

export function eventDurationMins(event: GCalEvent): number {
  const start = new Date(event.start.dateTime || event.start.date || '');
  const end = new Date(event.end.dateTime || event.end.date || '');
  return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function eventToBlock(event: GCalEvent, tasks: PlannedTask[]): ScheduleBlock | null {
  if (!event.start?.dateTime || !event.end?.dateTime) return null;

  const start = new Date(event.start.dateTime);
  const linkedTask = tasks.find((task) => task.scheduledEventId === event.id);
  const isFocus = event.description?.includes(FOCUS_EVENT_MARKER) || Boolean(linkedTask);

  return {
    id: event.id,
    title: event.summary || 'Untitled',
    startHour: start.getHours(),
    startMin: start.getMinutes(),
    durationMins: eventDurationMins(event),
    kind: isFocus ? 'focus' : 'hard',
    readOnly: !isFocus,
    linkedTaskId: linkedTask?.id,
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

export function currentWeekStart(): string {
  return format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
}

function overlapsWindow(start: number, durationMins: number, block: ScheduleBlock): boolean {
  const end = start + durationMins;
  return start < blockEndMinutes(block) && end > blockStartMinutes(block);
}

function sortBlocksByStart(a: ScheduleBlock, b: ScheduleBlock): number {
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
  date = TODAY
): CalendarEventInput {
  const startDate = `${date}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`;
  const totalMinutes = startHour * 60 + startMin + durationMins;
  const endHour = Math.floor(totalMinutes / 60);
  const endMin = totalMinutes % 60;
  const endDate = `${date}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    summary: title,
    description: `${FOCUS_EVENT_MARKER}\n${taskId}`,
    start: { dateTime: startDate, timeZone },
    end: { dateTime: endDate, timeZone },
  };
}
