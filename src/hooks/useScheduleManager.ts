import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DailyPlan, PlannedTask, ScheduleBlock } from '@/types';
import { buildFocusEventPayload, planFocusCascade, sortBlocksByStart } from '@/lib/planner';
import { withTimeout } from '@/lib/ipc';

interface ScheduleManagerOptions {
  plannedTasks: PlannedTask[];
  scheduleBlocks: ScheduleBlock[];
  dailyPlan: DailyPlan;
  planningDate: string;
  setPlannedTasks: Dispatch<SetStateAction<PlannedTask[]>>;
  setScheduleBlocks: Dispatch<SetStateAction<ScheduleBlock[]>>;
  setDailyPlanForDate: (date: string, value: DailyPlan | ((current: DailyPlan) => DailyPlan)) => void;
  bringForward: (taskId: string, goalId?: string, targetDate?: string) => void;
}

export function useScheduleManager({
  plannedTasks,
  scheduleBlocks,
  dailyPlan,
  planningDate,
  setPlannedTasks,
  setScheduleBlocks,
  setDailyPlanForDate,
  bringForward,
}: ScheduleManagerOptions) {
  const scheduleTaskBlock = useCallback(async (taskId: string, startHour: number, startMin: number, durationMins = 60, taskTitle?: string, targetDate?: string) => {
    const task = plannedTasks.find((item) => item.id === taskId);
    const title = task?.title || taskTitle;
    if (!title) return;
    const commitDate = targetDate || planningDate;
    const previousTask = task ? { ...task } : null;
    const previousCommittedTaskIds = dailyPlan.committedTaskIds;

    // Only bringForward if task exists in state (skip for just-created tasks)
    if (task) bringForward(taskId, undefined, commitDate);

    // Mark day as having committed blocks (sticky — survives block removal)
    setDailyPlanForDate(commitDate, (prev) => prev.hasEverCommitted ? prev : { ...prev, hasEverCommitted: true });

    const existingBlock = scheduleBlocks.find((block) => block.linkedTaskId === taskId);
    const previousExistingBlock = existingBlock ? { ...existingBlock } : null;

    // Find ritual block with matching title to replace (prevents duplicate blocks)
    const normalizedTitle = title.toLowerCase().replace(/\s+/g, ' ').trim();
    const matchingRitualBlock = !existingBlock
      ? scheduleBlocks.find((block) =>
          block.id.startsWith('ritual-') &&
          block.title.toLowerCase().replace(/\s+/g, ' ').trim() === normalizedTitle
        )
      : null;

    const cascadePlan = planFocusCascade(startHour, startMin, durationMins, scheduleBlocks, existingBlock?.id);
    const eventPayload = buildFocusEventPayload(
      title,
      taskId,
      cascadePlan.startHour,
      cascadePlan.startMin,
      durationMins,
      commitDate
    );

    const localBlockId = existingBlock?.id || `local-block-${taskId}`;
    const localBlock: ScheduleBlock = {
      id: localBlockId,
      title,
      startHour: cascadePlan.startHour,
      startMin: cascadePlan.startMin,
      durationMins,
      kind: 'focus',
      readOnly: false,
      linkedTaskId: taskId,
      linkedGoalId: task?.weeklyGoalId ?? null,
      source: 'local',
    };

    const movedBlocks = scheduleBlocks
      .filter((block) => cascadePlan.cascadeUpdates.has(block.id))
      .map((block) => {
        const nextSlot = cascadePlan.cascadeUpdates.get(block.id)!;
        return { ...block, ...nextSlot };
      });
    const previousMovedBlocks = scheduleBlocks
      .filter((block) => cascadePlan.cascadeUpdates.has(block.id))
      .map((block) => ({ ...block }));

    setScheduleBlocks((prev) =>
      [
        ...prev.filter((block) =>
          block.id !== localBlockId &&
          !cascadePlan.cascadeUpdates.has(block.id) &&
          block.id !== matchingRitualBlock?.id
        ),
        ...movedBlocks,
        localBlock,
      ].sort(sortBlocksByStart)
    );

    setPlannedTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? { ...item, status: 'scheduled', lastCommittedDate: commitDate }
          : item
      )
    );

    let eventId = task?.scheduledEventId;
    let calendarId = task?.scheduledCalendarId || existingBlock?.calendarId;

    try {
      if (eventId) {
        const result = await withTimeout(window.api.gcal.updateEvent(eventId, eventPayload, calendarId), 'gcal.updateEvent');
        if (!result.success) throw new Error(result.error || 'Failed to update calendar event');
      } else {
        const result = await withTimeout(window.api.gcal.createEvent(eventPayload), 'gcal.createEvent');
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
          .sort(sortBlocksByStart)
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
                block.durationMins,
                commitDate
              );
              return withTimeout(window.api.gcal.updateEvent(block.eventId!, movedPayload, block.calendarId), 'gcal.updateEvent');
            })
        );
      }
    } catch (error) {
      console.error('Failed to sync focus block with calendar:', error);
      setScheduleBlocks((prev) => {
        const restoredBlocks = new Map<string, ScheduleBlock>();
        if (previousExistingBlock) restoredBlocks.set(previousExistingBlock.id, previousExistingBlock);
        previousMovedBlocks.forEach((block) => restoredBlocks.set(block.id, block));

        const idsToRemove = new Set<string>([localBlockId]);
        if (eventId) idsToRemove.add(eventId);

        const next = prev.filter((block) => !idsToRemove.has(block.id) && !restoredBlocks.has(block.id));
        return [...next, ...restoredBlocks.values()].sort(sortBlocksByStart);
      });
      if (previousTask) {
        setPlannedTasks((prev) =>
          prev.map((item) => (item.id === taskId ? previousTask : item))
        );
      }
      setDailyPlanForDate(commitDate, (prev) => ({ ...prev, committedTaskIds: previousCommittedTaskIds }));
      throw error instanceof Error ? error : new Error('Failed to sync focus block with calendar');
    }
  }, [bringForward, dailyPlan, plannedTasks, planningDate, scheduleBlocks, setDailyPlanForDate, setPlannedTasks, setScheduleBlocks]);

  const removeScheduleBlock = useCallback(async (id: string) => {
    const block = scheduleBlocks.find((item) => item.id === id);
    if (!block) return;

    const nestedIds = block.nestedTaskIds ?? [];
    if (nestedIds.length > 0) {
      setPlannedTasks((prev) =>
        prev.map((task) =>
          nestedIds.includes(task.id)
            ? { ...task, status: 'committed', scheduledEventId: undefined, scheduledCalendarId: undefined }
            : task
        )
      );
    }

    if (!block.readOnly && block.eventId) {
      try {
        const result = await withTimeout(window.api.gcal.deleteEvent(block.eventId, block.calendarId), 'gcal.deleteEvent');
        if (!result.success) console.warn('Failed to delete GCal event on remove:', result.error);
      } catch (err) {
        console.warn('GCal delete error on remove (local state will still be cleaned up):', err);
      }
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

  const nestTaskInBlock = useCallback(async (taskId: string, targetBlockId: string) => {
    const targetBlock = scheduleBlocks.find((b) => b.id === targetBlockId);
    if (!targetBlock) return;

    const ownBlock = scheduleBlocks.find((b) => b.linkedTaskId === taskId);
    if (ownBlock) {
      if (ownBlock.eventId) {
        try {
          await withTimeout(window.api.gcal.deleteEvent(ownBlock.eventId, ownBlock.calendarId), 'gcal.deleteEvent');
        } catch (err) {
          console.warn('Failed to delete GCal event when nesting:', err);
        }
      }
    }

    setScheduleBlocks((prev) =>
      prev
        .filter((b) => b.linkedTaskId !== taskId || b.id === targetBlockId)
        .map((b) =>
          b.id === targetBlockId
            ? { ...b, nestedTaskIds: [...(b.nestedTaskIds ?? []).filter((id) => id !== taskId), taskId] }
            : b
        )
    );

    setPlannedTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: 'committed', scheduledEventId: undefined, scheduledCalendarId: undefined }
          : t
      )
    );
  }, [scheduleBlocks, setPlannedTasks, setScheduleBlocks]);

  const unnestTaskFromBlock = useCallback((taskId: string, blockId: string) => {
    setScheduleBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId
          ? { ...b, nestedTaskIds: (b.nestedTaskIds ?? []).filter((id) => id !== taskId) }
          : b
      )
    );
  }, [setScheduleBlocks]);

  const unscheduleTaskBlock = useCallback(async (id: string, goalId?: string) => {
    const block = scheduleBlocks.find((item) => item.id === id);
    if (!block || block.readOnly || !block.linkedTaskId) return;

    if (block.eventId) {
      try {
        const result = await withTimeout(window.api.gcal.deleteEvent(block.eventId, block.calendarId), 'gcal.deleteEvent');
        if (!result.success) console.warn('Failed to delete GCal event on unschedule:', result.error);
      } catch (err) {
        console.warn('GCal delete error on unschedule (local state will still be cleaned up):', err);
      }
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
              lastCommittedDate: planningDate,
            }
          : task
      )
    );
    setDailyPlanForDate(planningDate, (prev) => ({
      ...prev,
      committedTaskIds: prev.committedTaskIds.includes(block.linkedTaskId!)
        ? prev.committedTaskIds
        : [...prev.committedTaskIds, block.linkedTaskId!],
    }));
  }, [planningDate, scheduleBlocks, setDailyPlanForDate, setPlannedTasks, setScheduleBlocks]);

  const updateScheduleBlock = useCallback(async (blockId: string, startHour: number, startMin: number, durationMins: number) => {
    const block = scheduleBlocks.find((item) => item.id === blockId);
    if (!block || (block.readOnly && block.kind !== 'break')) return;

    // Ritual/break blocks: reposition locally and sync to GCal
    if (!block.linkedTaskId) {
      setScheduleBlocks((prev) =>
        prev
          .map((b) => b.id === blockId ? { ...b, startHour, startMin, durationMins } : b)
          .sort(sortBlocksByStart)
      );

      // Sync ritual block to Google Calendar
      const eventPayload = buildFocusEventPayload(
        block.title,
        blockId,
        startHour,
        startMin,
        durationMins,
        planningDate
      );

      try {
        if (block.eventId) {
          const result = await withTimeout(window.api.gcal.updateEvent(block.eventId, eventPayload, block.calendarId), 'gcal.updateEvent');
          if (!result.success) console.warn('Failed to update ritual GCal event:', result.error);
        } else {
          const result = await withTimeout(window.api.gcal.createEvent(eventPayload), 'gcal.createEvent');
          if (result.success && result.data) {
            setScheduleBlocks((prev) =>
              prev.map((b) => b.id === blockId
                ? { ...b, eventId: result.data!.id, calendarId: result.data!.calendarId, source: 'gcal' }
                : b
              )
            );
          }
        }
      } catch (err) {
        console.warn('GCal sync error for ritual block (local state preserved):', err);
      }
      return;
    }

    await scheduleTaskBlock(block.linkedTaskId, startHour, startMin, durationMins);
  }, [planningDate, scheduleBlocks, scheduleTaskBlock, setScheduleBlocks]);

  // Removes all focus blocks (including manually adjusted ones) — intentional for re-commit workflow
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
              lastCommittedDate: planningDate,
            }
          : task
      )
    );
    setDailyPlanForDate(planningDate, (prev) => ({
      ...prev,
      committedTaskIds: Array.from(new Set([...prev.committedTaskIds, ...linkedTaskIds])),
    }));
  }, [planningDate, scheduleBlocks, setDailyPlanForDate, setPlannedTasks, setScheduleBlocks]);

  const acceptProposal = useCallback(async (blockId: string): Promise<void> => {
    setScheduleBlocks((prev) =>
      prev.map((b) => b.id === blockId ? { ...b, proposal: 'accepted' as const } : b)
    );
  }, [setScheduleBlocks]);

  const addAdHocBlock = useCallback((title: string, startHour: number, startMin: number, durationMins = 60) => {
    const id = `adhoc-${crypto.randomUUID()}`;
    const block: ScheduleBlock = {
      id,
      title,
      startHour,
      startMin,
      durationMins,
      kind: 'hard',
      readOnly: false,
      source: 'local',
    };
    setScheduleBlocks((prev) => [...prev, block].sort(sortBlocksByStart));
    return id;
  }, [setScheduleBlocks]);

  return {
    scheduleTaskBlock,
    updateScheduleBlock,
    removeScheduleBlock,
    nestTaskInBlock,
    unnestTaskFromBlock,
    unscheduleTaskBlock,
    clearFocusBlocks,
    acceptProposal,
    addAdHocBlock,
  };
}
