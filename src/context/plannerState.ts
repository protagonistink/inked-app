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
  dailyPlans: DailyPlan[];
  viewDate: string;
  timeLogs: TimeLogEntry[];
  rituals: DailyRitual[];
  countdowns: Countdown[];
  workdayStart: { hour: number; min: number };
  workdayEnd: { hour: number; min: number };
  dayEntries: DayEntry[];
  userName: string;
}

type PlannerField = keyof PlannerState;

type PlannerSetAction = {
  [K in PlannerField]: { type: 'set'; field: K; value: PlannerState[K] | ((prev: PlannerState[K]) => PlannerState[K]) };
}[PlannerField];

type PlannerAction =
  | { type: 'load'; payload: Partial<PlannerState> }
  | PlannerSetAction;

export const initialPlannerState: PlannerState = {
  weeklyGoals: [],
  plannedTasks: [],
  scheduleBlocks: [],
  dailyPlans: [{ date: getToday(), committedTaskIds: [] }],
  viewDate: getToday(),
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
    case 'set': {
      const field = action.field;
      const previousValue = state[field];
      // action.value is already typed to match PlannerState[K] | ((prev) => PlannerState[K])
      // via PlannerSetAction, but the computed property loses the correlation.
      // The cast to PlannerState[typeof field] is safe because the discriminated union guarantees it.
      return {
        ...state,
        [field]: applySetStateAction(previousValue, action.value as PlannerState[typeof field] | ((prev: PlannerState[typeof field]) => PlannerState[typeof field])),
      };
    }
    default:
      return state;
  }
}

export function createPlannerFieldSetter<K extends PlannerField>(
  dispatch: Dispatch<PlannerAction>,
  field: K
): Dispatch<SetStateAction<PlannerState[K]>> {
  return (value) => {
    dispatch({ type: 'set', field, value } as PlannerSetAction);
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

  if (stored.dailyPlans?.length) {
    nextState.dailyPlans = stored.dailyPlans;
  } else if (stored.dailyPlan) {
    nextState.dailyPlans = [stored.dailyPlan];
  }

  if (stored.viewDate || stored.selectedDate) {
    const restoredDate = stored.viewDate ?? stored.selectedDate ?? getToday();
    // Always open on today — never restore a past date from storage
    nextState.viewDate = restoredDate < getToday() ? getToday() : restoredDate;
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

  if (stored.localScheduleBlocks?.length) {
    nextState.scheduleBlocks = stored.localScheduleBlocks;
  }

  return nextState;
}
