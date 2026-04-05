import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { validatePlan } from '../lib/plans.js';
import checkPort from '../lib/port.js';

export default async function dev() {
  // Step 1: Check Node version >= 18.11 (required for --watch)
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 18 || (major === 18 && minor < 11)) {
    console.error(
      `Node.js >= 18.11 is required for watch mode (--watch). Current version: ${process.versions.node}`
    );
    return 1;
  }

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

  // Step 2: Resolve app directory (current working directory)
  const appDir = resolve(process.cwd());

  // Verify this looks like a Torque app (boot.js OR bundles/ directory)
  if (!existsSync(join(appDir, 'boot.js')) && !existsSync(join(appDir, 'bundles'))) {
    console.error('No boot.js or bundles/ directory found in current directory.');
    console.error('Run this command from your Torque app root, or create a new app with: torque new <name>');
    return 1;
  }

  // Step 3: Install deps if node_modules is missing
  if (!existsSync(join(appDir, 'node_modules'))) {
    console.log('[dev] Installing dependencies...');
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['install'], { cwd: appDir, stdio: 'inherit' });
      child.on('close', (code) => resolve(code));
      child.on('error', reject);
    });
  }

  // Step 4: Create data/ directory if missing
  const dataDir = join(appDir, 'data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Step 5: Validate mount plan (skip if using auto-discovery via bundles/)
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

  // Step 6: Check port availability
  try {
    await checkPort(port);
  } catch (err) {
    console.error(err.message);
    return 1;
  }

  // Step 7: Print watch mode note
  console.log(
    'Watching: boot.js for changes (hot reload). Bundles are hot-reloaded without process restart.'
  );

  // Step 8: Spawn node with --watch-path flags to avoid watching .bundles/
  // Watch boot.js and bundles/ for local changes; also watch ../torque-core
  // if running inside a monorepo workspace for framework development.
  const watchArgs = [
    '--watch-path', 'boot.js',
  ];

  // In monorepo development, also watch framework packages
  if (existsSync(join(appDir, '..', 'torque-core'))) {
    watchArgs.push('--watch-path', '../torque-core');
  }

  watchArgs.push('boot.js');

  return new Promise((resolve, reject) => {
    const child = spawn('node', watchArgs, {
      cwd: appDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(result.planPath ? { MOUNT_PLAN: result.planPath } : {}),
        PORT: port,
        HOT_RELOAD: '1',
      },
    });
    child.on('close', (code) => resolve(code));
    child.on('error', reject);
  });
}
