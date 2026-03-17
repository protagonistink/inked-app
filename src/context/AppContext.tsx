import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  Countdown,
  DailyPlan,
  DailyRitual,
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
import {
  createPlannerFieldSetter,
  initialPlannerState,
  plannerReducer,
  storedPlannerStateToPlannerState,
} from './plannerState';

export type View = 'flow' | 'archive' | 'goals';
export type SourceView = 'cover' | 'asana' | 'gcal' | 'gmail';

interface AppContextValue {
  activeView: View;
  setActiveView: (view: View) => void;
  activeSource: SourceView;
  setActiveSource: (source: SourceView) => void;
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
  selectedInboxId: string | null;
  selectInboxItem: (id: string) => void;
  addLocalTask: (title: string, goalId?: string) => void;
  bringForward: (taskId: string, goalId?: string) => void;
  lastCommitTimestamp: number;
  assignTaskToGoal: (taskId: string, goalId: string) => void;
  moveForward: (taskId: string) => Promise<void>;
  releaseTask: (taskId: string) => Promise<void>;
  dropTask: (taskId: string) => void;
  toggleTask: (id: string) => Promise<void>;
  setActiveTask: (id: string) => void;
  scheduleBlocks: ScheduleBlock[];
  scheduleTaskBlock: (taskId: string, startHour: number, startMin: number, durationMins?: number) => Promise<void>;
  updateScheduleBlock: (blockId: string, startHour: number, startMin: number, durationMins: number) => Promise<void>;
  removeScheduleBlock: (id: string) => Promise<void>;
  unscheduleTaskBlock: (id: string, goalId?: string) => Promise<void>;
  clearFocusBlocks: () => Promise<void>;
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
}

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<View>('flow');
  const [activeSource, setActiveSource] = useState<SourceView>('cover');
  const [plannerState, dispatchPlanner] = useReducer(plannerReducer, initialPlannerState);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [lastCommitTimestamp, setLastCommitTimestamp] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [weeklyPlanningLastCompleted, setWeeklyPlanningLastCompleted] = useState<string | null>(null);
  const [isWeeklyPlanningOpen, setIsWeeklyPlanningOpen] = useState(false);
  const [dayLocked, setDayLocked] = useState(false);
  const [monthlyPlan, setMonthlyPlanState] = useState<MonthlyPlan | null>(null);
  const [monthlyPlanPrompt, setMonthlyPlanPrompt] = useState(false);
  const [isMonthlyPlanningOpen, setIsMonthlyPlanningOpen] = useState(false);
  const [focusResumePrompt, setFocusResumePrompt] = useState(false);
  const focusBridgeReadyRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState<{ asana: string | null; gcal: string | null; loading: boolean }>({
    asana: null,
    gcal: null,
    loading: false,
  });

  const {
    weeklyGoals,
    plannedTasks,
    scheduleBlocks,
    dailyPlan,
    timeLogs,
    rituals,
    countdowns,
    workdayStart,
    workdayEnd,
    dayEntries,
  } = plannerState;

  const setWeeklyGoals = useCallback(createPlannerFieldSetter(dispatchPlanner, 'weeklyGoals'), []);
  const setPlannedTasks = useCallback(createPlannerFieldSetter(dispatchPlanner, 'plannedTasks'), []);
  const setScheduleBlocks = useCallback(createPlannerFieldSetter(dispatchPlanner, 'scheduleBlocks'), []);
  const setDailyPlan = useCallback(createPlannerFieldSetter(dispatchPlanner, 'dailyPlan'), []);
  const setTimeLogs = useCallback(createPlannerFieldSetter(dispatchPlanner, 'timeLogs'), []);
  const setRituals = useCallback(createPlannerFieldSetter(dispatchPlanner, 'rituals'), []);
  const setCountdowns = useCallback(createPlannerFieldSetter(dispatchPlanner, 'countdowns'), []);
  const setWorkdayStartState = useCallback(createPlannerFieldSetter(dispatchPlanner, 'workdayStart'), []);
  const setWorkdayEndState = useCallback(createPlannerFieldSetter(dispatchPlanner, 'workdayEnd'), []);
  const setDayEntries = useCallback(createPlannerFieldSetter(dispatchPlanner, 'dayEntries'), []);

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
        if (stored?.weeklyPlanningLastCompleted !== undefined) setWeeklyPlanningLastCompleted(stored.weeklyPlanningLastCompleted ?? null);
        if (stored?.workdayStart) setWorkdayStartState(stored.workdayStart);
        if (stored?.workdayEnd) setWorkdayEndState(stored.workdayEnd);
        if (stored?.monthlyPlan !== undefined) setMonthlyPlanState(stored.monthlyPlan ?? null);
      } catch (error) {
        console.error('Failed to load planner state:', error);
      } finally {
        setIsInitialized(true);
      }
    }

    loadState();
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    void Promise.all([
      window.api.store.get('dayLocked'),
      window.api.store.get('dayLockedDate'),
    ]).then(([locked, lockedDate]) => {
      if (locked) {
        if (lockedDate === today) {
          // Same day — ask if they want to resume focus mode
          setFocusResumePrompt(true);
        } else {
          // Stale lock from a previous day — clear it silently
          void window.api.store.set('dayLocked', false);
          void window.api.store.set('dayLockedDate', null);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!focusBridgeReadyRef.current) {
      focusBridgeReadyRef.current = true;
      return;
    }

    const syncFocusMode = async () => {
      const result = dayLocked
        ? await window.api.focus.enable()
        : await window.api.focus.disable();

      if (!result.success) {
        console.error(dayLocked ? 'Failed to enable focus protections:' : 'Failed to disable focus protections:', result.error);
      }
    };

    void syncFocusMode();
  }, [dayLocked]);

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

  usePlannerPersistence({
    isInitialized,
    state: {
      weeklyGoals,
      plannedTasks,
      dailyPlan,
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
  });

  useAutoRefresh({
    enabled: isInitialized,
    intervalMs: 5 * 60 * 1000,
    refresh: refreshExternalData,
  });

  useEffect(() => {
    if (!isInitialized) return;
    setScheduleBlocks((prev) => mergeScheduleBlocksWithRituals(prev, rituals, workdayStart));
  }, [isInitialized, rituals, setScheduleBlocks, workdayStart]);

  const addWeeklyGoal = useCallback((title: string, color = 'bg-text-muted') => {
    if (!title.trim() || weeklyGoals.length >= 3) return false;
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

  const openWeeklyPlanning = useCallback(() => setIsWeeklyPlanningOpen(true), []);
  const closeWeeklyPlanning = useCallback(() => setIsWeeklyPlanningOpen(false), []);
  const completeWeeklyPlanning = useCallback(() => {
    setWeeklyPlanningLastCompleted(getToday());
    setIsWeeklyPlanningOpen(false);
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

  const lockDay = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    void window.api.store.set('dayLocked', true);
    void window.api.store.set('dayLockedDate', today);
    setDayLocked(true);
  }, []);

  const resumeFocusMode = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    void window.api.store.set('dayLocked', true);
    void window.api.store.set('dayLockedDate', today);
    setFocusResumePrompt(false);
    setDayLocked(true);
  }, []);

  const dismissFocusPrompt = useCallback(() => {
    setFocusResumePrompt(false);
    void window.api.store.set('dayLocked', false);
    void window.api.store.set('dayLockedDate', null);
  }, []);

  const unlockDay = useCallback(() => {
    void window.api.store.set('dayLocked', false);
    setDayLocked(false);
  }, []);

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
    scheduleBlocks,
    setPlannedTasks,
    setScheduleBlocks,
    setDailyPlan,
    setSelectedInboxId,
    setLastCommitTimestamp,
  });

  const {
    scheduleTaskBlock,
    updateScheduleBlock,
    removeScheduleBlock,
    unscheduleTaskBlock,
    clearFocusBlocks,
  } = useScheduleManager({
    plannedTasks,
    scheduleBlocks,
    dailyPlan,
    setPlannedTasks,
    setScheduleBlocks,
    setDailyPlan,
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
    void window.api.store.set('dayLocked', false);
    setDayLocked(false);
  }, [rituals, scheduleBlocks, setDailyPlan, setLastCommitTimestamp, setPlannedTasks, setScheduleBlocks, workdayStart]);

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        activeSource,
        setActiveSource,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
