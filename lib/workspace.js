import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const REQUIRED_REPOS = ['torque-app', 'torque-core'];

export function findWorkspace(startDir = process.cwd()) {
  let dir = resolve(startDir);

  while (true) {
    if (existsSync(join(dir, REQUIRED_REPOS[0]))) {
      const missing = REQUIRED_REPOS.filter(
        (repo) => !existsSync(join(dir, repo))
      );

      if (missing.length > 0) {
        const names = missing.map((name) => `${name}/`).join(', ');
        throw new Error(
          `${names} not found in workspace at ${dir}. Expected repos: ${REQUIRED_REPOS.join(', ')}.`
        );
      }

      return dir;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        'Could not find Torque workspace. Run from the workspace root or any subdirectory containing torque-app/.'
      );
    }

    dir = parent;
  }
}
