import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { AsanaTask, DailyRitual, GCalEvent, PlannedTask, ScheduleBlock } from '@/types';
import { asPlannedTask, eventToBlock } from '@/lib/planner';
import { withTimeout } from '@/lib/ipc';
import { flushAsanaQueue } from '@/lib/asanaRetryQueue';

interface SyncStatus {
  asana: string | null;
  gcal: string | null;
  loading: boolean;
}

interface ExternalPlannerSyncOptions {
  setPlannedTasks: Dispatch<SetStateAction<PlannedTask[]>>;
  setScheduleBlocks: Dispatch<SetStateAction<ScheduleBlock[]>>;
  setSyncStatus: Dispatch<SetStateAction<SyncStatus>>;
  rituals: DailyRitual[];
  workdayStart: { hour: number; min: number };
  viewDate: string;
}

export function useExternalPlannerSync({
  setPlannedTasks,
  setScheduleBlocks,
  setSyncStatus,
  rituals,
  workdayStart,
  viewDate,
}: ExternalPlannerSyncOptions) {
  const hydrateCalendar = useCallback((events: GCalEvent[], tasks: PlannedTask[]) => {
    const eventBlocks = events
      .map((event) => eventToBlock(event, tasks))
      .filter((block): block is ScheduleBlock => block !== null);

    setScheduleBlocks((prev) => {
      const fetchedCalendarIds = new Set(
        events
          .map((event) => event.calendarId)
          .filter((calendarId): calendarId is string => Boolean(calendarId))
      );

      // Preserve local metadata from existing blocks across calendar hydration.
      const nestingMap = new Map<string, string[]>();
      const taskByBlockId = new Map<string, string | undefined>();
      const goalByBlockId = new Map<string, string | null>();
      const goalByTaskId = new Map<string, string | null>();
      for (const block of prev) {
        if (block.nestedTaskIds?.length) {
          nestingMap.set(block.id, block.nestedTaskIds);
        }
        taskByBlockId.set(block.id, block.linkedTaskId);
        if (block.linkedGoalId !== undefined) {
          goalByBlockId.set(block.id, block.linkedGoalId);
        }
        if (block.linkedTaskId && block.linkedGoalId !== undefined) {
          goalByTaskId.set(block.linkedTaskId, block.linkedGoalId);
        }
      }

      // Keep local blocks, and preserve previously-synced focus blocks from
      // calendars that were not part of this fetch so they don't vanish due to
      // stale read settings.
      const localBlocks = prev.filter((b) => b.source === 'local');
      const preservedMissingCalendarBlocks = prev.filter((block) => (
        block.source === 'gcal'
        && Boolean(block.linkedTaskId)
        && Boolean(block.calendarId)
        && !fetchedCalendarIds.has(block.calendarId!)
      ));

      // Preserve recently-committed focus blocks that haven't propagated to
      // the GCal API yet (avoids vanishing blocks due to eventual consistency).
      const fetchedEventIds = new Set(eventBlocks.map((b) => b.eventId).filter(Boolean));
      const preservedPendingBlocks = prev.filter((block) => (
        block.source === 'gcal'
        && Boolean(block.linkedTaskId)
        && Boolean(block.eventId)
        && fetchedCalendarIds.has(block.calendarId!)
        && !fetchedEventIds.has(block.eventId)
        // Only preserve if the linked task still references this event
        && tasks.some((t) => t.scheduledEventId === block.eventId)
      ));

      const merged = [...localBlocks, ...preservedMissingCalendarBlocks, ...preservedPendingBlocks, ...eventBlocks];

      // Re-apply nesting, cached goal links, and readOnly status that the
      // fresh task payload failed to provide during this refresh.
      return merged.map((block) => {
        const nested = nestingMap.get(block.id);
        const preservedTaskId = block.linkedTaskId ?? taskByBlockId.get(block.id);
        const preservedGoalId = block.linkedGoalId
          ?? goalByBlockId.get(block.id)
          ?? (preservedTaskId ? goalByTaskId.get(preservedTaskId) : null)
          ?? null;

        // If the block has a linked task, it's a focus block and should be draggable
        const readOnly = preservedTaskId ? false : block.readOnly;

        if (!nested && preservedTaskId === block.linkedTaskId && preservedGoalId === block.linkedGoalId && readOnly === block.readOnly) {
          return block;
        }

        return {
          ...block,
          linkedTaskId: preservedTaskId,
          linkedGoalId: preservedGoalId,
          readOnly,
          ...(nested ? { nestedTaskIds: nested } : {}),
        };
      });
    });
  }, [rituals, setScheduleBlocks, viewDate, workdayStart]);

  const refreshExternalData = useCallback(async () => {
    setSyncStatus({ asana: null, gcal: null, loading: true });

    const [asanaResult, gcalResult] = await Promise.allSettled([
      withTimeout(window.api.asana.getTasks({ daysAhead: 7, limit: 50 }), 'asana.getTasks', 15_000),
      withTimeout(window.api.gcal.getEvents(viewDate), 'gcal.getEvents', 15_000),
    ]);

    // Capture the merged task list from the updater so we can pass it to
    // hydrateCalendar afterwards — avoids calling setScheduleBlocks inside
    // a setPlannedTasks updater function.
    let mergedTasks: PlannedTask[] = [];

    setPlannedTasks((prev) => {
      let nextTasks = [...prev];

      if (asanaResult.status === 'fulfilled' && asanaResult.value.success && asanaResult.value.data) {
        const asanaTasks = asanaResult.value.data.filter((task: AsanaTask) => !task.completed);

        nextTasks = nextTasks.reduce<PlannedTask[]>((acc, task) => {
          if (task.source === 'asana' && task.sourceId && !asanaTasks.some((incoming) => incoming.gid === task.sourceId)) {
            if (task.status === 'candidate') return acc;
          }
          acc.push(task);
          return acc;
        }, []);

        for (const task of asanaTasks) {
          const existing = nextTasks.find((item) => item.sourceId === task.gid);
          if (existing) {
            nextTasks = nextTasks.map((item) => item.id === existing.id ? asPlannedTask(task, existing) : item);
          } else {
            nextTasks.push(asPlannedTask(task));
          }
        }
      } else if (asanaResult.status === 'fulfilled' && !asanaResult.value.success) {
        setSyncStatus((prevStatus) => ({ ...prevStatus, asana: asanaResult.value.error || 'Asana sync failed' }));
      } else if (asanaResult.status === 'rejected') {
        setSyncStatus((prevStatus) => ({ ...prevStatus, asana: asanaResult.reason instanceof Error ? asanaResult.reason.message : 'Asana sync failed' }));
      }

      mergedTasks = nextTasks;
      return nextTasks;
    });

    if (gcalResult.status === 'fulfilled' && gcalResult.value.success && gcalResult.value.data) {
      hydrateCalendar(gcalResult.value.data, mergedTasks);
    } else if (gcalResult.status === 'fulfilled' && !gcalResult.value.success) {
      setSyncStatus((prevStatus) => ({ ...prevStatus, gcal: gcalResult.value.error || 'Calendar sync failed' }));
    } else if (gcalResult.status === 'rejected') {
      setSyncStatus((prevStatus) => ({ ...prevStatus, gcal: gcalResult.reason instanceof Error ? gcalResult.reason.message : 'Calendar sync failed' }));
    }

    setSyncStatus((prevStatus) => ({ ...prevStatus, loading: false }));

    // Opportunistically retry any failed Asana syncs
    void flushAsanaQueue();
  }, [hydrateCalendar, setPlannedTasks, setSyncStatus, viewDate]);

  return {
    refreshExternalData,
  };
}
