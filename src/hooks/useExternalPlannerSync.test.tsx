// @vitest-environment jsdom

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import type { PlannedTask, ScheduleBlock } from '@/types';
import { useExternalPlannerSync } from './useExternalPlannerSync';
import { installMockApi } from '../test/mockApi';

function useHarness(calendarId = 'primary') {
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([
    {
      id: 'task-1',
      title: 'Write draft',
      source: 'asana',
      sourceId: 'asana-1',
      weeklyGoalId: null,
      status: 'scheduled',
      estimateMins: 60,
      active: false,
      scheduledEventId: 'event-1',
      scheduledCalendarId: calendarId,
    },
  ]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([
    {
      id: 'event-1',
      title: 'Write draft',
      startHour: 9,
      startMin: 0,
      durationMins: 60,
      kind: 'focus',
      readOnly: false,
      linkedTaskId: 'task-1',
      linkedGoalId: 'goal-1',
      eventId: 'event-1',
      calendarId,
      source: 'gcal',
    },
  ]);
  const [syncStatus, setSyncStatus] = useState<{ asana: string | null; gcal: string | null; loading: boolean }>({
    asana: null,
    gcal: null,
    loading: false,
  });

  const sync = useExternalPlannerSync({
    setPlannedTasks,
    setScheduleBlocks,
    setSyncStatus,
    rituals: [],
    workdayStart: { hour: 9, min: 0 },
    viewDate: '2026-03-24',
  });

  return {
    ...sync,
    plannedTasks,
    scheduleBlocks,
    syncStatus,
  };
}

describe('useExternalPlannerSync', () => {
  beforeEach(() => {
    const api = installMockApi();
    (api.asana.getTasks as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        {
          gid: 'asana-1',
          name: 'Write draft',
          completed: false,
          due_on: null,
          projects: [],
          tags: [],
          notes: '',
          custom_fields: [],
        },
      ],
    });
    (api.gcal.getEvents as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'event-1',
          summary: 'Write draft',
          start: { dateTime: '2026-03-24T09:00:00' },
          end: { dateTime: '2026-03-24T10:00:00' },
          description: '[Inked]\ntask-1',
          calendarId: 'primary',
        },
      ],
    });
  });

  it('preserves an existing block goal link when refreshed task data has no weeklyGoalId', async () => {
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.refreshExternalData();
    });

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toHaveLength(1);
      expect(result.current.scheduleBlocks[0]).toMatchObject({
        id: 'event-1',
        linkedTaskId: 'task-1',
        linkedGoalId: 'goal-1',
      });
    });
  });

  it('preserves synced focus blocks from a missing read calendar during refresh', async () => {
    const api = installMockApi();
    (api.asana.getTasks as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [
        {
          gid: 'asana-1',
          name: 'Write draft',
          completed: false,
          due_on: null,
          projects: [],
          tags: [],
          notes: '',
          custom_fields: [],
        },
      ],
    });
    (api.gcal.getEvents as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: [],
    });

    const { result } = renderHook(() => useHarness('work'));

    await act(async () => {
      await result.current.refreshExternalData();
    });

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toHaveLength(1);
      expect(result.current.scheduleBlocks[0]).toMatchObject({
        id: 'event-1',
        linkedTaskId: 'task-1',
        calendarId: 'work',
      });
    });
  });
});
