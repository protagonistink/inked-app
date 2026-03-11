import { useMemo } from 'react';
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
  const currentBlock = useMemo(() => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    return scheduleBlocks.find((block) => {
      const start = block.startHour * 60 + block.startMin;
      const end = start + block.durationMins;
      return block.kind === 'focus' && currentMins >= start && currentMins < end;
    }) || null;
  }, [scheduleBlocks]);

  const nextBlock = useMemo(() => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    return scheduleBlocks.find((block) => {
      const start = block.startHour * 60 + block.startMin;
      return block.kind === 'focus' && start > currentMins;
    }) || null;
  }, [scheduleBlocks]);

  const currentTask = useMemo(() => {
    if (currentBlock?.linkedTaskId) {
      return plannedTasks.find((task) => task.id === currentBlock.linkedTaskId) || null;
    }
    return plannedTasks.find((task) => task.active) || null;
  }, [currentBlock, plannedTasks]);

  const dayTasks = useMemo(() => plannedTasks.filter((task) => (
    dailyPlan.committedTaskIds.includes(task.id) &&
    (task.status === 'committed' || task.status === 'scheduled')
  )), [dailyPlan.committedTaskIds, plannedTasks]);

  const committedTasks = useMemo(() => plannedTasks.filter((task) => (
    task.status === 'committed' &&
    dailyPlan.committedTaskIds.includes(task.id)
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
