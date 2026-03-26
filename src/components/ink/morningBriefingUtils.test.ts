// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBriefingContext, stripStructuredAssistantBlocks, reorderChips } from './morningBriefingUtils';
import type { ScheduleChip } from './morningBriefingUtils';
import { installMockApi } from '../../test/mockApi';

describe('buildBriefingContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T10:00:00'));
    const api = installMockApi();
    (api.asana.getTasks as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: [] });
    (api.gcal.getEvents as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, data: [] });
  });

  it('subtracts scheduled blocks from available focus minutes while preserving gross workday time', async () => {
    const context = await buildBriefingContext({
      weeklyGoals: [],
      committedTasks: [],
      doneTasks: [],
      workdayStart: { hour: 9, min: 0 },
      workdayEnd: { hour: 17, min: 0 },
      planningDate: new Date().toISOString().split('T')[0],
      scheduleBlocks: [
        {
          id: 'block-1',
          title: 'Deep work',
          startHour: 13,
          startMin: 0,
          durationMins: 90,
          kind: 'focus',
          readOnly: false,
          linkedTaskId: 'task-1',
          source: 'local',
        },
      ],
    });

    expect(context.remainingWorkdayMinutes).toBe(420);
    expect(context.availableFocusMinutes).toBe(330);
    expect(context.scheduledMinutes).toBe(90);
  });
});

function makeChip(startHour: number, startMin: number, durationMins: number): ScheduleChip {
  return {
    id: `chip-${startHour}`,
    title: `Task ${startHour}`,
    startHour,
    startMin,
    durationMins,
    matchedTaskId: null,
    matchedGoalId: null,
    selected: true,
  };
}

describe('reorderChips', () => {
  it('returns original array when fromIndex === toIndex', () => {
    const chips = [makeChip(9, 0, 60), makeChip(10, 0, 30)];
    expect(reorderChips(chips, 0, 0)).toBe(chips);
  });

  it('moves chip up and cascades times from new position', () => {
    const chips = [makeChip(9, 0, 60), makeChip(10, 0, 30), makeChip(10, 30, 45)];
    const result = reorderChips(chips, 2, 0);
    // cascadeStart = 0, anchor = 9:00
    // slot 0 (moved chip, 45m): 9:00–9:45
    expect(result[0].startHour).toBe(9);
    expect(result[0].startMin).toBe(0);
    expect(result[0].durationMins).toBe(45);
    // slot 1 (original first, 60m): 9:45–10:45
    expect(result[1].startHour).toBe(9);
    expect(result[1].startMin).toBe(45);
    // slot 2 (original second, 30m): 10:45–11:15
    expect(result[2].startHour).toBe(10);
    expect(result[2].startMin).toBe(45);
  });

  it('moves chip down and cascades times from earlier position', () => {
    const chips = [makeChip(9, 0, 60), makeChip(10, 0, 30), makeChip(10, 30, 45)];
    const result = reorderChips(chips, 0, 2);
    // cascadeStart = 0, anchor = 9:00
    expect(result[0].startHour).toBe(9);
    expect(result[0].startMin).toBe(0);
    expect(result[0].durationMins).toBe(30);
    expect(result[1].startHour).toBe(9);
    expect(result[1].startMin).toBe(30);
    expect(result[2].startHour).toBe(10);
    expect(result[2].startMin).toBe(15);
  });

  it('leaves chips above cascadeStart unchanged', () => {
    const chips = [makeChip(8, 0, 30), makeChip(9, 0, 60), makeChip(10, 0, 30)];
    const result = reorderChips(chips, 2, 1);
    expect(result[0].startHour).toBe(8);
    expect(result[0].startMin).toBe(0);
  });

  it('clamps times that would exceed 23:59', () => {
    const chips = [makeChip(23, 30, 45), makeChip(23, 45, 60)];
    const result = reorderChips(chips, 1, 0);
    result.forEach(chip => {
      expect(chip.startHour).toBeLessThanOrEqual(23);
      expect(chip.startMin).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('stripStructuredAssistantBlocks', () => {
  it('removes schedule code blocks and ritual directives from visible assistant copy', () => {
    const content = [
      'Here is the plan.',
      '',
      '```schedule',
      '[{"title":"Write draft","startHour":9,"startMin":0,"durationMins":60}]',
      '```',
      '',
      '[RITUAL] LinkedIn post',
      '',
      'Keep the morning clean.',
    ].join('\n');

    expect(stripStructuredAssistantBlocks(content)).toBe('Here is the plan.\n\nKeep the morning clean.');
  });
});
