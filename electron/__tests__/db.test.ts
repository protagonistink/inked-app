import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { CREATE_TABLES_SQL, obligations, revenue } from '../db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMemoryDb() {
  const sqlite = new Database(':memory:');
  // Execute each statement individually (sqlite3 exec handles multiple, but
  // drizzle-kit tooling is not needed here — we use raw sqlite directly).
  sqlite.exec(CREATE_TABLES_SQL);
  return { sqlite, db: drizzle(sqlite) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('db schema (in-memory)', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const result = createMemoryDb();
    sqlite = result.sqlite;
    db = result.db;
  });

  afterEach(() => {
    sqlite.close();
  });

  it('creates all 5 tables', () => {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain('accounts');
    expect(tableNames).toContain('obligations');
    expect(tableNames).toContain('revenue');
    expect(tableNames).toContain('category_spend');
    expect(tableNames).toContain('action_items');
    expect(tableNames).toHaveLength(5);
  });

  it('inserts and reads an obligation row', () => {
    const row = {
      id: 'obl-001',
      name: 'Rent',
      amount: 1500,
      due_date: '2026-04-01',
      severity_tier: 'critical',
      time_pressure: 'high',
      relief_per_dollar: 0.8,
      negotiability: 0.2,
      best_action: 'pay',
      consequence_if_ignored: 'eviction',
      is_past_due: false,
      days_until_due: 10,
      category: 'personal',
      frequency: 'monthly',
      source: 'manual',
    };

    db.insert(obligations).values(row).run();

    const results = db.select().from(obligations).where(eq(obligations.id, 'obl-001')).all();
    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result.name).toBe('Rent');
    expect(result.amount).toBe(1500);
    expect(result.severity_tier).toBe('critical');
    expect(result.is_past_due).toBe(false);
    expect(result.source).toBe('manual');
  });

  it('inserts and reads a revenue entry', () => {
    const row = {
      id: 'rev-001',
      amount: 5000,
      expected_date: '2026-03-25',
      confidence: 'invoiced',
      source_type: 'client_invoice',
      description: 'Client project payment',
      category: 'business',
      unlocks: '["rent","groceries"]',
    };

    db.insert(revenue).values(row).run();

    const results = db.select().from(revenue).where(eq(revenue.id, 'rev-001')).all();
    expect(results).toHaveLength(1);
    const result = results[0];
    expect(result.amount).toBe(5000);
    expect(result.confidence).toBe('invoiced');
    expect(result.source_type).toBe('client_invoice');
    expect(result.category).toBe('business');
    expect(result.unlocks).toBe('["rent","groceries"]');
  });
});
