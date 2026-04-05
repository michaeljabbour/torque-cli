/**
 * Tests for migrate rollback helpers and rollback workflow.
 *
 * Tests:
 * 1. getLastMigration returns the most recently applied migration for a bundle
 * 2. getLastMigration returns null when no migrations exist
 * 3. removeMigrationRecord deletes the migration row
 * 4. Full rollback calls down() and removes the tracking row
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';

import { getLastMigration, removeMigrationRecord } from '../commands/migrate.js';

// Helper: create and seed the _torque_migrations tracking table
function createMigrationsDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS _torque_migrations (
      id TEXT PRIMARY KEY,
      bundle TEXT NOT NULL,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  return db;
}

// ── Test 1: getLastMigration returns the most recently applied migration ──────

test('getLastMigration returns the most recently applied migration for a bundle', () => {
  const db = createMigrationsDb();

  db.prepare(
    'INSERT INTO _torque_migrations (id, bundle, name, applied_at) VALUES (?, ?, ?, ?)'
  ).run('uuid-1', 'auth', 'auth/001_create_users.js', '2024-01-01T00:00:00.000Z');

  db.prepare(
    'INSERT INTO _torque_migrations (id, bundle, name, applied_at) VALUES (?, ?, ?, ?)'
  ).run('uuid-2', 'auth', 'auth/002_add_tokens.js', '2024-01-02T00:00:00.000Z');

  const row = getLastMigration(db);

  assert.ok(row !== null, 'should return a row');
  assert.strictEqual(row.name, 'auth/002_add_tokens.js', 'should return the most recently applied migration');
  assert.strictEqual(row.bundle, 'auth');

  db.close();
});

// ── Test 2: getLastMigration returns null when no migrations exist ─────────────

test('getLastMigration returns null when no migrations exist', () => {
  const db = createMigrationsDb();

  const row = getLastMigration(db);

  assert.strictEqual(row, null, 'should return null when table is empty');

  db.close();
});

// ── Test 3: removeMigrationRecord deletes the migration row ───────────────────

test('removeMigrationRecord deletes the migration row', () => {
  const db = createMigrationsDb();

  db.prepare(
    'INSERT INTO _torque_migrations (id, bundle, name, applied_at) VALUES (?, ?, ?, ?)'
  ).run('uuid-1', 'tasks', 'tasks/001_create_tasks.js', '2024-01-01T00:00:00.000Z');

  // Verify it exists
  let row = db.prepare('SELECT * FROM _torque_migrations WHERE name = ?').get('tasks/001_create_tasks.js');
  assert.ok(row, 'row should exist before removal');

  removeMigrationRecord(db, 'tasks/001_create_tasks.js');

  // Verify it's gone
  row = db.prepare('SELECT * FROM _torque_migrations WHERE name = ?').get('tasks/001_create_tasks.js');
  assert.strictEqual(row, undefined, 'row should be deleted');

  db.close();
});

// ── Test 4: Full rollback calls down() and removes the tracking row ───────────

test('full rollback calls down() and removes the tracking row', async () => {
  const db = createMigrationsDb();

  // Create a temp directory for our fake bundle migrations
  const tempDir = join(tmpdir(), `torque-rollback-test-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  // Create a temp migration file with up() and down() exports
  const migrationPath = join(tempDir, '001_create_test_table.js');
  writeFileSync(migrationPath, `
export function up(db) {
  db.exec('CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY)');
}

export function down(db) {
  db.exec('DROP TABLE IF EXISTS test_table');
}
`);

  // Insert tracking row pointing to our temp migration
  const migrationName = 'test-bundle/001_create_test_table.js';
  db.prepare(
    'INSERT INTO _torque_migrations (id, bundle, name, applied_at) VALUES (?, ?, ?, ?)'
  ).run('uuid-temp', 'test-bundle', migrationName, '2024-01-01T00:00:00.000Z');

  // Run up() to set up the state
  const migrationModule = await import(migrationPath);
  migrationModule.up(db);

  // Verify the table was created by up()
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'").all();
  assert.strictEqual(tables.length, 1, 'test_table should exist after up()');

  // Simulate the rollback workflow using helper functions:
  // 1. Find the last migration
  const lastMigration = getLastMigration(db);
  assert.ok(lastMigration, 'should find the last migration');
  assert.strictEqual(lastMigration.name, migrationName);

  // 2. Run down() and remove tracking row in a transaction
  assert.ok(typeof migrationModule.down === 'function', 'migration must have a down() export');

  const rollback = db.transaction(() => {
    migrationModule.down(db);
    removeMigrationRecord(db, lastMigration.name);
  });
  rollback();

  // 3. Verify down() ran (table should be dropped)
  const tablesAfter = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'").all();
  assert.strictEqual(tablesAfter.length, 0, 'test_table should be dropped after down()');

  // 4. Verify tracking row was removed
  const remainingRows = db.prepare('SELECT * FROM _torque_migrations').all();
  assert.strictEqual(remainingRows.length, 0, 'tracking row should be removed after rollback');

  // Cleanup
  db.close();
  rmSync(tempDir, { recursive: true, force: true });
});
