# Compass Financial Integration — Design Spec

**Date:** 2026-03-22
**Status:** Phase 1 spec
**Scope:** Engine import, IPC handlers, Money sidebar view, briefing context, store expansion

---

## Context

Compass is a personal finance engine built as a standalone Next.js app. Strategic decision (2026-03-22): Compass will be integrated as a surface inside Inked rather than shipping standalone. The two apps share identical patterns — AI that reads full context before speaking, adaptive state inference, progressive disclosure, structured planning sessions.

Phase 1 delivers: a Money sidebar view inside Inked and financial awareness in the morning briefing. Phase 2 (later): weekly sit-down merge, Dubsado revenue pipeline.

**What Compass inside Inked is:** A financial awareness surface. You glance at it during your workday to know if you're okay, what's coming, and what needs action.

**What it is not:** A budgeting app. Transaction management, category editing, and budget allocation live in YNAB/Monarch. Compass reads the result and interprets it.

---

## Approach

Engine-in-Main. The Compass engine runs in Electron's main process. A new `electron/finance.ts` module owns Plaid SDK calls, SQLite queries (via Drizzle), and `computeEngineState()`. The renderer calls IPC handlers that return the computed `EngineState` as a plain object. No database or Plaid awareness in the renderer.

```
Renderer -> IPC -> finance.ts -> [Drizzle/Plaid] -> computeEngineState() -> EngineState -> IPC -> Renderer
```

This matches every existing integration pattern in the codebase (Asana, GCal, Store).

---

## 1. Engine Import + IPC Handlers

### Engine

8 of 10 Compass engine modules copied into `engine/` at the project root (sibling to `electron/` and `src/`). Tests come along.

**Included:**
- `permissionNumber.ts` — the core number (what's left after bills)
- `cashJobsAllocator.ts` — where money is allocated across buckets
- `consequenceScorer.ts` — ranking obligations by severity
- `timePressureMapper.ts` — 14-day forward-looking bridge
- `recommendationEngine.ts` — top-3 prioritized next moves
- `cognitiveStateInferrer.ts` — calm/alert/compressed (drives UI density)
- `recoveryStageDetector.ts` — financial health stage
- `revenueTracker.ts` — filters allocatable revenue for bridge calculation
- `types.ts` — full type definitions
- `index.ts` — `computeEngineState()` orchestrator

**Excluded (Phase 2):**
- `learningLoop.ts` — recommendation outcome tracking, needs the weekly sit-down

**Modified on import:**
- `index.ts` — `computeEngineState()` is called with `transactions: []`. The transaction processing step (step 8) is skipped and `reviewQueue` returns empty. `transactionProcessor.ts` is not copied in. This is a one-line change: pass an empty array and the engine handles it gracefully — the orchestrator still runs, it just processes zero transactions.

### Database

SQLite via `better-sqlite3` + Drizzle ORM. Database file lives in Electron's app data directory alongside electron-store JSON. No server dependency — runs in-process.

If multi-device sync or cloud backup is ever needed, Drizzle abstracts the dialect for a PostgreSQL migration. That's a future concern.

**5 tables:**

| Table | Purpose |
|---|---|
| `accounts` | Bank accounts from Plaid — name, type, current balance, available balance, last synced |
| `obligations` | Recurring bills/debts (personal + business). Amount, due date, severity tier, frequency, category, covered status |
| `revenue` | Expected income — invoices, deposits, pipeline. Amount, expected date, confidence level (confirmed/invoiced/verbal/speculative), category |
| `category_spend` | Aggregated spend per category per cycle. Refreshed on Plaid sync. Personal and business separated. Not per-transaction. |
| `action_items` | Financial to-dos tied to obligations/revenue. "Send invoice to Client X." "Review ad spend before renewal." Status (pending/done), due date, description |

### FinancialData assembly

`electron/finance.ts` assembles the engine's `FinancialData` input from SQLite + electron-store. Field mapping:

| FinancialData field | Source |
|---|---|
| `obligations` | `obligations` table |
| `revenue` | `revenue` table |
| `transactions` | Always `[]` — Inked doesn't store individual transactions |
| `income` | Sum of `revenue` entries with confidence `confirmed` for the current month |
| `cashOnHand` | Sum of `accounts.available_balance` across all linked accounts |
| `flexPoolTarget` | `finance_config` electron-store key (set during onboarding or settings) |
| `spentFromFlex` | Sum of `category_spend` for flex categories in the current cycle |
| `survivalNeeds` | `finance_config` electron-store key (rent, food, utilities — set during setup) |
| `untouchableNeeds` | `finance_config` electron-store key (reserve floor — set during setup) |
| `catchUpNeeds` | Sum of past-due `obligations` amounts |
| `today` | `new Date()` |

The `finance_config` values (`flexPoolTarget`, `survivalNeeds`, `untouchableNeeds`) are set once during initial setup (part of the onboarding flow after Plaid connection) and adjustable in Settings. These are personal financial parameters the engine needs but Plaid can't infer.

### New files

**`electron/db.ts`** — Drizzle SQLite client, schema definitions, migrations. DB auto-creates on first app launch after finance is configured.

**`electron/finance.ts`** — IPC handler module, registered in `main.ts` via `registerFinanceHandlers()`. Same pattern as `registerAsanaHandlers()`, `registerGCalHandlers()`, etc.

**`electron/plaid.ts`** — Plaid SDK wrapper. Handles `linkTokenCreate`, `itemPublicTokenExchange`, `accountsBalanceGet`, `transactionsRecurringGet`, category spend aggregation. Access token stored in electron-store (not SQLite) — follows the existing pattern of API credentials in store, domain data in DB.

**Note:** Plaid Link is a hosted JavaScript widget, not an OAuth redirect. The child BrowserWindow approach works but has known quirks (CSP headers, cross-origin frame communication via `postMessage`). This is different from GCal's localhost-redirect pattern and will need its own integration logic.

### IPC Handlers

| Channel | Returns | Purpose |
|---|---|---|
| `finance:get-state` | `EngineState` | Assembles `FinancialData` from SQLite, runs `computeEngineState()`. Includes action items, upcoming obligations, recommendations, business pipeline. |
| `finance:refresh` | `EngineState` | Triggers Plaid sync first (balances, recurring, category spend), updates SQLite, then recomputes engine state. |
| `finance:plaid-link` | `{ linkToken: string }` | Creates a Plaid Link token for bank account connection. |
| `finance:plaid-exchange` | `{ success: boolean }` | Exchanges Plaid public token for access token, stores it, triggers initial sync. |

### Preload

```ts
finance: {
  getState: () => ipcRenderer.invoke('finance:get-state'),
  refresh: () => ipcRenderer.invoke('finance:refresh'),
  plaidLink: () => ipcRenderer.invoke('finance:plaid-link'),
  plaidExchange: (token: string) => ipcRenderer.invoke('finance:plaid-exchange', token),
},
```

### Plaid credentials

Client ID and secret stored in electron-store alongside Asana/GCal credentials. Same trade-off Inked already makes with API secrets client-side.

### Type declarations

`src/types/electron.d.ts` gets a `FinanceAPI` interface matching the preload shape, and `Window.api.finance: FinanceAPI` added to the global declaration. Follows the existing pattern of `AsanaAPI`, `GCalAPI`, `AIAPI`, etc.

---

## 2. Sidebar View

### View registration

`'money'` added to the `View` union type in `src/context/AppContext.tsx`: `'flow' | 'archive' | 'goals' | 'scratch' | 'money'`. The main content area renderer (which switches on `activeView`) and `Sidebar.tsx` both need updating to handle the new view.

Sidebar nav item placed between "Today's Commit" and "Archive." Icon TBD (Lucide has `Wallet`, `Banknote`, `CircleDollarSign`).

### Renderer data pattern

The Money view uses a `useFinance()` hook that calls `window.api.finance.getState()` on mount and caches the result in local component state (not in AppContext). Financial state is view-specific — it doesn't need to be globally available like planner state. The hook exposes `{ state: EngineState | null, loading: boolean, refresh: () => Promise<void> }`. AppContext only gains the `finance.configured` flag (from electron-store) to control whether the sidebar shows the Money nav item.

### Three states

**Unconnected** — No Plaid token exists. Onboarding surface: what the Money view does, one button to connect a bank. No empty dashboard with zeros. The empty state should feel inviting, not incomplete. Follows Compass philosophy: safety before anything.

**Syncing** — Plaid connected, initial pull running. "Getting your accounts..." with progress indication. First sync pulls balances + recurring + 30 days of category spend. 10-30 seconds.

**Active** — Full surface with five sections.

### Active surface — five sections

**1. The Number**

Big, centered. The amount left for the week after all bills and obligations are accounted for. Below it, one sentence with three components:

- Are bills covered? (safety answer, always first)
- What's left? (the number, plainly)
- Is that normal? (relative to your recent weekly pattern)

Examples:

> "Bills are covered. $428 left for the week — that's normal for you."

> "Bills are covered. $112 left — tighter than usual. Insurance hit early."

> "Client X invoice is 5 days overdue ($2,400). Everything else is covered."

The sentence adapts based on `cognitiveState`. Calm = brief. Alert = adds context. Compressed = leads with the action needed.

No label like "permission number" or "safe to spend." Just the number, what it means in plain English, and whether to feel anything about it.

**2. Cash Jobs**

Where your money is working. Visual breakdown (horizontal bars or stacked blocks, not pie charts). Personal vs. business separated. Shows: bills reserved, operating, business expenses, tax reserve, what's free. You shouldn't have to do math to understand where the money went.

**3. Upcoming (7-14 days)**

Obligations ranked by consequence, not date. Each item shows: name, amount, days until due, covered/not covered. Business expenses (ad spend, tools, subscriptions) mixed in alongside personal bills — they're all obligations. Items needing a decision are visually distinct from items that are handled.

**4. Action Items**

Financial to-dos with status and due dates:
- "Send invoice to Client X" (5 days overdue)
- "Review ad performance before Friday renewal" (decision point)
- "Move $300 to tax reserve" (money move)

These are the items the morning briefing can reference alongside planned tasks: "3 focus blocks, 2 meetings, 1 invoice to send."

Financial action items are **separate from the planner task system.** They live only in the Money view and the briefing — they do not appear in the flow view, do not become `PlannedTask` objects, and do not mix into Asana sync. The two systems serve different purposes: planner tasks are work you schedule and execute; financial action items are money moves you need to make. A user marks a financial action item done in the Money view, not in the day plan.

**5. Business Pipeline**

Revenue entries with confidence levels: confirmed (paid), invoiced (sent, waiting), verbal (agreed, not invoiced), speculative (potential). Shows what's coming in and when. The income side of clarity.

### What is NOT on this surface

- Transaction lists. Individual purchases live in YNAB/Monarch.
- Budget category management. Category spend shows as a summary ("Groceries: $340 of $500") but you don't adjust budgets here.
- Net worth. Different emotional surface — Phase 2 at earliest.
- Debt payoff calculators. The recommendation engine suggests moves, but detailed debt strategy belongs in the weekly sit-down (Phase 2).

### Adaptive density

`cognitiveState` from the engine (calm/alert/compressed) controls how much the surface shows on load:

- **Calm** — The number + sentence. Everything else collapsed. Don't show a wall of data when things are fine.
- **Alert** — Number + upcoming + actions expanded. You need to see what's coming.
- **Compressed** — Everything visible. Action items at the top. The system is surfacing everything because decisions are needed.

AI-inferred density, no user toggle. Same principle as the Compass standalone homepage.

### Data freshness

The surface shows when data was last refreshed — not prominently, but available. "Updated 2h ago" with a manual refresh button. Matches how Inked shows sync status for Asana/GCal.

---

## 3. Briefing Context

### BriefingContext expansion

The `BriefingContext` object in `electron/anthropic.ts` gets a `finance` field. The briefing assembler calls `computeEngineState()` once and extracts what the AI needs. The engine's `Recommendation` type is mapped to a simplified briefing shape by `electron/finance.ts`: `actionVerb` becomes `action`, `protects` becomes `reason`, and scoring/ranking fields are dropped since the AI doesn't need them.

```ts
finance?: {
  weeklyRemaining: number;
  weeklyRemainingContext: 'normal' | 'tight' | 'comfortable';
  billsCovered: boolean;
  cognitiveState: CognitiveState;
  upcoming: Array<{
    name: string;
    amount: number;
    daysUntil: number;
    covered: boolean;
    category: 'personal' | 'business';
  }>;
  actionItems: Array<{
    description: string;
    daysOverdue?: number;
    amount?: number;
  }>;
  recommendations: Array<{
    action: string;
    target: string;
    amount: number;
    reason: string;
  }>;
  businessPipeline?: {
    confirmedThisMonth: number;
    invoicedOutstanding: number;
    overdueInvoices: number;
  };
}
```

### Three-layer prompt structure

The AI surfaces financial information in a consistent order:

1. **Status** — always lead with whether bills are covered, what's left, whether that's normal
2. **Upcoming** — obligations within 3 days, or not covered, or needing a decision
3. **Actions** — overdue invoices, business expenses to review, money moves to make, growth/debt payoff recommendations

### When to surface money unprompted

- `cognitiveState` is `alert` or `compressed`
- An obligation lands within 3 days
- An invoice is overdue
- A business expense needs a decision (ad spend renewal, tool subscription)
- Weekly remaining is `tight` relative to pattern
- A smart money move is available (extra debt payment, savings opportunity)

### When to stay quiet

- `cognitiveState` is `calm`, bills are covered, nothing due within 5 days, no pending actions
- User is asking about tasks or scheduling — don't inject money into an unrelated thread
- The number is stable, obligations are covered, no actions pending. Silence is the good news.

### Tone rules (baked into system prompt)

- "Bills are covered" not "you have sufficient funds"
- "Tighter than usual" not "you're running low"
- "$428 left for the week" not "your permission number is $428"
- "Client X invoice is 5 days out — want to send a follow-up?" not "Invoice overdue!"
- Frame business expenses as decisions: "Ad spend renews Friday ($200) — keep it running?" not "Ad spend due Friday"
- Frame growth/debt moves as opportunities: "You have room to move $50 to savings this week" not "You should save more"
- Never use red language, urgency language, or judgment. Describe, don't evaluate.
- Match Compass emotional states: calm = brief or silent, alert = contextual mention, compressed = specific recommended action

### Example briefing outputs

**Calm Monday:**
> "3 focus blocks, a client call at 2pm. Bills are covered, $428 left for the week — normal range. Quiet week financially."

**Alert Wednesday:**
> "2 focus blocks open. Car insurance hits tomorrow ($247) — covered. Client X invoice is 5 days outstanding, $2,400. Worth a follow-up today? You also have room to put an extra $100 toward Card B this week."

**Compressed Friday:**
> "Tight week. $112 left after insurance hit early. Ad spend renews today ($200) — review before it auto-charges. Invoice to Client X still outstanding."

### Direct questions

The AI answers financial questions using the same context. "How's money looking?" gets a concise summary. "Should I send that invoice?" gets a recommendation informed by the pipeline and cash position.

---

## 4. Store Expansion

### New electron-store keys

Added to the `Store` constructor defaults in `electron/store.ts`:

```ts
plaid: {
  clientId: '',
  secret: '',
  accessToken: '',
  itemId: '',
  institutionName: '',
  lastSync: '',
},
finance: {
  configured: false,
  weeklyPattern: [] as number[],  // rolling 8-week history of weekly remaining
},
financeConfig: {
  flexPoolTarget: 0,
  survivalNeeds: 0,
  untouchableNeeds: 0,
},
```

**`plaid`** — Credentials for the Plaid connection. `clientId` and `secret` are developer credentials (entered in Settings like Asana token and GCal client ID/secret). `accessToken` is the persistent per-user credential for bank data pulls. `institutionName` stored so settings can show "Connected to Chase" without a Plaid API call.

**`finance.configured`** — Boolean flag the renderer checks to decide between unconnected and active states in the Money view. Added to `SAFE_STORE_KEYS` in `electron/store.ts` so the renderer can read it directly.

**`finance.weeklyPattern`** — Rolling 8-week history of weekly remaining amounts. Powers "that's normal for you" / "tighter than usual" / "more room than last week." Each week's remaining amount appended when the weekly cycle closes. Lives in electron-store (not SQLite) because it's a small array the briefing reads frequently — same access pattern as `plannerState`.

**`financeConfig`** — Personal financial parameters the engine needs but Plaid can't infer. Set during onboarding (after Plaid connection) and adjustable in Settings.

### Settings panel

`settings:load` response gets a `finance` section. `LoadedSettings` type in `src/types/electron.d.ts` updated to match:

```ts
finance: {
  configured: Boolean(store.get('plaid.accessToken')),
  institutionName: String(store.get('plaid.institutionName') || ''),
  lastSync: String(store.get('plaid.lastSync') || ''),
  plaidClientIdConfigured: Boolean(store.get('plaid.clientId')),
  plaidSecretConfigured: Boolean(store.get('plaid.secret')),
},
```

`settings:save` handler gets new clauses for Plaid credentials:

```ts
if ('plaidClientId' in payload) store.set('plaid.clientId', payload.plaidClientId);
if ('plaidSecret' in payload) store.set('plaid.secret', payload.plaidSecret);
```

`SettingsUpdate` type in `src/types/electron.d.ts` updated with `plaidClientId?: string` and `plaidSecret?: string`.

Settings UI gets a "Finance" section for managing the Plaid connection — connect, disconnect, see which bank, see last sync time. Plaid client ID and secret entered here alongside Asana/GCal credentials.

### What stays out of electron-store

All financial domain data (accounts, obligations, revenue, category spend, action items) lives in SQLite. The store holds credentials and lightweight UI state only. Clean separation: store for config, database for data.

---

## Phase 2 (out of scope)

- **Weekly sit-down merge** — Financial review items added to the Sunday interview flow. Requires reworking the 7-question structured interview.
- **Dubsado revenue pipeline** — Zapier webhook infrastructure mapping Dubsado project states to revenue confidence levels.
- **Manual obligation CRUD UI** — Forms for adding/editing obligations Plaid can't see. Handlers added when the UI exists.
- **Transaction processor** — Engine module for individual transaction classification. Not needed when Inked only stores aggregated category spend.
- **Learning loop** — Recommendation outcome tracking. Needs the weekly sit-down to close the feedback loop.
- **Net worth surface** — Different emotional weight, separate design exercise.

---

## Dependencies

- `better-sqlite3` — SQLite driver for Electron main process. **Native module:** requires `@electron/rebuild` or `electron-rebuild` to compile against Electron's Node version. The build pipeline (`electron-builder` config) needs updating to include the native binary in packaged builds.
- `drizzle-orm` + `drizzle-kit` — ORM and migration tooling
- `plaid` — Plaid Node SDK
- Compass engine (8 modules, copied into `engine/`)

## Open questions

- Lucide icon for Money nav item — `Wallet`, `Banknote`, `CircleDollarSign`, or something else
- Plaid environment — sandbox for development, production requires Plaid approval process
- Category spend cycle boundaries — calendar month, or aligned to pay periods?
- Action item lifecycle — do completed financial to-dos archive like completed tasks, or just disappear?
- Plaid token expiry and bank disconnection — Plaid access tokens can expire or banks can revoke connection. Phase 1 needs at minimum a try/catch that surfaces a "Reconnect your bank" prompt in the Money view when the token is stale. Full webhook-based error handling is a later concern.
- Onboarding flow for `financeConfig` values — after Plaid connection, the user needs to set survival needs, flex pool target, and untouchable reserve. How guided is this? A wizard? A settings form? This affects first-run UX significantly.
