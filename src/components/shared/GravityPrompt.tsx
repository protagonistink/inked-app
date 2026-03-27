import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { useGravityContext } from '@/context/GravityContext';
import { usePlanner } from '@/context/AppContext';
import { cn } from '@/lib/utils';

export function GravityPrompt() {
  const { active, staleGoalId, staleGoalTitle, daysSinceActivity } = useGravityContext();
  const { plannedTasks } = usePlanner();

  const [yesterdayAnarchy, setYesterdayAnarchy] = useState(false);

  useEffect(() => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    void window.api.store.get('gravityAnarchyDates').then((raw) => {
      const dates = raw as string[] | undefined;
      if (dates?.includes(yesterday)) setYesterdayAnarchy(true);
    });
  }, []);

  if (!active || !staleGoalId || !staleGoalTitle) return null;

  // Find the oldest uncommitted task under the stale intention
  const targetTask = plannedTasks
    .filter((t) => t.weeklyGoalId === staleGoalId && t.status !== 'done' && t.status !== 'cancelled')
    .sort((a, b) => {
      const aDate = a.lastCommittedDate ?? '0000';
      const bDate = b.lastCommittedDate ?? '0000';
      return aDate.localeCompare(bDate);
    })[0];

  const handleStartTimer = async () => {
    if (!targetTask) return;
    await window.api.pomodoro.start(targetTask.id, targetTask.title);
  };

  const dayLabel = daysSinceActivity === 1
    ? 'yesterday'
    : `${daysSinceActivity} days`;

  return (
    <div className="px-6 py-5 border-b border-border-subtle">
      {yesterdayAnarchy && (
        <p className="text-[11px] uppercase tracking-[0.14em] text-text-muted mb-2">
          Day {daysSinceActivity}. Yesterday was anarchy.
        </p>
      )}
      <p className="font-display text-[16px] text-text-emphasis leading-relaxed">
        It's been {dayLabel} since you touched{' '}
        <span className="font-semibold">{staleGoalTitle}</span>.
        {' '}Everything else is on hold until you do.
      </p>
      {targetTask && (
        <button
          onClick={() => void handleStartTimer()}
          className={cn(
            'mt-3 px-4 py-2 rounded-md text-[12px] uppercase tracking-[0.12em] font-medium',
            'bg-text-primary text-bg transition-opacity hover:opacity-80'
          )}
        >
          Start: {targetTask.title}
        </button>
      )}
    </div>
  );
}
