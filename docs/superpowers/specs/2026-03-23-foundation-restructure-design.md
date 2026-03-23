# Inked Foundation Restructure — Phase 1: Architecture

**Date:** 2026-03-23
**Narrative:** "Plot your story for the day."
**Approach:** Architecture-first rebuild (Approach B) — decompose App.tsx into mode-based architecture, reorganize components by domain, kill dead views, establish clear product hierarchy. Visual redesign deferred to Phase 2.

---

## 1. Product Architecture

### Two views

1. **Flow** (default) — the day. Ink + Timeline + Right Rail + Inbox (planning only).
2. **Intentions** — weekly + monthly intentions in one view, with weekly money goal.

### Three app modes within Flow

1. **Briefing** — App opens to Ink. Blue 1-on-1 space. 3 questions max. Ink drafts the day.
2. **Planning** — Full view: inbox visible, timeline loaded with Ink's draft + calendar events, right rail showing context. User adjusts manually.
3. **Executing** — Inbox collapsed, sidebar collapsed, timeline + right rail only. Ink accessible via floating button. Right rail shifts to end-of-day nudge at planned close time.

### Focus (sub-mode of executing)

- Task is the hero, timer is the heartbeat.
- Time-of-day awareness ("2:45pm — 47 minutes left in this block").
- Ambient intention context (which of the 3 weekly intentions this task serves).
- Timer runs in-app (prominent) AND in tray (glanceable outside the app).
- Everything else gone — no inbox, no sidebar, no rail, no calendar.

### Transitions

- **Briefing → Planning:** Automatic after Ink conversation completes.
- **Planning → Executing:** "Start my day" button OR clicking any task (action starts the day).
- **Executing → Focus:** Clicking a task's focus/start action.
- **Pomodoro:** Always manual. Never auto-triggered by state changes.
- **Planning toggle:** Always available to reopen inbox mid-day via deliberate action.

### Ink handles all planning conversations

- **Daily:** 3 questions max, builds the day.
- **Weekly:** Sets 3 intentions. Replaces WeeklyPlanningWizard entirely.
- **Monthly:** Sets the one thing and why. Replaces MonthlyPlanningWizard entirely.
- All planning happens in the same blue Ink screen. No modal wizards. No duplicate workflows.
- The Intentions view is for viewing and editing what Ink produced — not for running the planning process.

---

## 2. Layout & Navigation

### Sidebar

- Collapsed by default. Small icon strip or hamburger on the left edge.
- Hover to expand as a glassmorphic overlay (doesn't push content).
- Contains: Flow, Intentions, Settings.
- Cmd+K command palette for power users (stripped down to navigation and task actions only — no light/dark/focus toggles).

### Window chrome

- Consistent macOS title bar drag region across the top of every view. Always-present, never inconsistent.
- Full native menu bar:
  - **File:** New Task, New Event (if calendar connected)
  - **Edit:** Standard undo/redo/cut/copy/paste
  - **View:** Flow, Intentions, Toggle Sidebar, Toggle Inbox
  - **Go:** Today, Start Day, Open Ink
  - **Window:** Standard minimize/zoom/fullscreen
  - **Help:** About, Settings, Keyboard Shortcuts

### Right Rail (always visible in Flow)

1. **Focus Capacity** — human language ("You have about 4 hours of deep work today"), based on hours not block counts.
2. **Your 3 Intentions** — weekly anchors, always visible.
3. **Balance awareness** — Ink monitors drift across intentions. Gentle observations, not warnings. ("DRIVR's getting love today. The Upwork proposal hasn't moved since Tuesday.")
4. **Money Moves** — what needs to happen financially today.
5. **Hard Deadlines** — only real deadlines.
6. **Ink link** — quick access to open a conversation.
7. **End-of-day nudge** — appears at planned close time, replaces or appears below focus capacity. "Ready to close out?" Tap to open Ink in reflection mode. Fully ignorable. No pop-ups, no overlays, no fullscreen takeovers.

### Inbox (UnifiedInbox)

- Visible column during Planning mode only.
- Collapses on transition to Executing.
- Reopenable via deliberate action (button or cmd+k) to grab something mid-day.
- Never opens automatically after commit.

### Pomodoro timer

- Prominent in-app during Focus mode (fills space alongside current task).
- Always in tray for outside-app glanceability.
- Separate mini-window killed.

---

## 3. Ink's Role & Behavior

### Ink is the narrator, not a chatbot

**Planning conversations (the interviews):**
- Daily: 3 questions max, builds the day. Holds full context through the conversation.
- Weekly: Sets 3 intentions. Replaces WeeklyPlanningWizard entirely.
- Monthly: Sets the one thing and why. Replaces MonthlyPlanningWizard entirely.
- All planning happens in the same blue Ink screen.

**Ambient presence throughout the app:**
- Right rail copy has Ink's voice.
- Morning greeting before questions start.
- End-of-day nudge in the right rail.
- Balance awareness across intentions.
- Subtle acknowledgments when you complete a block or rearrange.
- Not a chat window you visit — the voice of the app.

**Reflection & memory:**
- End of day: Ink asks "how did today go?" when you tap the nudge. Opens in Ink panel, not fullscreen.
- Cross-day memory: Ink holds end-of-day reflections for 7 days as active context. Monday morning, Ink can reference "last Thursday you said the Upwork proposal felt stuck."
- After 7 days, reflections roll off active context (archived separately, not loaded into working memory).
- Even if you skip reflection, Ink knows what you did/didn't finish and weaves it into tomorrow.
- Weekly context: Last 7 days of journal/reflection entries inform Ink's awareness.

**General conversation:**
- After briefing is done, Ink is available for any conversation — product thinking, brainstorming, not just planning.

**Context window fix (critical):**
- Current limit of ~6 question/response pairs causes Ink to lose the thread during interviews and forget earlier answers.
- Extend significantly — full conversation history must stay in context for the duration of any planning session.
- This is the root cause of repetitive questions and context loss.

---

## 4. What Gets Cut

### Views removed
- Archive tab (reflection moves to Ink's end-of-day conversation + 7-day memory)
- Money tab / MoneyView (financial context lives in right rail, briefing, and Intentions)
- Scratch view / ScratchPanel / ScratchView (Apple Notes covers this)
- Quick Capture / CaptureWindow (cut)

### Components removed
- `WeeklyPlanningWizard` (Ink handles weekly planning)
- `MonthlyPlanningWizard` (Ink handles monthly planning)
- `CaptureWindow` + capture IPC handlers
- `ScratchPanel` + `ScratchView`
- `FocusScratchPanel`
- `Archive` component
- `MoneyView` component
- Pomodoro separate window
- `AtmosphereLayer` particle animation (evaluate fit with cleaner direction)

### Electron modules removed
- `monarch.ts` (API doesn't work, removing integration)
- `capture.ts` + related handlers
- Quick capture global shortcut (Cmd+Shift+.)

### Dependencies removed
- `monarch-money-api`

### UI elements cleaned up
- Light/dark mode toggle removed from Cmd+K (moves to Settings)
- Focus mode toggle removed from Cmd+K (not a click-on option)
- "Quiet focus" mode deleted (flagged as OLD)
- Physics/energy warnings removed from UI
- Queue/block count anxiety metrics removed from rail

### Old patterns killed
- Duplicate planning workflows (wizard + Ink)
- Any planning path that doesn't go through Ink

---

## 5. Focus Mode Redesign

### Task as hero

When you enter focus on a task, the app transforms:
- **The task** — front and center, large and clear. Title, which intention it serves (subtle, color-coded).
- **The timer** — prominent, counting. Fills the space.
- **Time-of-day awareness** — contextual, not a calendar. "2:45pm — 47 minutes left in this block."
- **Everything else gone** — no inbox, no sidebar, no rail, no calendar. Just the work and the clock.

### Timer behavior
- Pomodoro always manual — entering focus doesn't start the timer.
- Timer runs in-app (prominent) AND in tray (glanceable).
- Break prompts are gentle, not modal takeovers.
- "I'm done" button to complete the task and return to executing view.

### Exiting focus
- ESC exits focus.
- Completing the task exits focus.
- Timer ending shows gentle prompt, doesn't force anything.

---

## 6. Code Architecture

### App.tsx decomposition

Break 527-line conditional pile into mode-based architecture:
- `App.tsx` — thin shell, provider setup, mode router
- `modes/BriefingMode.tsx` — the Ink 1-on-1 opening
- `modes/PlanningMode.tsx` — full layout with inbox, timeline, rail
- `modes/ExecutingMode.tsx` — collapsed layout, timeline + rail
- `modes/FocusMode.tsx` — task hero + timer

Each mode owns its layout. No more pile of conditionals deciding what's visible.

### Component reorganization

Flat 43 siblings → domain folders:
- `components/ink/` — MorningBriefing, BriefingInput, MessageBubble, Thread, MorningWelcome, MorningMoneyBlock
- `components/timeline/` — Timeline, BlockCard, CurrentTimeIndicator, BeforeHoursVeil, AfterHoursVeil, OpenInterval, DeadlineMargin
- `components/rail/` — RightRail (new), FocusCapacity, IntentionsSummary, MoneyMoves, Deadlines, InkLink, EndOfDayNudge, BalanceAwareness
- `components/inbox/` — UnifiedInbox (simplified)
- `components/intentions/` — IntentionsView (new, combines weekly + monthly), GoalSection
- `components/focus/` — FocusView (new, task hero + timer)
- `components/chrome/` — Sidebar, CommandPalette, Settings
- `components/shared/` — TaskCard, DragOverlay, AppIcons, InkedLogo

### State machine cleanup

- `DayCommitState` simplified: `briefing → planning → executing → reflecting`
- Mode transitions as a proper state machine, not scattered conditionals.
- Focus as a sub-state of executing, not a separate system.

### Electron cleanup

- Remove `monarch.ts`, `capture.ts` related handlers.
- Remove quick capture IPC + global shortcut.
- Extend Ink's context window (raise token limits, keep full conversation in context).
- Remove pomodoro separate window creation from `main.ts`.
- Remove capture namespace from preload.

---

## 7. Phase 1 Boundaries — What Stays Untouched

### Deferred to Phase 2 (Visual Design)
- Typography overhaul (killing Cormorant italic, new type system)
- Color system (fixing the dark/depressing feel)
- Glassmorphic sidebar styling (structure in Phase 1, visual polish in Phase 2)
- Light mode CSS fixes
- Animation/motion design
- Task pill redesign on timeline
- Welcome animation for morning Ink

### Integrations unchanged
- Asana sync
- Google Calendar
- Plaid/financial (minus Monarch)
- Anthropic/Claude API (context window extended, integration unchanged)

### Systems unchanged
- Drag-drop system (works, don't touch beyond mode changes)
- IPC bridge structure (remove capture/monarch namespaces only)
- electron-store + SQLite data layer

### Bugs deferred
- Drag smoothness (text selection on pills, lock vs drag)
- Dynamic time feedback while dragging
- Ritual block dragging
- Asana project filtering
- Asana two-way sync
- Editorial calendar integration
- Desktop widget
- Onboarding flow

---

## 8. Asana Items Addressed

This restructuring directly addresses ~25 open items from the Inked bug/workflow backlog:

**Resolved by design:**
- "Make the AI the executive assistant" — Ink-first opening, 3 questions, builds the day
- "AI in weekly and monthly planning" — Ink handles all planning, wizards killed
- "Make sense of workflow once you click start day" — explicit mode transitions
- "Need to clean up workflow issue" — briefing → planning → executing flow
- "Split Commit and Focus into two distinct buttons" — separate transitions
- "UX Principle: Commit button triggers execution mode" — planning/executing states
- "Source panel never opens automatically after commit" — inbox collapses
- "Design end-of-day closure workflow" — right rail nudge + Ink reflection
- "Open with left sidebar collapsed" — glassmorphic hover sidebar
- "Need to rewrite sidebar menu" — new sidebar design
- "Quiet focus mode is OLD, should be deleted" — cut
- "End-of-day close-out" — Ink reflection with 7-day memory
- "Design: Good Morning and nighttime Ink panel" — morning Ink experience
- "Shorten Ink's interview questions" — 3 questions max
- "Extend Ink's context window" — critical fix included
- "Journal memory — Ink remembers across sessions" — 7-day reflection memory
- "Weekly intentions walks through old workflow vs Ink" — old workflow killed
- "Allow other subjects in LLM chat" — Ink available for any conversation
- "Double clicking task should start that task" — action starts the day
- "Revise monthly calendar planning" — merged into Intentions view

**Superseded / can be closed:**
- "Add a quick capture for notes" — feature cut
- "Have calendar collapse until tasks chosen" — Ink-first opening handles this
- "Ink can be a little more friendly" — ambient Ink presence throughout app
