import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DailyPlan, PlannedTask, WeeklyGoal } from '@/types';
import { currentWeekStart, TODAY } from '@/lib/planner';

interface TaskActionsOptions {
  weeklyGoals: WeeklyGoal[];
  setPlannedTasks: Dispatch<SetStateAction<PlannedTask[]>>;
  setDailyPlan: Dispatch<SetStateAction<DailyPlan>>;
  setSelectedInboxId: Dispatch<SetStateAction<string | null>>;
  setLastCommitTimestamp: Dispatch<SetStateAction<number>>;
}

export function useTaskActions({
  weeklyGoals,
  setPlannedTasks,
  setDailyPlan,
  setSelectedInboxId,
  setLastCommitTimestamp,
}: TaskActionsOptions) {
  const migrateOldTasks = useCallback((): PlannedTask[] => {
    const weekStart = currentWeekStart();
    const stale: PlannedTask[] = [];

    setPlannedTasks((prev) => prev.map((task) => {
      if (
        (task.status === 'committed' || task.status === 'scheduled') &&
        task.lastCommittedDate &&
        task.lastCommittedDate < weekStart
      ) {
        stale.push(task);
        return { ...task, status: 'candidate' };
      }
      return task;
    }));

    setDailyPlan((prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.filter((id) => !stale.some((task) => task.id === id)),
    }));

    return stale;
  }, [setDailyPlan, setPlannedTasks]);

  const dropTask = useCallback((taskId: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) => task.id === taskId ? { ...task, status: 'cancelled' } : task)
    );
  }, [setPlannedTasks]);

  const bringForward = useCallback((taskId: string, goalId?: string) => {
    const targetGoal = goalId || weeklyGoals[0]?.id || null;

    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              weeklyGoalId: targetGoal,
              status: task.status === 'done' ? 'done' : 'committed',
              lastCommittedDate: TODAY,
            }
          : task
      )
    );

    setDailyPlan((prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.includes(taskId)
        ? prev.committedTaskIds
        : [...prev.committedTaskIds, taskId],
    }));

    setSelectedInboxId(null);
    setLastCommitTimestamp(Date.now());
  }, [setDailyPlan, setLastCommitTimestamp, setPlannedTasks, setSelectedInboxId, weeklyGoals]);

  const addLocalTask = useCallback((title: string, goalId?: string) => {
    if (!title.trim()) return;

    const nextId = `local-${Date.now()}`;
    const targetGoal = goalId || weeklyGoals[0]?.id || null;
    const task: PlannedTask = {
      id: nextId,
      title: title.trim(),
      source: 'local',
      weeklyGoalId: targetGoal,
      status: 'committed',
      estimateMins: 45,
      active: false,
      lastCommittedDate: TODAY,
    };

    setPlannedTasks((prev) => [...prev, task]);
    setDailyPlan((prev) => ({ ...prev, committedTaskIds: [...prev.committedTaskIds, nextId] }));
  }, [setDailyPlan, setPlannedTasks, weeklyGoals]);

  const assignTaskToGoal = useCallback((taskId: string, goalId: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              weeklyGoalId: goalId,
              lastCommittedDate: TODAY,
            }
          : task
      )
    );
  }, [setPlannedTasks]);

  const moveForward = useCallback((taskId: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status: 'migrated', active: false, scheduledEventId: undefined, scheduledCalendarId: undefined }
          : task
      )
    );

    setDailyPlan((prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.filter((id) => id !== taskId),
    }));
  }, [setDailyPlan, setPlannedTasks]);

  const releaseTask = useCallback((taskId: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? { ...task, status: 'cancelled', active: false, scheduledEventId: undefined, scheduledCalendarId: undefined }
          : task
      )
    );

    setDailyPlan((prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.filter((id) => id !== taskId),
    }));
  }, [setDailyPlan, setPlannedTasks]);

  const toggleTask = useCallback((id: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) => {
        if (task.id !== id) return task;
        const nextDone = task.status !== 'done';
        return {
          ...task,
          status: nextDone ? 'done' : 'committed',
          active: false,
        };
      })
    );
  }, [setPlannedTasks]);

  const setActiveTask = useCallback((id: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) => ({
        ...task,
        active: task.id === id,
      }))
    );
  }, [setPlannedTasks]);

  return {
    migrateOldTasks,
    dropTask,
    bringForward,
    addLocalTask,
    assignTaskToGoal,
    moveForward,
    releaseTask,
    toggleTask,
    setActiveTask,
  };
}
