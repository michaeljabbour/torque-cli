/**
 * Task 4: CLI generators — contract validation and IDD
 * Tests for 8 spec requirements across app.js, manifest.js, logic.js, generate.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

import { generateBootJs, generatePackageJson } from '../lib/builders/app.js';
import { buildManifestYaml } from '../lib/builders/manifest.js';
import { buildLogicJs } from '../lib/builders/logic.js';

const ROOT = new URL('..', import.meta.url).pathname;
const GENERATE_SRC = readFileSync(join(ROOT, 'commands', 'generate.js'), 'utf8');

// ── app.js change (a): @torquedev/schema dependency ─────────────────────────────

test('generatePackageJson includes @torquedev/schema dependency', () => {
  const result = generatePackageJson('my-app', { shell: 'none' });
  const pkg = JSON.parse(result);
  assert.ok(
    pkg.dependencies['@torquedev/schema'] !== undefined,
    'should have @torquedev/schema dependency'
  );
  assert.equal(
    pkg.dependencies['@torquedev/schema'],
    'github:michaeljabbour/torque-schema',
    '@torquedev/schema should point to github:michaeljabbour/torque-schema'
  );
});

test('generatePackageJson @torquedev/schema comes before jsonwebtoken in dep order', () => {
  const result = generatePackageJson('my-app', { shell: 'none' });
  const pkg = JSON.parse(result);
  const keys = Object.keys(pkg.dependencies);
  const jwtIdx = keys.indexOf('jsonwebtoken');
  const schemaIdx = keys.indexOf('@torquedev/schema');
  assert.ok(jwtIdx !== -1, 'jsonwebtoken should be present');
  assert.ok(schemaIdx !== -1, '@torquedev/schema should be present');
  assert.ok(schemaIdx < jwtIdx, '@torquedev/schema should come before jsonwebtoken');
});

// ── app.js change (b): typeValidator in all 3 boot variants ──────────────────

test('generateBootJs react shell includes createTypeValidator import', () => {
  const result = generateBootJs({ shell: 'react' });
  assert.ok(
    result.includes('createTypeValidator'),
    'react shell boot.js should import createTypeValidator'
  );
  assert.ok(
    result.includes('@torquedev/schema'),
    'react shell boot.js should import from @torquedev/schema'
  );
});

test('generateBootJs react shell includes typeValidator boot option', () => {
  const result = generateBootJs({ shell: 'react' });
  assert.ok(
    result.includes('typeValidator:'),
    'react shell boot.js should include typeValidator: option'
  );
});

test('generateBootJs auth-only variant includes createTypeValidator import', () => {
  const result = generateBootJs({ shell: 'none', auth: true });
  assert.ok(
    result.includes('createTypeValidator'),
    'auth-only boot.js should import createTypeValidator'
  );
  assert.ok(
    result.includes('typeValidator:'),
    'auth-only boot.js should include typeValidator: option'
  );
});

test('generateBootJs minimal variant includes createTypeValidator import', () => {
  const result = generateBootJs({ shell: 'none', auth: false });
  assert.ok(
    result.includes('createTypeValidator'),
    'minimal boot.js should import createTypeValidator'
  );
  assert.ok(
    result.includes('typeValidator:'),
    'minimal boot.js should include typeValidator: option'
  );
});

// ── manifest.js change (a): intents: [] ──────────────────────────────────────

test('buildManifestYaml includes intents: [] in output', () => {
  const result = buildManifestYaml('todos', [{ name: 'title', type: 'string' }]);
  const parsed = yaml.load(result);
  assert.ok(
    Object.prototype.hasOwnProperty.call(parsed, 'intents'),
    'manifest should have intents field'
  );
  assert.deepEqual(parsed.intents, [], 'intents should be an empty array');
});

test('buildManifestYaml intents: [] appears after optional_deps', () => {
  const result = buildManifestYaml('todos', [{ name: 'title', type: 'string' }]);
  const optDepsIdx = result.indexOf('optional_deps');
  const intentsIdx = result.indexOf('intents:');
  assert.ok(optDepsIdx !== -1, 'optional_deps should be present');
  assert.ok(intentsIdx !== -1, 'intents: should be present');
  assert.ok(intentsIdx > optDepsIdx, 'intents should appear after optional_deps');
});

// ── manifest.js change (b): mutation contracts ───────────────────────────────

test('buildManifestYaml includes createItem contract', () => {
  const result = buildManifestYaml('todos', [{ name: 'title', type: 'string' }]);
  const parsed = yaml.load(result);
  const contracts = parsed.interfaces?.contracts;
  assert.ok(contracts, 'interfaces.contracts should exist');
  assert.ok(contracts.createItem, 'createItem contract should exist');
});

test('buildManifestYaml createItem contract has correct structure', () => {
  const fields = [{ name: 'title', type: 'string' }, { name: 'done', type: 'boolean' }];
  const result = buildManifestYaml('todos', fields);
  const parsed = yaml.load(result);
  const createItem = parsed.interfaces.contracts.createItem;
  assert.ok(createItem.input, 'createItem should have input');
  assert.ok(createItem.output, 'createItem should have output');
  // Input should be built from fields
  assert.ok(createItem.input.title, 'createItem input should have title field');
  assert.equal(createItem.input.title.type, 'string', 'title input type should be string');
  assert.equal(createItem.input.title.required, true, 'title should be required');
  // Output should be object with shape
  assert.equal(createItem.output.type, 'object', 'output type should be object');
  assert.ok(createItem.output.shape, 'output should have shape');
});

test('buildManifestYaml includes updateItem contract with itemId uuid required', () => {
  const result = buildManifestYaml('todos', [{ name: 'title', type: 'string' }]);
  const parsed = yaml.load(result);
  const updateItem = parsed.interfaces.contracts.updateItem;
  assert.ok(updateItem, 'updateItem contract should exist');
  assert.ok(updateItem.input?.itemId, 'updateItem input should have itemId');
  assert.equal(updateItem.input.itemId.type, 'uuid', 'itemId type should be uuid');
  assert.equal(updateItem.input.itemId.required, true, 'itemId should be required');
  assert.equal(updateItem.output.type, 'object', 'output type should be object');
  assert.ok(updateItem.output.shape, 'output should have shape');
});

test('buildManifestYaml includes deleteItem contract with itemId uuid required', () => {
  const result = buildManifestYaml('todos', [{ name: 'title', type: 'string' }]);
  const parsed = yaml.load(result);
  const deleteItem = parsed.interfaces.contracts.deleteItem;
  assert.ok(deleteItem, 'deleteItem contract should exist');
  assert.ok(deleteItem.input?.itemId, 'deleteItem input should have itemId');
  assert.equal(deleteItem.input.itemId.type, 'uuid', 'itemId type should be uuid');
  assert.equal(deleteItem.input.itemId.required, true, 'itemId should be required');
  assert.equal(deleteItem.output.type, 'object', 'output type should be object');
  // deleteItem output shape should have deleted: boolean
  assert.equal(deleteItem.output.shape?.deleted, 'boolean', 'deleteItem output shape should have deleted: boolean');
});

// ── logic.js change (a): intents() stub ──────────────────────────────────────

test('buildLogicJs includes intents() stub method', () => {
  const result = buildLogicJs('todos', 'Todos', [{ name: 'title', type: 'string' }]);
  assert.ok(
    result.includes('intents()'),
    'logic.js should include intents() method'
  );
  assert.ok(
    result.includes("return {};"),
    'intents() should return empty object'
  );
});

test('buildLogicJs intents() appears after interfaces() and before routes()', () => {
  const result = buildLogicJs('todos', 'Todos', [{ name: 'title', type: 'string' }]);
  const interfacesIdx = result.indexOf('interfaces()');
  const intentsIdx = result.indexOf('intents()');
  const routesIdx = result.indexOf('routes()');
  assert.ok(interfacesIdx !== -1, 'interfaces() should be present');
  assert.ok(intentsIdx !== -1, 'intents() should be present');
  assert.ok(routesIdx !== -1, 'routes() should be present');
  assert.ok(intentsIdx > interfacesIdx, 'intents() should come after interfaces()');
  assert.ok(intentsIdx < routesIdx, 'intents() should come before routes()');
});

// ── logic.js change (b): created_by field ────────────────────────────────────

test('buildLogicJs create route includes created_by: ctx.currentUser?.id', () => {
  const result = buildLogicJs('todos', 'Todos', [{ name: 'title', type: 'string' }]);
  assert.ok(
    result.includes('created_by: ctx.currentUser?.id'),
    'create route should include created_by: ctx.currentUser?.id'
  );
});

test('buildLogicJs created_by appears in the insert call', () => {
  const result = buildLogicJs('todos', 'Todos', [{ name: 'title', type: 'string' }]);
  // Find the insert call and verify created_by is within it
  const insertIdx = result.indexOf("this.data.insert('items'");
  const createdByIdx = result.indexOf('created_by: ctx.currentUser?.id');
  assert.ok(insertIdx !== -1, 'insert call should be present');
  assert.ok(createdByIdx !== -1, 'created_by should be present');
  assert.ok(createdByIdx > insertIdx, 'created_by should appear after the insert call start');
});

test('buildLogicJs created_by included for belongsTo case', () => {
  const result = buildLogicJs('todos', 'Todos', [{ name: 'title', type: 'string' }], { belongsTo: 'user' });
  assert.ok(
    result.includes('created_by: ctx.currentUser?.id'),
    'create route with belongsTo should include created_by'
  );
});

// ── generate.js change (a): dynamic tool name in behavior.js ─────────────────

test('generate.js uses dynamic bundleName.query for allowedTools in behavior.js template', () => {
  // Should NOT use hardcoded 'system_query'
  assert.doesNotMatch(
    GENERATE_SRC,
    /allowedTools:\s*\['system_query'\]/,
    "generate.js should not use hardcoded 'system_query' in behavior.js template"
  );
  // Should use dynamic bundleName reference
  assert.match(
    GENERATE_SRC,
    /allowedTools.*bundleName.*\.query/,
    "generate.js should use dynamic '${bundleName}.query' for allowedTools"
  );
});

// ── generate.js change (b): manifest patching on intent generation ────────────

test('generate.js patches manifest.yml after creating intent', () => {
  assert.match(
    GENERATE_SRC,
    /manifest\.yml/,
    'generate.js should reference manifest.yml for patching'
  );
  assert.match(
    GENERATE_SRC,
    /intents/,
    'generate.js should reference intents array when patching manifest'
  );
});

test('generate.js uses yaml.load and yaml.dump with correct options when patching manifest', () => {
  assert.match(
    GENERATE_SRC,
    /yaml\.load/,
    'generate.js should use yaml.load to parse manifest'
  );
  assert.match(
    GENERATE_SRC,
    /yaml\.dump/,
    'generate.js should use yaml.dump to write manifest'
  );
  assert.match(
    GENERATE_SRC,
    /lineWidth:\s*-1/,
    "generate.js yaml.dump should use lineWidth: -1"
  );
  assert.match(
    GENERATE_SRC,
    /noRefs:\s*true/,
    "generate.js yaml.dump should use noRefs: true"
  );
});

test('generate.js wraps manifest patching in try/catch with warning', () => {
  // The manifest patching should be wrapped in try/catch with a warning
  assert.match(
    GENERATE_SRC,
    /Warning.*could not.*patch/i,
    'generate.js should warn if manifest patching fails'
  );
});

// ── generate.js change (c): generateBundle inline template includes intents: [] ──

test('generate.js generateBundle inline manifest template includes intents: []', () => {
  // The generateBundle() function writes an inline manifest template (not buildManifestYaml).
  // It must include intents: [] so new empty bundles are consistent with scaffold output.
  // Verify the inline template has intents: [] appearing after optional_deps: []
  assert.match(
    GENERATE_SRC,
    /optional_deps:\s*\[\]\n(?:.*\n)*?intents:\s*\[\]/,
    'generateBundle inline template should have intents: [] after optional_deps: []'
  );
});
