import type { Dispatch, SetStateAction } from 'react';
import type {
  Countdown,
  DailyPlan,
  DailyRitual,
  DayEntry,
  PlannedTask,
  ScheduleBlock,
  TimeLogEntry,
  WeeklyGoal,
} from '@/types';
import { getToday } from '@/lib/planner';
import type { StoredPlannerState } from '@/hooks/usePlannerPersistence';

export const MAX_WEEKLY_GOALS = 3;

export interface PlannerState {
  weeklyGoals: WeeklyGoal[];
  plannedTasks: PlannedTask[];
  scheduleBlocks: ScheduleBlock[];
  dailyPlan: DailyPlan;
  timeLogs: TimeLogEntry[];
  rituals: DailyRitual[];
  countdowns: Countdown[];
  workdayStart: { hour: number; min: number };
  workdayEnd: { hour: number; min: number };
  dayEntries: DayEntry[];
  userName: string;
}

type PlannerField = keyof PlannerState;

type PlannerAction =
  | { type: 'load'; payload: Partial<PlannerState> }
  | { type: 'set'; field: PlannerField; value: unknown };

export const initialPlannerState: PlannerState = {
  weeklyGoals: [],
  plannedTasks: [],
  scheduleBlocks: [],
  dailyPlan: { date: getToday(), committedTaskIds: [] },
  timeLogs: [],
  rituals: [],
  countdowns: [],
  workdayStart: { hour: 9, min: 0 },
  workdayEnd: { hour: 18, min: 0 },
  dayEntries: [],
  userName: 'Patrick',
};

function applySetStateAction<T>(prev: T, next: T | ((current: T) => T)): T {
  return typeof next === 'function' ? (next as (current: T) => T)(prev) : next;
}

export function plannerReducer(state: PlannerState, action: PlannerAction): PlannerState {
  switch (action.type) {
    case 'load':
      return { ...state, ...action.payload };
    case 'set':
      const field = action.field;
      const previousValue = state[field];
      return {
        ...state,
        [field]: applySetStateAction(previousValue, action.value as typeof previousValue | ((prev: typeof previousValue) => typeof previousValue)),
      };
    default:
      return state;
  }
}

export function createPlannerFieldSetter<K extends PlannerField>(
  dispatch: Dispatch<PlannerAction>,
  field: K
): Dispatch<SetStateAction<PlannerState[K]>> {
  return (value) => {
    dispatch({ type: 'set', field, value: value as unknown });
  };
}

export function storedPlannerStateToPlannerState(stored: StoredPlannerState): Partial<PlannerState> {
  const nextState: Partial<PlannerState> = {};

  if (stored.weeklyGoals) {
    nextState.weeklyGoals = stored.weeklyGoals.slice(0, MAX_WEEKLY_GOALS);
  }

  if (stored.plannedTasks) {
    nextState.plannedTasks = stored.plannedTasks.map((task) => ({
      ...task,
      title: task.title || 'Untitled task',
    }));
  }

  if (stored.dailyPlan) {
    nextState.dailyPlan = stored.dailyPlan;
  }

  if (stored.timeLogs) {
    nextState.timeLogs = stored.timeLogs;
  }

  if (stored.rituals) {
    nextState.rituals = stored.rituals;
  }

  if (stored.countdowns) {
    nextState.countdowns = stored.countdowns;
  }

  if (stored.workdayStart) {
    nextState.workdayStart = stored.workdayStart;
  }

  if (stored.workdayEnd) {
    nextState.workdayEnd = stored.workdayEnd;
  }

  if (stored.dayEntries) {
    nextState.dayEntries = stored.dayEntries;
  }

  if (stored.userName) {
    nextState.userName = stored.userName;
  }

  return nextState;
}
