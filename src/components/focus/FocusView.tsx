import { useState, useEffect, useMemo, useRef } from 'react';
import { usePlanner } from '@/context/AppContext';
import { useTheme } from '@/context/ThemeContext';
import type { PomodoroState } from '@/types';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type FocusPhase = 'initiation' | 'active' | 'paused' | 'concluded';

const DURATION_OPTIONS = [
  { label: '15m', value: 15 },
  { label: '25m', value: 25 },
  { label: '45m', value: 45 },
  { label: '75m', value: 75 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Aperture Rings ───────────────────────────────────────────────────────────
// SVG handles only the ring geometry + progress arc.
// Timer text is overlaid as a React element for full design-system control.

function ApertureRings({ progress }: { progress: number }) {
  const cx = 300;
  const cy = 300;
  const outerRings = [276, 241, 206, 171];
  const arcR = 136;
  const circumference = 2 * Math.PI * arcR;
  const dashOffset = circumference * (1 - Math.min(Math.max(progress, 0), 1));
  const ringStroke = 'rgba(255,255,255,0.04)'; // ≈ --color-border-subtle

  return (
    <svg
      viewBox="0 0 600 600"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      {/* Structural crosshairs */}
      <line x1="0" y1="300" x2="600" y2="300" stroke={ringStroke} strokeWidth="1" />
      <line x1="300" y1="0" x2="300" y2="600" stroke={ringStroke} strokeWidth="1" />

      {/* Concentric rings */}
      {outerRings.map((r) => (
        <circle key={r} cx={cx} cy={cy} r={r} fill="none" stroke={ringStroke} strokeWidth="1" />
      ))}

      {/* Arc track */}
      <circle
        cx={cx}
        cy={cy}
        r={arcR}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="1"
      />

      {/* Progress arc — uses CSS variable so it honours any future theme changes */}
      <circle
        cx={cx}
        cy={cy}
        r={arcR}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{
          stroke: 'var(--color-accent-warm)',
          opacity: 0.75,
          transition: 'stroke-dashoffset 1s linear',
        }}
      />
    </svg>
  );
}

// ─── Initiation ───────────────────────────────────────────────────────────────

interface InitiationProps {
  taskTitle: string;
  selectedDuration: number;
  onSelectDuration: (v: number) => void;
  onBegin: () => void;
}

function InitiationScreen({
  taskTitle,
  selectedDuration,
  onSelectDuration,
  onBegin,
}: InitiationProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-7 px-12 text-center">
      {/* Pre-label */}
      <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-text-muted select-none">
        your intention
      </p>

      {/* Task title — the hero moment of initiation. Cormorant italic reads like
          a manuscript title: weighty, literary, personal. */}
      <h1
        className="font-serif italic text-text-emphasis leading-[1.05] max-w-2xl"
        style={{ fontSize: 'clamp(32px, 4.5vw, 56px)' }}
      >
        {taskTitle}
      </h1>

      {/* Duration selector */}
      <div className="flex flex-col items-center gap-3 mt-1">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-text-whisper select-none">
          duration
        </p>
        <div className="flex items-center gap-2">
          {DURATION_OPTIONS.map(({ label, value }) => {
            const sel = selectedDuration === value;
            return (
              <button
                key={value}
                onClick={() => onSelectDuration(value)}
                className={cn(
                  'font-mono text-[9px] tracking-[0.1em] px-2.5 py-1.5 rounded-[2px] border transition-all duration-150 cursor-pointer',
                  sel
                    ? 'border-accent-warm/50 bg-accent-warm/10 text-accent-warm'
                    : 'border-border text-text-muted hover:border-border-hover hover:text-text-secondary'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Begin — rust-accented, quiet. Earns attention without demanding it. */}
      <button
        onClick={onBegin}
        className="font-mono text-[11px] tracking-[0.22em] uppercase border border-accent-warm/30 text-accent-warm/70 hover:border-accent-warm/60 hover:text-accent-warm hover:bg-accent-warm/5 px-12 py-3 rounded-[2px] transition-all duration-150 cursor-pointer mt-1"
      >
        Begin
      </button>

      <p className="font-mono text-[9px] tracking-[0.14em] text-text-whisper select-none">
        esc to cancel
      </p>
    </div>
  );
}

// ─── Active ───────────────────────────────────────────────────────────────────

interface ActiveProps {
  timerState: PomodoroState | null;
  elapsedSeconds: number;
  taskIndex: number;
  totalTasks: number;
  onEnd: () => void;
}

function ActiveScreen({
  timerState,
  elapsedSeconds,
  taskIndex,
  totalTasks,
  onEnd,
}: ActiveProps) {
  const progress =
    timerState && timerState.totalTime > 0
      ? 1 - timerState.timeRemaining / timerState.totalTime
      : 0;
  const timerDisplay = timerState ? formatTimer(timerState.timeRemaining) : '00:00';

  return (
    <>
      {/* Corner anchors — real data only, minimal presence */}
      <div className="absolute top-7 left-8 leading-snug select-none">
        <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-text-whisper">Task</p>
        <p className="font-mono text-[12px] tracking-[0.04em] text-text-muted">
          {taskIndex} of {totalTasks}
        </p>
      </div>

      <div className="absolute top-7 right-8 text-right leading-snug select-none">
        <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-text-whisper">
          Elapsed
        </p>
        <p className="font-mono text-[12px] tracking-[0.04em] text-text-muted tabular-nums">
          {formatElapsed(elapsedSeconds)}
        </p>
      </div>

      {/* Aperture gauge — the rhythm of the session */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative"
          style={{ width: 'min(560px, 76vh)', height: 'min(560px, 76vh)' }}
        >
          <ApertureRings progress={progress} />

          {/* Timer — the center of everything */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 select-none">
            <span className={cn(
              'font-mono text-[9px] tracking-[0.3em] uppercase',
              timerState?.isBreak ? 'text-sky-300/60' : 'text-accent-warm/60'
            )}>
              {timerState?.isBreak ? 'break' : 'focusing'}
            </span>
            <span
              className="font-mono font-light text-text-emphasis tabular-nums leading-none"
              style={{ fontSize: 'clamp(48px, 7.5vw, 72px)' }}
            >
              {timerDisplay}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom affordances — whisper-quiet until needed */}
      <div className="absolute bottom-7 left-0 right-0 flex justify-center items-center gap-5 select-none">
        {timerState?.isBreak ? (
          <>
            <button
              onClick={() => void window.api.pomodoro.extendBreak(5)}
              className="font-mono text-[9px] tracking-[0.12em] text-text-whisper hover:text-text-muted transition-colors duration-150 cursor-pointer"
            >
              +5 min
            </button>
            <span className="text-text-whisper" aria-hidden>·</span>
            <button
              onClick={() => void window.api.pomodoro.skip()}
              className="font-mono text-[9px] tracking-[0.12em] text-text-whisper hover:text-text-muted transition-colors duration-150 cursor-pointer"
            >
              skip break
            </button>
            <span className="text-text-whisper" aria-hidden>·</span>
            <button
              onClick={onEnd}
              className="font-mono text-[9px] tracking-[0.12em] text-text-whisper hover:text-text-muted transition-colors duration-150 cursor-pointer"
            >
              end session
            </button>
          </>
        ) : (
          <>
            <p className="font-mono text-[9px] tracking-[0.12em] text-text-whisper">space to pause</p>
            <span className="text-text-whisper" aria-hidden>·</span>
            <button
              onClick={onEnd}
              className="font-mono text-[9px] tracking-[0.12em] text-text-whisper hover:text-text-muted transition-colors duration-150 cursor-pointer"
            >
              end session
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ─── Paused ───────────────────────────────────────────────────────────────────

interface PausedProps {
  elapsedSeconds: number;
  goalTitle?: string;
  onResume: () => void;
}

function PausedScreen({ elapsedSeconds, goalTitle, onResume }: PausedProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center px-12">
      {/* "Paused." — Cormorant italic. Lowercase with period.
          This is an editorial pause, not a system halt. */}
      <h1
        className="font-serif italic text-text-emphasis leading-none select-none"
        style={{ fontSize: 'clamp(48px, 7vw, 72px)' }}
      >
        Paused.
      </h1>

      {/* Context */}
      <p className="font-mono text-[11px] tracking-[0.14em] text-text-muted tabular-nums">
        {formatElapsed(elapsedSeconds)} elapsed
      </p>

      {goalTitle && (
        <p className="font-serif italic text-text-secondary text-[16px] select-none">
          {goalTitle}
        </p>
      )}

      {/* Resume — plain, unaccented. The rust stays in reserve for Begin. */}
      <button
        onClick={onResume}
        className="font-mono text-[11px] tracking-[0.22em] uppercase border border-border hover:border-border-hover text-text-muted hover:text-text-primary px-10 py-3 rounded-[2px] transition-all duration-150 cursor-pointer mt-2"
      >
        Resume
      </button>

      <p className="font-mono text-[9px] tracking-[0.14em] text-text-whisper select-none">
        space to resume · esc to exit
      </p>
    </div>
  );
}

// ─── Concluded ────────────────────────────────────────────────────────────────

interface ConcludedProps {
  elapsedSeconds: number;
  taskTitle: string;
  taskDone: boolean;
  taskIndex: number;
  totalTasks: number;
  onToggleDone: () => Promise<void>;
  onExit: () => void;
}

function ConcludedScreen({
  elapsedSeconds,
  taskTitle,
  taskDone,
  taskIndex,
  totalTasks,
  onToggleDone,
  onExit,
}: ConcludedProps) {
  const [isStruck, setIsStruck] = useState(taskDone);

  useEffect(() => {
    setIsStruck(taskDone);
  }, [taskDone]);

  const elapsedMins = Math.floor(elapsedSeconds / 60);
  const elapsedSecs = elapsedSeconds % 60;

  async function handleToggleDone() {
    setIsStruck((prev) => !prev);
    await onToggleDone();
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-7 text-center px-12">
      {/* Corner anchor — session position */}
      <div className="absolute top-7 left-8 leading-snug select-none">
        <p className="font-mono text-[9px] tracking-[0.14em] uppercase text-text-whisper">Session</p>
        <p className="font-mono text-[12px] tracking-[0.04em] text-text-muted">
          {taskIndex} of {totalTasks}
        </p>
      </div>

      {/* "Done." — definitive. Cormorant upright, no italic.
          This is a closing statement, not a feeling. */}
      <h1
        className="font-serif text-text-emphasis leading-none select-none"
        style={{ fontSize: 'clamp(48px, 6vw, 64px)' }}
      >
        Done.
      </h1>

      {/* Duration — editorial stat label + large number */}
      <div className="flex flex-col items-center gap-1.5 select-none">
        <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-text-whisper">
          01 / duration
        </p>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-display font-light text-text-emphasis tabular-nums leading-none"
            style={{ fontSize: 36 }}
          >
            {String(elapsedMins).padStart(2, '0')}
          </span>
          <span className="font-display font-light text-text-muted" style={{ fontSize: 14 }}>m</span>
          <span
            className="font-display font-light text-text-emphasis tabular-nums leading-none"
            style={{ fontSize: 36 }}
          >
            {String(elapsedSecs).padStart(2, '0')}
          </span>
          <span className="font-display font-light text-text-muted" style={{ fontSize: 14 }}>s</span>
        </div>
      </div>

      {/* Thin divider */}
      <div className="w-full max-w-xs h-px" style={{ background: 'var(--color-border-subtle)' }} />

      {/* Task — click to draw a strikethrough and mark done */}
      <button
        onClick={() => void handleToggleDone()}
        className="group flex flex-col items-center gap-2 cursor-pointer"
        aria-label={isStruck ? 'Mark incomplete' : 'Mark done'}
      >
        <div className="relative inline-block">
          <span
            className={cn(
              'font-serif italic leading-snug transition-colors duration-300',
              isStruck
                ? 'text-text-whisper'
                : 'text-text-secondary group-hover:text-text-primary',
            )}
            style={{ fontSize: 17 }}
          >
            {taskTitle}
          </span>

          {/* Hand-drawn strikethrough — SVG line animates across the title */}
          {isStruck && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              preserveAspectRatio="none"
            >
              <line
                x1="0%" y1="54%" x2="100%" y2="52%"
                stroke="rgba(255,255,255,0.38)"
                strokeWidth="1"
                strokeLinecap="round"
                pathLength="1"
                style={{
                  strokeDasharray: '1',
                  animation: 'drawStrike 0.55s ease-out forwards',
                }}
              />
            </svg>
          )}
        </div>

        <span
          className={cn(
            'font-mono text-[9px] tracking-[0.2em] uppercase transition-colors duration-300',
            isStruck
              ? 'text-accent-warm/70'
              : 'text-text-whisper group-hover:text-text-muted',
          )}
        >
          {isStruck ? '● done' : '○ mark done'}
        </span>
      </button>

      {/* Return */}
      <button
        onClick={onExit}
        className="font-mono text-[11px] tracking-[0.18em] uppercase border border-border hover:border-border-hover text-text-muted hover:text-text-primary px-10 py-3 rounded-[2px] transition-all duration-150 cursor-pointer"
      >
        Return to work
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface FocusViewProps {
  taskId: string;
  onExit: () => void;
}

export function FocusView({ taskId, onExit }: FocusViewProps) {
  const { plannedTasks, weeklyGoals, toggleTask } = usePlanner();
  const { enterFocusMode, exitFocusMode } = useTheme();

  const [phase, setPhase] = useState<FocusPhase>('initiation');
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [timerState, setTimerState] = useState<PomodoroState | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Track cumulative elapsed across work/break cycles so the counter doesn't reset
  const cumulativeElapsedRef = useRef(0);
  const prevTimerStateRef = useRef<PomodoroState | null>(null);

  // Ref so keydown closure always reads current phase without stale capture
  const phaseRef = useRef<FocusPhase>('initiation');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const task = useMemo(
    () => plannedTasks.find((t) => t.id === taskId) ?? null,
    [plannedTasks, taskId]
  );
  const linkedGoal = useMemo(() => {
    if (!task?.weeklyGoalId) return null;
    return weeklyGoals.find((g) => g.id === task.weeklyGoalId) ?? null;
  }, [task, weeklyGoals]);
  const taskIndex = useMemo(() => {
    const idx = plannedTasks.findIndex((t) => t.id === taskId);
    return idx >= 0 ? idx + 1 : 1;
  }, [plannedTasks, taskId]);

  // Activate the focus CSS theme (data-theme="focus") for the duration of this screen
  useEffect(() => {
    enterFocusMode();
    return () => exitFocusMode();
  }, [enterFocusMode, exitFocusMode]);

  // IPC tick drives phase transitions
  useEffect(() => {
    const cleanup = window.api.pomodoro.onTick((state) => {
      const prev = prevTimerStateRef.current;

      // Detect break→work transition: show concluded so user can decide to continue or stop
      if (prev?.isBreak && !state.isBreak && state.isRunning) {
        // Accumulate the break duration into cumulative total
        if (prev.totalTime > 0) {
          cumulativeElapsedRef.current += prev.totalTime;
        }
        setPhase('concluded');
      }

      // Detect work→break transition: accumulate work duration
      if (prev && !prev.isBreak && state.isBreak && prev.totalTime > 0) {
        cumulativeElapsedRef.current += prev.totalTime;
      }

      setTimerState(state);
      prevTimerStateRef.current = state;

      if (state.isRunning && !state.isPaused) {
        const currentSegmentElapsed = Math.max(0, state.totalTime - state.timeRemaining);
        setElapsedSeconds(cumulativeElapsedRef.current + currentSegmentElapsed);
        // Only auto-transition to active if not in concluded (user hasn't seen the decision yet)
        setPhase((p) => (p === 'concluded' || p === 'initiation') ? p : 'active');
      } else if (state.isRunning && state.isPaused) {
        setPhase((p) => (p === 'concluded' ? 'concluded' : 'paused'));
      }
    });
    return cleanup;
  }, []);

  // Keyboard: ESC exits; Space toggles pause when active or paused
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onExit();
        return;
      }
      if (e.key === ' ' && (phaseRef.current === 'active' || phaseRef.current === 'paused')) {
        e.preventDefault();
        void window.api.pomodoro.pause();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  async function handleBegin() {
    await window.api.pomodoro.start(taskId, task?.title ?? 'Focus', selectedDuration);
    setPhase('active');
  }

  async function handleEnd() {
    await window.api.pomodoro.stop();
    setPhase('concluded');
  }

  const taskTitle = task?.title ?? 'Focus';
  const taskDone = task?.status === 'done';

  return (
    <div className="fixed inset-0 z-[100] bg-bg overflow-hidden">
      {phase === 'initiation' && (
        <InitiationScreen
          taskTitle={taskTitle}
          selectedDuration={selectedDuration}
          onSelectDuration={setSelectedDuration}
          onBegin={() => void handleBegin()}
        />
      )}

      {phase === 'active' && (
        <ActiveScreen
          timerState={timerState}
          elapsedSeconds={elapsedSeconds}
          taskIndex={taskIndex}
          totalTasks={plannedTasks.length}
          onEnd={() => void handleEnd()}
        />
      )}

      {phase === 'paused' && (
        <PausedScreen
          elapsedSeconds={elapsedSeconds}
          goalTitle={linkedGoal?.title}
          onResume={() => void window.api.pomodoro.pause()}
        />
      )}

      {phase === 'concluded' && (
        <ConcludedScreen
          elapsedSeconds={elapsedSeconds}
          taskTitle={taskTitle}
          taskDone={taskDone}
          taskIndex={taskIndex}
          totalTasks={plannedTasks.length}
          onToggleDone={() => toggleTask(taskId)}
          onExit={timerState?.isRunning ? () => setPhase('active') : onExit}
        />
      )}
    </div>
  );
}
