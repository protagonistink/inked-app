// src/components/BlockCard.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { cn, formatRoundedHours } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useAppShell, usePlanner } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { resolveGoalColor, withAlpha } from '@/lib/goalColors';
import type { PlannedTask, ScheduleBlock } from '@/types';
import { AIBreakdown } from '../AIBreakdown';
import { timeToTop, formatTimeShort, GRID_SNAP_MINS, getStepMins } from './timelineUtils';

function formatDurationStamp(durationMins: number) {
  const hours = Math.floor(durationMins / 60);
  const mins = durationMins % 60;

  if (hours === 0) return `:${String(mins).padStart(2, '0')}`;
  if (mins === 0) return `${hours}hr${hours === 1 ? '' : 's'}`;
  return `${hours}:${String(mins).padStart(2, '0')}`;
}

function DurationMeter({ durationMins }: { durationMins: number }) {
  return (
    <div className="rounded-full border border-accent-warm/18 bg-black/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-muted/90 focus-fade-meta">
      {formatDurationStamp(durationMins)}
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
  const { isFocus, isLight } = useTheme();
  const { enterFocus } = useAppShell();
  const { plannedTasks, weeklyGoals, setActiveTask, toggleTask, nestTaskInBlock } = usePlanner();
  const linkedTask = block.linkedTaskId ? plannedTasks.find((task) => task.id === block.linkedTaskId) : null;
  const isDone = linkedTask?.status === 'done';
  const blockSubtitle = linkedTask?.notes
    ? linkedTask.notes.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim()
    : linkedTask?.asanaProject ?? '';

  // Dynamic thread color for border-left based on weekly goal
  const goalId = linkedTask?.weeklyGoalId ?? block.linkedGoalId ?? null;
  const goalIndex = goalId ? weeklyGoals.findIndex((g) => g.id === goalId) : -1;
  const goal = goalIndex >= 0 ? weeklyGoals[goalIndex] : null;
  const intentionColor = resolveGoalColor(goal?.color, goalIndex);

  // Derive block style based on kind
  const isAdHocEarly = block.kind === 'hard' && !block.readOnly && block.source === 'local';
  const isGcal = block.kind === 'hard' && !isAdHocEarly;
  const isRitual = block.kind === 'break';
  const isTaskBlock = !isGcal && !isRitual;

  // Style sets per block type
  const blockBorderLeft = isRitual
    ? '3px dashed var(--color-border)'
    : isGcal
      ? '3px solid var(--color-border-subtle)'
      : `4px solid ${intentionColor}`;
  const blockBackground = isGcal
    ? 'var(--color-surface)'
    : isRitual
      ? 'var(--color-surface)'
      : `linear-gradient(90deg, ${withAlpha(intentionColor, 0.2)} 0%, ${withAlpha(intentionColor, 0.11)} 42%, var(--color-surface) 100%)`;
  const blockBorder = isRitual
    ? '1px dashed var(--color-border-subtle)'
    : isGcal
      ? '1px solid var(--color-border-subtle)'
      : `1px solid ${withAlpha(intentionColor, 0.22)}`;
  const blockBorderRadius = isTaskBlock ? '3px 10px 10px 3px' : undefined;
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

  // Box shadow for NOW/active block (computed after isDragging is available)
  const blockBoxShadow = isNow && !isDragging && isTaskBlock
    ? '0 0 0 1px rgba(200,60,47,0.3), 0 2px 10px rgba(200,60,47,0.05)'
    : isTaskBlock
      ? `0 10px 28px ${withAlpha(intentionColor, 0.08)}`
      : undefined;

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
  const isExpanded = isSelected;
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

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (didDragRef.current) { didDragRef.current = false; return; }
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    e.stopPropagation(); // Prevent grid from deselecting immediately
    // Select/deselect this block
    onSelect?.(isSelected ? '' : block.id);
  }

  function handleDoubleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (locked || !block.linkedTaskId || block.readOnly || isDone) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    event.stopPropagation();
    setActiveTask(block.linkedTaskId);
    enterFocus(block.linkedTaskId);
  }

  return (
    <div
      ref={blockRef}
      data-task-id={block.linkedTaskId || undefined}
      onMouseDown={beginDrag}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        blockVariant,
        'animate-fade-in absolute overflow-hidden flex flex-col group/block select-none',
        isCompact ? 'gap-0 py-1 px-2' : 'gap-1',
        'transition-all duration-300',
        !locked && !isDone && !(block.readOnly && block.kind !== 'break') && 'cursor-grab active:cursor-grabbing',
        isFocus && block.kind !== 'hard' && 'focus-block-card',
        stagger === 1 && 'stagger-2',
        stagger === 2 && 'stagger-3',
        stagger === 3 && 'stagger-4',
        isDragging && 'opacity-30 scale-[0.98]',
        isDone && 'opacity-70 saturate-[0.8]',
        isSelected && 'ring-1 ring-accent-warm/50',
        isNestOver && 'ring-2 ring-accent-warm/40'
      )}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: colCount > 1 ? `calc(${(colIndex * 100) / colCount}% + 4px)` : '4px',
        right: colCount > 1 ? `calc(${((colCount - colIndex - 1) * 100) / colCount}% + 4px)` : '4px',
        borderLeft: blockVariant !== 't-draft' ? blockBorderLeft : undefined,
        border: blockVariant !== 't-draft' ? blockBorder : undefined,
        borderRadius: blockBorderRadius,
        background: blockVariant !== 't-draft' ? blockBackground : undefined,
        boxShadow: blockBoxShadow,
        zIndex: isSelected ? 6 : isNow ? 5 : colIndex + 1,
      }}
    >
      {/* Hidden drag handle — preserves drag-back functionality */}
      {!locked && !block.readOnly && !isDone && block.linkedTaskId && (
        <span ref={dragRef} className="sr-only" aria-hidden="true" />
      )}
      {/* Thread color dot + done indicator */}
      {isTaskBlock && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: isDone ? 'var(--color-text-muted)' : intentionColor }}
          />
          {isDone && (
            <Check className="w-3 h-3 text-text-muted" />
          )}
        </div>
      )}

      <div className="relative z-10 flex items-start pr-6">
        <h4 className={cn(
          'truncate focus-editorial font-display font-medium leading-snug flex-1',
          isCompact ? 'text-[12px]' : 'text-[14px]',
          isDone ? 'text-text-muted line-through' : isLight ? 'text-text-emphasis' : 'text-slate-100'
        )}>{block.title}</h4>
        <span className="shrink-0 ml-2 flex items-center gap-1.5 text-[10px] text-text-muted tracking-wider whitespace-nowrap">
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
      {draft && (
        <div className="relative z-10 mt-1">
          <span className="inline-flex items-center gap-2 rounded-[3px] border border-white/8 bg-black/20 px-2 py-1 text-[9px] uppercase tracking-[0.18em] text-text-muted/90">
            {formatTimeShort(draft.startHour, draft.startMin)}
            <span className="text-text-muted/45">·</span>
            {formatDurationStamp(draft.durationMins)}
          </span>
        </div>
      )}
      {isTaskBlock && blockSubtitle && (
        <div className={cn(
          'relative z-10 pr-6 text-text-secondary/75 line-clamp-1',
          isCompact ? 'text-[9px] leading-tight' : 'text-[10px] leading-snug'
        )}>
          {blockSubtitle}
        </div>
      )}
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

      {(block.kind === 'break' || !isCompact) && nestedTasks.length > 0 && isExpanded && (
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
      {!isCompact && isExpanded && block.kind === 'focus' && block.linkedTaskId && (
        <AIBreakdown block={block} />
      )}

      {/* Draft block accept/reject actions */}
      {!locked && blockVariant === 't-draft' && (
        <div className="flex items-center gap-3 mt-4 pt-3" style={{ borderTop: '1px solid rgba(250,250,250,0.04)' }}>
          <button
            onClick={(e) => { e.stopPropagation(); acceptProposal(block.id); }}
            className="font-sans text-[13px] text-[#C83C2F]/65 hover:text-[#C83C2F]/90 transition-colors cursor-pointer font-medium"
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

      {!locked && isExpanded && onUpdateDuration && !isDone && block.durationMins >= 15 && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 opacity-0 group-hover/block:opacity-100 transition-opacity z-10"
        >
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateDuration(Math.max(15, block.durationMins - getStepMins(block.durationMins))); }}
            disabled={block.durationMins <= 15}
            className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1 disabled:opacity-30"
            title="Decrease duration"
          >
            –
          </button>
          <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-text-muted/90">
            {block.durationMins} min
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateDuration(block.durationMins + getStepMins(block.durationMins)); }}
            className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1"
            title="Increase duration"
          >
            +
          </button>
        </div>
      )}
      {!locked && isExpanded && !block.readOnly && !isDone && block.linkedTaskId && block.durationMins >= 15 && !onUpdateDuration && (() => {
        return (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-2 opacity-0 group-hover/block:opacity-100 transition-opacity z-10"
          >
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(block.startHour, block.startMin, Math.max(15, block.durationMins - getStepMins(block.durationMins))); }}
              disabled={block.durationMins <= 15}
              className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1 disabled:opacity-30"
              title="Decrease duration"
            >
              –
            </button>
            <DurationMeter durationMins={block.durationMins} />
            <button
              onClick={(e) => { e.stopPropagation(); onUpdate(block.startHour, block.startMin, block.durationMins + getStepMins(block.durationMins)); }}
              className="text-[12px] text-text-muted hover:text-text-primary transition-colors px-1"
              title="Increase duration"
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
          className={cn(
            'absolute left-3 right-3 bottom-1 h-2 cursor-row-resize rounded-full bg-accent-warm/20 transition-opacity',
            (isDragging || draft) ? 'opacity-0' : 'opacity-0 group-hover/block:opacity-100'
          )}
        />
      )}
    </div>
  );
}
