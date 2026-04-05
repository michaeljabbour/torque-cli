import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { validatePlan } from '../lib/plans.js';

function makeWorkspace(planNames = []) {
  const root = mkdtempSync(join(tmpdir(), 'tq-plans-test-'));
  const plansDir = join(root, 'torque-app', 'config', 'mount_plans');
  mkdirSync(plansDir, { recursive: true });

  for (const name of planNames) {
    writeFileSync(join(plansDir, `${name}.yml`), `# ${name} plan\n`);
  }

  function cleanup() {
    rmSync(root, { recursive: true, force: true });
  }

  return { root, plansDir, cleanup };
}

test('returns path for a valid plan', () => {
  const { root, plansDir, cleanup } = makeWorkspace(['demo']);
  try {
    const result = validatePlan(root, 'demo');
    assert.equal(result.error, undefined);
    assert.equal(result.path, join(plansDir, 'demo.yml'));
  } finally {
    cleanup();
  }
});

test('returns error with available plans for invalid plan', () => {
  const { root, cleanup } = makeWorkspace(['demo', 'staging']);
  try {
    const result = validatePlan(root, 'nope');
    assert.match(result.error, /nope/);
    assert.deepEqual(result.available.sort(), ['demo', 'staging']);
  } finally {
    cleanup();
  }
});

test('handles empty mount plans directory', () => {
  const { root, cleanup } = makeWorkspace([]);
  try {
    const result = validatePlan(root, 'demo');
    assert.match(result.error, /demo/);
    assert.deepEqual(result.available, []);
  } finally {
    cleanup();
  }
});

test('works with or without .yml extension', () => {
  const { root, plansDir, cleanup } = makeWorkspace(['demo']);
  try {
    assert.equal(validatePlan(root, 'demo.yml').path, join(plansDir, 'demo.yml'));
    assert.equal(validatePlan(root, 'demo').path, join(plansDir, 'demo.yml'));
  } finally {
    cleanup();
  }
});

test('returns error with empty available list when plansDir does not exist', () => {
  // Simulates a fresh clone before first run — plansDir is never created
  const root = mkdtempSync(join(tmpdir(), 'tq-plans-test-'));
  // Deliberately do NOT create torque-app/config/mount_plans/
  try {
    const result = validatePlan(root, 'demo');
    assert.match(result.error, /demo/, 'error should name the missing plan');
    assert.deepEqual(result.available, [], 'available should be empty when dir is absent');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
