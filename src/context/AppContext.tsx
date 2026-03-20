import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { format } from 'date-fns';
import type {
  Countdown,
  DailyPlan,
  DailyRitual,
  DayCommitInfo,
  DayEntry,
  InboxItem,
  MonthlyPlan,
  PlannedTask,
  ScheduleBlock,
  TimeLogEntry,
  WeeklyGoal,
} from '@/types';
import { getToday, mergeScheduleBlocksWithRituals } from '@/lib/planner';
import {
  loadPlannerState,
  usePlannerPersistence,
} from '@/hooks/usePlannerPersistence';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useExternalPlannerSync } from '@/hooks/useExternalPlannerSync';
import { useScheduleManager } from '@/hooks/useScheduleManager';
import { useTaskActions } from '@/hooks/useTaskActions';
import { usePlannerSelectors } from '@/hooks/usePlannerSelectors';
import { useDayCommitState } from '@/hooks/useDayCommitState';
import { useDayLock } from '@/hooks/useDayLock';
import { useWeeklyPlanningModal } from '@/hooks/useWeeklyPlanningModal';
import { useWorkdayPrompts } from '@/hooks/useWorkdayPrompts';
import {
  createPlannerFieldSetter,
  initialPlannerState,
  MAX_WEEKLY_GOALS,
  plannerReducer,
  storedPlannerStateToPlannerState,
} from './plannerState';

export type View = 'flow' | 'archive' | 'goals' | 'scratch';
export type SourceView = 'cover' | 'asana' | 'gcal' | 'gmail';

interface AppContextValue {
  activeView: View;
  setActiveView: (view: View) => void;
  activeSource: SourceView;
  setActiveSource: (source: SourceView) => void;
  viewDate: Date;
  setViewDate: (date: Date) => void;
  weeklyGoals: WeeklyGoal[];
  addWeeklyGoal: (title: string, color?: string) => boolean;
  removeWeeklyGoal: (id: string) => void;
  renameWeeklyGoal: (id: string, title: string) => void;
  updateGoalWhy: (id: string, why: string) => void;
  updateGoalColor: (id: string, color: string) => void;
  updateGoalCountdown: (id: string, countdownId: string | null) => void;
  reorderWeeklyGoals: (fromIndex: number, toIndex: number) => void;
  plannedTasks: PlannedTask[];
  dayTasks: PlannedTask[];
  committedTasks: PlannedTask[];
  candidateItems: InboxItem[];
  archiveTasks: PlannedTask[];
  dailyPlan: DailyPlan;
  getDailyPlanForDate: (date: Date) => DailyPlan;
  selectedInboxId: string | null;
  selectInboxItem: (id: string) => void;
  addLocalTask: (title: string, goalId?: string, targetDate?: string) => string;
  bringForward: (taskId: string, goalId?: string, targetDate?: string) => void;
  lastCommitTimestamp: number;
  assignTaskToGoal: (taskId: string, goalId: string) => void;
  moveForward: (taskId: string) => Promise<void>;
  releaseTask: (taskId: string) => Promise<void>;
  dropTask: (taskId: string) => void;
  toggleTask: (id: string) => Promise<void>;
  setActiveTask: (id: string) => void;
  scheduleBlocks: ScheduleBlock[];
  scheduleTaskBlock: (taskId: string, startHour: number, startMin: number, durationMins?: number, taskTitle?: string, targetDate?: string) => Promise<void>;
  updateScheduleBlock: (blockId: string, startHour: number, startMin: number, durationMins: number) => Promise<void>;
  removeScheduleBlock: (id: string) => Promise<void>;
  unscheduleTaskBlock: (id: string, goalId?: string) => Promise<void>;
  clearFocusBlocks: () => Promise<void>;
  acceptProposal: (blockId: string) => Promise<void>;
  currentBlock: ScheduleBlock | null;
  nextBlock: ScheduleBlock | null;
  currentTask: PlannedTask | null;
  timeLogs: TimeLogEntry[];
  logFocusSession: (input: { taskId: string | null; durationMins: number; endedAt?: string }) => void;
  syncStatus: { asana: string | null; gcal: string | null; loading: boolean };
  refreshExternalData: () => Promise<void>;
  rituals: DailyRitual[];
  addRitual: (title: string) => void;
  removeRitual: (id: string) => void;
  toggleRitualComplete: (id: string) => void;
  countdowns: Countdown[];
  addCountdown: (title: string, dueDate: string) => void;
  removeCountdown: (id: string) => void;
  isWeeklyPlanningOpen: boolean;
  weeklyPlanningLastCompleted: string | null;
  openWeeklyPlanning: () => void;
  closeWeeklyPlanning: () => void;
  completeWeeklyPlanning: () => void;
  migrateOldTasks: () => PlannedTask[];
  workdayStart: { hour: number; min: number };
  setWorkdayStart: (hour: number, min: number) => void;
  workdayEnd: { hour: number; min: number };
  setWorkdayEnd: (hour: number, min: number) => void;
  userName: string;
  updateTaskEstimate: (id: string, mins: number) => void;
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
  isInitialized: boolean;
  dayLocked: boolean;
  lockDay: () => void;
  unlockDay: () => void;
  focusResumePrompt: boolean;
  resumeFocusMode: () => void;
  dismissFocusPrompt: () => void;
  resetDay: () => Promise<void>;
  monthlyPlan: MonthlyPlan | null;
  monthlyPlanPrompt: boolean;
  isMonthlyPlanningOpen: boolean;
  setMonthlyPlan: (plan: MonthlyPlan) => void;
  dismissMonthlyPlanPrompt: () => void;
  openMonthlyPlanning: () => void;
  closeMonthlyPlanning: () => void;
  updateRitualEstimate: (id: string, mins: number) => void;
  dayEntries: DayEntry[];
  saveDayEntry: (date: string, text: string) => void;
  showEndOfDayPrompt: boolean;
  dismissEndOfDayPrompt: () => void;
  showStartOfDayPrompt: boolean;
  dismissStartOfDayPrompt: () => void;
  isFirstLoadOfDay: boolean;
  dayCommitInfo: DayCommitInfo;
}

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<View>('flow');
  const [activeSource, setActiveSource] = useState<SourceView>('cover');
  const [plannerState, dispatchPlanner] = useReducer(plannerReducer, initialPlannerState);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [lastCommitTimestamp, setLastCommitTimestamp] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [weeklyPlanningInit, setWeeklyPlanningInit] = useState<string | null | undefined>(undefined);
  const [monthlyPlan, setMonthlyPlanState] = useState<MonthlyPlan | null>(null);
  const [monthlyPlanPrompt, setMonthlyPlanPrompt] = useState(false);
  const [isMonthlyPlanningOpen, setIsMonthlyPlanningOpen] = useState(false);
  const [workdayPromptsInit, setWorkdayPromptsInit] = useState<{
    startShownDate: string | null;
    endShownDate: string | null;
    isFirstLoadOfDay: boolean;
  } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ asana: string | null; gcal: string | null; loading: boolean }>({
    asana: null,
    gcal: null,
    loading: false,
  });

  const { dayLocked, focusResumePrompt, lockDay, unlockDay, resumeFocusMode, dismissFocusPrompt } = useDayLock();
  const {
    isWeeklyPlanningOpen,
    weeklyPlanningLastCompleted,
    openWeeklyPlanning,
    closeWeeklyPlanning,
    completeWeeklyPlanning,
  } = useWeeklyPlanningModal({ initialLastCompleted: weeklyPlanningInit ?? null });

  const {
    weeklyGoals,
    plannedTasks,
    scheduleBlocks,
    dailyPlans,
    timeLogs,
    rituals,
    countdowns,
    workdayStart,
    workdayEnd,
    dayEntries,
    userName,
    viewDate,
  } = plannerState;

  const setWeeklyGoals = useCallback(createPlannerFieldSetter(dispatchPlanner, 'weeklyGoals'), []);
  const setPlannedTasks = useCallback(createPlannerFieldSetter(dispatchPlanner, 'plannedTasks'), []);
  const setScheduleBlocks = useCallback(createPlannerFieldSetter(dispatchPlanner, 'scheduleBlocks'), []);
  const setDailyPlans = useCallback(createPlannerFieldSetter(dispatchPlanner, 'dailyPlans'), []);
  const setViewDateState = useCallback(createPlannerFieldSetter(dispatchPlanner, 'viewDate'), []);
  const setTimeLogs = useCallback(createPlannerFieldSetter(dispatchPlanner, 'timeLogs'), []);
  const setRituals = useCallback(createPlannerFieldSetter(dispatchPlanner, 'rituals'), []);
  const setCountdowns = useCallback(createPlannerFieldSetter(dispatchPlanner, 'countdowns'), []);
  const setWorkdayStartState = useCallback(createPlannerFieldSetter(dispatchPlanner, 'workdayStart'), []);
  const setWorkdayEndState = useCallback(createPlannerFieldSetter(dispatchPlanner, 'workdayEnd'), []);
  const setDayEntries = useCallback(createPlannerFieldSetter(dispatchPlanner, 'dayEntries'), []);

  const viewDateValue = useMemo(() => new Date(`${viewDate}T12:00:00`), [viewDate]);

  const dailyPlan = useMemo<DailyPlan>(() => (
    dailyPlans.find((plan) => plan.date === viewDate)
    ?? { date: viewDate, committedTaskIds: [] }
  ), [dailyPlans, viewDate]);

  const updateDailyPlanForDate = useCallback((date: string, value: DailyPlan | ((current: DailyPlan) => DailyPlan)) => {
    setDailyPlans((prev) => {
      const current = prev.find((plan) => plan.date === date) ?? { date, committedTaskIds: [] };
      const nextPlan = typeof value === 'function'
        ? (value as (current: DailyPlan) => DailyPlan)(current)
        : value;
      const targetDate = nextPlan.date || date;
      const withoutCurrent = prev.filter((plan) => plan.date !== targetDate);
      return [...withoutCurrent, { ...nextPlan, date: targetDate }].sort((a, b) => a.date.localeCompare(b.date));
    });
  }, [setDailyPlans]);

  const setDailyPlan = useCallback((value: DailyPlan | ((current: DailyPlan) => DailyPlan)) => {
    updateDailyPlanForDate(viewDate, value);
  }, [updateDailyPlanForDate, viewDate]);

  const getDailyPlanForDate = useCallback((date: Date): DailyPlan => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return dailyPlans.find((plan) => plan.date === dateKey)
      ?? { date: dateKey, committedTaskIds: [] };
  }, [dailyPlans]);

  const setViewDate = useCallback((date: Date) => {
    setViewDateState(format(date, 'yyyy-MM-dd'));
  }, [setViewDateState]);

  useEffect(() => {
    async function loadState() {
      try {
        const stored = await loadPlannerState();
        if (stored) {
          dispatchPlanner({
            type: 'load',
            payload: storedPlannerStateToPlannerState(stored),
          });
        }
        // Always start on flow view — don't restore previous view
        setActiveView('flow');
        if (stored?.activeSource) setActiveSource(stored.activeSource);
        setWeeklyPlanningInit(stored?.weeklyPlanningLastCompleted ?? null);
        if (stored?.workdayStart) setWorkdayStartState(stored.workdayStart);
        if (stored?.workdayEnd) setWorkdayEndState(stored.workdayEnd);
        if (stored?.monthlyPlan !== undefined) setMonthlyPlanState(stored.monthlyPlan ?? null);

        const [startShown, endShown] = await Promise.all([
          window.api.store.get('startOfDay.shownDate'),
          window.api.store.get('endOfDay.shownDate'),
        ]);
        const today = new Date().toISOString().split('T')[0];
        const startShownDate = (startShown as string) || null;
        setWorkdayPromptsInit({
          startShownDate,
          endShownDate: (endShown as string) || null,
          isFirstLoadOfDay: startShownDate !== today,
        });
      } catch (error) {
        console.error('Failed to load planner state:', error);
      } finally {
        setIsInitialized(true);
      }
    }

    loadState();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-03"
    if (!monthlyPlan || monthlyPlan.month !== currentMonth) {
      void window.api.store.get('monthlyPlanDismissedDate').then((dismissed) => {
        const today = new Date().toISOString().split('T')[0];
        if (dismissed !== today) {
          setMonthlyPlanPrompt(true);
        }
      });
    }
  }, [isInitialized, monthlyPlan]);

  // Use primitive minutes to avoid re-firing when reducer creates new object references
  const workdayStartMinutes = workdayStart.hour * 60 + workdayStart.min;
  const workdayEndMinutes = workdayEnd.hour * 60 + workdayEnd.min;

  const {
    showStartOfDayPrompt,
    showEndOfDayPrompt,
    isFirstLoadOfDay,
    dismissStartOfDayPrompt,
    dismissEndOfDayPrompt,
  } = useWorkdayPrompts({
    isInitialized,
    workdayStartMinutes,
    workdayEndMinutes,
    initialStartShownDate: workdayPromptsInit?.startShownDate ?? null,
    initialEndShownDate: workdayPromptsInit?.endShownDate ?? null,
    initialIsFirstLoadOfDay: workdayPromptsInit?.isFirstLoadOfDay ?? true,
  });

  usePlannerPersistence({
    isInitialized,
    state: {
      weeklyGoals,
      plannedTasks,
      dailyPlans,
      viewDate,
      timeLogs,
      activeView,
      activeSource,
      rituals,
      countdowns,
      weeklyPlanningLastCompleted,
      workdayStart,
      workdayEnd,
      monthlyPlan,
      dayEntries,
      userName,
    },
  });

  // Sync weekly goals → inkContext.threadsRaw so Ink prompts have goal context
  useEffect(() => {
    if (!isInitialized || weeklyGoals.length === 0) return;
    const threadsRaw = weeklyGoals
      .map((g) => `- ${g.title}${g.why ? ` (why: ${g.why})` : ''}`)
      .join('\n');
    void window.api.ink.writeContext({ threadsRaw });
  }, [isInitialized, weeklyGoals]);

  const { refreshExternalData } = useExternalPlannerSync({
    setPlannedTasks,
    setScheduleBlocks,
    setSyncStatus,
    rituals,
    workdayStart,
    viewDate,
  });

  useAutoRefresh({
    enabled: isInitialized,
    intervalMs: 2 * 60 * 1000,
    refresh: refreshExternalData,
  });

  useEffect(() => {
    if (!isInitialized) return;
    setScheduleBlocks((prev) => mergeScheduleBlocksWithRituals(prev, rituals, workdayStart));
  }, [isInitialized, rituals, setScheduleBlocks, workdayStart]);

  const addWeeklyGoal = useCallback((title: string, color = 'bg-text-muted') => {
    if (!title.trim() || weeklyGoals.length >= MAX_WEEKLY_GOALS) return false;
    setWeeklyGoals((prev) => [
      ...prev,
      { id: `goal-${Date.now()}`, title: title.trim(), color },
    ]);
    return true;
  }, [weeklyGoals.length]);

  const removeWeeklyGoal = useCallback((id: string) => {
    setWeeklyGoals((prev) => prev.filter((goal) => goal.id !== id));
    // Clear weeklyGoalId on any tasks linked to this goal
    setPlannedTasks((prev) => prev.map((t) => t.weeklyGoalId === id ? { ...t, weeklyGoalId: null } : t));
  }, []);

  const renameWeeklyGoal = useCallback((id: string, title: string) => {
    setWeeklyGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, title: title.trim() || goal.title } : goal));
  }, []);

  const updateGoalWhy = useCallback((id: string, why: string) => {
    setWeeklyGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, why } : goal));
  }, []);

  const updateGoalColor = useCallback((id: string, color: string) => {
    setWeeklyGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, color } : goal));
  }, []);

  const updateGoalCountdown = useCallback((id: string, countdownId: string | null) => {
    setWeeklyGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, countdownId: countdownId ?? undefined } : goal));
  }, []);

  const reorderWeeklyGoals = useCallback((fromIndex: number, toIndex: number) => {
    setWeeklyGoals((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const addRitual = useCallback((title: string) => {
    if (!title.trim()) return;
    setRituals((prev) => [...prev, { id: `ritual-${Date.now()}`, title: title.trim(), completedDates: [] }]);
  }, []);

  const removeRitual = useCallback((id: string) => {
    setRituals((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleRitualComplete = useCallback((id: string) => {
    const today = getToday();
    setRituals((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const already = r.completedDates.includes(today);
      return {
        ...r,
        completedDates: already
          ? r.completedDates.filter((d) => d !== today)
          : [...r.completedDates, today],
      };
    }));
  }, []);

  const setMonthlyPlan = useCallback((plan: MonthlyPlan) => {
    const planWithTimestamp: MonthlyPlan = { ...plan, completedAt: new Date().toISOString() };
    setMonthlyPlanState(planWithTimestamp);
    setMonthlyPlanPrompt(false);
    setIsMonthlyPlanningOpen(false);
  }, []);

  const dismissMonthlyPlanPrompt = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    void window.api.store.set('monthlyPlanDismissedDate', today);
    setMonthlyPlanPrompt(false);
  }, []);

  const openMonthlyPlanning = useCallback(() => setIsMonthlyPlanningOpen(true), []);
  const closeMonthlyPlanning = useCallback(() => setIsMonthlyPlanningOpen(false), []);

  const updateRitualEstimate = useCallback((id: string, mins: number) => {
    setRituals((prev) =>
      prev.map((r) => (r.id === id ? { ...r, estimateMins: mins } : r))
    );
  }, [setRituals]);

  const addCountdown = useCallback((title: string, dueDate: string) => {
    if (!title.trim() || !dueDate) return;
    setCountdowns((prev) => [...prev, { id: `countdown-${Date.now()}`, title: title.trim(), dueDate }]);
  }, []);

  const removeCountdown = useCallback((id: string) => {
    setCountdowns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const setWorkdayStart = useCallback((hour: number, min: number) => {
    const nextStart = hour * 60 + min;
    const currentEnd = workdayEnd.hour * 60 + workdayEnd.min;
    const clampedStart = Math.min(nextStart, currentEnd - 60);
    setWorkdayStartState({
      hour: Math.floor(clampedStart / 60),
      min: clampedStart % 60,
    });
  }, [workdayEnd, setWorkdayStartState]);

  const setWorkdayEnd = useCallback((hour: number, min: number) => {
    const nextEnd = hour * 60 + min;
    const currentStart = workdayStart.hour * 60 + workdayStart.min;
    const clampedEnd = Math.max(nextEnd, currentStart + 60);
    setWorkdayEndState({
      hour: Math.floor(clampedEnd / 60),
      min: clampedEnd % 60,
    });
  }, [setWorkdayEndState, workdayStart]);

  const selectInboxItem = useCallback((id: string) => {
    setSelectedInboxId((prev) => prev === id ? null : id);
  }, []);

  const {
    migrateOldTasks,
    dropTask,
    nestTask,
    unnestTask,
    bringForward,
    addLocalTask,
    assignTaskToGoal,
    moveForward,
    releaseTask,
    toggleTask,
    setActiveTask,
    updateTaskEstimate,
  } = useTaskActions({
    weeklyGoals,
    plannedTasks,
    scheduleBlocks,
    planningDate: viewDate,
    setPlannedTasks,
    setScheduleBlocks,
    setDailyPlanForDate: updateDailyPlanForDate,
    setSelectedInboxId,
    setLastCommitTimestamp,
  });

  const {
    scheduleTaskBlock,
    updateScheduleBlock,
    removeScheduleBlock,
    unscheduleTaskBlock,
    clearFocusBlocks,
    acceptProposal,
  } = useScheduleManager({
    plannedTasks,
    scheduleBlocks,
    dailyPlan,
    planningDate: viewDate,
    setPlannedTasks,
    setScheduleBlocks,
    setDailyPlanForDate: updateDailyPlanForDate,
    bringForward,
  });

  const {
    currentBlock,
    nextBlock,
    currentTask,
    dayTasks,
    committedTasks,
    archiveTasks,
    candidateItems,
  } = usePlannerSelectors({
    plannedTasks,
    scheduleBlocks,
    dailyPlan,
    planningDate: viewDate,
  });

  const dayCommitInfo = useDayCommitState({
    scheduleBlocks,
    plannedTasks,
    dailyPlan,
    viewDate: viewDateValue,
    workdayEnd,
  });

  const logFocusSession = useCallback((input: { taskId: string | null; durationMins: number; endedAt?: string }) => {
    const endedAt = input.endedAt || new Date().toISOString();
    const durationMins = Math.max(1, Math.round(input.durationMins));
    const startedAt = new Date(new Date(endedAt).getTime() - durationMins * 60000).toISOString();

    const task = input.taskId ? plannedTasks.find((item) => item.id === input.taskId) : null;
    const goal = task?.weeklyGoalId ? weeklyGoals.find((item) => item.id === task.weeklyGoalId) : null;

    const entry: TimeLogEntry = {
      id: `log-${Date.now()}`,
      objectiveId: goal?.id || null,
      objectiveTitle: goal?.title || 'Unassigned',
      taskId: task?.id,
      taskTitle: task?.title,
      startedAt,
      endedAt,
      durationMins,
      kind: 'focus',
    };

    setTimeLogs((prev) => [entry, ...prev]);
  }, [plannedTasks, setTimeLogs, weeklyGoals]);

  const saveDayEntry = useCallback((date: string, text: string) => {
    setDayEntries((prev) => {
      const existing = prev.findIndex((e) => e.date === date);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], journalText: text, savedAt: new Date().toISOString() };
        return next;
      }
      const chapterNumber = prev.length + 1;
      return [...prev, { date, journalText: text, chapterNumber, savedAt: new Date().toISOString() }];
    });
  }, [setDayEntries]);

  const resetDay = useCallback(async () => {
    const focusBlocks = scheduleBlocks.filter((block) => !block.readOnly && block.kind === 'focus');
    await Promise.allSettled(
      focusBlocks
        .filter((block) => block.eventId)
        .map((block) => window.api.gcal.deleteEvent(block.eventId!, block.calendarId))
    );

    setScheduleBlocks((prev) =>
      mergeScheduleBlocksWithRituals(
        prev.filter((block) => block.readOnly || block.kind !== 'focus'),
        rituals,
        workdayStart
      )
    );
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.status === 'committed' || task.status === 'scheduled'
          ? { ...task, status: 'candidate', scheduledEventId: undefined, scheduledCalendarId: undefined, parentId: undefined }
          : task
      )
    );
    setDailyPlan((prev) => ({ ...prev, committedTaskIds: [] }));
    setLastCommitTimestamp(0);
    unlockDay();
  }, [rituals, scheduleBlocks, setDailyPlan, setLastCommitTimestamp, setPlannedTasks, setScheduleBlocks, unlockDay, workdayStart]);

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        activeSource,
        setActiveSource,
        viewDate: viewDateValue,
        setViewDate,
        weeklyGoals,
        addWeeklyGoal,
        removeWeeklyGoal,
        renameWeeklyGoal,
        updateGoalWhy,
        updateGoalColor,
        updateGoalCountdown,
        reorderWeeklyGoals,
        plannedTasks,
        dayTasks,
        committedTasks,
        candidateItems,
        archiveTasks,
        dailyPlan,
        getDailyPlanForDate,
        selectedInboxId,
        selectInboxItem,
        addLocalTask,
        bringForward,
        lastCommitTimestamp,
        assignTaskToGoal,
        moveForward,
        releaseTask,
        dropTask,
        toggleTask,
        setActiveTask,
        scheduleBlocks,
        scheduleTaskBlock,
        updateScheduleBlock,
        removeScheduleBlock,
        unscheduleTaskBlock,
        clearFocusBlocks,
        acceptProposal,
        currentBlock,
        nextBlock,
        currentTask,
        timeLogs,
        logFocusSession,
        syncStatus,
        refreshExternalData,
        rituals,
        addRitual,
        removeRitual,
        toggleRitualComplete,
        countdowns,
        addCountdown,
        removeCountdown,
        isWeeklyPlanningOpen,
        weeklyPlanningLastCompleted,
        openWeeklyPlanning,
        closeWeeklyPlanning,
        completeWeeklyPlanning,
        migrateOldTasks,
        workdayStart,
        setWorkdayStart,
        workdayEnd,
        setWorkdayEnd,
        userName,
        updateTaskEstimate,
        nestTask,
        unnestTask,
        dayLocked,
        lockDay,
        unlockDay,
        focusResumePrompt,
        resumeFocusMode,
        dismissFocusPrompt,
        resetDay,
        monthlyPlan,
        monthlyPlanPrompt,
        isMonthlyPlanningOpen,
        setMonthlyPlan,
        dismissMonthlyPlanPrompt,
        openMonthlyPlanning,
        closeMonthlyPlanning,
        updateRitualEstimate,
        dayEntries,
        saveDayEntry,
        isInitialized,
        showEndOfDayPrompt,
        dismissEndOfDayPrompt,
        showStartOfDayPrompt,
        dismissStartOfDayPrompt,
        isFirstLoadOfDay,
        dayCommitInfo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
