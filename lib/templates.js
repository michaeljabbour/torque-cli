import { readdirSync, readFileSync, existsSync, cpSync } from 'node:fs';
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
  // NOTE: Do NOT pre-create .bundles/<name>/ directories here.
  // The git resolver in @torquedev/core checks if .bundles/<name>/ exists:
  //   - If missing → git clone (correct)
  //   - If present → git fetch (fails if not a proper git clone)
  // Pre-creating these directories breaks the first boot. The global seeds/index.js
  // handles all seeding for templates without needing per-bundle seeds pre-copied.
  //
  // Copy config overrides
  const configFile = join(template.dir, 'config', 'app.js');
  if (existsSync(configFile)) {
    cpSync(configFile, join(appDir, 'config', 'app.js'));
  }
}
