# Right Rail Visual Hierarchy Redesign

**Date:** 2026-04-01
**Approach:** Hybrid A+B — Visual hierarchy with contextual presence

## Problem

The right rail's sections all have identical visual weight. Everything uses the same `ui-section-label`, same `my-5` dividers, same card styling. Nothing breathes. A UX director's take: "looks like a junior designer built it." The design system is sophisticated but the rail components don't live up to it.

## Principle

Nothing appears or disappears. Everything is always there. But sections shift visual weight based on relevance — through opacity, color warmth, and spacing. The rail has a "temperature" that shifts through the day.

## Section Changes

### FocusCapacity — Keep Compact
- Progress bar from 1px to 3-4px, rounded ends
- Contextual dimming (opacity drop) after workday ends
- No size increase — the timeline already shows open hours

### Intentions — The Active Work
- All intentions keep card treatment (they're all real threads)
- Progress bar from 3px to 5-6px, rounded ends
- Ratio text from 10px to 11-12px, tabular-nums
- Floating color dot replaced with 2px left border accent in intention color
- Intentions with no tasks: no progress bar, just title + left border. No empty "0/0"
- Intentions with tasks completed today: left border slightly more opaque

### Deadlines — Urgency Gradient
- Past due: subtle warm background tint (`bg-accent-warm/8`) + bolder red label
- Due today: warm-toned label, no background
- 2-3 days out: fully neutral (default)
- Same layout, same data — conditional styling only

### The Ledger — No Changes
- Empty state italic is fine
- MoneyMoves handles populated state

### Balance Awareness — Anchored
- Add subtle 2px left border (`border-text-muted/20`)
- Same whisper tone, just visually anchored instead of orphaned

### End-of-Day — Contextual Presence
- Before workday ends: invisible (current behavior)
- After workday ends: text gains opacity to `text-text-secondary`, subtle warm left border
- No animation, just presence shift

### Spacing Rhythm
- After Ledger: `my-5` (unchanged)
- After FocusCapacity: `my-4` (tighter — compact section)
- After Intentions: `my-6` (breathing room — meatiest section)
- After Balance/Deadlines: `my-5` (standard)

## Constraints
- Pure visual changes — no new state machines or data flow
- Respects existing design tokens and gravity system
- No layout shifts or collapse/expand mechanics
