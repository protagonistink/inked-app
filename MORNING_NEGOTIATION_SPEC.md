# Morning Negotiation — Build Spec
## Feature: AI-powered morning planning conversation inside TimeFocus

---

## What This Is

A chat panel inside TimeFocus where Patrick negotiates his real day. It opens on launch (or on demand via sidebar), runs a briefing using live data from Asana and Google Calendar, and lets him debate what actually belongs in Today's Commit. When the conversation reaches a list, tasks commit directly into the app — no copy-paste, no translation step.

This is not a generic AI chat widget. The model has full context about the day before the conversation starts. It knows what's in Asana, what's overdue, what goals are getting starved, what the focus capacity looks like, and what deadlines are coming. The conversation is adversarial in the best sense — it pushes back, flags stale tasks, and refuses to let an overcommitted day slide past without comment.

---

## Architecture Overview

```
Electron Main Process                    Renderer (React)
─────────────────────────────────────    ─────────────────────────────────────
electron/anthropic.ts                    src/components/MorningBriefing.tsx
  - registerAnthropicHandlers()            - chat UI
  - builds context object from              - message rendering
    Asana + store data                      - commit-from-conversation button
  - calls Anthropic API (streaming)         - "Start my day" trigger

electron/main.ts                         src/context/AppContext.tsx
  - import + register anthropic            - existing bringForward()
    handler alongside asana/gcal           - existing addLocalTask()
                                           - no changes needed here

electron/preload.ts                      src/App.tsx
  - expose window.api.ai.chat()           - render <MorningBriefing /> in
  - expose window.api.ai.stream()           AppLayout alongside existing panels

electron/store.ts
  - add anthropic.apiKey to defaults
```

The pattern is identical to how `asana.ts` works. The renderer calls `window.api.ai.chat()` via IPC, the main process makes the Anthropic API call, streams the response back to the renderer token by token.

---

## Files to Create

### 1. `electron/anthropic.ts` (new)

The core handler. Registers two IPC channels:

**`ai:chat`** — Non-streaming. Takes a messages array + context object. Returns the full response. Use for single-shot calls if needed.

**`ai:stream`** — Streaming. Takes the same input, pushes tokens back to the renderer via `event.sender.send('ai:stream:token', token)` as they arrive. Renderer listens and builds the message character by character.

```typescript
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import Store from 'electron-store';

const store = new Store();

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface BriefingContext {
  date: string;
  weeklyGoals: Array<{ title: string; why?: string }>;
  asanaTasks: Array<{
    title: string;
    dueOn: string | null;
    priority?: string;
    project?: string;
    daysSinceAdded?: number; // compute this from task age if available
  }>;
  availableFocusMinutes: number;
  scheduledMinutes: number;
  committedTasks: Array<{ title: string; estimateMins: number; weeklyGoal: string }>;
  countdowns: Array<{ title: string; daysUntil: number }>;
  workdayEndHour: number;
}

export function buildSystemPrompt(context: BriefingContext): string {
  // SEE SYSTEM PROMPT SECTION BELOW
}

export function registerAnthropicHandlers() {
  ipcMain.handle('ai:chat', async (_event, messages: ChatMessage[], context: BriefingContext) => {
    const apiKey = store.get('anthropic.apiKey') as string;
    if (!apiKey) throw new Error('Anthropic API key not configured. Go to Settings.');

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: buildSystemPrompt(context),
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    return { success: true, content: data.content[0].text };
  });

  // Streaming variant — pushes tokens to renderer in real time
  ipcMain.handle('ai:stream:start', async (event: IpcMainInvokeEvent, messages: ChatMessage[], context: BriefingContext) => {
    const apiKey = store.get('anthropic.apiKey') as string;
    if (!apiKey) throw new Error('Anthropic API key not configured.');

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        stream: true,
        system: buildSystemPrompt(context),
        messages,
      }),
    });

    if (!response.ok || !response.body) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    // Read SSE stream and push tokens to renderer
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const token = parsed.delta?.text;
          if (token) {
            event.sender.send('ai:stream:token', token);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    event.sender.send('ai:stream:done');
    return { success: true };
  });
}
```

**Register in `electron/main.ts`:**
```typescript
import { registerAnthropicHandlers } from './anthropic';
// inside app.whenReady():
registerAnthropicHandlers();
```

---

### 2. `electron/preload.ts` — additions

Add to the existing `contextBridge.exposeInMainWorld` call:

```typescript
ai: {
  chat: (messages: unknown[], context: unknown) =>
    ipcRenderer.invoke('ai:chat', messages, context),
  streamStart: (messages: unknown[], context: unknown) =>
    ipcRenderer.invoke('ai:stream:start', messages, context),
  onToken: (callback: (token: string) => void) => {
    const handler = (_event: unknown, token: string) => callback(token);
    ipcRenderer.on('ai:stream:token', handler);
    return () => ipcRenderer.removeListener('ai:stream:token', handler);
  },
  onDone: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.once('ai:stream:done', handler);
    return () => ipcRenderer.removeListener('ai:stream:done', handler);
  },
},
```

**Also add to `src/types/electron.d.ts`** (the window.api type declarations that already exist there):
```typescript
ai: {
  chat: (messages: ChatMessage[], context: BriefingContext) => Promise<{ success: boolean; content: string }>;
  streamStart: (messages: ChatMessage[], context: BriefingContext) => Promise<{ success: boolean }>;
  onToken: (callback: (token: string) => void) => () => void;
  onDone: (callback: () => void) => () => void;
}
```

---

### 3. `electron/store.ts` — additions

Add `anthropic` to the defaults object:

```typescript
const store = new Store({
  defaults: {
    anthropic: { apiKey: '' },
    asana: { token: '' },
    // ... rest unchanged
  }
});
```

---

### 4. `src/components/MorningBriefing.tsx` (new)

The chat panel. Key design decisions:

**State it manages:**
- `messages: { role: 'user' | 'assistant'; content: string }[]`
- `streamingContent: string` — the token being built in real time
- `isStreaming: boolean`
- `inputValue: string`
- `hasStarted: boolean` — whether the initial briefing has run

**On mount:** Auto-runs the briefing by calling `streamStart` with an empty user message (`"Run my morning briefing."`) and the full context object assembled from AppContext. The opening message appears to stream in, exactly like the existing morning thread.

**Context assembly** — the component reads from AppContext to build the `BriefingContext` object:
```typescript
const context: BriefingContext = {
  date: format(new Date(), 'EEEE, MMMM d'),
  weeklyGoals: weeklyGoals.map(g => ({ title: g.title, why: g.why })),
  asanaTasks: /* fetched fresh from window.api.asana.getTasks() on mount */,
  availableFocusMinutes,
  scheduledMinutes: scheduledFocusMinutes,
  committedTasks: dayTasks.map(t => ({
    title: t.title,
    estimateMins: t.estimateMins,
    weeklyGoal: weeklyGoals.find(g => g.id === t.weeklyGoalId)?.title || 'Unassigned'
  })),
  countdowns: countdowns.map(c => ({
    title: c.title,
    daysUntil: differenceInCalendarDays(parseISO(c.dueDate), new Date())
  })),
  workdayEndHour: workdayEnd.hour,
};
```

**Commit action** — when the conversation has produced a list of tasks to commit, a `Commit these tasks →` button appears. It calls `bringForward(taskId)` for each task that was surfaced. For Asana tasks already in the candidate list this works immediately. For tasks not yet in the local planner, it calls `addLocalTask(title)`. The exact mechanism for matching conversation output to task IDs is the trickiest part — see notes below.

**UI structure:**
```
┌─────────────────────────────────────────────────┐
│  Morning Briefing            [close ×]           │
│  Wednesday, March 11                            │
├─────────────────────────────────────────────────┤
│                                                  │
│  [assistant message — streaming in...]           │
│                                                  │
│  [user reply]                                    │
│                                                  │
│  [assistant reply]                               │
│                                                  │
│  ┌─────────────────────────────────────────┐    │
│  │ Commit these tasks →                    │    │
│  └─────────────────────────────────────────┘    │
├─────────────────────────────────────────────────┤
│  [input field]                        [Send →]   │
└─────────────────────────────────────────────────┘
```

Style it to match the app's existing `editorial-panel`, `editorial-card`, `editorial-inset` classes. Use `bg-bg-elevated`, `text-text-primary`, `accent-warm` for the send button. Match the font sizing (`text-[13px]` for body, `text-[10px]` for meta).

---

### 5. `src/components/Settings.tsx` — additions

Add an "AI" section alongside the existing Asana and GCal sections:

```tsx
// New state
const [anthropicApiKey, setAnthropicApiKey] = useState('');

// Load in existing useEffect
const anthropic = await window.api.store.get('anthropic') as { apiKey?: string } | undefined;
if (anthropic?.apiKey) setAnthropicApiKey(anthropic.apiKey);

// Save in existing handleSave
await window.api.store.set('anthropic', { apiKey: anthropicApiKey });

// New UI section (same pattern as Asana token field)
<section>
  <h3>AI (Morning Briefing)</h3>
  <label>Anthropic API Key</label>
  <input
    type="password"
    value={anthropicApiKey}
    onChange={e => setAnthropicApiKey(e.target.value)}
    placeholder="sk-ant-..."
  />
  <p>Get your key at console.anthropic.com. Used only for the Morning Briefing feature.</p>
</section>
```

---

### 6. `src/App.tsx` — additions

Add a `showBriefing` state and render `<MorningBriefing />` as a modal overlay (same pattern as `<Settings />`):

```tsx
const [showBriefing, setShowBriefing] = useState(false);

// Auto-open on launch if it's morning (before noon) and not already committed
useEffect(() => {
  const hour = new Date().getHours();
  const hasCommitted = dailyPlan.committedTaskIds.length > 0;
  if (hour < 12 && !hasCommitted) {
    setShowBriefing(true);
  }
}, []); // run once on mount

// In JSX:
{showBriefing && <MorningBriefing onClose={() => setShowBriefing(false)} />}
```

Also add a briefing button to the Sidebar — a sunrise or message icon that opens it manually at any time.

---

## The System Prompt

This is the most important file in the build. Get this wrong and the feature feels like a chatbot. Get it right and it feels like a collaborator who's been paying attention.

```typescript
export function buildSystemPrompt(ctx: BriefingContext): string {
  const goalsList = ctx.weeklyGoals
    .map(g => `- ${g.title}${g.why ? ` (why: ${g.why})` : ''}`)
    .join('\n');

  const asanaList = ctx.asanaTasks.length > 0
    ? ctx.asanaTasks.map(t => {
        const due = t.dueOn
          ? new Date(t.dueOn).toDateString() === new Date().toDateString()
            ? 'DUE TODAY'
            : `due ${t.dueOn}`
          : 'no due date';
        const priority = t.priority ? ` [${t.priority}]` : '';
        const project = t.project ? ` — ${t.project}` : '';
        return `- ${t.title}${priority}${project} (${due})`;
      }).join('\n')
    : 'No Asana tasks found.';

  const countdownsList = ctx.countdowns.length > 0
    ? ctx.countdowns.map(c => `- ${c.title}: ${c.daysUntil} day${c.daysUntil === 1 ? '' : 's'} out`).join('\n')
    : 'No active countdowns.';

  const alreadyCommitted = ctx.committedTasks.length > 0
    ? ctx.committedTasks.map(t => `- ${t.title} (${t.estimateMins}m, ${t.weeklyGoal})`).join('\n')
    : 'Nothing committed yet.';

  const capacityHours = (ctx.availableFocusMinutes / 60).toFixed(1);
  const scheduledHours = (ctx.scheduledMinutes / 60).toFixed(1);

  return `You are the morning planning voice inside TimeFocus, a focus and planning app.

Today is ${ctx.date}. The workday ends at ${ctx.workdayEndHour}:00.

Your job is to run a morning briefing with Patrick — a narrative strategist and screenwriter who runs Protagonist Ink. This is a conversation, not a report. You give him a sharp read of what's real, what's pressing, and what might be lying. He debates with you. Together you land on what actually goes into today's commit.

## Patrick's Weekly Goals
${goalsList}

## Asana Tasks (his current list)
${asanaList}

## Deadlines and Countdowns
${countdownsList}

## Already Committed Today
${alreadyCommitted}

## Focus Capacity
- Available focus time: ${capacityHours} hours
- Already scheduled: ${scheduledHours} hours

---

## Your character in this conversation

You are direct. You push back. You are not a yes machine.

If a task has been sitting in Asana without movement, say so. If the list is optimistic given the capacity, call it. If one goal is getting ignored all week, name it. If something is due today but isn't in the commit, flag it.

You are also not a bureaucrat. You don't lecture. You move fast, you make the read, and you let him respond.

## How the briefing runs

1. Open with a sharp read — not a list dump. Synthesize what you see. What's real today? What's the most pressing thing? What looks like it might be wishful thinking?

2. Let him respond. He'll push back, clarify, cut things, add things. Roll with it.

3. When you've both landed on a real list, summarize it clearly — one line per task, with rough time estimates if helpful. This is the output that goes into the app.

## Formatting rules

- Keep messages conversational. No walls of text.
- Use short paragraphs, not bullet-point lists for everything.
- When you do list tasks (the final agreed list), use a simple dashed list.
- Don't say "Great!" or "Absolutely!" or any of that. Just respond.
- Max response length: ~200 words unless he asks you to go longer.
- Don't repeat the full context back at him. He knows what's in Asana.

## What you never do

- Never tell him everything looks fine if it doesn't.
- Never let an overcommitted plan slide without noting it.
- Never agree with him just to end the conversation.
- Never produce a list longer than the focus capacity realistically allows.`;
}
```

---

## The Commit Mechanism (Tricky Part)

When the conversation produces a final agreed list, the app needs to match those task titles back to real task IDs so it can call `bringForward()`.

**Recommended approach:** At the end of the conversation, render the final list as interactive chips. Each chip shows the task title with a checkbox. Patrick confirms which ones to commit. When he hits "Commit," the component:

1. For tasks that match an existing Asana candidate in `plannedTasks` (match on `sourceId` or title): calls `bringForward(taskId)`.
2. For tasks that don't exist locally yet: calls `addLocalTask(title, goalId)` then `bringForward()` on the returned ID.
3. For tasks he adds mid-conversation that weren't in Asana: same as #2.

This avoids the fragile string-matching problem of trying to auto-parse the model's text output into task IDs. He confirms the list, the app commits it.

**Stretch goal:** Ask the model to output a JSON block at the end of the conversation (hidden from the UI, parsed by the component) with structured task data: `{ tasks: [{ title, sourceId?, estimateMins, weeklyGoalId? }] }`. This lets the commit be more precise. But start with the chip approach — it's faster to build and gives Patrick control.

---

## Settings: Getting the API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account if you don't have one (pay-as-you-go, no subscription needed)
3. Go to API Keys → Create Key
4. Paste into TimeFocus Settings → AI section
5. Cost estimate: each morning briefing conversation is roughly 2,000–4,000 tokens. At Sonnet pricing (~$3/million input tokens), that's under $0.02 per conversation. A month of daily briefings ≈ $0.50.

---

## Build Order

Do these in sequence. Each step is independently testable before the next.

**Step 1 — Wire the API (1–2 hours)**
- Create `electron/anthropic.ts` with `registerAnthropicHandlers()`
- Add `anthropic: { apiKey: '' }` to `store.ts` defaults
- Register the handler in `main.ts`
- Add API key field to `Settings.tsx`
- Add `ai` namespace to `preload.ts`
- Add type declarations to `electron.d.ts`
- Test: open DevTools, call `window.api.ai.chat([{role:'user',content:'say hello'}], {})` in console. Should return a response.

**Step 2 — Build the UI shell (2–3 hours)**
- Create `MorningBriefing.tsx` with the chat layout — no streaming yet, just static message rendering
- Add it to `App.tsx` as a modal (show/hide state)
- Add a trigger button to Sidebar
- Test: panel opens, closes, renders static messages correctly

**Step 3 — Connect streaming (1–2 hours)**
- Wire `streamStart` + `onToken` + `onDone` into the component
- Auto-fire the briefing on open
- Tokens stream in character by character
- Test: open briefing, watch it run the opening message live

**Step 4 — The system prompt (2–3 hours)**
- Build `buildSystemPrompt()` with real context assembly
- Iterate on the prompt until the briefing voice feels right — this takes multiple test runs
- Test: run the real briefing against actual Asana data, tune until it reads well

**Step 5 — Commit mechanism (2–3 hours)**
- Build the interactive chip list for confirming the final task list
- Wire `bringForward()` and `addLocalTask()` to the commit action
- Handle both Asana matches and new local tasks
- Test: run a briefing, land on a list, commit it, verify Today's Commit updates

**Step 6 — Auto-open logic + polish (1 hour)**
- Add the morning auto-open trigger (before noon, no committed tasks yet)
- Style everything to match the app's existing design language
- Add loading state, error state for API key missing

**Total: 9–14 hours of focused build time across 2–3 days.**

---

## Things to Watch Out For

**Electron's `fetch` in the main process** — Node 18+ supports native fetch, which Electron 33 uses. The streaming approach with `getReader()` works in this context. If you hit issues, fall back to the `node-fetch` package or use Node's `https` module directly.

**Context window costs** — The system prompt is long (~600 tokens) and you'll pass the full Asana task list each time. Keep `max_tokens` at 1024 for responses — more than enough for a planning conversation turn. Watch that the Asana list doesn't balloon if someone has 100+ tasks; add a `limit: 30` to the Asana fetch for the briefing context and sort by due date ascending.

**The `ai:stream:done` event** — Use `ipcRenderer.once` not `ipcRenderer.on` for the done event, otherwise listeners stack up across multiple messages and you get phantom completions.

**Auto-open UX** — The "open before noon if nothing committed" trigger is useful but can feel intrusive. Give Patrick a "Don't show today" dismiss option that stores a flag in the store keyed to today's date. If he's already done his planning elsewhere, he shouldn't be nagged.

**The model** — `claude-sonnet-4-6` is the right call. Fast enough to stream conversationally, smart enough to actually push back, cheap enough that daily use doesn't add up to anything meaningful.
