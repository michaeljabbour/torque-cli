import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { importFromProject } from '../lib/resolve.js';

export default async function seed() {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      plan: { type: 'string' },
      db: { type: 'string' },
    },
  });

  const appDir = resolve(process.cwd());

  // Boot the kernel without serving (just load bundles + DB)
  const { boot } = await importFromProject('@torquedev/core/boot');
  const planPath = values.plan
    ? (values.plan.endsWith('.yml') ? values.plan : `config/mount_plans/${values.plan}.yml`)
    : undefined; // let auto-discovery handle it

  const { registry } = await boot({
    plan: planPath,
    db: values.db || 'data/app.sqlite3',
    serve: false,
    silent: true,
  });

  console.log();
  console.log('  Seeding bundles...');
  console.log();

  const sorted = registry.activeBundles();
  let seeded = 0;

  for (const name of sorted) {
    const dir = registry.bundleDir(name);
    if (!dir) continue;

    const seedPath = join(dir, 'seeds.js');
    if (!existsSync(seedPath)) continue;

    try {
      const mod = await import(resolve(seedPath));
      const seedFn = mod.default || mod.seed;
      if (typeof seedFn !== 'function') {
        console.warn(`  ⚠ ${name}: seeds.js does not export a function, skipping`);
        continue;
      }

      const instance = registry.bundleInstance(name);
      const routes = instance.routes ? instance.routes() : {};
      const interfaces = instance.interfaces ? instance.interfaces() : {};

      await seedFn({
        registry,
        bundle: instance,
        routes,
        interfaces,
        data: instance.data || registry.dataLayer,
      });

      console.log(`  ✓ ${name}`);
      seeded++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
    }
  }

  // Fallback: if no per-bundle seeds found, try global seeds/index.js
  if (seeded === 0) {
    const globalSeed = join(appDir, 'seeds', 'index.js');
    if (existsSync(globalSeed)) {
      console.log('  No per-bundle seeds found. Running seeds/index.js...');
      console.log();
      try {
        await import(resolve(globalSeed));
        seeded = 1;
      } catch (err) {
        console.error(`  ✗ seeds/index.js: ${err.message}`);
      }
    }
  }

  console.log();
  console.log(`  Seeded ${seeded === 0 ? 'nothing — add seeds.js to your bundles' : `${seeded} source${seeded !== 1 ? 's' : ''}`}.`);
  console.log();

  process.exit(0);
}
