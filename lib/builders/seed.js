export function buildSeedJs(name, manifest) {
  const tables = manifest.schema?.tables || {};
  const tableNames = Object.keys(tables);

  // Gather fields from the first table (primary entity)
  const primaryTable = tableNames[0] || 'items';
  const columns = tables[primaryTable]?.columns || {};

  // Build sample data generation for each field
  const fieldEntries = Object.entries(columns).filter(
    ([col]) => col !== 'id' && col !== 'created_at' && col !== 'updated_at'
  );

  function sampleValue(colName, colDef, index) {
    const type = colDef.type || 'string';
    if (colName.endsWith('_id') && type === 'uuid') return `'parent-id-${index}'`;
    if (type === 'uuid') return `'sample-uuid-${index}'`;
    if (type === 'string' || type === 'text') return `'Sample ${colName} ${index}'`;
    if (type === 'integer' || type === 'float') return `Math.floor(Math.random() * 100) + 1`;
    if (type === 'boolean') return `${index % 2 === 0 ? 'true' : 'false'}`;
    if (type === 'timestamp') return `new Date().toISOString()`;
    return `'sample-${index}'`;
  }

  // Build the 5 sample rows
  const rows = [];
  for (let i = 1; i <= 5; i++) {
    const obj = fieldEntries
      .map(([col, def]) => `    ${col}: ${sampleValue(col, def, i)}`)
      .join(',\n');
    rows.push(`  {\n${obj},\n  }`);
  }

  // Determine which route handler to use for creating
  const routes = manifest.api?.routes || [];
  const createRoute = routes.find(r => r.handler === 'create');
  const hasCreate = !!createRoute;

  const capName = name.charAt(0).toUpperCase() + name.slice(1);

  return `/**
 * Seed script for ${name} bundle.
 * Usage: node seeds/${name}.js
 */
import { boot } from '@torquedev/core/boot';

const { registry } = await boot({
  plan: 'config/mount_plans/development.yml',
  db: process.env.DB_PATH || 'data/dev.sqlite3',
  serve: false,
  silent: true,
});

const ${name} = registry.bundleInstance('${name}');

console.log('Seeding ${name}...');

const sampleData = [
${rows.join(',\n')},
];

const ctx = (body) => ({ body, params: {}, currentUser: { id: 'seed-user' }, query: {} });

for (const item of sampleData) {
${hasCreate ? `  const result = ${name}.routes().create(ctx(item));
  console.log('  Created:', result.data?.id || result.data);` : `  console.log('  Item:', item);`}
}

console.log('Done! Seeded ${name} with ' + sampleData.length + ' items.');
process.exit(0);
`;
}

/**
 * Build a per-bundle seeds.js that sits inside the bundle directory.
 * This is the Torque convention: bundles/<name>/seeds.js exports an async function
 * that receives { routes, registry, data } and creates demo data.
 */
export function buildBundleSeedJs(name, fields) {
  const capName = name.charAt(0).toUpperCase() + name.slice(1);

  // Generate realistic sample data based on field names/types
  const sampleRows = [];
  for (let i = 1; i <= 5; i++) {
    const row = fields.map(f => {
      const val = _smartSampleValue(f.name, f.type, i);
      return `      ${f.name}: ${val}`;
    }).join(',\n');
    sampleRows.push(`    {\n${row},\n    }`);
  }

  return `/**
 * Seeds for ${name} bundle.
 * Called by: torque seed (in dependency order)
 */
export default async function seed({ routes, registry, data }) {
  console.log('  Seeding ${name}...');

  const r = routes();
  const ctx = (body) => ({ body, params: {}, currentUser: { id: 'seed-user' }, query: {} });

  const items = [
${sampleRows.join(',\n')},
  ];

  for (const item of items) {
    r.create(ctx(item));
  }

  console.log('    Created ' + items.length + ' ${name} items');
}
`;
}

function _smartSampleValue(fieldName, type, index) {
  // Try to generate realistic values based on common field name patterns
  const lower = fieldName.toLowerCase();

  if (type === 'boolean') {
    if (lower.includes('completed') || lower.includes('done') || lower.includes('archived')) {
      return index <= 2 ? 'true' : 'false';
    }
    if (lower.includes('active') || lower.includes('enabled') || lower.includes('visible')) {
      return index <= 4 ? 'true' : 'false';
    }
    return index % 2 === 0 ? 'true' : 'false';
  }

  if (type === 'integer' || type === 'float') {
    if (lower.includes('priority')) return `${index}`;
    if (lower.includes('pos') || lower.includes('position') || lower.includes('order')) return `${index * 65536}`;
    if (lower.includes('count') || lower.includes('quantity')) return `${index * 3}`;
    if (lower.includes('price') || lower.includes('amount')) return `${(index * 19.99).toFixed(2)}`;
    return `${index * 10}`;
  }

  if (type === 'timestamp') {
    return `new Date(Date.now() - ${index} * 86400000).toISOString()`;
  }

  // String/text fields — use name-aware sample values
  const samples = {
    title: [`'Setup project'`, `'Add authentication'`, `'Design dashboard'`, `'Write tests'`, `'Deploy to production'`],
    name: [`'Alpha'`, `'Beta'`, `'Gamma'`, `'Delta'`, `'Epsilon'`],
    description: [`'Initial setup and configuration'`, `'User auth with JWT tokens'`, `'Main dashboard layout'`, `'Unit and integration tests'`, `'Production deployment pipeline'`],
    status: [`'active'`, `'active'`, `'pending'`, `'completed'`, `'archived'`],
    email: [`'alice@example.com'`, `'bob@example.com'`, `'carol@example.com'`, `'dave@example.com'`, `'eve@example.com'`],
    color: [`'#3b82f6'`, `'#ef4444'`, `'#22c55e'`, `'#f59e0b'`, `'#8b5cf6'`],
    url: [`'https://example.com/1'`, `'https://example.com/2'`, `'https://example.com/3'`, `'https://example.com/4'`, `'https://example.com/5'`],
    category: [`'Engineering'`, `'Design'`, `'Marketing'`, `'Operations'`, `'Sales'`],
    type: [`'task'`, `'bug'`, `'feature'`, `'improvement'`, `'chore'`],
    label: [`'Frontend'`, `'Backend'`, `'DevOps'`, `'Design'`, `'QA'`],
  };

  for (const [pattern, values] of Object.entries(samples)) {
    if (lower.includes(pattern)) return values[index - 1] || values[0];
  }

  return `'${capFirst(fieldName)} ${index}'`;
}

function capFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_([a-z])/g, (_, c) => ' ' + c.toUpperCase());
}
