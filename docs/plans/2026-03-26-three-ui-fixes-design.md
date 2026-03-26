# Design: Three UI Fixes — End-of-Day Drag, Ink Chat, Focus Controls

**Date:** 2026-03-26

---

## 1. End-of-Day Drag Bug Fix

### Problem
`hourHeight` is reactive: it depends on `totalHoursVisible` → `visibleDayEndMins` → `workdayEnd`. During a drag, each `setWorkdayEnd` call triggers a re-render that changes `hourHeight`. The next `mousemove` uses the new value, so the same cursor Y maps to a different time. The end-of-day line chases the cursor and "jumps to the top."

### Fix
In `beginWorkdayEndDrag` (Timeline.tsx ~line 401), capture `hourHeight` at mousedown via closure:

```ts
const beginWorkdayEndDrag = useCallback((event) => {
  const capturedHourHeight = hourHeight; // stable for this drag
  const applyBoundary = (clientY: number) => {
    const y = clientY - rect.top + scrollTop;
    const rawMinutes = (y / capturedHourHeight) * 60 + dayStartMins;
    ...
  };
}, [dayStartMins, hourHeight, setWorkdayEnd, visibleDayEndMins]);
```

Also capture `rect` once at mousedown rather than recomputing on every `mousemove`.

---

## 2. Ink Chat Overlay — Conversation Starters

### Problem
The `MorningWelcome` component shows weekly threads as static `<span>` pills. Users have to type to start any conversation, even if they just want to talk through a specific thread.

### Design
**File:** `src/components/ink/MorningWelcome.tsx`

Layout change (chat mode only — `mode === 'chat'`):

```
[Greeting]

THIS WEEK'S THREADS
[DRIVR pill button]  [Decoda Narrative pill button]  [Protagonist pill button]

──── or ────

[What's on your mind?]
[text input________________]  Talk it through →
```

**Thread pill behavior:** clicking a thread pill immediately calls `onStartDay("Let's talk about: [goal title]")` — no typing required, drops straight into the conversation.

**Open input:** the existing text input + CTA, unchanged, for anything outside the threads.

**Briefing mode** (`mode === 'briefing'`): no change — the current layout stays as-is for the full morning planning flow.

**Implementation notes:**
- Thread pills: change `<span>` → `<button>` with `onClick={() => onStartDay(\`Let's talk about: ${goal.title}\`)}`
- Only in `mode === 'chat'` — the `getPromptCopy` already branches on `mode`, so the layout branch fits naturally there or as a conditional in the render
- Keep the existing pill visual style, add `cursor-pointer hover:border-text-secondary transition-colors`

---

## 3. Focus Mode Controls Redesign

### Problem
FocusView has three icon buttons at the bottom (Pause/Play, Reset, Done) that duplicate controls already in PomodoroTimer, are hard to discover, and clutter the layout. The user wants a single clear "Start work" CTA before the timer runs, and a circle check-off inline with the task title.

### Design
**File:** `src/components/focus/FocusView.tsx`

#### Task title row
Replace the current `<h1>` with a row:

```
[○] Write the DRIVR investor brief        ← circle at left, title
    [goal badge]
```

Circle button: same pattern as BlockCard nested tasks — `w-4 h-4 rounded-full border-2`, filled warm when done, empty+muted when not done. Clicking calls `handleDone()` (marks task complete + exits focus).

#### "Start work" CTA
Shown **only when the pomodoro is not yet running** (`!isRunning`):

```
[  Start work  ]   ← full-width or centered, accent warm background
```

Calls `window.api.pomodoro.start(taskId)` (or equivalent). Once running, this button disappears — the PomodoroTimer manages its own state from that point.

#### Remove bottom icon controls
The three icon buttons (Pause/Play, Reset, Done/Check) are removed from FocusView. The PomodoroTimer component handles pause/resume/stop internally. The circle check at the title is the only way to mark done from FocusView.

#### Final layout (top to bottom)
```
[ink bleed background]

  [○] Task title here
      [Goal badge]

  [PomodoroTimer @ 125%]      ← runs its own controls once started

  [  Start work  ]             ← visible only when !isRunning

  11:42 AM — 18 minutes left in this block

  Press ESC to exit focus
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/timeline/Timeline.tsx` | Capture `hourHeight` + `rect` at mousedown in `beginWorkdayEndDrag` |
| `src/components/ink/MorningWelcome.tsx` | Thread pills → clickable buttons in chat mode; add "or" divider |
| `src/components/focus/FocusView.tsx` | Circle check on title, "Start work" CTA when !isRunning, remove bottom icon buttons |

---

## Verification

1. **Drag bug**: Grab the end-of-day line and drag slowly up and down — line should track the cursor precisely with no jumps
2. **Ink chat**: Open Ink overlay → click a thread pill → conversation starts immediately with that thread as context; text input still works for open-ended messages
3. **Focus controls**: Enter focus on a task → circle appears at title left, "Start work" button visible → click it → pomodoro starts, "Start work" disappears → PomodoroTimer shows its pause controls → circle at title marks done and exits
