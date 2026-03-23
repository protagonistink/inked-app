// src/hooks/useBriefingState.ts
import { useState, useEffect, useRef, useCallback, type RefObject, type KeyboardEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { useBriefingStream } from '@/hooks/useBriefingStream';
import { detectInkMode } from '@/lib/ink-mode';
import { stripStructuredAssistantBlocks, buildBriefingContext, inferPlanningDateFromContent, parseCommitChips, parseRitualSuggestions, parseScheduleProposal, type CommitChip, type ScheduleChip } from '@/components/morningBriefingUtils';
import type { ChatMessage } from '@/types/electron';
import type { InkMode } from '@/types';
import type { Phase, BriefingVariant } from '@/types/briefing';

// Private — only used inside onAssistantMessage to detect interview completion
function extractInterviewContext(content: string): Record<string, string> | null {
  const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (typeof parsed !== 'object' || !parsed) return null;
    const fields = ['weeklyContext', 'hierarchy', 'musts', 'currentPriority', 'protectedBlocks', 'tells', 'honestAudit'] as const;
    const result: Record<string, string> = {};
    for (const key of fields) {
      if (parsed[key]) result[key] = String(parsed[key]);
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

export interface BriefingStateValues {
  phase: Phase;
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (v: string) => void;
  commitChips: CommitChip[];
  scheduleChips: ScheduleChip[];
  committed: boolean;
  pendingRituals: string[];
  proposalDate: string;
  proposalLabel: string;
  resolvedInkMode: InkMode | null;
  promptInkMode: InkMode;
  streamingContent: string;
  visibleStreamingContent: string;
  isStreaming: boolean;
  error: string | null;
  isWelcomeScreen: boolean;
  isOverlay: boolean;
  messagesEndRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLTextAreaElement>;
  viewDate: Date;
  addRitual: (title: string) => void;
  skipRitual: (index: number) => void;
}

export interface BriefingActions {
  handleStartDay: (intention: string) => void;
  sendMessage: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  showCommitChips: () => void;
  executeCommit: () => void;
  executeSchedule: () => Promise<void>;
  toggleChip: (index: number) => void;
  toggleScheduleChip: (index: number) => void;
  openRevision: (seed?: string) => void;
}

export function useBriefingState({
  onClose,
  onStreamingChange,
  mode = 'briefing',
  variant = 'fullscreen',
}: {
  onClose: () => void;
  onStreamingChange?: (streaming: boolean) => void;
  mode?: 'briefing' | 'chat';
  variant?: BriefingVariant;
}): { state: BriefingStateValues; actions: BriefingActions } {
  const {
    weeklyGoals,
    candidateItems,
    committedTasks,
    dailyPlan,
    viewDate,
    setViewDate,
    bringForward,
    addLocalTask,
    addRitual,
    workdayStart,
    workdayEnd,
    scheduleBlocks,
    plannedTasks,
    monthlyPlan,
    scheduleTaskBlock,
    clearFocusBlocks,
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [commitChips, setCommitChips] = useState<CommitChip[]>([]);
  const [scheduleChips, setScheduleChips] = useState<ScheduleChip[]>([]);
  const [committed, setCommitted] = useState(false);
  const [pendingRituals, setPendingRituals] = useState<string[]>([]);
  const [proposalDate, setProposalDate] = useState(format(viewDate, 'yyyy-MM-dd'));
  const [resolvedInkMode, setResolvedInkMode] = useState<InkMode | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasStartedBriefingRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('idle');

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Load persisted chat history for today on mount
  useEffect(() => {
    void window.api.chat.load(todayStr).then((stored) => {
      if (stored.length > 0) {
        setMessages(stored);
        setPhase('conversation');
      }
      setHistoryLoaded(true);
    });
  }, [todayStr]);

  // Persist messages whenever they change (debounced by the fact setMessages is batched)
  useEffect(() => {
    if (!historyLoaded || messages.length === 0) return;
    void window.api.chat.save(todayStr, messages);
  }, [messages, todayStr, historyLoaded]);

  useEffect(() => {
    void window.api.ink.readContext().then((ctx) => {
      setResolvedInkMode(detectInkMode(new Date(), ctx.weekUpdatedAt));
    });
  }, []);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (phase === 'idle' || phase === 'briefing' || phase === 'conversation') {
      setProposalDate(format(viewDate, 'yyyy-MM-dd'));
    }
  }, [phase, viewDate]);

  const promptInkMode: InkMode = phase === 'interview'
    ? 'sunday-interview'
    : (resolvedInkMode && resolvedInkMode !== 'sunday-interview' ? resolvedInkMode : detectInkMode());

  const doneTasks = plannedTasks.filter(
    (t) => t.status === 'done' && dailyPlan.committedTaskIds.includes(t.id)
  );

  const buildContext = useCallback(() => buildBriefingContext({
    weeklyGoals,
    committedTasks,
    doneTasks,
    workdayStart,
    workdayEnd,
    scheduleBlocks,
    planningDate: format(viewDate, 'yyyy-MM-dd'),
    monthlyPlan,
    inkMode: promptInkMode,
  }), [weeklyGoals, committedTasks, doneTasks, workdayStart, workdayEnd, scheduleBlocks, viewDate, monthlyPlan, promptInkMode]);

  const {
    streamingContent,
    isStreaming,
    error,
    streamMessage,
  } = useBriefingStream({
    buildContext,
    onAssistantMessage: (content) => {
      setMessages((prev) => [...prev, { role: 'assistant', content }]);

      if (phaseRef.current === 'interview') {
        const contextJson = extractInterviewContext(content);
        if (contextJson) {
          void window.api.ink.writeContext({
            ...contextJson,
            weekUpdatedAt: new Date().toISOString(),
          }).then(() => {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: "Weekly context saved. I've got what I need — see you in the morning." },
            ]);
            setTimeout(() => {
              setResolvedInkMode('morning');
              setMessages([]);
              setPhase('idle');
            }, 2500);
          });
        }
      }

      if (phaseRef.current === 'briefing' || phaseRef.current === 'conversation') {
        const chips = parseScheduleProposal(content, plannedTasks, candidateItems);
        if (chips.length > 0) {
          const currentViewDateKey = format(viewDate, 'yyyy-MM-dd');
          const inferredDate = inferPlanningDateFromContent(content, currentViewDateKey);
          setProposalDate(inferredDate);
          if (inferredDate !== currentViewDateKey) {
            setViewDate(new Date(`${inferredDate}T12:00:00`));
          }
          setScheduleChips(chips);
          setPhase('committing');
        }
      }

      const rituals = parseRitualSuggestions(content);
      if (rituals.length > 0) {
        setPendingRituals(rituals);
      }
    },
  });

  useEffect(() => {
    onStreamingChange?.(isStreaming);
  }, [isStreaming, onStreamingChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    if (mode !== 'briefing' || resolvedInkMode === null || !historyLoaded) return;
    if (hasStartedBriefingRef.current) return;
    // Skip auto-start if we restored a previous conversation
    if (messages.length > 0) {
      hasStartedBriefingRef.current = true;
      return;
    }
    hasStartedBriefingRef.current = true;

    if (resolvedInkMode === 'sunday-interview') {
      setPhase('interview');
      const initialMsg: ChatMessage = { role: 'user', content: 'Start the weekly interview.' };
      setMessages([initialMsg]);
      void streamMessage([initialMsg]);
    }
  }, [streamMessage, mode, resolvedInkMode, historyLoaded, messages.length]);

  const handleStartDay = useCallback((intention: string) => {
    if (isStreaming) return;
    const userMsg: ChatMessage = { role: 'user', content: intention };
    const newMessages = [userMsg];
    setMessages(newMessages);
    setPhase('briefing');
    void streamMessage(newMessages);
  }, [isStreaming, streamMessage]);

  const startConversation = useCallback((prompt: string) => {
    if (!prompt.trim() || isStreaming) return;
    const nextPhase = prompt === 'Run my morning briefing.' ? 'briefing' : 'conversation';
    const userMsg: ChatMessage = { role: 'user', content: prompt.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setPhase(nextPhase);
    void streamMessage(newMessages);
  }, [isStreaming, messages, streamMessage]);

  const openRevision = useCallback((seed = '') => {
    setPhase('conversation');
    setCommitChips([]);
    setScheduleChips([]);
    if (seed) setInputValue(seed);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      if (seed) {
        const length = seed.length;
        inputRef.current?.setSelectionRange(length, length);
      }
    });
  }, []);

  const sendMessage = useCallback(() => {
    if (!inputValue.trim() || isStreaming) return;
    const prompt = inputValue.trim();
    setInputValue('');
    if (phase === 'committing') {
      setCommitChips([]);
      setScheduleChips([]);
    }
    startConversation(prompt);
  }, [inputValue, isStreaming, phase, startConversation]);

  const parseTasksFromMessage = useCallback((content: string): CommitChip[] => {
    return parseCommitChips(content, plannedTasks, candidateItems);
  }, [plannedTasks, candidateItems]);

  const showCommitChips = useCallback(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return;
    const chips = parseTasksFromMessage(lastAssistant.content);
    if (chips.length > 0) {
      const currentViewDateKey = format(viewDate, 'yyyy-MM-dd');
      const inferredDate = inferPlanningDateFromContent(lastAssistant.content, currentViewDateKey);
      setProposalDate(inferredDate);
      if (inferredDate !== currentViewDateKey) {
        setViewDate(new Date(`${inferredDate}T12:00:00`));
      }
      setScheduleChips([]);
      setCommitChips(chips);
      setPhase('committing');
    }
  }, [messages, parseTasksFromMessage, setViewDate, viewDate]);

  const executeCommit = useCallback(() => {
    const toCommit = commitChips.filter((chip) => chip.selected);
    setViewDate(new Date(`${proposalDate}T12:00:00`));
    toCommit.forEach((chip) => {
      if (chip.matchedTaskId) {
        if (!dailyPlan.committedTaskIds.includes(chip.matchedTaskId)) {
          bringForward(chip.matchedTaskId, chip.matchedGoalId || undefined, proposalDate);
        }
      } else {
        addLocalTask(chip.title, chip.matchedGoalId || undefined, proposalDate);
      }
    });
    setCommitted(true);
    closeTimeoutRef.current = window.setTimeout(() => { onClose(); }, 1500);
  }, [addLocalTask, bringForward, commitChips, dailyPlan.committedTaskIds, onClose, proposalDate, setViewDate]);

  const toggleChip = (index: number) => {
    setCommitChips((prev) => prev.map((chip, i) => (i === index ? { ...chip, selected: !chip.selected } : chip)));
  };

  const toggleScheduleChip = (index: number) => {
    setScheduleChips((prev) => prev.map((chip, i) => (i === index ? { ...chip, selected: !chip.selected } : chip)));
  };

  const executeSchedule = useCallback(async () => {
    const toSchedule = scheduleChips.filter((chip) => chip.selected);
    setViewDate(new Date(`${proposalDate}T12:00:00`));
    // Clear existing focus blocks before repopulating with the new plan
    await clearFocusBlocks();
    for (const chip of toSchedule) {
      const taskId = chip.matchedTaskId || addLocalTask(chip.title, chip.matchedGoalId || undefined, proposalDate);
      await scheduleTaskBlock(taskId, chip.startHour, chip.startMin, chip.durationMins, chip.title, proposalDate);
    }
    setCommitted(true);
    closeTimeoutRef.current = window.setTimeout(() => { onClose(); }, 1500);
  }, [addLocalTask, clearFocusBlocks, onClose, proposalDate, scheduleChips, scheduleTaskBlock, setViewDate]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const skipRitual = useCallback((index: number) => {
    setPendingRituals((prev) => prev.filter((_, j) => j !== index));
  }, []);

  const isWelcomeScreen = phase === 'idle' && !isStreaming && !streamingContent;
  const isOverlay = variant === 'overlay';
  const proposalLabel = proposalDate === format(new Date(), 'yyyy-MM-dd')
    ? 'today'
    : format(parseISO(proposalDate), 'EEEE').toLowerCase();
  const visibleStreamingContent = stripStructuredAssistantBlocks(streamingContent);

  return {
    state: {
      phase,
      messages,
      inputValue,
      setInputValue,
      commitChips,
      scheduleChips,
      committed,
      pendingRituals,
      proposalDate,
      proposalLabel,
      resolvedInkMode,
      promptInkMode,
      streamingContent,
      visibleStreamingContent,
      isStreaming,
      error,
      isWelcomeScreen,
      isOverlay,
      messagesEndRef,
      inputRef,
      viewDate,
      addRitual,
      skipRitual,
    },
    actions: {
      handleStartDay,
      sendMessage,
      handleKeyDown,
      showCommitChips,
      executeCommit,
      executeSchedule,
      toggleChip,
      toggleScheduleChip,
      openRevision,
    },
  };
}
