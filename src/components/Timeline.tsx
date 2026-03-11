import { useEffect, useMemo, useRef, useState } from 'react';
import { X, GripVertical, Play } from 'lucide-react';
import { useDrag } from 'react-dnd';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { cn, formatRoundedHours } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { useSound } from '@/hooks/useSound';
import type { PomodoroState, ScheduleBlock } from '@/types';
import { GCalIcon } from './AppIcons';

const HOUR_HEIGHT = 96;
const START_HOUR = 8;
const END_HOUR = 20;
const GRID_SNAP_MINS = 5;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_START_MINS = START_HOUR * 60;
const DAY_END_MINS = END_HOUR * 60;

function snapMinutes(totalMinutes: number): number {
  return Math.round(totalMinutes / GRID_SNAP_MINS) * GRID_SNAP_MINS;
}

function clampMinutes(totalMinutes: number, maxDurationMins = 0): number {
  return Math.min(Math.max(totalMinutes, DAY_START_MINS), DAY_END_MINS - maxDurationMins);
}

function timeToTop(totalMinutes: number): number {
  return ((totalMinutes - DAY_START_MINS) / 60) * HOUR_HEIGHT;
}

function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const min = m.toString().padStart(2, '0');
  return `${hour}:${min} ${ampm}`;
}

function FocusSetMeter({ durationMins }: { durationMins: number }) {
  const setCount = Math.max(1, Math.round(durationMins / 25));

  return (
    <div className="flex items-center gap-2 rounded-full border border-accent-warm/18 bg-black/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-muted/90 backdrop-blur-sm focus-fade-meta">
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
  stagger = 0,
  isNow = false,
  actualMins = 0,
}: {
  block: ScheduleBlock;
  onRemove: () => void;
  onUpdate: (startHour: number, startMin: number, durationMins: number) => void;
  stagger?: number;
  isNow?: boolean;
  actualMins?: number;
}) {
  const { isLight, isFocus } = useTheme();
  const { setActiveTask } = useApp();
  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: DragTypes.BLOCK,
    canDrag: !block.readOnly && Boolean(block.linkedTaskId),
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
  const top = timeToTop(((draft?.startHour ?? block.startHour) * 60) + (draft?.startMin ?? block.startMin));
  const height = ((draft?.durationMins ?? block.durationMins) / 60) * HOUR_HEIGHT;
  const isShortBlock = height < 110;
  const actualLabel = actualMins > 0 ? formatRoundedHours(actualMins, true) : null;

  function beginDrag(event: React.MouseEvent<HTMLDivElement>) {
    if (block.readOnly) return;
    event.preventDefault();
    didDragRef.current = false;
    const startY = event.clientY;
    const baseMinutes = block.startHour * 60 + block.startMin;

    function onMove(moveEvent: MouseEvent) {
      const deltaY = moveEvent.clientY - startY;
      if (Math.abs(deltaY) > 4) didDragRef.current = true;
      const rawMinutes = baseMinutes + (deltaY / HOUR_HEIGHT) * 60;
      const nextMinutes = clampMinutes(snapMinutes(rawMinutes), block.durationMins);
      const nextDraft = {
        startHour: Math.floor(nextMinutes / 60),
        startMin: nextMinutes % 60,
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
    if (block.readOnly) return;
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const baseDuration = block.durationMins;

    function onMove(moveEvent: MouseEvent) {
      const deltaY = moveEvent.clientY - startY;
      const pixelsPerSnap = HOUR_HEIGHT * (GRID_SNAP_MINS / 60);
      const step = Math.round(deltaY / pixelsPerSnap) * GRID_SNAP_MINS;
      const nextDuration = Math.max(GRID_SNAP_MINS, baseDuration + step);
      const maxDuration = DAY_END_MINS - (block.startHour * 60 + block.startMin);
      const nextDraft = {
        startHour: block.startHour,
        startMin: block.startMin,
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
    if (!block.linkedTaskId || block.readOnly) return;
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
    if (!block.linkedTaskId || block.readOnly) return;
    setActiveTask(block.linkedTaskId);
    void window.api.window.showPomodoro();
    void window.api.pomodoro.start(block.linkedTaskId, block.title);
    void window.api.window.activate();
  }

  return (
    <div
      data-task-id={block.linkedTaskId || undefined}
      onMouseDown={beginDrag}
      onClick={handleClick}
      className={cn(
        'editorial-card animate-fade-in absolute left-4 right-4 overflow-hidden rounded-[18px] p-4 flex flex-col gap-1.5 transition-all duration-300 group/block shadow-[0_14px_36px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.04)]',
        isFocus && block.kind !== 'hard' && 'focus-block-card',
        block.kind === 'hard'
          ? isLight
            ? 'shadow-sm'
            : 'backdrop-blur-md'
          : isLight
            ? 'border-l-[3px] border-l-accent-warm shadow-sm'
            : 'border-l-[3px] border-l-accent-warm/60 shadow-[0_0_24px_rgba(200,60,47,0.04)]',
        stagger === 1 && 'stagger-2',
        stagger === 2 && 'stagger-3',
        stagger === 3 && 'stagger-4',
        isDragging && 'opacity-25 scale-[0.97] rotate-[1deg]',
        isNow && !isDragging && 'ring-1 ring-active/40 shadow-[0_0_20px_rgba(200,60,47,0.12)]'
      )}
      style={{ top: `${top}px`, height: `${height}px` }}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0',
          block.kind === 'hard'
            ? 'opacity-70 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_42%)]'
            : isFocus
              ? 'opacity-55 bg-[linear-gradient(180deg,rgba(250,250,250,0.028),transparent_16%,rgba(0,0,0,0.08)_100%)]'
              : 'opacity-70 bg-[linear-gradient(180deg,rgba(255,214,170,0.08),transparent_45%)]'
        )}
      />
      {!block.readOnly && block.linkedTaskId && (
        <button
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={startFocus}
          className="absolute top-2 right-9 p-1 rounded-md text-text-muted hover:text-accent-warm hover:bg-bg-card opacity-0 group-hover/block:opacity-100 transition-all"
          title="Start focus"
        >
          <Play className="w-3 h-3 fill-current" />
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
          className="absolute top-2 right-2 p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-card opacity-0 group-hover/block:opacity-100 transition-all"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <div className="relative z-10 flex items-start gap-2 pr-6">
        {!block.readOnly && (
          <button
            ref={dragRef}
            onMouseDown={(event) => event.stopPropagation()}
            className={cn(
              'mt-0.5 -ml-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-card cursor-grab active:cursor-grabbing transition-all',
              isShortBlock ? 'p-1' : 'px-1.5 py-1 flex items-center gap-1.5'
            )}
            title="Drag back to commit list"
          >
            <GripVertical className="w-3 h-3" />
            {!isShortBlock && <span className="text-[10px] uppercase tracking-[0.14em]">Return</span>}
          </button>
        )}
        <h4 className="text-[13px] font-medium text-text-primary truncate focus-editorial">{block.title}</h4>
      </div>
      <div className="relative z-10 text-[10px] font-mono text-text-muted focus-fade-meta">
        {formatTime(block.startHour, block.startMin)} - {formatTime(
          block.startHour + Math.floor((block.startMin + block.durationMins) / 60),
          (block.startMin + block.durationMins) % 60
        )}
      </div>
      <div className="relative z-10 flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-muted/70 focus-fade-meta">
        <span className="flex items-center gap-1.5">
          {block.kind === 'hard' ? (
            <GCalIcon className="w-4 h-4 shrink-0" />
          ) : (
            'focus block'
          )}
        </span>
        {actualLabel && block.kind === 'focus' && (
          <span className="rounded-full border border-white/6 bg-black/15 px-2 py-0.5 normal-case tracking-normal text-text-muted/90">
            {actualLabel} worked
          </span>
        )}
      </div>
      {!block.readOnly && block.durationMins >= 25 && (() => {
        const pomCount = Math.max(1, Math.round(block.durationMins / 25));
        return (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 opacity-0 group-hover/block:opacity-100 transition-opacity z-10"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(block.startHour, block.startMin, Math.max(25, (pomCount - 1) * 25)); }}
              disabled={pomCount <= 1}
              className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1 disabled:opacity-30"
            >
              –
            </button>
            <FocusSetMeter durationMins={block.durationMins} />
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(block.startHour, block.startMin, (pomCount + 1) * 25); }}
              className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1"
            >
              +
            </button>
          </div>
        );
      })()}
      {!block.readOnly && (
        <div
          onMouseDown={beginResize}
          className="absolute left-3 right-3 bottom-1 h-2 cursor-row-resize rounded-full bg-accent-warm/20 opacity-0 group-hover/block:opacity-100 transition-opacity"
        />
      )}
    </div>
  );
}

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  if (currentHour < START_HOUR || currentHour >= END_HOUR) return null;

  const top = (currentHour - START_HOUR) * HOUR_HEIGHT + (currentMin / 60) * HOUR_HEIGHT;

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

function CountdownsStrip() {
  const { countdowns } = useApp();
  if (countdowns.length === 0) return null;

  const today = new Date();

  return (
    <div className="px-4 py-2 border-b border-border-subtle flex flex-wrap gap-2 shrink-0">
      {countdowns.map((countdown) => {
        const days = differenceInCalendarDays(parseISO(countdown.dueDate), today);
        const colorClass =
          days < 3
            ? 'text-red-400 bg-red-400/10 border-red-400/20'
            : days <= 7
              ? 'text-amber-400 bg-amber-400/10 border-amber-400/20'
              : 'text-done bg-done/10 border-done/20';

        return (
          <div
            key={countdown.id}
            className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-mono', colorClass)}
          >
            <span className="text-text-muted font-sans">{countdown.title}</span>
            <span className="font-semibold">{days}d</span>
          </div>
        );
      })}
    </div>
  );
}

function AfterHoursVeil({
  workdayEnd,
  onEdit,
  isLight,
  isPastClose,
  minutesPastClose,
}: {
  workdayEnd: { hour: number; min: number };
  onEdit: () => void;
  isLight: boolean;
  isPastClose: boolean;
  minutesPastClose: number;
}) {
  const endMinutes = workdayEnd.hour * 60 + workdayEnd.min;
  if (endMinutes <= DAY_START_MINS || endMinutes >= DAY_END_MINS) return null;

  const top = timeToTop(endMinutes);
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
          'pointer-events-auto absolute left-4 -top-4 flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] shadow-[0_12px_24px_rgba(0,0,0,0.2)] backdrop-blur-md transition-all hover:text-text-primary',
          isLight
            ? 'border-stone-300/70 bg-white/92 text-stone-500 hover:border-stone-400/80'
            : 'border-border bg-bg-elevated/90 text-text-muted hover:border-border'
        )}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', isPastClose ? 'bg-accent-warm' : 'bg-accent-warm/70')} />
        {isPastClose ? `Day closed ${overrunLabel} ago` : `Day closes ${formatTime(workdayEnd.hour, workdayEnd.min)}`}
      </button>
      <div
        className={cn(
          'absolute inset-x-0 top-0 border-t',
          isLight
            ? isPastClose
              ? 'border-amber-400/70'
              : 'border-stone-300/80'
            : isPastClose
              ? 'border-accent-warm/32'
              : 'border-accent-warm/18'
        )}
      />
      <div
        className={cn(
          'absolute inset-0',
          isLight
            ? isPastClose
              ? 'bg-[linear-gradient(180deg,rgba(196,132,78,0.10),rgba(233,228,219,0.76)_14%,rgba(224,220,211,0.94))]'
              : 'bg-[linear-gradient(180deg,rgba(176,112,88,0.07),rgba(231,228,220,0.72)_16%,rgba(224,220,211,0.92))]'
            : isPastClose
              ? 'bg-[linear-gradient(180deg,rgba(200,60,47,0.14),rgba(22,15,13,0.76)_16%,rgba(10,10,10,0.94))]'
              : 'bg-[linear-gradient(180deg,rgba(200,60,47,0.08),rgba(10,10,10,0.72)_18%,rgba(10,10,10,0.92))]'
        )}
      />
      <div
        className={cn(
          'absolute inset-0 opacity-30',
          isLight
            ? 'bg-[repeating-linear-gradient(135deg,rgba(120,113,100,0.045)_0px,rgba(120,113,100,0.045)_8px,transparent_8px,transparent_20px)]'
            : 'bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.028)_0px,rgba(255,255,255,0.028)_8px,transparent_8px,transparent_20px)]'
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
    workdayEnd,
    setWorkdayEnd,
    timeLogs,
  } = useApp();
  const { play } = useSound();
  const gridRef = useRef<HTMLDivElement>(null);
  const totalHeight = HOURS.length * HOUR_HEIGHT;
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
        return {
          label: `${Math.abs(remaining)}m past close`,
          pastClose: Math.abs(remaining),
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

  const currentBlockId = (() => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return scheduleBlocks.find((block) => {
      const blockStart = block.startHour * 60 + block.startMin;
      return nowMins >= blockStart && nowMins < blockStart + block.durationMins;
    })?.id ?? null;
  })();

  const [{ isOver, ghostBlock }, dropRef] = useDrop<DragItem, void, { isOver: boolean; ghostBlock: { startHour: number; startMin: number } | null }>({
    accept: DragTypes.TASK,
    collect: (monitor) => {
      const offset = monitor.getClientOffset();
      const isOver = monitor.isOver();

      if (!isOver || !offset || !gridRef.current) return { isOver, ghostBlock: null };

      const rect = gridRef.current.getBoundingClientRect();
      const scrollTop = gridRef.current.scrollTop;
      const y = offset.y - rect.top + scrollTop;
      const rawMinutes = (y / HOUR_HEIGHT) * 60 + DAY_START_MINS;
      const snappedMinutes = clampMinutes(snapMinutes(rawMinutes), 60);
      return {
        isOver,
        ghostBlock: {
          startHour: Math.floor(snappedMinutes / 60),
          startMin: snappedMinutes % 60,
        },
      };
    },
    drop: (item, monitor) => {
      const offset = monitor.getClientOffset();
      if (!offset || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const scrollTop = gridRef.current.scrollTop;
      const y = offset.y - rect.top + scrollTop;
      const rawMinutes = (y / HOUR_HEIGHT) * 60 + DAY_START_MINS;
      const snappedMinutes = clampMinutes(snapMinutes(rawMinutes), 60);

      void scheduleTaskBlock(item.id, Math.floor(snappedMinutes / 60), snappedMinutes % 60, 60);
      play('paper');
    },
  });

  return (
    <div className="focus-spotlight editorial-panel relative flex-1 min-w-[360px] bg-bg flex flex-col h-full transition-colors duration-700">
      <div className="workspace-header shrink-0">
        <div className="workspace-header-copy">
          <div className="workspace-header-kicker">Day Frame</div>
          <div className="workspace-header-subline">Place the work. Protect the hours.</div>
        </div>

        <div className="workspace-header-meta justify-end min-w-[132px]">
          <div className="text-right min-w-[132px]">
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
                className="editorial-pill bg-transparent text-text-primary text-[13px] font-mono rounded px-2 py-0.5 w-[90px] text-right"
              />
            ) : (
              <>
                <button
                  onClick={() => setIsEditingEnd(true)}
                  className="text-right hover:opacity-70 transition-opacity block w-full"
                >
                  <div className="workspace-header-kicker mb-1">Ends</div>
                  <div className="text-[14px] font-mono text-text-primary">{formatTime(workdayEnd.hour, workdayEnd.min)}</div>
                  <div className="text-[10px] text-text-muted">{timeLeft}</div>
                </button>
                <div className={cn('text-[10px] text-text-muted mt-1', isFocus && 'focus-fade-meta')}>{formatRoundedHours(focusMinutes, true)} committed</div>
              </>
            )}
          </div>
        </div>
      </div>

      <CountdownsStrip />

      <div className={cn(
        'px-6 py-2 border-b border-border-subtle shrink-0',
        isLight
          ? 'bg-[linear-gradient(90deg,rgba(176,112,88,0.05),transparent_45%,rgba(91,143,140,0.04))]'
          : 'bg-[linear-gradient(90deg,rgba(200,60,47,0.08),transparent_45%,rgba(250,250,250,0.015))]'
      )}>
        <div className={cn('text-[10px] tracking-[0.14em] text-text-muted/80', isFocus && 'focus-fade-meta')}>
          Drag into time. Use the return handle to pull a block back out.
        </div>
      </div>

      <div
        ref={(el) => {
          dropRef(el);
          (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        id="timeline-grid"
        className={cn('flex-1 overflow-y-auto relative hide-scrollbar transition-colors', isOver && 'bg-accent-warm/[0.035]')}
      >
        <div className="relative" style={{ height: `${totalHeight}px` }}>
          <CurrentTimeIndicator />

          {HOURS.map((hour, i) => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex border-b border-border-subtle/50"
              style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
            >
              <div className="w-20 p-2 text-[10px] font-mono text-text-muted text-right border-r border-border-subtle/50">
                {formatTime(hour, 0)}
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
              className="absolute left-4 right-4 rounded-xl border-2 border-dashed border-accent-warm/45 bg-accent-warm/8 pointer-events-none z-20 shadow-[0_0_30px_rgba(200,60,47,0.1)]"
              style={{
                top: `${timeToTop(ghostBlock.startHour * 60 + ghostBlock.startMin)}px`,
                height: `${HOUR_HEIGHT}px`,
              }}
            />
          )}

          <AfterHoursVeil
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
                stagger={i + 1}
                isNow={block.id === currentBlockId}
                actualMins={
                  block.linkedTaskId
                    ? (actualByTask.get(block.linkedTaskId) || 0) +
                      (livePomodoro?.currentTaskId === block.linkedTaskId ? liveElapsedMins : 0)
                    : 0
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
