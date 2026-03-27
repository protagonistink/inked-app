import { useGravityContext } from '@/context/GravityContext';
import { usePlanner } from '@/context/AppContext';
import { cn } from '@/lib/utils';

export function GravityPrompt() {
  const { active, staleGoalId, staleGoalTitle, daysSinceActivity } = useGravityContext();
  const { plannedTasks } = usePlanner();

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
