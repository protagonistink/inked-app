// @vitest-environment jsdom

import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { format } from 'date-fns';
import { useMonthlyPlanning } from './useMonthlyPlanning';

describe('useMonthlyPlanning', () => {
  beforeEach(() => {
    (window as unknown as { api: typeof window.api }).api = {
      asana: {
        getTasks: vi.fn(),
        addComment: vi.fn(),
        completeTask: vi.fn(),
      },
      gcal: {
        getEvents: vi.fn(),
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
        get: vi.fn().mockResolvedValue(null),
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
        getState: vi.fn(),
        refresh: vi.fn(),
        plaidLink: vi.fn(),
        plaidExchange: vi.fn(),
      },
    };
  });

  it('shows prompt when initialPromptState is true, hides when plan is completed', async () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const { result } = renderHook(() =>
      useMonthlyPlanning({
        initialMonthlyPlan: null,
        initialPromptState: true,
      })
    );

    await waitFor(() => {
      expect(result.current.monthlyPlanPrompt).toBe(true);
    });

    act(() => {
      result.current.setMonthlyPlan({
        month: currentMonth,
        reflection: 'Some reflection',
        oneThing: 'Ship the thing',
        why: 'Because it matters',
      });
    });

    await waitFor(() => {
      expect(result.current.monthlyPlan).toMatchObject({
        month: currentMonth,
        oneThing: 'Ship the thing',
      });
      expect(result.current.monthlyPlanPrompt).toBe(false);
    });
  });

  it('does not show prompt when initialPromptState is false', async () => {
    const { result } = renderHook(() =>
      useMonthlyPlanning({
        initialMonthlyPlan: null,
        initialPromptState: false,
      })
    );

    await waitFor(() => {
      expect(result.current.monthlyPlanPrompt).toBe(false);
    });
  });
});
