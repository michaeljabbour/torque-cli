import { findWorkspace } from '../lib/workspace.js';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import yaml from 'js-yaml';

export default async function context() {
  const diffMode = process.argv.includes('--diff');
  const forIdx = process.argv.indexOf('--for');
  const filePath = forIdx !== -1 ? process.argv[forIdx + 1] : null;

  if (!filePath && !diffMode) {
    console.error('Usage: torque context --for <file>');
    console.error('       torque context --diff [--ref <commit>]');
    return 1;
  }

  const ws = findWorkspace();

  if (diffMode) {
    return contextFromDiff(ws);
  }

  return contextForFile(ws, filePath);
}

/**
 * --diff mode: find changed files via git, group by bundle, show context for each.
 */
function contextFromDiff(ws) {
  const refIdx = process.argv.indexOf('--ref');
  const ref = refIdx !== -1 ? process.argv[refIdx + 1] : 'HEAD';

  // Collect changed files across all repos
  const allChanged = [];
  const repos = readdirSync(ws).filter(d => {
    return existsSync(join(ws, d, '.git')) && d.startsWith('torque-');
  });

  for (const repo of repos) {
    const repoDir = join(ws, repo);
    try {
      // Uncommitted changes (staged + unstaged)
      const diffOutput = execSync(`git diff --name-only ${ref} 2>/dev/null; git diff --cached --name-only 2>/dev/null`, {
        cwd: repoDir, encoding: 'utf8',
      }).trim();
      // Untracked files
      const untrackedOutput = execSync('git ls-files --others --exclude-standard 2>/dev/null', {
        cwd: repoDir, encoding: 'utf8',
      }).trim();

      const files = [...new Set([
        ...diffOutput.split('\n').filter(Boolean),
        ...untrackedOutput.split('\n').filter(Boolean),
      ])];

      for (const f of files) {
        allChanged.push({ repo, file: f, fullPath: join(repoDir, f) });
      }
    } catch {
      // Not a git repo or git not available — skip
    }
  }

  if (allChanged.length === 0) {
    console.log('No changes detected across any torque repos.');
    return 0;
  }

  // Group by bundle vs infrastructure
  const bundleChanges = new Map(); // bundleName -> files[]
  const infraChanges = [];

  for (const { repo, file, fullPath } of allChanged) {
    const bundleMatch = repo.match(/torque-bundle-(.+)/);
    if (bundleMatch) {
      const name = bundleMatch[1];
      if (!bundleChanges.has(name)) bundleChanges.set(name, []);
      bundleChanges.get(name).push(file);
    } else {
      infraChanges.push({ repo, file });
    }
  }

  console.log(`# Diff-Aware Context (${allChanged.length} files changed)\n`);

  // Infrastructure changes
  if (infraChanges.length > 0) {
    console.log(`## Infrastructure changes (${infraChanges.length} files)`);
    console.log('These affect ALL bundles. Review carefully.\n');
    for (const { repo, file } of infraChanges) {
      console.log(`  ${repo}/${file}`);
    }
    console.log();
  }

  // Bundle changes with full context
  for (const [bundleName, files] of bundleChanges) {
    console.log(`${'─'.repeat(60)}`);
    const bundleDir = join(ws, `torque-bundle-${bundleName}`);
    const manifestPath = join(bundleDir, 'manifest.yml');

    console.log(`## Bundle: ${bundleName}`);
    console.log(`Changed files: ${files.join(', ')}\n`);

    if (!existsSync(manifestPath)) {
      console.log('  (no manifest.yml found)\n');
      continue;
    }

    const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
    printBundleContext(ws, bundleName, manifest, bundleDir);
    console.log();
  }

  return 0;
}

/**
 * --for <file> mode: show context for a specific file.
 */
function contextForFile(ws, filePath) {
  const bundleMatch = filePath.match(/torque-bundle-([^/]+)/);
  const bundleName = bundleMatch?.[1];

  if (!bundleName) {
    console.log(`# Context for ${filePath}\n`);
    console.log('## Type: Infrastructure file\n');
    console.log('This file is part of the kernel/service infrastructure. Changes affect ALL bundles.');
    return 0;
  }

  const bundleDir = join(ws, `torque-bundle-${bundleName}`);
  const manifestPath = join(bundleDir, 'manifest.yml');
  if (!existsSync(manifestPath)) {
    console.error(`No manifest found for bundle '${bundleName}'`);
    return 1;
  }

  const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));

  console.log(`# Context for ${filePath}\n`);
  console.log(`## Bundle: ${bundleName} (v${manifest.version})`);
  console.log(`## Description: ${manifest.description}\n`);
  console.log(`## Manifest: ${manifestPath}\n`);

  printBundleContext(ws, bundleName, manifest, bundleDir);
  return 0;
}

/**
 * Shared: print full contract context for a bundle.
 */
function printBundleContext(ws, bundleName, manifest, bundleDir) {
  // Interfaces — show contracts if available, fall back to queries list
  const contracts = manifest.interfaces?.contracts || {};
  const queries = manifest.interfaces?.queries || [];
  const allDeclared = [...new Set([...queries, ...Object.keys(contracts)])];

  if (Object.keys(contracts).length > 0) {
    console.log('### Interface contracts');
    for (const [name, def] of Object.entries(contracts)) {
      console.log(`  ${name}:`);
      if (def.description) console.log(`    ${def.description}`);
      if (def.input) console.log(`    Input: ${JSON.stringify(def.input)}`);
      if (def.output?.shape) console.log(`    Output: ${JSON.stringify(def.output.shape)}`);
      if (def.errors) console.log(`    Errors: ${def.errors.map(e => e.code).join(', ')}`);
      if (def.side_effects) console.log(`    Side effects: ${def.side_effects.map(e => e.publishes).join(', ')}`);
    }
    // Also list any query-only interfaces without contracts
    const contractOnly = queries.filter(q => !contracts[q]);
    if (contractOnly.length) {
      console.log(`  Query-only (no contract): ${contractOnly.join(', ')}`);
    }
    console.log();
  } else if (allDeclared.length) {
    console.log(`### Interfaces: ${allDeclared.join(', ')}\n`);
  }

  // Who calls this bundle
  const callers = [];
  const allBundles = readdirSync(ws)
    .filter(d => d.startsWith('torque-bundle-') && d !== `torque-bundle-${bundleName}`)
    .map(d => d.replace('torque-bundle-', ''));
  for (const other of allBundles) {
    const otherLogic = join(ws, `torque-bundle-${other}`, 'logic.js');
    if (!existsSync(otherLogic)) continue;
    const code = readFileSync(otherLogic, 'utf8');
    if (code.includes(`'${bundleName}'`)) callers.push(other);
  }
  if (callers.length) console.log(`### Called by: ${callers.join(', ')}\n`);

  // Events
  if (manifest.events?.publishes?.length) {
    console.log('### Events published');
    for (const e of manifest.events.publishes) {
      console.log(`  ${e.name}: ${JSON.stringify(e.schema)}`);
    }
    console.log();
  }
  if (manifest.events?.subscribes?.length) {
    console.log(`### Events subscribed: ${manifest.events.subscribes.join(', ')}\n`);
  }

  // Dependencies
  if (manifest.depends_on?.length) console.log(`### Dependencies: ${manifest.depends_on.join(', ')}`);
  if (manifest.optional_deps?.length) console.log(`### Optional deps: ${manifest.optional_deps.join(', ')}`);

  // Behaviors
  if (manifest.behaviors?.length) {
    console.log(`\n### Behavioral specs (${manifest.behaviors.length})`);
    for (const b of manifest.behaviors) console.log(`  - ${b.name}`);
  }

  // Agent guide
  const agentPath = join(bundleDir, 'agent.md');
  if (existsSync(agentPath)) console.log(`\n### Agent guide: ${agentPath}`);
}
