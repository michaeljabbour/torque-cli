#!/usr/bin/env node
import { parseArgs } from 'node:util';
import chalk from 'chalk';

const VERSION = '0.4.0';

const COMMANDS = {
  new:       { desc: 'Create a new Torque app',                      alias: 'n',  cat: 'create',   icon: '✦' },
  start:     { desc: 'Start the server',                             alias: 's',  cat: 'create',   icon: '▶' },
  dev:       { desc: 'Start in watch mode (auto-restart)',           alias: 'd',  cat: 'create',   icon: '↻' },
  seed:      { desc: 'Run per-bundle seed files',                    alias: null, cat: 'create',   icon: '⟡' },
  deploy:    { desc: 'Deploy to production (single VPS)',            alias: null, cat: 'create',   icon: '▲' },
  generate:  { desc: 'Scaffold bundles, CRUD, views',                alias: 'g',  cat: 'build',    icon: '◈' },
  validate:  { desc: 'Check composability & contracts',              alias: 'v',  cat: 'build',    icon: '✓' },
  doctor:    { desc: 'Diagnose project health',                      alias: null, cat: 'build',    icon: '⚕' },
  info:      { desc: 'Inspect a bundle (tables, routes, events)',    alias: 'i',  cat: 'explore',  icon: '◉' },
  list:      { desc: 'List bundles, behaviors, agents',              alias: 'l',  cat: 'explore',  icon: '≡' },
  console:   { desc: 'REPL with live registry',                     alias: 'c',  cat: 'explore',  icon: '⟩' },
  ai:        { desc: 'Ask Claude about your codebase',               alias: null, cat: 'ai',       icon: '⚡' },
  context:   { desc: 'Show AI agent context for a file',             alias: null, cat: 'ai',       icon: '◇' },
  migrate:   { desc: 'Per-bundle schema migrations',                  alias: 'm',  cat: 'build',    icon: '⇡' },
  update:    { desc: 'Pull latest bundles & deps',                   alias: 'u',  cat: 'maintain', icon: '↑' },
  clean:     { desc: 'Remove .bundles/ and generated artifacts',     alias: null, cat: 'maintain', icon: '✕' },
};

const CATEGORIES = {
  create:  { label: 'Create & Run',  color: chalk.green },
  build:   { label: 'Build',         color: chalk.cyan },
  explore: { label: 'Explore',       color: chalk.blue },
  ai:      { label: 'AI-Powered',    color: chalk.yellow },
  maintain:{ label: 'Maintain',      color: chalk.dim },
};

const ALIAS_MAP = {};
for (const [cmd, meta] of Object.entries(COMMANDS)) {
  if (meta.alias) ALIAS_MAP[meta.alias] = cmd;
}

function printHelp() {
  const W = 72;
  const line = chalk.dim('─'.repeat(W));

  console.log();
  console.log(chalk.bold.cyan('  ⚙  Torque') + chalk.dim(` v${VERSION}`));
  console.log(chalk.dim('  Composable monolith framework — build once, reuse everywhere'));
  console.log();
  console.log(line);
  console.log(chalk.dim('  Usage:') + ' torque ' + chalk.cyan('<command>') + chalk.dim(' [options]'));
  console.log(line);
  console.log();

  for (const [catKey, catMeta] of Object.entries(CATEGORIES)) {
    const cmds = Object.entries(COMMANDS).filter(([, m]) => m.cat === catKey);
    if (cmds.length === 0) continue;
    console.log(catMeta.color(`  ${catMeta.label}`));
    for (const [cmd, meta] of cmds) {
      const alias = meta.alias ? chalk.dim(` (${meta.alias})`) : '    ';
      const icon = catMeta.color(meta.icon);
      const cmdStr = chalk.bold(cmd.padEnd(12));
      console.log(`    ${icon} ${cmdStr}${alias}  ${chalk.dim(meta.desc)}`);
    }
    console.log();
  }

  console.log(line);
  console.log(chalk.dim('  Quick Start'));
  console.log();
  console.log(`    ${chalk.dim('$')} torque new my-app ${chalk.dim('--template kanban')}`);
  console.log(`    ${chalk.dim('$')} cd my-app && npm install`);
  console.log(`    ${chalk.dim('$')} torque seed`);
  console.log(`    ${chalk.dim('$')} torque start`);
  console.log(`    ${chalk.dim('→')} ${chalk.cyan('http://localhost:9292')}`);
  console.log();
  console.log(line);
  console.log(chalk.dim('  Common Workflows'));
  console.log();
  console.log(`    ${chalk.dim('Add a bundle:')}   torque generate scaffold deals title:string value:integer`);
  console.log(`    ${chalk.dim('Add relation:')}   torque generate scaffold notes body:text --belongs-to deals`);
  console.log(`    ${chalk.dim('Custom view:')}    torque generate view DashboardPage --route /dashboard`);
  console.log(`    ${chalk.dim('Migrations:')}    torque migrate generate && torque migrate run`);
  console.log(`    ${chalk.dim('Check health:')}   torque validate`);
  console.log(`    ${chalk.dim('Inspect:')}        torque info kanban-app`);
  console.log(`    ${chalk.dim('Ask AI:')}         torque ai "how does auth work?"`)
  console.log();
  console.log(line);
  console.log(chalk.dim('  Conventions'));
  console.log();
  console.log(`    ${chalk.dim('•')} Bundles in ${chalk.cyan('bundles/')} are ${chalk.bold('auto-discovered')} — no mount plan needed`);
  console.log(`    ${chalk.dim('•')} Each bundle's ${chalk.cyan('seeds.js')} runs via ${chalk.bold('torque seed')} in dependency order`);
  console.log(`    ${chalk.dim('•')} One dependency in package.json: ${chalk.cyan('torque')}`);
  console.log(`    ${chalk.dim('•')} SQLite at ${chalk.cyan('data/app.sqlite3')} — auto-created`);
  console.log();
}

async function main() {
  const { positionals } = parseArgs({
    args: process.argv.slice(2),
    allowPositionals: true,
    strict: false,
  });

  // Check raw args for flags before parseArgs eats them
  const raw = process.argv.slice(2);
  if (raw.includes('--version') || raw.includes('-v')) {
    console.log(`Torque v${VERSION}`);
    process.exit(0);
  }

  let command = positionals[0];

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    process.exit(0);
  }

  // Resolve aliases
  if (ALIAS_MAP[command]) command = ALIAS_MAP[command];

  if (!COMMANDS[command]) {
    console.log();
    console.error(chalk.red(`  Unknown command: ${command}`));
    console.log();

    // Suggest closest match
    const candidates = Object.keys(COMMANDS);
    const close = candidates.filter(c => c.startsWith(command[0]) || c.includes(command));
    if (close.length > 0) {
      console.log(chalk.dim('  Did you mean?'));
      for (const c of close) {
        console.log(`    ${chalk.cyan(c)}  ${chalk.dim(COMMANDS[c].desc)}`);
      }
      console.log();
    }

    console.log(chalk.dim('  Run') + ' torque help ' + chalk.dim('to see all commands.'));
    console.log();
    process.exit(1);
  }

  if (command === 'console') {
    const { default: console_cmd } = await import('../commands/console.js');
    const code = await console_cmd();
    process.exit(code ?? 0);
  } else {
    const mod = await import(`../commands/${command}.js`);
    const code = await mod.default();
    process.exit(code ?? 0);
  }
}

main();
