import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { AsanaTask, GCalEvent, PlannedTask, ScheduleBlock } from '@/types';
import { asPlannedTask, eventToBlock, isDueSoon, TODAY } from '@/lib/planner';

interface SyncStatus {
  asana: string | null;
  gcal: string | null;
  loading: boolean;
}

interface ExternalPlannerSyncOptions {
  setPlannedTasks: Dispatch<SetStateAction<PlannedTask[]>>;
  setScheduleBlocks: Dispatch<SetStateAction<ScheduleBlock[]>>;
  setSyncStatus: Dispatch<SetStateAction<SyncStatus>>;
}

export function useExternalPlannerSync({
  setPlannedTasks,
  setScheduleBlocks,
  setSyncStatus,
}: ExternalPlannerSyncOptions) {
  const hydrateCalendar = useCallback((events: GCalEvent[], tasks: PlannedTask[]) => {
    const eventBlocks = events
      .map((event) => eventToBlock(event, tasks))
      .filter((block): block is ScheduleBlock => block !== null);

    setScheduleBlocks(eventBlocks.sort((a, b) => (a.startHour * 60 + a.startMin) - (b.startHour * 60 + b.startMin)));
  }, [setScheduleBlocks]);

  const refreshExternalData = useCallback(async () => {
    setSyncStatus({ asana: null, gcal: null, loading: true });

    const [asanaResult, gcalResult] = await Promise.allSettled([
      window.api.asana.getTasks({ daysAhead: 7, limit: 50 }),
      window.api.gcal.getEvents(TODAY),
    ]);

    setPlannedTasks((prev) => {
      let nextTasks = [...prev];

      if (asanaResult.status === 'fulfilled' && asanaResult.value.success && asanaResult.value.data) {
        const asanaTasks = asanaResult.value.data.filter((task: AsanaTask) => !task.completed && isDueSoon(task));

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

      if (gcalResult.status === 'fulfilled' && gcalResult.value.success && gcalResult.value.data) {
        hydrateCalendar(gcalResult.value.data, nextTasks);
      } else if (gcalResult.status === 'fulfilled' && !gcalResult.value.success) {
        setSyncStatus((prevStatus) => ({ ...prevStatus, gcal: gcalResult.value.error || 'Calendar sync failed' }));
      } else if (gcalResult.status === 'rejected') {
        setSyncStatus((prevStatus) => ({ ...prevStatus, gcal: gcalResult.reason instanceof Error ? gcalResult.reason.message : 'Calendar sync failed' }));
      }

      return nextTasks;
    });

    setSyncStatus((prevStatus) => ({ ...prevStatus, loading: false }));
  }, [hydrateCalendar, setPlannedTasks, setSyncStatus]);

  return {
    refreshExternalData,
  };
}
