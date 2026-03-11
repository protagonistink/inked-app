import { useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { useTheme, type ThemeMode } from '@/context/ThemeContext';

const FOCUS_TARGET_MINS = 240; // 4 hours = full momentum
const TICK_MS = 60_000; // update every 60s

// ── Time-of-day palette ────────────────────────────────────
// Maps timeProgress (0–1) to gradient parameters.
// 0 = 6 AM, 0.5 ≈ noon, 0.75 ≈ golden hour, 1 = workday end.

interface TimeSlice {
  warmHue: number;
  coolHue: number;
  warmX: number;
  warmY: number;
  coolX: number;
  coolY: number;
  warmOpacity: number;
  coolOpacity: number;
}

const TIME_KEYFRAMES: [number, TimeSlice][] = [
  [0.0,  { warmHue: 30,  coolHue: 210, warmX: 12, warmY: 8,  coolX: 88, coolY: 92, warmOpacity: 0.10, coolOpacity: 0.10 }],
  [0.25, { warmHue: 38,  coolHue: 200, warmX: 28, warmY: 6,  coolX: 75, coolY: 88, warmOpacity: 0.12, coolOpacity: 0.12 }],
  [0.5,  { warmHue: 42,  coolHue: 190, warmX: 46, warmY: 5,  coolX: 55, coolY: 85, warmOpacity: 0.14, coolOpacity: 0.10 }],
  [0.75, { warmHue: 28,  coolHue: 210, warmX: 65, warmY: 8,  coolX: 40, coolY: 90, warmOpacity: 0.20, coolOpacity: 0.12 }],
  [1.0,  { warmHue: 220, coolHue: 210, warmX: 85, warmY: 10, coolX: 30, coolY: 88, warmOpacity: 0.08, coolOpacity: 0.14 }],
];

// ── Theme opacity ceilings ─────────────────────────────────

const THEME_CEILINGS: Record<ThemeMode, { warm: number; cool: number; bloom: number; satMult: number }> = {
  dark:  { warm: 1.0,  cool: 1.0,  bloom: 1.0,  satMult: 1.0 },
  light: { warm: 0.55, cool: 0.55, bloom: 0.5,  satMult: 0.7 },
  focus: { warm: 0.6,  cool: 0.4,  bloom: 0.5,  satMult: 0.5 },
};

// ── Interpolation helpers ──────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpSlice(a: TimeSlice, b: TimeSlice, t: number): TimeSlice {
  return {
    warmHue:     lerp(a.warmHue, b.warmHue, t),
    coolHue:     lerp(a.coolHue, b.coolHue, t),
    warmX:       lerp(a.warmX, b.warmX, t),
    warmY:       lerp(a.warmY, b.warmY, t),
    coolX:       lerp(a.coolX, b.coolX, t),
    coolY:       lerp(a.coolY, b.coolY, t),
    warmOpacity: lerp(a.warmOpacity, b.warmOpacity, t),
    coolOpacity: lerp(a.coolOpacity, b.coolOpacity, t),
  };
}

function sampleTimeline(progress: number): TimeSlice {
  const t = Math.max(0, Math.min(1, progress));
  for (let i = 0; i < TIME_KEYFRAMES.length - 1; i++) {
    const [t0, s0] = TIME_KEYFRAMES[i];
    const [t1, s1] = TIME_KEYFRAMES[i + 1];
    if (t >= t0 && t <= t1) {
      const local = (t - t0) / (t1 - t0);
      return lerpSlice(s0, s1, local);
    }
  }
  return TIME_KEYFRAMES[TIME_KEYFRAMES.length - 1][1];
}

// ── Hook ───────────────────────────────────────────────────

export function useAtmosphere(containerRef: React.RefObject<HTMLDivElement | null>) {
  const { timeLogs, workdayEnd } = useApp();
  const { mode } = useTheme();

  // Stable refs for values that change but shouldn't re-trigger the effect
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const timeLogsRef = useRef(timeLogs);
  timeLogsRef.current = timeLogs;
  const workdayEndRef = useRef(workdayEnd);
  workdayEndRef.current = workdayEnd;

  // ── Cursor tracking (normalized 0–1) ──
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef(0);

  const computeAndApply = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const now = new Date();
    const currentMode = modeRef.current;
    const currentTimeLogs = timeLogsRef.current;
    const currentWorkdayEnd = workdayEndRef.current;

    // ── Time progress (0–1): 6 AM → workday end ──
    const dayStartMins = 6 * 60; // 6 AM
    const dayEndMins = currentWorkdayEnd.hour * 60 + currentWorkdayEnd.min;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const timeProgress = Math.max(0, Math.min(1, (nowMins - dayStartMins) / (dayEndMins - dayStartMins)));

    // ── Focus momentum (0–1): today's focus mins / 240 target ──
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayFocusMins = currentTimeLogs
      .filter((log) => log.startedAt.startsWith(todayStr))
      .reduce((sum, log) => sum + log.durationMins, 0);
    const focusMomentum = Math.min(1, todayFocusMins / FOCUS_TARGET_MINS);

    // ── Sample timeline palette ──
    const slice = sampleTimeline(timeProgress);
    const ceiling = THEME_CEILINGS[currentMode];

    // ── Focus momentum modifiers ──
    const saturationBoost = 1 + focusMomentum * 0.25; // up to +25%
    const opacityBoost = 1 + focusMomentum * 0.15; // up to +15%

    // ── Cursor influence: warm gradient drifts 20% toward mouse ──
    const cursorWarmX = lerp(slice.warmX, mouseRef.current.x * 100, 0.20);
    const cursorWarmY = lerp(slice.warmY, mouseRef.current.y * 100, 0.20);

    // ── Apply CSS custom properties ──
    const set = (prop: string, value: number) => el.style.setProperty(prop, String(value));

    set('--atm-warm-x', cursorWarmX);
    set('--atm-warm-y', cursorWarmY);
    set('--atm-cool-x', slice.coolX);
    set('--atm-cool-y', slice.coolY);
    set('--atm-warm-hue', slice.warmHue);
    set('--atm-cool-hue', slice.coolHue);
    set('--atm-saturation', Math.min(100, 60 * saturationBoost * ceiling.satMult));
    set('--atm-warm-opacity', Math.min(0.25, slice.warmOpacity * opacityBoost * ceiling.warm));
    set('--atm-cool-opacity', Math.min(0.20, slice.coolOpacity * opacityBoost * ceiling.cool));
    set('--atm-bloom-opacity', Math.min(0.15, focusMomentum * 0.12 * ceiling.bloom));
  }, [containerRef]);

  // ── Mousemove listener (throttled via rAF) ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => {
      if (rafRef.current) return; // throttle: skip if rAF pending
      rafRef.current = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        mouseRef.current = {
          x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
          y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
        };
        computeAndApply();
        rafRef.current = 0;
      });
    };

    // Listen on window so cursor works even over child panels
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef, computeAndApply]);

  // Run immediately + every 60s
  useEffect(() => {
    computeAndApply();
    const interval = setInterval(computeAndApply, TICK_MS);
    return () => clearInterval(interval);
  }, [computeAndApply]);

  // Re-run when theme changes (instant update, no waiting for tick)
  useEffect(() => {
    computeAndApply();
  }, [mode, computeAndApply]);
}
