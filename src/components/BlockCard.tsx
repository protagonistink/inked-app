// src/components/BlockCard.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GripVertical, Play, Check } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { cn, formatRoundedHours } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import type { PlannedTask, ScheduleBlock } from '@/types';
import { AIBreakdown } from './AIBreakdown';
import { timeToTop, formatTimeShort, GRID_SNAP_MINS, getStepMins } from './timelineUtils';

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

export function BlockCard({
  block,
  onRemove,
  onUpdate,
  onUpdateDuration,
  resolvePlacement,
  acceptProposal,
  stagger = 0,
  isNow = false,
  actualMins = 0,
  dayStartMins,
  dayEndMins,
  hourHeight,
  physicsWarning,
  locked = false,
  colIndex = 0,
  colCount = 1,
  isSelected = false,
  onSelect,
  selectedNestedTaskId,
  onSelectNestedTask,
}: {
  block: ScheduleBlock;
  onRemove: () => void;
  onUpdate: (startHour: number, startMin: number, durationMins: number) => void;
  onUpdateDuration?: (durationMins: number) => void;
  resolvePlacement: (rawMinutes: number, durationMins: number, targetBlockId?: string) => { startHour: number; startMin: number };
  acceptProposal: (blockId: string) => void;
  stagger?: number;
  isNow?: boolean;
  actualMins?: number;
  dayStartMins: number;
  dayEndMins: number;
  hourHeight: number;
  physicsWarning?: string | null;
  locked?: boolean;
  colIndex?: number;
  colCount?: number;
  isSelected?: boolean;
  onSelect?: (blockId: string) => void;
  selectedNestedTaskId?: string | null;
  onSelectNestedTask?: (taskId: string) => void;
}) {
  const { isFocus } = useTheme();
  const { plannedTasks, weeklyGoals, setActiveTask, toggleTask, nestTaskInBlock, dayCommitInfo } = useApp();
  const linkedTask = block.linkedTaskId ? plannedTasks.find((task) => task.id === block.linkedTaskId) : null;
  const isDone = linkedTask?.status === 'done';

  // Dynamic thread color for border-left based on weekly goal
  const goalId = linkedTask?.weeklyGoalId ?? null;
  const goalIndex = goalId ? weeklyGoals.findIndex((g) => g.id === goalId) : -1;
  const threadColor = goalIndex === 0 ? 'rgba(229,85,71,0.5)'
    : goalIndex === 1 ? 'rgba(74,109,140,0.5)'
    : goalIndex === 2 ? 'rgba(145,159,174,0.4)'
    : 'rgba(100,116,139,0.3)';
  // Highlighter tint — faintest whisper of goal color so text pops
  const tintColor = goalIndex === 0 ? 'rgba(229,85,71,0.025)'
    : goalIndex === 1 ? 'rgba(74,109,140,0.025)'
    : goalIndex === 2 ? 'rgba(145,159,174,0.02)'
    : block.kind === 'break' ? 'rgba(250,250,250,0.015)'
    : block.kind === 'hard' ? 'rgba(145,159,174,0.025)'
    : 'rgba(100,116,139,0.02)';
  const nestedTasks = useMemo(
    () => (block.nestedTaskIds ?? [])
      .map((id) => plannedTasks.find((t) => t.id === id))
      .filter((t): t is PlannedTask => t != null),
    [block.nestedTaskIds, plannedTasks]
  );

  const [{ isNestOver }, nestDropRef] = useDrop<DragItem, void, { isNestOver: boolean }>({
    accept: DragTypes.TASK,
    canDrop: () => !locked,
    collect: (monitor) => ({ isNestOver: monitor.isOver() && monitor.canDrop() }),
    drop: (item) => {
      void nestTaskInBlock(item.id, block.id);
    },
  });

  const blockRef = useRef<HTMLDivElement | null>(null);

  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: DragTypes.BLOCK,
    canDrag: !locked && !block.readOnly && !isDone && Boolean(block.linkedTaskId),
    item: {
      id: block.linkedTaskId || block.id,
      title: block.title,
      blockId: block.id,
      linkedTaskId: block.linkedTaskId,
      sourceType: linkedTask?.source ?? block.source,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);
  const [draft, setDraft] = useState<{ startHour: number; startMin: number; durationMins: number } | null>(null);
  const draftRef = useRef<{ startHour: number; startMin: number; durationMins: number } | null>(null);
  const didDragRef = useRef(false);
  const top = timeToTop(((draft?.startHour ?? block.startHour) * 60) + (draft?.startMin ?? block.startMin), dayStartMins, hourHeight);
  const rawHeight = ((draft?.durationMins ?? block.durationMins) / 60) * hourHeight;
  const MIN_BLOCK_HEIGHT = 32;
  const NESTED_TITLE_HEIGHT = 32;
  const NESTED_ROW_HEIGHT = 20;
  const nestedCount = block.nestedTaskIds?.length ?? 0;
  const nestedMinHeight = block.kind === 'break' && nestedCount > 0
    ? NESTED_TITLE_HEIGHT + nestedCount * NESTED_ROW_HEIGHT
    : MIN_BLOCK_HEIGHT;
  const height = Math.max(rawHeight, nestedMinHeight, MIN_BLOCK_HEIGHT);
  const isCompact = rawHeight < 48;
  const actualLabel = actualMins > 0 ? formatRoundedHours(actualMins, true) : null;

  // Determine block variant class
  const isAdHoc = block.kind === 'hard' && !block.readOnly && block.source === 'local';
  const blockVariant = block.kind === 'hard' && !isAdHoc
    ? 't-gcal'
    : block.kind === 'break'
      ? 't-ritual'
      : block.proposal === 'draft'
        ? 't-draft'
        : 't-inked';

  function beginDrag(event: React.MouseEvent<HTMLDivElement>) {
    if (locked || (block.readOnly && block.kind !== 'break') || isDone) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    event.preventDefault();
    didDragRef.current = false;
    const startY = event.clientY;
    const baseMinutes = block.startHour * 60 + block.startMin;

    function onMove(moveEvent: MouseEvent) {
      const deltaY = moveEvent.clientY - startY;
      if (Math.abs(deltaY) > 4) didDragRef.current = true;
      const rawMinutes = baseMinutes + (deltaY / hourHeight) * 60;
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
    if (locked || block.readOnly || isDone) return;
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const baseDuration = block.durationMins;

    function onMove(moveEvent: MouseEvent) {
      const deltaY = moveEvent.clientY - startY;
      const pixelsPerSnap = hourHeight * (GRID_SNAP_MINS / 60);
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
    if (locked || !block.linkedTaskId || block.readOnly || isDone || dayCommitInfo.state !== 'started') return;
    event.stopPropagation();
    setActiveTask(block.linkedTaskId);
    void window.api.pomodoro.start(block.linkedTaskId, block.title);
    void window.api.window.activate();
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (didDragRef.current) { didDragRef.current = false; return; }
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    e.stopPropagation(); // Prevent grid from deselecting immediately
    // Select/deselect this block
    onSelect?.(isSelected ? '' : block.id);
  }

  function handleToggleTask(event: React.MouseEvent<HTMLButtonElement>) {
    if (locked || !block.linkedTaskId || block.readOnly) return;
    event.stopPropagation();
    void toggleTask(block.linkedTaskId);
  }

  return (
    <div
      ref={blockRef}
      data-task-id={block.linkedTaskId || undefined}
      onMouseDown={beginDrag}
      onClick={handleClick}
      className={cn(
        blockVariant,
        'animate-fade-in absolute overflow-hidden flex flex-col group/block',
        isCompact ? 'gap-0 py-1 px-2' : 'gap-1',
        'transition-all duration-300',
        isFocus && block.kind !== 'hard' && 'focus-block-card',
        stagger === 1 && 'stagger-2',
        stagger === 2 && 'stagger-3',
        stagger === 3 && 'stagger-4',
        isDragging && 'opacity-30 scale-[0.98]',
        isDone && 'opacity-70 saturate-[0.8]',
        isSelected && 'ring-1 ring-accent-warm/50',
        isNow && !isDragging && !isSelected && 'ring-1 ring-active/40',
        isNestOver && 'ring-2 ring-accent-warm/40'
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: colCount > 1 ? `calc(${(colIndex * 100) / colCount}% + 4px)` : '4px',
        right: colCount > 1 ? `calc(${((colCount - colIndex - 1) * 100) / colCount}% + 4px)` : '4px',
        borderLeftColor: block.kind === 'focus' ? threadColor : undefined,
        backgroundColor: blockVariant !== 't-draft' ? tintColor : undefined,
        zIndex: isSelected ? 6 : isNow ? 5 : colIndex + 1,
      }}
    >
      {/* Drag handle to return block to sidebar */}
      {!locked && !block.readOnly && !isDone && block.linkedTaskId && (
        <button
          ref={dragRef}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className="absolute top-2 left-2 p-1 rounded-md text-text-muted/60 hover:text-text-primary hover:bg-bg-card cursor-grab active:cursor-grabbing opacity-0 group-hover/block:opacity-100 transition-all z-10"
          title="Drag back to plan"
        >
          <GripVertical className="w-3 h-3" />
        </button>
      )}
      {!locked && !block.readOnly && block.linkedTaskId && !isDone && (
        <button
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={startFocus}
          className="absolute top-2 right-9 rounded-md bg-black/15 p-1 text-text-muted/80 hover:text-accent-warm hover:bg-bg-card opacity-0 group-hover/block:opacity-100 transition-all"
          title="Start focus"
        >
          <Play className="w-3 h-3 fill-current" />
        </button>
      )}
      {!locked && !block.readOnly && block.linkedTaskId && (
        <button
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={handleToggleTask}
          className={cn(
            'absolute top-2 right-2 rounded-md p-1 transition-all',
            isDone
              ? 'bg-accent-warm/18 text-accent-warm opacity-100'
              : 'bg-black/15 text-text-muted/80 opacity-0 group-hover/block:opacity-100 hover:text-text-primary hover:bg-bg-card'
          )}
          title={isDone ? 'Mark incomplete' : 'Mark done'}
        >
          <Check className="w-3 h-3" />
        </button>
      )}

      <div className="relative z-10 flex items-start pr-6">
        <h4 className={cn(
          'truncate focus-editorial font-display italic leading-snug flex-1',
          isCompact ? 'text-[13px]' : 'text-[16px]',
          isDone ? 'text-text-muted line-through' : 'text-slate-100'
        )}>{block.title}</h4>
        <span className="shrink-0 ml-2 flex items-center gap-1.5 text-[10px] text-[rgba(148,163,184,0.3)] tracking-wider whitespace-nowrap">
          {physicsWarning && (
            <span
              className="inline-block w-[5px] h-[5px] rounded-full shrink-0"
              style={{ background: 'rgba(245,158,11,0.55)' }}
              title={physicsWarning}
            />
          )}
          {formatTimeShort(block.startHour, block.startMin)}
        </span>
      </div>
      {!isCompact && (
      <div className="relative z-10 flex items-center gap-2 focus-fade-meta">
        {isDone && (
          <span className="flex items-center gap-1 rounded-full border border-white/6 bg-black/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-text-muted/90">
            <Check className="h-3 w-3" />
            done
          </span>
        )}
        {actualLabel && block.kind === 'focus' && (
          <span className="rounded-full border border-white/6 bg-black/15 px-2 py-0.5 text-[10px] normal-case tracking-normal text-text-muted/90">
            {actualLabel} worked
          </span>
        )}
      </div>
      )}

      {(block.kind === 'break' || !isCompact) && nestedTasks.length > 0 && (
        <div className="relative z-10 flex flex-col gap-0.5 mt-1">
          {nestedTasks.map((task) => (
            <div
              key={task.id}
              data-task-id={task.id}
              className={cn(
                'flex items-center gap-2 pl-0.5 group/nested rounded cursor-pointer',
                selectedNestedTaskId === task.id && 'bg-accent-warm/10'
              )}
              onClick={(e) => { e.stopPropagation(); onSelectNestedTask?.(task.id); }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); void toggleTask(task.id); }}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                className={cn(
                  'w-2 h-2 rounded-full border shrink-0 transition-colors',
                  task.status === 'done'
                    ? 'bg-accent-warm/60 border-accent-warm/60'
                    : 'border-text-muted/30 hover:border-text-muted/60'
                )}
              />
              <span className={cn(
                'font-sans text-[11px] truncate',
                task.status === 'done'
                  ? 'line-through text-text-muted/40'
                  : 'text-text-primary/70'
              )}>
                {task.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* AI Breakdown for focus blocks */}
      {!isCompact && block.kind === 'focus' && block.linkedTaskId && (
        <AIBreakdown block={block} />
      )}

      {/* Draft block accept/reject actions */}
      {!locked && blockVariant === 't-draft' && (
        <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid rgba(250,250,250,0.04)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); acceptProposal(block.id); }}
            className="font-sans text-[13px] text-[#E55547]/65 hover:text-[#E55547]/90 transition-colors cursor-pointer font-medium"
          >
            Ink it →
          </button>
          <span className="text-text-muted/20 text-[10px]">·</span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="font-sans text-[11px] text-text-muted/30 hover:text-text-muted/50 transition-colors cursor-pointer"
          >
            skip for now
          </button>
        </div>
      )}

      {!locked && onUpdateDuration && !isDone && block.durationMins >= 15 && (
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
      {!locked && !block.readOnly && !isDone && block.linkedTaskId && block.durationMins >= 15 && !onUpdateDuration && (() => {
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
      {!locked && (
        <div
          ref={nestDropRef}
          className={cn(
            'absolute bottom-0 left-0 right-0 h-6 rounded-b-xl flex items-center justify-center',
            'transition-opacity',
            isNestOver
              ? 'opacity-100 bg-accent-warm/12'
              : 'opacity-0 group-hover/block:opacity-40'
          )}
        >
          {isNestOver && (
            <span className="text-[9px] uppercase tracking-widest text-accent-warm/70 pointer-events-none">
              + nest task
            </span>
          )}
        </div>
      )}
      {!locked && !block.readOnly && !isDone && (
        <div
          onMouseDown={beginResize}
          className="absolute left-3 right-3 bottom-1 h-2 cursor-row-resize rounded-full bg-accent-warm/20 opacity-0 group-hover/block:opacity-100 transition-opacity"
        />
      )}
    </div>
  );
}
