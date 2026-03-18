import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, GripVertical, Play, Check, RefreshCw } from 'lucide-react';
import { useDrag } from 'react-dnd';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { cn, formatRoundedHours } from '@/lib/utils';
import { CALENDAR_GRID_SNAP_MINS, planFocusCascade, snapToCalendarGrid } from '@/lib/planner';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { useSound } from '@/hooks/useSound';
import type { PomodoroState, ScheduleBlock } from '@/types';
import { GCalIcon } from './AppIcons';

const HOUR_HEIGHT = 96;
const GRID_SNAP_MINS = CALENDAR_GRID_SNAP_MINS;

function clampMinutes(totalMinutes: number, dayStartMins: number, dayEndMins: number, maxDurationMins = 0): number {
  return Math.min(Math.max(totalMinutes, dayStartMins), dayEndMins - maxDurationMins);
}

function timeToTop(totalMinutes: number, dayStartMins: number): number {
  return ((totalMinutes - dayStartMins) / 60) * HOUR_HEIGHT;
}

function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const min = m.toString().padStart(2, '0');
  return `${hour}:${min} ${ampm}`;
}

function formatTimeShort(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function getStepMins(durationMins: number): number {
  if (durationMins < 60) return 15;
  if (durationMins < 120) return 30;
  return 60;
}

function FocusSetMeter({ durationMins }: { durationMins: number }) {
  const setCount = Math.max(1, Math.round(durationMins / 25));

  return (
    <div className="flex items-center gap-2 rounded-full border border-accent-warm/18 bg-black/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-muted/90 focus-fade-meta">
      <div className="flex items-center gap-1">
        {Array.from({ length: setCount }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-1.5 rounded-full bg-accent-warm/70',
              index === 0 ? 'w-4' : 'w-2'
            )}
          />
        ))}
      </div>
      <span>{setCount} focus set{setCount === 1 ? '' : 's'}</span>
    </div>
  );
}

function BlockCard({
  block,
  onRemove,
  onUpdate,
  onUpdateDuration,
  resolvePlacement,
  stagger = 0,
  isNow = false,
  actualMins = 0,
  dayStartMins,
  dayEndMins,
}: {
  block: ScheduleBlock;
  onRemove: () => void;
  onUpdate: (startHour: number, startMin: number, durationMins: number) => void;
  onUpdateDuration?: (durationMins: number) => void;
  resolvePlacement: (rawMinutes: number, durationMins: number, targetBlockId?: string) => { startHour: number; startMin: number };
  stagger?: number;
  isNow?: boolean;
  actualMins?: number;
  dayStartMins: number;
  dayEndMins: number;
}) {
  const { isLight, isFocus } = useTheme();
  const { plannedTasks, setActiveTask, toggleTask } = useApp();
  const linkedTask = block.linkedTaskId ? plannedTasks.find((task) => task.id === block.linkedTaskId) : null;
  const isDone = linkedTask?.status === 'done';
  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: DragTypes.BLOCK,
    canDrag: !block.readOnly && !isDone && Boolean(block.linkedTaskId),
    item: {
      id: block.linkedTaskId || block.id,
      title: block.title,
      blockId: block.id,
      linkedTaskId: block.linkedTaskId,
      sourceType: block.source,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);
  const [draft, setDraft] = useState<{ startHour: number; startMin: number; durationMins: number } | null>(null);
  const draftRef = useRef<{ startHour: number; startMin: number; durationMins: number } | null>(null);
  const didDragRef = useRef(false);
  const top = timeToTop(((draft?.startHour ?? block.startHour) * 60) + (draft?.startMin ?? block.startMin), dayStartMins);
  const height = ((draft?.durationMins ?? block.durationMins) / 60) * HOUR_HEIGHT;
  const isShortBlock = height < 110;
  const actualLabel = actualMins > 0 ? formatRoundedHours(actualMins, true) : null;

  function beginDrag(event: React.MouseEvent<HTMLDivElement>) {
    if (block.readOnly || isDone) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    event.preventDefault();
    didDragRef.current = false;
    const startY = event.clientY;
    const baseMinutes = block.startHour * 60 + block.startMin;

    function onMove(moveEvent: MouseEvent) {
      const deltaY = moveEvent.clientY - startY;
      if (Math.abs(deltaY) > 4) didDragRef.current = true;
      const rawMinutes = baseMinutes + (deltaY / HOUR_HEIGHT) * 60;
      const placement = resolvePlacement(rawMinutes, block.durationMins, block.id);
      const nextDraft = {
        startHour: placement.startHour,
        startMin: placement.startMin,
        durationMins: block.durationMins,
      };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (draftRef.current) onUpdate(draftRef.current.startHour, draftRef.current.startMin, draftRef.current.durationMins);
      draftRef.current = null;
      setDraft(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function beginResize(event: React.MouseEvent<HTMLDivElement>) {
    if (block.readOnly || isDone) return;
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const baseDuration = block.durationMins;

    function onMove(moveEvent: MouseEvent) {
      const deltaY = moveEvent.clientY - startY;
      const pixelsPerSnap = HOUR_HEIGHT * (GRID_SNAP_MINS / 60);
      const step = Math.round(deltaY / pixelsPerSnap) * GRID_SNAP_MINS;
      const nextDuration = Math.max(GRID_SNAP_MINS, baseDuration + step);
      const maxDuration = dayEndMins - (block.startHour * 60 + block.startMin);
      const placement = resolvePlacement(block.startHour * 60 + block.startMin, Math.min(nextDuration, maxDuration), block.id);
      const nextDraft = {
        startHour: placement.startHour,
        startMin: placement.startMin,
        durationMins: Math.min(nextDuration, maxDuration),
      };
      draftRef.current = nextDraft;
      setDraft(nextDraft);
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (draftRef.current) onUpdate(draftRef.current.startHour, draftRef.current.startMin, draftRef.current.durationMins);
      draftRef.current = null;
      setDraft(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function startFocus(event: React.MouseEvent<HTMLButtonElement>) {
    if (!block.linkedTaskId || block.readOnly || isDone) return;
    event.stopPropagation();
    setActiveTask(block.linkedTaskId);
    void window.api.window.showPomodoro();
    void window.api.pomodoro.start(block.linkedTaskId, block.title);
    void window.api.window.activate();
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (didDragRef.current) { didDragRef.current = false; return; }
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    if (!block.linkedTaskId || block.readOnly || isDone) return;
    setActiveTask(block.linkedTaskId);
    void window.api.window.showPomodoro();
    void window.api.pomodoro.start(block.linkedTaskId, block.title);
    void window.api.window.activate();
  }

  function handleToggleTask(event: React.MouseEvent<HTMLButtonElement>) {
    if (!block.linkedTaskId || block.readOnly) return;
    event.stopPropagation();
    void toggleTask(block.linkedTaskId);
  }

  return (
    <div
      data-task-id={block.linkedTaskId || undefined}
      onMouseDown={beginDrag}
      onClick={handleClick}
      className={cn(
        'editorial-card animate-fade-in absolute left-4 right-4 overflow-hidden rounded-[8px] p-4 flex flex-col gap-1.5 transition-all duration-300 group/block',
        isFocus && block.kind !== 'hard' && 'focus-block-card',
        block.kind === 'break'
          ? isLight
            ? 'border-l-[3px] border-l-text-muted/40 opacity-75'
            : 'border-l-[3px] border-l-text-muted/30 opacity-70'
          : block.kind !== 'hard'
            ? isLight
              ? 'border-l-[3px] border-l-accent-warm'
              : 'border-l-[3px] border-l-accent-warm/60'
            : '',
        stagger === 1 && 'stagger-2',
        stagger === 2 && 'stagger-3',
        stagger === 3 && 'stagger-4',
        isDragging && 'opacity-30 scale-[0.98]',
        isDone && 'opacity-70 saturate-[0.8]',
        isNow && !isDragging && 'ring-1 ring-active/40'
      )}
      style={{ top: `${top}px`, height: `${height}px` }}
    >
      {!block.readOnly && block.linkedTaskId && !isDone && (
        <button
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={startFocus}
          className="absolute top-2 right-16 rounded-md bg-black/15 p-1 text-text-muted/80 hover:text-accent-warm hover:bg-bg-card opacity-100 md:opacity-70 md:group-hover/block:opacity-100 transition-all"
          title="Start focus"
        >
          <Play className="w-3 h-3 fill-current" />
        </button>
      )}
      {!block.readOnly && block.linkedTaskId && (
        <button
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={handleToggleTask}
          className={cn(
            'absolute top-2 right-9 rounded-md p-1 transition-all',
            isDone
              ? 'bg-accent-warm/18 text-accent-warm opacity-100'
              : 'bg-black/15 text-text-muted/80 opacity-100 md:opacity-70 md:group-hover/block:opacity-100 hover:text-text-primary hover:bg-bg-card'
          )}
          title={isDone ? 'Mark incomplete' : 'Mark done'}
        >
          <Check className="w-3 h-3" />
        </button>
      )}
      {!block.readOnly && (
        <button
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove from schedule"
          className="absolute top-2 right-2 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-card opacity-0 group-hover/block:opacity-100 transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <div className="relative z-10 flex items-start gap-2 pr-6">
        {!block.readOnly && !isDone && (
        <button
          ref={dragRef}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className={cn(
              'mt-0.5 -ml-1 rounded-md text-text-muted/80 hover:text-text-primary hover:bg-bg-card cursor-grab active:cursor-grabbing transition-all',
              isShortBlock ? 'p-1' : 'px-1.5 py-1 flex items-center gap-1.5'
            )}
            title="Drag back to commit list"
        >
            <GripVertical className="w-3 h-3" />
            {!isShortBlock && <span className="text-[10px] uppercase tracking-[0.14em]">Return</span>}
          </button>
        )}
        <h4 className={cn('text-[13px] font-medium truncate focus-editorial', isDone ? 'text-text-muted line-through' : 'text-text-primary')}>{block.title}</h4>
      </div>
      <div className="relative z-10 text-[10px] font-mono text-text-muted whitespace-nowrap focus-fade-meta">
        {formatTime(block.startHour, block.startMin)} - {formatTime(
          block.startHour + Math.floor((block.startMin + block.durationMins) / 60),
          (block.startMin + block.durationMins) % 60
        )}
      </div>
      <div className="relative z-10 flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted/70 whitespace-nowrap focus-fade-meta">
        <span className="flex items-center gap-1.5">
          {block.kind === 'hard' ? (
            <GCalIcon className="w-4 h-4 shrink-0 text-accent-warm/40" />
          ) : block.kind === 'break' ? (
            'ritual'
          ) : (
            'focus block'
          )}
        </span>
        {isDone && (
          <span className="flex items-center gap-1 rounded-full border border-white/6 bg-black/15 px-2 py-0.5 normal-case tracking-normal text-text-muted/90">
            <Check className="h-3 w-3" />
            done
          </span>
        )}
        {actualLabel && block.kind === 'focus' && (
          <span className="rounded-full border border-white/6 bg-black/15 px-2 py-0.5 normal-case tracking-normal text-text-muted/90">
            {actualLabel} worked
          </span>
        )}
      </div>
      {onUpdateDuration && !isDone && block.durationMins >= 15 && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 opacity-0 group-hover/block:opacity-100 transition-opacity z-10"
        >
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateDuration(Math.max(15, block.durationMins - getStepMins(block.durationMins))); }}
            disabled={block.durationMins <= 15}
            className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1 disabled:opacity-30"
          >
            –
          </button>
          <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-muted/90">
            {block.durationMins} min
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateDuration(block.durationMins + getStepMins(block.durationMins)); }}
            className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1"
          >
            +
          </button>
        </div>
      )}
      {!block.readOnly && !isDone && block.linkedTaskId && block.durationMins >= 15 && (() => {
        return (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 opacity-0 group-hover/block:opacity-100 transition-opacity z-10"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(block.startHour, block.startMin, Math.max(15, block.durationMins - getStepMins(block.durationMins))); }}
              disabled={block.durationMins <= 15}
              className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1 disabled:opacity-30"
            >
              –
            </button>
            <FocusSetMeter durationMins={block.durationMins} />
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(block.startHour, block.startMin, block.durationMins + getStepMins(block.durationMins)); }}
              className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1"
            >
              +
            </button>
          </div>
        );
      })()}
      {!block.readOnly && !isDone && (
        <div
          onMouseDown={beginResize}
          className="absolute left-3 right-3 bottom-1 h-2 cursor-row-resize rounded-full bg-accent-warm/20 opacity-0 group-hover/block:opacity-100 transition-opacity"
        />
      )}
    </div>
  );
}

function CurrentTimeIndicator({
  dayStartMins,
  dayEndMins,
}: {
  dayStartMins: number;
  dayEndMins: number;
}) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentMinutes = currentHour * 60 + currentMin;
  if (currentMinutes < dayStartMins || currentMinutes >= dayEndMins) return null;

  const top = timeToTop(currentMinutes, dayStartMins);

  return (
    <div className="absolute left-0 right-0 flex items-center z-10 pointer-events-none" style={{ top: `${top}px` }} id="now-indicator">
      <div className="w-20 text-[10px] font-mono text-right pr-2 text-active focus-editorial">
        {formatTime(currentHour, currentMin)}
      </div>
      <div className="flex-1 relative">
        <div className="w-full border-t border-active" />
        <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-active animate-time-pulse" />
      </div>
    </div>
  );
}

const LIFE_EVENT_RE = /birthday|party|anniversary|wedding|graduation|holiday|vacation|trip/i;

function DeadlineMargin({ layout = 'vertical' }: { layout?: 'horizontal' | 'vertical' }) {
  const { countdowns } = useApp();
  const today = new Date();

  const items = countdowns
    .map((c) => ({ ...c, days: differenceInCalendarDays(parseISO(c.dueDate), today) }))
    .filter((c) => c.days >= 0)
    .sort((a, b) => a.days - b.days);

  if (items.length === 0) return null;

  if (layout === 'horizontal') {
    return (
      <div
        className="shrink-0 flex items-center gap-6 overflow-x-auto hide-scrollbar"
        style={{
          borderBottom: '0.5px solid rgba(255,255,255,0.04)',
          padding: '10px 20px',
        }}
      >
        <div
          style={{
            fontSize: 8,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: 'rgba(130,120,100,0.25)',
            whiteSpace: 'nowrap',
          }}
        >
          Upcoming
        </div>
        {items.map((item) => {
          const isLife = LIFE_EVENT_RE.test(item.title);
          return (
            <div key={item.id} className="flex items-baseline gap-2 shrink-0">
              <span
                className="font-display italic text-[14px] leading-none"
                style={{ color: isLife ? 'rgba(110,135,175,0.65)' : 'rgba(190,90,55,0.8)' }}
              >
                {item.days}d
              </span>
              <span
                className="text-[10px] leading-none"
                style={{
                  color: 'rgba(160,150,130,0.5)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 120,
                }}
              >
                {item.title}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical layout (focus mode — 1/3 column)
  return (
    <div
      className="shrink-0 flex flex-col overflow-y-auto hide-scrollbar"
      style={{
        width: '33%',
        minWidth: 140,
        borderLeft: '0.5px solid rgba(255,255,255,0.04)',
        padding: '16px 0 8px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          fontSize: 8,
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          color: 'rgba(130,120,100,0.25)',
          padding: '0 14px 10px',
          whiteSpace: 'nowrap',
        }}
      >
        Upcoming
      </div>
      {items.map((item) => {
        const isLife = LIFE_EVENT_RE.test(item.title);
        return (
          <div
            key={item.id}
            style={{
              padding: '8px 14px',
              borderBottom: '0.5px solid rgba(255,255,255,0.03)',
              overflow: 'hidden',
            }}
          >
            <div
              className="font-display italic text-[16px] leading-none"
              style={{
                color: isLife ? 'rgba(110,135,175,0.65)' : 'rgba(190,90,55,0.8)',
                marginBottom: 3,
                whiteSpace: 'nowrap',
              }}
            >
              {item.days}d
            </div>
            <div
              className="text-[10px] leading-[1.35]"
              style={{
                color: 'rgba(160,150,130,0.5)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.title}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AfterHoursVeil({
  workdayStart,
  workdayEnd,
  onEdit,
  isLight,
  isPastClose,
  minutesPastClose,
}: {
  workdayStart: { hour: number; min: number };
  workdayEnd: { hour: number; min: number };
  onEdit: () => void;
  isLight: boolean;
  isPastClose: boolean;
  minutesPastClose: number;
}) {
  const endMinutes = workdayEnd.hour * 60 + workdayEnd.min;
  const top = timeToTop(endMinutes, workdayStart.hour * 60 + workdayStart.min);
  const overrunHours = Math.floor(minutesPastClose / 60);
  const overrunMinutes = minutesPastClose % 60;
  const overrunLabel = overrunHours > 0 ? `${overrunHours}h ${overrunMinutes}m` : `${overrunMinutes}m`;

  return (
    <div
      className="absolute left-20 right-0 bottom-0 pointer-events-none z-[5]"
      style={{ top: `${top}px` }}
    >
      <button
        onClick={onEdit}
        className={cn(
          'pointer-events-auto absolute left-4 -top-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] transition-all hover:text-text-primary',
          isLight
            ? 'border-stone-300/70 bg-white/92 text-stone-500 hover:border-stone-400/80'
            : 'border-border bg-bg-elevated/90 text-text-muted hover:border-border'
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', isPastClose ? 'bg-accent-warm' : 'bg-accent-warm/70')} />
        {isPastClose ? `Day closed ${overrunLabel} ago` : `Day closes ${formatTime(workdayEnd.hour, workdayEnd.min)}`}
      </button>
      <div className="absolute inset-x-0 top-0 h-0.5 mt-[0px]">
        <svg className="absolute top-[-5px] left-0 right-0 w-full h-[10px] pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 10">
          <path 
            d="M0 5 Q 25 4.5, 50 6 T 100 5" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="0.8" 
            opacity="0.6" 
            strokeLinecap="round" 
            className={cn(
              isLight
                ? isPastClose
                  ? 'text-amber-400'
                  : 'text-stone-300'
                : isPastClose
                  ? 'text-accent-warm'
                  : 'text-border'
            )} 
          />
        </svg>
      </div>
      <div
        className={cn(
          'absolute inset-0',
          isLight
            ? isPastClose ? 'bg-[rgba(196,132,78,0.04)]' : 'bg-[rgba(176,112,88,0.03)]'
            : isPastClose ? 'bg-[rgba(200,60,47,0.06)]' : 'bg-[rgba(10,10,10,0.55)]'
        )}
      />
    </div>
  );
}

export function Timeline() {
  const { isLight, isFocus } = useTheme();
  const {
    scheduleBlocks,
    scheduleTaskBlock,
    updateScheduleBlock,
    removeScheduleBlock,
    updateRitualEstimate,
    currentBlock,
    workdayStart,
    setWorkdayStart,
    workdayEnd,
    setWorkdayEnd,
    timeLogs,
    refreshExternalData,
    syncStatus,
  } = useApp();
  const { play } = useSound();
  const gridRef = useRef<HTMLDivElement>(null);
  // Keep a ref so useDrop collect/drop always see the latest blocks (avoids stale closure)
  const scheduleBlocksRef = useRef(scheduleBlocks);
  useEffect(() => { scheduleBlocksRef.current = scheduleBlocks; }, [scheduleBlocks]);
  const dayStartMins = workdayStart.hour * 60 + workdayStart.min;
  const requestedDayEndMins = workdayEnd.hour * 60 + workdayEnd.min;
  const dayEndMins = Math.max(dayStartMins + 60, requestedDayEndMins);
  const hourRows = useMemo(() => {
    const rowCount = Math.max(1, Math.ceil((dayEndMins - dayStartMins) / 60));
    return Array.from({ length: rowCount }, (_, index) => dayStartMins + index * 60);
  }, [dayEndMins, dayStartMins]);
  const totalHeight = hourRows.length * HOUR_HEIGHT;
  const [isEditingStart, setIsEditingStart] = useState(false);
  const [isEditingEnd, setIsEditingEnd] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [minutesPastClose, setMinutesPastClose] = useState(0);
  const [livePomodoro, setLivePomodoro] = useState<PomodoroState | null>(null);

  useEffect(() => {
    function computeDayBoundaryState() {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const endMins = workdayEnd.hour * 60 + workdayEnd.min;
      const remaining = endMins - nowMins;
      if (remaining <= 0) {
        const overMins = Math.abs(remaining);
        const overH = Math.floor(overMins / 60);
        const overM = overMins % 60;
        const overLabel = overH > 0 ? `${overH}h ${overM}m` : `${overM}m`;
        return {
          label: `${overLabel} past close`,
          pastClose: overMins,
        };
      }
      const h = Math.floor(remaining / 60);
      const m = remaining % 60;
      return {
        label: h > 0 ? `${h}h ${m}m left` : `${m}m left`,
        pastClose: 0,
      };
    }

    const updateBoundaryState = () => {
      const next = computeDayBoundaryState();
      setTimeLeft(next.label);
      setMinutesPastClose(next.pastClose);
    };

    updateBoundaryState();
    const id = setInterval(updateBoundaryState, 60000);
    return () => clearInterval(id);
  }, [workdayEnd]);

  useEffect(() => {
    const unsubscribe = window.api.pomodoro.onTick((state) => {
      setLivePomodoro(state as PomodoroState);
    });
    return unsubscribe;
  }, []);

  const focusMinutes = scheduleBlocks
    .filter((block) => block.kind === 'focus')
    .reduce((sum, block) => sum + block.durationMins, 0);
  const committedLabel = formatRoundedHours(focusMinutes, true);
  const actualByTask = useMemo(() => {
    const totals = new Map<string, number>();
    for (const log of timeLogs) {
      if (!log.taskId) continue;
      totals.set(log.taskId, (totals.get(log.taskId) || 0) + log.durationMins);
    }
    return totals;
  }, [timeLogs]);
  const liveElapsedMins =
    livePomodoro && livePomodoro.isRunning && !livePomodoro.isPaused && !livePomodoro.isBreak && livePomodoro.currentTaskId
      ? Math.max(0, Math.floor((livePomodoro.totalTime - livePomodoro.timeRemaining) / 60))
      : 0;

  const currentBlockId = currentBlock?.id ?? null;

  const resolvePlacement = useCallback((rawMinutes: number, durationMins: number, targetBlockId?: string) => {
    const snappedMinutes = snapToCalendarGrid(rawMinutes, GRID_SNAP_MINS);
    const desiredMinutes = clampMinutes(snappedMinutes, dayStartMins, dayEndMins, durationMins);
    const cascadePlan = planFocusCascade(
      Math.floor(desiredMinutes / 60),
      desiredMinutes % 60,
      durationMins,
      scheduleBlocksRef.current,
      targetBlockId
    );

    return {
      startHour: cascadePlan.startHour,
      startMin: cascadePlan.startMin,
    };
  }, [dayEndMins, dayStartMins]);

  const [{ isOver, ghostBlock }, dropRef] = useDrop<DragItem, void, { isOver: boolean; ghostBlock: { startHour: number; startMin: number } | null }>({
    accept: DragTypes.TASK,
    collect: (monitor) => {
      const offset = monitor.getClientOffset();
      const isOver = monitor.isOver();

      if (!isOver || !offset || !gridRef.current) return { isOver, ghostBlock: null };

      const rect = gridRef.current.getBoundingClientRect();
      const scrollTop = gridRef.current.scrollTop;
      const y = offset.y - rect.top + scrollTop;
      const rawMinutes = (y / HOUR_HEIGHT) * 60 + dayStartMins;
      const placement = resolvePlacement(rawMinutes, 60);

      return {
        isOver,
        ghostBlock: {
          startHour: placement.startHour,
          startMin: placement.startMin,
        },
      };
    },
    drop: (item, monitor) => {
      const offset = monitor.getClientOffset();
      if (!offset || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const scrollTop = gridRef.current.scrollTop;
      const y = offset.y - rect.top + scrollTop;
      const rawMinutes = (y / HOUR_HEIGHT) * 60 + dayStartMins;
      const placement = resolvePlacement(rawMinutes, 60);

      void scheduleTaskBlock(item.id, placement.startHour, placement.startMin, 60);
      play('paper');
    },
  }, [play, resolvePlacement, scheduleTaskBlock]);

  return (
    <div className="focus-spotlight stage-bloom relative w-full min-w-0 bg-[#111111] border-l border-[rgba(255,255,255,0.07)] flex flex-col h-full transition-colors duration-700">
      {/* Day Frame header */}
      <div className="shrink-0 flex items-center justify-between border-b border-[rgba(255,255,255,0.05)]" style={{ padding: '14px 20px 12px' }}>
        {/* Left: label + time remaining */}
        <div className="flex flex-col gap-[5px]">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[9px] uppercase tracking-[0.13em]" style={{ color: 'rgba(150,140,120,0.3)' }}>
              Day Frame
            </span>
            <button
              onClick={() => void refreshExternalData()}
              title="Sync calendar"
              className="no-drag opacity-30 hover:opacity-80 transition-opacity"
              style={{ color: 'rgba(150,140,120,0.8)' }}
            >
              <RefreshCw className={cn('w-2.5 h-2.5', syncStatus.loading && 'animate-spin')} />
            </button>
          </div>
          <span className="font-sans text-[11px]" style={{ color: 'rgba(150,140,120,0.4)' }}>
            {timeLeft}
          </span>
        </div>

        {/* Right: time span + committed */}
        <div className="flex flex-col items-end gap-[5px]">
          <div className="flex items-baseline gap-0">
            {isEditingStart ? (
              <input
                type="time"
                defaultValue={`${String(workdayStart.hour).padStart(2, '0')}:${String(workdayStart.min).padStart(2, '0')}`}
                autoFocus
                onBlur={(e) => {
                  const [h, m] = e.target.value.split(':').map(Number);
                  if (!isNaN(h) && !isNaN(m)) setWorkdayStart(h, m);
                  setIsEditingStart(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setIsEditingStart(false);
                }}
                className="bg-transparent border-none outline-none font-display italic text-[20px] w-[100px] text-right"
                style={{ color: 'rgba(225,215,200,0.88)' }}
              />
            ) : (
              <button
                onClick={() => setIsEditingStart(true)}
                className="font-display italic text-[20px] leading-none hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(225,215,200,0.88)' }}
              >
                {formatTimeShort(workdayStart.hour, workdayStart.min)}
              </button>
            )}
            <span className="font-display italic text-[20px] leading-none mx-1.5" style={{ color: 'rgba(225,215,200,0.3)' }}>–</span>
            {isEditingEnd ? (
              <input
                type="time"
                defaultValue={`${String(workdayEnd.hour).padStart(2, '0')}:${String(workdayEnd.min).padStart(2, '0')}`}
                autoFocus
                onBlur={(e) => {
                  const [h, m] = e.target.value.split(':').map(Number);
                  if (!isNaN(h) && !isNaN(m)) setWorkdayEnd(h, m);
                  setIsEditingEnd(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') setIsEditingEnd(false);
                }}
                className="bg-transparent border-none outline-none font-display italic text-[20px] w-[100px]"
                style={{ color: 'rgba(225,215,200,0.88)' }}
              />
            ) : (
              <button
                onClick={() => setIsEditingEnd(true)}
                className="font-display italic text-[20px] leading-none hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(225,215,200,0.88)' }}
              >
                {formatTimeShort(workdayEnd.hour, workdayEnd.min)}
              </button>
            )}
          </div>
          {focusMinutes > 0 && (
            <span className={cn('font-sans text-[11px]', isFocus && 'focus-fade-meta')} style={{ color: 'rgba(190,90,55,0.65)' }}>
              {committedLabel} committed
            </span>
          )}
        </div>
      </div>

      {/* Deadline strip above calendar (normal mode) */}
      {!isFocus && <DeadlineMargin layout="horizontal" />}

      {/* Calendar + Deadline column (focus mode: side by side) */}
      <div className="flex flex-1 min-h-0" style={{ minWidth: 0 }}>
      <div
        ref={(el) => {
          dropRef(el);
          (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        id="timeline-grid"
        className={cn('flex-1 overflow-y-auto relative hide-scrollbar transition-colors min-w-0', isOver && 'bg-accent-warm/[0.035]')}
        style={{ maxWidth: isFocus ? undefined : 680 }}
      >
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          <CurrentTimeIndicator dayStartMins={dayStartMins} dayEndMins={dayEndMins} />

          {hourRows.map((rowStartMins, i) => (
            <div
              key={rowStartMins}
              className="absolute left-0 right-0 flex border-b border-border-subtle/50"
              style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
            >
              <div className="w-20 p-2 font-display italic text-[13px] text-text-primary/40 text-right border-r border-border-subtle/50">
                {formatTime(Math.floor(rowStartMins / 60), rowStartMins % 60)}
              </div>
              <div className="flex-1 relative">
                {/* Half-hour mark */}
                <div className="absolute left-0 right-0 border-b border-dotted border-border-subtle/50" style={{ top: `${HOUR_HEIGHT / 2}px` }} />
                {/* Vertical center-line */}
                <div className={cn('absolute top-0 bottom-0 left-1/2 border-l border-border-subtle/20', isFocus && 'opacity-35')} />
              </div>
            </div>
          ))}

          {isOver && ghostBlock && (
            <div
              className="absolute left-4 right-4 rounded-xl border-2 border-dashed border-accent-warm/45 bg-accent-warm/8 pointer-events-none z-20"
              style={{
                top: `${timeToTop(ghostBlock.startHour * 60 + ghostBlock.startMin, dayStartMins)}px`,
                height: `${HOUR_HEIGHT}px`,
              }}
            />
          )}

          <AfterHoursVeil
            workdayStart={workdayStart}
            workdayEnd={workdayEnd}
            onEdit={() => setIsEditingEnd(true)}
            isLight={isLight}
            isPastClose={minutesPastClose > 0}
            minutesPastClose={minutesPastClose}
          />

          <div className="absolute top-0 left-20 right-0 bottom-0">
            {scheduleBlocks.map((block, i) => (
              <BlockCard
                key={block.id}
                block={block}
                onRemove={() => removeScheduleBlock(block.id)}
                onUpdate={(startHour, startMin, durationMins) => {
                  void updateScheduleBlock(block.id, startHour, startMin, durationMins);
                }}
                onUpdateDuration={block.id.startsWith('ritual-') ? (durationMins) => {
                  updateRitualEstimate(block.id.slice('ritual-'.length), durationMins);
                } : undefined}
                resolvePlacement={resolvePlacement}
                stagger={i + 1}
                isNow={block.id === currentBlockId}
                actualMins={
                  block.linkedTaskId
                    ? (actualByTask.get(block.linkedTaskId) || 0) +
                      (livePomodoro?.currentTaskId === block.linkedTaskId ? liveElapsedMins : 0)
                    : 0
                }
                dayStartMins={dayStartMins}
                dayEndMins={dayEndMins}
              />
            ))}
          </div>
        </div>
      </div>
      {isFocus && <DeadlineMargin layout="vertical" />}
      </div>
    </div>
  );
}
