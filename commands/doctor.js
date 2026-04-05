import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export default async function doctor() {
  const appDir = process.cwd();
  let passes = 0, fails = 0, warns = 0;

  function pass(msg) { console.log(`  [pass] ${msg}`); passes++; }
  function fail(msg) { console.log(`  [FAIL] ${msg}`); fails++; }
  function warn(msg) { console.log(`  [warn] ${msg}`); warns++; }

  console.log('\nTorque Doctor\n');

  // 1. Node version
  const [major] = process.versions.node.split('.').map(Number);
  if (major >= 20) pass(`Node.js >= 20 (v${process.versions.node})`);
  else fail(`Node.js >= 20 required (found v${process.versions.node})`);

  // 2. Required packages (check local node_modules and hoisted workspace node_modules)
  for (const pkg of ['@torquedev/core', '@torquedev/datalayer', '@torquedev/eventbus', '@torquedev/server']) {
    const parts = pkg.split('/');
    const localDir = join(appDir, 'node_modules', ...parts);
    // Walk up to find hoisted node_modules (npm workspaces)
    let found = existsSync(localDir);
    if (!found) {
      let dir = appDir;
      while (!found && dir !== '/') {
        dir = join(dir, '..');
        found = existsSync(join(dir, 'node_modules', ...parts));
      }
    }
    if (found) pass(`${pkg} installed`);
    else fail(`${pkg} not installed — run npm install`);
  }

  // 3. Mount plan
  const planDir = join(appDir, 'config', 'mount_plans');
  const defaultPlan = join(planDir, 'development.yml');
  if (existsSync(defaultPlan)) {
    pass('Mount plan exists (config/mount_plans/development.yml)');
    try {
      const yaml = await import('js-yaml');
      const content = readFileSync(defaultPlan, 'utf8');
      const plan = yaml.default.load(content);
      if (plan && plan.bundles !== undefined) pass('Mount plan is valid YAML');
      else fail('Mount plan missing "bundles" key');
    } catch (e) {
      fail(`Mount plan is invalid YAML: ${e.message}`);
    }
  } else {
    fail('Mount plan not found at config/mount_plans/development.yml');
  }

  // 4. Boot file
  if (existsSync(join(appDir, 'boot.js'))) pass('boot.js exists');
  else fail('boot.js not found');

  // 5. Foundation
  if (existsSync(join(appDir, 'foundation', 'context', 'DESIGN_PRINCIPLES.md')))
    pass('Foundation context loaded');
  else warn('Foundation context missing — run torque new to scaffold');

  // 6. Check bundles
  const bundlesDir = join(appDir, 'bundles');
  if (existsSync(bundlesDir)) {
    const bundles = readdirSync(bundlesDir).filter(d => {
      try { return statSync(join(bundlesDir, d)).isDirectory(); } catch { return false; }
    });
    for (const name of bundles) {
      const bDir = join(bundlesDir, name);
      if (existsSync(join(bDir, 'manifest.yml'))) pass(`Bundle '${name}' has manifest.yml`);
      else fail(`Bundle '${name}' missing manifest.yml`);

      if (existsSync(join(bDir, 'logic.js'))) pass(`Bundle '${name}' has logic.js`);
      else fail(`Bundle '${name}' missing logic.js`);

      if (existsSync(join(bDir, 'agent.md'))) pass(`Bundle '${name}' has agent.md`);
      else warn(`Bundle '${name}' missing agent.md`);
    }
  }

  // 7. agents.md
  if (existsSync(join(appDir, 'agents.md'))) pass('agents.md exists');
  else warn('agents.md not found');

  console.log(`\n${passes + fails + warns} checks: ${passes} passed, ${fails} failed, ${warns} warnings\n`);
  return fails > 0 ? 1 : 0;
}
