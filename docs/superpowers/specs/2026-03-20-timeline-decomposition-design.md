# Timeline.tsx — Decomposition Design
**Date:** 2026-03-20
**Status:** Approved

---

## Context

`Timeline.tsx` is 1407 lines. It contains 6 inline sub-components (`FocusSetMeter`, `AIBreakdown`, `OpenInterval`, `CurrentTimeIndicator`, `AfterHoursVeil`, `DeadlineMargin`), one large inline component (`BlockCard` at ~377 lines), 5 module-level utility functions, and 3 module-level constants — all in a single file alongside the main `Timeline` export (~575 lines of orchestration logic).

No behavior changes in this plan. The extraction is a pure structural refactor.

---

## Files to Create

### 1. `src/components/timelineUtils.ts`

Moves all module-level constants and utility functions out of `Timeline.tsx`. Used by `Timeline`, `BlockCard`, `OpenInterval`, `CurrentTimeIndicator`, and `AfterHoursVeil`.

**Exports:**
```typescript
export const BASE_HOUR_HEIGHT = 96;
export const GRID_SNAP_MINS = CALENDAR_GRID_SNAP_MINS;
export const MIN_VISIBLE_DAY_HOURS = 16;

export function clampMinutes(totalMinutes: number, dayStartMins: number, dayEndMins: number, maxDurationMins?: number): number
export function timeToTop(totalMinutes: number, dayStartMins: number, hourHeight: number): number
export function formatTime(h: number, m: number): string
export function formatTimeShort(h: number, m: number): string
export function getStepMins(durationMins: number): number
```

~40 lines.

---

### 2. `src/components/OpenInterval.tsx`

Renders a dashed border box showing a free-time gap between scheduled blocks. Pure presentational — no state, no context.

```typescript
export function OpenInterval({
  startMins,
  durationMins,
  dayStartMins,
  hourHeight,
}: {
  startMins: number;
  durationMins: number;
  dayStartMins: number;
  hourHeight: number;
})
```

Hides itself when computed height < 12px. Formats label as hours/mins + "open". ~40 lines.

---

### 3. `src/components/CurrentTimeIndicator.tsx`

Renders a red "now" indicator line at the current time. Owns its own clock state (updates every 30 seconds via `setInterval`). Renders nothing if current time is outside the visible window.

```typescript
export function CurrentTimeIndicator({
  dayStartMins,
  dayEndMins,
  hourHeight,
}: {
  dayStartMins: number;
  dayEndMins: number;
  hourHeight: number;
})
```

~40 lines.

---

### 4. `src/components/AfterHoursVeil.tsx`

Renders the semi-transparent overlay below the end-of-workday boundary. Pure presentational — no state, no context. Includes a draggable boundary handle and SVG wave decoration.

```typescript
export function AfterHoursVeil({
  workdayEnd,
  onEdit,
  onDragBoundaryStart,
  isLight,
  isPastClose,
  minutesPastClose,
  dayStartMins,
  hourHeight,
}: {
  workdayEnd: { hour: number; min: number };
  onEdit: () => void;
  onDragBoundaryStart: (event: React.MouseEvent<HTMLElement>) => void;
  isLight: boolean;
  isPastClose: boolean;
  minutesPastClose: number;
  dayStartMins: number;
  hourHeight: number;
})
```

~80 lines.

---

### 5. `src/components/DeadlineMargin.tsx`

Renders upcoming countdowns in either horizontal or vertical layout. Reads `useApp()` directly for `countdowns`. No props except layout mode.

```typescript
export function DeadlineMargin({
  layout,
}: {
  layout?: 'horizontal' | 'vertical';
})
```

Filters to future deadlines, sorts by days remaining, detects life events via regex for color coding. ~125 lines.

---

### 6. `src/components/AIBreakdown.tsx`

Renders the AI-powered task breakdown panel inside a focus block. Fetches sub-task suggestions from `window.api.ai.chat`, allows selection, and commits selected items as nested tasks. Reads `useApp()` directly for `nestTask` and `addLocalTask`.

```typescript
export function AIBreakdown({
  block,
}: {
  block: ScheduleBlock;
})
```

Own state: `expanded`, `suggestions`, `selected`, `loading`. ~100 lines.

---

### 7. `src/components/BlockCard.tsx`

The draggable, resizable calendar block card. `FocusSetMeter` stays as a **non-exported internal function** inside this file — it is ~21 lines and only used by `BlockCard`.

Click behavior: clicking a block (without dragging) calls `onSelect?.(isSelected ? '' : block.id)` — it selects/deselects the block. Block removal is handled in `Timeline.tsx` via the keyboard delete handler, not via an X button inside `BlockCard`. There is **no remove button rendered in `BlockCard`**. `GripVertical`, `Play`, `Check`, `RefreshCw` are imported from `lucide-react`; `X` is **not** imported.

```typescript
export function BlockCard({
  block,
  onRemove,
  onUpdate,
  onUpdateDuration,
  resolvePlacement,
  acceptProposal,
  stagger,
  isNow,
  actualMins,
  dayStartMins,
  dayEndMins,
  hourHeight,
  physicsWarning,
  locked,
  colIndex,
  colCount,
  isSelected,
  onSelect,
}: {
  block: ScheduleBlock;
  onRemove: () => void;
  onUpdate: (startHour: number, startMin: number, durationMins: number) => void;
  onUpdateDuration?: (durationMins: number) => void;
  resolvePlacement: (rawMinutes: number, durationMins: number, targetBlockId?: string) => { startHour: number; startMin: number };
  acceptProposal: (blockId: string) => void;
  stagger?: number;
  isNow?: boolean;
  actualMins?: number;
  dayStartMins: number;
  dayEndMins: number;
  hourHeight: number;
  physicsWarning?: string | null;
  locked?: boolean;
  colIndex?: number;
  colCount?: number;
  isSelected?: boolean;
  onSelect?: (blockId: string) => void;
})
```

Imports `AIBreakdown` from `./AIBreakdown`. Imports `timeToTop`, `formatTimeShort`, `GRID_SNAP_MINS`, `getStepMins` from `./timelineUtils`. Uses `useApp`, `useTheme`, `useDrag`. ~400 lines (including `FocusSetMeter` internal).

---

## File to Modify

### `src/components/Timeline.tsx`

**Remove:**
- `BASE_HOUR_HEIGHT`, `GRID_SNAP_MINS`, `MIN_VISIBLE_DAY_HOURS` constants
- `clampMinutes`, `timeToTop`, `formatTime`, `formatTimeShort`, `getStepMins` functions
- `FocusSetMeter` component
- `AIBreakdown` component
- `OpenInterval` component
- `CurrentTimeIndicator` component
- `AfterHoursVeil` component
- `DeadlineMargin` component
- `BlockCard` component

**Keep in `Timeline.tsx` (not extracted):**
- `selectedBlockId` useState — keyboard selection state owned by Timeline
- Keyboard delete/escape useEffect — listens for `Backspace`/`Delete`/`Escape` on `window`; on delete, calls `toggleRitualSkipped` for ritual blocks or `removeScheduleBlock` for regular blocks; clears `selectedBlockId` afterward
- `dailyArc` useMemo — computes a summary string from `scheduleBlocks` (focus count · ritual count · total hours), rendered in the header
- `toggleRitualSkipped` destructured from `useApp()` — used by the keyboard delete handler

**`BlockCard` receives from `Timeline`:**
- `isSelected={selectedBlockId === block.id}`
- `onSelect={(id) => setSelectedBlockId(id || null)}`
- `colIndex={overlapLayout.get(block.id)?.colIndex ?? 0}`
- `colCount={overlapLayout.get(block.id)?.colCount ?? 1}`
  (`overlapLayout` is a `Map<string, { colIndex: number; colCount: number }>` computed by a `useMemo` in `Timeline` that groups overlapping blocks into side-by-side columns.)

**Add imports:**
```typescript
import { BASE_HOUR_HEIGHT, GRID_SNAP_MINS, MIN_VISIBLE_DAY_HOURS, clampMinutes, timeToTop, formatTimeShort } from './timelineUtils';
import { OpenInterval } from './OpenInterval';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { AfterHoursVeil } from './AfterHoursVeil';
import { DeadlineMargin } from './DeadlineMargin';
import { BlockCard } from './BlockCard';
```

Notes on `timelineUtils` imports:
- `clampMinutes` is used directly in `Timeline.tsx`'s `resolvePlacement` callback — imported in `Timeline.tsx`, not in `BlockCard`.
- `formatTimeShort` is used in **both** `Timeline.tsx` (grid hour labels, workday time buttons) and `BlockCard` (block start-time label) — imported in both files.
- `getStepMins` is only used in `BlockCard` — NOT imported into `Timeline.tsx`.
- `formatTime` is only used in `CurrentTimeIndicator` and `AfterHoursVeil` — NOT imported into `Timeline.tsx` or `BlockCard`.

**Result:** `Timeline.tsx` drops from ~1430 to ~600 lines.

---

## Critical Files

| File | Action |
|------|--------|
| `src/components/timelineUtils.ts` | **Create** — constants + utility functions |
| `src/components/OpenInterval.tsx` | **Create** |
| `src/components/CurrentTimeIndicator.tsx` | **Create** |
| `src/components/AfterHoursVeil.tsx` | **Create** |
| `src/components/DeadlineMargin.tsx` | **Create** |
| `src/components/AIBreakdown.tsx` | **Create** |
| `src/components/BlockCard.tsx` | **Create** — `FocusSetMeter` internal |
| `src/components/Timeline.tsx` | **Modify** — remove extracted code, add imports |

No changes to: `AppContext.tsx`, `useDragDrop.ts`, `planner.ts`, `DateHeader.tsx`, or any hooks/types.

---

## Verification

```bash
npm run build
```

TypeScript must compile clean. No runtime behavior changes — same drag/resize/scheduling/AI breakdown behavior.

Manual smoke test in Electron: open timeline view, verify blocks render and drag correctly, resize works, AI breakdown opens, deadline margin shows, after-hours veil appears.
