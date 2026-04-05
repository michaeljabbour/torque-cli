import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

// ── deploy command module exports a default async function ──────────────────
test('deploy command module exports a default async function', async () => {
  const mod = await import('../commands/deploy.js');
  assert.strictEqual(typeof mod.default, 'function', 'deploy.js must export a default function');
});

// ── parseDeployConfig reads server, user, port from YAML ───────────────────
test('parseDeployConfig reads server, user, port from YAML', async () => {
  const { parseDeployConfig } = await import('../commands/deploy.js');
  const yaml = `
server: 192.168.1.100
user: myuser
port: 3000
env:
  NODE_ENV: production
`;
  const config = parseDeployConfig(yaml);
  assert.strictEqual(config.server, '192.168.1.100');
  assert.strictEqual(config.user, 'myuser');
  assert.strictEqual(config.port, 3000);
  assert.deepStrictEqual(config.env, { NODE_ENV: 'production' });
});

// ── parseDeployConfig defaults user to deploy and port to 9292 ─────────────
test('parseDeployConfig defaults user to deploy and port to 9292', async () => {
  const { parseDeployConfig } = await import('../commands/deploy.js');
  const yaml = `
server: myserver.example.com
`;
  const config = parseDeployConfig(yaml);
  assert.strictEqual(config.server, 'myserver.example.com');
  assert.strictEqual(config.user, 'deploy');
  assert.strictEqual(config.port, 9292);
});

// ── parseDeployConfig detects registry when present ────────────────────────
test('parseDeployConfig detects registry when present', async () => {
  const { parseDeployConfig } = await import('../commands/deploy.js');
  const yaml = `
server: myserver.example.com
registry: ghcr.io/myorg/myapp
`;
  const config = parseDeployConfig(yaml);
  assert.strictEqual(config.registry, 'ghcr.io/myorg/myapp');
});

// ── parseDeployConfig returns null registry when not set ───────────────────
test('parseDeployConfig returns null registry when not set', async () => {
  const { parseDeployConfig } = await import('../commands/deploy.js');
  const yaml = `
server: myserver.example.com
`;
  const config = parseDeployConfig(yaml);
  assert.ok(config.registry === undefined || config.registry === null, 'registry should be undefined or null when not set');
});

// ── buildDeployCommands uses save/load when no registry ────────────────────
test('buildDeployCommands uses save/load when no registry', async () => {
  const { buildDeployCommands } = await import('../commands/deploy.js');
  const config = {
    server: '192.168.1.100',
    user: 'deploy',
    port: 9292,
    registry: undefined,
    env: {},
  };
  const cmds = buildDeployCommands('myapp', config);

  assert.ok(cmds.build.includes('docker build'), 'build command must include "docker build"');
  assert.ok(cmds.transfer.includes('docker save'), 'transfer command must include "docker save"');
  assert.ok(cmds.transfer.includes('ssh'), 'transfer command must include "ssh"');
  assert.ok(cmds.transfer.includes('docker load'), 'transfer command must include "docker load"');
  assert.ok(cmds.run.includes('docker stop'), 'run command must include "docker stop"');
  assert.ok(cmds.run.includes('docker run'), 'run command must include "docker run"');
  assert.ok(cmds.run.includes('torque-data:/app/data'), 'run command must include volume mount "torque-data:/app/data"');
});

// ── buildDeployCommands uses push/pull when registry is set ────────────────
test('buildDeployCommands uses push/pull when registry is set', async () => {
  const { buildDeployCommands } = await import('../commands/deploy.js');
  const config = {
    server: '192.168.1.100',
    user: 'deploy',
    port: 9292,
    registry: 'ghcr.io/myorg/myapp',
    env: {},
  };
  const cmds = buildDeployCommands('myapp', config);

  assert.ok(cmds.transfer.includes('docker push'), 'transfer command must include "docker push" when registry is set');
  assert.ok(cmds.run.includes('docker pull'), 'run command must include "docker pull" when registry is set');
});

// ── deploy is registered in COMMANDS ───────────────────────────────────────
test('deploy is registered in COMMANDS', () => {
  const src = readFileSync(join(ROOT, 'bin', 'torque.js'), 'utf8');
  assert.ok(src.includes('deploy'), 'bin/torque.js must contain "deploy" in COMMANDS');
});
