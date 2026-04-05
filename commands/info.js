import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export default async function info() {
  const name = process.argv[3];

  if (!name) {
    console.error('Usage: torque info <bundle>');
    return 1;
  }

  const appDir = process.cwd();
  const manifestPath = join(appDir, 'bundles', name, 'manifest.yml');

  if (!existsSync(manifestPath)) {
    console.error(`Bundle '${name}' not found at bundles/${name}/manifest.yml`);
    return 1;
  }

  const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
  const bundleDir = join(appDir, 'bundles', name);

  console.log('');
  console.log(`Bundle: ${manifest.name || name}`);
  console.log(`Version: ${manifest.version || '—'}`);
  console.log(`Description: ${manifest.description || '—'}`);

  // Schema tables
  const tables = manifest.schema?.tables;
  if (tables && Object.keys(tables).length > 0) {
    console.log('\nSchema:');
    for (const [tableName, table] of Object.entries(tables)) {
      const cols = table.columns ? Object.keys(table.columns) : [];
      console.log(`  ${tableName} (${cols.length} columns): ${cols.join(', ')}`);
    }
  }

  // Interfaces
  const contracts = manifest.interfaces?.contracts;
  if (contracts && Object.keys(contracts).length > 0) {
    console.log('\nInterfaces:');
    for (const [ifaceName, def] of Object.entries(contracts)) {
      const inputKeys = Object.keys(def.input || {});
      const inputStr = inputKeys.length > 0 ? inputKeys.join(', ') : 'none';
      console.log(`  ${ifaceName}(${inputStr}) — ${def.description || '—'}`);
    }
  }

  // Events
  const publishes = manifest.events?.publishes || [];
  const subscribes = manifest.events?.subscribes || [];
  if (publishes.length > 0 || subscribes.length > 0) {
    console.log('\nEvents:');
    if (publishes.length > 0) {
      console.log('  Publishes:');
      for (const evt of publishes) {
        const schemaStr = evt.schema ? ` (${Object.keys(evt.schema).join(', ')})` : '';
        console.log(`    ${evt.name}${schemaStr}`);
      }
    }
    if (subscribes.length > 0) {
      console.log('  Subscribes:');
      for (const evt of subscribes) {
        const evtName = typeof evt === 'string' ? evt : evt.name;
        console.log(`    ${evtName}`);
      }
    }
  }

  // API routes
  const routes = manifest.api?.routes || [];
  if (routes.length > 0) {
    console.log('\nAPI Routes:');
    for (const route of routes) {
      console.log(`  ${route.method.padEnd(7)} ${route.path} -> ${route.handler}${route.auth ? ' (auth)' : ''}`);
    }
  }

  // Dependencies
  const deps = manifest.depends_on || [];
  const optDeps = manifest.optional_deps || [];
  if (deps.length > 0 || optDeps.length > 0) {
    console.log('\nDependencies:');
    if (deps.length > 0) console.log(`  Required: ${deps.join(', ')}`);
    if (optDeps.length > 0) console.log(`  Optional: ${optDeps.join(', ')}`);
  }

  // UI routes
  const uiRoutes = manifest.ui?.routes || [];
  if (uiRoutes.length > 0) {
    console.log('\nUI Routes:');
    for (const route of uiRoutes) {
      const fetchStr = route.fetchUrls?.length ? ` (fetches: ${route.fetchUrls.join(', ')})` : '';
      console.log(`  ${route.path} → ${route.component}${fetchStr}`);
    }
  }

  // Navigation
  const nav = manifest.ui?.navigation || [];
  if (nav.length > 0) {
    console.log('\nNavigation:');
    for (const item of nav) {
      console.log(`  ${item.icon ? `[${item.icon}] ` : ''}${item.label} → ${item.path}`);
    }
  }

  // Behaviors
  const behaviors = manifest.behaviors || [];
  if (behaviors.length > 0) {
    console.log(`\nBehaviors: ${behaviors.length}`);
  }

  // Stats
  console.log('\nStats:');
  const logicPath = join(bundleDir, 'logic.js');
  if (existsSync(logicPath)) {
    const lines = readFileSync(logicPath, 'utf8').split('\n').length;
    console.log(`  logic.js: ${lines} lines`);
  } else {
    console.log('  logic.js: not found');
  }

  const seedPath = join(bundleDir, 'seeds.js');
  console.log(`  seeds.js: ${existsSync(seedPath) ? 'present' : 'none'}`);

  const testDir = join(bundleDir, 'test');
  if (existsSync(testDir)) {
    try {
      const testFiles = readdirSync(testDir).filter(f => f.endsWith('.test.js'));
      console.log(`  Test files: ${testFiles.length}`);
    } catch {
      console.log('  Test files: 0');
    }
  } else {
    console.log('  Test files: 0');
  }

  const uiDir = join(bundleDir, 'ui');
  if (existsSync(uiDir)) {
    try {
      const uiFiles = readdirSync(uiDir).filter(f => f.endsWith('.js'));
      console.log(`  UI components: ${uiFiles.length}`);
    } catch {
      console.log('  UI components: 0');
    }
  }

  console.log('');
  return 0;
}
