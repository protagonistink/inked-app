import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type {
  Countdown,
  DailyPlan,
  DailyRitual,
  InboxItem,
  MonthlyPlan,
  PlannedTask,
  ScheduleBlock,
  TimeLogEntry,
  WeeklyGoal,
} from '@/types';
import { TODAY } from '@/lib/planner';
import {
  loadPlannerState,
  usePlannerPersistence,
} from '@/hooks/usePlannerPersistence';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useExternalPlannerSync } from '@/hooks/useExternalPlannerSync';
import { useScheduleManager } from '@/hooks/useScheduleManager';
import { useTaskActions } from '@/hooks/useTaskActions';
import { usePlannerSelectors } from '@/hooks/usePlannerSelectors';

export type View = 'flow' | 'archive' | 'goals';
export type SourceView = 'cover' | 'asana' | 'gcal' | 'gmail';

interface AppContextValue {
  activeView: View;
  setActiveView: (view: View) => void;
  activeSource: SourceView;
  setActiveSource: (source: SourceView) => void;
  weeklyGoals: WeeklyGoal[];
  addWeeklyGoal: (title: string, color?: string) => boolean;
  renameWeeklyGoal: (id: string, title: string) => void;
  updateGoalWhy: (id: string, why: string) => void;
  updateGoalColor: (id: string, color: string) => void;
  updateGoalCountdown: (id: string, countdownId: string | null) => void;
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
  workdayEnd: { hour: number; min: number };
  setWorkdayEnd: (hour: number, min: number) => void;
  updateTaskEstimate: (id: string, mins: number) => void;
  nestTask: (childId: string, parentId: string) => void;
  unnestTask: (childId: string) => void;
  dayLocked: boolean;
  lockDay: () => void;
  unlockDay: () => void;
  resetDay: () => Promise<void>;
  monthlyPlan: MonthlyPlan | null;
  monthlyPlanPrompt: boolean;
  isMonthlyPlanningOpen: boolean;
  setMonthlyPlan: (plan: MonthlyPlan) => void;
  dismissMonthlyPlanPrompt: () => void;
  openMonthlyPlanning: () => void;
  closeMonthlyPlanning: () => void;
  updateRitualEstimate: (id: string, mins: number) => void;
}

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<View>('flow');
  const [activeSource, setActiveSource] = useState<SourceView>('cover');
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan>({ date: TODAY, committedTaskIds: [] });
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [lastCommitTimestamp, setLastCommitTimestamp] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [rituals, setRituals] = useState<DailyRitual[]>([]);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [weeklyPlanningLastCompleted, setWeeklyPlanningLastCompleted] = useState<string | null>(null);
  const [isWeeklyPlanningOpen, setIsWeeklyPlanningOpen] = useState(false);
  const [workdayEnd, setWorkdayEndState] = useState<{ hour: number; min: number }>({ hour: 18, min: 0 });
  const [dayLocked, setDayLocked] = useState(false);
  const [monthlyPlan, setMonthlyPlanState] = useState<MonthlyPlan | null>(null);
  const [monthlyPlanPrompt, setMonthlyPlanPrompt] = useState(false);
  const [isMonthlyPlanningOpen, setIsMonthlyPlanningOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ asana: string | null; gcal: string | null; loading: boolean }>({
    asana: null,
    gcal: null,
    loading: false,
  });

  useEffect(() => {
    async function loadState() {
      try {
        const stored = await loadPlannerState();
        if (stored?.weeklyGoals?.length) setWeeklyGoals(stored.weeklyGoals.slice(0, 3));
        if (stored?.plannedTasks?.length) {
          // Repair tasks with missing titles (from stale persisted data)
          const repairedTasks = stored.plannedTasks.map((task) => ({
            ...task,
            title: task.title || 'Untitled task',
          }));
          setPlannedTasks(repairedTasks);
        }
        if (stored?.dailyPlan) setDailyPlan(stored.dailyPlan);
        if (stored?.timeLogs?.length) setTimeLogs(stored.timeLogs);
        if (stored?.activeView) {
          const storedView = stored.activeView as View | 'panopticon';
          setActiveView(storedView === 'panopticon' ? 'flow' : storedView);
        }
        if (stored?.activeSource) setActiveSource(stored.activeSource);
        if (stored?.rituals?.length) setRituals(stored.rituals);
        if (stored?.countdowns?.length) setCountdowns(stored.countdowns);
        if (stored?.weeklyPlanningLastCompleted !== undefined) setWeeklyPlanningLastCompleted(stored.weeklyPlanningLastCompleted ?? null);
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
    void window.api.store.get('dayLocked').then((val) => {
      if (val) setDayLocked(true);
    });
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
      workdayEnd,
      monthlyPlan,
    },
  });

  const { refreshExternalData } = useExternalPlannerSync({
    setPlannedTasks,
    setScheduleBlocks,
    setSyncStatus,
  });

  useAutoRefresh({
    enabled: isInitialized,
    intervalMs: 5 * 60 * 1000,
    refresh: refreshExternalData,
  });

  const addWeeklyGoal = useCallback((title: string, color = 'bg-text-muted') => {
    if (!title.trim() || weeklyGoals.length >= 3) return false;
    setWeeklyGoals((prev) => [
      ...prev,
      { id: `goal-${Date.now()}`, title: title.trim(), color },
    ]);
    return true;
  }, [weeklyGoals.length]);

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

  const addRitual = useCallback((title: string) => {
    if (!title.trim()) return;
    setRituals((prev) => [...prev, { id: `ritual-${Date.now()}`, title: title.trim(), completedDates: [] }]);
  }, []);

  const removeRitual = useCallback((id: string) => {
    setRituals((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const toggleRitualComplete = useCallback((id: string) => {
    setRituals((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const already = r.completedDates.includes(TODAY);
      return {
        ...r,
        completedDates: already
          ? r.completedDates.filter((d) => d !== TODAY)
          : [...r.completedDates, TODAY],
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
    setWeeklyPlanningLastCompleted(TODAY);
    setIsWeeklyPlanningOpen(false);
  }, []);

  const setWorkdayEnd = useCallback((hour: number, min: number) => {
    setWorkdayEndState({ hour, min });
  }, []);

  const lockDay = useCallback(() => {
    setDayLocked(true);
    void window.api.store.set('dayLocked', true);
    void window.api.window.setFocusSize(true);
  }, []);

  const unlockDay = useCallback(() => {
    setDayLocked(false);
    void window.api.store.set('dayLocked', false);
    void window.api.window.setFocusSize(false);
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
  }, [plannedTasks, weeklyGoals]);

  const resetDay = useCallback(async () => {
    const focusBlocks = scheduleBlocks.filter((block) => !block.readOnly && block.kind === 'focus');
    await Promise.allSettled(
      focusBlocks
        .filter((block) => block.eventId)
        .map((block) => window.api.gcal.deleteEvent(block.eventId!, block.calendarId))
    );

    setScheduleBlocks((prev) => prev.filter((block) => block.readOnly || block.kind !== 'focus'));
    setPlannedTasks((prev) =>
      prev.map((task) =>
        task.status === 'committed' || task.status === 'scheduled'
          ? { ...task, status: 'candidate', scheduledEventId: undefined, scheduledCalendarId: undefined, parentId: undefined }
          : task
      )
    );
    setDailyPlan((prev) => ({ ...prev, committedTaskIds: [] }));
    setLastCommitTimestamp(0);
    setDayLocked(false);
    void window.api.store.set('dayLocked', false);
    void window.api.window.setFocusSize(false);
  }, [scheduleBlocks, setDailyPlan, setLastCommitTimestamp, setPlannedTasks, setScheduleBlocks]);

  return (
    <AppContext.Provider
      value={{
        activeView,
        setActiveView,
        activeSource,
        setActiveSource,
        weeklyGoals,
        addWeeklyGoal,
        renameWeeklyGoal,
        updateGoalWhy,
        updateGoalColor,
        updateGoalCountdown,
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
        workdayEnd,
        setWorkdayEnd,
        updateTaskEstimate,
        nestTask,
        unnestTask,
        dayLocked,
        lockDay,
        unlockDay,
        resetDay,
        monthlyPlan,
        monthlyPlanPrompt,
        isMonthlyPlanningOpen,
        setMonthlyPlan,
        dismissMonthlyPlanPrompt,
        openMonthlyPlanning,
        closeMonthlyPlanning,
        updateRitualEstimate,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
