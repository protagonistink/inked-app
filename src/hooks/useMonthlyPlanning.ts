import { useCallback, useEffect, useState } from 'react';
import type { MonthlyPlan } from '@/types';

interface MonthlyPlanningOptions {
  isInitialized: boolean;
  initialMonthlyPlan: MonthlyPlan | null;
}

interface MonthlyPlanningResult {
  monthlyPlan: MonthlyPlan | null;
  monthlyPlanPrompt: boolean;
  isMonthlyPlanningOpen: boolean;
  setMonthlyPlan: (plan: MonthlyPlan) => void;
  dismissMonthlyPlanPrompt: () => void;
  openMonthlyPlanning: () => void;
  closeMonthlyPlanning: () => void;
}

export function useMonthlyPlanning({
  isInitialized,
  initialMonthlyPlan,
}: MonthlyPlanningOptions): MonthlyPlanningResult {
  const [monthlyPlan, setMonthlyPlanState] = useState<MonthlyPlan | null>(initialMonthlyPlan);
  const [monthlyPlanPrompt, setMonthlyPlanPrompt] = useState(false);
  const [isMonthlyPlanningOpen, setIsMonthlyPlanningOpen] = useState(false);

  useEffect(() => {
    if (!isInitialized) return;
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (!monthlyPlan || monthlyPlan.month !== currentMonth) {
      void window.api.store.get('monthlyPlanDismissedDate').then((dismissed) => {
        const today = new Date().toISOString().split('T')[0];
        if (dismissed !== today) {
          setMonthlyPlanPrompt(true);
        }
      });
    }
  }, [isInitialized, monthlyPlan]);

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

  return {
    monthlyPlan,
    monthlyPlanPrompt,
    isMonthlyPlanningOpen,
    setMonthlyPlan,
    dismissMonthlyPlanPrompt,
    openMonthlyPlanning,
    closeMonthlyPlanning,
  };
}
