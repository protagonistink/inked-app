import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// ---------------------------------------------------------------------------
// Table definitions
// ---------------------------------------------------------------------------

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  current_balance: real('current_balance').notNull(),
  available_balance: real('available_balance').notNull(),
  institution: text('institution'),
  last_synced: text('last_synced').notNull(),
});

export const obligations = sqliteTable('obligations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  due_date: text('due_date').notNull(),
  severity_tier: text('severity_tier').notNull(),
  time_pressure: text('time_pressure').notNull(),
  relief_per_dollar: real('relief_per_dollar').notNull().default(0.5),
  negotiability: real('negotiability').notNull().default(0.5),
  best_action: text('best_action').notNull().default('pay'),
  consequence_if_ignored: text('consequence_if_ignored').notNull().default(''),
  is_past_due: integer('is_past_due', { mode: 'boolean' }).notNull().default(false),
  days_until_due: integer('days_until_due').notNull().default(0),
  category: text('category').notNull().default('personal'),
  frequency: text('frequency').notNull().default('monthly'),
  source: text('source').notNull().default('plaid'),
});

export const revenue = sqliteTable('revenue', {
  id: text('id').primaryKey(),
  amount: real('amount').notNull(),
  expected_date: text('expected_date').notNull(),
  confidence: text('confidence').notNull(),
  source_type: text('source_type').notNull(),
  description: text('description').notNull().default(''),
  category: text('category').notNull().default('personal'),
  unlocks: text('unlocks').notNull().default('[]'),
});

export const category_spend = sqliteTable('category_spend', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  spent: real('spent').notNull(),
  budget: real('budget'),
  cycle_start: text('cycle_start').notNull(),
  cycle_end: text('cycle_end').notNull(),
  is_business_expense: integer('is_business_expense', { mode: 'boolean' }).notNull().default(false),
  last_synced: text('last_synced').notNull(),
});

export const action_items = sqliteTable('action_items', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  status: text('status').notNull().default('pending'),
  due_date: text('due_date'),
  amount: real('amount'),
  related_obligation_id: text('related_obligation_id'),
  related_revenue_id: text('related_revenue_id'),
  created_at: text('created_at').notNull(),
  completed_at: text('completed_at'),
});

// ---------------------------------------------------------------------------
// Raw SQL for test use with :memory: databases
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Singleton database instance
// ---------------------------------------------------------------------------

let _db: BetterSQLite3Database | null = null;
let _sqlite: Database.Database | null = null;

export function getDb(): BetterSQLite3Database {
  if (_db) return _db;

  // Dynamic import of `app` so this module can be imported in tests without
  // Electron present (tests use :memory: directly and never call getDb()).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require('electron') as typeof import('electron');
  const userDataPath = app.getPath('userData');
  const dbPath = `${userDataPath}/compass.db`;

  _sqlite = new Database(dbPath);
  _sqlite.pragma('journal_mode = WAL');

  // Create tables on first open
  _sqlite.exec(CREATE_TABLES_SQL);

  _db = drizzle(_sqlite);
  return _db;
}

export function closeDb(): void {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}
