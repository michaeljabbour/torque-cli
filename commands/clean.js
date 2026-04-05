import { parseArgs } from 'node:util';
import { existsSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { findWorkspace } from '../lib/workspace.js';

/**
 * rmSync with maxRetries — Node's internal rimraf can hit ENOTEMPTY race
 * conditions on large directories (e.g., node_modules). The maxRetries
 * option handles this natively.
 */
function rmSyncSafe(target) {
  rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export default async function clean() {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      deps: { type: 'boolean', default: false },
      data: { type: 'boolean', default: false },
      all: { type: 'boolean', default: false },
    },
  });

  const { deps, data, all } = values;

  // If no flags specified, print guidance and exit 0
  if (!deps && !data && !all) {
    console.log('Usage: torque clean [flags]');
    console.log('');
    console.log('Flags:');
    console.log('  --deps   Remove node_modules/ from torque-app');
    console.log('  --data   Remove .sqlite3 database files from torque-app/data/');
    console.log('  --all    Remove node_modules/, sqlite3 files, AND .bundles/');
    return 0;
  }

  // Step 1: Resolve workspace
  let workspaceRoot;
  try {
    workspaceRoot = findWorkspace();
  } catch (err) {
    console.error(err.message);
    return 1;
  }

  const appDir = join(workspaceRoot, 'torque-app');
  const removed = [];

  // Step 2: --deps or --all: remove appDir/node_modules/
  if (deps || all) {
    const nodeModulesDir = join(appDir, 'node_modules');
    if (existsSync(nodeModulesDir)) {
      rmSyncSafe(nodeModulesDir);
      removed.push('node_modules/');
    } else {
      console.log('node_modules/: already clean');
    }
  }

  // Step 3: --data or --all: remove .sqlite3 files from appDir/data/
  if (data || all) {
    const dataDir = join(appDir, 'data');
    if (existsSync(dataDir)) {
      const sqliteFiles = readdirSync(dataDir).filter((f) =>
        f.includes('.sqlite3')
      );
      if (sqliteFiles.length > 0) {
        for (const file of sqliteFiles) {
          unlinkSync(join(dataDir, file));
        }
        removed.push(`${sqliteFiles.length} sqlite3 file(s)`);
      } else {
        console.log('data/*.sqlite3: already clean');
      }
    } else {
      console.log('data/*.sqlite3: already clean');
    }
  }

  // Step 4: --all ONLY: remove appDir/.bundles/
  if (all) {
    const bundlesDir = join(appDir, '.bundles');
    if (existsSync(bundlesDir)) {
      rmSyncSafe(bundlesDir);
      removed.push('.bundles/');
    } else {
      console.log('.bundles/: already clean');
    }
  }

  // Step 5: Print summary
  if (removed.length > 0) {
    console.log('Removed:', removed.join(', '));
  }

  return 0;
}
