import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DailyPlan, PlannedTask, ScheduleBlock } from '@/types';
import { buildFocusEventPayload, getToday, planFocusCascade } from '@/lib/planner';

interface ScheduleManagerOptions {
  plannedTasks: PlannedTask[];
  scheduleBlocks: ScheduleBlock[];
  dailyPlan: DailyPlan;
  setPlannedTasks: Dispatch<SetStateAction<PlannedTask[]>>;
  setScheduleBlocks: Dispatch<SetStateAction<ScheduleBlock[]>>;
  setDailyPlan: Dispatch<SetStateAction<DailyPlan>>;
  bringForward: (taskId: string, goalId?: string) => void;
}

export function useScheduleManager({
  plannedTasks,
  scheduleBlocks,
  dailyPlan,
  setPlannedTasks,
  setScheduleBlocks,
  setDailyPlan,
  bringForward,
}: ScheduleManagerOptions) {
  const scheduleTaskBlock = useCallback(async (taskId: string, startHour: number, startMin: number, durationMins = 60) => {
    const task = plannedTasks.find((item) => item.id === taskId);
    if (!task) return;
    const today = getToday();
    const previousPlannedTasks = plannedTasks;
    const previousScheduleBlocks = scheduleBlocks;
    const previousDailyPlan = dailyPlan;

    bringForward(taskId);

    const existingBlock = scheduleBlocks.find((block) => block.linkedTaskId === taskId);
    const cascadePlan = planFocusCascade(startHour, startMin, durationMins, scheduleBlocks, existingBlock?.id);
    const eventPayload = buildFocusEventPayload(
      task.title,
      task.id,
      cascadePlan.startHour,
      cascadePlan.startMin,
      durationMins
    );

    const localBlockId = existingBlock?.id || `local-block-${taskId}`;
    const localBlock: ScheduleBlock = {
      id: localBlockId,
      title: task.title,
      startHour: cascadePlan.startHour,
      startMin: cascadePlan.startMin,
      durationMins,
      kind: 'focus',
      readOnly: false,
      linkedTaskId: taskId,
      source: 'local',
    };

    const movedBlocks = scheduleBlocks
      .filter((block) => cascadePlan.cascadeUpdates.has(block.id))
      .map((block) => {
        const nextSlot = cascadePlan.cascadeUpdates.get(block.id)!;
        return { ...block, ...nextSlot };
      });

    setScheduleBlocks((prev) =>
      [
        ...prev.filter((block) => block.id !== localBlockId && !cascadePlan.cascadeUpdates.has(block.id)),
        ...movedBlocks,
        localBlock,
      ].sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin))
    );

    setPlannedTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? { ...item, status: 'scheduled', lastCommittedDate: today }
          : item
      )
    );

    let eventId = task.scheduledEventId;
    let calendarId = task.scheduledCalendarId || existingBlock?.calendarId;

    try {
      if (eventId) {
        const result = await window.api.gcal.updateEvent(eventId, eventPayload, calendarId);
        if (!result.success) throw new Error(result.error || 'Failed to update calendar event');
      } else {
        const result = await window.api.gcal.createEvent(eventPayload);
        if (!result.success || !result.data) throw new Error(result.error || 'Failed to create calendar event');
        eventId = result.data.id;
        calendarId = result.data.calendarId;
      }

      const gcalBlock: ScheduleBlock = {
        ...localBlock,
        id: eventId!,
        eventId: eventId!,
        calendarId,
        source: 'gcal',
      };

      setScheduleBlocks((prev) =>
        [...prev.filter((block) => block.id !== localBlockId && block.id !== eventId), gcalBlock]
          .sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin))
      );

      setPlannedTasks((prev) =>
        prev.map((item) =>
          item.id === taskId
            ? { ...item, scheduledEventId: eventId, scheduledCalendarId: calendarId }
            : item
        )
      );

      if (movedBlocks.length > 0) {
        await Promise.allSettled(
          movedBlocks
            .filter((block) => block.eventId)
            .map((block) => {
              const movedPayload = buildFocusEventPayload(
                block.title,
                block.linkedTaskId || '',
                block.startHour,
                block.startMin,
                block.durationMins
              );
              return window.api.gcal.updateEvent(block.eventId!, movedPayload, block.calendarId);
            })
        );
      }
    } catch (error) {
      console.error('Failed to sync focus block with calendar:', error);
      setScheduleBlocks(previousScheduleBlocks);
      setPlannedTasks(previousPlannedTasks);
      setDailyPlan(previousDailyPlan);
    }
  }, [bringForward, dailyPlan, plannedTasks, scheduleBlocks, setDailyPlan, setPlannedTasks, setScheduleBlocks]);

  const removeScheduleBlock = useCallback(async (id: string) => {
    const block = scheduleBlocks.find((item) => item.id === id);
    if (!block) return;

    if (!block.readOnly && block.eventId) {
      const result = await window.api.gcal.deleteEvent(block.eventId, block.calendarId);
      if (!result.success) throw new Error(result.error || 'Failed to remove focus block');
    }

    setScheduleBlocks((prev) => prev.filter((item) => item.id !== id));
    if (block.linkedTaskId) {
      setPlannedTasks((prev) =>
        prev.map((task) =>
          task.id === block.linkedTaskId
            ? { ...task, status: 'committed', scheduledEventId: undefined, scheduledCalendarId: undefined }
            : task
        )
      );
    }
  }, [scheduleBlocks, setPlannedTasks, setScheduleBlocks]);

  const unscheduleTaskBlock = useCallback(async (id: string, goalId?: string) => {
    const today = getToday();
    const block = scheduleBlocks.find((item) => item.id === id);
    if (!block || block.readOnly || !block.linkedTaskId) return;

    if (block.eventId) {
      const result = await window.api.gcal.deleteEvent(block.eventId, block.calendarId);
      if (!result.success) throw new Error(result.error || 'Failed to return block to today');
    }

    setScheduleBlocks((prev) => prev.filter((item) => item.id !== id));
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.id === block.linkedTaskId
          ? {
              ...task,
              status: 'committed',
              scheduledEventId: undefined,
              scheduledCalendarId: undefined,
              weeklyGoalId: goalId || task.weeklyGoalId,
              lastCommittedDate: today,
            }
          : task
      )
    );
    setDailyPlan((prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.includes(block.linkedTaskId!)
        ? prev.committedTaskIds
        : [...prev.committedTaskIds, block.linkedTaskId!],
    }));
  }, [scheduleBlocks, setDailyPlan, setPlannedTasks, setScheduleBlocks]);

  const updateScheduleBlock = useCallback(async (blockId: string, startHour: number, startMin: number, durationMins: number) => {
    const block = scheduleBlocks.find((item) => item.id === blockId);
    if (!block || block.readOnly) return;

    // Ritual/break blocks: reposition in place (no GCal sync)
    if (!block.linkedTaskId) {
      setScheduleBlocks((prev) =>
        prev
          .map((b) => b.id === blockId ? { ...b, startHour, startMin, durationMins } : b)
          .sort((a, b) => a.startHour * 60 + a.startMin - (b.startHour * 60 + b.startMin))
      );
      return;
    }

    await scheduleTaskBlock(block.linkedTaskId, startHour, startMin, durationMins);
  }, [scheduleBlocks, scheduleTaskBlock, setScheduleBlocks]);

  const clearFocusBlocks = useCallback(async () => {
    const today = getToday();
    const focusBlocks = scheduleBlocks.filter((block) => !block.readOnly && block.kind === 'focus');
    if (focusBlocks.length === 0) return;

    await Promise.allSettled(
      focusBlocks
        .filter((block) => block.eventId)
        .map((block) => window.api.gcal.deleteEvent(block.eventId!, block.calendarId))
    );

    const linkedTaskIds = new Set(
      focusBlocks
        .map((block) => block.linkedTaskId)
        .filter((taskId): taskId is string => Boolean(taskId))
    );

    setScheduleBlocks((prev) => prev.filter((block) => block.readOnly || block.kind !== 'focus'));
    setPlannedTasks((prev) =>
      prev.map((task) =>
        linkedTaskIds.has(task.id)
          ? {
              ...task,
              status: 'committed',
              scheduledEventId: undefined,
              scheduledCalendarId: undefined,
              lastCommittedDate: today,
            }
          : task
      )
    );
    setDailyPlan((prev) => ({
      ...prev,
      committedTaskIds: Array.from(new Set([...prev.committedTaskIds, ...linkedTaskIds])),
    }));
  }, [scheduleBlocks, setDailyPlan, setPlannedTasks, setScheduleBlocks]);

  return {
    scheduleTaskBlock,
    updateScheduleBlock,
    removeScheduleBlock,
    unscheduleTaskBlock,
    clearFocusBlocks,
  };
}
