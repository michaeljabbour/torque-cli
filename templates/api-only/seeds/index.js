/**
 * Seed script for api-only template (pipeline + tasks, no UI shell).
 * Usage: torque seed  OR  node seeds/index.js
 *
 * Creates 1 demo user, 2 sample deals, 2 sample tasks.
 */
import { boot } from '@torquedev/core/boot';

const { registry } = await boot({
  plan: 'config/mount_plans/development.yml',
  db: process.env.DB_PATH || 'data/dev.sqlite3',
  serve: false,
  silent: true,
});

const iam = registry.bundleInstance('identity');
const pipeline = registry.bundleInstance('pipeline');
const tasks = registry.bundleInstance('tasks');

console.log('Seeding api-only app...\n');

const ctx = (user) => (body = {}, params = {}) => ({ body, params, currentUser: user, query: {} });

// ── 1. Demo user ──────────────────────────────────────────────────────────────

console.log('1. Creating demo user...');
let user;
try {
  const result = iam.routes().signUp({ body: { email: 'demo@example.com', password: 'demo1234', name: 'Demo User' } });
  user = result.data.user;
} catch (e) {
  console.error(`Failed to create demo user: ${e.message}`);
  process.exit(1);
}
console.log('   demo@example.com (pwd: demo1234)');

const as1 = ctx(user);

// ── 2. Sample deals ───────────────────────────────────────────────────────────

console.log('\n2. Creating sample deals...');
const pr = pipeline.routes();

for (const deal of [
  { name: 'Sample Deal A', value: 10000, stage: 'lead' },
  { name: 'Sample Deal B', value: 25000, stage: 'qualified' },
]) {
  try {
    pr.createDeal(as1({ name: deal.name, value: deal.value, stage: deal.stage }));
    console.log(`   ${deal.name} — $${deal.value} (${deal.stage})`);
  } catch (e) { console.log(`   (skipped deal ${deal.name}: ${e.message})`); }
}

// ── 3. Sample tasks ───────────────────────────────────────────────────────────

console.log('\n3. Creating sample tasks...');
const tr = tasks.routes();

for (const task of [
  { title: 'Review API documentation', priority: 'high' },
  { title: 'Set up webhook endpoints', priority: 'medium' },
]) {
  try {
    tr.createTask(as1({ title: task.title, priority: task.priority }));
    console.log(`   ${task.title} (${task.priority})`);
  } catch (e) { console.log(`   (skipped task ${task.title}: ${e.message})`); }
}

console.log('\n========================================');
console.log('Seed complete!');
console.log('========================================');
console.log('\nSign in: demo@example.com / demo1234');
console.log('========================================');

process.exit(0);
