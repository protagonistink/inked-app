# Compass Financial Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Compass financial engine into Inked as a Money sidebar view with financial awareness in the morning briefing.

**Architecture:** Engine-in-Main — Compass engine runs in Electron's main process. SQLite (better-sqlite3 + Drizzle) stores financial data. Plaid SDK syncs bank data. Renderer calls IPC handlers that return computed `EngineState`. Financial context feeds into the existing AI briefing system.

**Tech Stack:** TypeScript, better-sqlite3, drizzle-orm, plaid-node SDK, React, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-compass-inked-integration-design.md`

---

## File Structure

### New files (created)

| File | Responsibility |
|---|---|
| `engine/types.ts` | Financial type definitions (copied from compass-financial) |
| `engine/permissionNumber.ts` | Core "what's left" calculator |
| `engine/cashJobsAllocator.ts` | Cash allocation across buckets |
| `engine/consequenceScorer.ts` | Obligation severity ranking |
| `engine/timePressureMapper.ts` | 14-day forward bridge |
| `engine/recommendationEngine.ts` | Top-3 next move generator |
| `engine/cognitiveStateInferrer.ts` | calm/alert/compressed state |
| `engine/recoveryStageDetector.ts` | Financial health stage |
| `engine/revenueTracker.ts` | Allocatable revenue filter |
| `engine/index.ts` | `computeEngineState()` orchestrator (modified: empty transactions) |
| `engine/__tests__/*.test.ts` | Engine tests (copied from compass-financial) |
| `electron/db.ts` | Drizzle SQLite client + schema (5 tables) |
| `electron/plaid.ts` | Plaid SDK wrapper |
| `electron/finance.ts` | IPC handlers + FinancialData assembler |
| `src/hooks/useFinance.ts` | Renderer-side data hook |
| `src/components/MoneyView.tsx` | Main Money sidebar view (3 states) |
| `src/components/MoneyOnboarding.tsx` | Unconnected state UI |
| `src/components/MoneyDashboard.tsx` | Active state — 5 sections |
| `src/components/FinanceSettings.tsx` | Finance section in settings panel |

### Modified files

| File | Change |
|---|---|
| `electron/main.ts:197-205` | Add `registerFinanceHandlers()` import + call |
| `electron/preload.ts` | Add `finance` namespace to `window.api` |
| `electron/store.ts:6-57` | Add `plaid`, `finance`, `financeConfig` defaults |
| `electron/store.ts:60-67` | Add `finance.configured` to `SAFE_STORE_KEYS` |
| `electron/store.ts:89-148` | Add finance section to `settings:load` and `settings:save` |
| `electron/anthropic.ts:38-69` | Add `finance?` field to `BriefingContext` |
| `electron/anthropic.ts:216+` | Add financial context to `buildSystemPrompt()` |
| `src/types/index.ts` | Export engine types for renderer use |
| `src/types/electron.d.ts:30-63` | Add `finance?` to `BriefingContext` |
| `src/types/electron.d.ts:132-158` | Add `finance` to `LoadedSettings` |
| `src/types/electron.d.ts:160-171` | Add Plaid fields to `SettingsUpdate` |
| `src/types/electron.d.ts:219-236` | Add `FinanceAPI` + `Window.api.finance` |
| `src/context/AppContext.tsx:49` | Add `'money'` to `View` union |
| `src/components/Sidebar.tsx:134-161` | Add Money nav item |
| `src/App.tsx:339-354` | Add `money` case to view switch |
| `package.json` | Add `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `plaid`, `@electron/rebuild` |
| `tsconfig.json` | No change needed — engine imports via relative path from electron/ |

---

## Task 1: Install dependencies and configure native module rebuild

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime dependencies**

```bash
npm install better-sqlite3 drizzle-orm plaid
```

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D @types/better-sqlite3 drizzle-kit @electron/rebuild
```

- [ ] **Step 3: Add postinstall rebuild script to package.json**

Add to `scripts` in `package.json`:

```json
"postinstall": "npx @electron/rebuild -f -w better-sqlite3"
```

- [ ] **Step 4: Run install to trigger rebuild**

```bash
npm install
```

Expected: no errors, `better-sqlite3` compiles against Electron's Node version.

- [ ] **Step 5: Verify native module loads**

```bash
npx electron -e "console.log(require('better-sqlite3')('test.db').pragma('journal_mode = WAL')); process.exit(0)"
rm -f test.db
```

Expected: prints `[{ journal_mode: 'wal' }]` and exits cleanly.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add better-sqlite3, drizzle-orm, plaid dependencies"
```

---

## Task 2: Copy Compass engine into project

**Files:**
- Create: `engine/` directory (8 modules + types + index + tests)

- [ ] **Step 1: Copy engine files from compass-financial**

```bash
mkdir -p engine/__tests__
cp /Users/pat/Sites/compass-financial/engine/types.ts engine/
cp /Users/pat/Sites/compass-financial/engine/permissionNumber.ts engine/
cp /Users/pat/Sites/compass-financial/engine/cashJobsAllocator.ts engine/
cp /Users/pat/Sites/compass-financial/engine/consequenceScorer.ts engine/
cp /Users/pat/Sites/compass-financial/engine/timePressureMapper.ts engine/
cp /Users/pat/Sites/compass-financial/engine/recommendationEngine.ts engine/
cp /Users/pat/Sites/compass-financial/engine/cognitiveStateInferrer.ts engine/
cp /Users/pat/Sites/compass-financial/engine/recoveryStageDetector.ts engine/
cp /Users/pat/Sites/compass-financial/engine/revenueTracker.ts engine/
cp /Users/pat/Sites/compass-financial/engine/index.ts engine/
```

- [ ] **Step 2: Copy tests (excluding transactionProcessor and learningLoop tests)**

```bash
cp /Users/pat/Sites/compass-financial/engine/__tests__/index.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/types.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/permissionNumber.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/cashJobsAllocator.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/consequenceScorer.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/timePressureMapper.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/recommendationEngine.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/cognitiveStateInferrer.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/recoveryStageDetector.test.ts engine/__tests__/
cp /Users/pat/Sites/compass-financial/engine/__tests__/revenueTracker.test.ts engine/__tests__/
```

- [ ] **Step 3: Remove transactionProcessor import from engine/index.ts**

In `engine/index.ts`, remove the `import { processTransaction } from './transactionProcessor'` line. Replace the transaction processing block (step 8 in the pipeline) with:

```ts
  // 8. Skip transaction processing — Inked uses aggregated category spend, not individual transactions
  const reviewQueue: Transaction[] = []
```

- [ ] **Step 4: Run engine tests**

```bash
npx vitest run engine/__tests__/ --reporter=verbose
```

Expected: all copied tests pass. If any test imported `transactionProcessor` or `learningLoop`, remove those specific test files.

- [ ] **Step 5: Verify TypeScript compilation**

```bash
npm run build
```

Expected: clean build, no type errors from engine/.

- [ ] **Step 6: Commit**

```bash
git add engine/
git commit -m "feat: import Compass financial engine (8 of 10 modules)"
```

---

## Task 3: Create SQLite database schema

**Files:**
- Create: `electron/db.ts`
- Test: `electron/__tests__/db.test.ts`

- [ ] **Step 1: Write the test for database initialization**

Create `electron/__tests__/db.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '../db';

describe('financial database schema', () => {
  let sqlite: Database.Database;

  afterEach(() => {
    sqlite?.close();
  });

  it('creates all 5 tables on initialization', () => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });

    // Run migrations inline for test
    sqlite.exec(schema.CREATE_TABLES_SQL);

    const tables = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('accounts');
    expect(tableNames).toContain('obligations');
    expect(tableNames).toContain('revenue');
    expect(tableNames).toContain('category_spend');
    expect(tableNames).toContain('action_items');
  });

  it('inserts and reads an obligation', () => {
    sqlite = new Database(':memory:');
    const db = drizzle(sqlite, { schema });
    sqlite.exec(schema.CREATE_TABLES_SQL);

    db.insert(schema.obligations).values({
      id: 'obl-1',
      name: 'Car Insurance',
      amount: 247,
      dueDate: '2026-03-27',
      severityTier: 'insurance_lapse',
      timePressure: 'due_this_week',
      reliefPerDollar: 0.8,
      negotiability: 0.2,
      bestAction: 'pay',
      consequenceIfIgnored: 'Policy lapses, no coverage',
      isPastDue: false,
      daysUntilDue: 5,
      category: 'personal',
      frequency: 'monthly',
    }).run();

    const rows = db.select().from(schema.obligations).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Car Insurance');
    expect(rows[0].category).toBe('personal');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run electron/__tests__/db.test.ts --reporter=verbose
```

Expected: FAIL — `../db` module not found.

- [ ] **Step 3: Implement electron/db.ts**

Create `electron/db.ts`:

```ts
import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

// ── Schema ──────────────────────────────────────────────────────────

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // checking, savings, credit, etc.
  currentBalance: real('current_balance').notNull(),
  availableBalance: real('available_balance').notNull(),
  institution: text('institution'),
  lastSynced: text('last_synced').notNull(),
});

export const obligations = sqliteTable('obligations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  dueDate: text('due_date').notNull(),
  severityTier: text('severity_tier').notNull(),
  timePressure: text('time_pressure').notNull(),
  reliefPerDollar: real('relief_per_dollar').notNull().default(0.5),
  negotiability: real('negotiability').notNull().default(0.5),
  bestAction: text('best_action').notNull().default('pay'),
  consequenceIfIgnored: text('consequence_if_ignored').notNull().default(''),
  isPastDue: integer('is_past_due', { mode: 'boolean' }).notNull().default(false),
  daysUntilDue: integer('days_until_due').notNull().default(0),
  category: text('category').notNull().default('personal'), // personal | business
  frequency: text('frequency').notNull().default('monthly'),
  source: text('source').notNull().default('plaid'), // plaid | manual
});

export const revenue = sqliteTable('revenue', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  expectedDate: text('expected_date').notNull(),
  confidence: text('confidence').notNull(), // confirmed | invoiced | verbal | speculative
  sourceType: text('source_type').notNull(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default('personal'), // personal | business
  unlocks: text('unlocks').notNull().default('[]'), // JSON array
});

export const categorySpend = sqliteTable('category_spend', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  spent: real('spent').notNull(),
  budget: real('budget'),
  cycleStart: text('cycle_start').notNull(),
  cycleEnd: text('cycle_end').notNull(),
  isBusinessExpense: integer('is_business_expense', { mode: 'boolean' }).notNull().default(false),
  lastSynced: text('last_synced').notNull(),
});

export const actionItems = sqliteTable('action_items', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'), // pending | done
  dueDate: text('due_date'),
  amount: real('amount'),
  relatedObligationId: text('related_obligation_id'),
  relatedRevenueId: text('related_revenue_id'),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
});

// ── Raw SQL for in-memory test setup ────────────────────────────────

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  current_balance REAL NOT NULL,
  available_balance REAL NOT NULL,
  institution TEXT,
  last_synced TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS obligations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  severity_tier TEXT NOT NULL,
  time_pressure TEXT NOT NULL,
  relief_per_dollar REAL NOT NULL DEFAULT 0.5,
  negotiability REAL NOT NULL DEFAULT 0.5,
  best_action TEXT NOT NULL DEFAULT 'pay',
  consequence_if_ignored TEXT NOT NULL DEFAULT '',
  is_past_due INTEGER NOT NULL DEFAULT 0,
  days_until_due INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'personal',
  frequency TEXT NOT NULL DEFAULT 'monthly',
  source TEXT NOT NULL DEFAULT 'plaid'
);
CREATE TABLE IF NOT EXISTS revenue (
  id TEXT PRIMARY KEY,
  amount REAL NOT NULL,
  expected_date TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source_type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'personal',
  unlocks TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS category_spend (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  spent REAL NOT NULL,
  budget REAL,
  cycle_start TEXT NOT NULL,
  cycle_end TEXT NOT NULL,
  is_business_expense INTEGER NOT NULL DEFAULT 0,
  last_synced TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date TEXT,
  amount REAL,
  related_obligation_id TEXT,
  related_revenue_id TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
`;

// ── Database client ─────────────────────────────────────────────────

let _db: ReturnType<typeof drizzle> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb() {
  if (_db) return _db;

  const dbPath = path.join(app.getPath('userData'), 'finance.db');
  _sqlite = new Database(dbPath);
  _sqlite.pragma('journal_mode = WAL');
  _sqlite.exec(CREATE_TABLES_SQL);

  _db = drizzle(_sqlite, {
    schema: { accounts, obligations, revenue, categorySpend, actionItems },
  });

  return _db;
}

export function closeDb() {
  _sqlite?.close();
  _sqlite = null;
  _db = null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run electron/__tests__/db.test.ts --reporter=verbose
```

Expected: PASS — both tests green.

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: clean TypeScript compilation.

- [ ] **Step 6: Commit**

```bash
git add electron/db.ts electron/__tests__/db.test.ts
git commit -m "feat: add SQLite financial database schema (5 tables)"
```

---

## Task 4: Expand electron-store with finance keys

**Files:**
- Modify: `electron/store.ts:6-57` (defaults), `electron/store.ts:60-67` (SAFE_STORE_KEYS), `electron/store.ts:89-148` (settings handlers)
- Modify: `src/types/electron.d.ts:132-171` (LoadedSettings, SettingsUpdate)

- [ ] **Step 1: Add store defaults**

In `electron/store.ts`, add to the `defaults` object (after the existing `scratch` key):

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
      weeklyPattern: [] as number[],
    },
    financeConfig: {
      flexPoolTarget: 0,
      survivalNeeds: 0,
      untouchableNeeds: 0,
    },
```

- [ ] **Step 2: Add finance.configured to SAFE_STORE_KEYS**

In `electron/store.ts`, add `'finance.configured'` to the `SAFE_STORE_KEYS` set.

- [ ] **Step 3: Add finance to settings:load handler**

In the `settings:load` handler (around line 89), add after the existing `focus` section:

```ts
    finance: {
      configured: Boolean(store.get('plaid.accessToken')),
      institutionName: String(store.get('plaid.institutionName') || ''),
      lastSync: String(store.get('plaid.lastSync') || ''),
      plaidClientIdConfigured: Boolean(store.get('plaid.clientId')),
      plaidSecretConfigured: Boolean(store.get('plaid.secret')),
    },
```

- [ ] **Step 4: Add Plaid credentials to settings:save handler**

In the `settings:save` handler (around line 133), add:

```ts
    if ('plaidClientId' in payload) store.set('plaid.clientId', payload.plaidClientId);
    if ('plaidSecret' in payload) store.set('plaid.secret', payload.plaidSecret);
```

- [ ] **Step 5: Update LoadedSettings type**

In `src/types/electron.d.ts`, add to the `LoadedSettings` interface (after `focus`):

```ts
  finance: {
    configured: boolean;
    institutionName: string;
    lastSync: string;
    plaidClientIdConfigured: boolean;
    plaidSecretConfigured: boolean;
  };
```

- [ ] **Step 6: Update SettingsUpdate type**

In `src/types/electron.d.ts`, add to the `SettingsUpdate` interface:

```ts
  plaidClientId?: string;
  plaidSecret?: string;
```

- [ ] **Step 7: Verify build**

```bash
npm run build
```

Expected: clean compilation.

- [ ] **Step 8: Commit**

```bash
git add electron/store.ts src/types/electron.d.ts
git commit -m "feat: add plaid/finance config to electron-store and settings"
```

---

## Task 5: Create Plaid SDK wrapper

**Files:**
- Create: `electron/plaid.ts`

- [ ] **Step 1: Implement electron/plaid.ts**

```ts
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { store } from './store';

function getClient(): PlaidApi {
  const clientId = store.get('plaid.clientId') as string;
  const secret = store.get('plaid.secret') as string;

  if (!clientId || !secret) {
    throw new Error('Plaid credentials not configured');
  }

  const config = new Configuration({
    basePath: PlaidEnvironments.sandbox, // TODO: switch to production
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  });

  return new PlaidApi(config);
}

export async function createLinkToken(): Promise<string> {
  const client = getClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: 'inked-user' },
    client_name: 'Inked',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  });
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<void> {
  const client = getClient();
  const response = await client.itemPublicTokenExchange({
    public_token: publicToken,
  });
  store.set('plaid.accessToken', response.data.access_token);
  store.set('plaid.itemId', response.data.item_id);
  store.set('finance.configured', true);
}

export async function getBalances() {
  const client = getClient();
  const accessToken = store.get('plaid.accessToken') as string;
  if (!accessToken) throw new Error('No Plaid access token');

  const response = await client.accountsBalanceGet({ access_token: accessToken });
  return response.data.accounts.map(a => ({
    id: a.account_id,
    name: a.name,
    type: a.type,
    currentBalance: a.balances.current ?? 0,
    availableBalance: a.balances.available ?? a.balances.current ?? 0,
    institution: a.official_name ?? a.name,
  }));
}

export async function getRecurring(accountIds: string[]) {
  const client = getClient();
  const accessToken = store.get('plaid.accessToken') as string;
  if (!accessToken) throw new Error('No Plaid access token');

  const response = await client.transactionsRecurringGet({
    access_token: accessToken,
    account_ids: accountIds,
  });
  return {
    inflow: response.data.inflow_streams,
    outflow: response.data.outflow_streams,
  };
}

export async function getCategorySpend(startDate: string, endDate: string) {
  const client = getClient();
  const accessToken = store.get('plaid.accessToken') as string;
  if (!accessToken) throw new Error('No Plaid access token');

  const response = await client.transactionsGet({
    access_token: accessToken,
    start_date: startDate,
    end_date: endDate,
  });

  // Aggregate by category
  const byCategory = new Map<string, number>();
  for (const txn of response.data.transactions) {
    const cat = txn.personal_finance_category?.primary ?? 'UNCATEGORIZED';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(txn.amount));
  }

  return Array.from(byCategory.entries()).map(([category, spent]) => ({
    category,
    spent,
  }));
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: clean compilation.

- [ ] **Step 3: Commit**

```bash
git add electron/plaid.ts
git commit -m "feat: add Plaid SDK wrapper for balances, recurring, category spend"
```

---

## Task 6: Create IPC finance handlers

**Files:**
- Create: `electron/finance.ts`
- Modify: `electron/main.ts:1-10` (import), `electron/main.ts:197-205` (registration)
- Modify: `electron/preload.ts` (add finance namespace)
- Modify: `src/types/electron.d.ts:219-236` (add FinanceAPI)

- [ ] **Step 1: Write electron/finance.ts**

```ts
import { ipcMain } from 'electron';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getDb, accounts, obligations, revenue, categorySpend, actionItems } from './db';
import { store } from './store';
import { computeEngineState, type FinancialData } from '../engine';
import type { Obligation, RevenueEntry, EngineState } from '../engine/types';
import * as plaid from './plaid';

function assembleFinancialData(): FinancialData {
  const db = getDb();
  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  // Accounts → cashOnHand
  const accts = db.select().from(accounts).all();
  const cashOnHand = accts.reduce((sum, a) => sum + a.availableBalance, 0);

  // Obligations
  const oblRows = db.select().from(obligations).all();
  const oblEntries: Obligation[] = oblRows.map(o => ({
    id: o.id,
    name: o.name,
    amount: o.amount,
    dueDate: new Date(o.dueDate),
    severityTier: o.severityTier as Obligation['severityTier'],
    timePressure: o.timePressure as Obligation['timePressure'],
    reliefPerDollar: o.reliefPerDollar,
    negotiability: o.negotiability,
    bestAction: o.bestAction as Obligation['bestAction'],
    consequenceIfIgnored: o.consequenceIfIgnored,
    cashReserved: 0,
    isPastDue: o.isPastDue,
    daysUntilDue: o.daysUntilDue,
  }));

  // Revenue
  const revRows = db.select().from(revenue).all();
  const revEntries: RevenueEntry[] = revRows.map(r => ({
    id: r.id,
    amount: r.amount,
    expectedDate: new Date(r.expectedDate),
    confidence: r.confidence as RevenueEntry['confidence'],
    sourceType: r.sourceType,
    unlocks: JSON.parse(r.unlocks),
    description: r.description,
  }));

  // Income = confirmed revenue this month
  const confirmedRevenue = revRows
    .filter(r => r.confidence === 'confirmed' && r.expectedDate >= monthStart)
    .reduce((sum, r) => sum + r.amount, 0);

  // Spent from flex = sum of non-business category spend
  const spendRows = db.select().from(categorySpend).all();
  const spentFromFlex = spendRows
    .filter(s => !s.isBusinessExpense)
    .reduce((sum, s) => sum + s.spent, 0);

  // Catch-up = past-due obligations
  const catchUpNeeds = oblRows
    .filter(o => o.isPastDue)
    .reduce((sum, o) => sum + o.amount, 0);

  // Config from store
  const config = store.get('financeConfig') as {
    flexPoolTarget: number;
    survivalNeeds: number;
    untouchableNeeds: number;
  };

  return {
    obligations: oblEntries,
    revenue: revEntries,
    transactions: [],
    income: confirmedRevenue,
    cashOnHand,
    flexPoolTarget: config.flexPoolTarget,
    spentFromFlex,
    survivalNeeds: config.survivalNeeds,
    untouchableNeeds: config.untouchableNeeds,
    catchUpNeeds,
    today: now,
  };
}

async function syncPlaidData(): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();

  // Sync balances
  const balances = await plaid.getBalances();
  for (const b of balances) {
    db.insert(accounts).values({
      id: b.id,
      name: b.name,
      type: b.type,
      currentBalance: b.currentBalance,
      availableBalance: b.availableBalance,
      institution: b.institution,
      lastSynced: now,
    }).onConflictDoUpdate({
      target: accounts.id,
      set: {
        currentBalance: b.currentBalance,
        availableBalance: b.availableBalance,
        lastSynced: now,
      },
    }).run();
  }

  store.set('plaid.lastSync', now);

  // Sync institution name from first account
  if (balances.length > 0 && balances[0].institution) {
    store.set('plaid.institutionName', balances[0].institution);
  }
}

export function getEngineState(): EngineState {
  const data = assembleFinancialData();
  return computeEngineState(data);
}

export function getActionItems() {
  const db = getDb();
  return db.select().from(actionItems).all();
}

export function registerFinanceHandlers() {
  ipcMain.handle('finance:get-state', () => {
    try {
      return getEngineState();
    } catch (error) {
      console.error('finance:get-state error:', error);
      return null;
    }
  });

  ipcMain.handle('finance:refresh', async () => {
    try {
      await syncPlaidData();
      return getEngineState();
    } catch (error) {
      console.error('finance:refresh error:', error);
      return null;
    }
  });

  ipcMain.handle('finance:plaid-link', async () => {
    try {
      const linkToken = await plaid.createLinkToken();
      return { linkToken };
    } catch (error) {
      console.error('finance:plaid-link error:', error);
      throw error;
    }
  });

  ipcMain.handle('finance:plaid-exchange', async (_event, publicToken: string) => {
    try {
      await plaid.exchangePublicToken(publicToken);
      await syncPlaidData();
      return { success: true };
    } catch (error) {
      console.error('finance:plaid-exchange error:', error);
      return { success: false };
    }
  });
}
```

- [ ] **Step 2: Register in main.ts**

Add import at top of `electron/main.ts`:

```ts
import { registerFinanceHandlers } from './finance';
```

Add call after line 205 (after `registerCaptureHandlers()`):

```ts
  registerFinanceHandlers();
```

- [ ] **Step 3: Add finance namespace to preload.ts**

In `electron/preload.ts`, add inside the `contextBridge.exposeInMainWorld('api', {` block:

```ts
  // Finance (Compass engine)
  finance: {
    getState: () => ipcRenderer.invoke('finance:get-state'),
    refresh: () => ipcRenderer.invoke('finance:refresh'),
    plaidLink: () => ipcRenderer.invoke('finance:plaid-link'),
    plaidExchange: (publicToken: string) => ipcRenderer.invoke('finance:plaid-exchange', publicToken),
  },
```

- [ ] **Step 4: Add FinanceAPI type declaration**

In `src/types/electron.d.ts`, add before the `declare global` block:

```ts
interface FinanceAPI {
  getState: () => Promise<import('../engine/types').EngineState | null>;
  refresh: () => Promise<import('../engine/types').EngineState | null>;
  plaidLink: () => Promise<{ linkToken: string }>;
  plaidExchange: (publicToken: string) => Promise<{ success: boolean }>;
}
```

Add `finance: FinanceAPI;` to the `Window.api` interface (after `capture: CaptureAPI;`).

- [ ] **Step 5: Verify build**

```bash
npm run build
```

Expected: clean compilation.

- [ ] **Step 6: Commit**

```bash
git add electron/finance.ts electron/main.ts electron/preload.ts src/types/electron.d.ts
git commit -m "feat: add finance IPC handlers with Plaid sync and engine state"
```

---

## Task 7: Add Money view to sidebar and app routing

**Files:**
- Modify: `src/context/AppContext.tsx:49` (View type)
- Modify: `src/components/Sidebar.tsx:134-161` (nav item)
- Modify: `src/App.tsx:339-354` (view switch)
- Create: `src/hooks/useFinance.ts`
- Create: `src/components/MoneyView.tsx`

- [ ] **Step 1: Add 'money' to View type**

In `src/context/AppContext.tsx`, change line 49:

```ts
export type View = 'flow' | 'archive' | 'goals' | 'scratch' | 'money';
```

- [ ] **Step 2: Create useFinance hook**

Create `src/hooks/useFinance.ts`:

```ts
import { useState, useCallback, useEffect } from 'react';
import type { EngineState } from '../../engine/types';

interface ActionItem {
  id: string;
  description: string;
  status: string;
  dueDate: string | null;
  amount: number | null;
  createdAt: string;
  completedAt: string | null;
}

export function useFinance() {
  const [state, setState] = useState<EngineState | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.finance.getState();
      setState(result);
    } catch (error) {
      console.error('Failed to fetch finance state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.finance.refresh();
      setState(result);
    } catch (error) {
      console.error('Failed to refresh finance state:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  return { state, actionItems, loading, refresh };
}
```

- [ ] **Step 3: Create MoneyView component (3 states, 5 sections, adaptive density)**

Create `src/components/MoneyView.tsx`.

**Important:** The Plaid Link flow requires opening a child BrowserWindow (not an OAuth redirect — Plaid Link is a hosted JS widget). This is a known integration challenge. The "Connect Bank" button creates the link token but the actual BrowserWindow popup is a self-contained piece of work — implement it as a helper that opens a BrowserWindow loading the Plaid Link URL, listens for the `postMessage` callback with the public token, then calls `plaidExchange`. If the BrowserWindow approach proves problematic due to CSP, fall back to opening the system browser with a localhost redirect.

```tsx
import { useState, useEffect } from 'react';
import { useFinance } from '@/hooks/useFinance';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { EngineState } from '../../engine/types';

// Adaptive density: cognitiveState controls which sections are expanded
function useExpandedSections(cognitiveState: EngineState['cognitiveState']) {
  // calm = number only, alert = number + upcoming + actions, compressed = everything
  return {
    cashJobs: cognitiveState === 'compressed',
    upcoming: cognitiveState !== 'calm',
    actionItems: cognitiveState !== 'calm',
    recommendations: cognitiveState === 'compressed',
    pipeline: cognitiveState === 'compressed',
  };
}

export function MoneyView() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const { state, loading, refresh, actionItems } = useFinance();

  useEffect(() => {
    window.api.store.get('finance.configured').then((val) => {
      setConfigured(Boolean(val));
    });
    window.api.settings.load().then((s) => {
      if (s.finance.lastSync) setLastSync(s.finance.lastSync);
    });
  }, []);

  // Unconnected state
  if (configured === false) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm text-center space-y-4">
          <h2 className="text-lg font-medium text-text-primary">Money</h2>
          <p className="text-sm text-text-muted">
            Connect your bank to see your financial picture alongside your daily plan.
          </p>
          <button
            onClick={async () => {
              try {
                const { linkToken } = await window.api.finance.plaidLink();
                // Opens Plaid Link in a child BrowserWindow — see electron/plaid-link.ts
                // After success, calls window.api.finance.plaidExchange(publicToken)
                // then refreshes state and sets configured = true
              } catch (error) {
                console.error('Failed to create link token:', error);
              }
            }}
            className="px-4 py-2 rounded-md bg-accent-warm/20 text-accent-warm text-sm hover:bg-accent-warm/30 transition-colors"
          >
            Connect Bank
          </button>
        </div>
      </div>
    );
  }

  // Loading / syncing state
  if (configured === null || (loading && !state)) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">Getting your accounts...</p>
      </div>
    );
  }

  // Error state
  if (!state) {
    return (
      <div className="flex h-full items-center justify-center gap-2">
        <p className="text-sm text-text-muted">Unable to load financial data.</p>
        <button onClick={refresh} className="text-accent-warm text-sm hover:underline">
          Try again
        </button>
      </div>
    );
  }

  const expanded = useExpandedSections(state.cognitiveState);
  const pendingActions = actionItems.filter(a => a.status === 'pending');

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header with refresh + data freshness */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-text-primary">Money</h2>
        <div className="flex items-center gap-2">
          {lastSync && (
            <span className="text-[11px] text-text-muted">
              Updated {formatDistanceToNow(new Date(lastSync), { addSuffix: true })}
            </span>
          )}
          <button
            onClick={async () => {
              await refresh();
              const s = await window.api.settings.load();
              if (s.finance.lastSync) setLastSync(s.finance.lastSync);
            }}
            disabled={loading}
            className={cn(
              'p-1.5 rounded-md text-text-muted hover:text-text-primary transition-colors',
              loading && 'animate-spin'
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. The Number — always visible */}
      <div className="text-center py-8">
        <div className="text-4xl font-semibold text-text-primary">
          ${state.permissionNumber.toLocaleString()}
        </div>
        <p className="mt-2 text-sm text-text-muted">
          {state.permissionNumber > 0 ? 'Bills are covered.' : 'Bills need attention.'}{' '}
          ${state.permissionNumber.toLocaleString()} left for the week.
        </p>
      </div>

      {/* 2. Cash Jobs — expanded when compressed */}
      {expanded.cashJobs && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-muted mb-3">Where your money is working</h3>
          <div className="space-y-2">
            {[
              { label: 'Bills reserved', value: state.cashJobs.survival },
              { label: 'Operating', value: state.cashJobs.operating },
              { label: 'Catch-up', value: state.cashJobs.catchUp },
              { label: 'Untouchable', value: state.cashJobs.untouchable },
              { label: 'Free', value: state.cashJobs.trulyFree },
            ].filter(j => j.value > 0).map(job => (
              <div key={job.label} className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{job.label}</span>
                <span className="text-text-primary">${job.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Upcoming — expanded when alert or compressed */}
      {expanded.upcoming && state.obligations.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-muted mb-3">Upcoming</h3>
          <div className="space-y-2">
            {state.obligations
              .filter(o => o.daysUntilDue >= 0 && o.daysUntilDue <= 14)
              .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
              .map(o => (
                <div key={o.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-text-primary">{o.name}</span>
                    <span className="text-text-muted ml-2">
                      {o.daysUntilDue === 0 ? 'today' : `in ${o.daysUntilDue}d`}
                    </span>
                  </div>
                  <span className="text-text-primary">${o.amount.toLocaleString()}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* 4. Action Items — expanded when alert or compressed */}
      {expanded.actionItems && pendingActions.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-muted mb-3">Action items</h3>
          <div className="space-y-2">
            {pendingActions.map(a => (
              <div key={a.id} className="flex items-center justify-between text-sm p-3 rounded-md bg-bg-card border border-border-subtle">
                <div>
                  <span className="text-text-primary">{a.description}</span>
                  {a.dueDate && new Date(a.dueDate) < new Date() && (
                    <span className="text-accent-warm ml-2 text-xs">overdue</span>
                  )}
                </div>
                {a.amount && (
                  <span className="text-text-muted">${a.amount.toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. Business Pipeline — expanded when compressed */}
      {expanded.pipeline && state.revenue.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-muted mb-3">Business pipeline</h3>
          <div className="space-y-2">
            {(['confirmed', 'invoiced', 'verbal', 'speculative'] as const).map(confidence => {
              const items = state.revenue.filter(r => r.confidence === confidence);
              if (items.length === 0) return null;
              const total = items.reduce((sum, r) => sum + r.amount, 0);
              return (
                <div key={confidence} className="flex items-center justify-between text-sm">
                  <span className="text-text-muted capitalize">{confidence}</span>
                  <span className="text-text-primary">${total.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommendations — expanded when compressed */}
      {expanded.recommendations && state.recommendations.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-text-muted mb-3">Next moves</h3>
          <div className="space-y-2">
            {state.recommendations.map(r => (
              <div key={r.id} className="text-sm p-3 rounded-md bg-bg-card border border-border-subtle">
                <span className="capitalize text-accent-warm">{r.actionVerb}</span>{' '}
                <span className="text-text-primary">{r.target}</span>
                {r.amount > 0 && <span className="text-text-muted"> — ${r.amount.toLocaleString()}</span>}
                <div className="text-xs text-text-muted mt-1">Protects: {r.protects}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add Money nav item to Sidebar**

In `src/components/Sidebar.tsx`, add a `Wallet` import from lucide-react and add a NavItem between "Today's Commit" and "Archive" (after line 147):

```tsx
        <NavItem
          icon={Wallet}
          label="Money"
          collapsed={collapsed}
          active={activeView === 'money'}
          onClick={() => setActiveView('money')}
        />
```

- [ ] **Step 5: Add money case to App.tsx view switch**

In `src/App.tsx`, add after the scratch view block (after line 353):

```tsx
            {activeView === 'money' && (
              <Suspense fallback={null}>
                <MoneyView />
              </Suspense>
            )}
```

Add the lazy import at the top of `src/App.tsx`:

```tsx
const MoneyView = lazy(() => import('./components/MoneyView').then(m => ({ default: m.MoneyView })));
```

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: clean compilation.

- [ ] **Step 7: Commit**

```bash
git add src/context/AppContext.tsx src/components/Sidebar.tsx src/App.tsx src/hooks/useFinance.ts src/components/MoneyView.tsx
git commit -m "feat: add Money sidebar view with 3-state shell and useFinance hook"
```

---

## Task 8: Add financial context to morning briefing

**Files:**
- Modify: `src/types/electron.d.ts:30-63` (BriefingContext)
- Modify: `electron/anthropic.ts:38-69` (BriefingContext interface)
- Modify: `electron/anthropic.ts:216+` (buildSystemPrompt)

- [ ] **Step 1: Add finance field to BriefingContext type**

In `src/types/electron.d.ts`, add to the `BriefingContext` interface (after `inkMode`):

```ts
  finance?: {
    weeklyRemaining: number;
    weeklyRemainingContext: 'normal' | 'tight' | 'comfortable';
    billsCovered: boolean;
    cognitiveState: 'calm' | 'alert' | 'compressed';
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
  };
```

- [ ] **Step 2: Mirror the type in electron/anthropic.ts**

**Known issue:** The `BriefingContext` interface is duplicated — `src/types/electron.d.ts` (canonical) and `electron/anthropic.ts` (local copy, already missing `planningDate`, `planningDateLabel`, `planningDateIsToday`). These interfaces are already out of sync. Add the same `finance?` field to the `BriefingContext` interface in `electron/anthropic.ts` (line 69, before the closing brace). Ideally both files should import from a single source — but that refactor is outside this plan's scope. At minimum, ensure both files have the `finance?` field.

- [ ] **Step 3: Add financial context to buildSystemPrompt**

In `electron/anthropic.ts`, inside `buildSystemPrompt()` (after the existing context sections like calendar, tasks, etc.), add:

```ts
  // Financial context (Compass engine)
  let financeSection = '';
  if (ctx.finance) {
    const f = ctx.finance;
    const statusLine = f.billsCovered
      ? `Bills are covered. $${f.weeklyRemaining.toLocaleString()} left for the week — ${f.weeklyRemainingContext === 'normal' ? "that's normal" : f.weeklyRemainingContext === 'tight' ? 'tighter than usual' : 'more room than usual'}.`
      : `Bills need attention. $${f.weeklyRemaining.toLocaleString()} available.`;

    const upcomingLines = f.upcoming
      .filter(u => u.daysUntil <= 5)
      .map(u => `- ${u.name}: $${u.amount} in ${u.daysUntil}d${u.covered ? '' : ' (NOT COVERED)'}${u.category === 'business' ? ' [business]' : ''}`)
      .join('\n');

    const actionLines = f.actionItems
      .map(a => `- ${a.description}${a.daysOverdue ? ` (${a.daysOverdue}d overdue)` : ''}${a.amount ? ` — $${a.amount}` : ''}`)
      .join('\n');

    const recLines = f.recommendations
      .map(r => `- ${r.action} ${r.target}${r.amount > 0 ? ` ($${r.amount})` : ''}: ${r.reason}`)
      .join('\n');

    financeSection = `

## FINANCIAL CONTEXT (Compass)
Financial cognitive state: ${f.cognitiveState}
${statusLine}
${upcomingLines ? `\nUpcoming obligations:\n${upcomingLines}` : ''}
${actionLines ? `\nFinancial action items:\n${actionLines}` : ''}
${recLines ? `\nRecommended moves:\n${recLines}` : ''}
${f.businessPipeline ? `\nBusiness pipeline: $${f.businessPipeline.confirmedThisMonth} confirmed this month, $${f.businessPipeline.invoicedOutstanding} invoiced outstanding, ${f.businessPipeline.overdueInvoices} overdue invoices` : ''}

FINANCIAL TONE RULES:
- "Bills are covered" not "you have sufficient funds"
- "Tighter than usual" not "you're running low"
- Frame business expenses as decisions: "Ad spend renews Friday ($200) — keep it running?"
- Frame growth/debt moves as opportunities, not obligations
- Never use red language, urgency language, or judgment. Describe, don't evaluate.
- If financial cognitive state is "calm" and nothing due within 5 days, do NOT proactively mention money.
- If "alert" or "compressed", lead with the financial situation before task planning.
`;
  }
```

Then append `financeSection` to the system prompt string being assembled.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: clean compilation.

- [ ] **Step 5: Commit**

```bash
git add src/types/electron.d.ts electron/anthropic.ts
git commit -m "feat: add financial context to morning briefing system prompt"
```

---

## Task 9: Wire briefing context assembly to finance engine

**Files:**
- Modify: `electron/anthropic.ts` (the function that assembles BriefingContext before sending to Claude)

- [ ] **Step 1: Find and read the briefing context assembly function**

Search `electron/anthropic.ts` for where `BriefingContext` is received or assembled in the `ai:chat` and `ai:stream:start` handlers. The briefing context is passed from the renderer, but the engine state needs to be injected server-side.

- [ ] **Step 2: Add finance context injection to the IPC handlers**

In the `ai:chat` and `ai:stream:start` handlers in `electron/anthropic.ts`, before passing context to `buildSystemPrompt()`, inject finance data:

```ts
import { getEngineState, getActionItems } from './finance';
import { store } from './store';

// Inside the handler, before buildSystemPrompt(context):
if (store.get('finance.configured')) {
  try {
    const engineState = getEngineState();
    const actions = getActionItems();
    const weeklyPattern = (store.get('finance.weeklyPattern') as number[]) || [];
    const avg = weeklyPattern.length > 0
      ? weeklyPattern.reduce((a, b) => a + b, 0) / weeklyPattern.length
      : null;

    const weeklyRemainingContext: 'normal' | 'tight' | 'comfortable' =
      avg === null ? 'normal'
      : engineState.permissionNumber < avg * 0.7 ? 'tight'
      : engineState.permissionNumber > avg * 1.3 ? 'comfortable'
      : 'normal';

    context.finance = {
      weeklyRemaining: engineState.permissionNumber,
      weeklyRemainingContext,
      billsCovered: engineState.cashJobs.survival > 0 || engineState.obligations.every(o => !o.isPastDue),
      cognitiveState: engineState.cognitiveState,
      upcoming: engineState.obligations
        .filter(o => o.daysUntilDue >= 0 && o.daysUntilDue <= 14)
        .map(o => ({
          name: o.name,
          amount: o.amount,
          daysUntil: o.daysUntilDue,
          covered: o.cashReserved >= o.amount,
          category: 'personal' as const, // DB has category but engine Obligation type doesn't — use 'personal' default, extend in Phase 2
        })),
      actionItems: actions
        .filter(a => a.status === 'pending')
        .map(a => ({
          description: a.description,
          daysOverdue: a.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(a.dueDate).getTime()) / 86400000)) : undefined,
          amount: a.amount ?? undefined,
        })),
      recommendations: engineState.recommendations.map(r => ({
        action: r.actionVerb,
        target: r.target,
        amount: r.amount,
        reason: r.protects,
      })),
    };
  } catch (error) {
    console.error('Failed to inject finance context into briefing:', error);
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: clean compilation.

- [ ] **Step 4: Commit**

```bash
git add electron/anthropic.ts
git commit -m "feat: inject Compass engine state into briefing context"
```

---

## Task 10: Add finance section to settings panel

**Files:**
- Modify: existing Settings component (find with `grep -r 'SettingsUpdate\|settings:save' src/`)
- Create: `src/components/FinanceSettings.tsx` (if settings uses sub-components)

- [ ] **Step 1: Locate the settings component**

```bash
grep -rl 'SettingsUpdate\|settings\.save\|onSettingsClick' src/components/
```

- [ ] **Step 2: Add finance settings section**

Add a "Finance" section to the settings panel with:
- Plaid Client ID input field
- Plaid Secret input field (masked)
- Connection status (configured/not configured, institution name, last sync)
- Connect/Disconnect button

Follow the existing pattern for Asana token and GCal credentials — the settings panel already has credential input fields with save handlers.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/FinanceSettings.tsx src/components/Settings*.tsx
git commit -m "feat: add Finance section to settings panel"
```

---

## Task 11: Run full test suite and verify

- [ ] **Step 1: Run all tests**

```bash
npm run test
```

Expected: all existing tests pass, all new engine tests pass.

- [ ] **Step 2: Run full build**

```bash
npm run build
```

Expected: clean TypeScript compilation with no errors.

- [ ] **Step 3: Manual smoke test**

Tell user: "Open the app in Electron and verify:
1. Money nav item appears in sidebar
2. Clicking it shows the unconnected state
3. Settings panel has a Finance section
4. All other views still work normally"

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup after Compass integration"
```

---

## Task summary

| Task | Description | Key files |
|------|-------------|-----------|
| 1 | Install dependencies + native rebuild | package.json |
| 2 | Copy Compass engine | engine/* |
| 3 | SQLite database schema | electron/db.ts |
| 4 | Expand electron-store | electron/store.ts, electron.d.ts |
| 5 | Plaid SDK wrapper | electron/plaid.ts |
| 6 | Finance IPC handlers | electron/finance.ts, main.ts, preload.ts |
| 7 | Money sidebar view + routing | MoneyView.tsx, Sidebar.tsx, App.tsx |
| 8 | Briefing context expansion | anthropic.ts, electron.d.ts |
| 9 | Wire briefing to engine | anthropic.ts |
| 10 | Finance settings panel | FinanceSettings.tsx |
| 11 | Test suite + verification | all |
