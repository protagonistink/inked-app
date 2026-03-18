import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, CornerDownLeft, ArrowRight, Lock, LockOpen, X, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useDrag, useDrop, useDragLayer } from 'react-dnd';
import { useModifierKey } from '@/hooks/useModifierKey';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { cn, formatRoundedHours, roundToQuarterHour } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { useSound } from '@/hooks/useSound';
import type { PlannedTask, WeeklyGoal } from '@/types';

type DeadlineState = 'silent' | 'upcoming' | 'soon' | 'overdue';

function getDeadlineState(daysRemaining: number): DeadlineState {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 2) return 'soon';
  if (daysRemaining <= 7) return 'upcoming';
  return 'silent';
}

function SubtaskRow({ task, unnestTask }: { task: PlannedTask; unnestTask: (id: string) => void }) {
  const { toggleTask } = useApp();
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

function TaskCard({
  task,
  index,
  actualMins = 0,
  subtasks = [],
  nestTask,
  unnestTask,
  deadlineInfo,
}: {
  task: PlannedTask;
  index: number;
  actualMins?: number;
  subtasks?: PlannedTask[];
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
  deadlineInfo?: { daysRemaining: number; state: DeadlineState };
}) {
  const { isLight, isFocus } = useTheme();
  const { toggleTask, setActiveTask, releaseTask, updateTaskEstimate } = useApp();
  const { play } = useSound();
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

  return (
    <div
      ref={combinedRef}
      data-task-id={task.id}
      className={cn(
        'animate-fade-in group relative border-b border-ink/5 transition-all duration-300',
        task.active && 'border-accent-warm/20',
        isDragging && 'opacity-30 scale-[0.98]',
        isNestOver && canNest && 'ring-1 ring-accent-warm/40 ring-inset rounded-lg',
        deadlineInfo?.state === 'upcoming' && 'border-l-2 border-l-amber-400/40',
        deadlineInfo?.state === 'soon'     && 'border-l-2 border-l-amber-400/70',
        deadlineInfo?.state === 'overdue'  && 'border-l-2 border-l-accent-warm',
        !deadlineInfo?.state && task.status === 'scheduled' && 'border-l-2 border-l-accent-warm/35',
        !deadlineInfo?.state && task.status === 'committed' && 'border-l-2 border-l-text-primary/10',
        staggerClass
      )}
    >
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
          'flex items-center transition-opacity duration-150',
          task.active ? 'opacity-30 group-hover:opacity-70' : 'opacity-0 group-hover:opacity-100'
        )}>
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

      {isNestOver && canNest && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center pointer-events-none bg-accent-warm/5">
          <span className="text-[11px] text-accent-warm/80 uppercase tracking-wider">Nest here</span>
        </div>
      )}

      {deadlineInfo?.state === 'soon' && (
        <span className="absolute bottom-1 left-1.5 text-[9px] font-mono text-amber-400/70 pointer-events-none select-none">
          {deadlineInfo.daysRemaining}d
        </span>
      )}
    </div>
  );
}

function GoalSection({
  goal,
  tasks,
  startIndex,
  actualByTask,
  allDaySubtasks,
  nestTask,
  unnestTask,
  deadlineInfo,
  isFirst = false,
}: {
  goal: WeeklyGoal;
  tasks: PlannedTask[];
  startIndex: number;
  actualByTask: Map<string, number>;
  allDaySubtasks: PlannedTask[];
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
  deadlineInfo?: { daysRemaining: number; state: DeadlineState };
  isFirst?: boolean;
}) {
  const { bringForward, unscheduleTaskBlock } = useApp();
  const finishedCount = tasks.filter((task) => task.status === 'done').length;

  const subtasksByParent = useMemo(() => {
    const map = new Map<string, PlannedTask[]>();
    for (const sub of allDaySubtasks) {
      if (!sub.parentId) continue;
      const existing = map.get(sub.parentId) ?? [];
      map.set(sub.parentId, [...existing, sub]);
    }
    return map;
  }, [allDaySubtasks]);

  const [{ isOver }, dropRef] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: [DragTypes.TASK, DragTypes.BLOCK],
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
    drop: (item) => {
      // bringForward handles both committing candidates and re-assigning already-committed tasks
      if (item.blockId) {
        void unscheduleTaskBlock(item.blockId, goal.id);
        return;
      }
      bringForward(item.id, goal.id);
    },
  });

  return (
    <div
      ref={dropRef}
      className={cn(
        'flex flex-col gap-3 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isOver && 'bg-accent-warm/[0.07] px-3 py-3 -mx-3'
      )}
      style={!isFirst ? { borderTop: '0.5px solid rgba(255,255,255,0.06)' } : undefined}
    >
      <div style={{ padding: '18px 16px 8px' }}>
        <div className="flex items-center justify-between">
          <div
            className="font-medium"
            style={{
              fontSize: 8,
              letterSpacing: '0.14em',
              textTransform: 'uppercase' as const,
              color: 'rgba(190,90,55,0.45)',
              marginBottom: 5,
            }}
          >
            Intention
          </div>
          {tasks.length > 0 && (
            <span className="text-[10px] font-mono" style={{ color: 'rgba(140,130,110,0.25)' }}>
              {finishedCount}/{tasks.length}
            </span>
          )}
        </div>
        <h3
          className="font-display text-[15px] leading-[1.3]"
          style={{ color: 'rgba(225,215,200,0.88)', letterSpacing: '-0.01em' }}
        >
          {goal.title}
        </h3>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className={cn(
            'mx-1 rounded-lg border border-dashed px-3 py-3 text-center text-[11px] transition-all duration-200',
            isOver
              ? 'border-accent-warm/40 text-accent-warm'
              : 'border-text-muted/15 text-text-muted/25'
          )}>
            {isOver ? 'Release it here.' : 'No tasks yet — drag one in'}
          </div>
        ) : (
          tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              task={task}
              index={startIndex + i}
              actualMins={actualByTask.get(task.id) ?? 0}
              subtasks={subtasksByParent.get(task.id) ?? []}
              nestTask={nestTask}
              unnestTask={unnestTask}
              deadlineInfo={deadlineInfo}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function TodaysFlow({ collapsed = false }: { collapsed?: boolean }) {
  const { isFocus } = useTheme();
  const {
    weeklyGoals,
    plannedTasks,
    dailyPlan,
    dayTasks,
    committedTasks,
    scheduleBlocks,
    workdayStart,
    workdayEnd,
    timeLogs,
    countdowns,
    addLocalTask,
    bringForward,
    unscheduleTaskBlock,
    resetDay,
    nestTask,
    unnestTask,
    lockDay,
    unlockDay,
  } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [balanceDismissed, setBalanceDismissed] = useState(false);
  const { play } = useSound();

  const finishedCount = plannedTasks.filter((task) => task.status === 'done' && dailyPlan.committedTaskIds.includes(task.id)).length;
  const totalDayCount = dailyPlan.committedTaskIds.length;
  const unscheduledCount = committedTasks.filter((task) => task.status === 'committed').length;
  const totalCommittedMinutes = dayTasks.reduce((sum, task) => sum + task.estimateMins, 0);
  const scheduledFocusMinutes = scheduleBlocks
    .filter((block) => block.kind === 'focus')
    .reduce((sum, block) => sum + block.durationMins, 0);
  const hardBlockMinutes = scheduleBlocks
    .filter((block) => block.kind === 'hard')
    .reduce((sum, block) => sum + block.durationMins, 0);
  const workdayMinutes = Math.max(0, (workdayEnd.hour * 60 + workdayEnd.min) - (workdayStart.hour * 60 + workdayStart.min));
  const availableFocusMinutes = Math.max(0, workdayMinutes - hardBlockMinutes);
  const unscheduledMinutes = committedTasks.reduce((sum, task) => sum + task.estimateMins, 0);
  const remainingFocusCapacity = Math.max(0, availableFocusMinutes - scheduledFocusMinutes);
  const actualByTask = useMemo(() => {
    const totals = new Map<string, number>();
    for (const log of timeLogs) {
      if (!log.taskId) continue;
      totals.set(log.taskId, (totals.get(log.taskId) || 0) + log.durationMins);
    }
    return totals;
  }, [timeLogs]);

  const allCommittedSubtasks = useMemo(() =>
    plannedTasks.filter((task) =>
      task.parentId &&
      dailyPlan.committedTaskIds.includes(task.id) &&
      dailyPlan.committedTaskIds.includes(task.parentId)
    ),
    [dailyPlan.committedTaskIds, plannedTasks]
  );

  const grouped = useMemo(() => weeklyGoals.map((goal) => ({
    goal,
    tasks: dayTasks.filter((task) => task.weeklyGoalId === goal.id),
  })), [dayTasks, weeklyGoals]);

  const deadlineByGoalId = useMemo(() => {
    const map = new Map<string, { daysRemaining: number; state: DeadlineState }>();
    const today = new Date();
    for (const goal of weeklyGoals) {
      if (!goal.countdownId) continue;
      const cd = countdowns.find((c) => c.id === goal.countdownId);
      if (!cd) continue;
      const daysRemaining = differenceInCalendarDays(parseISO(cd.dueDate), today);
      const state = getDeadlineState(daysRemaining);
      if (state !== 'silent') {
        map.set(goal.id, { daysRemaining, state });
      }
    }
    return map;
  }, [weeklyGoals, countdowns]);

  const realismWarning = useMemo(() => {
    if (dayTasks.length === 0) return null;

    if (totalCommittedMinutes > availableFocusMinutes) {
      const overBy = totalCommittedMinutes - availableFocusMinutes;
      return `The day is overcommitted by ${formatRoundedHours(overBy, true)} against the actual focus capacity.`;
    }

    if (unscheduledMinutes > remainingFocusCapacity) {
      const overBy = unscheduledMinutes - remainingFocusCapacity;
      return `There is ${formatRoundedHours(overBy, true)} still unplaced in Today’s Commit. The plan is likely to collapse unless something moves, shrinks, or drops.`;
    }

    if (remainingFocusCapacity < 30 && unscheduledMinutes > 0) {
      return 'There is almost no open focus capacity left, but the commit list is still carrying loose work.';
    }

    return null;
  }, [availableFocusMinutes, dayTasks.length, remainingFocusCapacity, totalCommittedMinutes, unscheduledMinutes]);

  const balanceWarning = useMemo(() => {
    if (dayTasks.length < 2) return null;

    const totals = weeklyGoals.map((goal) => ({
      title: goal.title,
      minutes: dayTasks
        .filter((task) => task.weeklyGoalId === goal.id)
        .reduce((sum, task) => sum + task.estimateMins, 0),
    }));
    const emptyGoals = totals.filter((goal) => goal.minutes === 0);
    const dominantGoal = totals.reduce((largest, goal) => goal.minutes > largest.minutes ? goal : largest, totals[0]);
    const dominanceRatio = totalCommittedMinutes > 0 ? dominantGoal.minutes / totalCommittedMinutes : 0;

    if (emptyGoals.length > 0 && dominanceRatio >= 0.70 && totalCommittedMinutes > 60) {
      return `${dominantGoal.title} is carrying most of the day while ${emptyGoals.map((goal) => goal.title).join(' and ')} gets nothing.`;
    }

    return null;
  }, [dayTasks, totalCommittedMinutes, weeklyGoals]);

  const deadlineWarning = useMemo(() => {
    if (countdowns.length === 0) return null;

    const today = new Date();
    const upcoming = countdowns
      .map((countdown) => ({
        ...countdown,
        days: differenceInCalendarDays(parseISO(countdown.dueDate), today),
      }))
      .filter((countdown) => countdown.days >= 0)
      .sort((a, b) => a.days - b.days)[0];

    if (!upcoming) return null;

    if (upcoming.days <= 2 && scheduledFocusMinutes < totalCommittedMinutes) {
      return `${upcoming.title} lands in ${upcoming.days === 0 ? 'hours' : `${upcoming.days} day${upcoming.days === 1 ? '' : 's'}`}. Protect real time for it instead of leaving the work loose in commit.`;
    }

    if (upcoming.days <= 5 && remainingFocusCapacity > 0) {
      return `${upcoming.title} is ${upcoming.days} day${upcoming.days === 1 ? '' : 's'} out. Use the remaining ${formatRoundedHours(remainingFocusCapacity, true)} to round out the day before it turns urgent.`;
    }

    return null;
  }, [countdowns, remainingFocusCapacity, scheduledFocusMinutes, totalCommittedMinutes]);

  const isDraggingTask = useDragLayer((monitor) => monitor.isDragging() && monitor.getItemType() === DragTypes.TASK);

  const [{ isOver }, dropRef] = useDrop<DragItem, void, { isOver: boolean }>({
    accept: [DragTypes.TASK, DragTypes.BLOCK],
    collect: (monitor) => ({ isOver: monitor.isOver() }),
    drop: (item, monitor) => {
      if (monitor.didDrop()) return;
      if (item.blockId) {
        void unscheduleTaskBlock(item.blockId);
        return;
      }
      bringForward(item.id);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    addLocalTask(inputValue, weeklyGoals[0]?.id);
    setInputValue('');
    play('paper');
  }

  let runningIndex = 0;

  if (collapsed) {
    return (
      <div
        className="w-10 shrink-0 flex flex-col items-center justify-between py-8 border-r border-border/30 select-none"
      >
        <div className="flex flex-col items-center gap-4">
          <Lock className="w-3.5 h-3.5 text-text-muted/40" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted/40 font-medium [writing-mode:vertical-rl] rotate-180">
            Today&apos;s Plan
          </span>
        </div>
        <button
          onClick={() => unlockDay()}
          className="flex flex-col items-center gap-1.5 text-text-muted/50 hover:text-accent-warm transition-colors cursor-pointer group"
          title="Unlock day"
        >
          <LockOpen className="w-3.5 h-3.5" />
          <span className="text-[9px] uppercase tracking-[0.16em] font-medium [writing-mode:vertical-rl] rotate-180 group-hover:text-accent-warm transition-colors">
            Unlock
          </span>
        </button>
      </div>
    );
  }

  return (
    <div ref={dropRef} className={cn('relative focus-dim-soft bg-bg flex-1 min-w-[280px] column-divider flex flex-col h-full transition-colors duration-700', isOver && 'bg-accent-warm/[0.03]')}>
      <div className="workspace-header px-8 shrink-0">
        <div className="workspace-header-copy">
          <h2 className="workspace-header-title workspace-header-title-editorial text-text-emphasis whitespace-nowrap transition-all duration-700">
            Today&apos;s Plan
          </h2>
        </div>
        <div className="workspace-header-meta">
          <span key={`count-${finishedCount}-${totalDayCount}`} className={cn('animate-fade-in', isFocus && 'focus-fade-meta')}>
            {finishedCount}/{totalDayCount} complete
          </span>
          <span className={cn(isFocus && 'focus-fade-meta')}>
            {unscheduledCount} left
          </span>
          {dayTasks.length > 0 && !isFocus && (
            confirmReset ? (
              <span className="flex items-center gap-1.5">
                <button
                  onClick={async () => { setConfirmReset(false); await resetDay(); play('paper'); }}
                  className="text-[10px] uppercase tracking-[0.14em] text-accent-warm/70 hover:text-accent-warm transition-colors"
                >
                  Clear
                </button>
                <span className="text-[10px]">/</span>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="text-[10px] uppercase tracking-[0.14em] hover:text-text-primary transition-colors"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="text-[10px] uppercase tracking-[0.14em] hover:text-text-primary transition-colors"
              >
                Clear board
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-8 hide-scrollbar">
        <form onSubmit={handleSubmit} className="animate-fade-in relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Plus className="w-4 h-4 text-text-muted group-focus-within:text-text-primary transition-colors" />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Add task"
            className="editorial-inset w-full rounded-[18px] py-3 pl-11 pr-10 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-warm/40 focus:bg-bg-elevated transition-all"
          />
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <CornerDownLeft className="w-3.5 h-3.5 text-text-muted/40" />
          </div>
        </form>


        {isOver && (
          <div className="rounded-[18px] border border-dashed border-accent-warm/35 bg-accent-warm/[0.06] px-4 py-3 flex items-center justify-center gap-2 text-[12px] text-accent-warm animate-slide-down">
            <ChevronDown className="w-3.5 h-3.5 animate-breathe" />
            <span>Release</span>
          </div>
        )}

        {(realismWarning || balanceWarning || deadlineWarning) && (
          <div className="grid gap-3">
            {realismWarning && (
              <div className="border-l-2 border-l-[rgba(140,130,110,0.35)] px-3 py-2 text-[12px]">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted/60 opacity-50">Reality Check</div>
                <div className="mt-1 text-[13px] text-[rgba(190,180,160,0.7)]">{realismWarning}</div>
                <div className="mt-2 text-[11px] text-text-muted/50">
                  Capacity: {formatRoundedHours(availableFocusMinutes, true)}. Scheduled: {formatRoundedHours(scheduledFocusMinutes, true)}. Still loose: {formatRoundedHours(unscheduledMinutes, true)}.
                </div>
              </div>
            )}
            {balanceWarning && !balanceDismissed && (
              <div
                className="relative"
                style={{
                  border: 'none',
                  borderLeft: '2px solid rgba(80,120,200,0.5)',
                  borderRadius: 0,
                  background: 'rgba(80,120,200,0.04)',
                  padding: '10px 12px',
                }}
              >
                <button
                  onClick={() => setBalanceDismissed(true)}
                  className="absolute top-2 right-3 hover:opacity-60 transition-opacity"
                  style={{ opacity: 0.3, background: 'none', border: 'none' }}
                  title="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="flex gap-[11px] items-start pr-5">
                  <svg width="20" height="20" viewBox="0 0 14 14" fill="none" className="shrink-0" style={{ opacity: 0.8, marginTop: 1 }}>
                    <circle cx="7" cy="7" r="6.25" stroke="rgba(100,140,220,0.8)" strokeWidth="0.75" fill="none"/>
                    <path d="M7 0.75 A6.25 6.25 0 0 0 7 13.25 A3.125 3.125 0 0 1 7 6.875 A3.125 3.125 0 0 0 7 0.75Z" fill="rgba(100,140,220,0.8)"/>
                    <circle cx="7" cy="3.875" r="1.3" fill="rgba(100,140,220,0.8)"/>
                    <circle cx="7" cy="10.125" r="1.3" fill="rgba(19,18,17,1)" stroke="rgba(100,140,220,0.45)" strokeWidth="0.5"/>
                  </svg>
                  <div className="text-[13px]" style={{ color: 'rgba(200,195,185,0.82)' }}>{balanceWarning}</div>
                </div>
              </div>
            )}
            {deadlineWarning && (
              <div
                style={{
                  border: 'none',
                  borderLeft: '2px solid rgba(190,90,55,0.6)',
                  borderRadius: 0,
                  background: 'rgba(190,90,55,0.04)',
                  padding: '10px 12px',
                }}
              >
                <div className="flex gap-[11px] items-start">
                  <svg width="20" height="20" viewBox="0 0 12 16" fill="none" className="shrink-0" style={{ opacity: 0.8, marginTop: 1 }}>
                    <path d="M6 15C9.314 15 11 12.8 11 10.5C11 8.5 9.5 7 9.5 7C9.5 7 9.2 9 7.5 9C7.5 9 9 7.5 7.5 4.5C7 3.5 6.2 2.2 6 1C6 1 3 3.5 3 7C3 7 2 6 2 4.5C2 4.5 1 6 1 8.5C1 12 3.2 15 6 15Z" fill="rgba(210,100,55,0.8)"/>
                    <path d="M6 15C7.657 15 8.5 13.8 8.5 12.5C8.5 11.3 7.5 10.5 7.5 10.5C7.5 10.5 7.3 11.5 6.5 11.5C6.5 11.5 7.2 10.8 6.5 9C6.5 9 5 10.2 5 12C5 13.5 5.2 15 6 15Z" fill="rgba(240,180,100,0.65)"/>
                  </svg>
                  <div className="text-[13px]" style={{ color: 'rgba(200,195,185,0.82)' }}>{deadlineWarning}</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col">
          {grouped.map(({ goal, tasks }, gi) => {
            const startIndex = runningIndex;
            runningIndex += tasks.length;
            return (
              <GoalSection
                key={goal.id}
                isFirst={gi === 0}
                goal={goal}
                tasks={tasks}
                startIndex={startIndex}
                actualByTask={actualByTask}
                allDaySubtasks={allCommittedSubtasks}
                nestTask={nestTask}
                unnestTask={unnestTask}
                deadlineInfo={deadlineByGoalId.get(goal.id)}
              />
            );
          })}
        </div>
      </div>

      {dayTasks.length > 0 && (
        <div className="px-6 pt-3 pb-6 shrink-0">
          <svg className="w-full h-2 mb-4" preserveAspectRatio="none">
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" className="text-text-muted/20" strokeWidth="1" strokeDasharray="8 4 12 4 6 4" />
          </svg>
          <button
            onClick={() => { lockDay(); play('paper'); }}
            className="w-full flex items-center justify-between px-6 py-3 bg-[#E55547]/10 hover:bg-[#E55547] text-[#E55547] hover:text-[#FAFAFA] transition-all duration-300 group"
          >
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-medium">
              <Lock className="w-3 h-3" />
              Focus
            </span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>
        </div>
      )}
      {isDraggingTask && (
        <div className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
          <div className="rounded-full border border-border bg-bg-card/90 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-text-muted/60 backdrop-blur-sm">
            Hold ⌥ to nest
          </div>
        </div>
      )}
    </div>
  );
}
