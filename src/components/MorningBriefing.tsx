import { useState, useEffect, useRef, useCallback, type ElementType } from 'react';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronsRight,
  Clock,
  Loader2,
  MoonStar,
  RotateCcw,
  Send,
  Sparkles,
  SunMedium,
  Sunset,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import type { ChatMessage } from '@/types/electron';
import { useBriefingStream } from '@/hooks/useBriefingStream';
import { detectInkMode } from '@/lib/ink-mode';
import type { InkMode } from '@/types';
import { buildBriefingContext, parseCommitChips, parseRitualSuggestions, parseScheduleProposal, type CommitChip, type ScheduleChip } from './morningBriefingUtils';

type Phase = 'idle' | 'interview' | 'journal' | 'briefing' | 'conversation' | 'committing';
type InkMoment = 'morning' | 'midday' | 'evening';

interface JournalQuestion {
  key: string;
  prompt: string;
  subtext?: string;
}

function buildJournalQuestions(goals: Array<{ id: string; title: string }>): JournalQuestion[] {
  const questions: JournalQuestion[] = [
    { key: 'excites', prompt: 'What excites you today?', subtext: 'First thought. Don\u2019t filter it.' },
  ];
  goals.forEach((goal) => {
    questions.push({
      key: `mover:${goal.id}`,
      prompt: `One thing that moves ${goal.title} forward.`,
      subtext: 'The smallest real step.',
    });
  });
  questions.push({
    key: 'artistDate',
    prompt: 'What\u2019s just for you today?',
    subtext: 'Something that has nothing to do with the work.',
  });
  return questions;
}

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

interface StarterAction {
  label: string;
  prompt: string;
  icon?: ElementType;
  primary?: boolean;
  variant?: 'warm' | 'neutral';
}

interface IntroState {
  kicker: string;
  headline: string;
  subline: string;
  inputPlaceholder: string;
  icon: ElementType;
  primaryActions: StarterAction[];
  secondaryActions: StarterAction[];
}

function getInkMoment(date = new Date()): InkMoment {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'midday';
  return 'evening';
}

function getIntroState(moment: InkMoment, userName = 'Patrick'): IntroState {
  if (moment === 'morning') {
    return {
      kicker: 'Morning briefing',
      headline: "Here's what's happening today.",
      subline: 'A clear read on the day before it starts filling up.',
      inputPlaceholder: 'Ask about today, the calendar, or what actually matters...',
      icon: SunMedium,
      primaryActions: [
        {
          label: 'Start morning briefing',
          prompt: 'Run my morning briefing.',
          icon: ArrowRight,
          primary: true,
          variant: 'warm',
        },
      ],
      secondaryActions: [
        {
          label: 'What actually matters today?',
          prompt: 'Give me a sharp read on what actually matters today.',
        },
        {
          label: 'Prep my first block',
          prompt: 'Help me prep my first block and decide what it should be.',
          icon: CalendarClock,
        },
        {
          label: "What's already fixed on the calendar?",
          prompt: "Walk me through what's already fixed on the calendar today.",
        },
        {
          label: 'How does today support this week?',
          prompt: 'How should today support my week, given the goals already in play?',
        },
      ],
    };
  }

  if (moment === 'midday') {
    return {
      kicker: 'Midday reset',
      headline: `Hey ${userName}.`,
      subline: "The day has changed. Let's make the schedule honest again.",
      inputPlaceholder: 'Ask what should move, what is at risk, or how to rebalance the day...',
      icon: Sparkles,
      primaryActions: [
        {
          label: 'Review the rest of today',
          prompt: 'Review the rest of today and tell me what needs to move.',
          icon: ArrowRight,
          primary: true,
          variant: 'neutral',
        },
      ],
      secondaryActions: [
        {
          label: 'What should move?',
          prompt: "What should move on today's schedule right now?",
        },
        {
          label: "What's at risk now?",
          prompt: 'What is at risk if the rest of today stays the way it is?',
        },
        {
          label: 'Find open time',
          prompt: 'Find realistic open time in the rest of today.',
          icon: CalendarClock,
        },
        {
          label: 'Am I still on track this week?',
          prompt: 'Am I still on track this week, or has today drifted?',
        },
      ],
    };
  }

  return {
    kicker: 'Evening plan',
    headline: `Hey ${userName}.`,
    subline: 'Choose whether to close the day cleanly or keep going on purpose.',
    inputPlaceholder: 'Ask what still matters tonight, what can close, or what should move to tomorrow...',
    icon: MoonStar,
    primaryActions: [
      {
        label: 'Wrap up the day',
        prompt: 'Help me wrap up the day cleanly and decide what closes now.',
        icon: Sunset,
        primary: true,
        variant: 'neutral',
      },
      {
        label: 'What still needs to get done?',
        prompt: 'What still needs to get done tonight, realistically?',
        icon: ArrowRight,
        primary: true,
        variant: 'warm',
      },
    ],
    secondaryActions: [
      {
        label: 'What moves to tomorrow?',
        prompt: 'What should move to tomorrow instead of staying alive tonight?',
      },
      {
        label: 'What did today actually add up to?',
        prompt: 'What did today actually add up to, and what did it miss?',
      },
      {
        label: 'Set up tomorrow morning',
        prompt: 'Set up tomorrow morning so I can start clean.',
        icon: CalendarClock,
      },
      {
        label: 'Am I still aligned with this week or month?',
        prompt: 'Am I still aligned with the week or month, given what happened today?',
      },
    ],
  };
}

export function MorningBriefing({ onClose, onNewChat, onStreamingChange, mode = 'briefing' }: { onClose: () => void; onNewChat: () => void; onStreamingChange?: (streaming: boolean) => void; mode?: 'briefing' | 'chat' }) {
  const {
    weeklyGoals,
    candidateItems,
    committedTasks,
    dailyPlan,
    bringForward,
    addLocalTask,
    addRitual,
    workdayEnd,
    scheduleBlocks,
    plannedTasks,
    monthlyPlan,
    scheduleTaskBlock,
    userName,
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [commitChips, setCommitChips] = useState<CommitChip[]>([]);
  const [scheduleChips, setScheduleChips] = useState<ScheduleChip[]>([]);
  const [committed, setCommitted] = useState(false);
  const [pendingRituals, setPendingRituals] = useState<string[]>([]);

  // Journal state
  const journalQuestions = buildJournalQuestions(weeklyGoals);
  const [journalStep, setJournalStep] = useState(0);
  const [journalAnswers, setJournalAnswers] = useState<Record<string, string>>({});
  const [journalInput, setJournalInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const journalInputRef = useRef<HTMLTextAreaElement>(null);
  const hasStartedBriefingRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const inkMoment = getInkMoment();
  const introState = getIntroState(inkMoment, userName);

  // Resolved ink mode (async — needs weekUpdatedAt from store)
  const [resolvedInkMode, setResolvedInkMode] = useState<InkMode | null>(null);

  useEffect(() => {
    void window.api.ink.readContext().then((ctx) => {
      setResolvedInkMode(detectInkMode(new Date(), ctx.weekUpdatedAt));
    });
  }, []);

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // During interview phase → use interview prompt; otherwise daily mode
  const promptInkMode: InkMode = phase === 'interview'
    ? 'sunday-interview'
    : (resolvedInkMode && resolvedInkMode !== 'sunday-interview' ? resolvedInkMode : detectInkMode());

  // Done tasks: today's committed tasks that are marked done
  const doneTasks = plannedTasks.filter(
    (t) => t.status === 'done' && dailyPlan.committedTaskIds.includes(t.id)
  );

  const buildContext = useCallback(() => buildBriefingContext({
    weeklyGoals,
    committedTasks,
    doneTasks,
    workdayEnd,
    scheduleBlocks,
    monthlyPlan,
    inkMode: promptInkMode,
  }), [weeklyGoals, committedTasks, doneTasks, workdayEnd, scheduleBlocks, monthlyPlan, promptInkMode]);

  const {
    streamingContent,
    isStreaming,
    error,
    streamMessage,
  } = useBriefingStream({
    buildContext,
    onAssistantMessage: (content) => {
      setMessages((prev) => [...prev, { role: 'assistant', content }]);

      // Detect interview completion — AI outputs JSON context block
      if (phaseRef.current === 'interview') {
        const contextJson = extractInterviewContext(content);
        if (contextJson) {
          void window.api.ink.writeContext({
            ...contextJson,
            weekUpdatedAt: new Date().toISOString(),
          }).then(() => {
            setResolvedInkMode('morning');
            // Transition: interview → journal (morning + goals) or briefing
            if (inkMoment === 'morning' && weeklyGoals.length > 0) {
              setMessages([]);
              setPhase('journal');
            } else {
              const msg: ChatMessage = { role: 'user', content: 'Run my morning briefing.' };
              setMessages([msg]);
              setPhase('briefing');
              void streamMessage([msg]);
            }
          });
        }
      }

      // Detect schedule proposal — AI outputs schedule code block
      if (phaseRef.current === 'briefing' || phaseRef.current === 'conversation') {
        const chips = parseScheduleProposal(content, plannedTasks, candidateItems);
        if (chips.length > 0) {
          setScheduleChips(chips);
          setPhase('committing');
        }
      }

      // Detect ritual suggestions — AI outputs [RITUAL] Title lines
      const rituals = parseRitualSuggestions(content);
      if (rituals.length > 0) {
        setPendingRituals(rituals);
      }
    },
  });
  const showIntro = mode === 'chat' && messages.length === 0 && !streamingContent && !isStreaming && !error;

  // Journal: advance to next question or save and transition
  const advanceJournal = useCallback(() => {
    const answer = journalInput.trim();
    if (!answer) return;

    const currentQ = journalQuestions[journalStep];
    const nextAnswers = { ...journalAnswers, [currentQ.key]: answer };
    setJournalAnswers(nextAnswers);
    setJournalInput('');

    if (journalStep < journalQuestions.length - 1) {
      setJournalStep(journalStep + 1);
    } else {
      // All questions answered — save entry and transition to briefing
      const needleMovers = weeklyGoals.map((goal) => ({
        goalTitle: goal.title,
        action: nextAnswers[`mover:${goal.id}`] || '',
      }));

      const entry = {
        date: format(new Date(), 'yyyy-MM-dd'),
        excites: nextAnswers['excites'] || '',
        needleMovers,
        artistDate: nextAnswers['artistDate'] || '',
        createdAt: new Date().toISOString(),
      };

      void window.api.ink.appendJournal(entry);
      setPhase('briefing');

      // Auto-start briefing after journal completes
      const initialMsg: ChatMessage = { role: 'user', content: 'Run my morning briefing.' };
      setMessages([initialMsg]);
      void streamMessage([initialMsg]);
    }
  }, [journalInput, journalQuestions, journalStep, journalAnswers, weeklyGoals, streamMessage]);

  // Focus journal input when question changes
  useEffect(() => {
    if (phase === 'journal') {
      journalInputRef.current?.focus();
    }
  }, [phase, journalStep]);

  useEffect(() => {
    onStreamingChange?.(isStreaming);
  }, [isStreaming, onStreamingChange]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Auto-fire on mount (briefing mode only - chat mode starts idle)
  // Sunday/Monday interview → journal → briefing. Morning → journal → briefing. Other → straight briefing.
  useEffect(() => {
    if (mode !== 'briefing' || resolvedInkMode === null) return;
    if (hasStartedBriefingRef.current) return;
    hasStartedBriefingRef.current = true;

    if (resolvedInkMode === 'sunday-interview') {
      setPhase('interview');
      const initialMsg: ChatMessage = { role: 'user', content: 'Start the weekly interview.' };
      setMessages([initialMsg]);
      void streamMessage([initialMsg]);
    } else if (inkMoment === 'morning' && weeklyGoals.length > 0) {
      setPhase('journal');
    } else {
      setPhase('briefing');
      const initialMsg: ChatMessage = { role: 'user', content: 'Run my morning briefing.' };
      setMessages([initialMsg]);
      void streamMessage([initialMsg]);
    }
  }, [streamMessage, mode, inkMoment, weeklyGoals.length, resolvedInkMode]);

  const startConversation = useCallback((prompt: string) => {
    if (!prompt.trim() || isStreaming) return;
    const nextPhase = prompt === 'Run my morning briefing.' ? 'briefing' : 'conversation';
    const userMsg: ChatMessage = { role: 'user', content: prompt.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setPhase(nextPhase);
    void streamMessage(newMessages);
  }, [isStreaming, messages, streamMessage]);

  // Send a follow-up message
  const sendMessage = useCallback(() => {
    if (!inputValue.trim() || isStreaming) return;
    const prompt = inputValue.trim();
    setInputValue('');
    startConversation(prompt);
  }, [inputValue, isStreaming, startConversation]);

  // Parse tasks from the last assistant message for commit chips
  const parseTasksFromMessage = useCallback((content: string): CommitChip[] => {
    return parseCommitChips(content, plannedTasks, candidateItems);
  }, [plannedTasks, candidateItems]);

  // Show commit chips when user signals readiness
  const showCommitChips = useCallback(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return;

    const chips = parseTasksFromMessage(lastAssistant.content);
    if (chips.length > 0) {
      setCommitChips(chips);
      setPhase('committing');
    }
  }, [messages, parseTasksFromMessage]);

  // Execute the commit
  const executeCommit = useCallback(() => {
    const toCommit = commitChips.filter((chip) => chip.selected);

    toCommit.forEach((chip) => {
      if (chip.matchedTaskId) {
        // Check if already committed
        if (!dailyPlan.committedTaskIds.includes(chip.matchedTaskId)) {
          bringForward(chip.matchedTaskId, chip.matchedGoalId || undefined);
        }
      } else {
        // New local task
        addLocalTask(chip.title, chip.matchedGoalId || undefined);
      }
    });

    setCommitted(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 1500);
  }, [commitChips, dailyPlan.committedTaskIds, bringForward, addLocalTask, onClose]);

  const toggleChip = (index: number) => {
    setCommitChips((prev) =>
      prev.map((chip, i) => (i === index ? { ...chip, selected: !chip.selected } : chip))
    );
  };

  const toggleScheduleChip = (index: number) => {
    setScheduleChips((prev) =>
      prev.map((chip, i) => (i === index ? { ...chip, selected: !chip.selected } : chip))
    );
  };

  // Execute schedule proposal — commit + place tasks on timeline
  const executeSchedule = useCallback(async () => {
    const toSchedule = scheduleChips.filter((chip) => chip.selected);

    for (const chip of toSchedule) {
      if (chip.matchedTaskId) {
        await scheduleTaskBlock(chip.matchedTaskId, chip.startHour, chip.startMin, chip.durationMins);
      } else {
        // Unmatched: create local task (no scheduling — addLocalTask doesn't return an ID)
        addLocalTask(chip.title, chip.matchedGoalId || undefined);
      }
    }

    setCommitted(true);
    closeTimeoutRef.current = window.setTimeout(() => {
      onClose();
    }, 1500);
  }, [scheduleChips, scheduleTaskBlock, addLocalTask, onClose]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="relative flex flex-col h-full w-full min-w-[280px] bg-bg-card border-l border-border-subtle">
      {/* Header */}
      <div className="drag-region flex items-center justify-between" style={{ background: 'transparent', borderBottom: '0.5px solid rgba(255,255,255,0.06)', padding: '32px 22px 20px' }}>
        <div className="pr-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 shrink-0 text-accent-warm/60" />
          <div className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            {format(new Date(), 'EEEE, MMM d')}
          </div>
        </div>
        <div className="no-drag flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="flex items-center gap-1.5 rounded-md border border-border-subtle px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-text-muted transition-colors hover:text-text-primary hover:bg-bg-elevated"
            title="Start a new chat"
          >
            <RotateCcw className="w-3 h-3" />
            New chat
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors"
            title="Hide"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Journal phase */}
      {phase === 'journal' && journalQuestions[journalStep] && (
        <div className="flex-1 overflow-y-auto px-6 pt-[88px] pb-6 flex flex-col hide-scrollbar">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-8">
            {journalQuestions.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all duration-300',
                  i < journalStep ? 'w-6 bg-accent-warm/60' : i === journalStep ? 'w-6 bg-accent-warm' : 'w-1.5 bg-text-muted/20',
                )}
              />
            ))}
          </div>

          {/* Answered questions (collapsed) */}
          {Object.entries(journalAnswers).map(([key, answer]) => {
            const q = journalQuestions.find((jq) => jq.key === key);
            if (!q) return null;
            return (
              <div key={key} className="mb-4 pb-3 border-b border-border-subtle/40">
                <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted/60">{q.prompt}</div>
                <div className="mt-1 text-[13px] text-text-primary/70">{answer}</div>
              </div>
            );
          })}

          {/* Current question */}
          <div className="mt-auto">
            <div className="text-[10px] uppercase tracking-[0.18em] text-accent-warm/80 mb-3">
              Morning journal
            </div>
            <div className="font-display italic text-[24px] font-light text-text-emphasis leading-snug mb-2">
              {journalQuestions[journalStep].prompt}
            </div>
            {journalQuestions[journalStep].subtext && (
              <div className="text-[12px] text-text-muted/60 mb-6">
                {journalQuestions[journalStep].subtext}
              </div>
            )}

            <div className="flex items-end gap-3">
              <textarea
                ref={journalInputRef}
                value={journalInput}
                onChange={(e) => setJournalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    advanceJournal();
                  }
                }}
                placeholder="Type your answer..."
                rows={1}
                className="min-h-[44px] flex-1 resize-none bg-bg-elevated/60 border border-border-subtle rounded-lg px-4 py-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-warm/40 transition-colors"
              />
              <button
                onClick={advanceJournal}
                disabled={!journalInput.trim()}
                className={cn(
                  'p-3 rounded-lg transition-all shrink-0',
                  journalInput.trim()
                    ? 'bg-accent-warm text-white hover:bg-accent-warm/90'
                    : 'bg-bg-elevated text-text-muted cursor-not-allowed',
                )}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {phase !== 'journal' && (
      <div className="flex-1 overflow-y-auto px-6 pt-[88px] pb-6 flex flex-col gap-6 hide-scrollbar">
        {showIntro && (
          <InkIntroPanel
            state={introState}
            mode={mode}
            onAction={(prompt) => {
              startConversation(prompt);
            }}
          />
        )}

        {phase === 'interview' && messages.length <= 1 && !streamingContent && (
          <div className="max-w-[280px] border-b border-border-subtle/60 pb-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-accent-warm/80">
              Weekly interview
            </div>
            <div className="mt-3 font-display italic text-[24px] font-light text-text-emphasis leading-snug">
              Let&apos;s see the week.
            </div>
          </div>
        )}
        {mode === 'briefing' && phase === 'briefing' && (
          <div className="max-w-[280px] border-b border-border-subtle/60 pb-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-accent-warm/80">
              Morning briefing
            </div>
            <div className="mt-3 font-display italic text-[24px] font-light text-text-emphasis leading-snug">
              {inkMoment === 'morning' ? 'Good morning.' : inkMoment === 'midday' ? `Hey ${userName}.` : `Good evening, ${userName}.`}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} isFirst={i === 0} />
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex gap-4">
            <div className="flex-1 min-w-0 pr-2">
              <div className="prose-briefing text-[15px] leading-relaxed text-text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                <span className="inline-block w-[2px] h-[14px] bg-accent-warm animate-pulse ml-0.5 align-text-bottom" />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="text-[12px] text-red-300 leading-relaxed">{error}</div>
          </div>
        )}

        {/* Schedule chips (AI-proposed time placements) */}
        {phase === 'committing' && scheduleChips.length > 0 && !committed && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-medium px-1">
              Proposed schedule
            </div>
            {scheduleChips.map((chip, i) => {
              const timeLabel = `${chip.startHour}:${String(chip.startMin).padStart(2, '0')}`;
              const endMin = chip.startHour * 60 + chip.startMin + chip.durationMins;
              const endLabel = `${Math.floor(endMin / 60)}:${String(endMin % 60).padStart(2, '0')}`;
              return (
                <button
                  key={i}
                  onClick={() => toggleScheduleChip(i)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-[13px]',
                    chip.selected
                      ? 'bg-accent-warm/15 text-text-primary border border-accent-warm/30'
                      : 'bg-bg-elevated/50 text-text-muted border border-transparent hover:border-border-subtle'
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                    chip.selected ? 'border-accent-warm bg-accent-warm' : 'border-text-muted/40'
                  )}>
                    {chip.selected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="flex-1 min-w-0 truncate">{chip.title}</span>
                  <span className="flex items-center gap-1 text-[10px] text-text-muted/70 shrink-0">
                    <Clock className="w-3 h-3" />
                    {timeLabel}–{endLabel}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => void executeSchedule()}
              disabled={scheduleChips.every((c) => !c.selected)}
              className={cn(
                'mt-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all',
                scheduleChips.some((c) => c.selected)
                  ? 'bg-accent-warm text-white hover:bg-accent-warm/90'
                  : 'bg-bg-elevated text-text-muted cursor-not-allowed'
              )}
            >
              Lock it in
            </button>
          </div>
        )}

        {/* Commit chips (manual, no time placement) */}
        {phase === 'committing' && commitChips.length > 0 && scheduleChips.length === 0 && !committed && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-medium px-1">
              Commit to today
            </div>
            {commitChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => toggleChip(i)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-[13px]',
                  chip.selected
                    ? 'bg-accent-warm/15 text-text-primary border border-accent-warm/30'
                    : 'bg-bg-elevated/50 text-text-muted border border-transparent hover:border-border-subtle'
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  chip.selected ? 'border-accent-warm bg-accent-warm' : 'border-text-muted/40'
                )}>
                  {chip.selected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="flex-1 min-w-0 truncate">{chip.title}</span>
                {chip.matchedTaskId ? (
                  <span className="text-[9px] uppercase tracking-wider text-accent-warm font-medium shrink-0">
                    matched
                  </span>
                ) : (
                  <span className="text-[9px] uppercase tracking-wider text-text-muted/60 font-medium shrink-0">
                    new
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={executeCommit}
              disabled={commitChips.every((c) => !c.selected)}
              className={cn(
                'mt-2 px-4 py-2 rounded-lg text-[13px] font-medium transition-all',
                commitChips.some((c) => c.selected)
                  ? 'bg-accent-warm text-white hover:bg-accent-warm/90'
                  : 'bg-bg-elevated text-text-muted cursor-not-allowed'
              )}
            >
              Lock it in
            </button>
          </div>
        )}

        {/* Ritual suggestions */}
        {pendingRituals.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted font-medium px-1">
              Add as daily ritual?
            </div>
            {pendingRituals.map((title, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated/50 border border-border-subtle text-[13px]">
                <MoonStar className="w-3.5 h-3.5 text-text-muted shrink-0" />
                <span className="flex-1 min-w-0 truncate text-text-primary">{title}</span>
                <button
                  onClick={() => {
                    addRitual(title);
                    setPendingRituals((prev) => prev.filter((_, j) => j !== i));
                  }}
                  className="text-[10px] uppercase tracking-wider text-accent-warm hover:text-accent-warm/80 font-medium shrink-0 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => setPendingRituals((prev) => prev.filter((_, j) => j !== i))}
                  className="text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary font-medium shrink-0 transition-colors"
                >
                  Skip
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Committed confirmation */}
        {committed && (
          <div className="flex items-center justify-center py-6">
            <div className="text-center animate-fade-in">
              <div className="font-display italic text-[22px] text-text-emphasis">Held.</div>
              <div className="text-[11px] text-text-muted mt-1">Plan locked in</div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
      )}

      {/* Input area */}
      {phase !== 'journal' && phase !== 'committing' && !committed && (
        <div className="px-6 pb-5 pt-3 border-t border-border-subtle">
          {/* Commit trigger */}
          {messages.length > 2 && !isStreaming && phase !== 'interview' && (
            <button
              onClick={showCommitChips}
              className="w-full mb-2 px-3 py-1.5 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 transition-colors border border-dashed border-border-subtle"
            >
              Ready to commit? Pull tasks from the last reply
            </button>
          )}

          <div className="flex items-end gap-3">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? 'Thinking...' : phase === 'interview' ? 'Answer honestly...' : showIntro ? introState.inputPlaceholder : 'Push back, add, cut, or re-scope...'}
              rows={1}
              disabled={isStreaming}
              className="min-h-[44px] flex-1 resize-none bg-bg-elevated/60 border border-border-subtle rounded-lg px-4 py-3 text-[16px] leading-relaxed text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-warm/40 transition-colors disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isStreaming}
              className={cn(
                'p-3 rounded-lg transition-all shrink-0',
                inputValue.trim() && !isStreaming
                  ? 'bg-accent-warm text-white hover:bg-accent-warm/90'
                  : 'bg-bg-elevated text-text-muted cursor-not-allowed'
              )}
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InkIntroPanel({
  state,
  mode,
  onAction,
}: {
  state: IntroState;
  mode: 'briefing' | 'chat';
  onAction: (prompt: string) => void;
}) {
  const Icon = state.icon;

  return (
    <div className="relative">
      <div className="relative px-[22px] py-5">
        <div className="relative flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted/80">
                {state.kicker}
              </div>
              <div className="mt-3 font-display text-[29px] leading-[0.98] text-text-emphasis">
                {state.headline}
              </div>
              <div className="mt-3 max-w-[280px] text-[14px] leading-relaxed text-text-muted">
                {state.subline}
              </div>
            </div>
            <Icon className="h-5 w-5 shrink-0" style={{ color: 'rgba(160,150,130,0.4)' }} />
          </div>

          <div className="flex flex-col">
            {state.primaryActions.map((action) => {
              const ActionIcon = action.icon ?? ArrowRight;
              return (
                <button
                  key={action.label}
                  onClick={() => onAction(action.prompt)}
                  className="group flex w-full items-center justify-between text-left transition-all"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '0.5px solid rgba(255,255,255,0.04)',
                    padding: '12px 0 14px',
                  }}
                >
                  <div>
                    <div
                      className="text-[14px] font-medium"
                      style={{ color: action.variant === 'warm' ? 'rgba(190,90,55,0.9)' : 'rgba(225,215,200,0.85)' }}
                    >
                      {action.label}
                    </div>
                    {mode === 'chat' && action.label === 'Start morning briefing' && (
                      <div className="mt-1 text-[10px]" style={{ color: 'rgba(160,150,130,0.4)' }}>
                        Start with the day shape, the pressure points, and what belongs in the commit.
                      </div>
                    )}
                  </div>
                  <ActionIcon className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: 'rgba(160,150,130,0.4)' }} />
                </button>
              );
            })}
          </div>

          <div className="flex flex-col">
            {state.secondaryActions.map((action) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => onAction(action.prompt)}
                  className="group flex items-center gap-3 text-left transition-all"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '0.5px solid rgba(255,255,255,0.03)',
                    padding: '10px 0',
                  }}
                >
                  {ActionIcon ? <ActionIcon className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(160,150,130,0.35)' }} /> : <ArrowRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(160,150,130,0.35)' }} />}
                  <div className="text-[14px] leading-snug" style={{ color: 'rgba(190,180,160,0.7)' }}>
                    {action.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isFirst }: { message: ChatMessage; isFirst: boolean }) {
  if (message.role === 'user' && isFirst) {
    // Don't render the auto-fired "Run my morning briefing" message
    return null;
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
      <div className="max-w-[88%] bg-bg-elevated/80 rounded-xl rounded-br-sm px-4 py-3 text-[15px] text-text-primary leading-relaxed">
        {message.content}
      </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 animate-fade-in">
      <div className="flex-1 min-w-0 pr-2 prose-briefing text-[15px] leading-[1.8] text-text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}
