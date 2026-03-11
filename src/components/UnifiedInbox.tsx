import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useDrag } from 'react-dnd';
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
  gmail: 'text-source-gmail',
  asana: 'text-source-asana',
  gcal: 'text-source-gcal',
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
  const Icon = SOURCE_ICONS[item.source] || GmailIcon;
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
      onClick={onSelect}
      className={cn(
        'editorial-card animate-fade-in relative overflow-hidden p-5 rounded-[18px] flex flex-col gap-2.5 transition-all duration-300 cursor-grab active:cursor-grabbing group',
        selected
          ? isLight
            ? 'shadow-[0_18px_34px_rgba(120,113,100,0.12)]'
            : 'border-accent-warm/24 shadow-[0_0_26px_rgba(200,60,47,0.08),0_24px_42px_rgba(0,0,0,0.18)]'
          : cn(isLight ? 'hover:shadow-[0_16px_28px_rgba(120,113,100,0.08)]' : 'hover:border-border hover:shadow-[0_18px_32px_rgba(0,0,0,0.16)]'),
        isDragging && 'opacity-20 scale-95 rotate-[1deg]',
        !isDragging && 'hover:-translate-y-0.5',
        stagger === 1 && 'stagger-1',
        stagger === 2 && 'stagger-2',
        stagger === 3 && 'stagger-3',
        stagger === 4 && 'stagger-4'
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

        {selected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBringForward();
            }}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all animate-slide-down',
              isLight ? 'bg-bg text-text-primary hover:bg-border/30' : 'bg-bg-card text-text-primary hover:bg-bg-elevated'
            )}
          >
            Bring Forward
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
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

export function UnifiedInbox({ collapsed = false }: { collapsed?: boolean }) {
  const { isFocus } = useTheme();
  const { activeSource, candidateItems, selectedInboxId, selectInboxItem, bringForward, lastCommitTimestamp, syncStatus } = useApp();

  const [showZen, setShowZen] = useState(false);
  useEffect(() => {
    if (!lastCommitTimestamp) return;
    setShowZen(true);
    const timer = setTimeout(() => setShowZen(false), 1500);
    return () => clearTimeout(timer);
  }, [lastCommitTimestamp]);

  const asanaItems = candidateItems.filter((item) => item.source === 'asana');
  const syncIssue = syncStatus.asana || syncStatus.gcal
    ? summarizeSyncIssue(syncStatus.asana || syncStatus.gcal || '')
    : null;

  let title = 'Sources';
  let content: React.ReactNode = <CoverPanel />;

  if (activeSource === 'asana') {
    title = 'Asana';
    content = (
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-3 hide-scrollbar">
        {asanaItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-text-muted text-[13px] py-12">
            Asana is clear. Either it's a good day, or sync hasn't run.
          </div>
        ) : (
          asanaItems.map((item, i) => (
            <IncomingCard
              key={item.id}
              item={item}
              selected={selectedInboxId === item.id}
              onSelect={() => selectInboxItem(item.id)}
              onBringForward={() => bringForward(item.id)}
              stagger={i + 1}
            />
          ))
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

      <div className="relative flex-1 min-h-0">
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
