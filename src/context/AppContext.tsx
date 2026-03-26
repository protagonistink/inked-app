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
import type { AppMode, View } from '@/types/appMode';
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
import { useCollectionActions } from '@/hooks/useCollectionActions';
import { useDayLock } from '@/hooks/useDayLock';
import { useMonthlyPlanning } from '@/hooks/useMonthlyPlanning';
import { useWorkdayPrompts } from '@/hooks/useWorkdayPrompts';
import { useAppMode } from '@/hooks/useAppMode';
import { useGoalActions } from '@/hooks/useGoalActions';
import {
  createPlannerFieldSetter,
  initialPlannerState,
  plannerReducer,
  storedPlannerStateToPlannerState,
} from './plannerState';

export { type View };

export type SourceView = 'cover' | 'asana' | 'gcal' | 'gmail';
const PREFERENCES_UPDATED_EVENT = 'preferences-updated';

interface AppShellContextValue {
  mode: AppMode;
  view: View;
  focusTaskId: string | null;
  inboxOpen: boolean;
  completeBriefing: () => void;
  openBriefing: () => void;
  openPlanning: (view?: View) => void;
  startDay: () => void;
  clickTask: (taskId: string) => void;
  enterFocus: (taskId: string) => void;
  exitFocus: () => void;
  openInbox: () => void;
  closeInbox: () => void;
  toggleInbox: () => void;
  setView: (view: View) => void;
  resetAppMode: () => void;

  activeSource: SourceView;
  setActiveSource: (source: SourceView) => void;
}

interface PlannerContextValue {
  viewDate: Date;
  setViewDate: (date: Date) => void;
  weeklyGoals: WeeklyGoal[];
  replaceWeeklyGoals: (goals: Array<{ title: string; why?: string }>) => void;
  markWeeklyPlanningComplete: (date?: string) => void;
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
  addInboxTask: (title: string) => string;
  bringForward: (taskId: string, goalId?: string, targetDate?: string) => void;
  lastCommitTimestamp: number;
  assignTaskToGoal: (taskId: string, goalId: string | null) => void;
  moveForward: (taskId: string) => Promise<void>;
  releaseTask: (taskId: string) => Promise<void>;
  returnTaskToInbox: (taskId: string) => Promise<void>;
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
  addAdHocBlock: (title: string, startHour: number, startMin: number, durationMins?: number) => string;
  nestTaskInBlock: (taskId: string, targetBlockId: string) => Promise<void>;
  unnestTaskFromBlock: (taskId: string, blockId: string) => void;
  /** Marks the daily plan as "dayStarted" (commit to planner). Use AppMode's startDay for mode transitions. */
  commitDay: () => void;
  currentBlock: ScheduleBlock | null;
  nextBlock: ScheduleBlock | null;
  currentTask: PlannedTask | null;
  timeLogs: TimeLogEntry[];
  logFocusSession: (input: { taskId: string | null; durationMins: number; endedAt?: string }) => void;
  rituals: DailyRitual[];
  addRitual: (title: string) => void;
  removeRitual: (id: string) => void;
  renameRitual: (id: string, title: string) => void;
  toggleRitualSkipped: (id: string, date: string) => void;
  toggleRitualComplete: (id: string) => void;
  countdowns: Countdown[];
  addCountdown: (title: string, dueDate: string) => void;
  removeCountdown: (id: string) => void;
  weeklyPlanningLastCompleted: string | null;
  migrateOldTasks: () => PlannedTask[];
  workdayStart: { hour: number; min: number };
  setWorkdayStart: (hour: number, min: number) => void;
  workdayEnd: { hour: number; min: number };
  setWorkdayEnd: (hour: number, min: number) => void;
  userName: string;
  updateTaskEstimate: (id: string, mins: number) => void;
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
  monthlyPlan: MonthlyPlan | null;
  monthlyPlanPrompt: boolean;
  setMonthlyPlan: (plan: MonthlyPlan) => void;
  dismissMonthlyPlanPrompt: () => void;
  updateRitualEstimate: (id: string, mins: number) => void;
  dayEntries: DayEntry[];
  saveDayEntry: (date: string, text: string) => void;
}

interface AppStatusContextValue {
  isInitialized: boolean;
  dayLocked: boolean;
  lockDay: () => void;
  unlockDay: () => void;
  focusResumePrompt: boolean;
  resumeFocusMode: () => void;
  dismissFocusPrompt: () => void;
  resetDay: () => Promise<void>;
  syncStatus: { asana: string | null; gcal: string | null; loading: boolean };
  refreshExternalData: () => Promise<void>;
  showEndOfDayPrompt: boolean;
  dismissEndOfDayPrompt: () => void;
  showStartOfDayPrompt: boolean;
  dismissStartOfDayPrompt: () => void;
  isFirstLoadOfDay: boolean;
  dayCommitInfo: DayCommitInfo;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);
const PlannerContext = createContext<PlannerContextValue | null>(null);
const AppStatusContext = createContext<AppStatusContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const appMode = useAppMode();
  const [activeSource, setActiveSource] = useState<SourceView>('cover');
  const [plannerState, dispatchPlanner] = useReducer(plannerReducer, initialPlannerState);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [lastCommitTimestamp, setLastCommitTimestamp] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [weeklyPlanningLastCompleted, setWeeklyPlanningLastCompleted] = useState<string | null>(null);
  const [monthlyPlanInit, setMonthlyPlanInit] = useState<MonthlyPlan | null | undefined>(undefined);
  const [monthlyPromptInit, setMonthlyPromptInit] = useState<boolean | undefined>(undefined);
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
  const [syncFrequencyMins, setSyncFrequencyMins] = useState(2);

  const { dayLocked, focusResumePrompt, lockDay, unlockDay, resumeFocusMode, dismissFocusPrompt } = useDayLock();
  const {
    monthlyPlan,
    monthlyPlanPrompt,
    setMonthlyPlan,
    dismissMonthlyPlanPrompt,
  } = useMonthlyPlanning({
    initialMonthlyPlan: monthlyPlanInit ?? null,
    initialPromptState: monthlyPromptInit,
  });

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

  const {
    addRitual,
    removeRitual,
    renameRitual,
    toggleRitualSkipped,
    toggleRitualComplete,
    updateRitualEstimate,
    addCountdown,
    removeCountdown,
  } = useCollectionActions({ setRituals, setCountdowns });

  const {
    addWeeklyGoal,
    replaceWeeklyGoals,
    removeWeeklyGoal,
    renameWeeklyGoal,
    updateGoalWhy,
    updateGoalColor,
    updateGoalCountdown,
    reorderWeeklyGoals,
  } = useGoalActions({ weeklyGoals, setWeeklyGoals, setPlannedTasks, setScheduleBlocks });

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
        // (AppMode's own persistence handles mode/view restoration)
        if (stored?.activeSource) setActiveSource(stored.activeSource);
        setWeeklyPlanningLastCompleted(stored?.weeklyPlanningLastCompleted ?? null);
        if (stored?.workdayStart) setWorkdayStartState(stored.workdayStart);
        if (stored?.workdayEnd) setWorkdayEndState(stored.workdayEnd);
        const monthlyPlan = stored?.monthlyPlan ?? null;
        setMonthlyPlanInit(monthlyPlan);

        const [settings, startShown, endShown, dismissedMonth] = await Promise.all([
          window.api.settings.load(),
          window.api.store.get('startOfDay.shownDate'),
          window.api.store.get('endOfDay.shownDate'),
          window.api.store.get('monthlyPlanDismissedDate'),
        ]);
        setSyncFrequencyMins(settings.day.syncFrequencyMins);

        // Compute whether to show the monthly prompt here, with all data in hand,
        // so the hook never has to do an async store read after mount.
        const currentMonth = format(new Date(), 'yyyy-MM');
        const hasPlanForMonth = monthlyPlan?.month === currentMonth;
        const isDismissed = (dismissedMonth as string | undefined) === currentMonth;
        setMonthlyPromptInit(!hasPlanForMonth && !isDismissed);
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
    intervalMs: syncFrequencyMins * 60 * 1000,
    refresh: refreshExternalData,
  });

  useEffect(() => {
    function handlePreferencesUpdated(event: Event) {
      const detail = (event as CustomEvent<{ syncFrequencyMins?: number }>).detail;
      if (typeof detail?.syncFrequencyMins === 'number') {
        setSyncFrequencyMins(detail.syncFrequencyMins);
      }
    }

    window.addEventListener(PREFERENCES_UPDATED_EVENT, handlePreferencesUpdated as EventListener);
    return () => window.removeEventListener(PREFERENCES_UPDATED_EVENT, handlePreferencesUpdated as EventListener);
  }, []);

  // Rituals are no longer auto-placed as fixed blocks — Ink schedules them into gaps during planning.

  const markWeeklyPlanningComplete = useCallback((date?: string) => {
    setWeeklyPlanningLastCompleted(date ?? format(new Date(), 'yyyy-MM-dd'));
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
    addInboxTask,
    assignTaskToGoal,
    moveForward,
    releaseTask,
    returnTaskToInbox,
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
    nestTaskInBlock,
    unnestTaskFromBlock,
    unscheduleTaskBlock,
    clearFocusBlocks,
    acceptProposal,
    addAdHocBlock,
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

  const commitDay = useCallback(() => {
    updateDailyPlanForDate(viewDate, (prev) => ({ ...prev, dayStarted: true }));
  }, [updateDailyPlanForDate, viewDate]);

  const logFocusSession = useCallback((input: { taskId: string | null; durationMins: number; endedAt?: string }) => {
    const endedAt = input.endedAt || new Date().toISOString();
    const durationMins = Math.max(1, Math.round(input.durationMins));
    const startedAt = new Date(new Date(endedAt).getTime() - durationMins * 60000).toISOString();

    const task = input.taskId ? plannedTasks.find((item) => item.id === input.taskId) : null;
    const goal = task?.weeklyGoalId ? weeklyGoals.find((item) => item.id === task.weeklyGoalId) : null;

    const entry: TimeLogEntry = {
      id: `log-${crypto.randomUUID()}`,
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
      prev
        .filter((block) => block.readOnly || block.kind !== 'focus')
        .map((block) => block.nestedTaskIds?.length ? { ...block, nestedTaskIds: [] } : block)
    );
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.status === 'committed' || task.status === 'scheduled'
          ? { ...task, status: 'candidate', scheduledEventId: undefined, scheduledCalendarId: undefined, parentId: undefined }
          : task
      )
    );
    setDailyPlan((prev) => ({ ...prev, committedTaskIds: [], dayStarted: false }));
    setLastCommitTimestamp(0);
    unlockDay();
  }, [rituals, scheduleBlocks, setDailyPlan, setLastCommitTimestamp, setPlannedTasks, setScheduleBlocks, unlockDay, viewDate, workdayStart]);

  const shellValue = useMemo<AppShellContextValue>(() => ({
    mode: appMode.state.mode,
    view: appMode.state.view,
    focusTaskId: appMode.state.focusTaskId,
    inboxOpen: appMode.state.inboxOpen,
    completeBriefing: appMode.completeBriefing,
    openBriefing: appMode.openBriefing,
    openPlanning: appMode.openPlanning,
    startDay: appMode.startDay,
    clickTask: appMode.clickTask,
    enterFocus: appMode.enterFocus,
    exitFocus: appMode.exitFocus,
    openInbox: appMode.openInbox,
    closeInbox: appMode.closeInbox,
    toggleInbox: appMode.toggleInbox,
    setView: appMode.setView,
    resetAppMode: appMode.resetDay,
    activeSource,
    setActiveSource,
  }), [
    activeSource,
    appMode.clickTask,
    appMode.closeInbox,
    appMode.completeBriefing,
    appMode.openBriefing,
    appMode.openPlanning,
    appMode.enterFocus,
    appMode.exitFocus,
    appMode.openInbox,
    appMode.resetDay,
    appMode.setView,
    appMode.startDay,
    appMode.state.focusTaskId,
    appMode.state.inboxOpen,
    appMode.state.mode,
    appMode.state.view,
    appMode.toggleInbox,
  ]);

  const plannerValue = useMemo<PlannerContextValue>(() => ({
    viewDate: viewDateValue,
    setViewDate,
    weeklyGoals,
    replaceWeeklyGoals,
    markWeeklyPlanningComplete,
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
    addInboxTask,
    bringForward,
    lastCommitTimestamp,
    assignTaskToGoal,
    moveForward,
    releaseTask,
    returnTaskToInbox,
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
    addAdHocBlock,
    nestTaskInBlock,
    unnestTaskFromBlock,
    commitDay,
    currentBlock,
    nextBlock,
    currentTask,
    timeLogs,
    logFocusSession,
    rituals,
    addRitual,
    removeRitual,
    renameRitual,
    toggleRitualSkipped,
    toggleRitualComplete,
    countdowns,
    addCountdown,
    removeCountdown,
    weeklyPlanningLastCompleted,
    migrateOldTasks,
    workdayStart,
    setWorkdayStart,
    workdayEnd,
    setWorkdayEnd,
    userName,
    updateTaskEstimate,
    nestTask,
    unnestTask,
    monthlyPlan,
    monthlyPlanPrompt,
    setMonthlyPlan,
    dismissMonthlyPlanPrompt,
    updateRitualEstimate,
    dayEntries,
    saveDayEntry,
  }), [
    acceptProposal,
    addAdHocBlock,
    addCountdown,
    addInboxTask,
    addLocalTask,
    addRitual,
    addWeeklyGoal,
    archiveTasks,
    assignTaskToGoal,
    bringForward,
    candidateItems,
    clearFocusBlocks,
    commitDay,
    committedTasks,
    countdowns,
    currentBlock,
    currentTask,
    dailyPlan,
    dayEntries,
    dayTasks,
    dismissMonthlyPlanPrompt,
    dropTask,
    getDailyPlanForDate,
    lastCommitTimestamp,
    logFocusSession,
    markWeeklyPlanningComplete,
    migrateOldTasks,
    monthlyPlan,
    monthlyPlanPrompt,
    moveForward,
    nestTask,
    nestTaskInBlock,
    nextBlock,
    plannedTasks,
    releaseTask,
    removeCountdown,
    removeRitual,
    removeScheduleBlock,
    removeWeeklyGoal,
    renameRitual,
    renameWeeklyGoal,
    reorderWeeklyGoals,
    replaceWeeklyGoals,
    returnTaskToInbox,
    rituals,
    saveDayEntry,
    scheduleBlocks,
    scheduleTaskBlock,
    selectInboxItem,
    selectedInboxId,
    setActiveTask,
    setMonthlyPlan,
    setViewDate,
    setWorkdayEnd,
    setWorkdayStart,
    timeLogs,
    toggleRitualComplete,
    toggleRitualSkipped,
    toggleTask,
    unnestTask,
    unnestTaskFromBlock,
    unscheduleTaskBlock,
    updateGoalColor,
    updateGoalCountdown,
    updateGoalWhy,
    updateRitualEstimate,
    updateScheduleBlock,
    updateTaskEstimate,
    userName,
    viewDateValue,
    weeklyGoals,
    weeklyPlanningLastCompleted,
    workdayEnd,
    workdayStart,
  ]);

  const statusValue = useMemo<AppStatusContextValue>(() => ({
    isInitialized,
    dayLocked,
    lockDay,
    unlockDay,
    focusResumePrompt,
    resumeFocusMode,
    dismissFocusPrompt,
    resetDay,
    syncStatus,
    refreshExternalData,
    showEndOfDayPrompt,
    dismissEndOfDayPrompt,
    showStartOfDayPrompt,
    dismissStartOfDayPrompt,
    isFirstLoadOfDay,
    dayCommitInfo,
  }), [
    dayCommitInfo,
    dayLocked,
    dismissEndOfDayPrompt,
    dismissFocusPrompt,
    dismissStartOfDayPrompt,
    focusResumePrompt,
    isFirstLoadOfDay,
    isInitialized,
    lockDay,
    refreshExternalData,
    resetDay,
    resumeFocusMode,
    showEndOfDayPrompt,
    showStartOfDayPrompt,
    syncStatus,
    unlockDay,
  ]);

  return (
    <AppShellContext.Provider value={shellValue}>
      <PlannerContext.Provider value={plannerValue}>
        <AppStatusContext.Provider value={statusValue}>
          {children}
        </AppStatusContext.Provider>
      </PlannerContext.Provider>
    </AppShellContext.Provider>
  );
}

export function useApp() {
  const shell = useAppShell();
  const planner = usePlanner();
  const status = useAppStatus();
  return { ...shell, ...planner, ...status };
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) throw new Error('useAppShell must be used within AppProvider');
  return context;
}

export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) throw new Error('usePlanner must be used within AppProvider');
  return context;
}

export function useAppStatus() {
  const context = useContext(AppStatusContext);
  if (!context) throw new Error('useAppStatus must be used within AppProvider');
  return context;
}
