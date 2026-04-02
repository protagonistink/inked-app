import { withAlpha } from '@/lib/goalColors';

interface Intention {
  title: string;
  color: string;
  totalTasks?: number;
  doneTasks?: number;
}

interface IntentionsSummaryProps {
  intentions: Intention[];
}

export function IntentionsSummary({ intentions }: IntentionsSummaryProps) {
  if (intentions.length === 0) return null;

  return (
    <div className="space-y-3.5 select-none">
      {intentions.map((intention, i) => {
        const total = intention.totalTasks ?? 0;
        const done = intention.doneTasks ?? 0;
        const ratio = total > 0 ? done / total : 0;
        const hasProgress = done > 0;

        return (
          <div
            key={i}
            className="rounded-md border border-border-subtle bg-surface/40 px-3 py-3"
            style={{ borderLeftWidth: 2, borderLeftColor: withAlpha(intention.color, hasProgress ? 0.85 : 0.5) }}
          >
            <div className="min-w-0">
              <span className="block text-[12px] leading-snug text-text-secondary line-clamp-2">
                {intention.title}
              </span>
              {total > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="h-[5px] flex-1 overflow-hidden rounded-full"
                    style={{ background: withAlpha(intention.color, 0.12) }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${ratio * 100}%`,
                        background: intention.color,
                      }}
                    />
                  </div>
                  <span
                    className="shrink-0 text-[11px] font-medium tabular-nums"
                    style={{ color: intention.color }}
                  >
                    {done}/{total}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
