# Code Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues identified in the code audit — temp logging, stream error propagation, duplicated code, magic numbers, and type safety gaps.

**Architecture:** Surgical fixes across the Electron main process and renderer. No new files needed. Each task is independently testable and committable.

**Tech Stack:** TypeScript, Electron IPC, React hooks

---

### Task 1: Remove temporary debug logging from `electron/main.ts`

**Files:**
- Modify: `electron/main.ts:48-62`

These `console.log`/`console.error` listeners were added to diagnose a black-screen crash and flagged in `memory.md` for removal.

- [ ] **Step 1: Remove the four debug event listeners**

Remove lines 48-62 — the `did-finish-load`, `did-fail-load`, `render-process-gone`, and `console-message` listeners. Keep the `mainWindow.on('close', ...)` handler on line 43 (that's functional, not debug).

The result should go from `mainWindow.on('close', ...)` directly to `if (VITE_DEV_SERVER_URL)`.

- [ ] **Step 2: Verify typecheck passes**

Run: `cd "/Users/pat/Sites/Protagonist Ink/Playground/timefocus" && npx tsc --noEmit`
Expected: Clean exit, no errors.

- [ ] **Step 3: Commit**

```bash
git add electron/main.ts
git commit -m "chore: remove temporary renderer debug logging from main.ts"
```

---

### Task 2: Add `ai:stream:error` event so the renderer knows when streaming fails

**Files:**
- Modify: `electron/anthropic.ts:535-538`
- Modify: `electron/preload.ts` (add `onError` to `ai` namespace)
- Modify: `src/types/electron.d.ts` (add `onError` type)
- Modify: `src/hooks/useBriefingStream.ts` (subscribe to error event)

Currently, when streaming fails, the catch block on line 535-538 sends `ai:stream:done` but the renderer has no way to distinguish "completed successfully" from "failed." The `return { success: false, error }` value goes back as the IPC invoke result, but the renderer's streaming hook listens to events, not the invoke return.

- [ ] **Step 1: Send `ai:stream:error` before `ai:stream:done` in the catch block**

In `electron/anthropic.ts`, change the catch block (lines 535-538) from:

```typescript
} catch (error) {
  console.error('[AI] Error in stream:start handler:', (error as Error).message);
  event.sender.send('ai:stream:done');
  return { success: false, error: (error as Error).message };
}
```

to:

```typescript
} catch (error) {
  const message = (error as Error).message;
  console.error('[AI] Error in stream:start handler:', message);
  event.sender.send('ai:stream:error', message);
  event.sender.send('ai:stream:done');
  return { success: false, error: message };
}
```

- [ ] **Step 2: Expose `onError` in `electron/preload.ts`**

Add to the `ai` namespace in the `contextBridge.exposeInMainWorld` call, alongside the existing `onToken` and `onDone`:

```typescript
onError: (callback: (error: string) => void) => {
  const handler = (_event: unknown, error: string) => callback(error);
  ipcRenderer.on('ai:stream:error', handler);
  return () => ipcRenderer.removeListener('ai:stream:error', handler);
},
```

- [ ] **Step 3: Add type to `src/types/electron.d.ts`**

Add `onError` to the `ai` section of the `ElectronAPI` interface:

```typescript
onError: (callback: (error: string) => void) => () => void;
```

- [ ] **Step 4: Subscribe to the error event in `src/hooks/useBriefingStream.ts`**

Read the file first to understand the current hook structure, then add an `onError` subscription alongside the existing `onToken`/`onDone` subscriptions. The error callback should set an error state that the MorningBriefing component can display. Use the same cleanup pattern as `onToken` — return the unsubscribe function from the effect.

- [ ] **Step 5: Verify typecheck passes**

Run: `cd "/Users/pat/Sites/Protagonist Ink/Playground/timefocus" && npx tsc --noEmit`
Expected: Clean exit.

- [ ] **Step 6: Run tests**

Run: `cd "/Users/pat/Sites/Protagonist Ink/Playground/timefocus" && npx vitest run`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add electron/anthropic.ts electron/preload.ts src/types/electron.d.ts src/hooks/useBriefingStream.ts
git commit -m "fix: propagate streaming errors to renderer via ai:stream:error event"
```

---

### Task 3: Deduplicate `moveForward` and `releaseTask` in `useTaskActions.ts`

**Files:**
- Modify: `src/hooks/useTaskActions.ts:178-218`

`moveForward` (lines 178-197) and `releaseTask` (lines 199-218) are nearly identical — both call `removeLinkedScheduleBlock`, update the task status, unparent children, and remove from committed IDs. The only difference is the target status: `'migrated'` vs `'cancelled'`.

- [ ] **Step 1: Extract a shared `detachTask` helper inside the hook**

Replace both callbacks with a single private helper and two thin wrappers:

```typescript
const detachTask = useCallback(async (taskId: string, targetStatus: 'migrated' | 'cancelled') => {
  await removeLinkedScheduleBlock(taskId);

  setPlannedTasks((prev) =>
    prev.map((task) => {
      if (task.id === taskId) {
        return { ...task, status: targetStatus, active: false, scheduledEventId: undefined, scheduledCalendarId: undefined };
      }
      if (task.parentId === taskId) {
        return { ...task, parentId: undefined };
      }
      return task;
    })
  );

  setDailyPlan((prev) => ({
    ...prev,
    committedTaskIds: prev.committedTaskIds.filter((id) => id !== taskId),
  }));
}, [removeLinkedScheduleBlock, setDailyPlan, setPlannedTasks]);

const moveForward = useCallback((taskId: string) => detachTask(taskId, 'migrated'), [detachTask]);
const releaseTask = useCallback((taskId: string) => detachTask(taskId, 'cancelled'), [detachTask]);
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd "/Users/pat/Sites/Protagonist Ink/Playground/timefocus" && npx tsc --noEmit`
Expected: Clean exit.

- [ ] **Step 3: Run tests**

Run: `cd "/Users/pat/Sites/Protagonist Ink/Playground/timefocus" && npx vitest run`
Expected: All pass — existing `useTaskActions.test.tsx` covers these callbacks.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTaskActions.ts
git commit -m "refactor: deduplicate moveForward/releaseTask into shared detachTask helper"
```

---

### Task 4: Consolidate Escape key handlers in `App.tsx`

**Files:**
- Modify: `src/App.tsx:97-115`

Two separate `useEffect` blocks each add a `keydown` listener for Escape. They can be a single listener.

- [ ] **Step 1: Merge into one useEffect**

Replace lines 97-115 with:

```typescript
// Escape key: close briefing or exit focus lock
useEffect(() => {
  if (!showBriefing && !dayLocked) return;
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (showBriefing) closeBriefing();
    else if (dayLocked) unlockDay();
  }
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [showBriefing, dayLocked, closeBriefing, unlockDay]);
```

Briefing takes priority over unlock (if both are somehow true, close briefing first).

- [ ] **Step 2: Verify typecheck passes**

Run: `cd "/Users/pat/Sites/Protagonist Ink/Playground/timefocus" && npx tsc --noEmit`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: consolidate duplicate Escape key handlers into single effect"
```

---

### Task 5: Extract magic number for weekly goal limit

**Files:**
- Modify: `src/context/plannerState.ts:80`
- Modify: `src/context/AppContext.tsx:325`

The number `3` appears as a hardcoded limit in three places:
- `src/context/plannerState.ts:80` — `stored.weeklyGoals.slice(0, 3)`
- `src/context/AppContext.tsx:325` — `weeklyGoals.length >= 3`
- `src/components/WeeklyIntentions.tsx:473` — `weeklyGoals.length < 3`

- [ ] **Step 1: Add a named constant and use it in all three files**

In `src/context/plannerState.ts`, add at the top (after imports):

```typescript
export const MAX_WEEKLY_GOALS = 3;
```

Change line 80 from:
```typescript
nextState.weeklyGoals = stored.weeklyGoals.slice(0, 3);
```
to:
```typescript
nextState.weeklyGoals = stored.weeklyGoals.slice(0, MAX_WEEKLY_GOALS);
```

In `src/context/AppContext.tsx`, import and use it. Change line 325 from:
```typescript
if (!title.trim() || weeklyGoals.length >= 3) return false;
```
to:
```typescript
if (!title.trim() || weeklyGoals.length >= MAX_WEEKLY_GOALS) return false;
```

In `src/components/WeeklyIntentions.tsx`, import and use it. Change line 473 from:
```typescript
{weeklyGoals.length < 3 && (
```
to:
```typescript
{weeklyGoals.length < MAX_WEEKLY_GOALS && (
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd "/Users/pat/Sites/Protagonist Ink/Playground/timefocus" && npx tsc --noEmit`
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/context/plannerState.ts src/context/AppContext.tsx src/components/WeeklyIntentions.tsx
git commit -m "refactor: extract MAX_WEEKLY_GOALS constant from magic number"
```

---

### Task 6: Tighten type safety in `plannerState.ts` reducer

**Files:**
- Modify: `src/context/plannerState.ts:30-32,55-61`

The `PlannerAction` `set` case uses `value: unknown`, and the reducer applies it with an unsafe cast. We can make this type-safe with a generic discriminated union.

- [ ] **Step 1: Replace the loose `set` action with a typed setter**

Replace the action type and reducer `set` case:

```typescript
type PlannerAction =
  | { type: 'load'; payload: Partial<PlannerState> }
  | { type: 'set'; field: PlannerField; updater: (prev: PlannerState[typeof field]) => PlannerState[typeof field] }
  | { type: 'set'; field: PlannerField; value: PlannerState[PlannerField] };
```

Actually, TypeScript can't narrow `typeof field` in a discriminated union like this. The pragmatic fix is to keep the current shape but remove the `as` cast by using a runtime type guard. Replace the `applySetStateAction` function:

```typescript
function applySetStateAction<T>(prev: T, next: unknown): T {
  if (typeof next === 'function') {
    return (next as (current: T) => T)(prev);
  }
  return next as T;
}
```

This is the same runtime behavior, but document the intent. The real safety comes from `createPlannerFieldSetter`, which constrains the types at the call site. The reducer is an internal dispatch target, not a public API. The current approach is acceptable — the `as` cast is unavoidable here because `useReducer` doesn't support generic actions.

**Skip this task** — the current code is pragmatically correct and the cast is isolated to reducer internals. Tightening it would add complexity without real safety gain.

---

### Task 7: Add `monthlyPlanDismissedDate` to `SAFE_STORE_KEYS` in `store.ts`

**Files:**
- Modify: `electron/store.ts:53-57`

`AppContext.tsx:246` reads `monthlyPlanDismissedDate` from the renderer via `window.api.store.get()`, but this key isn't in the `SAFE_STORE_KEYS` whitelist. It only works because `isAllowedStoreKey` also allows `briefing.dismissed.*` — but `monthlyPlanDismissedDate` doesn't match that pattern. This is either a latent bug (the read silently throws) or it works because the error is caught somewhere upstream.

- [ ] **Step 1: Verify the bug exists**

Search for how `monthlyPlanDismissedDate` is accessed in `AppContext.tsx` and confirm it goes through `window.api.store.get`.

- [ ] **Step 2: Add the key to the whitelist**

In `electron/store.ts`, add `'monthlyPlanDismissedDate'` to the `SAFE_STORE_KEYS` set:

```typescript
const SAFE_STORE_KEYS = new Set([
  'plannerState',
  'dayLocked',
  'dayLockedDate',
  'monthlyPlanDismissedDate',
]);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd "/Users/pat/Sites/Protagonist Ink/Playground/timefocus" && npx tsc --noEmit`
Expected: Clean exit.

- [ ] **Step 4: Commit**

```bash
git add electron/store.ts
git commit -m "fix: add monthlyPlanDismissedDate to SAFE_STORE_KEYS whitelist"
```

---

## Note on AppContext split

The AppContext split (126 properties → domain-specific contexts) was identified as the highest-value structural improvement. It is intentionally **not** in this plan because it's a separate architectural initiative — not a bug fix or cleanup. It deserves its own spec, its own plan, and its own review cycle.

## Note on CSS variable duplication

The `@theme` / `:root` duplication in `globals.css` was noted in the audit. This is a Tailwind v4 pattern where `@theme` declares design tokens and `:root` provides CSS custom properties. Whether they're actually duplicated or serving different purposes needs a closer read of the Tailwind v4 docs before touching it. Deferred.
