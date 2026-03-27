import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { usePlanner } from '@/context/AppContext';
import { useAttentionBalance, useWeeklyMode } from '@/hooks/useWeeklyMode';

export interface GravityAttention {
  goalId: string;
  energyLevel: 'warm' | 'steady' | 'quiet';
  daysSinceLastActivity: number;
  tasksThisWeek: number;
  tasksDone: number;
}

export interface GravityTimeLog {
  objectiveId: string | null;
  durationMins: number;
}

export interface GravityInput {
  attentionData: GravityAttention[];
  todayTimeLogs: GravityTimeLog[];
  todayAnarchy: boolean;
  weekendGravity: boolean;
  isWeekend: boolean;
  weeklyModeActive: boolean;
}

export interface GravityState {
  active: boolean;
  staleGoalId: string | null;
  staleGoalTitle: string | null;
  daysSinceActivity: number;
}

const SATISFACTION_THRESHOLD = 0.4;
const RELEASE_MINUTES = 5;

export function computeGravityState(input: GravityInput): GravityState {
  const inactive: GravityState = { active: false, staleGoalId: null, staleGoalTitle: null, daysSinceActivity: 0 };

  if (!input.weeklyModeActive) return inactive;
  if (input.isWeekend && !input.weekendGravity) return inactive;
  if (input.todayAnarchy) return inactive;
  if (input.attentionData.length === 0) return inactive;

  const staleIntentions = input.attentionData
    .filter((a) => {
      if (a.energyLevel !== 'quiet') return false;
      if (a.tasksThisWeek === 0) return false;
      const satisfaction = a.tasksDone / a.tasksThisWeek;
      return satisfaction < SATISFACTION_THRESHOLD;
    })
    .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);

  if (staleIntentions.length === 0) return inactive;

  const stalest = staleIntentions[0];

  const staleGoalIds = new Set(staleIntentions.map((a) => a.goalId));
  const focusOnStale = input.todayTimeLogs
    .filter((log) => log.objectiveId && staleGoalIds.has(log.objectiveId))
    .reduce((sum, log) => sum + log.durationMins, 0);

  if (focusOnStale >= RELEASE_MINUTES) return inactive;

  return {
    active: true,
    staleGoalId: stalest.goalId,
    staleGoalTitle: null,
    daysSinceActivity: stalest.daysSinceLastActivity,
  };
}

export function useGravity() {
  const { weeklyGoals, timeLogs } = usePlanner();
  const weeklyMode = useWeeklyMode();
  const attentionData = useAttentionBalance();

  const [anarchyDate, setAnarchyDate] = useState<string | null>(null);
  const [manualReleaseDate, setManualReleaseDate] = useState<string | null>(null);

  const todayKey = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    void window.api.store.get('gravityAnarchyDates').then((raw) => {
      const dates = raw as string[] | undefined;
      if (dates?.includes(todayKey)) setAnarchyDate(todayKey);
    });
  }, [todayKey]);
  const isWeekend = [0, 6].includes(new Date().getDay());
  const todayAnarchy = anarchyDate === todayKey;
  const todayManualRelease = manualReleaseDate === todayKey;

  const todayTimeLogs = useMemo(() => {
    return timeLogs
      .filter((log) => log.startedAt.startsWith(todayKey))
      .map((log) => ({ objectiveId: log.objectiveId, durationMins: log.durationMins }));
  }, [timeLogs, todayKey]);

  const gravityInput: GravityInput = useMemo(() => ({
    attentionData: attentionData.map((a) => ({
      goalId: a.goalId,
      energyLevel: a.energyLevel,
      daysSinceLastActivity: a.daysSinceLastActivity,
      tasksThisWeek: a.tasksThisWeek,
      tasksDone: a.tasksDone,
    })),
    todayTimeLogs,
    todayAnarchy: todayAnarchy || todayManualRelease,
    weekendGravity: true,
    isWeekend,
    weeklyModeActive: weeklyMode === 'active-week',
  }), [attentionData, todayTimeLogs, todayAnarchy, todayManualRelease, isWeekend, weeklyMode]);

  const state = useMemo(() => {
    const computed = computeGravityState(gravityInput);
    if (computed.staleGoalId) {
      const goal = weeklyGoals.find((g) => g.id === computed.staleGoalId);
      return { ...computed, staleGoalTitle: goal?.title ?? null };
    }
    return computed;
  }, [gravityInput, weeklyGoals]);

  const invokeAnarchy = useCallback(() => {
    setAnarchyDate(todayKey);
    void window.api.store.get('gravityAnarchyDates').then((raw) => {
      const dates = raw as string[] | undefined;
      const updated = [...(dates ?? []), todayKey].slice(-14); // keep 2 weeks
      void window.api.store.set('gravityAnarchyDates', updated);
    });
  }, [todayKey]);

  const releaseGravity = useCallback(() => {
    setManualReleaseDate(todayKey);
  }, [todayKey]);

  return { ...state, invokeAnarchy, releaseGravity, todayAnarchy };
}
