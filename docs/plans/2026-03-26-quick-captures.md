# Quick Captures Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a post-it note quick capture system with sidebar icon, global hotkey, and action menu for processing captures into Asana tasks or Notion pages.

**Architecture:** Dedicated IPC namespace (`capture:*`) with handlers in `electron/capture.ts`. React hook (`useCaptures`) manages state. Two UI components: a Spotlight-style overlay for fast capture, and a sidebar popover for review/processing. Midnight cleanup via interval timer. Existing `scratch.entries` store schema extended with `color` field.

**Tech Stack:** Electron IPC, React, Tailwind CSS, lucide-react icons, existing OverlaySurface component, Notion MCP (via Claude.ai connected server — accessed through Electron main process HTTP calls to Notion API).

---

### Task 1: Capture types and store schema

**Files:**
- Modify: `src/types/index.ts` — add `CaptureEntry` type
- Modify: `electron/store.ts:57-59` — update scratch entries default to include `color`

**Step 1: Add the CaptureEntry type**

In `src/types/index.ts`, add:

```ts
export type CaptureColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange' | 'lavender';

export interface CaptureEntry {
  id: string;
  text: string;
  color: CaptureColor;
  createdAt: string; // ISO 8601
}
```

**Step 2: Update store default**

In `electron/store.ts`, change the scratch default from:
```ts
scratch: {
  entries: [] as Array<{ id: string; text: string; createdAt: string }>,
},
```
to:
```ts
scratch: {
  entries: [] as Array<{ id: string; text: string; color: string; createdAt: string }>,
},
```

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/types/index.ts electron/store.ts
git commit -m "feat(capture): add CaptureEntry type and color field to store schema"
```

---

### Task 2: Electron capture IPC handlers

**Files:**
- Create: `electron/capture.ts`
- Modify: `electron/main.ts` — register handlers + global shortcut
- Modify: `electron/preload.ts` — expose capture namespace
- Modify: `src/types/electron.d.ts` — add CaptureAPI interface

**Step 1: Create `electron/capture.ts`**

```ts
import { ipcMain } from 'electron';
import { store } from './store';
import crypto from 'node:crypto';
import type { CaptureColor } from '../src/types';

const COLORS: CaptureColor[] = ['yellow', 'pink', 'blue', 'green', 'orange', 'lavender'];

interface StoredCapture {
  id: string;
  text: string;
  color: CaptureColor;
  createdAt: string;
}

function todayPrefix(): string {
  return new Date().toISOString().split('T')[0];
}

function getEntries(): StoredCapture[] {
  const raw = store.get('scratch.entries') as StoredCapture[] | undefined;
  return Array.isArray(raw) ? raw : [];
}

function setEntries(entries: StoredCapture[]) {
  store.set('scratch.entries', entries);
}

export function purgeStaleCapturesOnWake() {
  const prefix = todayPrefix();
  const entries = getEntries();
  const fresh = entries.filter((e) => e.createdAt.startsWith(prefix));
  if (fresh.length !== entries.length) setEntries(fresh);
}

export function registerCaptureHandlers() {
  // List today's captures
  ipcMain.handle('capture:list', () => {
    const prefix = todayPrefix();
    return getEntries().filter((e) => e.createdAt.startsWith(prefix));
  });

  // Add a new capture
  ipcMain.handle('capture:add', (_event, text: string) => {
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Capture text must be a non-empty string');
    }
    const trimmed = text.trim().slice(0, 500);
    const entry: StoredCapture = {
      id: crypto.randomUUID(),
      text: trimmed,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      createdAt: new Date().toISOString(),
    };
    const entries = getEntries();
    entries.push(entry);
    setEntries(entries);
    return entry;
  });

  // Remove a capture by ID (dismiss or after processing)
  ipcMain.handle('capture:remove', (_event, id: string) => {
    if (typeof id !== 'string') throw new Error('Invalid capture ID');
    const entries = getEntries();
    setEntries(entries.filter((e) => e.id !== id));
    return true;
  });

  // Purge stale entries (called on wake / midnight)
  ipcMain.handle('capture:purge-stale', () => {
    purgeStaleCapturesOnWake();
    return true;
  });
}
```

**Step 2: Register in main.ts**

In `electron/main.ts`, add import:
```ts
import { registerCaptureHandlers, purgeStaleCapturesOnWake } from './capture';
```

In the `app.whenReady()` block, after `registerStripeHandlers();` add:
```ts
registerCaptureHandlers();
```

Register the global shortcut after `createTray();`:
```ts
globalShortcut.register('CommandOrControl+Shift+.', () => {
  mainWindow?.show();
  mainWindow?.focus();
  mainWindow?.webContents.send('capture:open-overlay');
});
```

Add midnight purge interval after shortcut registration:
```ts
// Purge stale captures at midnight and on wake
purgeStaleCapturesOnWake();
setInterval(() => purgeStaleCapturesOnWake(), 60_000);
```

**Step 3: Add to preload.ts**

In `electron/preload.ts`, add the capture namespace inside the `contextBridge.exposeInMainWorld('api', {` block:
```ts
// Quick Captures
capture: {
  list: () => ipcRenderer.invoke('capture:list'),
  add: (text: string) => ipcRenderer.invoke('capture:add', text),
  remove: (id: string) => ipcRenderer.invoke('capture:remove', id),
  purgeStale: () => ipcRenderer.invoke('capture:purge-stale'),
  onOpenOverlay: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('capture:open-overlay', handler);
    return () => ipcRenderer.removeListener('capture:open-overlay', handler);
  },
},
```

**Step 4: Add CaptureAPI type to electron.d.ts**

In `src/types/electron.d.ts`, add the interface:
```ts
interface CaptureAPI {
  list: () => Promise<import('./index').CaptureEntry[]>;
  add: (text: string) => Promise<import('./index').CaptureEntry>;
  remove: (id: string) => Promise<boolean>;
  purgeStale: () => Promise<boolean>;
  onOpenOverlay: (cb: () => void) => () => void;
}
```

And add `capture: CaptureAPI;` to the `Window.api` interface.

**Step 5: Verify build**

Run: `npm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add electron/capture.ts electron/main.ts electron/preload.ts src/types/electron.d.ts
git commit -m "feat(capture): add IPC handlers, global shortcut, and preload bridge"
```

---

### Task 3: useCaptures hook

**Files:**
- Create: `src/hooks/useCaptures.ts`
- Create: `src/hooks/useCaptures.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockList = vi.fn();
const mockAdd = vi.fn();
const mockRemove = vi.fn();
const mockPurgeStale = vi.fn();
const mockOnOpenOverlay = vi.fn(() => vi.fn());

vi.stubGlobal('window', {
  api: {
    capture: {
      list: mockList,
      add: mockAdd,
      remove: mockRemove,
      purgeStale: mockPurgeStale,
      onOpenOverlay: mockOnOpenOverlay,
    },
  },
});

import { renderHook, act } from '@testing-library/react';
import { useCaptures } from './useCaptures';

describe('useCaptures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue([]);
  });

  it('loads captures on mount', async () => {
    const entries = [{ id: '1', text: 'test', color: 'yellow' as const, createdAt: new Date().toISOString() }];
    mockList.mockResolvedValue(entries);
    const { result } = renderHook(() => useCaptures());
    await vi.waitFor(() => expect(result.current.captures).toEqual(entries));
  });

  it('adds a capture and refreshes', async () => {
    const entry = { id: '2', text: 'new', color: 'pink' as const, createdAt: new Date().toISOString() };
    mockAdd.mockResolvedValue(entry);
    mockList.mockResolvedValue([entry]);
    const { result } = renderHook(() => useCaptures());
    await act(async () => { await result.current.addCapture('new'); });
    expect(mockAdd).toHaveBeenCalledWith('new');
  });

  it('removes a capture and refreshes', async () => {
    mockRemove.mockResolvedValue(true);
    mockList.mockResolvedValue([]);
    const { result } = renderHook(() => useCaptures());
    await act(async () => { await result.current.removeCapture('1'); });
    expect(mockRemove).toHaveBeenCalledWith('1');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useCaptures.test.ts`
Expected: FAIL — module not found

**Step 3: Write the hook**

```ts
import { useState, useEffect, useCallback } from 'react';
import type { CaptureEntry } from '@/types';

export function useCaptures() {
  const [captures, setCaptures] = useState<CaptureEntry[]>([]);

  const refresh = useCallback(async () => {
    const list = await window.api.capture.list();
    setCaptures(list);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addCapture = useCallback(async (text: string) => {
    await window.api.capture.add(text);
    await refresh();
  }, [refresh]);

  const removeCapture = useCallback(async (id: string) => {
    await window.api.capture.remove(id);
    await refresh();
  }, [refresh]);

  return { captures, addCapture, removeCapture, refresh };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useCaptures.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/useCaptures.ts src/hooks/useCaptures.test.ts
git commit -m "feat(capture): add useCaptures hook with tests"
```

---

### Task 4: Spotlight capture overlay

**Files:**
- Create: `src/components/capture/CaptureOverlay.tsx`

This is the Cmd+Shift+. overlay — a centered, minimal text input that appears over everything. Type, hit Enter, it saves and vanishes.

**Step 1: Create the component**

```tsx
import { useState, useRef, useEffect } from 'react';
import { OverlaySurface } from '../shared/OverlaySurface';

interface CaptureOverlayProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function CaptureOverlay({ open, onClose, onSubmit }: CaptureOverlayProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setText('');
  }, [open]);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
    onClose();
  }

  return (
    <OverlaySurface
      open={open}
      onClose={onClose}
      initialFocusRef={inputRef}
      containerClassName="z-[200] flex items-start justify-center pt-[20vh]"
      panelClassName="w-full max-w-md"
      backdropClassName="bg-black/30 backdrop-blur-sm"
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
        }}
        placeholder="Quick capture..."
        className="w-full px-4 py-3 rounded-xl bg-bg-elevated border border-border text-text-primary text-[15px] placeholder:text-text-muted/50 shadow-xl focus:outline-none focus:ring-2 focus:ring-accent-warm/40"
        maxLength={500}
      />
    </OverlaySurface>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/capture/CaptureOverlay.tsx
git commit -m "feat(capture): add Spotlight-style capture overlay"
```

---

### Task 5: Capture popover panel

**Files:**
- Create: `src/components/capture/CapturePopover.tsx`
- Create: `src/components/capture/CaptureCard.tsx`

**Step 1: Create CaptureCard**

Individual post-it card with action menu.

```tsx
import { useState } from 'react';
import { MoreHorizontal, ListTodo, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CaptureEntry } from '@/types';

const COLOR_MAP: Record<string, string> = {
  yellow:   'bg-amber-200/90 text-amber-950',
  pink:     'bg-pink-200/90 text-pink-950',
  blue:     'bg-sky-200/90 text-sky-950',
  green:    'bg-emerald-200/90 text-emerald-950',
  orange:   'bg-orange-200/90 text-orange-950',
  lavender: 'bg-violet-200/90 text-violet-950',
};

interface CaptureCardProps {
  entry: CaptureEntry;
  onMakeTask: (entry: CaptureEntry) => void;
  onSendToNotion: (entry: CaptureEntry) => void;
  onDismiss: (id: string) => void;
}

export function CaptureCard({ entry, onMakeTask, onSendToNotion, onDismiss }: CaptureCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const colorClasses = COLOR_MAP[entry.color] ?? COLOR_MAP.yellow;
  const time = new Date(entry.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className={cn('relative rounded-lg px-3 py-2.5 shadow-md', colorClasses)}>
      <p className="text-[13px] leading-snug pr-6">{entry.text}</p>
      <span className="block mt-1 text-[11px] opacity-60">{time}</span>

      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="absolute top-2 right-2 p-0.5 rounded hover:bg-black/10 transition-colors"
        aria-label="Actions"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      {menuOpen && (
        <div className="absolute right-2 top-8 z-10 bg-bg-elevated border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
          <button
            onClick={() => { onMakeTask(entry); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface/70"
          >
            <ListTodo className="w-3.5 h-3.5" /> Make task
          </button>
          <button
            onClick={() => { onSendToNotion(entry); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface/70"
          >
            <FileText className="w-3.5 h-3.5" /> Send to Notion
          </button>
          <button
            onClick={() => { onDismiss(entry.id); setMenuOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-muted hover:bg-surface/70"
          >
            <X className="w-3.5 h-3.5" /> Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create CapturePopover**

The sidebar popover — input at top, cards below.

```tsx
import { useState, useRef } from 'react';
import { CaptureCard } from './CaptureCard';
import type { CaptureEntry } from '@/types';

interface CapturePopoverProps {
  captures: CaptureEntry[];
  onAdd: (text: string) => void;
  onMakeTask: (entry: CaptureEntry) => void;
  onSendToNotion: (entry: CaptureEntry) => void;
  onDismiss: (id: string) => void;
  onClose: () => void;
}

export function CapturePopover({ captures, onAdd, onMakeTask, onSendToNotion, onDismiss, onClose }: CapturePopoverProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
    inputRef.current?.focus();
  }

  return (
    <div
      className="fixed left-12 top-0 bottom-0 z-[60] w-[280px] bg-bg-elevated/95 backdrop-blur-[16px] border-r border-border shadow-[4px_0_24px_rgba(0,0,0,0.18)] flex flex-col animate-slide-in-left"
    >
      {/* Header */}
      <div className="pt-[52px] px-4 pb-3 border-b border-border-subtle">
        <h2 className="text-[13px] font-medium text-text-secondary mb-2">Quick Captures</h2>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Jot something down..."
          className="w-full px-3 py-2 rounded-lg bg-surface/50 border border-border-subtle text-[13px] text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent-warm/30"
          maxLength={500}
          autoFocus
        />
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {captures.length === 0 ? (
          <p className="text-[12px] text-text-muted/50 text-center mt-8">Nothing captured today</p>
        ) : (
          captures.map((entry) => (
            <CaptureCard
              key={entry.id}
              entry={entry}
              onMakeTask={onMakeTask}
              onSendToNotion={onSendToNotion}
              onDismiss={onDismiss}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/capture/CaptureCard.tsx src/components/capture/CapturePopover.tsx
git commit -m "feat(capture): add CaptureCard and CapturePopover components"
```

---

### Task 6: Wire into Sidebar and App

**Files:**
- Modify: `src/components/chrome/Sidebar.tsx` — add capture icon with badge
- Modify: `src/App.tsx` — wire overlay, popover, and actions

**Step 1: Add capture icon to Sidebar**

In `Sidebar.tsx`, add `StickyNote` to the lucide import. Add a `captureCount` prop to `SidebarProps` and an `onCaptureClick` callback. Add the capture button in the sidebar strip between nav and settings:

```tsx
interface SidebarProps {
  onSettingsClick: () => void;
  onPlotClick: () => void;
  onCaptureClick: () => void;
  captureCount: number;
}
```

Add the capture button right before the settings `<div className="mt-auto mb-3">`:

```tsx
{/* Captures */}
<div className="mt-auto mb-1">
  <button
    onClick={onCaptureClick}
    title="Quick Captures"
    aria-label="Quick Captures"
    className="no-drag relative flex items-center justify-center rounded-md p-2 text-text-secondary hover:text-accent-warm-hover hover:bg-bg-card/60 transition-colors"
  >
    <StickyNote className="w-[18px] h-[18px] stroke-[1.5]" />
    {captureCount > 0 && (
      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-accent-warm text-[10px] font-medium text-white leading-none px-1">
        {captureCount}
      </span>
    )}
  </button>
</div>
```

Move the settings div's `mt-auto` to just `mb-3` (since capture now has `mt-auto`).

**Step 2: Wire in App.tsx**

Import `useCaptures`, `CaptureOverlay`, `CapturePopover`. Add state for overlay and popover visibility. Wire the global shortcut listener via `window.api.capture.onOpenOverlay`. Wire action handlers (make task creates Asana task, send to Notion is a placeholder for Task 7, dismiss calls removeCapture).

Add to `AppLayout`:
```tsx
const { captures, addCapture, removeCapture, refresh: refreshCaptures } = useCaptures();
const [captureOverlayOpen, setCaptureOverlayOpen] = useState(false);
const [capturePopoverOpen, setCapturePopoverOpen] = useState(false);

// Listen for global shortcut
useEffect(() => {
  return window.api.capture.onOpenOverlay(() => setCaptureOverlayOpen(true));
}, []);

// Midnight purge
useEffect(() => {
  const checkMidnight = setInterval(() => {
    window.api.capture.purgeStale().then(() => refreshCaptures());
  }, 60_000);
  return () => clearInterval(checkMidnight);
}, [refreshCaptures]);
```

Pass `captureCount={captures.length}` and `onCaptureClick={() => setCapturePopoverOpen(v => !v)}` to `<Sidebar>`.

Add the overlay and popover to JSX (near other overlays):
```tsx
<CaptureOverlay
  open={captureOverlayOpen}
  onClose={() => setCaptureOverlayOpen(false)}
  onSubmit={async (text) => { await addCapture(text); }}
/>

{capturePopoverOpen && (
  <CapturePopover
    captures={captures}
    onAdd={addCapture}
    onMakeTask={async (entry) => {
      await window.api.asana.completeTask(/* TODO: create task — see Task 7 */);
      await removeCapture(entry.id);
    }}
    onSendToNotion={async (entry) => {
      // TODO: Task 7 — Notion integration
      await removeCapture(entry.id);
    }}
    onDismiss={removeCapture}
    onClose={() => setCapturePopoverOpen(false)}
  />
)}
```

Note: Make task and Send to Notion are stubbed here — they'll be completed in Task 7.

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/chrome/Sidebar.tsx src/App.tsx
git commit -m "feat(capture): wire sidebar icon, overlay, and popover into app"
```

---

### Task 7: Make Task and Send to Notion actions

**Files:**
- Modify: `src/App.tsx` — implement action handlers
- Modify: `electron/capture.ts` — add Notion send handler (or handle via renderer)

**Step 1: Implement Make Task (Asana)**

The app already has `window.api.asana` but only `completeTask` and `addComment` — no `createTask`. Check if Asana create exists. If not, use the existing IPC pattern to add a `asana:create-task` handler.

Check `electron/asana.ts` for existing create handler. If missing, add:

In `electron/asana.ts`:
```ts
ipcMain.handle('asana:create-task', async (_event, name: string) => {
  // Create a task in the default project/workspace
  // Use existing Asana client setup
});
```

Alternatively, if the existing Asana flow creates tasks via the planner, wire the capture → planner task conversion through existing state management rather than direct API.

The simplest approach: when "Make task" is clicked, add the capture text as a new planned task in the planner state (same as manually adding a task). This keeps it within the existing system.

**Step 2: Implement Send to Notion**

For Notion, the MCP server is available but only in Claude conversations. For the app itself, use the Notion API directly from the Electron main process.

Add a `capture:send-to-notion` IPC handler in `electron/capture.ts`:
```ts
ipcMain.handle('capture:send-to-notion', async (_event, text: string, pageId: string) => {
  // Append a bullet point to the configured Notion page
  // Uses Notion API: PATCH https://api.notion.com/v1/blocks/{pageId}/children
  // Auth token stored in settings
});
```

Add to preload:
```ts
sendToNotion: (text: string) => ipcRenderer.invoke('capture:send-to-notion', text),
```

**Step 3: Add Notion settings**

In `electron/store.ts` defaults, add:
```ts
notion: {
  apiKey: '',
  capturePageId: '',
},
```

Add Notion config fields to settings:load and settings:save.

**Step 4: Wire the actions in App.tsx**

Replace the TODO stubs from Task 6.

**Step 5: Verify build**

Run: `npm run build`
Expected: PASS

**Step 6: Commit**

```bash
git add electron/capture.ts electron/store.ts electron/preload.ts src/types/electron.d.ts src/App.tsx
git commit -m "feat(capture): add Make Task and Send to Notion actions"
```

---

### Task 8: Update ink-prompts.ts for color field

**Files:**
- Modify: `electron/ink-prompts.ts:246-251` — handle color field gracefully

**Step 1: Update the scratch section builder**

The existing code at line 246 reads `scratch.entries` — it should continue to work since it only uses `text` and `createdAt`, but verify it handles the new `color` field without issues (it does — it just ignores extra fields).

No code changes needed unless the type assertion breaks. Verify with build.

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit (if any changes)**

Only commit if changes were needed.

---

### Task 9: Menu bar integration

**Files:**
- Modify: `electron/main.ts` — add Capture menu item

**Step 1: Add menu item**

In the `File` submenu, after "New Event", add:
```ts
{ label: 'Quick Capture', accelerator: 'CmdOrCtrl+Shift+.', click: () => {
  mainWindow?.show();
  mainWindow?.focus();
  mainWindow?.webContents.send('capture:open-overlay');
}},
```

Note: This duplicates the globalShortcut — the menu item provides discoverability while the globalShortcut works even when the app isn't focused. Remove the `globalShortcut.register` from Task 2 since the menu accelerator handles it when the app is focused, and the globalShortcut handles it when it isn't. Actually, keep both — the menu accelerator only works when the app is focused, while `globalShortcut` works system-wide.

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "feat(capture): add Quick Capture to menu bar"
```
