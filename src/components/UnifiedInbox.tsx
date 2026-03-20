import { useEffect, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import type { InboxItem } from '@/types';

const WORK_MODE_COLORS: Record<string, string> = {
  deep_work: '#C83C2F',
  collaborative: '#252B54',
  admin: '#9C9EA2',
  quick_win: '#5B8A8A',
};

const WORK_MODE_LABELS: Record<string, string> = {
  deep_work: 'DEEP WORK',
  collaborative: 'COLLABORATIVE',
  admin: 'ADMIN',
  quick_win: 'QUICK WIN',
};

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
  const { plannedTasks, weeklyGoals, scheduleBlocks } = useApp();

  const task = plannedTasks.find((t) => t.id === item.id);
  const rawNotes = task?.notes ?? '';
  const cleanNotes = rawNotes.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  const notesPreview = cleanNotes.length > 80 ? cleanNotes.slice(0, 80) + '…' : cleanNotes;
  const isPlaced = task?.status === 'scheduled';

  // Determine thread class from weeklyGoalId
  const goalId = task?.weeklyGoalId ?? null;
  let threadClass = 'thread-general';
  if (goalId && weeklyGoals.length > 0) {
    const goalIndex = weeklyGoals.findIndex((g) => g.id === goalId);
    if (goalIndex === 0) threadClass = 'thread-primary';
    else if (goalIndex === 1) threadClass = 'thread-secondary';
    else if (goalIndex === 2) threadClass = 'thread-tertiary';
  }

  // "Ink recommends" — task matches the day's primary goal
  const isPrimaryGoal = goalId != null && weeklyGoals.length > 0 && weeklyGoals[0].id === goalId;

  const workMode = item.workMode;
  const workModeColor = workMode ? WORK_MODE_COLORS[workMode] : undefined;
  const workModeLabel = workMode ? WORK_MODE_LABELS[workMode] : undefined;

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
        'animate-fade-in relative',
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
          'note-entry',
          threadClass,
          isPlaced && 'placed',
          selected && 'bg-[rgba(250,250,250,0.03)]'
        )}
        style={workModeColor ? { borderLeftColor: workModeColor } : undefined}
      >
        <div className="font-sans text-[13px] text-[#FAFAFA]/70 leading-snug">
          {item.title}
        </div>

        {workModeLabel && !isPlaced && (
          <div
            className="font-sans text-[9px] uppercase tracking-[0.16em] font-medium mt-1.5"
            style={{ color: workModeColor, opacity: 0.7 }}
          >
            {workModeLabel}
          </div>
        )}

        {isPlaced && placedTime && (
          <div className="font-sans text-[11px] text-text-muted/40 mt-1">
            Placed · {placedTime}
          </div>
        )}

        {notesPreview && !isPlaced && (
          <div className="font-sans text-[12px] text-text-muted/45 leading-relaxed mt-1.5 font-light line-clamp-2">
            {notesPreview}
          </div>
        )}

        {isPrimaryGoal && !isPlaced && (
          <div className="flex items-center gap-1.5 mt-2.5 font-sans text-[10px] text-[#ff9786]/55">
            <span style={{ fontSize: 8 }}>&#10022;</span> Ink recommends
          </div>
        )}

        {!isPlaced && (
          <div className="font-sans text-[9px] uppercase tracking-[0.12em] text-text-muted/30 mt-1.5">
            {item.source === 'asana' ? 'ASANA' : item.source === 'gcal' ? 'CALENDAR' : item.source.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

function RitualEntry({
  ritual,
  isPlaced,
  placedTime,
}: {
  ritual: { id: string; title: string; estimateMins?: number };
  isPlaced: boolean;
  placedTime: string;
}) {
  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: DragTypes.TASK,
    item: { id: ritual.id, title: ritual.title, sourceType: 'local' as const },
    canDrag: !isPlaced,
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);

  return (
    <div
      ref={dragRef}
      className={cn('animate-fade-in relative', isDragging && 'opacity-20')}
    >
      <div className={cn('note-entry thread-general', isPlaced && 'placed')}>
        <div className="font-sans text-[13px] text-[#FAFAFA]/70 leading-snug">
          {ritual.title}
        </div>
        {isPlaced && placedTime && (
          <div className="font-sans text-[11px] text-text-muted/40 mt-1">
            Placed · {placedTime}
          </div>
        )}
        {ritual.estimateMins && !isPlaced && (
          <div className="font-sans text-[12px] text-text-muted/45 leading-relaxed mt-1.5 font-light">
            {ritual.estimateMins} min
          </div>
        )}
      </div>
    </div>
  );
}

function ReturnDropZone({ onDrop }: { onDrop: (itemId: string) => void }) {
  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, unknown, { isOver: boolean; canDrop: boolean }>({
    accept: DragTypes.TASK,
    canDrop: (item) => item.sourceType === 'asana',
    drop: (item) => { onDrop(item.id); },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div className="relative mt-2 px-4">
      {/* Hand-drawn underline vector substituting a rigid 1px border */}
      <svg className="absolute -top-3 left-0 right-0 w-full h-3 text-border pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 10">
        <path d="M0 5 Q 25 3, 50 6 T 100 4" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.6" strokeLinecap="round" />
      </svg>
      <div
      ref={dropRef}
      className={cn(
        'mx-4 mb-3 rounded-xl border border-dashed flex items-center justify-center px-3 py-3 text-[11px] font-medium tracking-[0.08em] uppercase transition-all duration-200',
        isOver && canDrop
          ? 'border-accent-warm/60 bg-accent-warm/10 text-accent-warm'
          : canDrop
          ? 'border-border text-text-muted opacity-60'
          : 'border-border-subtle text-text-muted opacity-30'
      )}
    >
      Return to inbox
      </div>
    </div>
  );
}

const PAGE_SIZE = 7;

export function UnifiedInbox({ collapsed = false }: { collapsed?: boolean }) {
  const { candidateItems, plannedTasks, selectedInboxId, selectInboxItem, releaseTask, lastCommitTimestamp, syncStatus, rituals, scheduleBlocks } = useApp();

  const [showZen, setShowZen] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!lastCommitTimestamp) return;
    setShowZen(true);
    const timer = setTimeout(() => setShowZen(false), 1500);
    return () => clearTimeout(timer);
  }, [lastCommitTimestamp]);

  const inboxItems = candidateItems.filter((item) => item.source === 'asana' || item.source === 'local');
  const totalPages = Math.ceil(inboxItems.length / PAGE_SIZE);

  // Clamp page if items shrink (e.g. after committing last item on a page)
  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1);
  }, [inboxItems.length, totalPages, page]);

  const pagedInboxItems = inboxItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const syncIssue = syncStatus.asana || syncStatus.gcal
    ? summarizeSyncIssue(syncStatus.asana || syncStatus.gcal || '')
    : null;

  const hasCommittedAsanaTasks = plannedTasks.some(
    (t) => t.source === 'asana' && (t.status === 'committed' || t.status === 'scheduled')
  );

  return (
    <div
      className={cn(
        'focus-dim bg-bg column-divider flex flex-col h-full w-full transition-[opacity,border-width] duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]',
        collapsed && 'opacity-0 pointer-events-none overflow-hidden border-r-0'
      )}
    >
      <div className="shrink-0">
        <div className="workspace-header">
          <div className="workspace-header-copy">
            <h2 className="font-display text-[22px] font-normal text-[#c8c6c2] leading-tight">
              Inbox{' '}
              <span className="font-sans text-[13px] font-normal text-text-muted/40">
                · {inboxItems.length}
              </span>
            </h2>
            <span className="section-lbl mt-2" style={{ marginBottom: 0 }}>Ready to ink</span>
          </div>
          {syncStatus.loading && <span className="workspace-header-meta">syncing</span>}
        </div>
      </div>

      {syncIssue && (
        <div className="px-4 py-3 border-b border-border-subtle bg-accent-warm/[0.045]">
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
          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-0 hide-scrollbar min-h-0">
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

            {/* Rituals section */}
            {rituals.length > 0 && (
              <>
                <span className="section-lbl mt-5 mb-1">Rituals</span>
                {rituals.map((ritual) => {
                  const ritualBlockId = `ritual-${ritual.id}`;
                  const block = scheduleBlocks.find((b) => b.id === ritualBlockId || b.linkedTaskId === ritualBlockId);
                  const isPlaced = !!block;
                  const placedTime = block ? formatBlockTime(block.startHour, block.startMin) : '';
                  return (
                    <RitualEntry
                      key={ritual.id}
                      ritual={ritual}
                      isPlaced={isPlaced}
                      placedTime={placedTime}
                    />
                  );
                })}
              </>
            )}
          </div>
          {hasCommittedAsanaTasks && (
            <ReturnDropZone onDrop={(id) => { void releaseTask(id); }} />
          )}
        </div>

        {showZen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-accent-warm/[0.07] animate-zen-flash pointer-events-none">
            <span className="font-display italic text-[28px] text-accent-warm/50 tracking-wide">
              Held.
            </span>
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-border-subtle">
        <span className="editorial-pill inline-flex rounded-full px-3 py-1 text-[11px] text-text-muted font-mono">
          {inboxItems.length} in queue
        </span>
      </div>
    </div>
  );
}
