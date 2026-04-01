# Quick Captures — Design

## Concept

Post-it style quick captures that live for one day. Two entry points for two purposes: a global hotkey for speed capture, a sidebar icon for review and processing. Unprocessed captures auto-clear at midnight.

## Entry Points

### Global hotkey (`Cmd+Shift+.`)

Spotlight-style centered overlay. Single text field, Enter to save, Escape to dismiss. No list, no chrome — pure speed. Disappears immediately after capture.

### Sidebar icon

Post-it icon in the sidebar strip (w-12). Shows a badge count when unprocessed captures exist. Click opens a popover panel from the left.

## Sidebar Popover

- Text input at top for inline capture
- Today's captures listed below as post-it styled cards
- Each card shows: text, timestamp, action menu
- Action menu (3 options):
  - **Make task** — creates an Asana task via existing sync
  - **Send to Notion** — appends to a configured default Notion page
  - **Dismiss** — removes immediately
- Empty state when no captures exist

## Visual Style

- Multi-color post-it cards — randomly assigned from a palette of post-it colors (yellow, pink, blue, green, orange, lavender)
- Drop shadow on each card
- No rotation
- Compact — text + timestamp + action dots

## Data

### Storage

Existing `scratch.entries` in electron-store: `{ id, text, createdAt }`. Add a `color` field for the assigned post-it color.

### Lifecycle

- Midnight cleanup: timer (or on-wake check) clears entries from previous days
- Processing a capture (make task / send to Notion / dismiss) removes it from the store
- Ink integration: existing `ink-prompts.ts` already feeds today's captures into briefing context. Ink surfaces remaining captures during evening reflection.

### Notion destination

Configured once in settings — a Notion page ID where captures are appended as bullet points. Uses the Notion MCP server (already connected).

## What This Is Not

- Not a notes app — captures are ephemeral, one day max
- Not a task inbox — captures are raw thoughts that may or may not become tasks
- No categories, tags, or organization — just text on a post-it
