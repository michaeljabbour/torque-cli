/**
 * Seed script for minimal template (identity only).
 * Usage: torque seed  OR  node seeds/index.js
 *
 * Creates one demo user for the simplest possible Torque app.
 */
import { boot } from '@torquedev/core/boot';

const { registry } = await boot({
  plan: 'config/mount_plans/development.yml',
  db: process.env.DB_PATH || 'data/dev.sqlite3',
  serve: false,
  silent: true,
});

const iam = registry.bundleInstance('identity');

console.log('Seeding minimal app...\n');

// ── Demo user ──────────────────────────────────────────────────────────────────

console.log('Creating demo user...');
const result = iam.routes().signUp({
  body: { email: 'admin@example.com', password: 'demo1234', name: 'Admin' },
});
console.log(`   admin@example.com (pwd: demo1234)`);

console.log('\n========================================');
console.log('Seed complete!');
console.log('========================================');
console.log('\nSign in: admin@example.com / demo1234');
console.log('========================================');

process.exit(0);
