import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Command, Play, ArrowRight, X, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { useDrag, useDrop } from 'react-dnd';
import { useModifierKey } from '@/hooks/useModifierKey';
import { getEmptyImage } from 'react-dnd-html5-backend';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { cn, formatRoundedHours, roundToQuarterHour } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useApp } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { useSound } from '@/hooks/useSound';
import type { PlannedTask, WeeklyGoal } from '@/types';

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
}: {
  task: PlannedTask;
  index: number;
  actualMins?: number;
  subtasks?: PlannedTask[];
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
}) {
  const { isLight, isFocus, setMode } = useTheme();
  const { toggleTask, setActiveTask, moveForward, releaseTask, updateTaskEstimate } = useApp();
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

  function handleStartFocus(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setActiveTask(task.id);
    void window.api.window.showPomodoro();
    void window.api.pomodoro.start(task.id, task.title);
    setMode('focus');
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
        'animate-fade-in group relative border-b border-ink/10 transition-all duration-300',
        task.active && 'border-accent-warm/20',
        isDragging && 'opacity-20 scale-95 rotate-[1deg]',
        isNestOver && canNest && 'ring-1 ring-accent-warm/40 ring-inset rounded-lg',
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
            <div className={cn('font-display text-[18px] leading-snug transition-colors line-clamp-2', task.status === 'done' ? 'text-text-muted line-through' : task.active ? 'text-text-emphasis font-semibold' : 'text-text-primary')}>
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
                  {plannedHours} planned
                </span>
              )}
              {actualMins > 0 && <span>{actualHours} actual</span>}
              {varianceLabel && <span>{varianceLabel}</span>}
              {task.status === 'scheduled' && <span>blocked</span>}
              {task.active && task.status !== 'done' && <span className="text-active">now</span>}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1">
          {task.status !== 'done' && (
            <button
              onClick={handleStartFocus}
              className={cn(
                'p-1.5 rounded-full transition-all active:scale-90',
                task.active
                  ? 'bg-accent-warm/20 text-accent-warm'
                  : 'bg-bg-elevated text-text-muted hover:text-accent-warm hover:bg-accent-warm/12'
              )}
              title="Start focus"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
          <button
            onClick={() => { void moveForward(task.id); }}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated"
            title="Carry forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { void releaseTask(task.id); }}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated"
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
}: {
  goal: WeeklyGoal;
  tasks: PlannedTask[];
  startIndex: number;
  actualByTask: Map<string, number>;
  allDaySubtasks: PlannedTask[];
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
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
        'flex flex-col gap-3 rounded-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        isOver && 'bg-accent-warm/[0.07] shadow-[0_0_24px_rgba(200,60,47,0.12)] px-3 py-3 -mx-3'
      )}
    >
      <div className="flex items-center gap-3 px-1">
        <div className={cn('w-2.5 h-2.5 rounded-full', goal.color)} />
        <h3 className="text-[11px] font-semibold tracking-wider uppercase text-text-muted">{goal.title}</h3>
        <span className="text-[10px] text-text-muted/60 ml-auto font-mono">
          {finishedCount}/{tasks.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.length === 0 ? (
          <div className={cn('text-[12px] px-1 py-2 transition-colors', isOver ? 'text-accent-warm' : 'text-text-muted')}>
            {isOver ? 'Release it here.' : 'Awaiting focus.'}
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
            />
          ))
        )}
      </div>
    </div>
  );
}

export function TodaysFlow({ onCollapse }: { onCollapse?: () => void }) {
  const { isLight, isFocus } = useTheme();
  const {
    weeklyGoals,
    plannedTasks,
    dailyPlan,
    dayTasks,
    committedTasks,
    scheduleBlocks,
    workdayEnd,
    timeLogs,
    countdowns,
    addLocalTask,
    currentBlock,
    nextBlock,
    bringForward,
    unscheduleTaskBlock,
    resetDay,
    nestTask,
    unnestTask,
  } = useApp();
  const [inputValue, setInputValue] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
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
  const workdayMinutes = Math.max(0, (workdayEnd.hour * 60 + workdayEnd.min) - (8 * 60));
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

    if (emptyGoals.length > 0 && dominanceRatio >= 0.65) {
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

  return (
    <div ref={dropRef} className={cn('focus-dim-soft bg-bg flex-1 min-w-[360px] column-divider flex flex-col h-full transition-colors duration-700', isOver && 'bg-accent-warm/[0.03]')}>
      <div className="workspace-header px-8 shrink-0">
        <div className="workspace-header-copy">
          <h2 className="workspace-header-title workspace-header-title-editorial text-text-emphasis transition-all duration-700">
            Today&apos;s Plan
          </h2>
          <div className="workspace-header-subline">
            {currentBlock ? `Now: ${currentBlock.title}` : nextBlock ? `Next: ${nextBlock.title}` : 'What belongs today, and when.'}
          </div>
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
                  className="text-[10px] uppercase tracking-[0.14em] text-accent-warm hover:text-accent-warm/80 transition-colors"
                >
                  Clear
                </button>
                <span className="text-text-muted text-[10px]">/</span>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="text-[10px] uppercase tracking-[0.14em] text-text-muted hover:text-text-primary transition-colors"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                className="text-[10px] uppercase tracking-[0.14em] text-text-muted hover:text-text-primary transition-colors"
              >
                Clear board
              </button>
            )
          )}
        </div>
      </div>

      {dayTasks.length > 0 && onCollapse && (
        <div className="px-6 pb-3 shrink-0">
          <button
            onClick={() => { onCollapse(); play('paper'); }}
            className="w-full flex items-center justify-between px-6 py-3 bg-[#E55547]/10 hover:bg-[#E55547] text-[#E55547] hover:text-[#FAFAFA] transition-all duration-300 group"
          >
            <span className="text-[11px] uppercase tracking-[0.18em] font-medium">Lock in the day</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>
          <svg className="w-full h-2 mt-4" preserveAspectRatio="none">
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" className="text-text-muted/20" strokeWidth="1" strokeDasharray="8 4 12 4 6 4" />
          </svg>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-8 hide-scrollbar">
        <form onSubmit={handleSubmit} className="animate-fade-in relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Plus className="w-4 h-4 text-text-muted group-focus-within:text-text-primary transition-colors" />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Add to commit..."
            className="editorial-inset w-full rounded-[18px] py-3 pl-11 pr-12 text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-warm/40 focus:bg-bg-elevated transition-all"
          />
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <div className="editorial-pill flex items-center gap-0.5 px-1.5 py-1 rounded text-text-muted text-[10px]">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>
        </form>

        <div
          data-thread-source={currentBlock?.linkedTaskId || undefined}
          className={cn(
          'editorial-inset rounded-[18px] backdrop-blur-md px-4 py-2.5 flex items-center gap-3 transition-all duration-300',
          isLight
            ? 'bg-bg-card/90'
            : 'bg-bg-elevated/60',
          isOver && 'border-accent-warm/35 shadow-[0_0_28px_rgba(200,60,47,0.12)]'
        )}>
          <div className={cn('w-2 h-2 rounded-full shrink-0', currentBlock ? 'bg-accent-warm animate-breathe' : 'bg-text-muted/30')} />
          <div className="flex-1 min-w-0 flex items-center gap-2 text-[12px]">
            {currentBlock ? (
              <>
                <span className="text-text-emphasis font-medium truncate">{currentBlock.title}</span>
                {nextBlock && <span className="text-text-muted shrink-0">&rarr; {nextBlock.title}</span>}
              </>
            ) : nextBlock ? (
              <span className="text-text-muted">Next: {nextBlock.title}</span>
            ) : (
              <span className="text-text-muted">Time is open</span>
            )}
          </div>
          <div className="text-[11px] text-text-muted font-mono shrink-0">
            {formatRoundedHours(totalCommittedMinutes, true)}
          </div>
        </div>

        {isOver && (
          <div className="rounded-[18px] border border-dashed border-accent-warm/35 bg-accent-warm/[0.06] px-4 py-3 flex items-center justify-center gap-2 text-[12px] text-accent-warm animate-slide-down">
            <ChevronDown className="w-3.5 h-3.5 animate-breathe" />
            <span>Release</span>
          </div>
        )}

        {(realismWarning || balanceWarning || deadlineWarning) && (
          <div className="grid gap-3">
            {realismWarning && (
              <div className="rounded-[18px] border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[10px] uppercase tracking-[0.18em] text-amber-300/80">Reality Check</div>
                <div className="mt-1 text-[13px] text-amber-50">{realismWarning}</div>
                <div className="mt-2 text-[11px] text-amber-100/80">
                  Capacity: {formatRoundedHours(availableFocusMinutes, true)}. Scheduled: {formatRoundedHours(scheduledFocusMinutes, true)}. Still loose: {formatRoundedHours(unscheduledMinutes, true)}.
                </div>
              </div>
            )}
            {balanceWarning && (
              <div className="balance-callout rounded-[18px] px-4 py-3 text-[12px]">
                <div className="balance-callout-label text-[10px] uppercase tracking-[0.18em] font-display italic">Balance</div>
                <div className="mt-1 text-[13px] text-text-primary/92">{balanceWarning}</div>
              </div>
            )}
            {deadlineWarning && (
              <div className="rounded-[18px] border border-rose-500/15 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[10px] uppercase tracking-[0.18em] text-rose-300/80">Deadline Pressure</div>
                <div className="mt-1 text-[13px] text-rose-50">{deadlineWarning}</div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-8">
          {grouped.map(({ goal, tasks }) => {
            const startIndex = runningIndex;
            runningIndex += tasks.length;
            return (
              <GoalSection
                key={goal.id}
                goal={goal}
                tasks={tasks}
                startIndex={startIndex}
                actualByTask={actualByTask}
                allDaySubtasks={allCommittedSubtasks}
                nestTask={nestTask}
                unnestTask={unnestTask}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
