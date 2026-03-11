import { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';
import { ChevronsRight, Send, Loader2, AlertCircle, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import type { ChatMessage, BriefingContext } from '@/types/electron';

const TODAY = format(new Date(), 'yyyy-MM-dd');

type Phase = 'idle' | 'briefing' | 'conversation' | 'committing';

interface CommitChip {
  title: string;
  matchedTaskId: string | null;
  matchedGoalId: string | null;
  selected: boolean;
}

export function MorningBriefing({ onClose }: { onClose: () => void }) {
  const {
    weeklyGoals,
    candidateItems,
    committedTasks,
    dailyPlan,
    bringForward,
    addLocalTask,
    workdayEnd,
    scheduleBlocks,
    plannedTasks,
  } = useApp();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [commitChips, setCommitChips] = useState<CommitChip[]>([]);
  const [committed, setCommitted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const streamingRef = useRef('');
  const unsubTokenRef = useRef<(() => void) | null>(null);
  const unsubDoneRef = useRef<(() => void) | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      unsubTokenRef.current?.();
      unsubDoneRef.current?.();
    };
  }, []);

  // Build context from live app state
  const buildContext = useCallback(async (): Promise<BriefingContext> => {
    // Fetch fresh Asana tasks
    let asanaTasks: BriefingContext['asanaTasks'] = [];
    try {
      const result = await window.api.asana.getTasks({ daysAhead: 14, limit: 30 });
      if (result.success && result.data) {
        asanaTasks = result.data.map((t) => {
          // Extract priority from custom_fields if available
          const priorityField = t.custom_fields?.find(
            (cf) => cf.name.toLowerCase() === 'priority'
          );
          const priority = priorityField?.display_value || undefined;
          const project = t.projects?.[0]?.name || undefined;

          return {
            title: t.name,
            dueOn: t.due_on,
            priority,
            project,
            notes: t.notes || undefined,
            tags: t.tags?.map((tag: { name: string }) => tag.name),
          };
        });
      }
    } catch {
      // Asana unavailable — proceed without
    }

    // Fetch today's GCal events
    let gcalEvents: BriefingContext['gcalEvents'] = [];
    try {
      const result = await window.api.gcal.getEvents(TODAY);
      if (result.success && result.data) {
        gcalEvents = result.data.map((e) => {
          const isAllDay = !e.start?.dateTime;
          const startTime = e.start?.dateTime
            ? format(new Date(e.start.dateTime), 'h:mm a')
            : '';
          const endTime = e.end?.dateTime
            ? format(new Date(e.end.dateTime), 'h:mm a')
            : '';
          return {
            title: e.summary || '(No title)',
            startTime,
            endTime,
            isAllDay,
          };
        });
      }
    } catch {
      // GCal unavailable — proceed without
    }

    // Calculate available focus time
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(workdayEnd.hour, workdayEnd.min, 0, 0);
    const remainingMins = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 60000));

    // Calculate scheduled minutes from schedule blocks
    const scheduledMinutes = scheduleBlocks
      .filter((b) => !b.readOnly)
      .reduce((sum, b) => sum + b.durationMins, 0);

    // Get committed tasks for context
    const committed = committedTasks.map((t) => {
      const goal = t.weeklyGoalId ? weeklyGoals.find((g) => g.id === t.weeklyGoalId) : null;
      return {
        title: t.title,
        estimateMins: t.estimateMins || 45,
        weeklyGoal: goal?.title || 'Unassigned',
      };
    });

    // Build countdowns from app context (simplified — goals with due dates could be countdowns)
    const countdowns: BriefingContext['countdowns'] = [];

    return {
      date: format(new Date(), 'EEEE, MMMM d, yyyy'),
      weeklyGoals: weeklyGoals.map((g) => ({ title: g.title, why: g.why })),
      asanaTasks,
      gcalEvents,
      availableFocusMinutes: remainingMins - scheduledMinutes,
      scheduledMinutes,
      committedTasks: committed,
      countdowns,
      workdayEndHour: workdayEnd.hour,
      workdayEndMin: workdayEnd.min,
    };
  }, [weeklyGoals, committedTasks, workdayEnd, scheduleBlocks]);

  // Stream a message
  const streamMessage = useCallback(async (msgs: ChatMessage[]) => {
    setIsStreaming(true);
    setError(null);
    streamingRef.current = '';
    setStreamingContent('');

    try {
      const context = await buildContext();

      // Subscribe to tokens
      unsubTokenRef.current?.();
      unsubDoneRef.current?.();

      unsubTokenRef.current = window.api.ai.onToken((token) => {
        streamingRef.current += token;
        setStreamingContent(streamingRef.current);
      });

      unsubDoneRef.current = window.api.ai.onDone(() => {
        const finalContent = streamingRef.current;
        if (finalContent) {
          setMessages((prev) => [...prev, { role: 'assistant', content: finalContent }]);
        }
        setStreamingContent('');
        streamingRef.current = '';
        setIsStreaming(false);
        unsubTokenRef.current?.();
        unsubDoneRef.current?.();
      });

      const result = await window.api.ai.streamStart(msgs, context);
      if (!result.success) {
        throw new Error(result.error || 'Stream failed');
      }
    } catch (err) {
      setIsStreaming(false);
      setError((err as Error).message);
      unsubTokenRef.current?.();
      unsubDoneRef.current?.();
    }
  }, [buildContext]);

  // Auto-fire briefing on mount
  useEffect(() => {
    if (phase === 'idle') {
      setPhase('briefing');
      const initialMsg: ChatMessage = { role: 'user', content: 'Run my morning briefing.' };
      setMessages([initialMsg]);
      streamMessage([initialMsg]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Send a follow-up message
  const sendMessage = useCallback(() => {
    if (!inputValue.trim() || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: inputValue.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setPhase('conversation');
    streamMessage(newMessages);
  }, [inputValue, isStreaming, messages, streamMessage]);

  // Parse tasks from the last assistant message for commit chips
  const parseTasksFromMessage = useCallback((content: string): CommitChip[] => {
    const lines = content.split('\n');
    const taskLines = lines.filter((line) => /^[-–•]\s+\S/.test(line.trim()));

    return taskLines.map((line) => {
      const title = line.trim().replace(/^[-–•]\s+/, '').replace(/\s*\(.*?\)\s*$/, '').trim();

      // Try to match against candidates + planned tasks
      const allTasks = [...plannedTasks, ...candidateItems.map((c) => ({ id: c.id, title: c.title, weeklyGoalId: null }))];
      const normalizeStr = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

      const exactMatch = allTasks.find((t) => normalizeStr(t.title) === normalizeStr(title));
      const fuzzyMatch = !exactMatch
        ? allTasks.find((t) =>
            normalizeStr(t.title).includes(normalizeStr(title)) ||
            normalizeStr(title).includes(normalizeStr(t.title))
          )
        : null;

      const matched = exactMatch || fuzzyMatch;

      // Try to match goal from context
      let matchedGoalId: string | null = null;
      if (matched && 'weeklyGoalId' in matched) {
        matchedGoalId = matched.weeklyGoalId || null;
      }

      return {
        title,
        matchedTaskId: matched?.id || null,
        matchedGoalId,
        selected: true,
      };
    });
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
    setTimeout(() => {
      onClose();
    }, 1500);
  }, [commitChips, dailyPlan.committedTaskIds, bringForward, addLocalTask, onClose]);

  const toggleChip = (index: number) => {
    setCommitChips((prev) =>
      prev.map((chip, i) => (i === index ? { ...chip, selected: !chip.selected } : chip))
    );
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="column-divider flex flex-col h-full w-[380px] shrink-0 bg-bg-card/95 backdrop-blur-xl animate-slide-in-right">
      {/* Header */}
      <div className="drag-region flex items-center justify-between px-5 pt-6 pb-4 border-b border-border-subtle">
        <div>
          <h2 className="font-display italic text-[17px] font-light text-text-emphasis">
            Morning Briefing
          </h2>
          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted mt-0.5">
            {format(new Date(), 'EEEE, MMM d')}
          </div>
        </div>
        <button
          onClick={onClose}
          className="no-drag p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-elevated rounded-md transition-colors"
          title="Close briefing"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 hide-scrollbar">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} isFirst={i === 0} />
        ))}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex gap-3">
            <div className="w-5 h-5 mt-0.5 rounded-full bg-accent-warm/20 flex items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-accent-warm">TF</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="prose-briefing text-[13px] leading-relaxed text-text-primary">
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

        {/* Commit chips */}
        {phase === 'committing' && commitChips.length > 0 && !committed && (
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

      {/* Input area */}
      {phase !== 'committing' && !committed && (
        <div className="px-4 pb-4 pt-2 border-t border-border-subtle">
          {/* Commit trigger */}
          {messages.length > 2 && !isStreaming && (
            <button
              onClick={showCommitChips}
              className="w-full mb-2 px-3 py-1.5 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 transition-colors border border-dashed border-border-subtle"
            >
              Ready to commit? Extract tasks from last response
            </button>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming ? 'Thinking...' : 'Push back, add, cut...'}
              rows={1}
              disabled={isStreaming}
              className="flex-1 resize-none bg-bg-elevated/60 border border-border-subtle rounded-lg px-3 py-2 text-[13px] text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-accent-warm/40 transition-colors disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isStreaming}
              className={cn(
                'p-2 rounded-lg transition-all shrink-0',
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

function MessageBubble({ message, isFirst }: { message: ChatMessage; isFirst: boolean }) {
  if (message.role === 'user' && isFirst) {
    // Don't render the auto-fired "Run my morning briefing" message
    return null;
  }

  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] bg-bg-elevated/80 rounded-xl rounded-br-sm px-3.5 py-2 text-[13px] text-text-primary leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-5 h-5 mt-0.5 rounded-full bg-accent-warm/20 flex items-center justify-center shrink-0">
        <span className="text-[9px] font-bold text-accent-warm">TF</span>
      </div>
      <div className="flex-1 min-w-0 prose-briefing text-[13px] leading-relaxed text-text-primary">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}
