/**
 * Feature 19: Per-bundle database migrations.
 *
 * Commands:
 *   torque migrate:generate   - Diff manifests vs DB, generate migration files
 *   torque migrate:run        - Apply pending migrations in dependency order
 *   torque migrate:status     - Show migration status per bundle
 *   torque migrate:rollback   - Rollback last migration
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import { importFromProject } from '../lib/resolve.js';

export default async function migrate() {
  const sub = process.argv[3];
  if (sub === 'generate' || sub === ':generate') return migrateGenerate();
  if (sub === 'run' || sub === ':run') return migrateRun();
  if (sub === 'status' || sub === ':status') return migrateStatus();
  if (sub === 'rollback' || sub === ':rollback') return migrateRollback();
  if (sub === 'preview' || sub === ':preview') return migratePreview();

  console.log('Usage: torque migrate <generate|run|status|rollback|preview>');
  console.log('');
  console.log('  generate   Diff manifest schemas against DB, create migration files');
  console.log('  run        Apply pending migrations in dependency order');
  console.log('  status     Show migration status per bundle');
  console.log('  rollback   Rollback the last applied migration');
  console.log('  preview    Preview pending migrations without applying them');
  return 1;
}

async function migrateGenerate() {
  const appDir = resolve(process.cwd());
  const bundlesDir = join(appDir, 'bundles');

  if (!existsSync(bundlesDir)) {
    console.error('No bundles/ directory found.');
    return 1;
  }

  const bundleDirs = readdirSync(bundlesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(join(bundlesDir, d.name, 'manifest.yml')));

  let generated = 0;

  for (const bd of bundleDirs) {
    const manifestPath = join(bundlesDir, bd.name, 'manifest.yml');
    const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
    const tables = manifest.schema?.tables || {};

    if (Object.keys(tables).length === 0) continue;

    const migrationsDir = join(bundlesDir, bd.name, 'migrations');
    mkdirSync(migrationsDir, { recursive: true });

    // Load existing snapshot (last known schema state)
    const snapshotPath = join(migrationsDir, '.schema-snapshot.json');
    let snapshot = {};
    if (existsSync(snapshotPath)) {
      try { snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')); } catch {}
    }

    // Diff current manifest tables vs snapshot
    const changes = diffSchema(tables, snapshot);

    if (changes.length === 0) {
      console.log(`  ${bd.name}: up to date`);
      continue;
    }

    // Generate migration file
    const existingMigrations = readdirSync(migrationsDir)
      .filter(f => f.match(/^\d{3}_.*\.js$/))
      .sort();
    const nextNum = String(existingMigrations.length + 1).padStart(3, '0');
    // Build a concise migration name from changes
    const typeCounts = {};
    for (const c of changes) typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
    const description = Object.entries(typeCounts).map(([t, n]) => n > 1 ? `${t}_x${n}` : t).join('_').replace(/[^a-z0-9_]/gi, '');
    const migrationName = `${nextNum}_${description}.js`;
    const migrationPath = join(migrationsDir, migrationName);

    const code = generateMigrationCode(bd.name, changes);
    writeFileSync(migrationPath, code);

    // Update snapshot
    writeFileSync(snapshotPath, JSON.stringify(tables, null, 2));

    console.log(`  ${bd.name}: generated ${migrationName}`);
    for (const c of changes) {
      console.log(`    ${c.type}: ${c.description}`);
    }
    generated++;
  }

  if (generated === 0) {
    console.log('All bundles up to date — no migrations needed.');
  } else {
    console.log(`\nGenerated ${generated} migration(s). Run: torque migrate run`);
  }
  return 0;
}

async function migrateRun() {
  const appDir = resolve(process.cwd());

  // Boot kernel without HTTP to get the data layer
  try {
    const { boot } = await importFromProject('@torquedev/core/boot');
    const { registry, dataLayer } = await boot({
      db: process.env.DB_PATH || 'data/dev.sqlite3',
      serve: false,
      silent: true,
    });

    // Ensure migration tracking table
    dataLayer.db.exec(`
      CREATE TABLE IF NOT EXISTS _torque_migrations (
        id TEXT PRIMARY KEY,
        bundle TEXT NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const applied = new Set(
      dataLayer.db.prepare('SELECT name FROM _torque_migrations').all().map(r => r.name)
    );

    const bundlesDir = join(appDir, 'bundles');
    const bundleDirs = readdirSync(bundlesDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    let total = 0;

    // Apply in bundle dependency order (use registry's active bundles)
    for (const name of registry.activeBundles()) {
      const migrationsDir = join(bundlesDir, name, 'migrations');
      if (!existsSync(migrationsDir)) continue;

      const migrations = readdirSync(migrationsDir)
        .filter(f => f.match(/^\d{3}_.*\.js$/) && !applied.has(`${name}/${f}`))
        .sort();

      for (const file of migrations) {
        const fullKey = `${name}/${file}`;
        console.log(`  Applying ${fullKey}...`);
        try {
          const mod = await import(join(migrationsDir, file));
          const migrateFn = mod.up || mod.default;
          if (migrateFn) await migrateFn(dataLayer.db);

          dataLayer.db.prepare(
            'INSERT INTO _torque_migrations (id, bundle, name, applied_at) VALUES (?, ?, ?, ?)'
          ).run(crypto.randomUUID(), name, fullKey, new Date().toISOString());
          total++;
        } catch (err) {
          console.error(`  FAILED: ${err.message}`);
          return 1;
        }
      }
    }

    if (total === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`Applied ${total} migration(s).`);
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    return 1;
  }
  return 0;
}

async function migrateStatus() {
  const appDir = resolve(process.cwd());
  const bundlesDir = join(appDir, 'bundles');

  if (!existsSync(bundlesDir)) {
    console.error('No bundles/ directory found.');
    return 1;
  }

  const bundleDirs = readdirSync(bundlesDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const bd of bundleDirs) {
    const migrationsDir = join(bundlesDir, bd.name, 'migrations');
    if (!existsSync(migrationsDir)) {
      console.log(`  ${bd.name}: no migrations`);
      continue;
    }

    const migrations = readdirSync(migrationsDir)
      .filter(f => f.match(/^\d{3}_.*\.js$/))
      .sort();

    const snapshotPath = join(migrationsDir, '.schema-snapshot.json');
    const hasSnapshot = existsSync(snapshotPath);

    console.log(`  ${bd.name}: ${migrations.length} migration(s)${hasSnapshot ? '' : ' (no snapshot — run generate)'}`);
    for (const m of migrations) {
      console.log(`    ${m}`);
    }
  }
  return 0;
}

async function migrateRollback() {
  try {
    const { boot } = await importFromProject('@torquedev/core/boot');
    const { dataLayer } = await boot({
      db: process.env.DB_PATH || 'data/dev.sqlite3',
      serve: false,
      silent: true,
    });

    // Ensure migration tracking table exists
    dataLayer.db.exec(`
      CREATE TABLE IF NOT EXISTS _torque_migrations (
        id TEXT PRIMARY KEY,
        bundle TEXT NOT NULL,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const last = getLastMigration(dataLayer.db);
    if (!last) {
      console.log('Nothing to rollback — no migrations have been applied.');
      return 0;
    }

    // name format: "bundle/NNN_description.js"
    const slashIdx = last.name.indexOf('/');
    if (slashIdx === -1) {
      console.error(`Invalid migration name format: ${last.name}`);
      return 1;
    }
    const bundleName = last.name.slice(0, slashIdx);
    const fileName = last.name.slice(slashIdx + 1);

    const appDir = resolve(process.cwd());
    const migrationPath = join(appDir, 'bundles', bundleName, 'migrations', fileName);

    if (!existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      return 1;
    }

    const mod = await import(migrationPath);
    if (typeof mod.down !== 'function') {
      console.error(`Migration ${last.name} does not export a down() function.`);
      return 1;
    }

    console.log(`  Rolling back ${last.name}...`);

    const rollback = dataLayer.db.transaction(() => {
      mod.down(dataLayer.db);
      removeMigrationRecord(dataLayer.db, last.name);
    });
    rollback();

    console.log('Rollback complete.');
  } catch (err) {
    console.error('Rollback error:', err.message);
    return 1;
  }
  return 0;
}

async function migratePreview() {
  const appDir = resolve(process.cwd());
  const bundlesDir = join(appDir, 'bundles');

  if (!existsSync(bundlesDir)) {
    console.error('No bundles/ directory found.');
    return 1;
  }

  const bundleDirs = readdirSync(bundlesDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  console.log('Pending migrations (preview — not applied):');
  let total = 0;

  for (const bd of bundleDirs) {
    const migrationsDir = join(bundlesDir, bd.name, 'migrations');
    if (!existsSync(migrationsDir)) continue;

    const migrations = readdirSync(migrationsDir)
      .filter(f => f.match(/^\d{3}_.*\.js$/))
      .sort();

    for (const file of migrations) {
      console.log(`  ${bd.name}/${file}`);
      total++;
    }
  }

  if (total === 0) {
    console.log('  (none)');
  }
  return 0;
}

/**
 * Returns the most recently applied migration row, or null if none.
 * @param {import('better-sqlite3').Database} db
 */
export function getLastMigration(db) {
  const row = db.prepare(
    'SELECT * FROM _torque_migrations ORDER BY applied_at DESC, rowid DESC LIMIT 1'
  ).get();
  return row ?? null;
}

/**
 * Deletes a migration tracking record by name.
 * @param {import('better-sqlite3').Database} db
 * @param {string} name  e.g. "bundle/001_create_users.js"
 */
export function removeMigrationRecord(db, name) {
  db.prepare('DELETE FROM _torque_migrations WHERE name = ?').run(name);
}

// ── Schema diffing ─────────────────────────────────────────

function diffSchema(current, previous) {
  const changes = [];

  // New tables
  for (const [tableName, tableDef] of Object.entries(current)) {
    if (!previous[tableName]) {
      changes.push({
        type: 'create_table',
        table: tableName,
        columns: tableDef.columns || {},
        description: `Create table ${tableName}`,
      });
      continue;
    }

    // Column diffs
    const currentCols = tableDef.columns || {};
    const prevCols = previous[tableName]?.columns || {};

    for (const [colName, colDef] of Object.entries(currentCols)) {
      if (!prevCols[colName]) {
        changes.push({
          type: 'add_column',
          table: tableName,
          column: colName,
          spec: colDef,
          description: `Add column ${tableName}.${colName}`,
        });
      }
    }

    // Removed columns (informational — SQLite can't DROP COLUMN easily)
    for (const colName of Object.keys(prevCols)) {
      if (!currentCols[colName]) {
        changes.push({
          type: 'remove_column',
          table: tableName,
          column: colName,
          description: `Remove column ${tableName}.${colName} (manual step required)`,
        });
      }
    }
  }

  // Dropped tables
  for (const tableName of Object.keys(previous)) {
    if (!current[tableName]) {
      changes.push({
        type: 'drop_table',
        table: tableName,
        description: `Drop table ${tableName} (manual step required)`,
      });
    }
  }

  return changes;
}

function generateMigrationCode(bundleName, changes) {
  const prefix = `${bundleName}_`;
  let upLines = [];
  let downLines = [];

  for (const change of changes) {
    const fullTable = `${prefix}${change.table}`;

    if (change.type === 'create_table') {
      const cols = Object.entries(change.columns).map(([name, spec]) => {
        const s = typeof spec === 'string' ? { type: spec } : spec;
        const sqlType = { uuid: 'TEXT', string: 'TEXT', integer: 'INTEGER', boolean: 'INTEGER', float: 'REAL', timestamp: 'TEXT', text: 'TEXT' }[s.type] || 'TEXT';
        let def = `"${name}" ${sqlType}`;
        if (s.primary) def += ' PRIMARY KEY';
        if (s.null === false) def += ' NOT NULL';
        if (s.unique) def += ' UNIQUE';
        if (s.default !== undefined) def += ` DEFAULT '${s.default}'`;
        return def;
      });
      upLines.push(`  db.exec('CREATE TABLE IF NOT EXISTS "${fullTable}" (${cols.join(', ')})');`);
      downLines.push(`  db.exec('DROP TABLE IF EXISTS "${fullTable}"');`);
    } else if (change.type === 'add_column') {
      const s = typeof change.spec === 'string' ? { type: change.spec } : change.spec;
      const sqlType = { uuid: 'TEXT', string: 'TEXT', integer: 'INTEGER', boolean: 'INTEGER', float: 'REAL', timestamp: 'TEXT', text: 'TEXT' }[s.type] || 'TEXT';
      let colDef = `"${change.column}" ${sqlType}`;
      if (s.default !== undefined) colDef += ` DEFAULT '${s.default}'`;
      upLines.push(`  db.exec('ALTER TABLE "${fullTable}" ADD COLUMN ${colDef}');`);
      downLines.push(`  // Cannot DROP COLUMN in SQLite — manual step`);
    } else if (change.type === 'remove_column') {
      upLines.push(`  // TODO: Remove column "${fullTable}"."${change.column}" — requires table rebuild in SQLite`);
      downLines.push(`  // Re-add column if needed`);
    } else if (change.type === 'drop_table') {
      upLines.push(`  // TODO: Drop table "${fullTable}" — verify data migration first`);
      downLines.push(`  // Recreate table if needed`);
    }
  }

  return `/**
 * Migration for ${bundleName}
 * Generated: ${new Date().toISOString()}
 *
 * Changes:
${changes.map(c => ` *   - ${c.description}`).join('\n')}
 */

export function up(db) {
${upLines.join('\n')}
}

export function down(db) {
${downLines.join('\n')}
}
`;
}
