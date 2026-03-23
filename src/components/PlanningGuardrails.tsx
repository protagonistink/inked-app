import { useEffect, useState } from 'react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { UserPhysics } from '@/types/electron';

function formatTimeShort(h: number, m: number): string {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const GOAL_COLORS = [
  'rgba(229,85,71,0.5)',
  'rgba(74,109,140,0.45)',
  'rgba(145,159,174,0.35)',
];

export function PlanningGuardrails({ onShowBriefing }: { onShowBriefing?: () => void }) {
  const { scheduleBlocks, workdayStart, workdayEnd, countdowns, weeklyGoals, dayCommitInfo, candidateItems, viewDate, dailyPlan } = useApp();
  const [physics, setPhysics] = useState<UserPhysics | null>(null);

  useEffect(() => {
    window.api.physics.get().then((r) => setPhysics(r.physics));
  }, []);

  // --- Day Capacity (state-conditional) ---
  const { state: dayState, focusMins, openMins, totalBlocks, completedBlocks, completedFocusMins, minutesPastClose, hadBlocks } = dayCommitInfo;
  const totalMins =
    workdayEnd.hour * 60 + workdayEnd.min - (workdayStart.hour * 60 + workdayStart.min);
  const hardMins = scheduleBlocks
    .filter((b) => b.kind === 'hard')
    .reduce((s, b) => s + b.durationMins, 0);
  const plannedFocusMins = focusMins + hardMins;
  const percent = totalMins > 0 ? (plannedFocusMins / totalMins) * 100 : 0;

  const focusHoursLabel = Math.round(focusMins / 60 * 10) / 10;
  const openHoursLabel = Math.round(openMins / 60 * 10) / 10;
  const completedHoursLabel = Math.round(completedFocusMins / 60 * 10) / 10;
  const pastCloseH = Math.floor(minutesPastClose / 60);
  const pastCloseM = minutesPastClose % 60;

  let statusLine: string;
  let focusLabel: string;
  let showCapacityBar = true;
  let showPastClose = false;

  if (dayState === 'briefing') {
    focusLabel = 'Ready to commit';
    statusLine = `${formatTimeShort(workdayStart.hour, workdayStart.min)} – ${formatTimeShort(workdayEnd.hour, workdayEnd.min)} · Day uncommitted`;
  } else if (dayState === 'committed') {
    focusLabel = focusMins > 0 ? `${focusHoursLabel}h focus` : 'Committed';
    statusLine = focusMins > 0
      ? `${focusHoursLabel}h committed · ${openHoursLabel}h open`
      : `${dailyPlan.committedTaskIds.length} task${dailyPlan.committedTaskIds.length === 1 ? '' : 's'} committed`;
  } else if (!hadBlocks) {
    // closed, never committed
    focusLabel = 'Day uncommitted';
    statusLine = `${formatTimeShort(workdayStart.hour, workdayStart.min)} – ${formatTimeShort(workdayEnd.hour, workdayEnd.min)} · Day uncommitted`;
    showCapacityBar = false;
  } else if (completedBlocks >= totalBlocks) {
    // closed, all done
    focusLabel = `${completedHoursLabel}h focused`;
    statusLine = `Day closed — ${completedHoursLabel}h focused`;
    showCapacityBar = false;
  } else {
    // closed, incomplete
    focusLabel = `${completedBlocks} of ${totalBlocks} blocks`;
    statusLine = `${completedBlocks} of ${totalBlocks} blocks complete`;
    showPastClose = minutesPastClose > 0;
    showCapacityBar = false;
  }

  // --- Awareness ---
  const today = new Date();
  const hardBlocks = scheduleBlocks.filter((b) => b.kind === 'hard');

  const countdownItems = countdowns.map((c) => {
    const daysUntil = differenceInCalendarDays(parseISO(c.dueDate), today);
    let dotColor: string;
    let subtitle: string;
    if (daysUntil <= 0) {
      dotColor = '#E55547';
      subtitle = 'Today';
    } else if (daysUntil === 1) {
      dotColor = '#E8825A';
      subtitle = 'Tomorrow';
    } else {
      dotColor = '#A1ADB8';
      subtitle = `${daysUntil} days`;
    }
    return { title: c.title, dotColor, subtitle };
  });

  const hardBlockItems = hardBlocks.map((b) => ({
    title: b.title,
    dotColor: '#E8825A',
    subtitle: `${formatTimeShort(b.startHour, b.startMin)} · Calendar`,
  }));

  const awarenessItems = [...countdownItems, ...hardBlockItems];

  return (
    <aside className="w-[240px] flex-shrink-0 flex flex-col border-l border-[rgba(250,250,250,0.07)] overflow-y-auto relative">
      <div className="px-5 pt-6">
        {/* Day Capacity */}
        <div>
          <span className="section-lbl">Day Capacity</span>
          <p className="font-sans text-[12px] text-[#FAFAFA]/55 mt-2">
            {format(viewDate, 'EEEE, MMMM d')}
          </p>
          <p className="font-sans text-[11px] text-[#475569] mt-1">
            {formatTimeShort(workdayStart.hour, workdayStart.min)} –{' '}
            {formatTimeShort(workdayEnd.hour, workdayEnd.min)} ·{' '}
            <span className="text-[#ff9786]/65">{focusLabel}</span>
          </p>
          {showCapacityBar && (
            <div className="capacity-track mt-2">
              <div
                className="capacity-fill"
                style={{
                  width: `${Math.min(percent, 100)}%`,
                  background:
                    percent > 90 ? 'rgba(245,158,11,0.7)' : 'oklch(55% 0.10 155)',
                }}
              />
            </div>
          )}
          {dayState !== 'briefing' && (
            <p className="font-sans text-[11px] mt-2" style={{ color: percent > 100 ? 'rgba(245,158,11,0.7)' : 'oklch(55% 0.10 155)' }}>
              {statusLine}
            </p>
          )}
          {showPastClose && (
            <p className="font-sans text-[11px] mt-1 text-[rgba(245,158,11,0.7)]">
              {pastCloseH > 0 ? `${pastCloseH}h ` : ''}{pastCloseM}m past close
            </p>
          )}
        </div>

        {/* Queue Depth */}
        {candidateItems.length > 0 && (
          <p className="font-sans text-[11px] text-[rgba(148,163,184,0.6)] mt-3">
            Queue: {candidateItems.length} items
          </p>
        )}

        {/* Your Rhythms */}
        {physics && (
          <div className="mt-9">
            <span className="section-lbl">YOUR RHYTHMS</span>
            <div className="mt-2 space-y-1.5">
              <p className="text-[11px] text-[rgba(148,163,184,0.6)] leading-snug">
                Peak Energy: {physics.peakEnergyWindow}
              </p>
              <p className="text-[11px] text-[rgba(148,163,184,0.6)] leading-snug">
                Focus Limit: {physics.focusBlockLength} mins
              </p>
              {physics.planningStyle && (
                <p className="font-display italic text-[11px] text-[rgba(148,163,184,0.4)] leading-snug line-clamp-3">
                  {physics.planningStyle}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Awareness */}
        {awarenessItems.length > 0 && (
          <div className="mt-9">
            <span className="section-lbl">Awareness</span>
            <div className="mt-2 space-y-2.5">
              {awarenessItems.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div
                    className="w-[4px] h-[4px] rounded-full mt-[5px] flex-shrink-0"
                    style={{ background: item.dotColor }}
                  />
                  <div>
                    <p className="font-sans text-[12px] text-[#FAFAFA]/55">{item.title}</p>
                    <span className="font-sans text-[10px] text-text-muted/30">
                      {item.subtitle}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* This Week's Threads */}
        {weeklyGoals.length > 0 && (
          <div className="mt-9">
            <span className="section-lbl">This week's threads</span>
            <div className="mt-2 space-y-2">
              {weeklyGoals.map((goal, i) => (
                <div key={goal.id} className="flex items-center gap-2.5">
                  <div
                    className="w-[5px] h-[5px] rounded-sm flex-shrink-0"
                    style={{ background: GOAL_COLORS[i % GOAL_COLORS.length] }}
                  />
                  <span className="font-sans text-[13px] text-[#FAFAFA]/55 leading-tight line-clamp-2">{goal.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-8" />

      {/* Ink FAB */}
      <div className="px-5 pb-5 flex justify-end">
        <button
          onClick={onShowBriefing}
          className="ink-fab"
          title="Ask Ink"
          style={{ width: 40, height: 40 }}
        >
          <Sparkles className="w-[18px] h-[18px] text-accent-warm" />
        </button>
      </div>
    </aside>
  );
}
