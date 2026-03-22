// @vitest-environment jsdom

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { useTaskActions } from './useTaskActions';
import type { DailyPlan, PlannedTask, ScheduleBlock, WeeklyGoal } from '@/types';

const weeklyGoals: WeeklyGoal[] = [
  { id: 'goal-1', title: 'Client Work', color: 'bg-accent-warm' },
];

function useHarness(options?: { initialTask?: Partial<PlannedTask>; initialDailyPlan?: Partial<DailyPlan> }) {
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([
    {
      id: 'task-1',
      title: 'Write draft',
      source: 'local',
      weeklyGoalId: 'goal-1',
      status: 'scheduled',
      estimateMins: 60,
      active: true,
      scheduledEventId: 'event-1',
      scheduledCalendarId: 'primary',
      ...options?.initialTask,
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
      eventId: 'event-1',
      calendarId: 'primary',
      source: 'gcal',
    },
  ]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan>({
    date: '2026-03-11',
    committedTaskIds: ['task-1'],
    ...options?.initialDailyPlan,
  });
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [lastCommitTimestamp, setLastCommitTimestamp] = useState(0);

  const actions = useTaskActions({
    weeklyGoals,
    plannedTasks,
    scheduleBlocks,
    planningDate: '2026-03-11',
    setPlannedTasks,
    setScheduleBlocks,
    setDailyPlanForDate: (_date, value) => {
      setDailyPlan((prev) => typeof value === 'function' ? value(prev) : value);
    },
    setSelectedInboxId,
    setLastCommitTimestamp,
  });

  return {
    ...actions,
    plannedTasks,
    scheduleBlocks,
    dailyPlan,
    selectedInboxId,
    lastCommitTimestamp,
  };
}

describe('useTaskActions', () => {
  beforeEach(() => {
    (window as unknown as { api: typeof window.api }).api = {
      asana: {
        getTasks: vi.fn(),
        addComment: vi.fn(),
      },
      gcal: {
        getEvents: vi.fn(),
        listCalendars: vi.fn(),
        createEvent: vi.fn(),
        updateEvent: vi.fn(),
        deleteEvent: vi.fn().mockResolvedValue({ success: true }),
        auth: vi.fn(),
      },
      pomodoro: {
        start: vi.fn(),
        pause: vi.fn(),
        stop: vi.fn(),
        skip: vi.fn(),
        onTick: vi.fn(),
      },
      focus: {
        enable: vi.fn(),
        disable: vi.fn(),
      },
      store: {
        get: vi.fn(),
        set: vi.fn(),
      },
      settings: {
        load: vi.fn(),
        save: vi.fn(),
      },
      window: {
        showPomodoro: vi.fn(),
        hidePomodoro: vi.fn(),
        hideCapture: vi.fn(),
        activate: vi.fn(),
        setFocusSize: vi.fn(),
        showMain: vi.fn(),
      },
      ai: {
        chat: vi.fn(),
        streamStart: vi.fn(),
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      physics: {
        get: vi.fn(),
        update: vi.fn(),
        log: vi.fn(),
      },
      shell: {
        openExternal: vi.fn(),
      },
      ink: {
        readContext: vi.fn(),
        writeContext: vi.fn(),
        appendJournal: vi.fn(),
      },
      chat: {
        load: vi.fn().mockResolvedValue([]),
        save: vi.fn().mockResolvedValue(true),
        clear: vi.fn().mockResolvedValue(true),
      },
      capture: {
        save: vi.fn(),
        update: vi.fn(),
        getToday: vi.fn(),
        deleteEntry: vi.fn(),
        onNewEntry: vi.fn(() => vi.fn()),
        onEntryUpdated: vi.fn(() => vi.fn()),
        onEntryDeleted: vi.fn(() => vi.fn()),
      },
      finance: {
        getState: vi.fn().mockResolvedValue(null),
        refresh: vi.fn().mockResolvedValue(null),
        plaidLink: vi.fn().mockResolvedValue({ success: false }),
        plaidExchange: vi.fn().mockResolvedValue({ success: false }),
      },
    };
  });

  it('moveForward removes the linked calendar block before migrating the task', async () => {
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.moveForward('task-1');
    });

    expect(window.api.gcal.deleteEvent).toHaveBeenCalledWith('event-1', 'primary');

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toHaveLength(0);
      expect(result.current.dailyPlan.committedTaskIds).toEqual([]);
      expect(result.current.plannedTasks[0]).toMatchObject({
        status: 'migrated',
        scheduledEventId: undefined,
        scheduledCalendarId: undefined,
        active: false,
      });
    });
  });

  it('toggleTask keeps the linked calendar block when completing a scheduled task', async () => {
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.toggleTask('task-1');
    });

    expect(window.api.gcal.deleteEvent).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toHaveLength(1);
      expect(result.current.plannedTasks[0]).toMatchObject({
        status: 'done',
        active: false,
        scheduledEventId: 'event-1',
        scheduledCalendarId: 'primary',
      });
    });
  });

  it('toggleTask restores scheduled state when reopening a completed scheduled task', async () => {
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.toggleTask('task-1');
      await result.current.toggleTask('task-1');
    });

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toHaveLength(1);
      expect(result.current.plannedTasks[0]).toMatchObject({
        status: 'scheduled',
        active: false,
        scheduledEventId: 'event-1',
        scheduledCalendarId: 'primary',
      });
    });
  });

  it('releaseTask removes the linked calendar block before cancelling the task', async () => {
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.releaseTask('task-1');
    });

    expect(window.api.gcal.deleteEvent).toHaveBeenCalledWith('event-1', 'primary');

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toHaveLength(0);
      expect(result.current.dailyPlan.committedTaskIds).toEqual([]);
      expect(result.current.plannedTasks[0]).toMatchObject({
        status: 'cancelled',
        scheduledEventId: undefined,
        scheduledCalendarId: undefined,
        active: false,
      });
    });
  });

  it('returnTaskToInbox removes the linked calendar block and restores candidate status', async () => {
    const { result } = renderHook(() => useHarness());

    await act(async () => {
      await result.current.returnTaskToInbox('task-1');
    });

    expect(window.api.gcal.deleteEvent).toHaveBeenCalledWith('event-1', 'primary');

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toHaveLength(0);
      expect(result.current.dailyPlan.committedTaskIds).toEqual([]);
      expect(result.current.plannedTasks[0]).toMatchObject({
        status: 'candidate',
        scheduledEventId: undefined,
        scheduledCalendarId: undefined,
        active: false,
      });
    });
  });

  it('does not mutate local task state when calendar deletion fails', async () => {
    window.api.gcal.deleteEvent = vi.fn().mockResolvedValue({ success: false, error: 'Calendar exploded' });
    const { result } = renderHook(() => useHarness());

    await expect(
      act(async () => {
        await result.current.moveForward('task-1');
      })
    ).rejects.toThrow('Calendar exploded');

    expect(result.current.scheduleBlocks).toHaveLength(1);
    expect(result.current.dailyPlan.committedTaskIds).toEqual(['task-1']);
    expect(result.current.plannedTasks[0]).toMatchObject({
      status: 'scheduled',
      scheduledEventId: 'event-1',
      scheduledCalendarId: 'primary',
      active: true,
    });
  });

  it('migrateOldTasks clears stale schedule blocks and scheduling metadata', async () => {
    const { result } = renderHook(() => useHarness({
      initialTask: { lastCommittedDate: '2026-03-01' },
      initialDailyPlan: { date: '2026-03-17' },
    }));

    await act(async () => {
      result.current.migrateOldTasks();
    });

    await waitFor(() => {
      expect(result.current.scheduleBlocks).toHaveLength(0);
      expect(result.current.dailyPlan.committedTaskIds).toEqual([]);
      expect(result.current.plannedTasks[0]).toMatchObject({
        status: 'candidate',
        scheduledEventId: undefined,
        scheduledCalendarId: undefined,
        active: false,
      });
    });
  });
});
