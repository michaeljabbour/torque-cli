import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateBootJs,
  generatePackageJson,
  generateAppConfig,
  generateMountPlan,
} from '../commands/new.js';

// ---------------------------------------------------------------------------
// generateBootJs
// ---------------------------------------------------------------------------

test('generateBootJs with shell=react includes shell-react import', () => {
  const result = generateBootJs({ shell: 'react' });
  assert.ok(result.includes('@torquedev/shell-react'), 'should import @torquedev/shell-react');
});

test('generateBootJs with shell=react includes createShell call', () => {
  const result = generateBootJs({ shell: 'react' });
  assert.ok(result.includes('createShell'), 'should include createShell');
});

test('generateBootJs with shell=none excludes shell-react import', () => {
  const result = generateBootJs({ shell: 'none' });
  assert.ok(!result.includes('@torquedev/shell-react'), 'should not import @torquedev/shell-react');
});

test('generateBootJs with shell=none excludes createShell call', () => {
  const result = generateBootJs({ shell: 'none' });
  assert.ok(!result.includes('createShell'), 'should not include createShell');
});

test('generateBootJs always includes boot import', () => {
  const resultReact = generateBootJs({ shell: 'react' });
  const resultNone = generateBootJs({ shell: 'none' });
  assert.ok(resultReact.includes('boot'), 'react variant should include boot');
  assert.ok(resultNone.includes('boot'), 'none variant should include boot');
});

// ---------------------------------------------------------------------------
// generatePackageJson
// ---------------------------------------------------------------------------

test('generatePackageJson always includes express ^4.21.0', () => {
  const result = generatePackageJson('my-app', { shell: 'none' });
  const pkg = JSON.parse(result);
  assert.equal(pkg.dependencies.express, '^4.21.0');
});

test('generatePackageJson always includes better-sqlite3 ^11.0.0', () => {
  const result = generatePackageJson('my-app', { shell: 'none' });
  const pkg = JSON.parse(result);
  assert.equal(pkg.dependencies['better-sqlite3'], '^11.0.0');
});

test('generatePackageJson always includes js-yaml ^4.1.0', () => {
  const result = generatePackageJson('my-app', { shell: 'none' });
  const pkg = JSON.parse(result);
  assert.equal(pkg.dependencies['js-yaml'], '^4.1.0');
});

test('generatePackageJson always includes uuid ^10.0.0', () => {
  const result = generatePackageJson('my-app', { shell: 'none' });
  const pkg = JSON.parse(result);
  assert.equal(pkg.dependencies.uuid, '^10.0.0');
});

test('generatePackageJson with shell=react includes @torquedev/shell-react git dep', () => {
  const result = generatePackageJson('my-app', { shell: 'react' });
  const pkg = JSON.parse(result);
  assert.ok(
    pkg.dependencies['@torquedev/shell-react'] !== undefined,
    'should have @torquedev/shell-react dependency'
  );
  const depVal = pkg.dependencies['@torquedev/shell-react'];
  assert.ok(
    depVal.startsWith('git+') ||
      depVal.startsWith('github:') ||
      depVal.includes('torque/shell-react'),
    'shell-react dep should be a git dependency'
  );
});

test('generatePackageJson with shell=none excludes @torquedev/shell-react', () => {
  const result = generatePackageJson('my-app', { shell: 'none' });
  const pkg = JSON.parse(result);
  assert.ok(
    pkg.dependencies['@torquedev/shell-react'] === undefined,
    'should not have @torquedev/shell-react dependency'
  );
});

test('generatePackageJson sets the app name correctly', () => {
  const result = generatePackageJson('my-cool-app', { shell: 'none' });
  const pkg = JSON.parse(result);
  assert.equal(pkg.name, 'my-cool-app');
});

test('generatePackageJson returns valid JSON', () => {
  const result = generatePackageJson('test-app', { shell: 'react' });
  assert.doesNotThrow(() => JSON.parse(result), 'should return valid JSON');
});

// ---------------------------------------------------------------------------
// generateAppConfig
// ---------------------------------------------------------------------------

test('generateAppConfig with shell=none returns empty string', () => {
  const result = generateAppConfig('my-app', { shell: 'none' });
  assert.equal(result, '');
});

test('generateAppConfig with shell=react exports appConfig constant', () => {
  const result = generateAppConfig('my-app', { shell: 'react' });
  assert.ok(result.includes('export const appConfig'), 'should export const appConfig');
});

test('generateAppConfig with shell=react includes export', () => {
  const result = generateAppConfig('my-app', { shell: 'react' });
  assert.ok(result.includes('export'), 'should include export statement');
});

test('generateAppConfig with shell=react includes the app name', () => {
  const result = generateAppConfig('my-app', { shell: 'react' });
  assert.ok(result.includes('my-app'), 'should include the app name');
});

test('generateAppConfig with shell=react includes theme config', () => {
  const result = generateAppConfig('my-app', { shell: 'react' });
  assert.ok(result.includes('theme'), 'should include theme config');
});

test('generateAppConfig with shell=react includes branding config', () => {
  const result = generateAppConfig('my-app', { shell: 'react' });
  assert.ok(result.includes('branding'), 'should include branding config');
});

test('generateAppConfig with shell=react includes auth config', () => {
  const result = generateAppConfig('my-app', { shell: 'react' });
  assert.ok(result.includes('auth'), 'should include auth config');
});

test('generateAppConfig with shell=react includes shell config', () => {
  const result = generateAppConfig('my-app', { shell: 'react' });
  assert.ok(result.includes('shell'), 'should include shell config');
});

// ---------------------------------------------------------------------------
// generateMountPlan
// ---------------------------------------------------------------------------

test('generateMountPlan with bundles=empty returns bundles: {}', () => {
  const result = generateMountPlan('my-app', { bundles: 'empty' });
  assert.ok(result.includes('bundles: {}'), 'should include bundles: {}');
});

test('generateMountPlan with bundles=auth includes identity bundle only', () => {
  const result = generateMountPlan('my-app', { bundles: 'auth' });
  assert.ok(result.includes('identity'), 'should include identity bundle');
  assert.ok(!result.includes('pipeline'), 'should not include pipeline bundle');
  assert.ok(!result.includes('pulse'), 'should not include pulse bundle');
  assert.ok(!result.includes('tasks'), 'should not include tasks bundle');
});

test('generateMountPlan with bundles=all includes all 4 bundles', () => {
  const result = generateMountPlan('my-app', { bundles: 'all' });
  assert.ok(result.includes('identity'), 'should include identity bundle');
  assert.ok(result.includes('pipeline'), 'should include pipeline bundle');
  assert.ok(result.includes('pulse'), 'should include pulse bundle');
  assert.ok(result.includes('tasks'), 'should include tasks bundle');
});

test('generateMountPlan with bundles=all has full configs', () => {
  const result = generateMountPlan('my-app', { bundles: 'all' });
  assert.ok(result.includes('retention_days'), 'should include pulse retention_days config');
  assert.ok(result.includes('default_stages'), 'should include pipeline default_stages config');
});

test('generateMountPlan includes the app name', () => {
  const result = generateMountPlan('my-app', { bundles: 'empty' });
  assert.ok(result.includes('my-app'), 'should include the app name');
});

test('generateMountPlan with unknown bundles value defaults to empty', () => {
  const result = generateMountPlan('my-app', { bundles: 'unknown' });
  assert.ok(result.includes('bundles: {}'), 'unknown bundles value should default to empty');
  assert.ok(!result.includes('identity'), 'should not include any bundle entries');
});
