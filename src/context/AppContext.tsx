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

const INITIAL_GOALS: WeeklyGoal[] = [
  { id: 'goal-work', title: 'Client Story Work', color: 'bg-accent-warm' },
  { id: 'goal-writing', title: 'Screenplay Pages', color: 'bg-accent-teal' },
  { id: 'goal-life', title: 'Body and Admin', color: 'bg-done' },
];

const INITIAL_TASKS: PlannedTask[] = [
  {
    id: 'local-1',
    title: 'Shape the next scene of the app',
    source: 'local',
    weeklyGoalId: 'goal-work',
    status: 'committed',
    estimateMins: 90,
    active: true,
    priority: 'P1',
    lastCommittedDate: TODAY,
  },
  {
    id: 'local-2',
    title: 'Revise act two pages',
    source: 'local',
    weeklyGoalId: 'goal-writing',
    status: 'committed',
    estimateMins: 60,
    active: false,
    lastCommittedDate: TODAY,
  },
];

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
  moveForward: (taskId: string) => void;
  releaseTask: (taskId: string) => void;
  dropTask: (taskId: string) => void;
  toggleTask: (id: string) => void;
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
}

const AppContext = createContext<AppContextValue>(null!);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeView, setActiveView] = useState<View>('flow');
  const [activeSource, setActiveSource] = useState<SourceView>('cover');
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>(INITIAL_GOALS);
  const [plannedTasks, setPlannedTasks] = useState<PlannedTask[]>(INITIAL_TASKS);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan>({ date: TODAY, committedTaskIds: INITIAL_TASKS.map((task) => task.id) });
  const [timeLogs, setTimeLogs] = useState<TimeLogEntry[]>([]);
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(null);
  const [lastCommitTimestamp, setLastCommitTimestamp] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [rituals, setRituals] = useState<DailyRitual[]>([]);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [weeklyPlanningLastCompleted, setWeeklyPlanningLastCompleted] = useState<string | null>(null);
  const [isWeeklyPlanningOpen, setIsWeeklyPlanningOpen] = useState(false);
  const [workdayEnd, setWorkdayEndState] = useState<{ hour: number; min: number }>({ hour: 18, min: 0 });
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
        if (stored?.plannedTasks?.length) setPlannedTasks(stored.plannedTasks);
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
      } catch (error) {
        console.error('Failed to load planner state:', error);
      } finally {
        setIsInitialized(true);
      }
    }

    loadState();
  }, []);

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

  const selectInboxItem = useCallback((id: string) => {
    setSelectedInboxId((prev) => prev === id ? null : id);
  }, []);

  const {
    migrateOldTasks,
    dropTask,
    bringForward,
    addLocalTask,
    assignTaskToGoal,
    moveForward,
    releaseTask,
    toggleTask,
    setActiveTask,
  } = useTaskActions({
    weeklyGoals,
    setPlannedTasks,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
