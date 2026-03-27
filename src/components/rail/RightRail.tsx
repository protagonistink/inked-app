import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import { TrendingUp, Target } from 'lucide-react';
import { useAppShell, usePlanner } from '@/context/AppContext';
import { resolveGoalColor } from '@/lib/goalColors';
import type { EngineState } from '../../../engine/types';
import { computeBalanceAwareness, computeFocusCapacity } from './railUtils';
import { BalanceAwareness } from './BalanceAwareness';
import { EndOfDayNudge } from './EndOfDayNudge';
import { FocusCapacity } from './FocusCapacity';
import { HardDeadlines } from './HardDeadlines';
import { IntentionsSummary } from './IntentionsSummary';
import { MoneyMoves } from './MoneyMoves';

interface RightRailProps {
  onOpenInk: () => void;
  onEndDay: () => void;
}

export function RightRail({ onOpenInk: _onOpenInk, onEndDay }: RightRailProps) {
  const { inboxOpen, view } = useAppShell();
  const {
    weeklyGoals,
    plannedTasks,
    scheduleBlocks,
    workdayStart,
    workdayEnd,
    viewDate,
  } = usePlanner();

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
  const intentions = useMemo(() => weeklyGoals.map((goal, i) => {
    const goalTasks = plannedTasks.filter(t => t.weeklyGoalId === goal.id);
    return {
      title: goal.title,
      color: resolveGoalColor(goal.color, i),
      totalTasks: goalTasks.length,
      doneTasks: goalTasks.filter(t => t.status === 'done').length,
    };
  }), [weeklyGoals, plannedTasks]);

  const referenceDate = startOfDay(viewDate);

  // Hard deadlines: real task due dates within the next 3 days, sorted by urgency.
  const deadlines = useMemo(() => {
    return plannedTasks
      .filter((t) => {
        if (t.status === 'done' || t.status === 'cancelled') return false;
        if (!t.dueOn) return false;
        const daysUntil = differenceInCalendarDays(parseISO(t.dueOn), referenceDate);
        return daysUntil <= 3;
      })
      .map((t) => ({
        title: t.title,
        dueDate: t.dueOn as string,
      }))
      .sort((a, b) => differenceInCalendarDays(parseISO(a.dueDate), referenceDate) - differenceInCalendarDays(parseISO(b.dueDate), referenceDate))
      .slice(0, 3);
  }, [plannedTasks, referenceDate]);

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

  const expandedLedger = view === 'flow' && inboxOpen;

  return (
    <aside className="gravity-dim w-[280px] flex-shrink-0 flex flex-col border-l border-border-subtle bg-bg-elevated overflow-y-auto select-none">
      <div className="px-7 pt-[74px] pb-6 flex flex-col">
        <div>
          <h3 className="flex items-center gap-2 font-serif text-[13px] uppercase tracking-[0.18em] text-text-whisper mb-4">
            <TrendingUp size={12} strokeWidth={1.5} />
            The Ledger
          </h3>
          {moneyObligations && moneyObligations.length > 0 ? (
            <MoneyMoves obligations={moneyObligations} heroMode={expandedLedger} />
          ) : (
            <span className="text-[12px] text-text-muted/35 italic">No obligations this week</span>
          )}
        </div>

        <div className="h-px bg-border-subtle my-6" />

        {/* Focus capacity — editorial italic statement */}
        <FocusCapacity
          hoursRemaining={focusCapacity.hoursRemaining}
          scheduledHours={focusCapacity.scheduledHours}
          totalHours={focusCapacity.totalHours}
          occupancyRatio={focusCapacity.occupancyRatio}
          label={focusCapacity.label}
        />

        {/* Intentions */}
        {intentions.length > 0 && (
          <>
            <div className="h-px bg-border-subtle my-6" />
            <div>
              <h3 className="flex items-center gap-2 font-serif text-[13px] uppercase tracking-[0.18em] text-text-whisper mb-4">
                <Target size={12} strokeWidth={1.5} />
                Intentions
              </h3>
              <IntentionsSummary intentions={intentions} />
            </div>
          </>
        )}

        {/* Balance awareness nudge */}
        {balanceAwareness.message && (
          <>
            <div className="h-px bg-border-subtle my-6" />
            <BalanceAwareness message={balanceAwareness.message} />
          </>
        )}

        {/* Hard deadlines */}
        {deadlines.length > 0 && (
          <>
            <div className="h-px bg-border-subtle my-6" />
            <div>
              <h3 className="font-serif text-[13px] uppercase tracking-[0.18em] text-text-whisper mb-4">Deadlines</h3>
              <HardDeadlines deadlines={deadlines} referenceDate={referenceDate} />
            </div>
          </>
        )}

      </div>

      {/* Spacer pushes footer to bottom */}
      <div className="flex-1 min-h-8" />

      {/* Footer */}
      <div className="px-7 pb-8 flex flex-col gap-3">
        <EndOfDayNudge visible={isAfterWorkday} onClick={onEndDay} />
      </div>
    </aside>
  );
}
