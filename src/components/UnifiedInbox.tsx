import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import type { InboxItem } from '@/types';
import { AsanaIcon, GCalIcon, GmailIcon } from './AppIcons';

const SOURCE_ICONS: Record<string, React.ElementType> = {
  gmail: GmailIcon,
  asana: AsanaIcon,
  gcal: GCalIcon,
};

const SOURCE_COLORS: Record<string, string> = {
  gmail: 'text-text-muted',
  asana: 'text-text-muted',
  gcal: 'text-text-muted',
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

function IncomingCard({
  item,
  selected,
  onSelect,
  onBringForward,
  stagger,
}: {
  item: InboxItem;
  selected: boolean;
  onSelect: () => void;
  onBringForward: () => void;
  stagger: number;
}) {
  const { isLight, isFocus } = useTheme();
  const { plannedTasks } = useApp();
  const Icon = SOURCE_ICONS[item.source] || GmailIcon;
  const [flipped, setFlipped] = useState(false);

  const task = plannedTasks.find((t) => t.id === item.id);
  const notes = task?.notes ?? '';
  const project = task?.asanaProject ?? '';
  const notesPreview = notes.length > 120 ? notes.slice(0, 120) + '…' : notes;

  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: DragTypes.TASK,
    item: { id: item.id, title: item.title, priority: item.priority, sourceType: item.source },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);

  // Reset flip when card is deselected or source changes
  useEffect(() => {
    if (!selected) setFlipped(false);
  }, [selected]);

  function handleCardClick() {
    if (!flipped) {
      // First click: select and flip
      onSelect();
      setFlipped(true);
    }
  }

  return (
    <div
      ref={dragRef}
      style={{ perspective: '800px' }}
      className={cn(
        'animate-fade-in relative',
        stagger === 1 && 'stagger-1',
        stagger === 2 && 'stagger-2',
        stagger === 3 && 'stagger-3',
        stagger === 4 && 'stagger-4',
        isDragging && 'opacity-20'
      )}
    >
      {/* Flip container */}
      <div
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.45s cubic-bezier(0.4, 0.2, 0.2, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
          minHeight: '108px',
        }}
      >
        {/* FRONT FACE */}
        <div
          onClick={handleCardClick}
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className={cn(
            'editorial-card p-5 rounded-[18px] flex flex-col gap-2.5 transition-all duration-300 cursor-pointer group',
            selected
              ? isLight
                ? 'shadow-[0_18px_34px_rgba(120,113,100,0.12)]'
                : 'border-accent-warm/24 shadow-[0_0_26px_rgba(200,60,47,0.08),0_24px_42px_rgba(0,0,0,0.18)]'
              : cn(isLight ? 'hover:shadow-[0_16px_28px_rgba(120,113,100,0.08)]' : 'hover:border-border hover:shadow-[0_18px_32px_rgba(0,0,0,0.16)]'),
            !isDragging && 'hover:-translate-y-0.5'
          )}
        >
          <div className="flex items-center justify-between text-[10px] font-medium tracking-[0.14em] uppercase text-text-muted">
            <div className="flex items-center gap-2">
              <Icon className={cn('w-3 h-3', isFocus ? 'text-text-muted' : SOURCE_COLORS[item.source])} />
              <span>{item.source.toUpperCase()}</span>
            </div>
            {item.priority && (
              <span className={cn('px-1.5 py-0.5 rounded text-[10px]', isLight ? 'bg-bg text-text-muted' : 'bg-bg-elevated text-text-muted border border-border-subtle')}>
                {item.priority}
              </span>
            )}
          </div>

          <h4 className={cn('text-[14px] leading-snug font-medium transition-colors line-clamp-2', selected ? 'text-text-emphasis' : 'text-text-primary')}>
            {item.title}
          </h4>

          <div className="flex items-center justify-between">
            <div className="editorial-pill relative z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-text-muted">
              <div className="w-3 h-3 rounded-full border border-current opacity-40 flex items-center justify-center">
                <div className="w-1 h-1 bg-current rounded-full" />
              </div>
              <span>{item.time}</span>
            </div>
          </div>
        </div>

        {/* BACK FACE */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            position: 'absolute',
            inset: 0,
          }}
          className={cn(
            'editorial-card p-4 rounded-[18px] flex flex-col gap-2',
            isLight
              ? 'shadow-[0_18px_34px_rgba(120,113,100,0.12)]'
              : 'border-accent-warm/24 shadow-[0_0_26px_rgba(200,60,47,0.08),0_24px_42px_rgba(0,0,0,0.18)]'
          )}
        >
          {/* Back header: close button + title */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFlipped(false);
              }}
              className="shrink-0 p-0.5 rounded text-text-muted hover:text-text-primary transition-colors"
              aria-label="Flip back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[12px] font-medium text-text-primary truncate leading-snug flex-1">
              {item.title}
            </span>
          </div>

          {/* Detail rows */}
          <div className="flex flex-col gap-1.5 flex-1">
            {project && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted shrink-0">Project</span>
                <span className="text-[11px] text-text-primary truncate">{project}</span>
              </div>
            )}

            {notesPreview ? (
              <p className="text-[11px] text-text-muted leading-relaxed line-clamp-3 mt-0.5">
                {notesPreview}
              </p>
            ) : (
              <p className="text-[11px] text-text-muted/50 italic mt-0.5">No notes</p>
            )}
          </div>

          {/* Bring Forward — bottom of back face */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBringForward();
            }}
            className={cn(
              'mt-1 flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md text-[11px] font-medium transition-all',
              isLight
                ? 'bg-bg text-text-primary hover:bg-border/30'
                : 'bg-bg-elevated text-text-primary hover:bg-bg-hover border border-border-subtle'
            )}
          >
            Bring Forward
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CoverPanel() {
  return (
    <div className="flex-1 p-4">
      <div className="editorial-card h-full rounded-[26px] overflow-hidden relative bg-[#111214] shadow-[0_28px_72px_rgba(0,0,0,0.32)]">
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(55,63,69,0.94)_0%,rgba(101,87,58,0.76)_26%,rgba(173,116,40,0.72)_44%,rgba(34,35,39,0.98)_45%,rgba(10,12,16,1)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_31%_35%,rgba(255,212,104,0.92),rgba(255,171,46,0.6)_8%,rgba(223,131,41,0.18)_18%,transparent_30%)]" />
        <div className="absolute left-[28%] top-[33%] w-5 h-5 rounded-full bg-[#ffe08a] shadow-[0_0_30px_rgba(255,216,122,0.85)]" />
        <div className="absolute inset-0 border border-white/8" />
        <div className="absolute inset-x-0 top-[45%] h-px bg-black/30" />
        <div className="absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(to_bottom,rgba(13,18,25,0.2),rgba(3,6,10,0.96))]" />
        <div className="absolute inset-x-0 bottom-0 h-[44%] opacity-70 bg-[radial-gradient(ellipse_at_33%_0%,rgba(255,196,88,0.34),transparent_22%),repeating-linear-gradient(to_bottom,rgba(255,206,104,0.16)_0px,rgba(255,206,104,0.16)_2px,transparent_8px,transparent_15px)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%,transparent_75%,rgba(0,0,0,0.22))]" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Sources</div>
          <div className="text-[18px] text-white mt-3 leading-tight font-display italic">
            Pull from Asana when you're ready to see what's waiting.
          </div>
          <div className="text-[12px] text-white/62 mt-2 max-w-[220px] leading-relaxed">
            Let the queue stay at the waterline until you want it.
          </div>
        </div>
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
  );
}

const PAGE_SIZE = 7;

export function UnifiedInbox({ collapsed = false }: { collapsed?: boolean }) {
  const { isFocus } = useTheme();
  const { activeSource, candidateItems, plannedTasks, selectedInboxId, selectInboxItem, bringForward, releaseTask, lastCommitTimestamp, syncStatus } = useApp();

  const [showZen, setShowZen] = useState(false);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!lastCommitTimestamp) return;
    setShowZen(true);
    const timer = setTimeout(() => setShowZen(false), 1500);
    return () => clearTimeout(timer);
  }, [lastCommitTimestamp]);

  // Reset to first page when source switches
  useEffect(() => { setPage(0); }, [activeSource]);

  const asanaItems = candidateItems.filter((item) => item.source === 'asana');
  const totalPages = Math.ceil(asanaItems.length / PAGE_SIZE);

  // Clamp page if items shrink (e.g. after committing last item on a page)
  useEffect(() => {
    if (totalPages > 0 && page >= totalPages) setPage(totalPages - 1);
  }, [asanaItems.length, totalPages, page]);

  const pagedAsanaItems = asanaItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const syncIssue = syncStatus.asana || syncStatus.gcal
    ? summarizeSyncIssue(syncStatus.asana || syncStatus.gcal || '')
    : null;

  let title = 'Sources';
  let content: React.ReactNode = <CoverPanel />;

  if (activeSource === 'asana') {
    title = 'Asana';
    const hasCommittedAsanaTasks = plannedTasks.some(
      (t) => t.source === 'asana' && (t.status === 'committed' || t.status === 'scheduled')
    );
    content = (
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3 hide-scrollbar min-h-0">
          {asanaItems.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-text-muted text-[13px] py-12">
              Asana is clear. Either it's a good day, or sync hasn't run.
            </div>
          ) : (
            <>
              {pagedAsanaItems.map((item, i) => (
                <IncomingCard
                  key={item.id}
                  item={item}
                  selected={selectedInboxId === item.id}
                  onSelect={() => selectInboxItem(item.id)}
                  onBringForward={() => bringForward(item.id)}
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
        </div>
        {hasCommittedAsanaTasks && (
          <ReturnDropZone onDrop={(id) => releaseTask(id)} />
        )}
      </div>
    );
  }

  if (activeSource === 'gcal') {
    title = 'Google Calendar';
    content = <div className="flex-1 flex items-center justify-center text-text-muted text-[13px] px-6 text-center">Calendar holds the hard edges. This lane can open up next.</div>;
  }

  if (activeSource === 'gmail') {
    title = 'Gmail';
    content = <div className="flex-1 flex items-center justify-center text-text-muted text-[13px] px-6 text-center">Mail can wait until we decide how much of it belongs here.</div>;
  }

  return (
    <div
      className={cn(
        'focus-dim editorial-panel column-divider flex flex-col h-full shrink-0 transition-[width,min-width,opacity,border-width,colors] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] backdrop-blur-xl',
        collapsed
          ? 'w-0 min-w-0 opacity-0 pointer-events-none overflow-hidden border-r-0'
          : 'w-[clamp(280px,25vw,360px)]'
      )}
    >
      <div className="workspace-header shrink-0">
        <div className="workspace-header-copy">
          <div className="workspace-header-kicker">Source Center</div>
          <h2 className={cn('workspace-header-title transition-all duration-700', isFocus && 'font-display italic font-normal')}>
            {title}
          </h2>
        </div>
        {activeSource === 'asana' && syncStatus.loading && <span className="workspace-header-meta">syncing</span>}
      </div>

      {activeSource === 'asana' && syncIssue && (
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
        {content}

        {showZen && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(200,60,47,0.10),transparent_65%)] animate-zen-flash pointer-events-none">
            <span className="font-display italic text-[28px] text-accent-warm/50 tracking-wide">
              Held.
            </span>
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-border-subtle">
        <span className="editorial-pill inline-flex rounded-full px-3 py-1 text-[11px] text-text-muted font-mono">
          {activeSource === 'asana' ? `${asanaItems.length} in queue` : 'choose a source'}
        </span>
      </div>
    </div>
  );
}
