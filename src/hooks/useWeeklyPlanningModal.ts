import { useCallback, useState } from 'react';
import { getToday } from '@/lib/planner';

interface WeeklyPlanningModalOptions {
  initialLastCompleted: string | null;
}

interface WeeklyPlanningModalResult {
  isWeeklyPlanningOpen: boolean;
  weeklyPlanningLastCompleted: string | null;
  openWeeklyPlanning: () => void;
  closeWeeklyPlanning: () => void;
  completeWeeklyPlanning: () => void;
}

export function useWeeklyPlanningModal({
  initialLastCompleted,
}: WeeklyPlanningModalOptions): WeeklyPlanningModalResult {
  const [isWeeklyPlanningOpen, setIsWeeklyPlanningOpen] = useState(false);
  const [weeklyPlanningLastCompleted, setWeeklyPlanningLastCompleted] =
    useState<string | null>(initialLastCompleted);

  const openWeeklyPlanning = useCallback(() => setIsWeeklyPlanningOpen(true), []);
  const closeWeeklyPlanning = useCallback(() => setIsWeeklyPlanningOpen(false), []);
  const completeWeeklyPlanning = useCallback(() => {
    setWeeklyPlanningLastCompleted(getToday());
    setIsWeeklyPlanningOpen(false);
  }, []);

  return {
    isWeeklyPlanningOpen,
    weeklyPlanningLastCompleted,
    openWeeklyPlanning,
    closeWeeklyPlanning,
    completeWeeklyPlanning,
  };
}
