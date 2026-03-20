# Block Nesting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tasks nest inside time blocks as a checklist. Blocks are exclusive — no overlapping.

**Architecture:** Add `nestedTaskIds: string[]` to `ScheduleBlock`. Each `BlockCard` becomes a drop target for tasks. Nested tasks render as compact checklist lines inside the block. GCal sync preserves nesting by re-applying stored `nestedTaskIds` after block reconstruction.

**Tech Stack:** React, TypeScript, react-dnd, Electron IPC

**Spec:** `docs/superpowers/specs/2026-03-20-block-nesting-design.md`

---

### Task 1: Add `nestedTaskIds` to ScheduleBlock Type

**Files:**
- Modify: `src/types/index.ts:113-140`

- [ ] **Step 1: Add the field to ScheduleBlock**

In `src/types/index.ts`, add `nestedTaskIds` to the `ScheduleBlock` interface, after the `proposal` field:

```typescript
  /** Task IDs nested inside this block as a checklist. */
  nestedTaskIds?: string[];
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add nestedTaskIds to ScheduleBlock type"
```

---

### Task 2: Add `nestTaskInBlock` and `unnestTaskFromBlock` Actions

**Files:**
- Modify: `src/hooks/useScheduleManager.ts`

- [ ] **Step 1: Add `nestTaskInBlock` function**

Add after `removeScheduleBlock` in `useScheduleManager.ts`. This function:
1. Adds the task ID to the target block's `nestedTaskIds`
2. If the task had its own ScheduleBlock, removes that block (and deletes its GCal event)
3. Keeps the task in `committedTaskIds`

```typescript
const nestTaskInBlock = useCallback(async (taskId: string, targetBlockId: string) => {
  const targetBlock = scheduleBlocks.find((b) => b.id === targetBlockId);
  if (!targetBlock) return;

  // Remove the task's own block if it has one
  const ownBlock = scheduleBlocks.find((b) => b.linkedTaskId === taskId);
  if (ownBlock) {
    if (ownBlock.eventId) {
      try {
        await window.api.gcal.deleteEvent(ownBlock.eventId, ownBlock.calendarId);
      } catch (err) {
        console.warn('Failed to delete GCal event when nesting:', err);
      }
    }
  }

  setScheduleBlocks((prev) =>
    prev
      .filter((b) => b.linkedTaskId !== taskId || b.id === targetBlockId)
      .map((b) =>
        b.id === targetBlockId
          ? { ...b, nestedTaskIds: [...(b.nestedTaskIds ?? []).filter((id) => id !== taskId), taskId] }
          : b
      )
  );

  // Clear the task's scheduled event references but keep it committed
  setPlannedTasks((prev) =>
    prev.map((t) =>
      t.id === taskId
        ? { ...t, status: 'committed', scheduledEventId: undefined, scheduledCalendarId: undefined }
        : t
    )
  );
}, [scheduleBlocks, setPlannedTasks, setScheduleBlocks]);
```

- [ ] **Step 2: Add `unnestTaskFromBlock` function**

```typescript
const unnestTaskFromBlock = useCallback((taskId: string, blockId: string) => {
  setScheduleBlocks((prev) =>
    prev.map((b) =>
      b.id === blockId
        ? { ...b, nestedTaskIds: (b.nestedTaskIds ?? []).filter((id) => id !== taskId) }
        : b
    )
  );
}, [setScheduleBlocks]);
```

- [ ] **Step 3: Return the new functions from the hook**

Add `nestTaskInBlock` and `unnestTaskFromBlock` to the return object of `useScheduleManager`.

- [ ] **Step 4: Update `removeScheduleBlock` to handle nested tasks**

In the existing `removeScheduleBlock`, add nested task cleanup. Place this **after** the block is found (line ~167 in useScheduleManager.ts) and **before** `setScheduleBlocks` filters the block out. The nested tasks get their status reset to `committed`:

```typescript
// Return nested tasks to unscheduled pool
const nestedIds = block.nestedTaskIds ?? [];
if (nestedIds.length > 0) {
  setPlannedTasks((prev) =>
    prev.map((task) =>
      nestedIds.includes(task.id)
        ? { ...task, status: 'committed', scheduledEventId: undefined, scheduledCalendarId: undefined }
        : task
    )
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useScheduleManager.ts
git commit -m "feat: add nestTaskInBlock and unnestTaskFromBlock actions"
```

---

### Task 3: Expose Nesting Actions via AppContext

**Files:**
- Modify: `src/context/AppContext.tsx`

- [ ] **Step 1: Add to context type**

Find the `AppContextType` interface and add:

```typescript
nestTaskInBlock: (taskId: string, targetBlockId: string) => Promise<void>;
unnestTaskFromBlock: (taskId: string, blockId: string) => void;
```

- [ ] **Step 2: Wire up from useScheduleManager**

In the component where `useScheduleManager` is called, destructure the new functions and pass them into the context value object.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: expose nesting actions in AppContext"
```

---

### Task 4: Add Drop Zone to BlockCard

**Files:**
- Modify: `src/components/Timeline.tsx` (BlockCard component)

- [ ] **Step 1: Add `useDrop` to BlockCard**

Import `useDrop` (already imported in Timeline.tsx). Add a drop zone inside BlockCard that accepts `DragTypes.TASK`:

```typescript
const { nestTaskInBlock } = useApp();

const [{ isNestOver }, nestDropRef] = useDrop<DragItem, void, { isNestOver: boolean }>({
  accept: DragTypes.TASK,
  canDrop: () => !locked,
  collect: (monitor) => ({ isNestOver: monitor.isOver() && monitor.canDrop() }),
  drop: (item) => {
    void nestTaskInBlock(item.id, block.id);
  },
});
```

- [ ] **Step 2: Apply the drop ref to the outer block div**

Combine the nest drop ref with the existing block div. Use a callback ref:

```typescript
const blockRef = useCallback((node: HTMLDivElement | null) => {
  nestDropRef(node);
}, [nestDropRef]);
```

Add `ref={blockRef}` to the outer `<div>` of BlockCard.

- [ ] **Step 3: Add visual feedback when dragging over a block**

Add to the outer div's `className`:

```typescript
isNestOver && 'ring-2 ring-accent-warm/40'
```

- [ ] **Step 4: Add `didDrop()` guard to grid-level drop handler**

**CRITICAL:** The grid-level `useDrop` in the Timeline component will also fire when a task is dropped on a BlockCard. Without a guard, both `nestTaskInBlock` AND `scheduleTaskBlock` would run. In the grid's `drop` handler (the `useDrop` on `timeline-grid`), add at the top:

```typescript
drop: (item, monitor) => {
  if (monitor.didDrop()) return; // BlockCard already handled this drop
  // ... rest of existing handler
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Test manually in Electron**

Drag a task from the sidebar onto an existing block. The block should highlight. On drop, the task should appear in the block's `nestedTaskIds` (verify via React DevTools or console log).

- [ ] **Step 6: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: BlockCard accepts task drops for nesting"
```

---

### Task 5: Render Nested Tasks Inside BlockCard

**Files:**
- Modify: `src/components/Timeline.tsx` (BlockCard component)

- [ ] **Step 1: Look up nested tasks from plannedTasks**

Inside BlockCard, after the existing variable declarations, add:

```typescript
const nestedTasks = useMemo(
  () => (block.nestedTaskIds ?? [])
    .map((id) => plannedTasks.find((t) => t.id === id))
    .filter((t): t is PlannedTask => t != null),
  [block.nestedTaskIds, plannedTasks]
);
```

You'll need to import `PlannedTask` type from `@/types` if not already imported.

- [ ] **Step 2: Render nested task checklist**

Add after the status badges div (`focus-fade-meta`) and before the physics warning, inside the BlockCard return:

```tsx
{nestedTasks.length > 0 && (
  <div className="relative z-10 flex flex-col gap-0.5 mt-1">
    {nestedTasks.map((task) => (
      <div
        key={task.id}
        className="flex items-center gap-2 pl-0.5 group/nested"
      >
        <button
          onClick={(e) => { e.stopPropagation(); void toggleTask(task.id); }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className={cn(
            'w-2 h-2 rounded-full border shrink-0 transition-colors',
            task.status === 'done'
              ? 'bg-accent-warm/60 border-accent-warm/60'
              : 'border-text-muted/30 hover:border-text-muted/60'
          )}
        />
        <span className={cn(
          'font-sans text-[11px] truncate',
          task.status === 'done'
            ? 'line-through text-text-muted/40'
            : 'text-text-primary/70'
        )}>
          {task.title}
        </span>
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Test in Electron**

After nesting a task (Task 4), it should appear as a compact checklist line inside the block. Clicking the circle should toggle done/undone.

- [ ] **Step 5: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: render nested tasks as checklist inside BlockCard"
```

---

### Task 6: Inline Add Task Inside Block

**Files:**
- Modify: `src/components/Timeline.tsx` (BlockCard component)

- [ ] **Step 1: Add inline input state**

Inside BlockCard, add state for the inline input:

```typescript
const [showInlineAdd, setShowInlineAdd] = useState(false);
const [inlineValue, setInlineValue] = useState('');
```

- [ ] **Step 2: Add the `+` button and input**

Import `Plus` from lucide-react. Add after the nested tasks list (or after the status badges if no nested tasks), still inside the return:

```tsx
{!locked && (height > 80 || nestedTasks.length > 0) && (
  <div className="relative z-10 mt-0.5">
    {showInlineAdd ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!inlineValue.trim()) return;
          const goalId = linkedTask?.weeklyGoalId ?? weeklyGoals[0]?.id ?? null;
          const newTaskId = addLocalTask(inlineValue, goalId ?? undefined);
          if (newTaskId) void nestTaskInBlock(newTaskId, block.id);
          setInlineValue('');
          setShowInlineAdd(false);
        }}
        className="flex items-center gap-2 pl-0.5"
      >
        <Plus className="w-2 h-2 text-text-muted/30 shrink-0" />
        <input
          autoFocus
          type="text"
          value={inlineValue}
          onChange={(e) => setInlineValue(e.target.value)}
          onBlur={() => { setShowInlineAdd(false); setInlineValue(''); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { setShowInlineAdd(false); setInlineValue(''); } }}
          placeholder="Add task"
          className="bg-transparent border-none outline-none font-sans text-[11px] text-text-primary/70 placeholder:text-text-muted/25 w-full"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      </form>
    ) : (
      <button
        onClick={(e) => { e.stopPropagation(); setShowInlineAdd(true); }}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className={cn(
          'flex items-center gap-2 pl-0.5 text-text-muted/25 hover:text-text-muted/50 transition-colors',
          nestedTasks.length === 0 && 'opacity-0 group-hover/block:opacity-100'
        )}
      >
        <Plus className="w-2 h-2" />
        <span className="font-sans text-[11px]">Add task</span>
      </button>
    )}
  </div>
)}
```

- [ ] **Step 3: Destructure `addLocalTask` and `nestTaskInBlock` from useApp**

Update the existing `useApp()` destructure in BlockCard to include `addLocalTask` and `nestTaskInBlock`.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Test in Electron**

Hover over a block → `+ Add task` appears. Click it → input opens. Type a task name → Enter → task is created and nested inside the block. Escape → input dismissed.

- [ ] **Step 6: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: inline add task inside blocks"
```

---

### Task 7: Keyboard Delete for Nested Tasks

**Files:**
- Modify: `src/components/Timeline.tsx` (Timeline component, keyboard handler)

- [ ] **Step 1: Extend the existing keyboard delete handler**

The Timeline component already has a `selectedBlockId` state and keyboard handler for deleting blocks. Extend it to also handle nested task deletion. Add a `selectedNestedTaskId` state:

```typescript
const [selectedNestedTaskId, setSelectedNestedTaskId] = useState<string | null>(null);
```

- [ ] **Step 2: Update the keyboard handler**

In the existing `useEffect` for keyboard delete, add a check for `selectedNestedTaskId`:

```typescript
useEffect(() => {
  if (timelineLocked) return;
  if (!selectedBlockId && !selectedNestedTaskId) return;

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      if (selectedNestedTaskId && selectedBlockId) {
        unnestTaskFromBlock(selectedNestedTaskId, selectedBlockId);
        setSelectedNestedTaskId(null);
        return;
      }
      if (selectedBlockId) {
        const block = scheduleBlocks.find((b) => b.id === selectedBlockId);
        if (!block) return;
        if (block.id.startsWith('ritual-')) {
          toggleRitualSkipped(block.id.slice('ritual-'.length), format(viewDate, 'yyyy-MM-dd'));
        } else if (!block.readOnly) {
          removeScheduleBlock(block.id);
        }
        setSelectedBlockId(null);
      }
    }
    if (e.key === 'Escape') {
      setSelectedBlockId(null);
      setSelectedNestedTaskId(null);
    }
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedBlockId, selectedNestedTaskId, timelineLocked, scheduleBlocks, removeScheduleBlock, toggleRitualSkipped, viewDate, unnestTaskFromBlock]);
```

- [ ] **Step 3: Pass selection callbacks to BlockCard**

Add `selectedNestedTaskId`, `onSelectNestedTask` props to BlockCard. In the nested task rows, add click handler:

```typescript
onClick={(e) => {
  e.stopPropagation();
  onSelectNestedTask?.(selectedNestedTaskId === task.id ? null : task.id);
}}
```

Add a visual highlight on the selected nested task:

```typescript
className={cn(
  'flex items-center gap-2 pl-0.5 group/nested rounded-sm transition-colors',
  selectedNestedTaskId === task.id && 'bg-accent-warm/10'
)}
```

- [ ] **Step 4: Destructure `unnestTaskFromBlock` from useApp in the Timeline component**

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: Test in Electron**

Click a nested task inside a block → it highlights. Press Delete → task is removed from the block and returns to the unscheduled pool. Press Escape → deselects.

- [ ] **Step 7: Commit**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: keyboard delete to unnest tasks from blocks"
```

---

### Task 8: Preserve Nesting Across GCal Sync

**Files:**
- Modify: `src/hooks/useExternalPlannerSync.ts`

- [ ] **Step 1: Preserve `nestedTaskIds` during sync**

In `hydrateCalendar` (or wherever `setScheduleBlocks` is called after sync), preserve `nestedTaskIds` from the previous state. Update the merge logic:

```typescript
const hydrateCalendar = useCallback((events: GCalEvent[], tasks: PlannedTask[]) => {
  const eventBlocks = events
    .map((event) => eventToBlock(event, tasks))
    .filter((block): block is ScheduleBlock => block !== null);

  setScheduleBlocks((prev) => {
    // Preserve nestedTaskIds from existing blocks
    const nestingMap = new Map<string, string[]>();
    for (const block of prev) {
      if (block.nestedTaskIds?.length) {
        nestingMap.set(block.id, block.nestedTaskIds);
      }
    }

    const merged = mergeScheduleBlocksWithRituals(eventBlocks, rituals, workdayStart, viewDate);

    // Re-apply nesting
    return merged.map((block) => {
      const nested = nestingMap.get(block.id);
      return nested ? { ...block, nestedTaskIds: nested } : block;
    });
  });
}, [rituals, setScheduleBlocks, viewDate, workdayStart]);
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useExternalPlannerSync.ts
git commit -m "feat: preserve nestedTaskIds across GCal sync"
```

---

### Task 9: Show Nesting Indicator in TodaysFlow

**Files:**
- Modify: `src/components/TodaysFlow.tsx`

- [ ] **Step 1: Compute which tasks are nested in blocks**

In `TodaysFlow`, compute a set of task IDs that are nested inside any block:

```typescript
const { scheduleBlocks } = useApp();

const nestedTaskIds = useMemo(() => {
  const ids = new Set<string>();
  for (const block of scheduleBlocks) {
    for (const id of block.nestedTaskIds ?? []) {
      ids.add(id);
    }
  }
  return ids;
}, [scheduleBlocks]);
```

- [ ] **Step 2: Pass to GoalSection or TaskCard**

Pass `nestedTaskIds` to the component that renders individual tasks. Add a subtle indicator (e.g., a small dot or muted "scheduled" text) on tasks that are nested:

```tsx
{nestedTaskIds.has(task.id) && (
  <span className="text-[9px] uppercase tracking-[0.14em] text-text-muted/30">in block</span>
)}
```

The exact placement depends on the TaskCard component structure — add it near the task title.

- [ ] **Step 3: Exclude nested tasks from "unscheduled" count**

Update the `unscheduledCount` computation to exclude nested tasks:

```typescript
const unscheduledCount = committedTasks.filter(
  (task) => task.status === 'committed' && !nestedTaskIds.has(task.id)
).length;
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/components/TodaysFlow.tsx
git commit -m "feat: show nesting indicator and update unscheduled count"
```

---

### Task 10: Handle resetDay Cleanup

**Files:**
- Modify: `src/context/AppContext.tsx` (or wherever `resetDay` is defined)

- [ ] **Step 1: Find resetDay**

Locate the `resetDay` function. It already clears focus blocks and resets task statuses.

- [ ] **Step 2: Ensure nestedTaskIds are cleaned up**

`resetDay` calls `setScheduleBlocks` to clear blocks. Since `nestedTaskIds` lives on the blocks, clearing the blocks automatically clears the nesting. Verify this is the case. If `resetDay` selectively filters blocks (e.g., keeps rituals), ensure those ritual blocks also have their `nestedTaskIds` cleared:

```typescript
// Inside resetDay, when resetting blocks:
.map((block) => block.nestedTaskIds ? { ...block, nestedTaskIds: [] } : block)
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add src/context/AppContext.tsx
git commit -m "feat: clear nestedTaskIds on resetDay"
```

---

### Task 11: Final Build and Smoke Test

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: tsc exit 0, vite builds all 3 bundles

- [ ] **Step 2: Smoke test in Electron**

Test the following flows:
1. Drag task from sidebar onto a block → task appears as nested checklist item
2. Click `+` inside a block → type task → Enter → task created and nested
3. Click nested task → highlight → Delete key → task removed from block, returns to sidebar
4. Check/uncheck nested tasks via circle checkbox
5. Delete a block that has nested tasks → nested tasks return to unscheduled pool
6. Schedule two blocks at the same time → second block cascades, no overlap
7. Sync calendar → nested tasks preserved

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final polish for block nesting"
```
