# Three UI Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the end-of-day drag feedback loop, make Ink chat thread pills clickable, and redesign Focus mode controls.

**Architecture:** Three independent, surgical edits — one per file. No shared state changes, no new components.

**Tech Stack:** React, TypeScript, Tailwind, Lucide icons, Electron IPC (`window.api.pomodoro.start`)

---

### Task 1: End-of-Day Drag Bug Fix

**Files:**
- Modify: `src/components/timeline/Timeline.tsx:401–440`

**Context:**
`beginWorkdayEndDrag` defines `applyBoundary` inside the `useCallback`. `applyBoundary` reads `hourHeight` from the enclosing scope. `hourHeight` is NOT in the `useCallback` deps array — so it's stale from callback creation. Separately, `rect` is recomputed on every `mousemove` via `grid.getBoundingClientRect()` inside `applyBoundary`, which can shift mid-drag.

The fix: at mousedown, capture both `hourHeight` and `rect` into locals, and use those captured values throughout the entire drag.

**Step 1: Read the current function**

Read `src/components/timeline/Timeline.tsx` lines 401–440 to confirm the exact text before editing.

**Step 2: Apply the fix**

Replace `beginWorkdayEndDrag` with:

```ts
const beginWorkdayEndDrag = useCallback((event: React.MouseEvent<HTMLElement>) => {
  event.preventDefault();
  event.stopPropagation();

  const originGrid = gridRef.current;
  if (!originGrid) return;

  const capturedHourHeight = hourHeight;
  const capturedRect = originGrid.getBoundingClientRect();

  let dragged = false;

  const applyBoundary = (clientY: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    const scrollTop = grid.scrollTop;
    const y = clientY - capturedRect.top + scrollTop;
    const rawMinutes = (y / capturedHourHeight) * 60 + dayStartMins;
    const snappedMinutes = snapToCalendarGrid(rawMinutes, GRID_SNAP_MINS);
    const maxVisibleMinutes = Math.max(dayStartMins + 60, visibleDayEndMins);
    const clampedMinutes = Math.min(Math.max(snappedMinutes, dayStartMins + 60), maxVisibleMinutes);
    setWorkdayEnd(Math.floor(clampedMinutes / 60), clampedMinutes % 60);
  };

  function onMove(moveEvent: MouseEvent) {
    dragged = true;
    applyBoundary(moveEvent.clientY);
  }

  function onUp(upEvent: MouseEvent) {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
    if (dragged) {
      applyBoundary(upEvent.clientY);
      return;
    }
    setIsEditingEnd(true);
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
}, [dayStartMins, hourHeight, setWorkdayEnd, visibleDayEndMins]);
```

Key changes:
- `capturedHourHeight = hourHeight` captured at mousedown (outside `applyBoundary`)
- `capturedRect = originGrid.getBoundingClientRect()` captured once (outside `applyBoundary`)
- `applyBoundary` uses `capturedHourHeight` and `capturedRect` — not `hourHeight`, not a fresh `getBoundingClientRect()`
- Added `hourHeight` to `useCallback` deps array

**Step 3: Build**

```bash
cd "/Users/pat/Sites/Protagonist Ink/inked_app" && npm run build
```

Expected: 0 TypeScript errors.

**Step 4: Commit**

```bash
git add src/components/timeline/Timeline.tsx
git commit -m "fix: capture hourHeight and rect at mousedown to prevent drag feedback loop"
```

---

### Task 2: Ink Chat — Clickable Thread Starters

**Files:**
- Modify: `src/components/ink/MorningWelcome.tsx`

**Context:**
The weekly threads section (lines 88–110) renders `<span>` pills for all modes. In `mode === 'chat'`, they should be `<button>` elements that immediately start a conversation. In `mode === 'briefing'`, they stay as static spans. After the pill buttons, add an "──── or ────" divider then the existing grounding prompt + input.

**Step 1: Read the file**

Read `src/components/ink/MorningWelcome.tsx` to confirm current layout before editing.

**Step 2: Apply the changes**

Replace the weekly threads section and the layout below it. The full component render becomes:

```tsx
return (
  <div className="flex flex-col justify-center h-full">
    {/* A. Greeting */}
    <h1
      className="font-display font-bold leading-tight mb-4 tracking-[-0.02em]"
      style={{ color: 'var(--color-text-emphasis)', fontSize: compact ? '24px' : '4rem' }}
    >
      {greeting}
    </h1>

    {/* B. Weekly Threads */}
    <div className="mt-6">
      <span
        className="text-[10px] uppercase tracking-widest block mb-3"
        style={{ color: 'var(--color-text-muted)' }}
      >
        This week&apos;s threads
      </span>
      <div className="flex flex-row flex-wrap gap-3">
        {weeklyGoals.map((goal) =>
          mode === 'chat' ? (
            <button
              key={goal.id}
              onClick={() => onStartDay(`Let's talk about: ${goal.title}`)}
              className="text-sm px-3 py-1 rounded-full cursor-pointer transition-colors"
              style={{
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-primary)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-text-secondary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; }}
            >
              {goal.title}
            </button>
          ) : (
            <span
              key={goal.id}
              className="text-sm px-3 py-1 rounded-full"
              style={{
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text-primary)',
              }}
            >
              {goal.title}
            </span>
          )
        )}
      </div>
    </div>

    {/* C. "or" divider — chat mode only */}
    {mode === 'chat' && (
      <div
        className="flex items-center gap-3 mt-8"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
        <span className="text-[11px] uppercase tracking-[0.14em]">or</span>
        <div className="flex-1 h-px" style={{ background: 'var(--color-border)' }} />
      </div>
    )}

    {/* D. Grounding Prompt */}
    <p
      className="font-display font-medium"
      style={{ color: 'var(--color-text-emphasis)', fontSize: compact ? '1.15rem' : '1.5rem', marginTop: mode === 'chat' ? '1.5rem' : (compact ? '2.75rem' : '5rem') }}
    >
      {promptCopy.prompt}
    </p>

    {/* E. Input + CTA */}
    <div className="flex flex-row items-center gap-4 mt-6 flex-wrap">
      <input
        type="text"
        value={intention}
        onChange={(e) => setIntention(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
          }
        }}
        placeholder={promptCopy.placeholder}
        autoFocus
        className="morning-welcome-input bg-transparent border-0 border-b py-2 text-[15px] focus:outline-none focus:ring-0"
        style={{ width: compact ? '100%' : '18rem', borderColor: 'var(--color-border-hover)', color: 'var(--color-text-primary)' }}
      />
      <button
        onClick={handleSubmit}
        className="morning-welcome-cta bg-transparent border-none cursor-pointer text-[14px] transition-colors duration-300 text-text-secondary hover:text-text-primary"
      >
        {promptCopy.cta}
      </button>
    </div>
  </div>
);
```

**Step 3: Build**

```bash
cd "/Users/pat/Sites/Protagonist Ink/inked_app" && npm run build
```

Expected: 0 TypeScript errors.

**Step 4: Commit**

```bash
git add src/components/ink/MorningWelcome.tsx
git commit -m "feat: clickable thread starters in Ink chat welcome screen"
```

---

### Task 3: Focus Mode Controls Redesign

**Files:**
- Modify: `src/components/focus/FocusView.tsx`

**Context:**
Current `FocusView` has three icon buttons at the bottom (Pause/Play, Reset/Stop, Done/Check). Replace them with:
1. A circle check button inline at the LEFT of the task title — clicking calls `handleDone()`
2. A "Start work" full-width button visible ONLY when `!isRunning` — clicking calls `window.api.pomodoro.start(taskId, task?.title ?? 'Focus')`
3. Remove the three icon buttons entirely

The `PomodoroTimer` component already manages Pause/Resume/Skip/Stop controls internally once running.

Keep `isRunning` and `isPaused` state (still needed for "Start work" conditional). Remove `Pause`, `Play`, `RotateCcw` from imports since they're no longer used.

**Step 1: Read the file**

Read `src/components/focus/FocusView.tsx` to confirm current code before editing.

**Step 2: Update imports**

Change line 2 from:
```ts
import { Pause, Play, RotateCcw, Check } from 'lucide-react';
```
to:
```ts
import { Check } from 'lucide-react';
```

**Step 3: Replace the center stage section**

Replace the `{/* Center stage */}` div and everything inside it with:

```tsx
{/* Center stage */}
<div className="relative z-10 flex flex-col items-center gap-8 max-w-xl w-full px-8 text-center">

  {/* Task title row with circle check */}
  <div className="flex flex-col items-center gap-3">
    <div className="flex items-center gap-3">
      <button
        onClick={() => void handleDone()}
        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
        style={{
          borderColor: task?.status === 'done' ? 'var(--color-accent-warm)' : 'var(--color-text-muted)',
          background: task?.status === 'done' ? 'var(--color-accent-warm)' : 'transparent',
        }}
        title="Mark done and exit focus"
      >
        {task?.status === 'done' && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
      </button>
      <h1 className="font-display text-3xl text-text-emphasis leading-tight">
        {task?.title ?? 'Focus'}
      </h1>
    </div>

    {/* Goal badge */}
    {linkedGoal && (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-3 py-1',
          'text-[11px] uppercase tracking-[0.16em] font-medium',
          'border border-border-subtle'
        )}
        style={{
          color: linkedGoal.color,
          borderColor: `${linkedGoal.color}40`,
          backgroundColor: `${linkedGoal.color}18`,
        }}
      >
        {linkedGoal.title}
      </span>
    )}
  </div>

  {/* Pomodoro timer — prominent, centered */}
  <div className="scale-125 origin-center">
    <PomodoroTimer />
  </div>

  {/* Start work CTA — only when not yet running */}
  {!isRunning && (
    <button
      onClick={() => void window.api.pomodoro.start(taskId, task?.title ?? 'Focus')}
      className="w-full max-w-xs rounded-xl py-3 text-[14px] font-medium transition-colors"
      style={{
        background: 'var(--color-accent-warm)',
        color: 'var(--color-text-on-accent)',
      }}
    >
      Start work
    </button>
  )}

  {/* Time-of-day awareness */}
  <div className="text-[13px] text-text-muted tabular-nums">
    {timeInfo.timeStr}
    {timeInfo.minsLeft !== null && (
      <span className="text-text-muted/60 ml-1">
        — {formatMinsLeft(timeInfo.minsLeft)}
      </span>
    )}
  </div>
</div>
```

**Step 4: Build**

```bash
cd "/Users/pat/Sites/Protagonist Ink/inked_app" && npm run build
```

Expected: 0 TypeScript errors. If `isPaused` is flagged as unused, remove `isPaused` from state and the `setIsPaused` call in the `onTick` handler.

**Step 5: Commit**

```bash
git add src/components/focus/FocusView.tsx
git commit -m "feat: circle check on title, Start work CTA, remove bottom icon controls in FocusView"
```

---

## Verification (manual, in Electron)

1. **Drag bug**: Grab the end-of-day handle and drag slowly up/down — line tracks cursor precisely, no jumps
2. **Ink chat**: Open Ink overlay (chat mode) → click a thread pill → conversation starts with that thread as context. Text input still works for anything else.
3. **Focus controls**: Enter focus on a task → circle appears at title, "Start work" button visible → click → pomodoro starts, button disappears → PomodoroTimer shows pause controls → circle at title marks done and exits
