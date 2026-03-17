import { format } from 'date-fns';
import { getToday } from '@/lib/planner';
import type { BriefingContext } from '@/types/electron';
import type { InboxItem, InkMode, MonthlyPlan, PlannedTask, ScheduleBlock, WeeklyGoal } from '@/types';

export interface CommitChip {
  title: string;
  matchedTaskId: string | null;
  matchedGoalId: string | null;
  selected: boolean;
}

interface BuildBriefingContextOptions {
  weeklyGoals: WeeklyGoal[];
  committedTasks: PlannedTask[];
  workdayEnd: { hour: number; min: number };
  scheduleBlocks: ScheduleBlock[];
  monthlyPlan?: MonthlyPlan | null;
  inkMode?: InkMode;
}

function normalizeTaskTitle(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

export async function buildBriefingContext({
  weeklyGoals,
  committedTasks,
  workdayEnd,
  scheduleBlocks,
  monthlyPlan,
  inkMode,
}: BuildBriefingContextOptions): Promise<BriefingContext> {
  let asanaTasks: BriefingContext['asanaTasks'] = [];
  try {
    const result = await window.api.asana.getTasks({ daysAhead: 14, limit: 30 });
    if (result.success && result.data) {
      asanaTasks = result.data.map((task) => {
        const priorityField = task.custom_fields?.find(
          (field) => field.name.toLowerCase() === 'priority'
        );

        return {
          title: task.name,
          dueOn: task.due_on,
          priority: priorityField?.display_value || undefined,
          project: task.projects?.[0]?.name || undefined,
          notes: task.notes || undefined,
          tags: task.tags?.map((tag) => tag.name),
        };
      });
    }
  } catch {
    // Asana unavailable. Briefing should still work.
  }

  let gcalEvents: BriefingContext['gcalEvents'] = [];
  try {
    const result = await window.api.gcal.getEvents(getToday());
    if (result.success && result.data) {
      gcalEvents = result.data.map((event) => ({
        title: event.summary || '(No title)',
        startTime: event.start?.dateTime ? format(new Date(event.start.dateTime), 'h:mm a') : '',
        endTime: event.end?.dateTime ? format(new Date(event.end.dateTime), 'h:mm a') : '',
        isAllDay: !event.start?.dateTime,
      }));
    }
  } catch {
    // Calendar unavailable. Briefing should still work.
  }

  const now = new Date();
  const endOfDay = new Date();
  endOfDay.setHours(workdayEnd.hour, workdayEnd.min, 0, 0);
  const remainingMins = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 60000));
  const scheduledMinutes = scheduleBlocks
    .filter((block) => !block.readOnly)
    .reduce((sum, block) => sum + block.durationMins, 0);

  return {
    date: format(new Date(), 'EEEE, MMMM d, yyyy'),
    weeklyGoals: weeklyGoals.map((goal) => ({ title: goal.title, why: goal.why })),
    asanaTasks,
    gcalEvents,
    availableFocusMinutes: remainingMins,
    scheduledMinutes,
    committedTasks: committedTasks.map((task) => {
      const goal = task.weeklyGoalId ? weeklyGoals.find((item) => item.id === task.weeklyGoalId) : null;
      return {
        title: task.title,
        estimateMins: task.estimateMins || 45,
        weeklyGoal: goal?.title || 'Unassigned',
      };
    }),
    countdowns: [],
    workdayEndHour: workdayEnd.hour,
    workdayEndMin: workdayEnd.min,
    monthlyOneThing: monthlyPlan?.oneThing,
    monthlyWhy: monthlyPlan?.why,
    inkMode,
  };
}

export function parseCommitChips(
  content: string,
  plannedTasks: PlannedTask[],
  candidateItems: InboxItem[]
): CommitChip[] {
  const taskLines = content
    .split('\n')
    .filter((line) => /^[-–•]\s+\S/.test(line.trim()));

  const matchableTasks = [
    ...plannedTasks.map((task) => ({
      id: task.id,
      title: task.title,
      weeklyGoalId: task.weeklyGoalId,
    })),
    ...candidateItems.map((item) => ({
      id: item.id,
      title: item.title,
      weeklyGoalId: null,
    })),
  ];

  return taskLines.map((line) => {
    const title = line.trim().replace(/^[-–•]\s+/, '').replace(/\s*\(.*?\)\s*$/, '').trim();
    const normalizedTitle = normalizeTaskTitle(title);

    const exactMatch = matchableTasks.find((task) => normalizeTaskTitle(task.title) === normalizedTitle);
    const fuzzyMatch = exactMatch
      ? null
      : matchableTasks.find((task) => {
          const normalizedTaskTitle = normalizeTaskTitle(task.title);
          return normalizedTaskTitle.includes(normalizedTitle) || normalizedTitle.includes(normalizedTaskTitle);
        });

    const matched = exactMatch || fuzzyMatch;

    return {
      title,
      matchedTaskId: matched?.id || null,
      matchedGoalId: matched?.weeklyGoalId || null,
      selected: true,
    };
  });
}
