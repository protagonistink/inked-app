// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBriefingContext, stripStructuredAssistantBlocks } from './morningBriefingUtils';

describe('buildBriefingContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T10:00:00'));

    (window as unknown as { api: typeof window.api }).api = {
      asana: {
        getTasks: vi.fn().mockResolvedValue({ success: true, data: [] }),
        addComment: vi.fn(),
        completeTask: vi.fn(),
      },
      gcal: {
        getEvents: vi.fn().mockResolvedValue({ success: true, data: [] }),
        listCalendars: vi.fn(),
        createEvent: vi.fn(),
        updateEvent: vi.fn(),
        deleteEvent: vi.fn(),
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
      finance: {
        getState: vi.fn().mockResolvedValue(null),
        refresh: vi.fn().mockResolvedValue(null),
        plaidLink: vi.fn().mockResolvedValue({ success: false }),
        plaidExchange: vi.fn().mockResolvedValue({ success: false }),
      },
    };
  });

  it('reports total remaining minutes before subtracting scheduled blocks', async () => {
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

    expect(context.availableFocusMinutes).toBe(420);
    expect(context.scheduledMinutes).toBe(90);
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
