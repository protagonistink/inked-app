import { useEffect, useMemo, useState } from 'react';
import type {
  DailyPlan,
  InboxItem,
  PlannedTask,
  ScheduleBlock,
} from '@/types';
import { asInboxItem } from '@/lib/planner';

interface PlannerSelectorsOptions {
  plannedTasks: PlannedTask[];
  scheduleBlocks: ScheduleBlock[];
  dailyPlan: DailyPlan;
}

export function usePlannerSelectors({
  plannedTasks,
  scheduleBlocks,
  dailyPlan,
}: PlannerSelectorsOptions) {
  const [currentMinute, setCurrentMinute] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    let intervalId: number | null = null;

    const updateCurrentMinute = () => {
      const now = new Date();
      setCurrentMinute(now.getHours() * 60 + now.getMinutes());
    };

    updateCurrentMinute();

    const timeoutId = window.setTimeout(() => {
      updateCurrentMinute();
      intervalId = window.setInterval(updateCurrentMinute, 60_000);
    }, (60 - new Date().getSeconds()) * 1000);

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const taskStatusById = useMemo(() => {
    const statuses = new Map<string, PlannedTask['status']>();
    for (const task of plannedTasks) {
      statuses.set(task.id, task.status);
    }
    return statuses;
  }, [plannedTasks]);

  const currentBlock = useMemo(() => {
    return scheduleBlocks.find((block) => {
      const start = block.startHour * 60 + block.startMin;
      const end = start + block.durationMins;
      return (
        block.kind === 'focus' &&
        currentMinute >= start &&
        currentMinute < end &&
        (!block.linkedTaskId || taskStatusById.get(block.linkedTaskId) !== 'done')
      );
    }) || null;
  }, [currentMinute, scheduleBlocks, taskStatusById]);

  const nextBlock = useMemo(() => {
    return scheduleBlocks.find((block) => {
      const start = block.startHour * 60 + block.startMin;
      return (
        block.kind === 'focus' &&
        start > currentMinute &&
        (!block.linkedTaskId || taskStatusById.get(block.linkedTaskId) !== 'done')
      );
    }) || null;
  }, [currentMinute, scheduleBlocks, taskStatusById]);

  const currentTask = useMemo(() => {
    if (currentBlock?.linkedTaskId) {
      return plannedTasks.find((task) => task.id === currentBlock.linkedTaskId) || null;
    }
    return plannedTasks.find((task) => task.active) || null;
  }, [currentBlock, plannedTasks]);

  const dayTasks = useMemo(() => plannedTasks.filter((task) => (
    dailyPlan.committedTaskIds.includes(task.id) &&
    (task.status === 'committed' || task.status === 'scheduled' || task.status === 'done') &&
    (!task.parentId || !dailyPlan.committedTaskIds.includes(task.parentId))
  )), [dailyPlan.committedTaskIds, plannedTasks]);

  const committedTasks = useMemo(() => plannedTasks.filter((task) => (
    task.status === 'committed' &&
    dailyPlan.committedTaskIds.includes(task.id) &&
    (!task.parentId || !dailyPlan.committedTaskIds.includes(task.parentId))
  )), [dailyPlan.committedTaskIds, plannedTasks]);

  const archiveTasks = useMemo(() => (
    plannedTasks.filter((task) => ['done', 'migrated', 'cancelled'].includes(task.status))
  ), [plannedTasks]);

  const candidateItems = useMemo<InboxItem[]>(() => (
    plannedTasks
      .filter((task) => task.status === 'candidate')
      .map(asInboxItem)
  ), [plannedTasks]);

  return {
    currentBlock,
    nextBlock,
    currentTask,
    dayTasks,
    committedTasks,
    archiveTasks,
    candidateItems,
  };
}
