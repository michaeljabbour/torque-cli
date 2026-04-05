import { parseArgs } from 'node:util';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { findWorkspace } from '../lib/workspace.js';

const REPOS = ['torque-app', 'torque-core', '@torquedev/cli'];

function runCommand(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('close', (code) => resolve(code));
    child.on('error', reject);
  });
}

export default async function update() {
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      'fresh-db': { type: 'boolean', default: false },
    },
  });

  const freshDb = values['fresh-db'];

  // Step 1: Resolve workspace
  let workspaceRoot;
  try {
    workspaceRoot = findWorkspace();
  } catch (err) {
    console.error(err.message);
    return 1;
  }

  // Step 2: Git pull repos in order (CLI last — it is the running process)
  const pulledRepos = [];
  for (let i = 0; i < REPOS.length; i++) {
    const repo = REPOS[i];
    const repoDir = join(workspaceRoot, repo);

    if (!existsSync(repoDir)) {
      continue;
    }

    // Skip repos with no remote configured (e.g. newly created local-only repos)
    let hasRemote = false;
    try {
      hasRemote = execSync('git remote', { cwd: repoDir }).toString().trim() !== '';
    } catch {
      // git remote failed — treat as no remote
    }
    if (!hasRemote) {
      console.log(`${repo}/ -- no remote configured, skipping`);
      continue;
    }

    const code = await runCommand('git', ['pull', '--ff-only'], repoDir);

    if (code !== 0) {
      const remaining = REPOS.slice(i + 1).filter((r) =>
        existsSync(join(workspaceRoot, r))
      );
      console.error(`Failed to pull ${repo}.`);
      if (remaining.length > 0) {
        console.error(`Remaining un-updated repos: ${remaining.join(', ')}`);
      }
      return 1;
    }

    pulledRepos.push(repo);
  }

  // Step 3: Run npm install in torque-app
  const appDir = join(workspaceRoot, 'torque-app');
  const installCode = await runCommand('npm', ['install'], appDir);
  if (installCode !== 0) {
    console.error('npm install failed.');
    return 1;
  }

  // Step 4: If --fresh-db, remove .sqlite3 files from data/
  let dbWiped = false;
  if (freshDb) {
    const dataDir = join(appDir, 'data');
    if (existsSync(dataDir)) {
      const sqliteFiles = readdirSync(dataDir).filter((f) =>
        f.includes('.sqlite3')
      );
      for (const file of sqliteFiles) {
        unlinkSync(join(dataDir, file));
      }
      console.log(`Removed ${sqliteFiles.length} database file(s).`);
      dbWiped = sqliteFiles.length > 0;
    }
  }

  // Step 5: Print summary
  console.log('Update complete.');
  if (pulledRepos.length > 0) {
    console.log('Pulled repos:', pulledRepos.join(', '));
  }
  if (dbWiped) {
    console.log('Database wiped.');
  }

  return 0;
}
