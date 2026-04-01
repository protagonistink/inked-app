import { useCallback, useEffect, useRef, useState } from 'react';
import { X, ChevronDown, ChevronRight, Check, Info } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { useModifierKey } from '@/hooks/useModifierKey';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { cn, formatRoundedHours, roundToQuarterHour } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { usePlanner } from '@/context/AppContext';
import { useGravityContext } from '@/context/GravityContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { useSound } from '@/hooks/useSound';
import { resolveGoalColor, withAlpha } from '@/lib/goalColors';
import type { PlannedTask } from '@/types';

export type DeadlineState = 'silent' | 'upcoming' | 'soon' | 'overdue';

export function getDeadlineState(daysRemaining: number): DeadlineState {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 2) return 'soon';
  if (daysRemaining <= 7) return 'upcoming';
  return 'silent';
}

function SubtaskRow({ task, unnestTask }: { task: PlannedTask; unnestTask: (id: string) => void }) {
  const { toggleTask } = usePlanner();
  return (
    <div className="flex items-center gap-2 py-2 pl-7 border-b border-ink/5 last:border-0">
      <button
        onClick={(e) => { e.stopPropagation(); void toggleTask(task.id); }}
        className="shrink-0"
      >
        {task.status === 'done' ? (
          <div className="w-3.5 h-3.5 border border-text-muted/50 flex items-center justify-center">
            <Check className="w-2 h-2 stroke-[2]" />
          </div>
        ) : (
          <div className="w-3.5 h-3.5 border border-text-muted/40 hover:border-text-primary transition-colors" />
        )}
      </button>
      <span className={cn(
        'flex-1 font-display text-[14px] leading-snug',
        task.status === 'done' ? 'text-text-muted line-through' : 'text-text-primary/80'
      )}>
        {task.title}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); unnestTask(task.id); }}
        className="p-1 text-text-muted/40 hover:text-text-muted transition-colors"
        title="Detach subtask"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

export function TaskCard({
  task,
  index,
  goalIndex = -1,
  goalColor,
  actualMins = 0,
  subtasks = [],
  nestTask,
  unnestTask,
  deadlineInfo,
  celebrate = false,
  celebrationDelayMs = 0,
}: {
  task: PlannedTask;
  index: number;
  goalIndex?: number;
  goalColor?: string;
  actualMins?: number;
  subtasks?: PlannedTask[];
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
  deadlineInfo?: { daysRemaining: number; state: DeadlineState };
  celebrate?: boolean;
  celebrationDelayMs?: number;
}) {
  const { isLight, isFocus } = useTheme();
  const { toggleTask, setActiveTask, releaseTask, updateTaskEstimate } = usePlanner();
  const { play } = useSound();
  const { active: gravityActive, staleGoalId } = useGravityContext();
  const isGravityDimmed = gravityActive && task.weeklyGoalId !== staleGoalId;
  const plannedHours = formatRoundedHours(task.estimateMins, true);
  const actualHours = formatRoundedHours(actualMins, true);
  const varianceMinutes = roundToQuarterHour(actualMins) - roundToQuarterHour(task.estimateMins);
  const varianceLabel =
    actualMins <= 0
      ? null
      : varianceMinutes > 0
        ? `${formatRoundedHours(varianceMinutes, true)} over`
        : varianceMinutes < 0
          ? `${formatRoundedHours(Math.abs(varianceMinutes), true)} under`
          : 'on estimate';

  const [flipped, setFlipped] = useState(false);
  const [estimateEditing, setEstimateEditing] = useState(false);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getEstimateStep(mins: number): number {
    if (mins < 60) return 15;
    if (mins < 120) return 30;
    return 60;
  }

  function handleEstimateClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEstimateEditing(true);
  }

  function handleEstimateBlur() {
    blurTimeoutRef.current = setTimeout(() => setEstimateEditing(false), 150);
  }

  function handleEstimateButtonMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  }

  function handleEstimateDecrement(e: React.MouseEvent) {
    e.stopPropagation();
    const step = getEstimateStep(task.estimateMins);
    updateTaskEstimate(task.id, task.estimateMins - step);
  }

  function handleEstimateIncrement(e: React.MouseEvent) {
    e.stopPropagation();
    const step = getEstimateStep(task.estimateMins);
    updateTaskEstimate(task.id, task.estimateMins + step);
  }

  function handleEstimateKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setEstimateEditing(false);
  }

  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, unknown, { isDragging: boolean }>({
    type: DragTypes.TASK,
    item: {
      id: task.id,
      title: task.title,
      priority: task.priority,
      sourceId: task.sourceId,
      sourceType: task.source,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);

  const modifierHeld = useModifierKey();
  const [expanded, setExpanded] = useState(false);
  const [{ isNestOver, canNest }, nestDropRef] = useDrop<DragItem, void, { isNestOver: boolean; canNest: boolean }>({
    accept: DragTypes.TASK,
    canDrop: (item) => modifierHeld && item.id !== task.id && item.id !== task.parentId,
    drop: (item) => { nestTask(item.id, task.id); },
    collect: (monitor) => ({ isNestOver: monitor.isOver(), canNest: monitor.canDrop() }),
  });

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    dragRef(node);
    nestDropRef(node);
  }, [dragRef, nestDropRef]);

  const staggerClass = index < 8 ? `stagger-${Math.min(index + 1, 6)}` : '';

  // Thread color matching weekly goal — same palette as Timeline blocks
  const resolvedGoalColor = goalColor ?? resolveGoalColor(null, goalIndex);
  const threadBorderColor = withAlpha(resolvedGoalColor, 0.68);

  const formattedDueDate = task.dueOn
    ? new Date(task.dueOn + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      ref={combinedRef}
      data-task-id={task.id}
      className={cn(
        'animate-fade-in group relative border-b border-ink/5 border-l-2 transition-all duration-300 select-none',
        isGravityDimmed && 'gravity-dim',
        task.active && 'border-accent-warm/20',
        isDragging && 'opacity-30 scale-[0.98]',
        isNestOver && canNest && 'ring-1 ring-accent-warm/40 ring-inset rounded-lg',
        staggerClass
      )}
      style={{
        perspective: '800px',
        borderLeftColor: deadlineInfo?.state === 'overdue' ? 'rgba(200,60,47,0.8)' : threadBorderColor,
        boxShadow: celebrate ? `inset 0 0 0 1px ${withAlpha(resolvedGoalColor, 0.08)}` : undefined,
      }}
    >
      <div
        className="relative w-full transition-transform duration-[400ms]"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* ── FRONT SIDE ── */}
        <div style={{ backfaceVisibility: 'hidden' }}>
          {celebrate && (
            <div
              className="goal-handoff-card pointer-events-none absolute inset-0"
              style={{
                '--goal-handoff-color': resolvedGoalColor,
                '--goal-handoff-soft': withAlpha(resolvedGoalColor, 0.18),
                animationDelay: `${celebrationDelayMs}ms`,
              } as React.CSSProperties}
            />
          )}
          <div className={cn('flex items-center gap-2.5 py-5 cursor-grab active:cursor-grabbing', !task.active && 'hover:-translate-y-0.5')}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void toggleTask(task.id);
                play('click');
              }}
              className="shrink-0"
            >
              {task.status === 'done' ? (
                <div className={cn('w-4 h-4 border flex items-center justify-center animate-check-pop', isLight ? 'border-stone-300 bg-stone-200/20' : isFocus ? 'border-stone-700 bg-stone-700/20' : 'border-accent-warm bg-accent-warm/20')}>
                  <Check className="w-2.5 h-2.5 stroke-[2]" />
                </div>
              ) : (
                <div className={cn('w-4 h-4 border transition-colors', task.active ? 'border-accent-warm bg-accent-warm/10 animate-breathe' : 'border-text-muted/40 group-hover:border-text-primary')} />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <button
                onClick={() => task.status !== 'done' && setActiveTask(task.id)}
                className="text-left w-full"
                title="Click to focus this task. Press I to cycle its weekly intention. Option+I clears it."
              >
                <div
                  title={task.title}
                  className={cn('font-display text-[18px] leading-snug transition-colors line-clamp-2', task.status === 'done' ? 'text-text-muted line-through' : task.active ? 'text-text-emphasis font-semibold' : 'text-text-primary')}
                >
                  {task.title}
                </div>
                <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted mt-1 flex items-center gap-2">
                  {estimateEditing ? (
                    <span
                      className="flex items-center gap-0.5"
                      onBlur={handleEstimateBlur}
                      onKeyDown={handleEstimateKeyDown}
                      tabIndex={-1}
                    >
                      <button
                        onMouseDown={handleEstimateButtonMouseDown}
                        onClick={handleEstimateDecrement}
                        className="px-1 py-0.5 rounded hover:bg-bg-elevated hover:text-text-primary transition-colors leading-none"
                        title="Decrease estimate"
                      >
                        –
                      </button>
                      <span className="min-w-[28px] text-center text-text-primary font-mono">{plannedHours}</span>
                      <button
                        onMouseDown={handleEstimateButtonMouseDown}
                        onClick={handleEstimateIncrement}
                        className="px-1 py-0.5 rounded hover:bg-bg-elevated hover:text-text-primary transition-colors leading-none"
                        title="Increase estimate"
                      >
                        +
                      </button>
                    </span>
                  ) : (
                    <span
                      onClick={handleEstimateClick}
                      className="cursor-pointer hover:text-text-primary transition-colors"
                      title="Click to edit estimate"
                    >
                      {plannedHours}
                    </span>
                  )}
                  {actualMins > 0 && <span>{actualHours} actual</span>}
                  {varianceLabel && <span>{varianceLabel}</span>}
                  {task.active && task.status !== 'done' && <span className="text-active">now</span>}
                  {task.status === 'scheduled' && (
                    <span className="text-accent-warm/50 italic tracking-normal lowercase">on calendar</span>
                  )}
                  {task.status !== 'scheduled' && !task.active && index === 0 && task.status !== 'done' && (
                    <span className="text-text-muted/50 italic tracking-normal lowercase">on deck</span>
                  )}
                </div>
              </button>
            </div>

            <div className={cn(
              'flex items-center gap-0.5 transition-opacity duration-150',
              task.active ? 'opacity-30 group-hover:opacity-70' : 'opacity-0 group-hover:opacity-100'
            )}>
              {task.active && task.status !== 'done' && (
                <button
                  onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                  className="p-1.5 text-text-muted/30 hover:text-text-muted/60 transition-colors"
                  title="Show details"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => { void releaseTask(task.id); }}
                className="p-1.5 text-text-muted/30 hover:text-text-muted/60 transition-colors"
                title="Release"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {subtasks.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((prev) => !prev); }}
              className="flex items-center gap-1.5 px-3 pb-3 text-[11px] text-text-muted hover:text-text-primary transition-colors"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>{subtasks.length} task{subtasks.length !== 1 ? 's' : ''}</span>
            </button>
          )}
          {expanded && subtasks.map((sub) => (
            <SubtaskRow key={sub.id} task={sub} unnestTask={unnestTask} />
          ))}

          {deadlineInfo?.state === 'soon' && (
            <span className="absolute bottom-1 left-1.5 text-[9px] font-mono text-amber-400/70 pointer-events-none select-none">
              {deadlineInfo.daysRemaining}d
            </span>
          )}
        </div>

        {/* ── BACK SIDE ── */}
        <div
          onClick={() => setFlipped(false)}
          className="absolute inset-0 cursor-pointer px-3 py-4 flex flex-col gap-2.5"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {task.notes && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted mb-0.5">Notes</div>
              <p className="font-display text-[14px] leading-snug text-text-primary/80 line-clamp-3">{task.notes}</p>
            </div>
          )}
          {formattedDueDate && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted mb-0.5">Due</div>
              <p className="font-display text-[14px] leading-snug text-text-primary/80">{formattedDueDate}</p>
            </div>
          )}
          {task.asanaProject && (
            <div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted mb-0.5">Project</div>
              <p className="font-display text-[14px] leading-snug text-text-primary/80">{task.asanaProject}</p>
            </div>
          )}
          <div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted mb-0.5">Source</div>
            <span className={cn(
              'inline-block text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm',
              task.source === 'asana' ? 'bg-accent-warm/10 text-accent-warm' : 'bg-text-muted/10 text-text-muted'
            )}>
              {task.source === 'asana' ? 'Asana' : 'Local'}
              {task.asanaProject && <> · {task.asanaProject}</>}
            </span>
          </div>
          <p className="mt-auto text-[9px] text-text-muted/40 italic">Click to flip back</p>
        </div>
      </div>

      {isNestOver && canNest && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none bg-accent-warm/5">
          <span className="text-[11px] text-accent-warm/80 uppercase tracking-wider">Nest here</span>
        </div>
      )}
    </div>
  );
}
