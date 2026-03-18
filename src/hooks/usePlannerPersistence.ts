import { useEffect } from 'react';
import type {
  Countdown,
  DailyPlan,
  DailyRitual,
  DayEntry,
  MonthlyPlan,
  PlannedTask,
  TimeLogEntry,
  WeeklyGoal,
} from '@/types';

export type PersistedView = 'flow' | 'archive' | 'goals';
export type PersistedSourceView = 'cover' | 'asana' | 'gcal' | 'gmail';

export interface StoredPlannerState {
  weeklyGoals: WeeklyGoal[];
  plannedTasks: PlannedTask[];
  dailyPlan: DailyPlan;
  timeLogs?: TimeLogEntry[];
  activeView?: PersistedView;
  activeSource?: PersistedSourceView;
  rituals?: DailyRitual[];
  countdowns?: Countdown[];
  weeklyPlanningLastCompleted?: string | null;
  workdayStart?: { hour: number; min: number };
  workdayEnd?: { hour: number; min: number };
  monthlyPlan?: MonthlyPlan | null;
  dayEntries?: DayEntry[];
  userName?: string;
}

interface PersistenceOptions {
  isInitialized: boolean;
  state: StoredPlannerState;
}

export function usePlannerPersistence({ isInitialized, state }: PersistenceOptions) {
  useEffect(() => {
    if (!isInitialized) return;
    void window.api.store.set('plannerState', state);
  }, [isInitialized, state]);
}

export async function loadPlannerState() {
  return (await window.api.store.get('plannerState')) as StoredPlannerState | undefined;
}
