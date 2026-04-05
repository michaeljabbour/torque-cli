import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import checkPort from '../lib/port.js';

// ─── helper: ask the OS for a guaranteed-free port ────────────────────────────
// Listens on port 0 (OS assigns a free ephemeral port), records the port,
// then closes the server. There's a tiny race window after close, but in
// practice this is the most reliable approach for test port allocation.
function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

// ─── Test 1: free port resolves ───────────────────────────────────────────────
test('checkPort resolves when port is free', async () => {
  const port = await getFreePort();
  await assert.doesNotReject(
    checkPort(port),
    'checkPort should resolve when the port is available',
  );
});

// ─── Test 2: in-use node process is auto-killed ────────────────────────────────
test('checkPort auto-kills a node process holding the port and resolves', { skip: !process.env.CI ? false : 'lsof not reliable on CI runners' }, async () => {
  const port = await getFreePort();

  // Spawn a SEPARATE child node process that holds the port.
  // We use a child process (not an in-process server) so that
  // `lsof -ti:${port}` returns the child's PID, not the test runner's PID.
  const child = spawn(
    process.execPath, // same node binary
    [
      '-e',
      `
      const { createServer } = require('node:net');
      const s = createServer();
      s.listen(${port}, '127.0.0.1', () => {
        // Signal the parent that we are ready
        process.stdout.write('ready\\n');
      });
      // Respond gracefully to SIGTERM so the port is released quickly
      process.on('SIGTERM', () => { s.close(); process.exit(0); });
    `,
    ],
    { stdio: ['ignore', 'pipe', 'ignore'] },
  );

  // Wait until the child signals it's listening
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve);
    child.once('error', reject);
    child.once('exit', (code) =>
      reject(new Error(`Child exited prematurely with code ${code}`)),
    );
  });

  try {
    // checkPort should detect the child as a node process, kill it, and resolve
    await assert.doesNotReject(
      checkPort(port),
      'checkPort should auto-kill the blocking node process and resolve',
    );
  } finally {
    // Belt-and-suspenders cleanup: kill the child if checkPort didn't
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGTERM');
    }
    // Wait for the child to finish so we don't leave a zombie
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('close', resolve);
      // Give it 1 s before we stop waiting
      setTimeout(resolve, 1000);
    });
  }
});
