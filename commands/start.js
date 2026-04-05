import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { validatePlan } from '../lib/plans.js';
import checkPort, { findFreePort, isPortFree } from '../lib/port.js';

export default async function start() {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      plan: { type: 'string', default: 'development' },
      port: { type: 'string', default: '9292' },
    },
  });

  const plan = values.plan;
  const planBase = plan.replace(/\.yml$/, '');
  const port = values.port;

  // Step 1: Resolve app directory (current working directory)
  const appDir = resolve(process.cwd());

  // Verify this looks like a Torque app (boot.js OR bundles/ directory)
  if (!existsSync(join(appDir, 'boot.js')) && !existsSync(join(appDir, 'bundles'))) {
    console.error('No boot.js or bundles/ directory found in current directory.');
    console.error('Run this command from your Torque app root, or create a new app with: torque new <name>');
    return 1;
  }

  // Step 2: Install deps if node_modules is missing
  if (!existsSync(join(appDir, 'node_modules'))) {
    console.log('[start] Installing dependencies...');
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['install'], { cwd: appDir, stdio: 'inherit' });
      child.on('close', (code) => resolve(code));
      child.on('error', reject);
    });
  }

  // Step 3: Create data/ directory if missing
  const dataDir = join(appDir, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Step 4: Validate mount plan (skip if using auto-discovery via bundles/)
  const hasBundlesDir = existsSync(join(appDir, 'bundles')) || existsSync(join(appDir, '.bundles'));
  const result = validatePlan(appDir, plan);
  if (result.error && !hasBundlesDir) {
    console.error(result.error);
    if (result.available.length > 0) {
      console.error('Available plans:', result.available.join(', '));
    } else {
      console.error('No mount plans found in config/mount_plans/. Add bundles to bundles/ for auto-discovery.');
    }
    return 1;
  }

  // Step 5: Check port availability — fail if taken instead of silently rebinding
  let effectivePort;
  if (await isPortFree(port)) {
    effectivePort = port;
  } else {
    console.error();
    console.error(`  ✗ Port ${port} is already in use by another process.`);
    console.error();
    console.error(`    To find what's using it:  lsof -i :${port}`);
    console.error(`    To kill it:               kill $(lsof -ti :${port})`);
    console.error(`    To use a different port:   PORT=${parseInt(port) + 1} torque start`);
    console.error();
    return 1;
  }

  // Step 6: Spawn node boot.js with env vars
  const env = { ...process.env, PORT: effectivePort };
  if (result.planPath) env.MOUNT_PLAN = result.planPath;

  // Use boot.js if it exists, otherwise let the kernel auto-discover
  const bootFile = existsSync(join(appDir, 'boot.js')) ? 'boot.js' : null;
  if (!bootFile) {
    // No boot.js — can't start. Need boot.js for now (auto-discovery is in the dev kernel only).
    console.error('  No boot.js found. For template apps, boot.js is generated automatically.');
    console.error('  Create a boot.js or use: node boot.js');
    return 1;
  }

  return new Promise((resolve, reject) => {
    const child = spawn('node', [bootFile], {
      cwd: appDir,
      stdio: 'inherit',
      env,
    });
    child.on('close', (code) => resolve(code));
    child.on('error', reject);
  });
}
