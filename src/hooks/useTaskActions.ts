import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DailyPlan, PlannedTask, ScheduleBlock, WeeklyGoal } from '@/types';
import { currentWeekStart } from '@/lib/planner';
import { withTimeout } from '@/lib/ipc';

interface TaskActionsOptions {
  weeklyGoals: WeeklyGoal[];
  plannedTasks: PlannedTask[];
  scheduleBlocks: ScheduleBlock[];
  planningDate: string;
  setPlannedTasks: Dispatch<SetStateAction<PlannedTask[]>>;
  setScheduleBlocks: Dispatch<SetStateAction<ScheduleBlock[]>>;
  setDailyPlanForDate: (date: string, value: DailyPlan | ((current: DailyPlan) => DailyPlan)) => void;
  setSelectedInboxId: Dispatch<SetStateAction<string | null>>;
  setLastCommitTimestamp: Dispatch<SetStateAction<number>>;
}

export function useTaskActions({
  weeklyGoals,
  plannedTasks,
  scheduleBlocks,
  planningDate,
  setPlannedTasks,
  setScheduleBlocks,
  setDailyPlanForDate,
  setSelectedInboxId,
  setLastCommitTimestamp,
}: TaskActionsOptions) {
  const removeLinkedScheduleBlock = useCallback(async (taskId: string) => {
    const linkedBlock = scheduleBlocks.find((block) => block.linkedTaskId === taskId);
    if (!linkedBlock) return;

    if (linkedBlock.eventId) {
      const result = await withTimeout(window.api.gcal.deleteEvent(linkedBlock.eventId, linkedBlock.calendarId), 'gcal.deleteEvent');
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove linked calendar event');
      }
    }

    setScheduleBlocks((prev) => prev.filter((block) => block.id !== linkedBlock.id));
  }, [scheduleBlocks, setScheduleBlocks]);

  const migrateOldTasks = useCallback((): PlannedTask[] => {
    const weekStart = currentWeekStart();
    const stale = plannedTasks.filter((task) => (
      (task.status === 'committed' || task.status === 'scheduled') &&
      task.lastCommittedDate &&
      task.lastCommittedDate < weekStart
    ));
    const staleIds = new Set(stale.map((task) => task.id));

    if (staleIds.size === 0) return [];

    setPlannedTasks((prev) => prev.map((task) => (
      staleIds.has(task.id)
        ? {
            ...task,
            status: 'candidate',
            active: false,
            scheduledEventId: undefined,
            scheduledCalendarId: undefined,
          }
        : task
    )));

    setScheduleBlocks((prev) => prev.filter((block) => !block.linkedTaskId || !staleIds.has(block.linkedTaskId)));

    setDailyPlanForDate(planningDate, (prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.filter((id) => !stale.some((task) => task.id === id)),
    }));

    return stale.map((task) => ({
      ...task,
      status: 'candidate',
      active: false,
      scheduledEventId: undefined,
      scheduledCalendarId: undefined,
    }));
  }, [plannedTasks, planningDate, setDailyPlanForDate, setPlannedTasks, setScheduleBlocks]);

  const dropTask = useCallback((taskId: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) => task.id === taskId ? { ...task, status: 'cancelled' } : task)
    );
  }, [setPlannedTasks]);

  const nestTask = useCallback((childId: string, parentTaskId: string) => {
    setPlannedTasks((prev) => {
      const parent = prev.find((t) => t.id === parentTaskId);
      if (!parent) return prev;
      return prev.map((task) => {
        if (task.id === childId) {
          return {
            ...task,
            parentId: parentTaskId,
            weeklyGoalId: parent.weeklyGoalId,
            status: task.status === 'done' ? 'done' : 'committed',
            lastCommittedDate: planningDate,
          };
        }
        if (
          task.id === parentTaskId &&
          task.status !== 'committed' &&
          task.status !== 'scheduled' &&
          task.status !== 'done'
        ) {
          return { ...task, status: 'committed', lastCommittedDate: planningDate };
        }
        return task;
      });
    });

    setDailyPlanForDate(planningDate, (prev) => {
      let ids = prev.committedTaskIds;
      if (!ids.includes(childId)) ids = [...ids, childId];
      if (!ids.includes(parentTaskId)) ids = [...ids, parentTaskId];
      return { ...prev, committedTaskIds: ids };
    });

    setSelectedInboxId(null);
    setLastCommitTimestamp(Date.now());
  }, [planningDate, setDailyPlanForDate, setLastCommitTimestamp, setPlannedTasks, setSelectedInboxId]);

  const unnestTask = useCallback((childId: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === childId ? { ...task, parentId: undefined } : task
      )
    );
  }, [setPlannedTasks]);

  const bringForward = useCallback((taskId: string, goalId?: string, targetDate?: string) => {
    const commitDate = targetDate || planningDate;

    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              weeklyGoalId: goalId ?? task.weeklyGoalId ?? weeklyGoals[0]?.id ?? null,
              status: task.status === 'done' ? 'done' : 'committed',
              lastCommittedDate: commitDate,
            }
          : task
      )
    );

    setDailyPlanForDate(commitDate, (prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.includes(taskId)
        ? prev.committedTaskIds
        : [...prev.committedTaskIds, taskId],
    }));

    setSelectedInboxId(null);
    setLastCommitTimestamp(Date.now());
  }, [planningDate, setDailyPlanForDate, setLastCommitTimestamp, setPlannedTasks, setSelectedInboxId, weeklyGoals]);

  const addLocalTask = useCallback((title: string, goalId?: string, targetDate?: string): string => {
    if (!title.trim()) return '';

    const nextId = `local-${crypto.randomUUID()}`;
    const targetGoal = goalId || weeklyGoals[0]?.id || null;
    const commitDate = targetDate || planningDate;
    const task: PlannedTask = {
      id: nextId,
      title: title.trim(),
      source: 'local',
      weeklyGoalId: targetGoal,
      status: 'committed',
      estimateMins: 45,
      active: false,
      lastCommittedDate: commitDate,
    };

    setPlannedTasks((prev) => [...prev, task]);
    setDailyPlanForDate(commitDate, (prev) => ({ ...prev, committedTaskIds: [...prev.committedTaskIds, nextId] }));
    return nextId;
  }, [planningDate, setDailyPlanForDate, setPlannedTasks, weeklyGoals]);

  const addInboxTask = useCallback((title: string): string => {
    if (!title.trim()) return '';

    const nextId = `local-${crypto.randomUUID()}`;
    const task: PlannedTask = {
      id: nextId,
      title: title.trim(),
      source: 'local',
      weeklyGoalId: null,
      status: 'candidate',
      estimateMins: 45,
      active: false,
    };

    setPlannedTasks((prev) => [task, ...prev]);
    return nextId;
  }, [setPlannedTasks]);

  const assignTaskToGoal = useCallback((taskId: string, goalId: string | null) => {
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              weeklyGoalId: goalId,
              lastCommittedDate: planningDate,
            }
          : task
      )
    );
  }, [planningDate, setPlannedTasks]);

  const detachTask = useCallback(async (taskId: string, targetStatus: 'migrated' | 'cancelled') => {
    await removeLinkedScheduleBlock(taskId);

    setPlannedTasks((prev) =>
      prev.map((task) => {
        if (task.id === taskId) {
          return { ...task, status: targetStatus, active: false, scheduledEventId: undefined, scheduledCalendarId: undefined };
        }
        if (task.parentId === taskId) {
          return { ...task, parentId: undefined };
        }
        return task;
      })
    );

    setDailyPlanForDate(planningDate, (prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.filter((id) => id !== taskId),
    }));
  }, [planningDate, removeLinkedScheduleBlock, setDailyPlanForDate, setPlannedTasks]);

  const moveForward = useCallback((taskId: string) => detachTask(taskId, 'migrated'), [detachTask]);
  const releaseTask = useCallback((taskId: string) => detachTask(taskId, 'cancelled'), [detachTask]);
  const returnTaskToInbox = useCallback(async (taskId: string) => {
    await removeLinkedScheduleBlock(taskId);

    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: 'candidate',
              active: false,
              scheduledEventId: undefined,
              scheduledCalendarId: undefined,
            }
          : task
      )
    );

    setDailyPlanForDate(planningDate, (prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.filter((id) => id !== taskId),
    }));
  }, [planningDate, removeLinkedScheduleBlock, setDailyPlanForDate, setPlannedTasks]);

  const toggleTask = useCallback(async (id: string) => {
    const linkedBlock = scheduleBlocks.find((block) => block.linkedTaskId === id);
    const task = plannedTasks.find((t) => t.id === id);
    const nextDone = task?.status !== 'done';

    if (nextDone && linkedBlock) {
      if (linkedBlock.eventId) {
        try {
          const result = await withTimeout(window.api.gcal.deleteEvent(linkedBlock.eventId, linkedBlock.calendarId), 'gcal.deleteEvent');
          if (!result.success) {
            console.warn('Failed to delete linked calendar event on completion:', result.error);
          }
        } catch (err) {
          console.warn('Failed to delete linked calendar event on completion:', err);
        }
      }

      setScheduleBlocks((prev) => prev.filter((block) => block.id !== linkedBlock.id));
    }

    setPlannedTasks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return {
          ...t,
          status: nextDone ? 'done' : linkedBlock ? 'scheduled' : 'committed',
          active: false,
          scheduledEventId: nextDone ? undefined : t.scheduledEventId,
          scheduledCalendarId: nextDone ? undefined : t.scheduledCalendarId,
        };
      })
    );

    // Sync completion to Asana for Asana-sourced tasks
    if (task?.source === 'asana' && task.sourceId) {
      window.api.asana.completeTask(task.sourceId, nextDone).catch((err) => {
        console.warn('Failed to sync task completion to Asana:', err);
      });
    }
  }, [plannedTasks, scheduleBlocks, setPlannedTasks]);

  const setActiveTask = useCallback((id: string) => {
    setPlannedTasks((prev) =>
      prev.map((task) => ({
        ...task,
        active: task.id === id,
      }))
    );
  }, [setPlannedTasks]);

  const updateTaskEstimate = useCallback((id: string, mins: number) => {
    setPlannedTasks((prev) =>
      prev.map((t) => t.id === id ? { ...t, estimateMins: Math.max(15, Math.min(480, mins)) } : t)
    );
  }, [setPlannedTasks]);

  return {
    migrateOldTasks,
    dropTask,
    nestTask,
    unnestTask,
    bringForward,
    addLocalTask,
    addInboxTask,
    assignTaskToGoal,
    moveForward,
    releaseTask,
    returnTaskToInbox,
    toggleTask,
    setActiveTask,
    updateTaskEstimate,
  };
}
