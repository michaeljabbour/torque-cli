import { createServer } from 'node:net';

/**
 * Check if a port is available.
 * @param {number|string} port
 * @returns {Promise<boolean>} true if available
 */
export function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(() => resolve(true)); });
    server.listen(Number(port));
  });
}

/**
 * Find the next available port starting from the given one.
 * @param {number|string} startPort
 * @returns {Promise<number>}
 */
export async function findFreePort(startPort) {
  const start = Number(startPort);
  for (let p = start; p < start + 20; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error(`No free port found in range ${start}-${start + 19}`);
}

// Default export for backward compatibility
export default async function checkPort(port) {
  const free = await isPortFree(port);
  if (!free) {
    throw new Error(`Port ${port} is already in use. Use --port <number> or PORT=<number> to choose a different port.`);
  }
}
