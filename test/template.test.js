import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTemplates, getTemplate } from '../lib/templates.js';
import { generateDockerfile, generateDeployYml, generateEnvExample } from '../lib/builders/app.js';

const ROOT = new URL('..', import.meta.url).pathname;

const EXPECTED_BUNDLES = ['iam', 'kanban-app', 'activity-app', 'search-app'];
const STANDARD_BUNDLES = ['pipeline', 'pulse', 'tasks'];
const API_ONLY_BUNDLES = ['pipeline', 'tasks'];

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

// ── minimal template ───────────────────────────────────────────────────────────

test('listTemplates() includes the minimal template', () => {
  const templates = listTemplates();
  const minimal = templates.find(t => t.name === 'minimal');
  assert.ok(minimal, 'should find the minimal template');
  assert.ok(minimal.description, 'minimal template should have a description');
});

test('getTemplate("minimal") returns correct metadata', () => {
  const tmpl = getTemplate('minimal');
  assert.ok(tmpl, 'should return the minimal template');
  assert.equal(tmpl.name, 'minimal');
  assert.equal(tmpl.identity, true, 'identity should be true');
  assert.equal(tmpl.shell, 'none', 'shell should be none');
  assert.equal(tmpl.auth, true, 'auth should be true');
  assert.deepEqual(tmpl.bundles, {}, 'bundles should be empty object');
});

test('minimal template has seeds/index.js', () => {
  const tmpl = getTemplate('minimal');
  assert.ok(
    existsSync(join(tmpl.dir, 'seeds', 'index.js')),
    'seeds/index.js should exist'
  );
});

test('minimal template has config/app.js', () => {
  const tmpl = getTemplate('minimal');
  assert.ok(
    existsSync(join(tmpl.dir, 'config', 'app.js')),
    'config/app.js should exist'
  );
});

// ── standard template ────────────────────────────────────────────────────────

test('getTemplate("standard") returns correct metadata', () => {
  const tmpl = getTemplate('standard');
  assert.ok(tmpl, 'should return the standard template');
  assert.equal(tmpl.name, 'standard');
  assert.equal(tmpl.identity, true, 'identity should be true');
  assert.equal(tmpl.shell, 'none', 'shell should be none');
  const bundleNames = Object.keys(tmpl.bundles).sort();
  assert.deepEqual(bundleNames, [...STANDARD_BUNDLES].sort());
});

test('standard template bundles all point to git sources', () => {
  const tmpl = getTemplate('standard');
  for (const [name, source] of Object.entries(tmpl.bundles)) {
    assert.ok(
      source.startsWith('git+https://'),
      `bundle "${name}" should use a git+ source, got: ${source}`
    );
  }
});

test('standard template has seeds/index.js', () => {
  const tmpl = getTemplate('standard');
  assert.ok(
    existsSync(join(tmpl.dir, 'seeds', 'index.js')),
    'seeds/index.js should exist'
  );
});

test('standard template has per-bundle seeds', () => {
  const tmpl = getTemplate('standard');
  assert.ok(
    existsSync(join(tmpl.dir, 'bundles', 'pipeline', 'seeds.js')),
    'bundles/pipeline/seeds.js should exist'
  );
  assert.ok(
    existsSync(join(tmpl.dir, 'bundles', 'tasks', 'seeds.js')),
    'bundles/tasks/seeds.js should exist'
  );
});

// ── api-only template ────────────────────────────────────────────────────────

test('getTemplate("api-only") returns correct metadata', () => {
  const tmpl = getTemplate('api-only');
  assert.ok(tmpl, 'should return the api-only template');
  assert.equal(tmpl.name, 'api-only');
  assert.equal(tmpl.identity, true, 'identity should be true');
  assert.equal(tmpl.shell, 'none', 'shell should be none');
  const bundleNames = Object.keys(tmpl.bundles).sort();
  assert.deepEqual(bundleNames, [...API_ONLY_BUNDLES].sort());
});

test('api-only template bundles all point to git sources', () => {
  const tmpl = getTemplate('api-only');
  for (const [name, source] of Object.entries(tmpl.bundles)) {
    assert.ok(
      source.startsWith('git+https://'),
      `bundle "${name}" should use a git+ source, got: ${source}`
    );
  }
});

test('api-only template has seeds/index.js', () => {
  const tmpl = getTemplate('api-only');
  assert.ok(
    existsSync(join(tmpl.dir, 'seeds', 'index.js')),
    'seeds/index.js should exist'
  );
});

// ── Deployment file generators ────────────────────────────────────────────────

test('generateDockerfile() produces valid Dockerfile', () => {
  const dockerfile = generateDockerfile();
  assert.ok(dockerfile.includes('FROM node:'), 'should include FROM node:');
  assert.ok(dockerfile.includes('WORKDIR /app'), 'should include WORKDIR /app');
  assert.ok(dockerfile.includes('VOLUME /app/data'), 'should include VOLUME /app/data');
  assert.ok(dockerfile.includes('EXPOSE 9292'), 'should include EXPOSE 9292');
  assert.ok(dockerfile.includes('CMD'), 'should include CMD');
  assert.ok(dockerfile.includes('torque-data:/app/data'), 'should include torque-data:/app/data mount reference');
});

test('generateDeployYml() produces valid deploy config', () => {
  const deployYml = generateDeployYml();
  assert.ok(deployYml.includes('server:'), 'should include server:');
  assert.ok(deployYml.includes('user: deploy'), 'should include user: deploy');
  assert.ok(deployYml.includes('port: 9292'), 'should include port: 9292');
  assert.ok(deployYml.includes('# registry:'), 'should include commented-out # registry:');
});

test('generateEnvExample() produces .env template', () => {
  const envExample = generateEnvExample();
  assert.ok(envExample.includes('AUTH_SECRET='), 'should include AUTH_SECRET=');
  assert.ok(envExample.includes('NODE_ENV='), 'should include NODE_ENV=');
  assert.ok(envExample.includes('PORT='), 'should include PORT=');
});
