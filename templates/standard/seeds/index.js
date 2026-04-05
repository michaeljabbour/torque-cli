/**
 * Seed script for standard template (pipeline + pulse + tasks).
 * Usage: torque seed  OR  node seeds/index.js
 *
 * Creates 2 users, 4 pipeline deals, moves deals through stages,
 * creates 5 tasks with priorities and due dates.
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

console.log('Seeding standard app...\n');

const ctx = (user) => (body = {}, params = {}) => ({ body, params, currentUser: user, query: {} });
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); }

// ── 1. Users ──────────────────────────────────────────────────────────────────

console.log('1. Creating users...');
const users = [];
for (const u of [
  { email: 'admin@example.com', name: 'Admin', bio: 'Account admin' },
  { email: 'sales@example.com', name: 'Sales Rep', bio: 'Sales team' },
]) {
  try {
    const s = iam.routes().signUp({ body: { email: u.email, password: 'demo1234', name: u.name } });
    users.push(s.data.user);
    console.log(`   ${u.email} (pwd: demo1234)`);
    try {
      iam.routes().updateProfile({ body: { display_name: u.name, bio: u.bio }, currentUser: s.data.user });
    } catch { /* profile update is optional — ignore */ }
  } catch (e) { console.error(`Failed to create user ${u.email}: ${e.message}`); process.exit(1); }
}

const as1 = ctx(users[0]);
const as2 = ctx(users[1]);

// ── 2. Pipeline deals ─────────────────────────────────────────────────────────

console.log('\n2. Creating pipeline deals...');
const pr = pipeline.routes();

const deals = [
  { name: 'Acme Corp', value: 50000, stage: 'qualified' },
  { name: 'Globex Industries', value: 120000, stage: 'proposal' },
  { name: 'Initech Solutions', value: 75000, stage: 'negotiation' },
  { name: 'Umbrella Ltd', value: 200000, stage: 'closed_won' },
];

const createdDeals = [];
for (const deal of deals) {
  try {
    const r = pr.createDeal(as1({ name: deal.name, value: deal.value, stage: deal.stage }));
    createdDeals.push(r.data);
    console.log(`   ${deal.name} — $${deal.value} (${deal.stage})`);
  } catch (e) { console.log(`   (skipped deal ${deal.name}: ${e.message})`); }
}

// ── 3. Tasks ──────────────────────────────────────────────────────────────────

console.log('\n3. Creating tasks...');
const tr = tasks.routes();

const taskList = [
  { title: 'Follow up with Acme Corp', priority: 'high', due: daysFromNow(2) },
  { title: 'Send Globex proposal', priority: 'high', due: daysFromNow(3) },
  { title: 'Schedule Initech demo', priority: 'medium', due: daysFromNow(5) },
  { title: 'Prepare Q2 pipeline report', priority: 'medium', due: daysFromNow(7) },
  { title: 'Update CRM records', priority: 'low', due: daysFromNow(14) },
];

for (const task of taskList) {
  try {
    tr.createTask(as1({ title: task.title, priority: task.priority, due_date: task.due }));
    console.log(`   ${task.title} (${task.priority})`);
  } catch (e) { console.log(`   (skipped task ${task.title}: ${e.message})`); }
}

console.log('\n========================================');
console.log('Seed complete!');
console.log('========================================');
console.log('\nSign in: admin@example.com / demo1234');
console.log('  Also: sales@example.com / demo1234');
console.log('========================================');

process.exit(0);
