/**
 * Resolve @torquedev peer dependencies from the project's node_modules,
 * not from the CLI's install location.
 *
 * This is necessary because the CLI declares @torquedev/core as a
 * peerDependency — it lives in the consuming project, not here.
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * Import a module resolved from the current working directory's node_modules.
 * @param {string} specifier  e.g. '@torquedev/core/boot'
 * @returns {Promise<any>}
 */
export async function importFromProject(specifier) {
  const require = createRequire(join(process.cwd(), 'package.json'));
  const resolved = require.resolve(specifier);
  return import(resolved);
}
