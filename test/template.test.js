import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTemplates, getTemplate } from '../lib/templates.js';

const ROOT = new URL('..', import.meta.url).pathname;

const EXPECTED_BUNDLES = ['iam', 'kanban-app', 'activity-app', 'search-app'];

// ── listTemplates ────────────────────────────────────────────────────────

test('listTemplates() finds the kanban template', () => {
  const templates = listTemplates();
  assert.ok(templates.length > 0, 'should find at least one template');
  const kanban = templates.find(t => t.name === 'kanban');
  assert.ok(kanban, 'should find the kanban template');
  assert.ok(kanban.description, 'kanban template should have a description');
});

// ── getTemplate ──────────────────────────────────────────────────────────

test('getTemplate("kanban") returns correct metadata', () => {
  const tmpl = getTemplate('kanban');
  assert.ok(tmpl, 'should return the kanban template');
  assert.equal(tmpl.name, 'kanban');
  assert.ok(tmpl.description.toLowerCase().includes('kanban'), 'description should mention kanban');
  assert.equal(tmpl.identity, true, 'identity should be true');
  assert.equal(typeof tmpl.bundles, 'object', 'bundles should be an object (name→git source)');
  const bundleNames = Object.keys(tmpl.bundles).sort();
  assert.deepEqual(bundleNames, [...EXPECTED_BUNDLES].sort());
  assert.ok(tmpl.dir, 'should include dir path');
});

test('getTemplate("kanban") bundles all point to git sources', () => {
  const tmpl = getTemplate('kanban');
  for (const [name, source] of Object.entries(tmpl.bundles)) {
    assert.ok(
      source.startsWith('git+https://'),
      `bundle "${name}" should use a git+ source, got: ${source}`
    );
  }
});

test('getTemplate("nonexistent") returns null', () => {
  const tmpl = getTemplate('nonexistent');
  assert.equal(tmpl, null);
});

// ── Template directory structure (seeds + config only) ──────────────────

test('kanban template has seeds/index.js', () => {
  const tmpl = getTemplate('kanban');
  assert.ok(
    existsSync(join(tmpl.dir, 'seeds', 'index.js')),
    'seeds/index.js should exist'
  );
});

test('kanban template has config/app.js', () => {
  const tmpl = getTemplate('kanban');
  assert.ok(
    existsSync(join(tmpl.dir, 'config', 'app.js')),
    'config/app.js should exist'
  );
  const config = readFileSync(join(tmpl.dir, 'config', 'app.js'), 'utf8');
  assert.ok(config.includes('light'), 'config should use light theme');
});

test('kanban template has local bundles/ directory', () => {
  const tmpl = getTemplate('kanban');
  assert.ok(
    existsSync(join(tmpl.dir, 'bundles')),
    'bundles/ should exist in template for local bundle overrides'
  );
});
