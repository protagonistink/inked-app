import { useEffect, useMemo, useState } from 'react';
import { addDays, format, isSameDay } from 'date-fns';
import { Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { deriveDayCommitInfo } from '@/hooks/useDayCommitState';
import { eventToBlock } from '@/lib/planner';

interface DayRowMetrics {
  focusHours: number;
}

export function DaySwitcherDropdown({ onSelect }: { onSelect?: () => void }) {
  const { viewDate, setViewDate, getDailyPlanForDate, plannedTasks, workdayEnd } = useApp();
  const today = useMemo(() => new Date(), []);
  const todayKey = format(today, 'yyyy-MM-dd');
  const rows = useMemo(() => Array.from({ length: 5 }, (_, index) => addDays(today, index - 2)), [today]);
  const [rowMetrics, setRowMetrics] = useState<Record<string, DayRowMetrics>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      const results = await Promise.all(
        rows.map(async (rowDate) => {
          const dateKey = format(rowDate, 'yyyy-MM-dd');
          try {
            const response = await window.api.gcal.getEvents(dateKey);
            if (!response.success || !response.data) {
              return [dateKey, { focusHours: 0 }] as const;
            }

            const focusMinutes = response.data
              .map((event) => eventToBlock(event, plannedTasks))
              .filter((block): block is NonNullable<ReturnType<typeof eventToBlock>> => Boolean(block))
              .filter((block) => block.kind === 'focus')
              .reduce((sum, block) => sum + block.durationMins, 0);

            return [dateKey, { focusHours: focusMinutes / 60 }] as const;
          } catch {
            return [dateKey, { focusHours: 0 }] as const;
          }
        })
      );

      if (!cancelled) {
        setRowMetrics(Object.fromEntries(results));
      }
    }

    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, [plannedTasks, rows]);

  return (
    <div
      className="absolute left-0 top-full z-30 mt-3 min-w-[220px] overflow-hidden rounded-[4px] border shadow-[0_4px_12px_rgba(0,0,0,0.3)] animate-fade-in"
      style={{
        background: '#1A1A1A',
        borderColor: 'rgba(255,255,255,0.08)',
        animationDuration: '80ms',
        animationTimingFunction: 'ease-out',
      }}
    >
      <div className="py-2">
        {rows.map((rowDate) => {
          const rowPlan = getDailyPlanForDate(rowDate);
          const rowTasks = plannedTasks.filter((task) => rowPlan.committedTaskIds.includes(task.id));
          const info = deriveDayCommitInfo({
            scheduleBlocks: [],
            plannedTasks: rowTasks,
            dailyPlan: rowPlan,
            viewDate: rowDate,
            workdayEnd,
            currentMinute: 0,
          });
          const isToday = isSameDay(rowDate, today);
          const isActive = isSameDay(rowDate, viewDate);
          const focusHours = rowMetrics[rowPlan.date]?.focusHours ?? 0;
          const hoursLabel = focusHours > 0 ? `${Math.round(focusHours * 10) / 10}h` : '';

          let indicator: JSX.Element | string | null = null;
          let indicatorColor = 'rgba(156,158,162,0.72)';
          const rowKey = format(rowDate, 'yyyy-MM-dd');

          if (isToday && rowPlan.committedTaskIds.length === 0) {
            indicator = (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-warm" />
                <span>today</span>
              </span>
            );
            indicatorColor = '#E55547';
          } else if (hoursLabel) {
            indicator = (
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3 w-3" />
                <span>{hoursLabel}</span>
              </span>
            );
            indicatorColor = info.state === 'closed' ? 'rgba(156,158,162,0.45)' : 'rgba(156,158,162,0.72)';
          } else if (rowKey < todayKey) {
            indicator = <span>—</span>;
            indicatorColor = 'rgba(156,158,162,0.45)';
          }

          return (
            <button
              key={rowPlan.date}
              onClick={() => {
                setViewDate(rowDate);
                onSelect?.();
              }}
              className="flex w-full items-center justify-between px-4 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              style={{
                background: isActive ? 'rgba(250,250,250,0.05)' : 'transparent',
                borderLeft: isToday ? '2px solid rgba(229,85,71,0.85)' : '2px solid transparent',
              }}
            >
              <span className="text-[13px]" style={{ color: '#D2D6DB' }}>
                {format(rowDate, 'EEE, MMM d')}
              </span>
              <span
                className="text-[12px]"
                style={{ color: indicatorColor }}
              >
                {indicator}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
