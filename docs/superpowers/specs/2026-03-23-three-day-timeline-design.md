# Three-Day Timeline with Flexible Rituals

**Date:** 2026-03-23
**Depends on:** Phase 1 Foundation Restructure (complete)
**Reference:** Reclaim.ai day blocking UX

---

## Problem

The current timeline is a single-day view that takes up too much space. Rituals are locked to fixed time slots. There's no forward/backward awareness — you can't see what happened yesterday or what's coming tomorrow without switching dates.

## Design

### 3-Day Split View

```
│ Yesterday (narrow, muted) │ Today (wide, interactive) │ Tomorrow (narrow, preview) │
```

**Yesterday:**
- Read-only, muted/faded
- Completed blocks shown as done (strikethrough or dimmed)
- Unfinished blocks highlighted as draggable — drag to today or tomorrow
- Gives Ink context ("you didn't finish X yesterday")

**Today:**
- Full interactive column — wider than the other two
- Drag-drop scheduling, all current functionality
- Where focus mode launches from
- Current time indicator

**Tomorrow:**
- Semi-editable — you can pre-place blocks, drag things forward to it
- Calendar events visible (meetings, deadlines)
- Rituals auto-placed in preferred slots
- Can't start focus on tomorrow's tasks

**Proportions:** Roughly 20% / 60% / 20%, or collapse yesterday/tomorrow further on smaller windows.

### Cross-Day Drag

- **Today → Tomorrow:** Unfinished task slides to tomorrow. Tomorrow's blocks shift to accommodate. Ink notices: "Moved X to tomorrow."
- **Yesterday → Today:** Pull forward unfinished work from yesterday. Ink can reference this in briefing.
- **Yesterday → Tomorrow:** Skip a day — sometimes the right call.
- **Tomorrow → Today:** Pull something forward if you have capacity.

When a block is dragged cross-day, it lands in either:
1. Its original time slot (if available on the target day)
2. The next available open slot (if the original time is occupied)

### Flexible Rituals

Rituals (writing time, workout, LinkedIn posts, etc.) change from fixed locks to soft preferences.

**Each ritual has:**
- `preferredStartHour` — when it ideally happens
- `durationMins` — how long it takes
- `flexibility: 'tight' | 'loose'` — tight means ±1 hour, loose means anywhere in the day
- `days: number[]` — which days of the week (0=Sun, 6=Sat)

**Placement behavior:**
1. On day load, rituals auto-place in their preferred slots
2. If a hard event (calendar meeting) occupies the preferred slot, the ritual finds the next available window
3. User can drag rituals to new times — this overrides the auto-placement for that day only
4. Rituals defend their time: if you drag a task onto a ritual, the task goes after the ritual (not replacing it), unless you explicitly drag the ritual away first

**Ink awareness:**
- "I moved your writing block to 11am — your 9am had a client call"
- "Your workout landed at 7pm today — morning was packed"
- If no slot fits: "Couldn't find room for [ritual] today. Want to skip it or squeeze it in?"

### Visual Treatment

- Hard events (calendar): solid, distinct color, not draggable within Inked
- Tasks: draggable blocks, color-coded by intention
- Rituals: slightly different visual treatment — perhaps a subtle pattern or lighter fill to distinguish from tasks. Draggable but with a "preferred" indicator (small anchor icon or time badge)
- Yesterday: all blocks at reduced opacity, unfinished ones with a subtle glow or border to indicate "you can grab this"
- Tomorrow: blocks at slightly reduced opacity, editable but clearly "not yet"

---

## Data Model Changes

### ScheduleBlock additions
```typescript
interface ScheduleBlock {
  // ... existing fields
  date: string;  // yyyy-MM-dd — blocks are now date-aware
}
```

### Ritual type (new or extended)
```typescript
interface Ritual {
  id: string;
  title: string;
  preferredStartHour: number;
  preferredStartMin: number;
  durationMins: number;
  flexibility: 'tight' | 'loose';
  days: number[];  // 0-6
  color?: string;
}
```

### Cross-day drag action
```typescript
type ScheduleAction =
  | { type: 'MOVE_BLOCK_CROSS_DAY'; blockId: string; fromDate: string; toDate: string; toHour: number; toMin: number }
  | { type: 'AUTO_PLACE_RITUALS'; date: string; hardEvents: ScheduleBlock[] }
```

---

## Scope

**In scope:**
- 3-column day view (yesterday / today / tomorrow)
- Cross-day drag-drop
- Flexible ritual placement with auto-fit
- Ritual preference persistence
- Visual distinction between days

**Out of scope:**
- Week view or multi-week planning
- Reclaim-style "habits" that auto-reschedule across the week
- AI-driven schedule optimization (Ink suggests, doesn't auto-arrange)
- Ritual sync to external calendars

---

## Resolved Questions

1. **Today-only toggle?** Yes — focus mode drops to just the current task, timer, and upcoming tasks. The 3-day view is for planning/executing modes.

## Open Questions (resolve during build)

2. When rituals auto-place, should Ink announce each one or just place silently?
3. Should yesterday collapse entirely after noon?
