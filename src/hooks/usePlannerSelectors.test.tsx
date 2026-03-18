// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { usePlannerSelectors } from './usePlannerSelectors';
import type { DailyPlan, PlannedTask, ScheduleBlock } from '@/types';

const plannedTasks: PlannedTask[] = [
  {
    id: 'task-1',
    title: 'Write draft',
    source: 'local',
    weeklyGoalId: 'goal-1',
    status: 'scheduled',
    estimateMins: 60,
    active: false,
  },
  {
    id: 'task-2',
    title: 'Revise outline',
    source: 'local',
    weeklyGoalId: 'goal-1',
    status: 'scheduled',
    estimateMins: 60,
    active: false,
  },
];

const scheduleBlocks: ScheduleBlock[] = [
  {
    id: 'block-1',
    title: 'Write draft',
    startHour: 9,
    startMin: 0,
    durationMins: 60,
    kind: 'focus',
    readOnly: false,
    linkedTaskId: 'task-1',
    source: 'local',
  },
  {
    id: 'block-2',
    title: 'Revise outline',
    startHour: 10,
    startMin: 0,
    durationMins: 60,
    kind: 'focus',
    readOnly: false,
    linkedTaskId: 'task-2',
    source: 'local',
  },
];

const dailyPlan: DailyPlan = {
  date: '2026-03-12',
  committedTaskIds: ['task-1', 'task-2'],
};

describe('usePlannerSelectors', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('updates current and next focus blocks as time advances', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T09:15:00'));

    const { result } = renderHook(() => usePlannerSelectors({
      plannedTasks,
      scheduleBlocks,
      dailyPlan,
    }));

    expect(result.current.currentBlock?.id).toBe('block-1');
    expect(result.current.nextBlock?.id).toBe('block-2');

    act(() => {
      vi.advanceTimersByTime(45 * 60 * 1000);
    });

    expect(result.current.currentBlock?.id).toBe('block-2');
    expect(result.current.nextBlock).toBeNull();
  });

  it('skips completed scheduled blocks when computing current and next focus', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T09:15:00'));

    const doneTasks: PlannedTask[] = [
      { ...plannedTasks[0], status: 'done' },
      plannedTasks[1],
    ];

    const { result } = renderHook(() => usePlannerSelectors({
      plannedTasks: doneTasks,
      scheduleBlocks,
      dailyPlan,
    }));

    expect(result.current.currentBlock).toBeNull();
    expect(result.current.nextBlock?.id).toBe('block-2');
  });

  it('keeps completed tasks visible in the day plan', () => {
    const doneTasks: PlannedTask[] = [
      { ...plannedTasks[0], status: 'done' },
      plannedTasks[1],
    ];

    const { result } = renderHook(() => usePlannerSelectors({
      plannedTasks: doneTasks,
      scheduleBlocks,
      dailyPlan,
    }));

    expect(result.current.dayTasks.map((task) => task.id)).toEqual(['task-1', 'task-2']);
    expect(result.current.committedTasks.map((task) => task.id)).toEqual([]);
  });
});
