import { useMemo } from 'react';
import type { DailyPlan, DayCommitInfo, PlannedTask, ScheduleBlock } from '@/types';
import { getToday } from '@/lib/planner';
import { useCurrentMinute } from './useCurrentMinute';

interface DayCommitStateOptions {
  scheduleBlocks: ScheduleBlock[];
  plannedTasks: PlannedTask[];
  dailyPlan: DailyPlan;
  viewDate?: Date;
  workdayEnd: { hour: number; min: number };
}

interface DeriveDayCommitInfoOptions {
  scheduleBlocks: ScheduleBlock[];
  plannedTasks: PlannedTask[];
  dailyPlan: DailyPlan;
  viewDate: Date;
  workdayEnd: { hour: number; min: number };
  currentMinute: number;
}

export function deriveDayCommitInfo({
  scheduleBlocks,
  plannedTasks,
  dailyPlan,
  viewDate,
  workdayEnd,
  currentMinute,
}: DeriveDayCommitInfoOptions): DayCommitInfo {
  const todayKey = getToday();
  const viewDateKey = getToday(viewDate);
  const isToday = viewDateKey === todayKey;
  const isPast = viewDateKey < todayKey;

  const workdayEndMins = workdayEnd.hour * 60 + workdayEnd.min;
  const effectiveMinute = isToday ? currentMinute : 0;
  const focusBlocks = scheduleBlocks.filter((b) => b.kind === 'focus');
  const totalBlocks = focusBlocks.length;

  const focusMins = focusBlocks.reduce((sum, b) => sum + b.durationMins, 0);

  const completedBlocks = focusBlocks.filter((b) => {
    if (!b.linkedTaskId) return false;
    const task = plannedTasks.find((t) => t.id === b.linkedTaskId);
    return task?.status === 'done';
  }).length;

  const completedFocusMins = focusBlocks
    .filter((b) => {
      if (!b.linkedTaskId) return false;
      const task = plannedTasks.find((t) => t.id === b.linkedTaskId);
      return task?.status === 'done';
    })
    .reduce((sum, b) => sum + b.durationMins, 0);

  const hardMins = scheduleBlocks
    .filter((b) => b.kind === 'hard')
    .reduce((sum, b) => sum + b.durationMins, 0);

  const totalWorkdayMins = Math.max(0, workdayEndMins - effectiveMinute);
  const openMins = Math.max(0, totalWorkdayMins - focusMins - hardMins);

  const hadBlocks = dailyPlan.hasEverCommitted === true || dailyPlan.committedTaskIds.length > 0;
  const minutesPastClose = isToday ? Math.max(0, currentMinute - workdayEndMins) : 0;

  let state: DayCommitInfo['state'];
  if (isPast) {
    state = 'closed';
  } else if ((totalBlocks > 0 || dailyPlan.committedTaskIds.length > 0) && dailyPlan.dayStarted) {
    state = 'started';
  } else if (totalBlocks > 0 || dailyPlan.committedTaskIds.length > 0) {
    state = 'committed';
  } else {
    state = 'briefing';
  }

  return {
    state,
    focusMins,
    completedFocusMins,
    openMins,
    totalBlocks,
    completedBlocks,
    minutesPastClose,
    hadBlocks,
  };
}

export function useDayCommitState({
  scheduleBlocks,
  plannedTasks,
  dailyPlan,
  viewDate = new Date(),
  workdayEnd,
}: DayCommitStateOptions): DayCommitInfo {
  const currentMinute = useCurrentMinute();

  return useMemo(() => {
    return deriveDayCommitInfo({
      scheduleBlocks,
      plannedTasks,
      dailyPlan,
      viewDate,
      workdayEnd,
      currentMinute,
    });
  }, [currentMinute, dailyPlan, plannedTasks, scheduleBlocks, viewDate, workdayEnd]);
}
