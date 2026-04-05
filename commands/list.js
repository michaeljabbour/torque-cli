import { findWorkspace } from '../lib/workspace.js';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

export default async function list() {
  const ws = findWorkspace();
  const resource = process.argv[3] || 'all';
  const foundationDir = join(ws, 'torque-foundation');

  if (resource === 'all' || resource === 'behaviors') {
    const dir = join(foundationDir, 'behaviors');
    const behaviors = existsSync(dir)
      ? readdirSync(dir).filter(f => f.endsWith('.yaml')).map(f => yaml.load(readFileSync(join(dir, f), 'utf8')))
      : [];
    console.log(`\nBehaviors (${behaviors.length}):`);
    for (const b of behaviors) console.log(`  ${(b.name || 'unnamed').padEnd(20)} ${b.description || ''}`);
  }

  if (resource === 'all' || resource === 'context') {
    const dir = join(foundationDir, 'context');
    const files = [];
    if (existsSync(dir)) {
      for (const f of readdirSync(dir).filter(f => f.endsWith('.md'))) {
        files.push(f);
      }
    }
    console.log(`\nContext files (${files.length}):`);
    for (const f of files) console.log(`  ${join('context', f)}`);
  }

  if (resource === 'all' || resource === 'agents') {
    const agents = [];
    // Foundation agents
    const agentDir = join(foundationDir, 'agents');
    if (existsSync(agentDir)) {
      for (const f of readdirSync(agentDir).filter(f => f.endsWith('.md'))) {
        const raw = readFileSync(join(agentDir, f), 'utf8');
        const fm = raw.match(/^---\n([\s\S]*?)\n---/);
        const meta = fm ? yaml.load(fm[1]).meta || {} : {};
        agents.push({ ...meta, source: 'foundation' });
      }
    }
    // Bundle agents
    for (const d of readdirSync(ws).filter(d => d.startsWith('torque-bundle-'))) {
      const agentPath = join(ws, d, 'agent.md');
      if (!existsSync(agentPath)) continue;
      const raw = readFileSync(agentPath, 'utf8');
      const fm = raw.match(/^---\n([\s\S]*?)\n---/);
      const meta = fm ? yaml.load(fm[1]).meta || {} : {};
      agents.push({ ...meta, source: d.replace('torque-bundle-', '') });
    }
    console.log(`\nAgents (${agents.length}):`);
    for (const a of agents) {
      const modes = a.modes?.map(m => m.name).join(', ') || 'none';
      console.log(`  ${(a.name || 'unnamed').padEnd(22)} [${a.source}] ${(a.description || '').slice(0, 60)}`);
      if (a.modes) console.log(`    Modes: ${modes}`);
    }
  }

  if (resource === 'all' || resource === 'recipes') {
    const dir = join(foundationDir, 'recipes');
    const recipes = existsSync(dir)
      ? readdirSync(dir).filter(f => f.endsWith('.yaml')).map(f => yaml.load(readFileSync(join(dir, f), 'utf8')))
      : [];
    console.log(`\nRecipes (${recipes.length}):`);
    for (const r of recipes) console.log(`  ${(r.name || 'unnamed').padEnd(25)} ${r.steps?.length || 0} steps — ${r.description || ''}`);
  }

  if (resource === 'all' || resource === 'skills') {
    const dir = join(foundationDir, 'skills');
    const skills = [];
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillPath = join(dir, entry.name, 'SKILL.md');
        if (!existsSync(skillPath)) continue;
        const raw = readFileSync(skillPath, 'utf8');
        const fm = raw.match(/^---\n([\s\S]*?)\n---/);
        const meta = fm ? yaml.load(fm[1]) : {};
        skills.push(meta);
      }
    }
    console.log(`\nSkills (${skills.length}):`);
    for (const s of skills) {
      console.log(`  ${(s.name || 'unnamed').padEnd(22)} ${s.description || ''}`);
      if (s.trigger) console.log(`    Trigger: ${s.trigger}`);
    }
  }

  console.log();
  return 0;
}
