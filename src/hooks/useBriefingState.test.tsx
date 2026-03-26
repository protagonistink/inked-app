// @vitest-environment jsdom

import { renderHook, act, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { installMockApi } from '../test/mockApi';

// Mock usePlanner to avoid needing the full AppContext provider
const mockPlanner = {
  weeklyGoals: [],
  replaceWeeklyGoals: vi.fn(),
  markWeeklyPlanningComplete: vi.fn(),
  candidateItems: [],
  committedTasks: [],
  dailyPlan: { date: '2026-03-24', committedTaskIds: [], ritualIds: [] },
  viewDate: new Date('2026-03-24T10:00:00'),
  setViewDate: vi.fn(),
  bringForward: vi.fn(),
  addLocalTask: vi.fn().mockReturnValue('new-task-1'),
  addRitual: vi.fn(),
  workdayStart: { hour: 9, min: 0 },
  workdayEnd: { hour: 18, min: 0 },
  scheduleBlocks: [],
  plannedTasks: [],
  monthlyPlan: null,
  scheduleTaskBlock: vi.fn(),
  clearFocusBlocks: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/context/AppContext', () => ({
  usePlanner: () => mockPlanner,
}));

const mockInkAssistant = {
  activeThreadId: null as string | null,
  setActiveThreadId: vi.fn((threadId: string | null) => {
    mockInkAssistant.activeThreadId = threadId;
  }),
};

vi.mock('@/context/InkAssistantContext', () => ({
  useInkAssistant: () => mockInkAssistant,
}));

// Capture the onAssistantMessage callback so tests can simulate streaming completion.
// Use an object ref so the latest callback is always accessible regardless of render timing.
const streamMock = {
  onAssistantMessage: null as ((content: string) => void) | null,
  streamMessage: vi.fn(),
};

function simulateAssistantMessage(content: string) {
  streamMock.onAssistantMessage?.(content);
}

vi.mock('@/hooks/useBriefingStream', () => ({
  useBriefingStream: ({ onAssistantMessage }: { onAssistantMessage: (content: string) => void }) => {
    streamMock.onAssistantMessage = onAssistantMessage;
    return {
      streamingContent: '',
      isStreaming: false,
      error: null,
      streamMessage: streamMock.streamMessage,
    };
  },
}));

import { useBriefingState } from './useBriefingState';

describe('useBriefingState', () => {
  const onClose = vi.fn();
  const onStreamingChange = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-24T10:00:00')); // Tuesday morning
    installMockApi();
    streamMock.onAssistantMessage = null;
    streamMock.streamMessage.mockClear();
    onClose.mockClear();
    onStreamingChange.mockClear();
    Object.values(mockPlanner).forEach((v) => {
      if (typeof v === 'function' && 'mockClear' in v) (v as ReturnType<typeof vi.fn>).mockClear();
    });
    mockPlanner.plannedTasks = [];
    mockPlanner.candidateItems = [];
    mockPlanner.weeklyGoals = [];
    mockPlanner.dailyPlan = { date: '2026-03-24', committedTaskIds: [], ritualIds: [] };
    mockPlanner.viewDate = new Date('2026-03-24T10:00:00');
    mockInkAssistant.activeThreadId = null;
    mockInkAssistant.setActiveThreadId.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function renderBriefing(overrides: Partial<Parameters<typeof useBriefingState>[0]> = {}) {
    return renderHook(() =>
      useBriefingState({ onClose, onStreamingChange, ...overrides })
    );
  }

  // --- Initial state ---

  it('starts in idle phase with welcome screen visible', () => {
    const { result } = renderBriefing();
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.isWelcomeScreen).toBe(true);
    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.inputValue).toBe('');
  });

  it('sets isOverlay true for overlay variant', () => {
    const { result } = renderBriefing({ variant: 'overlay' });
    expect(result.current.state.isOverlay).toBe(true);
  });

  it('sets isOverlay false for fullscreen variant', () => {
    const { result } = renderBriefing({ variant: 'fullscreen' });
    expect(result.current.state.isOverlay).toBe(false);
  });

  // --- handleStartDay ---

  it('transitions to briefing phase on handleStartDay', async () => {
    const { result } = renderBriefing();

    await act(async () => {
      result.current.actions.handleStartDay('Plan my day');
    });

    expect(result.current.state.phase).toBe('briefing');
    expect(result.current.state.messages).toEqual([
      { role: 'user', content: 'Plan my day' },
    ]);
    expect(streamMock.streamMessage).toHaveBeenCalledWith([
      { role: 'user', content: 'Plan my day' },
    ]);
  });

  // --- sendMessage ---

  it('sends a message and transitions to conversation phase', async () => {
    const { result } = renderBriefing();

    // Set input value first
    act(() => {
      result.current.state.setInputValue('What should I focus on?');
    });

    await act(async () => {
      result.current.actions.sendMessage();
    });

    expect(result.current.state.phase).toBe('conversation');
    expect(result.current.state.inputValue).toBe('');
    expect(result.current.state.messages).toEqual([
      { role: 'user', content: 'What should I focus on?' },
    ]);
  });

  it('does not send empty messages', async () => {
    const { result } = renderBriefing();

    await act(async () => {
      result.current.actions.sendMessage();
    });

    expect(result.current.state.messages).toEqual([]);
    expect(streamMock.streamMessage).not.toHaveBeenCalled();
  });

  it('does not send whitespace-only messages', async () => {
    const { result } = renderBriefing();

    act(() => {
      result.current.state.setInputValue('   ');
    });

    await act(async () => {
      result.current.actions.sendMessage();
    });

    expect(result.current.state.messages).toEqual([]);
    expect(streamMock.streamMessage).not.toHaveBeenCalled();
  });

  // --- onAssistantMessage ---

  it('appends assistant message to messages list', async () => {
    const { result } = renderBriefing();

    // Start a conversation first
    await act(async () => {
      result.current.actions.handleStartDay('Go');
    });

    // Simulate assistant response
    act(() => {
      simulateAssistantMessage('Here is your briefing.');
    });

    expect(result.current.state.messages).toEqual([
      { role: 'user', content: 'Go' },
      { role: 'assistant', content: 'Here is your briefing.' },
    ]);
  });

  // --- openRevision ---

  it('transitions to conversation phase and seeds input', async () => {
    const { result } = renderBriefing();

    // Start in briefing first
    await act(async () => {
      result.current.actions.handleStartDay('Go');
    });

    act(() => {
      result.current.actions.openRevision('Change the schedule');
    });

    expect(result.current.state.phase).toBe('conversation');
    expect(result.current.state.inputValue).toBe('Change the schedule');
  });

  it('openRevision without seed sets empty input', async () => {
    const { result } = renderBriefing();

    await act(async () => {
      result.current.actions.handleStartDay('Go');
    });

    act(() => {
      result.current.actions.openRevision();
    });

    expect(result.current.state.phase).toBe('conversation');
    expect(result.current.state.inputValue).toBe('');
  });

  // --- startNewThread ---

  it('resets message state and creates a new thread', async () => {
    const { result } = renderBriefing();

    // Build up some state
    await act(async () => {
      result.current.actions.handleStartDay('Go');
    });
    act(() => {
      simulateAssistantMessage('Done.');
    });

    expect(result.current.state.messages.length).toBeGreaterThan(0);
    expect(result.current.state.phase).toBe('briefing');

    await act(async () => {
      await result.current.actions.startNewThread();
    });

    expect(result.current.state.messages).toEqual([]);
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.state.inputValue).toBe('');
    expect(window.api.chat.createThread).toHaveBeenCalled();
  });

  // --- Persistence ---

  it('persists messages for fullscreen briefing mode', async () => {
    const { result } = renderBriefing({ mode: 'briefing', variant: 'fullscreen' });

    await act(async () => {
      result.current.actions.handleStartDay('Go');
    });

    // The persistence effect runs after messages update
    expect(window.api.chat.createThread).toHaveBeenCalled();
    expect(window.api.chat.saveThread).toHaveBeenCalledWith(
      'thread-1',
      [{ role: 'user', content: 'Go' }],
    );
  });

  it('creates a fresh thread for chat mode too', async () => {
    const { result } = renderBriefing({ mode: 'chat', variant: 'fullscreen' });

    await act(async () => {
      result.current.actions.handleStartDay('Go');
    });

    // Give effects a chance to run
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(window.api.chat.createThread).toHaveBeenCalled();
    expect(window.api.chat.saveThread).toHaveBeenCalled();
  });

  it('creates a fresh thread for overlay variant without loading old ones', async () => {
    const { result } = renderBriefing({ mode: 'briefing', variant: 'overlay' });

    await act(async () => {
      result.current.actions.handleStartDay('Go');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(window.api.chat.loadThread).not.toHaveBeenCalled();
    expect(window.api.chat.createThread).toHaveBeenCalled();
  });

  // --- promptInkMode ---

  it('resolves promptInkMode based on time of day', async () => {
    // 10am on a Tuesday — should be morning
    const { result } = renderBriefing();

    // detectInkMode will return 'morning' for 10am on a weekday
    // The resolved mode comes from ink.readContext, but promptInkMode
    // falls back to detectInkMode() when resolvedInkMode is null at first
    expect(result.current.state.promptInkMode).toBe('morning');
  });

  // --- Attachments delegation ---

  it('exposes attachment state from useAttachments', () => {
    const { result } = renderBriefing();
    expect(result.current.state.attachments).toEqual([]);
    expect(result.current.state.isDraggingFiles).toBe(false);
  });

  it('setDraggingFiles updates state', () => {
    const { result } = renderBriefing();

    act(() => {
      result.current.actions.setDraggingFiles(true);
    });

    expect(result.current.state.isDraggingFiles).toBe(true);
  });

  // --- handleKeyDown ---

  it('sends message on Enter key', async () => {
    const { result } = renderBriefing();

    act(() => {
      result.current.state.setInputValue('Hello');
    });

    const event = {
      key: 'Enter',
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    await act(async () => {
      result.current.actions.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.state.messages).toEqual([
      { role: 'user', content: 'Hello' },
    ]);
  });

  it('does not send message on Shift+Enter', () => {
    const { result } = renderBriefing();

    act(() => {
      result.current.state.setInputValue('Hello');
    });

    const event = {
      key: 'Enter',
      shiftKey: true,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.actions.handleKeyDown(event);
    });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(result.current.state.messages).toEqual([]);
  });

  // --- Multi-message conversation ---

  it('accumulates user and assistant messages in sequence', async () => {
    const { result, unmount } = renderBriefing();

    // Ensure we have a fresh callback
    expect(streamMock.onAssistantMessage).not.toBeNull();

    // User sends first message
    await act(async () => {
      result.current.actions.handleStartDay('Plan my day');
    });

    expect(result.current.state.messages).toHaveLength(1);

    // Simulate assistant response via the captured callback
    act(() => {
      streamMock.onAssistantMessage!('Here is your plan.');
    });

    // Verify both messages are present
    expect(result.current.state.messages).toHaveLength(2);
    expect(result.current.state.messages[0]).toEqual({ role: 'user', content: 'Plan my day' });
    expect(result.current.state.messages[1]).toEqual({ role: 'assistant', content: 'Here is your plan.' });

    unmount();
  });
});
