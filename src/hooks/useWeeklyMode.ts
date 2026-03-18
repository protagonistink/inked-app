import { useMemo } from 'react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { currentWeekStart } from '@/lib/planner';

export type WeeklyViewMode = 'month-not-set' | 'week-not-planned' | 'active-week';

export interface GoalAttention {
  goalId: string;
  tasksThisWeek: number;
  tasksDone: number;
  daysSinceLastActivity: number;
  deadlineDaysLeft: number | null;
  deadlineTitle: string | null;
  energyLevel: 'warm' | 'steady' | 'quiet';
  nudgeLine: string;
  nudgeUrgent: boolean;
}

export function useWeeklyMode() {
  const { monthlyPlan, weeklyGoals, weeklyPlanningLastCompleted } = useApp();

  const mode: WeeklyViewMode = useMemo(() => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const monthIsSet = monthlyPlan !== null && monthlyPlan.month === currentMonth;

    if (!monthIsSet) return 'month-not-set';

    const weekStart = currentWeekStart();
    const weekIsPlanned =
      weeklyGoals.length > 0 &&
      weeklyPlanningLastCompleted !== null &&
      weeklyPlanningLastCompleted >= weekStart;

    if (!weekIsPlanned) return 'week-not-planned';

    return 'active-week';
  }, [monthlyPlan, weeklyGoals.length, weeklyPlanningLastCompleted]);

  return mode;
}

export function useAttentionBalance(): GoalAttention[] {
  const { weeklyGoals, plannedTasks, countdowns, timeLogs, monthlyPlan } = useApp();

  return useMemo(() => {
    const today = new Date();
    const weekStart = currentWeekStart();
    return weeklyGoals.map((goal, goalIndex) => {
      // Tasks for this goal this week
      const goalTasks = plannedTasks.filter(
        (t) =>
          t.weeklyGoalId === goal.id &&
          t.lastCommittedDate &&
          t.lastCommittedDate >= weekStart &&
          t.status !== 'candidate' &&
          t.status !== 'cancelled'
      );
      const tasksThisWeek = goalTasks.length;
      const tasksDone = goalTasks.filter((t) => t.status === 'done').length;

      // Days since last activity
      const lastDate = goalTasks.reduce<string | null>((latest, t) => {
        if (!t.lastCommittedDate) return latest;
        return !latest || t.lastCommittedDate > latest ? t.lastCommittedDate : latest;
      }, null);
      const daysSinceLastActivity = lastDate
        ? differenceInDays(today, parseISO(lastDate))
        : Infinity;

      // Deadline from linked countdown
      const linkedCountdown = goal.countdownId
        ? countdowns.find((c) => c.id === goal.countdownId)
        : null;
      const deadlineDaysLeft = linkedCountdown
        ? differenceInDays(parseISO(linkedCountdown.dueDate), today)
        : null;
      const deadlineTitle = linkedCountdown?.title ?? null;

      // Focus minutes from timeLogs
      const weekStartISO = parseISO(weekStart).toISOString();
      const focusMins = timeLogs
        .filter((log) => log.objectiveId === goal.id && log.startedAt >= weekStartISO)
        .reduce((sum, log) => sum + log.durationMins, 0);

      // Energy level
      let energyLevel: GoalAttention['energyLevel'];
      if (daysSinceLastActivity <= 1) {
        energyLevel = 'warm';
      } else if (daysSinceLastActivity <= 4 && tasksThisWeek > 0) {
        energyLevel = 'steady';
      } else {
        energyLevel = 'quiet';
      }

      // Nudge line computation
      let nudgeLine = '';
      let nudgeUrgent = false;

      // Priority 1: Deadline-driven
      if (deadlineDaysLeft !== null && deadlineTitle) {
        if (deadlineDaysLeft <= 0) {
          nudgeLine = 'This is due today.';
          nudgeUrgent = true;
        } else if (deadlineDaysLeft <= 2 && tasksDone === 0) {
          const dayName = format(parseISO(linkedCountdown!.dueDate), 'EEEE');
          nudgeLine = `Due ${dayName}. Nothing's moved yet.`;
          nudgeUrgent = true;
        } else if (deadlineDaysLeft <= 2) {
          const dayName = format(parseISO(linkedCountdown!.dueDate), 'EEEE');
          nudgeLine = `Due ${dayName}. You're close.`;
          nudgeUrgent = true;
        } else if (deadlineDaysLeft <= 5 && energyLevel === 'quiet') {
          const dayName = format(parseISO(linkedCountdown!.dueDate), 'EEEE');
          nudgeLine = `${deadlineTitle} is due ${dayName}. Start now.`;
          nudgeUrgent = true;
        } else if (deadlineDaysLeft <= 5) {
          nudgeLine = `${deadlineDaysLeft} days until ${deadlineTitle}.`;
          nudgeUrgent = false;
        }
      }

      // Priority 2: Monthly aim nudge (first goal gets this if quiet)
      if (
        !nudgeLine &&
        energyLevel === 'quiet' &&
        goalIndex === 0 &&
        monthlyPlan?.oneThing
      ) {
        nudgeLine = "You set this as your monthly aim. Don't let it drift.";
      }

      // Priority 3: Attention-driven
      if (!nudgeLine) {
        if (energyLevel === 'warm' && tasksDone > 0) {
          nudgeLine = "Momentum is real.";
        } else if (energyLevel === 'warm') {
          nudgeLine = 'Active, but nothing finished yet.';
        } else if (energyLevel === 'steady') {
          nudgeLine = 'Steady. Keep the thread.';
        } else if (tasksThisWeek === 0) {
          nudgeLine = 'Nothing held here yet this week.';
        } else if (lastDate) {
          const dayName = format(parseISO(lastDate), 'EEEE');
          nudgeLine = `This thread has been quiet since ${dayName}.`;
        } else {
          nudgeLine = 'This thread has been quiet.';
        }
      }

      return {
        goalId: goal.id,
        tasksThisWeek,
        tasksDone,
        daysSinceLastActivity,
        deadlineDaysLeft,
        deadlineTitle,
        energyLevel,
        nudgeLine,
        nudgeUrgent,
        _focusMins: focusMins, // internal, used for activity line
      };
    });
  }, [weeklyGoals, plannedTasks, countdowns, timeLogs, monthlyPlan]);
}

/** Format the activity summary line for an intention card */
export function formatActivityLine(attention: GoalAttention & { _focusMins?: number }): string {
  const parts: string[] = [];
  if (attention.tasksThisWeek > 0) {
    parts.push(`${attention.tasksThisWeek} task${attention.tasksThisWeek === 1 ? '' : 's'} held`);
  }
  if (attention.tasksDone > 0) {
    parts.push(`${attention.tasksDone} done`);
  }
  const focusMins = (attention as { _focusMins?: number })._focusMins;
  if (focusMins && focusMins > 0) {
    parts.push(`${focusMins}m focused`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Nothing yet';
}
