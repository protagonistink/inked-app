# Focus Timer Window — Design

## What
A compact, always-on-top floating window that shows the active focus timer with task context. Auto-opens when a focus session starts, dismissable and reopenable via shortcut.

## Window Properties
- **Size:** 280x72px, not resizable
- **Position:** Top-right corner of screen, 20px margin from edges
- **Style:** Frameless, always-on-top, `floating` level, `skipTaskbar: true` — same pattern as capture window
- **Background:** Dark (`#0A0A0A`), rounded corners via transparent background + CSS border-radius

## Layout (horizontal card)
```
┌─────────────────────────────────────────┐
│  25:00   Task title here...   ⏸  ■     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
└─────────────────────────────────────────┘
```
- Left: countdown in mono font
- Center: task title, truncated
- Right: pause/resume + stop buttons
- Bottom: thin progress bar (accent-warm color)
- Draggable via the card body (CSS `-webkit-app-region: drag`, buttons are `no-drag`)

## Behavior
- **Auto-opens** when `pomodoro:start` fires in the main process
- **Auto-closes** when the session ends (stop or timer completes)
- **Toggle shortcut:** `Cmd+Shift+F` to show/hide
- **Dismissable:** Escape hides it; shortcut brings it back
- **Click-through:** Clicking the task title focuses the main window
- **Break mode:** Swap accent-warm for teal, show "Break" instead of task title

## Architecture
- New `createFocusTimerWindow()` in `electron/main.ts`, following `createCaptureWindow()` pattern
- Loads the same Vite app with `?mode=focus-timer` query param
- App.tsx routes to a `FocusTimerWidget` component when mode is detected
- Receives `pomodoro:tick` broadcasts (already sent to all windows)
- Pause/stop buttons call existing `window.api.pomodoro.*` IPC methods — no new IPC needed
