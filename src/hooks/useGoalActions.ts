import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { PlannedTask, ScheduleBlock, WeeklyGoal } from '@/types';
import { MAX_WEEKLY_GOALS } from '@/context/plannerState';
const DEFAULT_WEEKLY_GOAL_COLORS = ['bg-accent-warm', 'bg-done', 'bg-accent-green'];

export function useGoalActions({
  weeklyGoals,
  setWeeklyGoals,
  setPlannedTasks,
  setScheduleBlocks,
}: {
  weeklyGoals: WeeklyGoal[];
  setWeeklyGoals: Dispatch<SetStateAction<WeeklyGoal[]>>;
  setPlannedTasks: Dispatch<SetStateAction<PlannedTask[]>>;
  setScheduleBlocks?: Dispatch<SetStateAction<ScheduleBlock[]>>;
}) {
  const addWeeklyGoal = useCallback((title: string, color = 'bg-text-muted') => {
    if (!title.trim() || weeklyGoals.length >= MAX_WEEKLY_GOALS) return false;
    setWeeklyGoals((prev) => [
      ...prev,
      { id: `goal-${crypto.randomUUID()}`, title: title.trim(), color },
    ]);
    return true;
  }, [weeklyGoals.length, setWeeklyGoals]);

  const replaceWeeklyGoals = useCallback((goals: Array<{ title: string; why?: string }>) => {
    const sanitized = goals
      .map((goal) => ({
        title: goal.title.trim(),
        why: goal.why?.trim() || undefined,
      }))
      .filter((goal) => goal.title.length > 0)
      .slice(0, MAX_WEEKLY_GOALS);

    const nextGoals = sanitized.map((goal, index) => {
      const existing = weeklyGoals.find((item) => item.title.trim().toLowerCase() === goal.title.toLowerCase());
      return {
        id: existing?.id ?? `goal-${crypto.randomUUID()}`,
        title: goal.title,
        why: goal.why,
        color: existing?.color ?? DEFAULT_WEEKLY_GOAL_COLORS[index % DEFAULT_WEEKLY_GOAL_COLORS.length],
        countdownId: existing?.countdownId,
      };
    });

    const nextGoalIdByOldId = new Map<string, string | null>();
    for (const previousGoal of weeklyGoals) {
      const replacement = nextGoals.find((goal) => goal.title.trim().toLowerCase() === previousGoal.title.trim().toLowerCase()) ?? null;
      nextGoalIdByOldId.set(previousGoal.id, replacement?.id ?? null);
    }

    setWeeklyGoals(nextGoals);
    setPlannedTasks((prev) =>
      prev.map((task) => ({
        ...task,
        weeklyGoalId: task.weeklyGoalId ? (nextGoalIdByOldId.get(task.weeklyGoalId) ?? null) : null,
      }))
    );
    setScheduleBlocks?.((prev) =>
      prev.map((block) => {
        if (!block.linkedGoalId) return block;
        const mapped = nextGoalIdByOldId.get(block.linkedGoalId);
        if (mapped === undefined) return block;
        return { ...block, linkedGoalId: mapped };
      })
    );
  }, [setPlannedTasks, setScheduleBlocks, setWeeklyGoals, weeklyGoals]);

  const removeWeeklyGoal = useCallback((id: string) => {
    setWeeklyGoals((prev) => prev.filter((goal) => goal.id !== id));
    setPlannedTasks((prev) => prev.map((t) => t.weeklyGoalId === id ? { ...t, weeklyGoalId: null } : t));
    setScheduleBlocks?.((prev) => prev.map((b) => b.linkedGoalId === id ? { ...b, linkedGoalId: null } : b));
  }, [setWeeklyGoals, setPlannedTasks, setScheduleBlocks]);

  const renameWeeklyGoal = useCallback((id: string, title: string) => {
    setWeeklyGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, title: title.trim() || goal.title } : goal));
  }, [setWeeklyGoals]);

  const updateGoalWhy = useCallback((id: string, why: string) => {
    setWeeklyGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, why } : goal));
  }, [setWeeklyGoals]);

  const updateGoalColor = useCallback((id: string, color: string) => {
    setWeeklyGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, color } : goal));
  }, [setWeeklyGoals]);

  const updateGoalCountdown = useCallback((id: string, countdownId: string | null) => {
    setWeeklyGoals((prev) => prev.map((goal) => goal.id === id ? { ...goal, countdownId: countdownId ?? undefined } : goal));
  }, [setWeeklyGoals]);

  const reorderWeeklyGoals = useCallback((fromIndex: number, toIndex: number) => {
    setWeeklyGoals((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, [setWeeklyGoals]);

  return {
    addWeeklyGoal,
    replaceWeeklyGoals,
    removeWeeklyGoal,
    renameWeeklyGoal,
    updateGoalWhy,
    updateGoalColor,
    updateGoalCountdown,
    reorderWeeklyGoals,
  };
}
