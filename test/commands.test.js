import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const START_SRC = readFileSync(join(ROOT, 'commands', 'start.js'), 'utf8');
const DEV_SRC = readFileSync(join(ROOT, 'commands', 'dev.js'), 'utf8');
const UPDATE_SRC = readFileSync(join(ROOT, 'commands', 'update.js'), 'utf8');
const CLI_SRC = readFileSync(join(ROOT, 'bin', 'torque.js'), 'utf8');

// ── MOUNT_PLAN double-extension bug ─────────────────────────────────────────
// If user passes --plan demo.yml the raw value must be stripped before being
// interpolated into the MOUNT_PLAN env var, otherwise docker/server receives
// "config/mount_plans/demo.yml.yml" and fails silently.

test('start.js strips .yml extension before constructing MOUNT_PLAN env var', () => {
  assert.match(
    START_SRC,
    /plan\.replace\(\/\\\.yml\$\/,\s*''\)/,
    'MOUNT_PLAN construction must strip .yml extension with plan.replace(/\\.yml$/, \'\')'
  );
});

test('dev.js strips .yml extension before constructing MOUNT_PLAN env var', () => {
  assert.match(
    DEV_SRC,
    /plan\.replace\(\/\\\.yml\$\/,\s*''\)/,
    'MOUNT_PLAN construction must strip .yml extension with plan.replace(/\\.yml$/, \'\')'
  );
});

// ── console.error hygiene ────────────────────────────────────────────────────
// Error output must go to stderr so shell pipelines and log routers work
// correctly. Using console.log for errors mixes error output into stdout.

test('start.js workspace error uses console.error not console.log', () => {
  // The workspace error block should write to stderr
  assert.match(
    START_SRC,
    /console\.error\(/,
    'workspace resolution error must use console.error'
  );
});

test('start.js mount plan error uses console.error not console.log', () => {
  // The validatePlan error block should write to stderr
  assert.match(
    START_SRC,
    /console\.error\(result\.error\)/,
    'mount plan error must use console.error(result.error)'
  );
});

test('dev.js workspace error uses console.error not console.log', () => {
  assert.match(
    DEV_SRC,
    /console\.error\(err\.message\)/,
    'workspace resolution error must use console.error(err.message)'
  );
});

test('dev.js mount plan error uses console.error not console.log', () => {
  assert.match(
    DEV_SRC,
    /console\.error\(result\.error\)/,
    'mount plan error must use console.error(result.error)'
  );
});

test('torque.js unknown command error uses console.error not console.log', () => {
  assert.match(
    CLI_SRC,
    /console\.error\(.*Unknown command/,
    'unknown command error must use console.error'
  );
});

// ── Bug 1: update.js must skip repos with no remote ─────────────────────────
// Running `git pull` on a repo with no remote tracking branch fails with a
// non-zero exit code and aborts the whole update. The fix is to check
// `git remote` first and skip the pull if the output is empty.

test('update.js checks git remote before pulling', () => {
  assert.match(
    UPDATE_SRC,
    /execSync\s*\(\s*['"`]git remote['"`]/,
    "update.js must call execSync('git remote') to check for a configured remote"
  );
});

test('update.js skips pull when git remote returns empty string', () => {
  assert.match(
    UPDATE_SRC,
    /no remote configured,\s*skipping/,
    'update.js must print a "no remote configured, skipping" message when skipping'
  );
});

// ── Bug 2: dev.js must use --watch-path instead of bare --watch ──────────────
// `node --watch` watches every file the process touches, including .bundles/
// which is rewritten on every boot — causing an infinite restart loop.
// The fix restricts watching to only the source directories.

test('dev.js uses --watch-path instead of bare --watch flag', () => {
  assert.doesNotMatch(
    DEV_SRC,
    /\[\s*'--watch'\s*,\s*'boot\.js'\s*\]/,
    "dev.js must not use ['--watch', 'boot.js'] — use --watch-path flags instead"
  );
});

test('dev.js passes --watch-path for boot.js', () => {
  assert.match(
    DEV_SRC,
    /'--watch-path'\s*,\s*'boot\.js'/,
    "dev.js must include '--watch-path', 'boot.js' in the spawn args"
  );
});

test('dev.js restricts watching to source repos, not .bundles/', () => {
  assert.match(
    DEV_SRC,
    /'--watch-path'\s*,\s*'\.\.\/torque-core'/,
    "dev.js must watch '../torque-core' with --watch-path"
  );
});

test('dev.js watch mode note mentions bundle changes require manual restart', () => {
  assert.match(
    DEV_SRC,
    /Bundle.*changes require a manual restart/i,
    'dev.js watch mode note must mention that bundle changes require a manual restart'
  );
});
