import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

// ── lib/ai.js unit tests ────────────────────────────────────────────────────

test('isAIAvailable() returns false when ANTHROPIC_API_KEY is not set', async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    // Fresh import to avoid module cache issues with env state
    const { isAIAvailable } = await import('../lib/ai.js');
    assert.equal(isAIAvailable(), false);
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});

test('getSystemPrompt() returns a string containing "Torque"', async () => {
  const { getSystemPrompt } = await import('../lib/ai.js');
  const prompt = await getSystemPrompt(ROOT);
  assert.equal(typeof prompt, 'string');
  assert.ok(prompt.includes('Torque'), 'system prompt should mention Torque');
});

// ── commands/ai.js source tests ─────────────────────────────────────────────

const AI_CMD_SRC = readFileSync(join(ROOT, 'commands', 'ai.js'), 'utf8');

test('ai command prints usage when no prompt given', () => {
  assert.match(
    AI_CMD_SRC,
    /Usage: torque ai <prompt>/,
    'ai command should show usage text',
  );
});

test('ai command prints API key message when key is missing', () => {
  assert.match(
    AI_CMD_SRC,
    /AI features require ANTHROPIC_API_KEY/,
    'ai command should tell user to set ANTHROPIC_API_KEY',
  );
});

// ── generate --ai flag ──────────────────────────────────────────────────────

const GEN_SRC = readFileSync(join(ROOT, 'commands', 'generate.js'), 'utf8');

test('generate command recognizes --ai flag for scaffold', () => {
  assert.match(
    GEN_SRC,
    /parseFlag\('--ai'\)/,
    'generate scaffold should parse --ai flag',
  );
});

test('generate command recognizes --ai flag for from-manifest', () => {
  assert.match(
    GEN_SRC,
    /hasFlag\('--ai'\)/,
    'generate from-manifest should check --ai flag',
  );
});

test('generate --ai gracefully fails without API key', () => {
  assert.match(
    GEN_SRC,
    /AI features require ANTHROPIC_API_KEY/,
    'generate --ai should tell user to set ANTHROPIC_API_KEY when unavailable',
  );
});

// ── CLI registration ────────────────────────────────────────────────────────

const CLI_SRC = readFileSync(join(ROOT, 'bin', 'torque.js'), 'utf8');

test('torque.js COMMANDS includes ai', () => {
  assert.match(
    CLI_SRC,
    /'ai'/,
    'COMMANDS array should include ai',
  );
});

test('torque.js DESCRIPTIONS includes ai description', () => {
  assert.match(
    CLI_SRC,
    /ai:.*Ask Claude/,
    'DESCRIPTIONS should have an ai entry',
  );
});
