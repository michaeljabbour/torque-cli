import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { findWorkspace } from '../lib/workspace.js';

test('finds workspace from root', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tq-test-'));
  try {
    mkdirSync(join(tmp, 'torque-app'));
    mkdirSync(join(tmp, 'torque-core'));
    assert.equal(findWorkspace(tmp), tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('finds workspace from a subdirectory', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tq-test-'));
  try {
    mkdirSync(join(tmp, 'torque-app'));
    mkdirSync(join(tmp, 'torque-core'));
    assert.equal(findWorkspace(join(tmp, 'torque-app')), tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('finds workspace from a nested subdirectory', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tq-test-'));
  try {
    mkdirSync(join(tmp, 'torque-app', 'src', 'deep'), { recursive: true });
    mkdirSync(join(tmp, 'torque-core'));
    assert.equal(findWorkspace(join(tmp, 'torque-app', 'src', 'deep')), tmp);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('throws when no workspace is found', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tq-test-'));
  try {
    assert.throws(
      () => findWorkspace(tmp),
      /Could not find Torque workspace/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('validates that required siblings exist', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tq-test-'));
  try {
    mkdirSync(join(tmp, 'torque-app'));
    // torque-core is intentionally missing
    assert.throws(
      () => findWorkspace(tmp),
      /not found in workspace/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('reports which siblings are missing', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'tq-test-'));
  try {
    mkdirSync(join(tmp, 'torque-app'));
    // torque-core is intentionally missing
    assert.throws(
      () => findWorkspace(tmp),
      /torque-core/
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
