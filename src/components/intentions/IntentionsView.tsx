import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/context/AppContext';
import { useInkAssistant } from '@/context/InkAssistantContext';
import { useAttentionBalance } from '@/hooks/useWeeklyMode';
import { useFocusHealth } from '@/hooks/useFocusHealth';
import { IntentionHeader } from './IntentionHeader';
import { IntentionCard } from './IntentionCard';
import { TheLedger } from './TheLedger';
import { DistractionTax } from './DistractionTax';
import { WeekMatrix } from './WeekMatrix';
import { InkFab } from '@/components/ink/InkFab';

export function IntentionsView() {
  const { weeklyGoals } = useApp();
  const { openWeeklyPlanningAssistant } = useInkAssistant();
  const attentionData = useAttentionBalance();
  const { focusHealth, distractionCount } = useFocusHealth();
  const [hoveredIntention, setHoveredIntention] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Cinematic entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Dynamic Bleed: interpolate between teal (healthy) and rust (distracted)
  const bleedStyle = useMemo(() => {
    const t = Math.max(0, Math.min(1, focusHealth));
    const r = Math.round(200 + (45 - 200) * t);
    const g = Math.round(60 + (212 - 60) * t);
    const b = Math.round(47 + (191 - 47) * t);
    const opacity = (0.18 - (0.18 - 0.08) * t).toFixed(2);
    return {
      background: `radial-gradient(circle at bottom right, rgba(${r},${g},${b},${opacity}), transparent 60%)`,
      transition: 'background 2s ease',
    };
  }, [focusHealth]);

  return (
    <div className="flex flex-col h-full w-full bg-bg relative">
      {/* macOS title bar drag region */}
      <div
        className="h-12 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Scrollable content with dot grid background */}
      <div
        className={cn(
          'flex-1 overflow-y-auto hide-scrollbar paper-texture transition-all duration-1000 ease-out',
          isLoaded ? 'opacity-100 blur-none' : 'opacity-0 blur-sm'
        )}
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      >
        {/* The Bleed — dynamic gradient driven by focus health */}
        <div
          className="fixed bottom-0 right-0 w-[800px] h-[800px] pointer-events-none z-0 animate-breathe"
          style={bleedStyle}
        />

        {/* Editorial split layout */}
        <div className="w-full max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 pt-12 pb-40 px-8 sm:px-16 relative z-10">
          {/* LEFT COLUMN: Header + intentions */}
          <div className="lg:col-span-7 flex flex-col">
            <IntentionHeader />

            {/* Week Matrix — year context under header */}
            <div className="mb-12">
              <WeekMatrix />
            </div>

            {/* Section header */}
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
                Active Intentions
              </h2>
              <div className="h-[1px] flex-1 bg-white/5" />
              <span className="font-mono text-[10px] text-white/30">
                {weeklyGoals.length} ACTIVE
              </span>
            </div>

            {/* Intention cards */}
            {weeklyGoals.length === 0 ? (
              <div className="flex max-w-xl flex-col gap-5 rounded-[24px] border border-white/6 bg-white/[0.02] px-7 py-8">
                <p className="text-sm text-white/40 italic">
                  No weekly intentions set yet.
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={openWeeklyPlanningAssistant}
                    className="rounded-full border border-accent-warm/35 bg-accent-warm/10 px-5 py-2 text-[11px] uppercase tracking-[0.18em] text-white transition-colors hover:border-accent-warm-hover hover:bg-accent-warm/18"
                  >
                    Plan the week with Ink
                  </button>
                  <span className="text-[12px] text-white/30">
                    This opens the weekly interview, not the old manual flow.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 relative">
                {weeklyGoals.map((goal, i) => {
                  const attention = attentionData.find(
                    (a) => a.goalId === goal.id
                  );
                  if (!attention) return null;

                  return (
                    <IntentionCard
                      key={goal.id}
                      goal={goal}
                      attention={attention}
                      index={i}
                      isHovered={hoveredIntention === i}
                      isAnyHovered={hoveredIntention !== null}
                      onHoverStart={() => setHoveredIntention(i)}
                      onHoverEnd={() => setHoveredIntention(null)}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Financial data + Distraction Tax */}
          <div
            className={cn(
              'lg:col-span-5 flex flex-col gap-10 lg:pt-0 transition-all duration-700 ease-out',
              hoveredIntention !== null && 'opacity-20 blur-[2px]'
            )}
          >
            <TheLedger />
            <DistractionTax distractionCount={distractionCount} />
          </div>
        </div>
      </div>

      <InkFab briefingModeOverride={weeklyGoals.length === 0 ? 'briefing' : 'chat'} />
    </div>
  );
}
