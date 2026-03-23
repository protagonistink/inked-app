import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useDrop } from 'react-dnd';
import { format } from 'date-fns';
import { cn, formatRoundedHours } from '@/lib/utils';
import { blockStartMinutes, blockEndMinutes, planFocusCascade, snapToCalendarGrid } from '@/lib/planner';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { useSound } from '@/hooks/useSound';
import { usePhysicsWarnings } from '@/hooks/usePhysicsWarnings';
import { useCurrentMinute } from '@/hooks/useCurrentMinute';
import type { PomodoroState, ScheduleBlock } from '@/types';
import { DateHeader } from './DateHeader';
import { BASE_HOUR_HEIGHT, GRID_SNAP_MINS, MIN_VISIBLE_DAY_HOURS, clampMinutes, timeToTop, formatTimeShort } from './timelineUtils';
import { OpenInterval } from './OpenInterval';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { AfterHoursVeil } from './AfterHoursVeil';
import { BeforeHoursVeil } from './BeforeHoursVeil';
import { DeadlineMargin } from './DeadlineMargin';
import { BlockCard } from './BlockCard';

export function Timeline() {
  const { isLight, isFocus } = useTheme();
  const {
    scheduleBlocks,
    scheduleTaskBlock,
    updateScheduleBlock,
    removeScheduleBlock,
    updateRitualEstimate,
    acceptProposal,
    addAdHocBlock,
    toggleRitualSkipped,
    currentBlock,
    workdayStart,
    setWorkdayStart,
    workdayEnd,
    setWorkdayEnd,
    timeLogs,
    refreshExternalData,
    syncStatus,
    viewDate,
    dayCommitInfo,
    unnestTaskFromBlock,
    startDay,
  } = useApp();
  const timelineLocked = dayCommitInfo.state === 'closed';
  const { play } = useSound();
  const { getWarning } = usePhysicsWarnings();
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridViewportHeight, setGridViewportHeight] = useState(0);
  const [timelineDensity, setTimelineDensity] = useState<'day' | 'now'>('day');
  const currentMinute = useCurrentMinute();
  const isTodayView = format(viewDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  // Keep a ref so useDrop collect/drop always see the latest blocks (avoids stale closure)
  const scheduleBlocksRef = useRef(scheduleBlocks);
  useEffect(() => { scheduleBlocksRef.current = scheduleBlocks; }, [scheduleBlocks]);
  const earliestBlockStartMins = useMemo(
    () => scheduleBlocks.reduce((earliest, block) => Math.min(earliest, blockStartMinutes(block)), workdayStart.hour * 60 + workdayStart.min),
    [scheduleBlocks, workdayStart.hour, workdayStart.min]
  );
  const contextualStartMins = isTodayView
    ? Math.max(0, Math.floor(Math.max(0, currentMinute - 60) / 60) * 60)
    : workdayStart.hour * 60 + workdayStart.min;
  const EARLIEST_VISIBLE_HOUR = 5; // 5 AM hard floor — calendar is always scrollable from here
  const dayStartMins = Math.max(EARLIEST_VISIBLE_HOUR * 60, Math.min(workdayStart.hour * 60 + workdayStart.min, earliestBlockStartMins, contextualStartMins));
  const requestedDayEndMins = workdayEnd.hour * 60 + workdayEnd.min;
  const latestBlockEndMins = useMemo(
    () => scheduleBlocks.reduce((latest, block) => Math.max(latest, blockEndMinutes(block)), requestedDayEndMins),
    [requestedDayEndMins, scheduleBlocks]
  );
  const minimumVisibleEndMins = dayStartMins + MIN_VISIBLE_DAY_HOURS * 60;
  const visibleDayEndMins = Math.max(
    dayStartMins + 60,
    minimumVisibleEndMins,
    Math.ceil((latestBlockEndMins + 30) / 60) * 60
  );
  const dayEndMins = visibleDayEndMins;
  const totalHoursVisible = Math.max(1, (dayEndMins - dayStartMins) / 60);
  const hourHeight = useMemo(() => {
    if (timelineDensity === 'now' || gridViewportHeight === 0) return BASE_HOUR_HEIGHT;
    const fittedHeight = gridViewportHeight / totalHoursVisible;
    return Math.min(BASE_HOUR_HEIGHT, Math.max(36, fittedHeight));
  }, [gridViewportHeight, timelineDensity, totalHoursVisible]);
  const hourRows = useMemo(() => {
    const rowCount = Math.max(1, Math.ceil((dayEndMins - dayStartMins) / 60));
    return Array.from({ length: rowCount }, (_, index) => dayStartMins + index * 60);
  }, [dayEndMins, dayStartMins]);
  const totalHeight = hourRows.length * hourHeight;

  const openIntervals = useMemo(() => {
    if (dayCommitInfo.state !== 'committed') return [];

    const sorted = [...scheduleBlocks]
      .sort((a, b) => blockStartMinutes(a) - blockStartMinutes(b));

    const intervals: Array<{ startMins: number; durationMins: number }> = [];
    let cursor = dayStartMins;

    for (const block of sorted) {
      const bStart = blockStartMinutes(block);
      const bEnd = blockEndMinutes(block);
      if (bStart > cursor) {
        const gap = bStart - cursor;
        if (gap >= 30) {
          intervals.push({ startMins: cursor, durationMins: gap });
        }
      }
      cursor = Math.max(cursor, bEnd);
    }

    if (cursor < requestedDayEndMins) {
      const gap = requestedDayEndMins - cursor;
      if (gap >= 30) {
        intervals.push({ startMins: cursor, durationMins: gap });
      }
    }

    return intervals;
  }, [dayCommitInfo.state, requestedDayEndMins, scheduleBlocks, dayStartMins]);

  // Overlap layout: when blocks share the same time slot, split them into columns
  const overlapLayout = useMemo(() => {
    const layout = new Map<string, { colIndex: number; colCount: number }>();
    const sorted = [...scheduleBlocks].sort((a, b) => blockStartMinutes(a) - blockStartMinutes(b));
    // Group blocks that overlap in time
    const groups: ScheduleBlock[][] = [];
    let curGroup: ScheduleBlock[] = [];
    let curGroupEnd = 0;
    for (const blk of sorted) {
      const s = blockStartMinutes(blk);
      const e = blockEndMinutes(blk);
      if (curGroup.length === 0 || s < curGroupEnd) {
        curGroup.push(blk);
        curGroupEnd = Math.max(curGroupEnd, e);
      } else {
        groups.push(curGroup);
        curGroup = [blk];
        curGroupEnd = e;
      }
    }
    if (curGroup.length > 0) groups.push(curGroup);
    // Assign columns per group — use stable group-wide column count
    // to prevent layout shifts when blocks are added/removed/moved
    for (const grp of groups) {
      if (grp.length === 1) {
        layout.set(grp[0].id, { colIndex: 0, colCount: 1 });
        continue;
      }
      const cols: number[][] = [];
      for (const blk of grp) {
        const s = blockStartMinutes(blk);
        let placed = false;
        for (let c = 0; c < cols.length; c++) {
          if (cols[c][cols[c].length - 1] <= s) {
            cols[c].push(blockEndMinutes(blk));
            layout.set(blk.id, { colIndex: c, colCount: cols.length });
            placed = true;
            break;
          }
        }
        if (!placed) {
          cols.push([blockEndMinutes(blk)]);
          layout.set(blk.id, { colIndex: cols.length - 1, colCount: cols.length });
        }
      }
      // Final pass: set colCount to total columns used in group
      const totalCols = cols.length;
      for (const blk of grp) {
        const entry = layout.get(blk.id);
        if (entry) entry.colCount = totalCols;
      }
    }
    return layout;
  }, [scheduleBlocks]);

  const [isEditingStart, setIsEditingStart] = useState(false);
  const [isEditingEnd, setIsEditingEnd] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [minutesPastClose, setMinutesPastClose] = useState(0);
  const [livePomodoro, setLivePomodoro] = useState<PomodoroState | null>(null);
  const [inkMessage, setInkMessage] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedNestedTaskId, setSelectedNestedTaskId] = useState<string | null>(null);
  const [adHocInput, setAdHocInput] = useState<{ startMins: number; top: number } | null>(null);

  const handleGridDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineLocked) return;
    // Only trigger on the grid background, not on blocks
    if ((e.target as HTMLElement).closest('[data-task-id]')) return;
    const grid = gridRef.current;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const scrollTop = grid.scrollTop;
    const y = e.clientY - rect.top + scrollTop;
    const rawMinutes = (y / hourHeight) * 60 + dayStartMins;
    const snappedMinutes = snapToCalendarGrid(rawMinutes, GRID_SNAP_MINS);
    const topPx = timeToTop(snappedMinutes, dayStartMins, hourHeight);
    setAdHocInput({ startMins: snappedMinutes, top: topPx });
  }, [dayStartMins, hourHeight, timelineLocked]);

  const commitAdHocBlock = useCallback((title: string) => {
    if (!adHocInput || !title.trim()) { setAdHocInput(null); return; }
    const startHour = Math.floor(adHocInput.startMins / 60);
    const startMin = adHocInput.startMins % 60;
    addAdHocBlock(title.trim(), startHour, startMin, 60);
    setAdHocInput(null);
    play('paper');
  }, [adHocInput, addAdHocBlock, play]);

  // Migrate selection when block ID changes (e.g., local → gcal sync)
  const prevBlocksRef = useRef(scheduleBlocks);
  useEffect(() => {
    if (selectedBlockId && !scheduleBlocks.some((b) => b.id === selectedBlockId)) {
      // Look for a block that has the same linkedTaskId as the old selection
      const oldBlock = prevBlocksRef.current.find((b) => b.id === selectedBlockId);
      if (oldBlock?.linkedTaskId) {
        const newBlock = scheduleBlocks.find((b) => b.linkedTaskId === oldBlock.linkedTaskId);
        if (newBlock) {
          setSelectedBlockId(newBlock.id);
        } else {
          setSelectedBlockId(null);
        }
      } else {
        setSelectedBlockId(null);
      }
    }
    prevBlocksRef.current = scheduleBlocks;
  }, [scheduleBlocks, selectedBlockId]);

  // Keyboard delete for selected block or nested task
  useEffect(() => {
    if (timelineLocked) return;
    if (!selectedBlockId && !selectedNestedTaskId) return;

    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when an input/textarea/contenteditable is focused
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (selectedNestedTaskId && selectedBlockId) {
          unnestTaskFromBlock(selectedNestedTaskId, selectedBlockId);
          setSelectedNestedTaskId(null);
          return;
        }
        if (selectedBlockId) {
          const block = scheduleBlocks.find((b) => b.id === selectedBlockId);
          if (!block) return;
          if (block.id.startsWith('ritual-')) {
            toggleRitualSkipped(block.id.slice('ritual-'.length), format(viewDate, 'yyyy-MM-dd'));
          } else if (!block.readOnly) {
            removeScheduleBlock(block.id);
          }
          setSelectedBlockId(null);
        }
      }
      if (e.key === 'Escape') {
        setSelectedBlockId(null);
        setSelectedNestedTaskId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBlockId, selectedNestedTaskId, timelineLocked, scheduleBlocks, removeScheduleBlock, toggleRitualSkipped, viewDate, unnestTaskFromBlock]);

  useEffect(() => {
    if (!isTodayView) {
      setInkMessage('');
      return;
    }
    window.api.ai.chat(
      [{ role: 'user', content: 'Give me a one-sentence daily planning intention for today. Be brief and poetic. No greeting.' }],
      {} as any
    ).then((res) => {
      if (res.success && res.content) setInkMessage(res.content.trim());
    }).catch(() => {});
  }, [isTodayView]);

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
      if (!isTodayView) {
        setTimeLeft('');
        setMinutesPastClose(0);
        return;
      }
      const next = computeDayBoundaryState();
      // Only show "past close" when blocks were committed but incomplete.
      // If day was never committed or all blocks are done, show neutral messaging.
      if (next.pastClose > 0 && dayCommitInfo.state === 'closed') {
        if (!dayCommitInfo.hadBlocks) {
          setTimeLeft('');
          setMinutesPastClose(0);
          return;
        }
        if (dayCommitInfo.completedBlocks >= dayCommitInfo.totalBlocks) {
          setTimeLeft(`Day closed — ${Math.round(dayCommitInfo.completedFocusMins / 60 * 10) / 10}h focused`);
          setMinutesPastClose(0);
          return;
        }
      }
      setTimeLeft(next.label);
      setMinutesPastClose(next.pastClose);
    };

    updateBoundaryState();
    const id = setInterval(updateBoundaryState, 60000);
    return () => clearInterval(id);
  }, [dayCommitInfo, isTodayView, workdayEnd]);

  useEffect(() => {
    const unsubscribe = window.api.pomodoro.onTick((state) => {
      setLivePomodoro(state as PomodoroState);
    });
    return unsubscribe;
  }, []);

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

  // Daily Arc summary
  const dailyArc = useMemo(() => {
    const focusBlocks = scheduleBlocks.filter((b) => b.kind === 'focus');
    const ritualBlocks = scheduleBlocks.filter((b) => b.kind === 'break');
    const totalMins = scheduleBlocks.reduce((sum, b) => sum + b.durationMins, 0);
    const parts: string[] = [];
    if (focusBlocks.length > 0) parts.push(`${focusBlocks.length} Focus`);
    if (ritualBlocks.length > 0) parts.push(`${ritualBlocks.length} Ritual`);
    if (totalMins > 0) parts.push(formatRoundedHours(totalMins, true));
    return parts.join(' \u00b7 ');
  }, [scheduleBlocks]);

  const beginWorkdayEndDrag = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const originGrid = gridRef.current;
    if (!originGrid) return;

    let dragged = false;

    const applyBoundary = (clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const scrollTop = grid.scrollTop;
      const y = clientY - rect.top + scrollTop;
      const rawMinutes = (y / hourHeight) * 60 + dayStartMins;
      const snappedMinutes = snapToCalendarGrid(rawMinutes, GRID_SNAP_MINS);
      const maxVisibleMinutes = Math.max(dayStartMins + 60, visibleDayEndMins);
      const clampedMinutes = Math.min(Math.max(snappedMinutes, dayStartMins + 60), maxVisibleMinutes);
      setWorkdayEnd(Math.floor(clampedMinutes / 60), clampedMinutes % 60);
    };

    function onMove(moveEvent: MouseEvent) {
      dragged = true;
      applyBoundary(moveEvent.clientY);
    }

    function onUp(upEvent: MouseEvent) {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (dragged) {
        applyBoundary(upEvent.clientY);
        return;
      }
      setIsEditingEnd(true);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dayStartMins, setWorkdayEnd, visibleDayEndMins]);

  const beginWorkdayStartDrag = useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const originGrid = gridRef.current;
    if (!originGrid) return;

    let dragged = false;
    const workdayEndMins = workdayEnd.hour * 60 + workdayEnd.min;

    const applyBoundary = (clientY: number) => {
      const grid = gridRef.current;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const scrollTop = grid.scrollTop;
      const y = clientY - rect.top + scrollTop;
      const rawMinutes = (y / hourHeight) * 60 + dayStartMins;
      const snappedMinutes = snapToCalendarGrid(rawMinutes, GRID_SNAP_MINS);
      const clampedMinutes = Math.max(EARLIEST_VISIBLE_HOUR * 60, Math.min(snappedMinutes, workdayEndMins - 60));
      setWorkdayStart(Math.floor(clampedMinutes / 60), clampedMinutes % 60);
    };

    function onMove(moveEvent: MouseEvent) {
      dragged = true;
      applyBoundary(moveEvent.clientY);
    }

    function onUp(upEvent: MouseEvent) {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (dragged) {
        applyBoundary(upEvent.clientY);
        return;
      }
      setIsEditingStart(true);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dayStartMins, hourHeight, setWorkdayStart, workdayEnd]);

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

    // Apply cascade updates — push subsequent blocks so nothing overlaps
    for (const [blockId, update] of cascadePlan.cascadeUpdates) {
      const existing = scheduleBlocksRef.current.find((b) => b.id === blockId);
      if (existing) {
        void updateScheduleBlock(blockId, update.startHour, update.startMin, existing.durationMins);
      }
    }

    return {
      startHour: cascadePlan.startHour,
      startMin: cascadePlan.startMin,
    };
  }, [dayEndMins, dayStartMins, updateScheduleBlock]);

  const [{ isOver, ghostBlock }, dropRef] = useDrop<DragItem, void, { isOver: boolean; ghostBlock: { startHour: number; startMin: number } | null }>({
    accept: timelineLocked ? [] : DragTypes.TASK,
    collect: (monitor) => {
      const offset = monitor.getClientOffset();
      const isOver = monitor.isOver();

      if (!isOver || !offset || !gridRef.current) return { isOver, ghostBlock: null };

      const rect = gridRef.current.getBoundingClientRect();
      const scrollTop = gridRef.current.scrollTop;
      const y = offset.y - rect.top + scrollTop;
      const rawMinutes = (y / hourHeight) * 60 + dayStartMins;
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
      if (monitor.didDrop()) return; // BlockCard already handled this drop
      const offset = monitor.getClientOffset();
      if (!offset || !gridRef.current) return;

      const rect = gridRef.current.getBoundingClientRect();
      const scrollTop = gridRef.current.scrollTop;
      const y = offset.y - rect.top + scrollTop;
      const rawMinutes = (y / hourHeight) * 60 + dayStartMins;
      const placement = resolvePlacement(rawMinutes, 60);

      void scheduleTaskBlock(item.id, placement.startHour, placement.startMin, 60);
      play('paper');
    },
  }, [dayStartMins, hourHeight, play, resolvePlacement, scheduleTaskBlock, timelineLocked]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const updateViewportHeight = () => {
      setGridViewportHeight(grid.clientHeight);
    };

    updateViewportHeight();
    const observer = new ResizeObserver(updateViewportHeight);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (timelineDensity !== 'now' || !isTodayView || !gridRef.current) return;
    const grid = gridRef.current;
    const nowTop = timeToTop(currentMinute, dayStartMins, hourHeight);
    const targetScrollTop = Math.max(0, nowTop - grid.clientHeight * 0.35);
    grid.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
  }, [currentMinute, dayStartMins, hourHeight, isTodayView, timelineDensity]);

  return (
    <div className="focus-spotlight stage-bloom relative w-full min-w-0 bg-[#111111] border-l border-[rgba(255,255,255,0.07)] flex flex-col h-full transition-colors duration-700">
      {/* Sticky Date Header */}
      <div className="sticky top-0 z-20 px-8 pt-6 pb-5" style={{ background: 'rgba(10, 10, 10, 0.85)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-end justify-between">
          <DateHeader />
          {dailyArc && (
            <span className="text-[11px] text-slate-500 tracking-wider font-mono pb-1">
              {dailyArc}
            </span>
          )}
        </div>
        {inkMessage && isTodayView && (
          <p className="font-display mt-4 leading-relaxed text-[15px] font-light text-[#919fae]/50">
            {inkMessage}
          </p>
        )}
        {/* Sync + time controls row */}
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-2">
            <span className="font-sans text-[11px]" style={{ color: 'rgba(148,163,184,0.6)' }}>
              {isTodayView ? timeLeft : ''}
            </span>
            <button
              onClick={() => void refreshExternalData()}
              title="Sync calendar"
              className="no-drag opacity-30 hover:opacity-80 transition-opacity"
              style={{ color: 'rgba(150,140,120,0.8)' }}
            >
              <RefreshCw className={cn('w-2.5 h-2.5', syncStatus.loading && 'animate-spin')} />
            </button>
            <div className="ml-3 inline-flex rounded-full border border-border-subtle bg-bg-card/40 p-1">
              <button
                onClick={() => setTimelineDensity('day')}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors',
                  timelineDensity === 'day' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'
                )}
              >
                Day
              </button>
              <button
                onClick={() => setTimelineDensity('now')}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors',
                  timelineDensity === 'now' ? 'bg-bg-elevated text-text-primary' : 'text-text-muted hover:text-text-primary'
                )}
              >
                Now
              </button>
            </div>
          </div>
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
                className="bg-transparent border-none outline-none font-display italic text-[15px] w-[80px] text-right"
                style={{ color: 'rgba(225,215,200,0.88)' }}
              />
            ) : (
              <button
                onClick={() => setIsEditingStart(true)}
                className="font-display italic text-[15px] leading-none hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(225,215,200,0.6)' }}
              >
                {formatTimeShort(workdayStart.hour, workdayStart.min)}
              </button>
            )}
            <span className="font-display italic text-[15px] leading-none mx-1" style={{ color: 'rgba(225,215,200,0.2)' }}>–</span>
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
                className="bg-transparent border-none outline-none font-display italic text-[15px] w-[80px]"
                style={{ color: 'rgba(225,215,200,0.88)' }}
              />
            ) : (
              <button
                onClick={() => setIsEditingEnd(true)}
                className="font-display italic text-[15px] leading-none hover:opacity-70 transition-opacity"
                style={{ color: 'rgba(225,215,200,0.6)' }}
              >
                {formatTimeShort(workdayEnd.hour, workdayEnd.min)}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Start Day button — shown when tasks are committed but day not started */}
      {dayCommitInfo.state === 'committed' && dayCommitInfo.totalBlocks > 0 && (
        <div className="px-8 pb-4">
          <button
            onClick={startDay}
            className="w-full rounded-xl border border-accent-warm/25 bg-accent-warm/[0.06] px-4 py-3 text-[13px] font-medium tracking-[0.06em] text-accent-warm/80 hover:bg-accent-warm/[0.12] hover:text-accent-warm transition-colors"
          >
            Start Day →
          </button>
        </div>
      )}

      {/* Deadline strip above calendar (normal mode) */}
      {/* Calendar + Deadline column (focus mode: side by side) */}
      <div className="flex flex-1 min-h-0" style={{ minWidth: 0 }}>
      <div
        ref={(el) => {
          dropRef(el);
          (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        id="timeline-grid"
        onClick={(e) => { if (!(e.target as HTMLElement).closest('[data-task-id]')) { setSelectedBlockId(null); } }}
        onDoubleClick={handleGridDoubleClick}
        className={cn('dot-grid flex-1 overflow-y-auto relative hide-scrollbar transition-colors min-w-0', isOver && 'bg-accent-warm/[0.035]')}
      >
        <div className="w-full max-w-4xl mx-auto relative" style={{ height: `${totalHeight}px` }}>
          {isTodayView && <CurrentTimeIndicator dayStartMins={dayStartMins} dayEndMins={dayEndMins} hourHeight={hourHeight} />}
          {hourRows.map((rowStartMins, i) => (
            <div
              key={rowStartMins}
              className="absolute left-0 right-0 flex border-b border-border-subtle/50"
              style={{ top: `${i * hourHeight}px`, height: `${hourHeight}px` }}
            >
              <div className="time-lbl p-2 text-right border-r border-border-subtle/50 whitespace-nowrap" style={{ width: 56 }}>
                {formatTimeShort(Math.floor(rowStartMins / 60), rowStartMins % 60)}
              </div>
              <div className="flex-1 relative" style={{ paddingTop: 6, paddingBottom: 6 }}>
                {/* Half-hour mark */}
                <div className="absolute left-0 right-0 border-b border-dotted border-border-subtle/50" style={{ top: `${hourHeight / 2}px` }} />
                {/* Vertical center-line */}
                <div className={cn('absolute top-0 bottom-0 left-1/2 border-l border-border-subtle/20', isFocus && 'opacity-35')} />
              </div>
            </div>
          ))}

          {isOver && ghostBlock && (
            <div
              className="absolute left-4 right-4 rounded-xl border-2 border-dashed border-accent-warm/45 bg-accent-warm/8 pointer-events-none z-20"
              style={{
                top: `${timeToTop(ghostBlock.startHour * 60 + ghostBlock.startMin, dayStartMins, hourHeight)}px`,
                height: `${hourHeight}px`,
              }}
            />
          )}

          <BeforeHoursVeil
            workdayStart={workdayStart}
            onDragBoundaryStart={beginWorkdayStartDrag}
            isLight={isLight}
            dayStartMins={dayStartMins}
            hourHeight={hourHeight}
          />

          {isTodayView && (
            <AfterHoursVeil
              workdayEnd={workdayEnd}
              onEdit={() => setIsEditingEnd(true)}
              onDragBoundaryStart={beginWorkdayEndDrag}
              isLight={isLight}
              isPastClose={minutesPastClose > 0}
              minutesPastClose={minutesPastClose}
              dayStartMins={dayStartMins}
              hourHeight={hourHeight}
            />
          )}

          <div className="absolute top-0 left-14 right-0 bottom-0">
            {scheduleBlocks.map((block, i) => (
              <BlockCard
                key={block.id}
                block={block}
                onRemove={timelineLocked ? () => {} : () => removeScheduleBlock(block.id)}
                onUpdate={timelineLocked ? () => {} : (startHour, startMin, durationMins) => {
                  void updateScheduleBlock(block.id, startHour, startMin, durationMins);
                }}
                onUpdateDuration={timelineLocked ? undefined : block.id.startsWith('ritual-') ? (durationMins) => {
                  updateRitualEstimate(block.id.slice('ritual-'.length), durationMins);
                } : undefined}
                resolvePlacement={resolvePlacement}
                acceptProposal={acceptProposal}
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
                hourHeight={hourHeight}
                physicsWarning={getWarning(block)}
                locked={timelineLocked}
                colIndex={overlapLayout.get(block.id)?.colIndex ?? 0}
                colCount={overlapLayout.get(block.id)?.colCount ?? 1}
                isSelected={selectedBlockId === block.id}
                onSelect={(id) => setSelectedBlockId(id || null)}
                selectedNestedTaskId={selectedBlockId === block.id ? selectedNestedTaskId : null}
                onSelectNestedTask={(taskId) => {
                  setSelectedBlockId(block.id);
                  setSelectedNestedTaskId(taskId);
                }}
              />
            ))}
            {openIntervals.map((interval, i) => (
              <OpenInterval
                key={`interval-${i}`}
                startMins={interval.startMins}
                durationMins={interval.durationMins}
                dayStartMins={dayStartMins}
                hourHeight={hourHeight}
              />
            ))}
            {adHocInput && (
              <div
                className="absolute left-1 right-1 z-30 rounded-lg border border-dashed border-accent-warm/40 bg-[#1a1a1a] px-3 py-2"
                style={{ top: `${adHocInput.top}px`, height: `${hourHeight}px` }}
              >
                <input
                  autoFocus
                  placeholder="Event name..."
                  className="w-full bg-transparent border-none outline-none font-display italic text-[14px] text-slate-100 placeholder:text-text-muted/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdHocBlock(e.currentTarget.value);
                    if (e.key === 'Escape') setAdHocInput(null);
                  }}
                  onBlur={(e) => {
                    if (e.currentTarget.value.trim()) commitAdHocBlock(e.currentTarget.value);
                    else setAdHocInput(null);
                  }}
                />
                <span className="text-[10px] text-text-muted/40 tracking-wider">
                  {formatTimeShort(Math.floor(adHocInput.startMins / 60), adHocInput.startMins % 60)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      {isFocus && <DeadlineMargin layout="vertical" />}
      </div>
    </div>
  );
}
