import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';
import chalk from 'chalk';
import { toClassName } from '../lib/builders/utils.js';
import { success, info, fileCreated, spinner, error as logError } from '../lib/ui.js';
import {
  buildManifestYaml,
  parseFields,
  buildLogicJs,
  buildTestJs,
  buildAgentMd,
  buildUiKit,
  buildListViewJs,
  buildDetailViewJs,
  buildUiIndexJs,
} from '../lib/builders/index.js';
import { buildSeedJs, buildBundleSeedJs } from '../lib/builders/seed.js';
import { isAIAvailable, callClaude, getSystemPrompt } from '../lib/ai.js';

// ── Argv helpers ──────────────────────────────────────────────────────────

function parseFlag(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

export default async function generate() {
  const sub = process.argv[3];
  const arg3 = process.argv[4];

  if (sub === 'bundle') return generateBundle(arg3);
  if (sub === 'scaffold') return generateScaffold(arg3);
  if (sub === 'view') return generateView(arg3);
  if (sub === 'from-manifest') return generateFromManifest(arg3);
  if (sub === 'tests') return generateTests(arg3);
  if (sub === 'seed') return generateSeed(arg3);
  if (sub === 'intent') return generateIntent(arg3, process.argv[5]);

  console.log('Usage: torque generate <bundle|scaffold|view|intent|from-manifest|tests|seed> <name|path>');
  console.log('');
  console.log('  bundle <name>              Create an empty bundle skeleton with stubs');
  console.log('  scaffold <name> [fields]   Generate full CRUD bundle (like rails scaffold)');
  console.log('                             e.g. torque generate scaffold todos title:string completed:boolean');
  console.log('                             --belongs-to <parent>   Nest under a parent bundle');
  console.log('                             --no-auth               Disable auth on routes');
  console.log('  view <ViewName>            Generate an app-level view override (ui/views/ViewName.js)');
  console.log('                             --route <path>          Route path for this view (default: /view-name)');
  console.log('  intent <bundle> <name>     Generate an IDD Intent (Intent/Context/Behavior triplet)');
  console.log('  from-manifest <path>       Generate logic.js from a manifest.yml');
  console.log('  tests <path>               Generate behavior tests from a manifest.yml');
  console.log('  seed <bundle>              Generate seed script from a bundle manifest');
  return 1;
}

// ── Scaffold generator ────────────────────────────────────────────────────

async function generateScaffold(name) {
  if (!name) {
    console.error('Usage: torque generate scaffold <name> [field:type ...]');
    console.error('  e.g. torque generate scaffold todos title:string completed:boolean');
    return 1;
  }

  // Parse flags before field args
  const belongsTo = parseFlag('--belongs-to');
  const noAuth = hasFlag('--no-auth');
  const aiDescription = parseFlag('--ai');

  // If --ai flag is present, use AI to generate fields
  if (aiDescription !== undefined) {
    if (!isAIAvailable()) {
      console.error('AI features require ANTHROPIC_API_KEY.');
      console.error('Set it up: export ANTHROPIC_API_KEY=sk-ant-...');
      return 1;
    }

    try {
      const appDir = resolve(process.cwd());
      const systemPrompt = await getSystemPrompt(appDir);
      const aiPrompt = `Generate field definitions for a Torque bundle called "${name}". Description: ${aiDescription}\n\nReturn ONLY a JSON array of objects with "name" and "type" keys. Valid types: string, text, integer, boolean, uuid, timestamp, json.\nExample: [{"name":"title","type":"string"},{"name":"completed","type":"boolean"}]`;

      const result = await callClaude(aiPrompt, { systemPrompt, maxTurns: 3 });
      const jsonMatch = result.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        console.error('AI did not return valid field definitions.');
        return 1;
      }
      const aiFields = JSON.parse(jsonMatch[0]);
      const fields = aiFields.map(f => ({ name: f.name, type: f.type || 'string' }));

      if (fields.length === 0) {
        console.error('AI returned no fields.');
        return 1;
      }

      return finishScaffold(name, fields, belongsTo, noAuth);
    } catch (err) {
      console.error('AI error: ' + err.message);
      return 1;
    }
  }

  // Filter out flags from field args
  const rawArgs = process.argv.slice(5);
  const fieldArgs = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--belongs-to') { i++; continue; }
    if (rawArgs[i] === '--no-auth') continue;
    if (rawArgs[i] === '--ai') { i++; continue; }
    fieldArgs.push(rawArgs[i]);
  }
  const fields = parseFields(fieldArgs);

  if (fields.length === 0) {
    console.error('At least one field is required.');
    console.error('  e.g. torque generate scaffold todos title:string completed:boolean');
    return 1;
  }

  return finishScaffold(name, fields, belongsTo, noAuth);
}

function finishScaffold(name, fields, belongsTo, noAuth) {
  const options = {};
  if (belongsTo) options.belongsTo = belongsTo;
  if (noAuth) options.auth = false;

  const appDir = resolve(process.cwd());
  const dir = join(appDir, 'bundles', name);

  if (existsSync(dir)) {
    console.error(`Bundle '${name}' already exists at ${dir}`);
    return 1;
  }

  const className = toClassName(name);
  const firstStringField = fields.find(f => f.type === 'string' || f.type === 'text');

  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'test'), { recursive: true });
  mkdirSync(join(dir, 'ui'), { recursive: true });

  writeFileSync(join(dir, 'manifest.yml'), buildManifestYaml(name, fields, options));
  writeFileSync(join(dir, 'logic.js'), buildLogicJs(name, className, fields, options));
  writeFileSync(join(dir, 'agent.md'), buildAgentMd(name, className, fields));

  writeFileSync(join(dir, 'package.json'), `{
  "name": "@torquedev/bundle-${name}",
  "version": "1.0.0",
  "type": "module",
  "main": "logic.js",
  "scripts": { "test": "node --test 'test/*.test.js'" }
}
`);

  writeFileSync(join(dir, 'test', `${name}.test.js`), buildTestJs(name, className, fields, firstStringField));

  writeFileSync(join(dir, 'ui', 'ui-kit.js'), buildUiKit());
  writeFileSync(join(dir, 'ui', 'ListView.js'), buildListViewJs(name, fields));
  writeFileSync(join(dir, 'ui', 'DetailView.js'), buildDetailViewJs(name, fields));
  writeFileSync(join(dir, 'ui', 'index.js'), buildUiIndexJs(name));
  writeFileSync(join(dir, 'seeds.js'), buildBundleSeedJs(name, fields));

  addToMountPlan(name, appDir);

  console.log();
  success(`Scaffold ${chalk.cyan(name)} created`);
  console.log();
  for (const f of ['manifest.yml', 'logic.js', 'seeds.js', 'agent.md', 'package.json', 'test/', 'ui/']) fileCreated(f);
  console.log();
  info(`Routes: ${chalk.cyan(`GET/POST/PATCH/DELETE /api/${name}`)}`);
  info(`Views: ${chalk.cyan('ListView')}, ${chalk.cyan('DetailView')}`);
  info(`Fields: ${fields.map(f => chalk.cyan(`${f.name}:${f.type}`)).join(', ')}`);
  if (belongsTo) info(`Belongs to: ${chalk.cyan(belongsTo)}`);
  if (noAuth) info('Auth: disabled');
  console.log();
  return 0;
}

// ── Mount plan helper ─────────────────────────────────────────────────────

function addToMountPlan(name, appDir) {
  const mountPlanPath = join(appDir, 'config', 'mount_plans', 'development.yml');
  if (existsSync(mountPlanPath)) {
    try {
      const planContent = readFileSync(mountPlanPath, 'utf8');
      const plan = yaml.load(planContent) || {};

      if (!plan.bundles) {
        plan.bundles = {};
      }

      plan.bundles[name] = {
        source: `path:./bundles/${name}`,
        enabled: true,
        config: {},
      };

      writeFileSync(mountPlanPath, yaml.dump(plan, { lineWidth: -1, quotingType: '"' }));
      console.log(`Added '${name}' to ${mountPlanPath}`);
    } catch (err) {
      console.warn(`Warning: could not update mount plan: ${err.message}`);
    }
  }
}

// ── Empty bundle generator ────────────────────────────────────────────────

function generateBundle(name) {
  if (!name) { console.error('Usage: torque generate bundle <name>'); return 1; }

  const appDir = resolve(process.cwd());
  const dir = join(appDir, 'bundles', name);

  if (existsSync(dir)) { console.error(`Bundle '${name}' already exists at ${dir}`); return 1; }

  const className = toClassName(name);

  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'test'), { recursive: true });
  mkdirSync(join(dir, 'ui'), { recursive: true });

  writeFileSync(join(dir, 'manifest.yml'), `name: ${name}
version: "1.0.0"
description: "${className} bundle"

schema:
  tables:
    # Define your database tables here. Example:
    # items:
    #   columns:
    #     id: { type: uuid, primary: true }
    #     title: { type: string, null: false }
    #     status: { type: string, default: "active" }
    #     created_at: { type: timestamp }
    #     updated_at: { type: timestamp }

events:
  publishes: []
    # - name: ${name}.item.created
    #   schema: { item_id: uuid, title: string }
  subscribes: []

interfaces:
  queries: []
  contracts: {}
    # getItem:
    #   description: "Retrieve an item by ID"
    #   input: { itemId: { type: uuid, required: true } }
    #   output: { type: object, nullable: true, shape: { id: uuid, title: string } }

api:
  routes: []
    # - { method: GET, path: /api/${name}, handler: list, auth: true }
    # - { method: POST, path: /api/${name}, handler: create, auth: true }
    # - { method: GET, path: /api/${name}/:id, handler: get, auth: true }
    # - { method: PATCH, path: /api/${name}/:id, handler: update, auth: true }
    # - { method: DELETE, path: /api/${name}/:id, handler: remove, auth: true }

ui:
  script: ui/index.js
  routes: []
  navigation: []

behaviors: []
depends_on: []
optional_deps: []
intents: []
`);

  writeFileSync(join(dir, 'logic.js'), `export default class ${className} {
  constructor({ data, events, config, coordinator }) {
    this.data = data;
    this.events = events;
    this.config = config;
    this.coordinator = coordinator;
  }

  interfaces() {
    return {
      // getItem: ({ itemId }) => this.data.find('items', itemId),
    };
  }

  routes() {
    return {
      // list: (ctx) => ({ status: 200, data: this.data.query('items') }),
      // get: (ctx) => {
      //   const item = this.data.find('items', ctx.params.id);
      //   if (!item) return { status: 404, data: { error: 'Not found' } };
      //   return { status: 200, data: item };
      // },
      // create: (ctx) => {
      //   const item = this.data.insert('items', { ...ctx.body, created_by: ctx.currentUser?.id });
      //   this.events.publish('${name}.item.created', { item_id: item.id });
      //   return { status: 201, data: item };
      // },
      // update: (ctx) => {
      //   const updated = this.data.update('items', ctx.params.id, ctx.body);
      //   return { status: 200, data: updated };
      // },
      // remove: (ctx) => {
      //   this.data.delete('items', ctx.params.id);
      //   return { status: 200, data: { deleted: true } };
      // },
    };
  }

  setupSubscriptions(eventBus) {
    // eventBus.subscribe('other-bundle.entity.created', '${name}', (payload) => { ... });
  }
}
`);

  writeFileSync(join(dir, 'seeds.js'), `/**
 * Seeds for ${name} bundle.
 * Called by: torque seed (in dependency order)
 */
export default async function seed({ routes, registry, data }) {
  console.log('  Seeding ${name}...');
  // const r = routes();
  // const ctx = (body) => ({ body, params: {}, currentUser: { id: 'seed-user' }, query: {} });
  // r.create(ctx({ title: 'Sample item' }));
  console.log('    (no seed data yet — add items here)');
}
`);

  writeFileSync(join(dir, 'ui', 'ui-kit.js'), buildUiKit());

  writeFileSync(join(dir, 'ui', 'index.js'), `// Export view components for this bundle.
// Each key maps to a component name used in manifest ui.routes.
export default {
  views: {
    // '${name}-list': ListView,
    // '${name}-detail': DetailView,
  },
};
`);

  writeFileSync(join(dir, 'agent.md'), `---
meta:
  name: ${name}-expert
  description: "Expert on the ${name} bundle"
  modes:
    - name: implement
      trigger: "work on ${name}"
    - name: debug
      trigger: "debug ${name}"
  context:
    include:
      - foundation/context/DESIGN_PRINCIPLES.md
      - foundation/context/DOMAIN_CONVENTIONS.md
---

# ${className} Bundle — Agent Guide

## What this bundle does
(describe purpose in 2 sentences)

## Domain model
(entities, relationships, business rules)

## Key interfaces
(list the public interfaces with their contracts)

## Anti-patterns
- Never import from other bundles — use coordinator.call()
- Never access other bundles' database tables
- Never hardcode config — use this.config from mount plan
- Events are past-tense facts, not commands
`);

  writeFileSync(join(dir, 'package.json'), `{
  "name": "@torquedev/bundle-${name}",
  "version": "1.0.0",
  "type": "module",
  "main": "logic.js",
  "scripts": { "test": "node --test 'test/*.test.js'" }
}
`);

  writeFileSync(join(dir, 'test', `${name}.test.js`), `import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import ${className} from '../logic.js';

describe('${name} bundle', () => {
  let bundle;

  before(() => {
    const mockData = {
      insert: (t, row) => ({ id: 'test-id', ...row }),
      query: () => [],
      find: () => null,
      update: (t, id, attrs) => ({ id, ...attrs }),
      delete: () => true,
      count: () => 0,
    };
    const mockEvents = { publish: () => {} };
    const mockCoordinator = { call: async () => ({}) };

    bundle = new ${className}({
      data: mockData,
      events: mockEvents,
      config: {},
      coordinator: mockCoordinator,
    });
  });

  it('exposes interfaces', () => {
    const ifaces = bundle.interfaces();
    assert.equal(typeof ifaces, 'object');
  });

  it('exposes routes', () => {
    const routes = bundle.routes();
    assert.equal(typeof routes, 'object');
  });
});
`);

  addToMountPlan(name, appDir);

  console.log();
  success(`Bundle ${chalk.cyan(name)} created at bundles/${name}/`);
  console.log();
  for (const f of ['manifest.yml', 'logic.js', 'seeds.js', 'agent.md', 'package.json', 'ui/', 'test/']) fileCreated(f);
  console.log();
  info('Next steps:');
  info(`  1. Define your schema tables in ${chalk.cyan('manifest.yml')}`);
  info(`  2. Implement route handlers in ${chalk.cyan('logic.js')}`);
  info(`  3. Add seed data in ${chalk.cyan('seeds.js')}`);
  info(`  4. Add UI views in ${chalk.cyan('ui/')}`);
  console.log();
  return 0;
}

// ── From-manifest generator ───────────────────────────────────────────────

async function generateFromManifest(manifestPath) {
  if (!manifestPath || !existsSync(manifestPath)) {
    console.error('Usage: torque generate from-manifest <path/to/manifest.yml>');
    return 1;
  }

  const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
  const className = manifest.class || manifest.name.charAt(0).toUpperCase() + manifest.name.slice(1);
  const bundleDir = manifestPath.replace(/\/manifest\.yml$/, '');
  const contracts = manifest.interfaces?.contracts || {};

  let code = `export default class ${className} {\n`;
  code += `  constructor({ data, events, config, coordinator }) {\n`;
  code += `    this.data = data; this.events = events; this.config = config; this.coordinator = coordinator;\n  }\n\n`;

  const ifaceEntries = Object.entries(contracts);
  if (ifaceEntries.length > 0) {
    code += `  interfaces() {\n    return {\n`;
    for (const [name] of ifaceEntries) {
      const inputKeys = Object.keys(contracts[name].input || {});
      code += `      ${name}: (${inputKeys.length ? `{ ${inputKeys.join(', ')} }` : '{}'}) => this.${name}(${inputKeys.join(', ')}),\n`;
    }
    code += `    };\n  }\n\n`;

    for (const [name, def] of ifaceEntries) {
      const inputKeys = Object.keys(def.input || {});
      code += `  ${name}(${inputKeys.join(', ')}) {\n`;
      code += `    // TODO: implement\n`;
      if (def.output?.shape) code += `    // Output: ${JSON.stringify(def.output.shape)}\n`;
      if (def.errors?.length) code += `    // Errors: ${def.errors.map(e => e.code).join(', ')}\n`;
      if (def.side_effects?.length) {
        for (const fx of def.side_effects) {
          if (fx.publishes) code += `    // this.events.publish('${fx.publishes}', { ... });\n`;
        }
      }
      code += `    throw new Error('Not implemented: ${name}');\n  }\n\n`;
    }
  } else {
    code += `  interfaces() { return {}; }\n\n`;
  }

  code += `  routes() { return {}; }\n\n`;
  code += `  setupSubscriptions(eventBus) {\n`;
  for (const e of manifest.events?.subscribes || []) {
    code += `    eventBus.subscribe('${e}', '${manifest.name}', (payload) => { /* TODO */ });\n`;
  }
  code += `  }\n}\n`;

  // --ai flag: use Claude to generate a full logic.js implementation
  if (hasFlag('--ai')) {
    if (!isAIAvailable()) {
      console.error('AI features require ANTHROPIC_API_KEY.');
      console.error('Set it up: export ANTHROPIC_API_KEY=sk-ant-...');
      return 1;
    }

    try {
      const appDir = resolve(process.cwd());
      const systemPrompt = await getSystemPrompt(appDir);
      const manifestContent = readFileSync(manifestPath, 'utf8');
      const aiPrompt = `Given this Torque bundle manifest:\n\n${manifestContent}\n\nGenerate a complete logic.js implementation for this bundle. Follow the Torque bundle conventions: export default class with constructor({ data, events, config, coordinator }), interfaces(), routes(), and setupSubscriptions(eventBus) methods. Include full working implementations, not just TODOs.`;

      console.log('Generating AI-powered logic implementation...');
      const result = await callClaude(aiPrompt, { systemPrompt, maxTurns: 5 });

      // Extract code block if wrapped in markdown
      const codeMatch = result.match(/```(?:js|javascript)?\n([\s\S]*?)```/);
      const aiCode = codeMatch ? codeMatch[1] : result;

      const aiPath = join(bundleDir, 'logic.ai-generated.js');
      writeFileSync(aiPath, aiCode);
      console.log(`AI-generated implementation saved to ${aiPath}`);
      console.log('Review and copy to logic.js when ready.');
      return 0;
    } catch (err) {
      console.error('AI error: ' + err.message);
      return 1;
    }
  }

  const logicPath = join(bundleDir, 'logic.js');
  if (existsSync(logicPath)) {
    const genPath = join(bundleDir, 'logic.generated.js');
    writeFileSync(genPath, code);
    console.log(`logic.js exists. Generated code saved to ${genPath}`);
  } else {
    writeFileSync(logicPath, code);
    console.log(`Generated ${logicPath}`);
  }
  return 0;
}

// ── Seed generator ────────────────────────────────────────────────────────

function generateSeed(bundleName) {
  if (!bundleName) {
    console.error('Usage: torque generate seed <bundle>');
    return 1;
  }

  const appDir = resolve(process.cwd());
  const manifestPath = join(appDir, 'bundles', bundleName, 'manifest.yml');

  if (!existsSync(manifestPath)) {
    console.error(`Bundle manifest not found at ${manifestPath}`);
    return 1;
  }

  const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
  const seedCode = buildSeedJs(bundleName, manifest);

  const seedsDir = join(appDir, 'seeds');
  mkdirSync(seedsDir, { recursive: true });

  const seedPath = join(seedsDir, `${bundleName}.js`);
  writeFileSync(seedPath, seedCode);
  console.log(`Generated seed script at ${seedPath}`);
  return 0;
}

// ── Tests generator ───────────────────────────────────────────────────────

function generateTests(manifestPath) {
  if (!manifestPath || !existsSync(manifestPath)) {
    console.error('Usage: torque generate tests <path/to/manifest.yml>');
    return 1;
  }

  const manifest = yaml.load(readFileSync(manifestPath, 'utf8'));
  const behaviors = manifest.specs || manifest.behaviors || [];
  const bundleDir = manifestPath.replace(/\/manifest\.yml$/, '');

  if (behaviors.length === 0) {
    console.log('No specs declared in manifest.');
    return 0;
  }

  let code = `import { describe, it } from 'node:test';\nimport assert from 'node:assert/strict';\n\n`;
  code += `describe('${manifest.name} specs', () => {\n`;

  for (const b of behaviors) {
    code += `\n  it('${b.name}', () => {\n`;
    if (b.given) for (const g of b.given) code += `    // GIVEN: ${g}\n`;
    if (b.when) for (const w of b.when) {
      if (w.call) code += `    // WHEN: ${w.call}(${JSON.stringify(w.with || {})})\n`;
    }
    if (b.then) for (const t of b.then) {
      if (typeof t === 'string') code += `    // THEN: ${t}\n`;
      else if (t.event) code += `    // THEN: event '${t.event}' published\n`;
    }
    code += `    // TODO: implement test\n    assert.ok(true);\n  });\n`;
  }

  code += `});\n`;

  const testDir = join(bundleDir, 'test');
  mkdirSync(testDir, { recursive: true });
  const testPath = join(testDir, `${manifest.name}.specs.test.js`);
  writeFileSync(testPath, code);
  console.log(`Generated ${behaviors.length} spec tests at ${testPath}`);
  return 0;
}

// ── View generator ────────────────────────────────────────────────────────

function generateView(viewName) {
  if (!viewName) {
    console.error('Usage: torque generate view <ViewName>');
    console.error('  e.g. torque generate view DashboardPage');
    console.error('  --route <path>   Route path (default: /<kebab-name>)');
    return 1;
  }

  const routePath = parseFlag('--route') ||
    '/' + viewName.replace(/([A-Z])/g, (m, c, i) => (i ? '-' : '') + c.toLowerCase()).replace(/^-/, '');

  const appDir = resolve(process.cwd());
  const viewsDir = join(appDir, 'ui', 'views');
  const viewFile = join(viewsDir, `${viewName}.js`);

  if (existsSync(viewFile)) {
    console.error(`View '${viewName}' already exists at ${viewFile}`);
    return 1;
  }

  mkdirSync(viewsDir, { recursive: true });

  writeFileSync(viewFile, `import { Stack, Text, Card, Button, Spinner } from './ui-kit.js';

/**
 * ${viewName} — app-level view override.
 * Route: ${routePath}
 *
 * This view is loaded by the shell at ${routePath}.
 * It receives { data, actions } from the shell framework:
 *   - data: fetched from the fetchUrls defined in the mount plan
 *   - actions.api(url, opts): make authenticated API calls
 *   - actions.navigate(path): client-side navigation
 *   - actions.refresh(): re-fetch data
 */
export default function ${viewName}({ data, actions }) {
  if (!data) return Spinner({});

  return Stack({ spacing: 3, sx: { p: 3, maxWidth: 900, mx: 'auto' } }, [
    Text({ variant: 'h4', content: '${viewName.replace(/([A-Z])/g, ' $1').trim()}' }),

    Card({ sx: { p: 2 } }, [
      Text({ content: 'Replace this with your view content.', variant: 'body1' }),
    ]),
  ]);
}
`);

  // Create ui-kit.js if not present
  const uiKitPath = join(viewsDir, 'ui-kit.js');
  if (!existsSync(uiKitPath)) {
    writeFileSync(uiKitPath, buildUiKit());
  }

  console.log();
  success(`View ${chalk.cyan(viewName)} created`);
  fileCreated(`ui/views/${viewName}.js`);
  console.log();
  info(`Route: ${chalk.cyan(routePath)}`);
  info('Add to your mount plan or boot.js to activate this view.');
  console.log();
  return 0;
}

// ── Intent generator ───────────────────────────────────────────────────────

function generateIntent(bundleName, intentName) {
  if (!bundleName || !intentName) {
    console.error('Usage: torque generate intent <bundle> <intentName>');
    return 1;
  }

  const appDir = resolve(process.cwd());
  const dir = join(appDir, 'bundles', bundleName, 'intents', intentName);

  if (existsSync(dir)) {
    console.error(`Intent '${intentName}' already exists in bundle '${bundleName}'`);
    return 1;
  }

  mkdirSync(dir, { recursive: true });

  const className = toClassName(intentName);

  writeFileSync(join(dir, 'context.js'), `import { Context } from '@torquedev/core';

export const ${className}Context = new Context('${className}', {
  schema: {
    state: 'string', // e.g. 'pending', 'resolved'
  },
  vectorize: ['state'] // Data layer automatically semantic-indexes these fields
});
`);

  writeFileSync(join(dir, 'behavior.js'), `import { Behavior } from '@torquedev/core';

export const ${className}Behavior = new Behavior({
  persona: 'You are concise and focused on achieving the intent.',
  allowedTools: ['${bundleName}.query'],
  requireHumanConfirmation: [],
});
`);

  writeFileSync(join(dir, 'intent.js'), `import { Intent } from '@torquedev/core';
import { ${className}Behavior } from './behavior.js';

export const ${className}Intent = new Intent({
  name: '${intentName}',
  description: 'Describe the goal of this intent',
  trigger: 'Natural language or system event that triggers this',
  successCriteria: [
    'Condition 1 is met',
    'Condition 2 is satisfied'
  ],
  behavior: ${className}Behavior
});
`);

  // Patch manifest.yml to add intentName to intents array
  try {
    const manifestPath = join(appDir, 'bundles', bundleName, 'manifest.yml');
    if (existsSync(manifestPath)) {
      const manifestContent = readFileSync(manifestPath, 'utf8');
      const manifest = yaml.load(manifestContent) || {};
      if (!manifest.intents) manifest.intents = [];
      if (!manifest.intents.includes(intentName)) {
        manifest.intents.push(intentName);
        writeFileSync(manifestPath, yaml.dump(manifest, { lineWidth: -1, quotingType: '"', noRefs: true }));
      }
    }
  } catch (err) {
    console.warn(`Warning: could not patch manifest.yml: ${err.message}`);
  }

  console.log(`Created Intent triplet '${intentName}' in ${dir}/`);
  return 0;
}
