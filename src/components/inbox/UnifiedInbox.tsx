import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { Filter, Plus, RefreshCw, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compareInboxTasks } from '@/lib/planner';
import { useAppStatus, usePlanner } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { resolveGoalColor } from '@/lib/goalColors';
import type { InboxItem } from '@/types';


function summarizeSyncIssue(message: string) {
  const jsonStart = message.indexOf('{');
  let parsedMessage = '';
  let activationUrl = '';
  let projectId = '';

  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(message.slice(jsonStart)) as {
        error?: {
          message?: string;
          errors?: Array<{ message?: string }>;
          details?: Array<{ metadata?: { activationUrl?: string; consumer?: string } }>;
        };
      };
      parsedMessage =
        parsed.error?.message ||
        parsed.error?.errors?.[0]?.message ||
        '';
      activationUrl =
        parsed.error?.details?.find((detail) => detail.metadata?.activationUrl)?.metadata?.activationUrl || '';
      projectId =
        parsed.error?.details
          ?.find((detail) => detail.metadata?.consumer)
          ?.metadata?.consumer
          ?.split('/')
          .pop() || '';
    } catch {
      parsedMessage = '';
    }
  }

  const extracted =
    parsedMessage ||
    message.match(/Google Calendar API has not been used in project\s+\d+\s+before or it is disabled\./i)?.[0] ||
    message.match(/"message":"([^"]+)"/)?.[1] ||
    message.match(/message:\s*([^"\n]+)/i)?.[1] ||
    message;

  if (/accessNotConfigured|SERVICE_DISABLED|not been used/i.test(message)) {
    return {
      label: 'Calendar API disabled',
      message: projectId ? `${extracted} Project ${projectId}.` : extracted,
      hint: activationUrl
        ? 'Enable Google Calendar API for this project, wait a minute, then refresh calendars in Settings.'
        : 'Enable Google Calendar API for this project, then refresh calendars in Settings.',
    };
  }

  return {
    label: 'Sync issue',
    message: extracted.split('\n')[0],
    hint: 'Open Settings if this keeps showing up.',
  };
}

function formatBlockTime(h: number, m: number) {
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function IncomingCard({
  item,
  selected,
  onSelect,
  stagger,
}: {
  item: InboxItem;
  selected: boolean;
  onSelect: () => void;
  stagger: number;
}) {
  const { plannedTasks, weeklyGoals, scheduleBlocks, toggleTask } = usePlanner();

  const task = plannedTasks.find((t) => t.id === item.id);
  const isPlaced = task?.status === 'scheduled';
  const isDone = task?.status === 'done';

  // Determine intention color from weeklyGoalId
  const goalId = task?.weeklyGoalId ?? null;
  const goalIndex = goalId && weeklyGoals.length > 0 ? weeklyGoals.findIndex((g) => g.id === goalId) : -1;
  const goal = goalIndex >= 0 ? weeklyGoals[goalIndex] : null;
  const intentionColor = resolveGoalColor(goal?.color, goalIndex);

  // High priority uses rust accent
  const isHighPriority = item.priority?.toLowerCase() === 'high';
  const circleColor = isHighPriority ? 'var(--color-accent-warm)' : intentionColor;

  // Placed time lookup
  let placedTime = '';
  if (isPlaced) {
    const block = scheduleBlocks.find((b) => b.linkedTaskId === item.id);
    if (block) {
      placedTime = formatBlockTime(block.startHour, block.startMin);
    }
  }

  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: DragTypes.TASK,
    item: { id: item.id, title: item.title, priority: item.priority, sourceType: item.source },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);

  return (
    <div
      ref={dragRef}
      className={cn(
        'animate-fade-in relative group select-none',
        stagger === 1 && 'stagger-1',
        stagger === 2 && 'stagger-2',
        stagger === 3 && 'stagger-3',
        stagger === 4 && 'stagger-4',
        isDragging && 'opacity-20'
      )}
    >
      <div
        onClick={onSelect}
        className={cn(
          'relative py-2.5 px-4 cursor-grab rounded-md hover:bg-surface transition-all select-none',
          isPlaced && 'opacity-30 cursor-default',
          selected && 'bg-[rgba(250,250,250,0.03)]'
        )}
        title="Select this task, then press I to cycle its weekly intention. Option+I clears it."
      >
        <div className="flex items-start gap-2.5">
          {/* Open circle / checkbox — click to toggle done */}
          <button
            onClick={(e) => { e.stopPropagation(); void toggleTask(item.id); }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="mt-0.5 shrink-0 flex items-center justify-center w-4 h-4 rounded-full border-[1.5px] transition-colors hover:opacity-80"
            style={{
              borderColor: circleColor,
              backgroundColor: isDone ? circleColor : 'transparent',
            }}
            title={isDone ? 'Mark incomplete' : 'Mark complete'}
          />
          <div className="flex-1 min-w-0">
            <div className={cn(
              'text-[12px] leading-snug truncate transition-colors',
              isDone ? 'text-text-muted/40 line-through' : 'text-text-secondary group-hover:text-text-primary'
            )}>
              {item.title}
            </div>
            {isPlaced && placedTime ? (
              <div className="text-[9px] uppercase tracking-wider text-text-whisper mt-0.5">
                Placed · {placedTime}
              </div>
            ) : (
              <div className="text-[9px] uppercase tracking-wider text-text-whisper mt-0.5">
                {item.source === 'asana' ? 'ASANA' : item.source === 'gcal' ? 'CALENDAR' : item.source.toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RitualEntry({
  ritual,
  isPlaced,
  placedTime,
  isSkipped,
}: {
  ritual: { id: string; title: string; estimateMins?: number };
  isPlaced: boolean;
  placedTime: string;
  isSkipped: boolean;
}) {
  const { renameRitual, removeRitual } = usePlanner();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(ritual.title);
  const skipBlurCommitRef = useRef(false);

  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: DragTypes.TASK,
    item: { id: ritual.id, title: ritual.title, sourceType: 'local' as const },
    canDrag: !isPlaced && !isEditing,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);

  function commitEdit() {
    const trimmed = editValue.trim();
    setEditValue(trimmed || ritual.title);
    if (trimmed && trimmed !== ritual.title) {
      renameRitual(ritual.id, trimmed);
    }
    setIsEditing(false);
  }

  function cancelEdit() {
    skipBlurCommitRef.current = true;
    setEditValue(ritual.title);
    setIsEditing(false);
  }

  return (
    <div
      ref={dragRef}
      className={cn('animate-fade-in relative group select-none', isDragging && 'opacity-20')}
      title={isPlaced ? 'Placed rituals move on the calendar. Deleting the block skips it for today.' : 'Drag to place on the calendar.'}
    >
      <div
        className={cn(
          'relative py-2 px-4 rounded-md hover:bg-surface transition-all select-none',
          isPlaced ? 'cursor-default placed' : 'cursor-grab'
        )}
      >
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={() => {
              if (skipBlurCommitRef.current) {
                skipBlurCommitRef.current = false;
                return;
              }
              commitEdit();
            }}
            className="w-full bg-transparent text-[13px] text-text-secondary border-b border-accent-warm/40 outline-none py-0.5"
          />
        ) : (
          <div
            className="font-sans text-[13px] text-text-secondary leading-snug flex items-center justify-between"
            onDoubleClick={() => { setEditValue(ritual.title); setIsEditing(true); }}
          >
            <span>{ritual.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); removeRitual(ritual.id); }}
              className="opacity-0 group-hover:opacity-100 text-text-muted/30 hover:text-accent-warm transition-opacity ml-2 text-[10px]"
              title="Delete ritual"
            >
              ✕
            </button>
          </div>
        )}
        {!isEditing && isPlaced && placedTime && (
          <div className="font-sans text-[11px] text-text-muted/40 mt-1">
            Placed · {placedTime} · Drag on calendar to move
          </div>
        )}
        {!isEditing && !isPlaced && (
          <div className="font-sans text-[12px] text-text-muted/45 leading-relaxed mt-1.5 font-light">
            {isSkipped
              ? 'Skipped for this day'
              : ritual.estimateMins
                ? `${ritual.estimateMins} min · Drag to place`
                : 'Drag to place'}
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnDropZone({ onDrop }: { onDrop: (item: DragItem) => void }) {
  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, unknown, { isOver: boolean; canDrop: boolean }>({
    accept: [DragTypes.TASK, DragTypes.BLOCK],
    canDrop: (item) => item.sourceType === 'asana' || item.sourceType === 'local' || item.sourceType === 'gcal',
    drop: (item) => { onDrop(item); },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  // Only visible when actively dragging a compatible item
  return (
    <div ref={dropRef} className={cn('relative mt-2 px-4 transition-all duration-200', !canDrop && 'hidden')}>
      <div
      className={cn(
        'mx-4 mb-3 rounded-xl border border-dashed flex items-center justify-center px-3 py-3 text-[11px] font-medium tracking-[0.08em] uppercase transition-all duration-200',
        isOver
          ? 'border-accent-warm/60 bg-accent-warm/10 text-accent-warm'
          : 'border-border text-text-muted opacity-60'
      )}
    >
      Drop to release
      </div>
    </div>
  );
}

const PAGE_SIZE = 7;

export function UnifiedInbox({ collapsed = false }: { collapsed?: boolean }) {
  const { syncStatus, refreshExternalData } = useAppStatus();
  const {
    candidateItems,
    plannedTasks,
    weeklyGoals,
    selectedInboxId,
    selectInboxItem,
    assignTaskToGoal,
    addInboxTask,
    returnTaskToInbox,
    rituals,
    addRitual,
    scheduleBlocks,
    viewDate,
  } = usePlanner();

  const MAX_RITUALS = 3;
  const [page, setPage] = useState(0);
  const [isComposing, setIsComposing] = useState(false);
  const [isAddingRitual, setIsAddingRitual] = useState(false);
  const [ritualDraft, setRitualDraft] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [filter, setFilter] = useState<'all' | 'asana' | 'unscheduled'>('all');

  const primaryGoalId = weeklyGoals[0]?.id ?? null;
  const planningDateKey = format(viewDate, 'yyyy-MM-dd');

  const allInboxItems = useMemo(() => {
    const filtered = candidateItems.filter((item) => item.source === 'asana' || item.source === 'local');

    return [...filtered].sort((a, b) => {
      const aTask = plannedTasks.find((t) => t.id === a.id);
      const bTask = plannedTasks.find((t) => t.id === b.id);
      return compareInboxTasks(aTask, bTask, {
        primaryGoalId,
        planningDate: planningDateKey,
      });
    });
  }, [candidateItems, plannedTasks, primaryGoalId, planningDateKey]);

  const inboxItems = useMemo(() => {
    if (filter === 'asana') return allInboxItems.filter((item) => item.source === 'asana');
    if (filter === 'unscheduled') {
      return allInboxItems.filter((item) => {
        const task = plannedTasks.find((t) => t.id === item.id);
        return task?.status !== 'scheduled';
      });
    }
    return allInboxItems;
  }, [allInboxItems, filter, plannedTasks]);

  const totalPages = Math.ceil(inboxItems.length / PAGE_SIZE);

  // Reset page when filter changes
  useEffect(() => {
    setPage(0);
  }, [filter]);

  // Clamp page if items shrink (e.g. after committing last item on a page)
  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1);
  }, [inboxItems.length, totalPages, page]);

  const pagedInboxItems = inboxItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const syncIssue = syncStatus.asana || syncStatus.gcal
    ? summarizeSyncIssue(syncStatus.asana || syncStatus.gcal || '')
    : null;

  const hasReturnableTasks = plannedTasks.some(
    (t) => (t.source === 'asana' || t.source === 'local') && (t.status === 'committed' || t.status === 'scheduled')
  );
  const viewDateKey = format(viewDate, 'yyyy-MM-dd');

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'i') return;

      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      if (!selectedInboxId) return;

      if (event.altKey) {
        event.preventDefault();
        assignTaskToGoal(selectedInboxId, null);
        return;
      }

      if (weeklyGoals.length === 0) return;

      const task = plannedTasks.find((item) => item.id === selectedInboxId);
      const currentIndex = task?.weeklyGoalId ? weeklyGoals.findIndex((goal) => goal.id === task.weeklyGoalId) : -1;
      const nextGoal = weeklyGoals[(currentIndex + 1 + weeklyGoals.length) % weeklyGoals.length];
      if (!nextGoal) return;

      event.preventDefault();
      assignTaskToGoal(selectedInboxId, nextGoal.id);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assignTaskToGoal, plannedTasks, selectedInboxId, weeklyGoals]);

  function submitNewTask() {
    const nextId = addInboxTask(draftTitle);
    if (!nextId) return;
    setDraftTitle('');
    setIsComposing(false);
    setPage(0);
    selectInboxItem(nextId);
  }

  return (
    <div
      className={cn(
        'focus-dim gravity-dim bg-bg column-divider flex flex-col h-full w-full pt-[58px] px-1 transition-[opacity,border-width] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
        collapsed && 'opacity-0 pointer-events-none overflow-hidden border-r-0'
      )}
    >
      <div className="shrink-0">
        <div className="workspace-header pt-4 pb-5">
          <div className="workspace-header-copy">
            <h2 className="font-serif text-[22px] font-normal text-text-emphasis/80 leading-tight tracking-wide">
              Inbox
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {syncStatus.loading && <span className="workspace-header-meta">syncing</span>}
            <button
              onClick={() => void refreshExternalData()}
              className={cn(
                'rounded-md p-1.5 text-text-muted transition-colors hover:text-text-primary hover:bg-surface/50',
                syncStatus.loading && 'animate-spin pointer-events-none'
              )}
              title="Refresh sources"
              disabled={syncStatus.loading}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              className="rounded-md p-1.5 text-text-muted transition-colors hover:text-text-primary hover:bg-surface/50"
              title="Filter"
            >
              <Filter className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setIsComposing((value) => !value);
                setDraftTitle('');
              }}
              className="rounded-md p-1.5 text-text-muted transition-colors hover:text-text-primary hover:bg-surface/50"
              title={isComposing ? 'Close new task' : 'New task'}
            >
              {isComposing ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 px-6 pb-3">
          {([
            { key: 'all' as const, label: 'All', count: allInboxItems.length },
            { key: 'asana' as const, label: 'Asana' },
            { key: 'unscheduled' as const, label: 'Unscheduled' },
          ]).map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFilter(pill.key)}
              className={cn(
                'px-3 py-1 rounded-full text-[10px] uppercase tracking-wider transition-colors',
                filter === pill.key
                  ? 'bg-surface text-text-primary border border-border'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface/50'
              )}
            >
              {pill.label}{'count' in pill ? ` ${pill.count}` : ''}
            </button>
          ))}
        </div>
      </div>

      {isComposing && (
        <div className="px-5 py-3 border-b border-border-subtle bg-bg-card/40">
          <div className="flex items-center gap-2">
            <input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitNewTask();
                }
                if (event.key === 'Escape') {
                  setIsComposing(false);
                  setDraftTitle('');
                }
              }}
              autoFocus
              placeholder="Add a task to the inbox"
              className="flex-1 rounded-md border border-border-subtle bg-bg px-3 py-2 text-[13px] text-text-primary outline-none transition-colors placeholder:text-text-muted/40 focus:border-accent-warm/40"
            />
            <button
              onClick={submitNewTask}
              disabled={!draftTitle.trim()}
              className="rounded-md bg-accent-warm px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {syncIssue && (
        <div className="px-5 py-3 border-b border-border-subtle bg-accent-warm/[0.045]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{syncIssue.label}</div>
          <div className="mt-1 text-[11px] text-text-primary break-words leading-relaxed">
            {syncIssue.message}
          </div>
          <div className="mt-1 text-[10px] text-text-muted leading-relaxed">
            {syncIssue.hint}
          </div>
        </div>
      )}

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-0 hide-scrollbar min-h-0">
            {inboxItems.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-text-muted text-[13px] py-12">
                Nothing waiting here.
              </div>
            ) : (
              <>
                {pagedInboxItems.map((item, i) => (
                  <IncomingCard
                    key={item.id}
                    item={item}
                    selected={selectedInboxId === item.id}
                    onSelect={() => selectInboxItem(item.id)}
                    stagger={i + 1}
                  />
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-1 pt-1 pb-2">
                    <button
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page === 0}
                      className="px-2.5 py-1 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Prev
                    </button>
                    <span className="font-mono text-[10px] text-text-muted tracking-widest">
                      {page + 1} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded-md text-[11px] text-text-muted hover:text-text-primary hover:bg-bg-elevated/60 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Rituals section — always visible, supports mid-week creation */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1">
                <span className="section-lbl">Rituals</span>
                {rituals.length < MAX_RITUALS && !isAddingRitual && (
                  <button
                    onClick={() => setIsAddingRitual(true)}
                    className="text-[10px] text-text-muted/50 hover:text-accent-warm transition-colors"
                  >
                    + Add
                  </button>
                )}
              </div>

              {rituals.map((ritual) => {
                const ritualBlockId = `ritual-${ritual.id}`;
                const block = scheduleBlocks.find((b) => b.id === ritualBlockId || b.linkedTaskId === ritualBlockId);
                const isPlaced = !!block;
                const placedTime = block ? formatBlockTime(block.startHour, block.startMin) : '';
                const isSkipped = (ritual.skippedDates ?? []).includes(viewDateKey);
                return (
                  <RitualEntry
                    key={ritual.id}
                    ritual={ritual}
                    isPlaced={isPlaced}
                    placedTime={placedTime}
                    isSkipped={isSkipped}
                  />
                );
              })}

              {/* Inline ritual creation */}
              {isAddingRitual && (
                <div className="flex items-center gap-2 px-4 py-2">
                  <input
                    autoFocus
                    value={ritualDraft}
                    onChange={(e) => setRitualDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && ritualDraft.trim()) {
                        addRitual(ritualDraft.trim());
                        setRitualDraft('');
                        setIsAddingRitual(false);
                      }
                      if (e.key === 'Escape') {
                        setRitualDraft('');
                        setIsAddingRitual(false);
                      }
                    }}
                    placeholder="Ritual name…"
                    className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-muted/30 border-b border-border-subtle/50 focus:border-accent-warm/40 outline-none py-1 transition-colors"
                  />
                  <button
                    onClick={() => {
                      if (ritualDraft.trim()) {
                        addRitual(ritualDraft.trim());
                        setRitualDraft('');
                        setIsAddingRitual(false);
                      }
                    }}
                    className="text-[10px] text-accent-warm/70 hover:text-accent-warm transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}

              {rituals.length === 0 && !isAddingRitual && (
                <div className="px-4 py-2 text-[11px] text-text-muted/30 italic">
                  No rituals yet
                </div>
              )}

              {rituals.length >= MAX_RITUALS && (
                <div className="px-4 pt-1 text-[9px] text-text-muted/25 uppercase tracking-wider">
                  {MAX_RITUALS} / {MAX_RITUALS} rituals
                </div>
              )}
            </div>
          </div>
          {hasReturnableTasks && (
            <ReturnDropZone onDrop={(item) => { void returnTaskToInbox(item.id); }} />
          )}
        </div>

        {/* Zen flash removed — confusing interaction when dragging blocks */}
      </div>

      <div className="px-6 py-3 border-t border-border-subtle">
        <span className="editorial-pill inline-flex rounded-full px-3 py-1 text-[11px] text-text-muted font-mono">
          {allInboxItems.length} in queue
        </span>
      </div>
    </div>
  );
}
