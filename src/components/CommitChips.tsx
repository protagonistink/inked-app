// src/components/CommitChips.tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveGoalColor, withAlpha } from '@/lib/goalColors';
import type { WeeklyGoal } from '@/types';
import type { CommitChip } from '@/components/ink/morningBriefingUtils';

export function CommitChips({
  chips,
  proposalLabel,
  isOverlay,
  weeklyGoals = [],
  onToggle,
  onExecute,
}: {
  chips: CommitChip[];
  proposalLabel: string;
  isOverlay: boolean;
  weeklyGoals?: WeeklyGoal[];
  onToggle: (index: number) => void;
  onExecute: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="text-[10px] uppercase tracking-[0.14em] font-medium px-1" style={{ color: 'var(--color-text-muted)' }}>
        Commit to {proposalLabel}
      </div>
      {chips.map((chip, i) => {
        const goalIdx = weeklyGoals.findIndex((g) => g.id === chip.matchedGoalId);
        const goal = goalIdx >= 0 ? weeklyGoals[goalIdx] : null;
        const goalColor = goal ? resolveGoalColor(goal.color, goalIdx) : null;
        return (
          <button
            key={i}
            onClick={() => onToggle(i)}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 text-left transition-all text-[13px]',
              chip.selected ? 'border' : 'border border-transparent'
            )}
            style={{
              borderRadius: 16,
              borderLeftWidth: 3,
              borderLeftStyle: 'solid',
              borderLeftColor: goalColor
                ? withAlpha(goalColor, chip.selected ? 0.85 : 0.5)
                : chip.selected ? 'var(--color-accent-warm)' : 'var(--color-text-muted)',
              background: chip.selected ? 'rgba(200,60,47,0.15)' : 'var(--color-bg-chip)',
              borderColor: chip.selected ? 'rgba(200,60,47,0.3)' : 'transparent',
              color: chip.selected ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
              style={{
                borderColor: chip.selected ? 'var(--color-accent-warm)' : 'var(--color-text-muted)',
                background: chip.selected ? 'var(--color-accent-warm)' : 'transparent',
              }}
            >
              {chip.selected && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            {goalColor && (
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: withAlpha(goalColor, 0.8) }}
              />
            )}
            <span className="flex-1 min-w-0 truncate">{chip.title}</span>
            {chip.matchedTaskId ? (
              <span className="text-[9px] uppercase tracking-wider font-medium shrink-0" style={{ color: goalColor ? withAlpha(goalColor, 0.7) : 'var(--color-accent-warm)' }}>
                matched
              </span>
            ) : (
              <span className="text-[9px] uppercase tracking-wider font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                new
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={onExecute}
        disabled={chips.every((c) => !c.selected)}
        className={cn('mt-2 rounded-lg text-[13px] font-medium transition-all', isOverlay ? 'px-3.5 py-2' : 'px-4 py-2')}
        style={{
          background: chips.some((c) => c.selected) ? 'var(--color-accent-warm)' : 'var(--color-bg-elevated)',
          color: chips.some((c) => c.selected) ? 'var(--color-text-on-accent)' : 'var(--color-text-muted)',
          cursor: chips.some((c) => c.selected) ? 'pointer' : 'not-allowed',
        }}
      >
        Lock it in
      </button>
    </div>
  );
}
