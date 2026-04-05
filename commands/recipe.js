import { findWorkspace } from '../lib/workspace.js';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export default async function recipe() {
  const ws = findWorkspace();
  const sub = process.argv[3];
  const arg3 = process.argv[4];

  const recipeDirs = [
    join(ws, 'torque-foundation', 'recipes'),
  ];

  function discoverRecipes() {
    const recipes = [];
    for (const dir of recipeDirs) {
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))) {
        const recipe = yaml.load(readFileSync(join(dir, f), 'utf8'));
        recipe._file = join(dir, f);
        recipes.push(recipe);
      }
    }
    return recipes;
  }

  if (sub === 'list' || !sub) {
    const recipes = discoverRecipes();
    if (recipes.length === 0) { console.log('No recipes found.'); return 0; }
    console.log('Available recipes:\n');
    for (const r of recipes) {
      console.log(`  ${(r.name || 'unnamed').padEnd(25)} ${r.steps?.length || 0} steps — ${r.description || ''}`);
    }
    return 0;
  }

  if (sub === 'execute' || sub === 'run') {
    if (!arg3) { console.error('Usage: torque recipe execute <name>'); return 1; }
    const recipes = discoverRecipes();
    const recipe = recipes.find(r => r.name === arg3);
    if (!recipe) { console.error(`Recipe '${arg3}' not found. Run 'torque recipe list'.`); return 1; }

    // Parse context vars from remaining args
    const context = {};
    for (let i = 5; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg.includes('=')) { const [k, v] = arg.split('='); context[k] = v; }
    }

    console.log(`\n[recipe] Executing: ${recipe.name}`);
    console.log(`[recipe] Steps: ${recipe.steps.length}\n`);

    for (let i = 0; i < recipe.steps.length; i++) {
      const step = recipe.steps[i];
      console.log(`[recipe] Step ${i + 1}/${recipe.steps.length}: ${step.name}`);
      if (step.action) {
        const action = step.action.replace(/\$\{(\w+)\}/g, (_, k) => context[k] ?? `\${${k}}`);
        console.log(`[recipe]   Action: ${action}`);
      } else if (step.prompt) {
        const prompt = step.prompt.replace(/\$\{(\w+)\}/g, (_, k) => context[k] ?? `\${${k}}`);
        console.log(`[recipe]   Prompt: ${prompt}`);
      }
      if (step.approval) {
        console.log(`[recipe]   Approval: ${step.approval}`);
        if (!process.argv.includes('--auto-approve')) break;
      }
      console.log(`[recipe]   Done`);
    }
    console.log(`\n[recipe] Complete`);
    return 0;
  }

  console.log('Usage: torque recipe <list|execute> [name] [key=value...]');
  return 1;
}
