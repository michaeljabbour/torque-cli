import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import repl from 'node:repl';
import { importFromProject } from '../lib/resolve.js';

export default async function console_cmd() {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: { plan: { type: 'string', default: 'development' } },
  });

  const appDir = process.cwd();
  if (!existsSync('boot.js')) {
    console.error('Not a Torque app directory (no boot.js found)');
    return 1;
  }

  const planBase = values.plan.replace(/\.yml$/, '');
  const planPath = `config/mount_plans/${planBase}.yml`;
  if (!existsSync(planPath)) {
    console.error(`Mount plan not found: ${planPath}`);
    return 1;
  }

  // Create data dir if needed
  mkdirSync('data', { recursive: true });

  // Boot kernel without HTTP server
  const { boot } = await importFromProject('@torquedev/core/boot');
  const result = await boot({
    plan: planPath,
    db: process.env.DB_PATH || 'data/dev.sqlite3',
    serve: false,
  });

  const { registry, dataLayer, eventBus, hookBus } = result;

  console.log('\nTorque Console');
  console.log('Available:');
  console.log('  registry    — Bundle registry');
  console.log('  dataLayer   — Data layer');
  console.log('  eventBus    — Event bus');
  for (const name of registry.activeBundles()) {
    console.log(`  ${name.padEnd(12)} — ${name} bundle instance`);
  }
  console.log('\nType .exit to quit\n');

  // Start REPL
  const r = repl.start({ prompt: 'torque> ', useGlobal: false });
  r.context.registry = registry;
  r.context.dataLayer = dataLayer;
  r.context.eventBus = eventBus;
  r.context.hookBus = hookBus;
  for (const name of registry.activeBundles()) {
    r.context[name] = registry.bundleInstance(name);
  }

  // Cleanup on exit
  r.on('exit', () => {
    try { dataLayer.db.close(); } catch {}
    process.exit(0);
  });

  // Keep the process alive
  return new Promise(() => {});
}
