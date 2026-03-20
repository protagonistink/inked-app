# MorningBriefing.tsx — Decomposition Design
**Date:** 2026-03-20
**Status:** Approved

---

## Context

`MorningBriefing.tsx` is 683 lines. The file manages a 5-phase AI chat flow (idle → interview → briefing → conversation → committing) with 9 `useState` hooks, 5 `useRef` hooks, 7 `useEffect` hooks, and 10 `useCallback` functions — all in one component, interleaved with ~350 lines of JSX.

`MorningWelcome`, `MorningSidebar`, `useBriefingStream`, and `morningBriefingUtils` are already extracted. What remains is the orchestration logic, four inline UI sections (schedule chips, commit chips, ritual suggestions, input bar), and `MessageBubble` defined at the file bottom.

No behavior changes in this plan. The extraction is a pure structural refactor.

---

## Shared Types (New File)

### `src/types/briefing.ts`

`Phase` and `BriefingVariant` must be accessible in both `useBriefingState` (hook) and `BriefingInput` (component). Keeping them in `MorningBriefing.tsx` and re-exporting would create a circular import (`MorningBriefing` → `BriefingInput` → `MorningBriefing`). Move them to a shared types file instead.

```typescript
export type Phase = 'idle' | 'interview' | 'briefing' | 'conversation' | 'committing';
export type BriefingVariant = 'fullscreen' | 'overlay';
```

Both types are currently defined in `MorningBriefing.tsx` lines 24–25 and must be removed from there.

---

## Files to Create

### 1. `src/hooks/useBriefingState.ts`

Owns all state, refs, effects, and callbacks. Calls `useApp()` and `useBriefingStream()` internally. Receives `{ onClose, onStreamingChange, mode, variant }` as input. `onNewChat` is NOT passed to the hook — it's a pure UI prop used only in the header button and stays in `MorningBriefing`.

**Returns two grouped objects:**

```typescript
interface BriefingState {
  phase: Phase;
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (v: string) => void;
  commitChips: CommitChip[];
  scheduleChips: ScheduleChip[];
  committed: boolean;
  pendingRituals: string[];
  proposalDate: string;
  proposalLabel: string;
  resolvedInkMode: InkMode | null;
  promptInkMode: InkMode;
  streamingContent: string;        // raw — used for the cursor pulse guard
  visibleStreamingContent: string; // stripped — used for ReactMarkdown render
  isStreaming: boolean;
  error: string | null;
  isWelcomeScreen: boolean;
  isOverlay: boolean;
  messagesEndRef: RefObject<HTMLDivElement>;
  inputRef: RefObject<HTMLTextAreaElement>;
  viewDate: Date;
  addRitual: (title: string) => void;  // from useApp — passed to RitualSuggestions.onAdd
  skipRitual: (index: number) => void; // removes pendingRituals[index] — passed to RitualSuggestions.onSkip
}

interface BriefingActions {
  handleStartDay: (intention: string) => void;
  sendMessage: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  showCommitChips: () => void;
  executeCommit: () => void;
  executeSchedule: () => Promise<void>;
  toggleChip: (index: number) => void;
  toggleScheduleChip: (index: number) => void;
  openRevision: (seed?: string) => void; // resets to conversation phase, clears chips, seeds input
}
```

**Notes on `skipRitual`:** replaces the raw `setPendingRituals` dispatcher. Encapsulates `setPendingRituals((prev) => prev.filter((_, j) => j !== index))`. The `RitualSuggestions` component calls `onAdd(title)` then `onSkip(index)` — the parent wires them to `state.addRitual` and `state.skipRitual` respectively.

**Internal to the hook (not returned):**
- `startConversation` — called by `sendMessage` and `handleStartDay`
- `parseTasksFromMessage` — called by `showCommitChips` only
- `buildContext` — passed directly to `useBriefingStream`
- All refs: `phaseRef`, `hasStartedBriefingRef`, `closeTimeoutRef`

**`extractInterviewContext` moves here** from the top of `MorningBriefing.tsx` — it's a private implementation detail of the hook's `onAssistantMessage` callback, not a general parsing utility.

---

### 2. `src/components/ScheduleChips.tsx`

Renders the schedule proposal chip list and "Lock it in" button. Only renders when `phase === 'committing' && chips.length > 0` — the `!committed` guard lives in the **parent JSX** (`MorningBriefing`), not inside this component.

```typescript
export function ScheduleChips({
  chips,
  proposalLabel,
  isOverlay,
  onToggle,
  onExecute,
}: {
  chips: ScheduleChip[];
  proposalLabel: string;
  isOverlay: boolean;
  onToggle: (index: number) => void;
  onExecute: () => void;
})
```

Includes time label formatting (`startHour:startMin – endHour:endMin`) inline. ~60 lines.

---

### 3. `src/components/CommitChips.tsx`

Renders the task commit chip list and "Lock it in" button. The `!committed` guard and `scheduleChips.length === 0` check live in the **parent JSX** (`MorningBriefing`), not inside this component.

```typescript
export function CommitChips({
  chips,
  proposalLabel,
  isOverlay,
  onToggle,
  onExecute,
}: {
  chips: CommitChip[];
  proposalLabel: string;
  isOverlay: boolean;
  onToggle: (index: number) => void;
  onExecute: () => void;
})
```

Shows `matched` / `new` badge per chip. ~60 lines.

---

### 4. `src/components/RitualSuggestions.tsx`

Renders the pending ritual Add/Skip cards.

```typescript
export function RitualSuggestions({
  rituals,
  onAdd,
  onSkip,
}: {
  rituals: string[];
  onAdd: (title: string) => void;   // calls addRitual(title) — does NOT remove from list
  onSkip: (index: number) => void;  // removes ritual at index from pendingRituals
})
```

The component calls `onAdd(title)` then `onSkip(index)` for the Add button (add and remove), and calls `onSkip(index)` only for the Skip button. The parent wires: `onAdd={state.addRitual}` and `onSkip={state.skipRitual}`. ~40 lines.

---

### 5. `src/components/BriefingInput.tsx`

Renders the input bar: commit-trigger button + textarea + send button.

```typescript
import type { Phase } from '@/types/briefing';

export function BriefingInput({
  inputValue,
  isStreaming,
  phase,
  messagesLength,
  isOverlay,
  inputRef,
  onChange,
  onKeyDown,
  onSend,
  onShowCommit,
  onOpenRevision,
}: {
  inputValue: string;
  isStreaming: boolean;
  phase: Phase;
  messagesLength: number;
  isOverlay: boolean;
  inputRef: RefObject<HTMLTextAreaElement>;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onShowCommit: () => void;
  onOpenRevision: (seed?: string) => void;
})
```

Imports `Phase` from `@/types/briefing` (not from `MorningBriefing`). ~80 lines.

**Input area outer condition:** Parent renders `{!committed && <BriefingInput ...>}` — the wrapper now shows whenever `!committed` regardless of phase. Inside, `BriefingInput` conditionally renders:
- "Ready to commit?" trigger when `messages.length > 2 && !isStreaming && phase !== 'interview' && phase !== 'committing'`
- "Rework with Ink" block when `phase === 'committing'` (calls `onOpenRevision(seed)`)
- Textarea + send button always

Parent wires: `onOpenRevision={actions.openRevision}`

---

### 6. `src/components/MessageBubble.tsx`

Moved from the bottom of `MorningBriefing.tsx`. Uses `stripStructuredAssistantBlocks` from `morningBriefingUtils`. No logic changes.

```typescript
export function MessageBubble({
  message,
  isFirst,
}: {
  message: ChatMessage;
  isFirst: boolean;
})
```

~30 lines.

---

## File to Modify

### `src/components/MorningBriefing.tsx`

**Remove:**
- `Phase` and `BriefingVariant` type definitions (move to `src/types/briefing.ts`)
- `extractInterviewContext` function (moves into `useBriefingState`)
- All `useState`, `useRef`, `useEffect`, `useCallback` declarations (moves into hook)
- `buildContext`, `doneTasks`, `promptInkMode`, `proposalLabel`, `isWelcomeScreen`, `isOverlay`, `visibleStreamingContent` derivations
- All 4 inline JSX sections (schedule chips, commit chips, ritual suggestions, input area)
- `MessageBubble` function (moves to own file)

**`onNewChat` stays** as a prop of `MorningBriefing` — used only in the header "New chat" button, never passed to the hook.

**Add imports:**
```typescript
import type { BriefingVariant } from '@/types/briefing';
import { useBriefingState } from '@/hooks/useBriefingState';
import { ScheduleChips } from './ScheduleChips';
import { CommitChips } from './CommitChips';
import { RitualSuggestions } from './RitualSuggestions';
import { BriefingInput } from './BriefingInput';
import { MessageBubble } from './MessageBubble';
```

**Result skeleton:**
```typescript
export function MorningBriefing({ onClose, onNewChat, onStreamingChange, mode, variant }) {
  const { state, actions } = useBriefingState({ onClose, onStreamingChange, mode, variant });
  // ~100 lines of layout JSX
  // Chip sections render with !state.committed guard in JSX
  // <ScheduleChips onToggle={actions.toggleScheduleChip} onExecute={actions.executeSchedule} ... />
  // <CommitChips onToggle={actions.toggleChip} onExecute={actions.executeCommit} ... />
  // <RitualSuggestions onAdd={state.addRitual} onSkip={state.skipRitual} ... />
  // <BriefingInput onSend={actions.sendMessage} onShowCommit={actions.showCommitChips} ... />
}
```

`MorningBriefing.tsx` drops from 683 to ~110 lines.

---

## Critical Files

| File | Action |
|------|--------|
| `src/types/briefing.ts` | **Create** — `Phase`, `BriefingVariant` types |
| `src/hooks/useBriefingState.ts` | **Create** — all state, effects, callbacks |
| `src/components/ScheduleChips.tsx` | **Create** |
| `src/components/CommitChips.tsx` | **Create** |
| `src/components/RitualSuggestions.tsx` | **Create** |
| `src/components/BriefingInput.tsx` | **Create** |
| `src/components/MessageBubble.tsx` | **Create** (moved from MorningBriefing bottom) |
| `src/components/MorningBriefing.tsx` | **Modify** — remove logic, add imports |

No changes to: `AppContext.tsx`, `useBriefingStream.ts`, `morningBriefingUtils.ts`, `MorningWelcome.tsx`, `MorningSidebar.tsx`.

---

## Verification

```bash
npm run build
```

TypeScript must compile clean. No runtime behavior changes — same phases, same chip behavior, same streaming, same commit/schedule flows.

Manual smoke test in Electron: open morning briefing, verify welcome screen, send a message, confirm streaming renders, trigger commit chips and schedule chips, check ritual suggestion cards, close.
