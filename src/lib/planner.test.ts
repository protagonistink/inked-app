import { describe, expect, it } from 'vitest';
import { buildFocusEventPayload, planFocusCascade, snapToCalendarGrid } from './planner';
import type { ScheduleBlock } from '@/types';

describe('buildFocusEventPayload', () => {
  it('rolls the end date into the next day when a block crosses midnight', () => {
    const event = buildFocusEventPayload('Late session', 'task-1', 23, 30, 90, '2026-03-11');

    expect(event.start.dateTime).toBe('2026-03-11T23:30:00');
    expect(event.end.dateTime).toBe('2026-03-12T01:00:00');
  });
});

describe('snapToCalendarGrid', () => {
  it('locks to quarter-hour increments', () => {
    expect(snapToCalendarGrid(548)).toBe(555);
    expect(snapToCalendarGrid(552)).toBe(555);
    expect(snapToCalendarGrid(561)).toBe(555);
  });
});

describe('planFocusCascade', () => {
  it('inserts into the first valid slot and cascades later focus blocks', () => {
    const blocks: ScheduleBlock[] = [
      {
        id: 'focus-1',
        title: 'First',
        startHour: 9,
        startMin: 0,
        durationMins: 60,
        kind: 'focus',
        readOnly: false,
        source: 'gcal',
      },
      {
        id: 'focus-2',
        title: 'Second',
        startHour: 10,
        startMin: 0,
        durationMins: 60,
        kind: 'focus',
        readOnly: false,
        source: 'gcal',
      },
    ];

    const plan = planFocusCascade(9, 30, 60, blocks);

    expect(plan.startHour).toBe(10);
    expect(plan.startMin).toBe(0);
    expect(plan.cascadeUpdates.get('focus-2')).toEqual({ startHour: 11, startMin: 0 });
  });

  it('keeps hard calendar blocks immovable when finding the next slot', () => {
    const blocks: ScheduleBlock[] = [
      {
        id: 'hard-1',
        title: 'Meeting',
        startHour: 10,
        startMin: 0,
        durationMins: 60,
        kind: 'hard',
        readOnly: true,
        source: 'gcal',
      },
      {
        id: 'focus-1',
        title: 'Focus',
        startHour: 11,
        startMin: 0,
        durationMins: 60,
        kind: 'focus',
        readOnly: false,
        source: 'gcal',
      },
    ];

    const plan = planFocusCascade(10, 15, 60, blocks);

    expect(plan.startHour).toBe(11);
    expect(plan.startMin).toBe(0);
    expect(plan.cascadeUpdates.get('focus-1')).toEqual({ startHour: 12, startMin: 0 });
  });
});
