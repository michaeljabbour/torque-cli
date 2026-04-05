import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = readFileSync(join(ROOT, 'commands', 'start.js'), 'utf8');

// Locate the Step 5 block once so both tests share the same slice.
const step5Start = SRC.indexOf('// Step 5');
const step5Src = SRC.slice(step5Start);

test('commands/start.js exists', () => {
  assert.ok(SRC.length > 0, 'start.js should have content');
});

test('Step 5 spawn uses (resolve, reject) not just (resolve)', () => {
  assert.ok(step5Start >= 0, 'Step 5 comment must be present in start.js');
  assert.match(
    step5Src,
    /new Promise\(\(resolve,\s*reject\)/,
    'Step 5 Promise constructor must accept both resolve and reject'
  );
});

test('Step 5 spawn has child.on(error) handler', () => {
  assert.ok(step5Start >= 0, 'Step 5 comment must be present in start.js');
  assert.match(
    step5Src,
    /child\.on\(['"]error['"],\s*reject\)/,
    "Step 5 spawn must have child.on('error', reject) to prevent unhandled hang on OS spawn failure"
  );
});
