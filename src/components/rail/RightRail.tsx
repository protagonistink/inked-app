import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useApp } from '@/context/AppContext';
import type { EngineState } from '../../../engine/types';
import { computeBalanceAwareness, computeFocusCapacity } from './railUtils';
import { BalanceAwareness } from './BalanceAwareness';
import { EndOfDayNudge } from './EndOfDayNudge';
import { FocusCapacity } from './FocusCapacity';
import { HardDeadlines } from './HardDeadlines';
import { InkLink } from './InkLink';
import { IntentionsSummary } from './IntentionsSummary';
import { MoneyMoves } from './MoneyMoves';

// Goal color palette — matches the rest of the app's right-rail patterns
const INTENTION_COLORS = [
  'rgba(167,139,250,0.7)',
  'rgba(45,212,191,0.6)',
  'rgba(251,191,36,0.6)',
];

interface RightRailProps {
  onOpenInk: () => void;
  onEndDay: () => void;
}

export function RightRail({ onOpenInk, onEndDay }: RightRailProps) {
  const {
    weeklyGoals,
    plannedTasks,
    scheduleBlocks,
    workdayStart,
    workdayEnd,
    viewDate,
  } = useApp();

  const [financeState, setFinanceState] = useState<EngineState | null>(null);

  useEffect(() => {
    async function loadFinance() {
      try {
        const state = await window.api.finance.getState();
        setFinanceState(state);
      } catch {
        // Finance is optional — fail silently
        setFinanceState(null);
      }
    }
    void loadFinance();
  }, []);

  const currentHour = new Date().getHours();

  // Minutes consumed by hard calendar events
  const scheduledMinutes = useMemo(
    () =>
      scheduleBlocks
        .filter((b) => b.kind === 'hard')
        .reduce((sum, b) => sum + b.durationMins, 0),
    [scheduleBlocks],
  );

  const focusCapacity = computeFocusCapacity({
    workdayStartHour: workdayStart.hour,
    workdayEndHour: workdayEnd.hour,
    scheduledMinutes,
    currentHour,
  });

  // Build intentions with today's completion counts
  const today = viewDate instanceof Date
    ? viewDate.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const intentionsWithCounts = useMemo(
    () =>
      weeklyGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        tasksCompletedToday: plannedTasks.filter(
          (t) =>
            t.weeklyGoalId === goal.id &&
            t.status === 'done' &&
            t.lastCommittedDate === today,
        ).length,
      })),
    [weeklyGoals, plannedTasks, today],
  );

  const balanceAwareness = computeBalanceAwareness({ intentions: intentionsWithCounts });

  // Intentions for display
  const intentions = weeklyGoals.map((goal, i) => ({
    title: goal.title,
    color: goal.color && goal.color !== 'bg-text-muted'
      ? goal.color
      : INTENTION_COLORS[i % INTENTION_COLORS.length],
  }));

  // Hard deadlines: Asana tasks with due dates within 3 days
  const deadlines = useMemo(() => {
    const now = new Date();
    return plannedTasks
      .filter((t) => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        if (!t.sourceId || t.source !== 'asana') return false;
        // We don't store dueDate on PlannedTask directly — skip for now
        // This will be extended when dueDate is available on the type
        return false;
      })
      .map((t) => ({
        title: t.title,
        dueDate: today, // placeholder; replaced below when we have real due dates
      }))
      .filter((d) => differenceInCalendarDays(parseISO(d.dueDate), now) <= 3);
  }, [plannedTasks, today]);

  // Money obligations: upcoming items within 7 days
  const moneyObligations = useMemo(() => {
    if (!financeState?.obligations) return null;
    const now = new Date();
    return financeState.obligations
      .filter((ob) => {
        const days = differenceInCalendarDays(new Date(ob.dueDate), now);
        return days >= 0 && days <= 7;
      })
      .slice(0, 3)
      .map((ob) => ({
        label: ob.name,
        amount: ob.amount,
        dueDate: new Date(ob.dueDate).toISOString().split('T')[0],
      }));
  }, [financeState]);

  // End-of-day nudge: show when we're past the workday end
  const isAfterWorkday = currentHour >= workdayEnd.hour;

  return (
    <aside className="w-[260px] flex-shrink-0 flex flex-col border-l border-[rgba(250,250,250,0.07)] overflow-y-auto">
      <div className="px-5 pt-6 flex flex-col gap-7">

        {/* Focus capacity */}
        <FocusCapacity
          hoursRemaining={focusCapacity.hoursRemaining}
          label={focusCapacity.label}
        />

        {/* This week's intentions */}
        {intentions.length > 0 && (
          <div>
            <span className="section-lbl mb-2 block">This week's threads</span>
            <IntentionsSummary intentions={intentions} />
          </div>
        )}

        {/* Balance awareness nudge */}
        <BalanceAwareness message={balanceAwareness.message} />

        {/* Upcoming money obligations */}
        {moneyObligations && moneyObligations.length > 0 && (
          <div>
            <span className="section-lbl mb-2 block">Coming up</span>
            <MoneyMoves obligations={moneyObligations} />
          </div>
        )}

        {/* Hard deadlines */}
        {deadlines.length > 0 && (
          <div>
            <span className="section-lbl mb-2 block">Deadlines</span>
            <HardDeadlines deadlines={deadlines} />
          </div>
        )}

      </div>

      {/* Spacer pushes footer to bottom */}
      <div className="flex-1 min-h-8" />

      {/* Footer */}
      <div className="px-5 pb-6 flex flex-col gap-3">
        <EndOfDayNudge visible={isAfterWorkday} onClick={onEndDay} />
        <InkLink onClick={onOpenInk} />
      </div>
    </aside>
  );
}
