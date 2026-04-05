import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const VALIDATE_SRC = readFileSync(join(ROOT, 'commands', 'validate.js'), 'utf8');
const GENERATE_SRC = readFileSync(join(ROOT, 'commands', 'generate.js'), 'utf8');

// ── Task 21: interface_undeclared / interface_unimplemented validate rules ───

test('validate.js checks for interfaces implemented but not declared (interface_undeclared)', () => {
  assert.match(
    VALIDATE_SRC,
    /interface_undeclared/,
    'validate.js must contain interface_undeclared rule'
  );
});

test('validate.js checks for interfaces declared but not implemented (interface_unimplemented)', () => {
  assert.match(
    VALIDATE_SRC,
    /interface_unimplemented/,
    'validate.js must contain interface_unimplemented rule'
  );
});

test('validate.js dynamically imports logic.js for interface validation', () => {
  assert.match(
    VALIDATE_SRC,
    /import\(absoluteLogicPath\)/,
    'validate.js must use dynamic import(absoluteLogicPath) for interface validation'
  );
});

// ── Task 22: generate tests reads specs field with fallback to behaviors ─────

test('generate.js reads manifest.specs with fallback to manifest.behaviors', () => {
  assert.match(
    GENERATE_SRC,
    /manifest\.specs\s*\|\|\s*manifest\.behaviors/,
    "generate.js must read manifest.specs with fallback: manifest.specs || manifest.behaviors"
  );
});

test("generate.js prints 'No specs declared in manifest.' when no specs", () => {
  assert.match(
    GENERATE_SRC,
    /No specs declared in manifest\./,
    "generate.js must say 'No specs declared in manifest.' (not 'behaviors')"
  );
});

test("generate.js uses 'specs' as the describe block name", () => {
  assert.match(
    GENERATE_SRC,
    /describe\('.*specs[',`]/,
    "generate.js describe block must use 'specs' not 'behaviors'"
  );
});

test("generate.js outputs .specs.test.js filename", () => {
  assert.match(
    GENERATE_SRC,
    /\.specs\.test\.js/,
    "generate.js output filename must use .specs.test.js"
  );
});

test("generate.js success message says 'spec tests'", () => {
  assert.match(
    GENERATE_SRC,
    /spec tests/,
    "generate.js success log must say 'spec tests' not 'behavior tests'"
  );
});
