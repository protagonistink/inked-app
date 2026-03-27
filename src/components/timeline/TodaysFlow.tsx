import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, CornerDownLeft, ArrowRight, Lock, LockOpen, ChevronDown } from 'lucide-react';
import { useDrop, useDragLayer } from 'react-dnd';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { usePlanner, useAppStatus } from '@/context/AppContext';
import { DragTypes, type DragItem } from '@/hooks/useDragDrop';
import { useSound } from '@/hooks/useSound';
import { GoalSection } from '../GoalSection';
import { PlanWarnings } from '../PlanWarnings';
import { getDeadlineState } from '../shared/TaskCard';
import { GravityPrompt } from '@/components/shared/GravityPrompt';

export function TodaysFlow({ collapsed = false }: { collapsed?: boolean }) {
  const { isFocus } = useTheme();
  const { resetDay, lockDay, unlockDay } = useAppStatus();
  const {
    weeklyGoals,
    plannedTasks,
    dailyPlan,
    dayTasks,
    committedTasks,
    timeLogs,
    countdowns,
    addLocalTask,
    bringForward,
    assignTaskToGoal,
    unscheduleTaskBlock,
    nestTask,
    unnestTask,
    releaseTask,
    viewDate,
    scheduleBlocks,
    weeklyPlanningLastCompleted,
  } = usePlanner();
  const [inputValue, setInputValue] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const { play } = useSound();
  const isTodayView = format(viewDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const planTitle = isTodayView ? 'Today' : format(viewDate, 'EEEE');
  const activeTask = plannedTasks.find((task) => task.active && task.status !== 'done') ?? null;

  const finishedCount = plannedTasks.filter((task) => task.status === 'done' && dailyPlan.committedTaskIds.includes(task.id)).length;
  const totalDayCount = dailyPlan.committedTaskIds.length;

  const nestedInBlockIds = useMemo(() => {
    const ids = new Set<string>();
    for (const block of scheduleBlocks) {
      for (const id of block.nestedTaskIds ?? []) {
        ids.add(id);
      }
    }
    return ids;
  }, [scheduleBlocks]);

  const unscheduledCount = committedTasks.filter(
    (task) => task.status === 'committed' && !nestedInBlockIds.has(task.id)
  ).length;

  /** Push scheduled times back to Asana as due dates on lock. */
  const syncScheduleToAsana = useCallback(() => {
    const dateKey = format(viewDate, 'yyyy-MM-dd');
    for (const block of scheduleBlocks) {
      if (block.kind !== 'focus' || !block.linkedTaskId) continue;
      const task = plannedTasks.find((t) => t.id === block.linkedTaskId);
      if (!task?.sourceId || task.source !== 'asana') continue;
      const hour = String(block.startHour).padStart(2, '0');
      const min = String(block.startMin).padStart(2, '0');
      const dueAt = `${dateKey}T${hour}:${min}:00.000Z`;
      void window.api.asana.updateTaskDue(task.sourceId, dateKey, dueAt);
    }
  }, [viewDate, scheduleBlocks, plannedTasks]);

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
  })).concat(
    dayTasks.some((task) => task.weeklyGoalId == null)
      ? [{
          goal: {
            id: 'unassigned',
            title: 'Unassigned',
            color: 'rgb(100,116,139)',
          },
          tasks: dayTasks.filter((task) => task.weeklyGoalId == null),
        }]
      : []
  ), [dayTasks, weeklyGoals]);

  const deadlineByGoalId = useMemo(() => {
    const map = new Map<string, { daysRemaining: number; state: ReturnType<typeof getDeadlineState> }>();
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

  const isDraggingTask = useDragLayer((monitor) => monitor.isDragging() && monitor.getItemType() === DragTypes.TASK);
  const [playGoalHandoff, setPlayGoalHandoff] = useState(false);

  useEffect(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    if (weeklyPlanningLastCompleted !== todayKey || weeklyGoals.length === 0) {
      setPlayGoalHandoff(false);
      return;
    }

    const storageKey = `weekly-goal-handoff.${todayKey}`;
    const hasPlayed = window.sessionStorage.getItem(storageKey) === 'played';
    if (hasPlayed) {
      setPlayGoalHandoff(false);
      return;
    }

    setPlayGoalHandoff(true);
    window.sessionStorage.setItem(storageKey, 'played');

    const timeout = window.setTimeout(() => setPlayGoalHandoff(false), 2200);
    return () => window.clearTimeout(timeout);
  }, [weeklyGoals.length, weeklyPlanningLastCompleted]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'i') return;

      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)) return;
      if (!activeTask) return;

      if (event.altKey) {
        event.preventDefault();
        assignTaskToGoal(activeTask.id, null);
        return;
      }

      if (weeklyGoals.length === 0) return;

      const currentIndex = activeTask.weeklyGoalId ? weeklyGoals.findIndex((goal) => goal.id === activeTask.weeklyGoalId) : -1;
      const nextGoal = weeklyGoals[(currentIndex + 1 + weeklyGoals.length) % weeklyGoals.length];
      if (!nextGoal) return;

      event.preventDefault();
      assignTaskToGoal(activeTask.id, nextGoal.id);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTask, assignTaskToGoal, weeklyGoals]);

  // Delete/Backspace removes the active task from the plan
  useEffect(() => {
    function handleDelete(event: KeyboardEvent) {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!activeTask) return;
      event.preventDefault();
      void releaseTask(activeTask.id);
    }
    window.addEventListener('keydown', handleDelete);
    return () => window.removeEventListener('keydown', handleDelete);
  }, [activeTask, releaseTask]);

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
            {planTitle}
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
            {planTitle}
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
                Reset day
              </button>
            )
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-8 hide-scrollbar">
        <GravityPrompt />
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

        <PlanWarnings />

        <div className="flex flex-col">
          {grouped.map(({ goal, tasks }, gi) => {
            const startIndex = runningIndex;
            runningIndex += tasks.length;
            return (
              <GoalSection
                key={goal.id}
                isFirst={gi === 0}
                goal={goal}
                goalIndex={gi}
                tasks={tasks}
                startIndex={startIndex}
                actualByTask={actualByTask}
                allDaySubtasks={allCommittedSubtasks}
                nestTask={nestTask}
                unnestTask={unnestTask}
                deadlineInfo={deadlineByGoalId.get(goal.id)}
                nestedInBlockIds={nestedInBlockIds}
                celebrate={playGoalHandoff}
                celebrationDelayMs={gi * 180}
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
            onClick={() => { lockDay(); syncScheduleToAsana(); play('paper'); }}
            className="w-full flex items-center justify-between px-6 py-3 bg-[#C83C2F]/10 hover:bg-[#C83C2F] text-[#C83C2F] hover:text-[#FAFAFA] transition-all duration-300 group"
          >
            <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] font-medium">
              <Lock className="w-3 h-3" />
              Lock in
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
