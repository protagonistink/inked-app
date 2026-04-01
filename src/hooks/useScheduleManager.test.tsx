// @vitest-environment jsdom

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { useScheduleManager } from './useScheduleManager';
import type { DailyPlan, PlannedTask, ScheduleBlock } from '@/types';
import { installMockApi } from '../test/mockApi';

function useHarness() {
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([
    {
      id: 'task-1',
      title: 'Write draft',
      source: 'local',
      weeklyGoalId: 'goal-1',
      status: 'candidate',
      estimateMins: 60,
      active: false,
    },
    {
      id: 'task-2',
      title: 'Protect unrelated task',
      source: 'local',
      weeklyGoalId: 'goal-1',
      status: 'candidate',
      estimateMins: 45,
      active: false,
    },
  ]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan>({
    date: '2026-03-12',
    committedTaskIds: [],
  });

  const schedule = useScheduleManager({
    plannedTasks,
    scheduleBlocks,
    dailyPlan,
    planningDate: '2026-03-12',
    setPlannedTasks,
    setScheduleBlocks,
    setDailyPlanForDate: (_date, value) => {
      setDailyPlan((prev) => typeof value === 'function' ? value(prev) : value);
    },
    bringForward: (taskId: string) => {
      setPlannedTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? { ...task, status: 'committed', lastCommittedDate: '2026-03-12' }
            : task
        )
      );
      setDailyPlan((prev) => ({
        ...prev,
        committedTaskIds: prev.committedTaskIds.includes(taskId)
          ? prev.committedTaskIds
          : [...prev.committedTaskIds, taskId],
      }));
    },
  });

  return {
    ...schedule,
    plannedTasks,
    scheduleBlocks,
    dailyPlan,
    promoteTask2() {
      setPlannedTasks((prev) =>
        prev.map((task) =>
          task.id === 'task-2' ? { ...task, status: 'committed' } : task
        )
      );
    },
  };
}

describe('useScheduleManager', () => {
  beforeEach(() => {
    const api = installMockApi();
    (api.gcal.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue({ success: false, error: 'Calendar exploded' });
  });

  it('rolls back optimistic state when calendar creation fails', async () => {
    const { result } = renderHook(() => useHarness());

    await expect(
      act(async () => {
        await result.current.scheduleTaskBlock('task-1', 9, 0, 60);
      })
    ).rejects.toThrow('Calendar exploded');

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toEqual([]);
      expect(result.current.dailyPlan.committedTaskIds).toEqual([]);
      expect(result.current.plannedTasks[0].status).toBe('candidate');
      expect(result.current.plannedTasks[0]).not.toHaveProperty('scheduledEventId');
      expect(result.current.plannedTasks[0]).not.toHaveProperty('scheduledCalendarId');
    });
  });

  it('does not wipe unrelated task changes when calendar creation fails', async () => {
    let rejectCreate:
      | ((value: { success: false; error: string }) => void)
      | undefined;
    window.api.gcal.createEvent = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          rejectCreate = resolve as (value: { success: false; error: string }) => void;
        })
    );

    const { result } = renderHook(() => useHarness());
    let pendingSchedule: Promise<void> | null = null;

    await act(async () => {
      pendingSchedule = result.current.scheduleTaskBlock('task-1', 9, 0, 60);
    });

    await act(async () => {
      result.current.promoteTask2();
    });

    rejectCreate?.({ success: false, error: 'Calendar exploded' });
    await expect(pendingSchedule).rejects.toThrow('Calendar exploded');

    await waitFor(() => {
      expect(result.current.plannedTasks.find((task) => task.id === 'task-1')).toMatchObject({
        status: 'candidate',
      });
      expect(result.current.plannedTasks.find((task) => task.id === 'task-2')).toMatchObject({
        status: 'committed',
      });
    });
  });
});
