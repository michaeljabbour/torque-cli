import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { banner, success, info, fileCreated, spinner } from '../lib/ui.js';
import { listTemplates, getTemplate, applyTemplate } from '../lib/templates.js';

export {
  generateBootJs,
  generatePackageJson,
  generateAppConfig,
  generateMountPlan,
} from '../lib/builders/app.js';

import {
  generateBootJs,
  generatePackageJson,
  generateMountPlan,
} from '../lib/builders/app.js';

export default async function newApp() {
  const name = process.argv[3];
  if (!name || name.startsWith('--')) {
    console.error('Usage: torque new <app-name> [--template <name>]');
    return 1;
  }

  const appDir = resolve(name);
  if (existsSync(appDir)) {
    console.error(chalk.red(`Directory '${name}' already exists.`));
    return 1;
  }

  // Check for --template flag
  const templateIdx = process.argv.indexOf('--template');
  const templateFlag = templateIdx !== -1 ? process.argv[templateIdx + 1] : null;

  banner();
  console.log(chalk.bold(`  Creating ${chalk.cyan(name)}`));
  console.log(chalk.dim(`  ${appDir}`));
  console.log();

  // ── Template selection (no shell prompt — framework-agnostic) ─────────

  let selectedTemplate = null;
  if (templateFlag) {
    selectedTemplate = getTemplate(templateFlag);
    if (!selectedTemplate) {
      console.error(chalk.red(`Template '${templateFlag}' not found.`));
      console.log(chalk.dim('  Available templates: ' + listTemplates().map(t => t.name).join(', ')));
      return 1;
    }
  } else {
    const templates = listTemplates();
    if (templates.length > 0) {
      const templateChoices = [
        ...templates.map(t => ({
          name: `${chalk.cyan(t.name)}  — ${t.description}`,
          value: t.name,
        })),
        { name: `${chalk.dim('Empty')}   — Start from scratch`, value: 'none' },
      ];

      const templateChoice = await select({
        message: 'Template',
        choices: templateChoices,
        default: templates.length > 0 ? templates[0].name : 'none',
      });

      if (templateChoice !== 'none') {
        selectedTemplate = getTemplate(templateChoice);
      }
    }
  }

  console.log();

  // ── Create files (zero-config, no boot.js, no mount plan) ─────────────

  const spin = spinner('Scaffolding app...');

  try {
    mkdirSync(join(appDir, 'bundles'), { recursive: true });
    mkdirSync(join(appDir, 'data'), { recursive: true });
    mkdirSync(join(appDir, 'ui'), { recursive: true });

    // Single package.json with one dependency
    writeFileSync(join(appDir, 'package.json'), generatePackageJson(name, { shell: 'none' }));

    // .gitignore
    writeFileSync(join(appDir, '.gitignore'), 'node_modules/\ndata/\n.bundles/\nbundle.lock\n*.sqlite3\n.torque/\n');

    // README
    writeFileSync(join(appDir, 'README.md'), `# ${name}

Built with [Torque](https://github.com/torque-framework/torque-app) — composable monolith framework.

## Quick Start

\`\`\`bash
npm install
torque seed    # populate demo data
torque start   # http://localhost:9292
\`\`\`

## Structure

\`\`\`
bundles/       auto-discovered bundles (no mount plan needed)
ui/            app-level theme and view overrides
data/          SQLite database (auto-created)
\`\`\`
`);

    // Apply template
    if (selectedTemplate) {
      // Templates use git-sourced bundles — need mount plan + boot.js
      mkdirSync(join(appDir, 'config', 'mount_plans'), { recursive: true });
      writeFileSync(join(appDir, 'boot.js'), generateBootJs({ shell: 'none', auth: true }));
      writeFileSync(
        join(appDir, 'config', 'mount_plans', 'development.yml'),
        generateMountPlan(name, { bundles: 'empty', template: selectedTemplate })
      );
      const pkg = JSON.parse(generatePackageJson(name, { shell: 'none', auth: true }));
      pkg.scripts.seed = 'node seeds/index.js';
      writeFileSync(join(appDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
      applyTemplate(appDir, selectedTemplate);
    }

    spin.succeed('App created');
  } catch (err) {
    spin.fail('Failed to create app');
    console.error(chalk.red(err.message));
    if (existsSync(appDir)) rmSync(appDir, { recursive: true, force: true });
    return 1;
  }

  // ── Summary ───────────────────────────────────────────────────────────

  console.log();
  const files = ['package.json', 'bundles/', 'ui/', 'data/', 'README.md', '.gitignore'];
  for (const f of files) fileCreated(f);

  if (selectedTemplate) {
    const bundleNames = Array.isArray(selectedTemplate.bundles)
      ? selectedTemplate.bundles
      : Object.keys(selectedTemplate.bundles || {});
    console.log();
    info(`Template: ${chalk.cyan(selectedTemplate.name)}`);
    info(`Bundles: ${bundleNames.map(b => chalk.cyan(b)).join(', ')}`);
  }

  console.log();
  console.log(chalk.bold('  Next steps:'));
  console.log();
  console.log(chalk.dim('  $') + ` cd ${name}`);
  console.log(chalk.dim('  $') + ' npm install');
  if (selectedTemplate) {
    console.log(chalk.dim('  $') + ' torque seed');
  }
  console.log(chalk.dim('  $') + ' torque start');
  console.log();
  console.log(chalk.dim('  →') + ` http://localhost:${chalk.cyan('9292')}`);

  if (selectedTemplate) {
    console.log();
    info(`Login: ${chalk.cyan('admin@example.com')} / ${chalk.cyan('demo1234')}`);
  } else {
    console.log();
    console.log(chalk.dim('  Generate your first bundle:'));
    console.log(chalk.dim('  $') + ' torque generate scaffold todos title:string completed:boolean');
  }

  console.log();
  console.log(chalk.dim('  No boot.js needed — torque auto-discovers bundles/ directory.'));
  console.log(chalk.dim('  No mount plan needed — bundle dependencies determine boot order.'));
  console.log();

  return 0;
}
