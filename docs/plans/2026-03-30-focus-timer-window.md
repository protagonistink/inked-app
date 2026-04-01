# Focus Timer Window Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a compact, always-on-top floating timer window that auto-opens during focus sessions.

**Architecture:** New BrowserWindow following the captureWindow pattern. Loads the same Vite app with `?mode=focus-timer` query param, routing to a dedicated `FocusTimerWidget` component. Timer state comes from existing `pomodoro:tick` broadcasts. Window lifecycle managed from main process, triggered by pomodoro start/stop.

**Tech Stack:** Electron BrowserWindow, React, Tailwind CSS, existing IPC (pomodoro:tick, pomodoro:pause, pomodoro:stop)

---

### Task 1: Create the FocusTimerWidget React component

**Files:**
- Create: `src/components/focus/FocusTimerWidget.tsx`

**Step 1: Create the component**

```tsx
import { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import type { PomodoroState } from '@/types';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function FocusTimerWidget() {
  const [state, setState] = useState<PomodoroState | null>(null);

  useEffect(() => {
    const cleanup = window.api.pomodoro.onTick((next) => {
      setState(next as PomodoroState);
    });
    return cleanup;
  }, []);

  if (!state) return null;

  const progress =
    state.totalTime > 0 ? 1 - state.timeRemaining / state.totalTime : 0;
  const isBreak = state.isBreak;
  const accentColor = isBreak ? 'rgb(45,212,191)' : 'rgb(200,60,47)';
  const label = isBreak
    ? 'Break'
    : state.currentTaskTitle || 'Focus';

  return (
    <div
      className="flex flex-col w-full h-full select-none overflow-hidden"
      style={{
        background: '#0A0A0A',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center gap-3 px-3 py-2 flex-1 drag-region">
        {/* Timer */}
        <span
          className="font-mono font-medium text-[20px] tracking-wider shrink-0 no-drag"
          style={{ color: accentColor }}
        >
          {formatTimer(state.timeRemaining)}
        </span>

        {/* Task title */}
        <button
          onClick={() => void window.api.window.showMain()}
          className="flex-1 min-w-0 truncate text-left text-[12px] text-white/70 hover:text-white/90 transition-colors no-drag cursor-pointer"
          title="Show Inked"
        >
          {label}
        </button>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0 no-drag">
          <button
            onClick={() => void window.api.pomodoro.pause()}
            className="p-1.5 rounded-md text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
            title={state.isPaused ? 'Resume' : 'Pause'}
          >
            {state.isPaused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => void window.api.pomodoro.stop()}
            className="p-1.5 rounded-md text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
            title="Stop"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-[3px] w-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full transition-all duration-1000 ease-linear"
          style={{
            width: `${progress * 100}%`,
            background: accentColor,
          }}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```
feat(focus): add FocusTimerWidget component for floating timer window
```

---

### Task 2: Route the focus-timer mode in main.tsx

**Files:**
- Modify: `src/main.tsx`

**Step 1: Add the focus-timer route**

Update `src/main.tsx` to handle the new mode. Add import and conditional:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QuickCaptureNote } from './components/capture/QuickCaptureNote';
import { FocusTimerWidget } from './components/focus/FocusTimerWidget';
import './styles/globals.css';

const params = new URLSearchParams(window.location.search);
const mode = params.get('mode');

ReactDOM.createRoot(document.getElementById('root')!).render(
  mode === 'capture'
    ? <QuickCaptureNote />
    : mode === 'focus-timer'
      ? <FocusTimerWidget />
      : (
        <React.StrictMode>
          <App />
        </React.StrictMode>
      )
);
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 3: Commit**

```
feat(focus): route focus-timer mode in main.tsx
```

---

### Task 3: Create the Electron focus timer window

**Files:**
- Modify: `electron/main.ts`

**Step 1: Add focusTimerWindow variable**

After line 25 (`let captureWindow`), add:

```typescript
let focusTimerWindow: BrowserWindow | null = null;
```

**Step 2: Add createFocusTimerWindow function**

After `createCaptureWindow()` (after line 145), add:

```typescript
function createFocusTimerWindow() {
  if (focusTimerWindow && !focusTimerWindow.isDestroyed()) {
    focusTimerWindow.show();
    return;
  }

  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;

  focusTimerWindow = new BrowserWindow({
    width: 280,
    height: 72,
    x: sw - 300,
    y: 20,
    frame: false,
    alwaysOnTop: true,
    level: 'floating',
    skipTaskbar: true,
    resizable: false,
    show: false,
    transparent: true,
    hasShadow: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  focusTimerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  focusTimerWindow.on('closed', () => { focusTimerWindow = null; });

  if (VITE_DEV_SERVER_URL) {
    void focusTimerWindow.loadURL(`${VITE_DEV_SERVER_URL}?mode=focus-timer`);
  } else {
    void focusTimerWindow.loadFile(path.join(process.env.DIST!, 'index.html'), {
      query: { mode: 'focus-timer' },
    });
  }

  focusTimerWindow.once('ready-to-show', () => {
    focusTimerWindow?.show();
  });
}
```

**Step 3: Add IPC handlers for focus timer window lifecycle**

In the `app.whenReady()` callback, after the capture shortcut registration (after line 283), add:

```typescript
  globalShortcut.register('CommandOrControl+Shift+F', () => {
    if (!focusTimerWindow || focusTimerWindow.isDestroyed()) return;
    if (focusTimerWindow.isVisible()) {
      focusTimerWindow.hide();
    } else {
      focusTimerWindow.show();
    }
  });
```

**Step 4: Add IPC handlers for window show/hide from renderer**

After the existing `window:show-main` handler, add:

```typescript
  ipcMain.handle('focus-timer:show', () => {
    createFocusTimerWindow();
  });

  ipcMain.handle('focus-timer:hide', () => {
    focusTimerWindow?.hide();
  });
```

**Step 5: Clean up focusTimerWindow on quit**

In the `before-quit` handler (around line 198), add cleanup:

```typescript
  focusTimerWindow?.destroy();
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 7: Commit**

```
feat(focus): create Electron focus timer window with Cmd+Shift+F toggle
```

---

### Task 4: Auto-open/close the timer window on pomodoro start/stop

**Files:**
- Modify: `electron/timer.ts`
- Modify: `electron/main.ts`

**Step 1: Export createFocusTimerWindow and a close helper from main.ts**

At the bottom of `electron/main.ts`, after the module-level functions, add exports. Since `main.ts` uses module-level variables, the cleanest approach is to wire this through a callback pattern like `setTrayUpdater`.

Add after `let isQuitting = false;` (line 27):

```typescript
let focusTimerOpener: (() => void) | null = null;
let focusTimerCloser: (() => void) | null = null;
export function setFocusTimerCallbacks(open: () => void, close: () => void) {
  focusTimerOpener = open;
  focusTimerCloser = close;
}
```

Then in `app.whenReady()`, after `createFocusTimerWindow` is defined, wire it up:

```typescript
  setFocusTimerCallbacks(
    () => createFocusTimerWindow(),
    () => { focusTimerWindow?.hide(); },
  );
```

**Step 2: Import and call from timer.ts**

In `electron/timer.ts`, import the callbacks at the top:

```typescript
import { setFocusTimerCallbacks } from './main';
```

Wait — this would create a circular dependency (main imports timer, timer imports main). Instead, use the same callback pattern as the tray updater.

Add to `electron/timer.ts` after the `trayUpdater` variable:

```typescript
let focusTimerOpen: (() => void) | null = null;
let focusTimerClose: (() => void) | null = null;
export function setFocusTimerCallbacks(open: () => void, close: () => void) {
  focusTimerOpen = open;
  focusTimerClose = close;
}
```

In `startPomodoroSession()`, after `broadcast()` (line 72), add:

```typescript
  focusTimerOpen?.();
```

In the `pomodoro:stop` handler (around line 142), after `broadcast()`, add:

```typescript
    focusTimerClose?.();
```

In the break-done section (line 120-124, when `state.isRunning = false`), after `broadcast()` at line 127, the timer auto-closes is handled by the stop logic. But also close when break ends and timer fully stops — in the `else` branch (break done, line 118-124), add after line 123:

```typescript
          focusTimerClose?.();
```

**Step 3: Wire callbacks in main.ts**

In `electron/main.ts`, update the import from timer:

```typescript
import { registerTimerHandlers, setTrayUpdater, setFocusTimerCallbacks, startLastUsedPomodoro } from './timer';
```

In `app.whenReady()`, after `createTray()` (line 273), add:

```typescript
  setFocusTimerCallbacks(
    () => createFocusTimerWindow(),
    () => { focusTimerWindow?.hide(); },
  );
```

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```
feat(focus): auto-open timer window on focus start, close on stop
```

---

### Task 5: Add Escape-to-hide in the FocusTimerWidget

**Files:**
- Modify: `src/components/focus/FocusTimerWidget.tsx`

**Step 1: Add keyboard handler**

Add a `useEffect` for Escape key handling inside the component:

```tsx
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        void window.api.focusTimer?.hide?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
```

**Step 2: Add focusTimer to preload**

In `electron/preload.ts`, add inside the `api` object:

```typescript
  focusTimer: {
    hide: () => ipcRenderer.invoke('focus-timer:hide'),
  },
```

**Step 3: Add type declaration**

In `src/types/electron.d.ts`, add the `FocusTimerAPI` interface and include it in the `api` object type:

```typescript
interface FocusTimerAPI {
  hide: () => Promise<void>;
}
```

Add `focusTimer: FocusTimerAPI;` to the `api` interface.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

**Step 5: Commit**

```
feat(focus): add Escape-to-hide for focus timer window
```

---

### Task 6: Add focus-timer styles to globals.css

**Files:**
- Modify: `src/styles/globals.css`

**Step 1: Add drag region styles for the timer widget**

These may already exist for the capture window. Verify `.drag-region` and `.no-drag` classes exist. If not, add:

```css
.drag-region {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: clean build, no errors

**Step 3: Commit**

```
feat(focus): add drag region styles for focus timer window
```

---

### Task 7: Full build verification

**Step 1: Run full build**

Run: `npm run build`
Expected: clean build with DMG output

**Step 2: Commit all remaining changes**

If any uncommitted files remain, commit them with an appropriate message.
