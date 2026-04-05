import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

test('commands/ directory exists', () => {
  assert.ok(existsSync(join(ROOT, 'commands')), 'commands/ directory should exist');
});

test('lib/ directory exists', () => {
  assert.ok(existsSync(join(ROOT, 'lib')), 'lib/ directory should exist');
});

test('test/ directory exists', () => {
  assert.ok(existsSync(join(ROOT, 'test')), 'test/ directory should exist');
});

test('package.json is valid JSON', () => {
  const pkgPath = join(ROOT, 'package.json');
  assert.ok(existsSync(pkgPath), 'package.json should exist');
  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw); // throws if invalid JSON
  assert.ok(pkg, 'package.json should parse as valid JSON');
});

test('package.json has correct name', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@torquedev/cli');
});

test('package.json has correct version', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '0.1.1');
});

test('package.json has type module', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
});

test('package.json bin points torque to ./bin/torque.js', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.bin, 'bin field should exist');
  assert.equal(pkg.bin.torque, './bin/torque.js');
});

test('package.json has correct test script', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts, 'scripts field should exist');
  assert.equal(pkg.scripts.test, "node --test test/*.test.js");
});

test('torque.js exists with shebang line', () => {
  const cliPath = join(ROOT, 'bin', 'torque.js');
  assert.ok(existsSync(cliPath), 'bin/torque.js should exist');
  const content = readFileSync(cliPath, 'utf8');
  assert.ok(content.startsWith('#!/usr/bin/env node'), 'torque.js should start with shebang');
});
