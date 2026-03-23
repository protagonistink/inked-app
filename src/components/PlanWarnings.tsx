import { useMemo, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { X } from 'lucide-react';
import { formatRoundedHours } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

export function PlanWarnings() {
  const {
    dayTasks,
    scheduleBlocks,
    workdayStart,
    workdayEnd,
    committedTasks,
    countdowns,
    weeklyGoals,
  } = useApp();

  const [balanceDismissed, setBalanceDismissed] = useState(false);

  const totalCommittedMinutes = dayTasks.reduce((sum, task) => sum + task.estimateMins, 0);
  const scheduledFocusMinutes = scheduleBlocks
    .filter((block) => block.kind === 'focus')
    .reduce((sum, block) => sum + block.durationMins, 0);
  const hardBlockMinutes = scheduleBlocks
    .filter((block) => block.kind === 'hard')
    .reduce((sum, block) => sum + block.durationMins, 0);
  const workdayMinutes = Math.max(0, (workdayEnd.hour * 60 + workdayEnd.min) - (workdayStart.hour * 60 + workdayStart.min));
  const availableFocusMinutes = Math.max(0, workdayMinutes - hardBlockMinutes);
  const unscheduledMinutes = committedTasks.reduce((sum, task) => sum + task.estimateMins, 0);
  const remainingFocusCapacity = Math.max(0, availableFocusMinutes - scheduledFocusMinutes);

  const realismWarning = useMemo(() => {
    if (dayTasks.length === 0) return null;

    if (totalCommittedMinutes > availableFocusMinutes) {
      const overBy = totalCommittedMinutes - availableFocusMinutes;
      return `The day is overcommitted by ${formatRoundedHours(overBy, true)} against the actual focus capacity.`;
    }

    if (unscheduledMinutes > remainingFocusCapacity) {
      const overBy = unscheduledMinutes - remainingFocusCapacity;
      return `There is ${formatRoundedHours(overBy, true)} still unplaced in Today's Commit. The plan is likely to collapse unless something moves, shrinks, or drops.`;
    }

    if (remainingFocusCapacity < 30 && unscheduledMinutes > 0) {
      return 'There is almost no open focus capacity left, but the commit list is still carrying loose work.';
    }

    return null;
  }, [availableFocusMinutes, dayTasks.length, remainingFocusCapacity, totalCommittedMinutes, unscheduledMinutes]);

  const balanceWarning = useMemo(() => {
    if (dayTasks.length < 2) return null;

    const totals = weeklyGoals.map((goal) => ({
      title: goal.title,
      minutes: dayTasks
        .filter((task) => task.weeklyGoalId === goal.id)
        .reduce((sum, task) => sum + task.estimateMins, 0),
    }));
    const emptyGoals = totals.filter((goal) => goal.minutes === 0);
    const dominantGoal = totals.reduce((largest, goal) => goal.minutes > largest.minutes ? goal : largest, totals[0]);
    const dominanceRatio = totalCommittedMinutes > 0 ? dominantGoal.minutes / totalCommittedMinutes : 0;

    if (emptyGoals.length > 0 && dominanceRatio >= 0.70 && totalCommittedMinutes > 60) {
      return `${dominantGoal.title} is carrying most of the day while ${emptyGoals.map((goal) => goal.title).join(' and ')} gets nothing.`;
    }

    return null;
  }, [dayTasks, totalCommittedMinutes, weeklyGoals]);

  const deadlineWarning = useMemo(() => {
    if (countdowns.length === 0) return null;

    const today = new Date();
    const upcoming = countdowns
      .map((countdown) => ({
        ...countdown,
        days: differenceInCalendarDays(parseISO(countdown.dueDate), today),
      }))
      .filter((countdown) => countdown.days >= 0)
      .sort((a, b) => a.days - b.days)[0];

    if (!upcoming) return null;

    if (upcoming.days <= 2 && scheduledFocusMinutes < totalCommittedMinutes) {
      return `${upcoming.title} lands in ${upcoming.days === 0 ? 'hours' : `${upcoming.days} day${upcoming.days === 1 ? '' : 's'}`}. Protect real time for it instead of leaving the work loose in commit.`;
    }

    if (upcoming.days <= 5 && remainingFocusCapacity > 0) {
      return `${upcoming.title} is ${upcoming.days} day${upcoming.days === 1 ? '' : 's'} out. Use the remaining ${formatRoundedHours(remainingFocusCapacity, true)} to round out the day before it turns urgent.`;
    }

    return null;
  }, [countdowns, remainingFocusCapacity, scheduledFocusMinutes, totalCommittedMinutes]);

  if (!realismWarning && !balanceWarning && !deadlineWarning) return null;

  return (
    <div className="grid gap-3">
      {realismWarning && (
        <div className="border-l-2 border-l-[rgba(140,130,110,0.35)] px-3 py-2 text-[12px]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted/60 opacity-50">Reality Check</div>
          <div className="mt-1 text-[13px] text-[rgba(190,180,160,0.7)]">{realismWarning}</div>
          <div className="mt-2 text-[11px] text-text-muted/50">
            Capacity: {formatRoundedHours(availableFocusMinutes, true)}. Scheduled: {formatRoundedHours(scheduledFocusMinutes, true)}. Still loose: {formatRoundedHours(unscheduledMinutes, true)}.
          </div>
        </div>
      )}
      {balanceWarning && !balanceDismissed && (
        <div
          className="relative"
          style={{
            border: 'none',
            borderLeft: '2px solid rgba(80,120,200,0.5)',
            borderRadius: 0,
            background: 'rgba(80,120,200,0.04)',
            padding: '10px 12px',
          }}
        >
          <button
            onClick={() => setBalanceDismissed(true)}
            className="absolute top-2 right-3 hover:opacity-60 transition-opacity"
            style={{ opacity: 0.3, background: 'none', border: 'none' }}
            title="Dismiss"
          >
            <X className="w-3 h-3" />
          </button>
          <div className="flex gap-[11px] items-start pr-5">
            <svg width="20" height="20" viewBox="0 0 14 14" fill="none" className="shrink-0" style={{ opacity: 0.8, marginTop: 1 }}>
              <circle cx="7" cy="7" r="6.25" stroke="rgba(100,140,220,0.8)" strokeWidth="0.75" fill="none"/>
              <path d="M7 0.75 A6.25 6.25 0 0 0 7 13.25 A3.125 3.125 0 0 1 7 6.875 A3.125 3.125 0 0 0 7 0.75Z" fill="rgba(100,140,220,0.8)"/>
              <circle cx="7" cy="3.875" r="1.3" fill="rgba(100,140,220,0.8)"/>
              <circle cx="7" cy="10.125" r="1.3" fill="rgba(19,18,17,1)" stroke="rgba(100,140,220,0.45)" strokeWidth="0.5"/>
            </svg>
            <div className="text-[13px]" style={{ color: 'rgba(200,195,185,0.82)' }}>{balanceWarning}</div>
          </div>
        </div>
      )}
      {deadlineWarning && (
        <div
          style={{
            border: 'none',
            borderLeft: '2px solid rgba(190,90,55,0.6)',
            borderRadius: 0,
            background: 'rgba(190,90,55,0.04)',
            padding: '10px 12px',
          }}
        >
          <div className="flex gap-[11px] items-start">
            <svg width="20" height="20" viewBox="0 0 12 16" fill="none" className="shrink-0" style={{ opacity: 0.8, marginTop: 1 }}>
              <path d="M6 15C9.314 15 11 12.8 11 10.5C11 8.5 9.5 7 9.5 7C9.5 7 9.2 9 7.5 9C7.5 9 9 7.5 7.5 4.5C7 3.5 6.2 2.2 6 1C6 1 3 3.5 3 7C3 7 2 6 2 4.5C2 4.5 1 6 1 8.5C1 12 3.2 15 6 15Z" fill="rgba(210,100,55,0.8)"/>
              <path d="M6 15C7.657 15 8.5 13.8 8.5 12.5C8.5 11.3 7.5 10.5 7.5 10.5C7.5 10.5 7.3 11.5 6.5 11.5C6.5 11.5 7.2 10.8 6.5 9C6.5 9 5 10.2 5 12C5 13.5 5.2 15 6 15Z" fill="rgba(240,180,100,0.65)"/>
            </svg>
            <div className="text-[13px]" style={{ color: 'rgba(200,195,185,0.82)' }}>{deadlineWarning}</div>
          </div>
        </div>
      )}
    </div>
  );
}
