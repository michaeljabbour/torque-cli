import { readdirSync, readFileSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(__dirname, '..', 'templates');

export function listTemplates() {
  if (!existsSync(templatesDir)) return [];
  return readdirSync(templatesDir)
    .filter(d => existsSync(join(templatesDir, d, 'template.json')))
    .map(d => {
      const meta = JSON.parse(readFileSync(join(templatesDir, d, 'template.json'), 'utf8'));
      return { name: d, ...meta };
    });
}

export function getTemplate(name) {
  const dir = join(templatesDir, name);
  if (!existsSync(join(dir, 'template.json'))) return null;
  const meta = JSON.parse(readFileSync(join(dir, 'template.json'), 'utf8'));
  return { dir, ...meta };
}

export function applyTemplate(appDir, template) {
  // Bundles are resolved from git sources at boot time — no local copy needed.
  // Copy seeds
  const seedsDir = join(template.dir, 'seeds');
  if (existsSync(seedsDir)) {
    cpSync(seedsDir, join(appDir, 'seeds'), { recursive: true });
  }
  // Copy per-bundle seeds into .bundles/ (they'll be available after first boot resolves git bundles)
  const templateBundlesDir = join(template.dir, 'bundles');
  if (existsSync(templateBundlesDir)) {
    const bundleDirs = readdirSync(templateBundlesDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
    for (const bd of bundleDirs) {
      const seedFile = join(templateBundlesDir, bd.name, 'seeds.js');
      if (existsSync(seedFile)) {
        const destDir = join(appDir, '.bundles', bd.name);
        mkdirSync(destDir, { recursive: true });
        cpSync(seedFile, join(destDir, 'seeds.js'));
      }
    }
  }
  // Copy config overrides
  const configFile = join(template.dir, 'config', 'app.js');
  if (existsSync(configFile)) {
    cpSync(configFile, join(appDir, 'config', 'app.js'));
  }
}
