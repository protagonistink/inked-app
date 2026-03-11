# TimeFocus Memory

## What This App Is

TimeFocus is a personal desktop planning and focus app for a single user.

Core loop:
- weekly intentions
- daily commit
- timeboxing against calendar reality
- quiet execution with a floating pomodoro
- objective-level time logging

Positioning:
- closer to Sunsama's ritual discipline than Akiflow's everything-machine
- lighter, calmer, and more narrative in tone
- built for a "Zen storyteller yogi" working mind, not a generic productivity audience

## Current Product Structure

Main surfaces:
- `Weekly Intentions`
- `Today's Commit`
- `Timeline`
- `Archive`

Supporting behavior:
- Asana is the upstream task source
- Google Calendar is the writable scheduling surface
- focus sessions log time to objectives, not just tasks
- a floating always-on-top pomodoro window lives outside the main app window

## Important Architectural State

State and model:
- `src/context/AppContext.tsx` is the main app state spine
- `src/types/index.ts` contains `WeeklyGoal`, `PlannedTask`, `ScheduleBlock`, `DailyPlan`, and `TimeLogEntry`
- tasks can be `candidate`, `committed`, `scheduled`, `done`, `migrated`, or `cancelled`

Integrations:
- `electron/asana.ts` handles Asana fetches
- `electron/gcal.ts` handles Google Calendar read/write and now supports multiple selected Google calendars plus a write target
- `electron/preload.ts` and `src/types/electron.d.ts` expose integration APIs

UI:
- `src/components/Sidebar.tsx` is collapsible and uses real app/source icons
- `src/components/UnifiedInbox.tsx` is source-based, with a cover panel and Asana source lane
- `src/components/TodaysFlow.tsx` handles commitment and intention grouping
- `src/components/Timeline.tsx` handles scheduling, drag into time, and drag back out of time
- `src/components/PomodoroTimer.tsx` drives focus sessions and the floating timer

## Working Behaviors Already Implemented

- visible `Start focus` button on task cards
- drag tasks from Asana into Today's Commit
- drag tasks between intentions in Today's Commit
- drag tasks into the calendar
- drag scheduled focus blocks back out of the calendar into Today's Commit
- 30-minute move/resize on focus blocks
- local objective-linked time logging
- real app icon wired into sidebar/web/Electron packaging
- multiple Google calendar selection and single write target in settings

## Known Limits / Open Issues

These were actively under discussion and not all are resolved:

- Google Calendar API errors currently dump raw JSON-ish error text into the left rail; that should be cleaned up into human-readable messaging
- timeline drop alignment still feels off; tasks are not lining up to hours cleanly enough
- the task-card pomodoro play affordance works, but the visual treatment could feel more premium
- sidebar collapse still needs a more standard top-corner arrow treatment and smoother animation polish
- weekly planning currently opens too aggressively; desired behavior is a modal inside the main window that appears on Monday morning as part of planning, not every load
- `Now + Next` is still under-explained in the UI and may need either better behavior or clearer framing
- dragging a block back from the calendar needs stronger animation/feedback so it reads as intentional, not broken
- "day complete" treatment on the timeline is interesting but not yet premium; a movable shading / visual-dayfall treatment is a candidate direction
- the first left column should read more like a utilitarian source center, visually distinct from the rest of the workspace
- weekly intentions screen still needs refinement:
  - replace the lower candidates block with a weekly view above and three intentions below
  - make intentions editable/changeable directly in the UI

## Tone and Visual Direction

Language:
- quiet
- precise
- lightly contemplative
- not chirpy
- not managerial

Visual direction:
- cinematic
- gorgeous but restrained
- atmospheric rather than loud
- premium material feel over dashboard chrome

## User Preferences

- direct communication
- no filler enthusiasm
- no buzzword language
- prose over bullets when possible, but bullets are fine for state capture like this
- treat the user like a peer

## Verification Baseline

Most recent verified commands before this file:
- `npx tsc --noEmit` passed
- `npx vite build` passed

## Recent Visual Pass

Completed visual work:
- preserved the existing product bones and main layout
- introduced a shared surface language for premium panel/card/inset/pill treatments
- aligned the visual system more tightly to the `trueblack / ink / rust / warmwhite` brand palette
- reduced decorative teal usage so teal reads more as semantic support than general accent
- gave the source rail, commit column, timeline, and weekly intentions a more unified material feel
- added more tactile texture and layered depth to panels rather than relying on one-off card styling
- pushed focus mode further toward "theater mode":
  - non-focal panels recede harder
  - chrome and metadata fade back more aggressively
  - the timeline reads more like the lit stage

Files touched in that pass:
- `src/styles/globals.css`
- `src/components/UnifiedInbox.tsx`
- `src/components/TodaysFlow.tsx`
- `src/components/Timeline.tsx`
- `src/components/WeeklyIntentions.tsx`

What still needs live review:
- run the app and inspect the feel of the new surface depth in motion
- confirm theater mode feels intentional rather than merely dimmed
- check whether any panel texture is now slightly too heavy in the actual window

## Recent Polish Pass

Completed polish work after the last visual pass:
- focus-mode scheduled blocks were pushed further toward matte:
  - removed the harsher glossy highlight read from editable focus blocks
  - kept hard calendar events visually distinct from focus blocks
  - added a dedicated focus-block treatment rather than flattening all cards globally
- the `Balance` callout in `Today's Commit` no longer uses the brighter sky-blue treatment:
  - it now sits in a quieter blue-slate / cool-semantic lane
  - the distinction remains semantic, but less like a default alert color
- the top header band was simplified across the main workspace:
  - introduced a shared header system for kicker / title / subline / meta rhythm
  - aligned `Source Center`, `Today's Commit`, and the timeline header so they read as one product instead of three unrelated bars
- the right-side timeline header was aggressively reduced:
  - removed the current-time pill from the header
  - removed the dead three-dot overflow button
  - removed `Refresh` and `Clear Calendar`
  - removed `View`
  - kept only the frame label plus editable end-of-day information
- the instructional strip under the timeline header was rewritten to be shorter and quieter:
  - now reads: `Drag into time. Use the return handle to pull a block back out.`

Files touched in this polish pass:
- `src/styles/globals.css`
- `src/components/TodaysFlow.tsx`
- `src/components/Timeline.tsx`
- `src/components/UnifiedInbox.tsx`

Design conclusions from this pass:
- the critique about glossy focus cards was correct
- the critique about blue was only partially correct:
  - the problem was not "blue exists"
  - the problem was that the previous `Balance` blue felt too bright and too generic for the rest of the palette
- the timeline header had accumulated too many controls and too much competing hierarchy
- the cleaner direction is subtraction, not restyling

What still needs live review after this pass:
- whether the remaining right-header content should be reduced even further or is now appropriately spare
- whether the new `Balance` cool tone should go slightly grayer in the actual app window
- whether the matte focus-block treatment still has enough presence once seen in motion

## Current Tech Debt Priority

The app currently feels most fragile in these places:
- `src/context/AppContext.tsx` is carrying too many responsibilities:
  - planner state
  - persistence
  - external sync
  - calendar scheduling rules
  - optimistic local/remote reconciliation
- calendar scheduling and GCal write logic are intertwined with UI state mutation
- some Electron boundary code still relies on loose typing / `any`
- timeline drag / resize interactions are functional but hand-rolled and duplicated

Best next structural pass:
- extract scheduling and calendar sync logic out of `AppContext`
- reduce the provider to app-state orchestration instead of business-logic storage
- tighten integration typing where `window.api` results are currently loose

## Next Useful Pass

If work resumes, the highest-value next pass is:
- structural tech-debt reduction in `AppContext` and scheduling flow
- then a live runtime pass on theater mode / texture balance
- then clean error presentation and interaction polish
