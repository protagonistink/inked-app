import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DailyPlan, PlannedTask, ScheduleBlock } from '@/types';
import { buildFocusEventPayload, planFocusCascade, TODAY } from '@/lib/planner';

interface ScheduleManagerOptions {
  plannedTasks: PlannedTask[];
  scheduleBlocks: ScheduleBlock[];
  setPlannedTasks: Dispatch<SetStateAction<PlannedTask[]>>;
  setScheduleBlocks: Dispatch<SetStateAction<ScheduleBlock[]>>;
  setDailyPlan: Dispatch<SetStateAction<DailyPlan>>;
  bringForward: (taskId: string, goalId?: string) => void;
}

export function useScheduleManager({
  plannedTasks,
  scheduleBlocks,
  setPlannedTasks,
  setScheduleBlocks,
  setDailyPlan,
  bringForward,
}: ScheduleManagerOptions) {
  const scheduleTaskBlock = useCallback(async (taskId: string, startHour: number, startMin: number, durationMins = 60) => {
    const task = plannedTasks.find((item) => item.id === taskId);
    if (!task) return;

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
          ? { ...item, status: 'scheduled', lastCommittedDate: TODAY }
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
    } catch {
      // Local optimistic state stays in place if calendar sync fails.
    }
  }, [bringForward, plannedTasks, scheduleBlocks, setPlannedTasks, setScheduleBlocks]);

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
              lastCommittedDate: TODAY,
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
    if (!block || block.readOnly || !block.linkedTaskId) return;
    await scheduleTaskBlock(block.linkedTaskId, startHour, startMin, durationMins);
  }, [scheduleBlocks, scheduleTaskBlock]);

  const clearFocusBlocks = useCallback(async () => {
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
              lastCommittedDate: TODAY,
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
