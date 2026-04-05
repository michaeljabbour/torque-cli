/**
 * Seed script for kanban template (4 consolidated bundles).
 * Usage: torque seed  OR  node seeds/index.js
 *
 * This is the global seed — it runs when per-bundle seeds.js are not found.
 * Prefer per-bundle seeds (bundles/<name>/seeds.js) for modular seeding.
 */
import { boot } from '@torquedev/core/boot';

const { registry } = await boot({
  plan: 'config/mount_plans/development.yml',
  db: process.env.DB_PATH || 'data/dev.sqlite3',
  serve: false,
  silent: true,
});

const iam = registry.bundleInstance('iam');
const kanban = registry.bundleInstance('kanban-app');
const activity = registry.bundleInstance('activity-app');
const search = registry.bundleInstance('search-app');

console.log('Seeding kanban app...\n');

const ctx = (user) => (body = {}, params = {}) => ({ body, params, currentUser: user, query: {} });
function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); }

// ── 1. Users ────────────────────────────────────────────────────────────

console.log('1. Creating users...');
const users = [];
for (const u of [
  { email: 'mj@torque.dev', name: 'MJ', bio: 'Platform lead' },
  { email: 'sarah@torque.dev', name: 'Sarah Chen', bio: 'Frontend engineer' },
  { email: 'raj@torque.dev', name: 'Raj Patel', bio: 'Backend engineer' },
  { email: 'kim@torque.dev', name: 'Kim Lee', bio: 'DevOps engineer' },
]) {
  const s = iam.routes().signUp({ body: { email: u.email, password: 'demo1234', name: u.name } });
  users.push(s.data.user);
  console.log(`   ${u.email} (pwd: demo1234)`);
  try { iam.routes().updateProfile({ body: { display_name: u.name, bio: u.bio }, currentUser: s.data.user }); } catch {}
}

const as1 = ctx(users[0]);
const as2 = ctx(users[1]);

// Roles
try {
  const allRoles = iam.routes().listRoles({ currentUser: users[0] });
  const superAdmin = allRoles.data?.find(r => r.name === 'super-admin');
  const memberRole = allRoles.data?.find(r => r.name === 'member');
  if (superAdmin) iam.routes().assignRole({ params: { userId: users[0].id }, body: { role_id: superAdmin.id }, currentUser: users[0] });
  for (const u of users.slice(1)) {
    if (memberRole) iam.routes().assignRole({ params: { userId: u.id }, body: { role_id: memberRole.id }, currentUser: users[0] });
  }
} catch (e) { console.log('   (roles skipped:', e.message, ')'); }

// Teams
try {
  const t1 = iam.routes().createTeam(as1({ name: 'Platform Team', description: 'Core platform engineering' }));
  if (t1.data?.id) {
    iam.routes().addTeamMember(as1({ userId: users[1].id }, { teamId: t1.data.id }));
    iam.routes().addTeamMember(as1({ userId: users[2].id }, { teamId: t1.data.id }));
  }
  const t2 = iam.routes().createTeam(as1({ name: 'DevOps Team', description: 'Infrastructure and deployment' }));
  if (t2.data?.id) {
    iam.routes().addTeamMember(as1({ userId: users[3].id }, { teamId: t2.data.id }));
  }
  console.log('   2 teams created');
} catch {}

// ── 2. Workspaces & Boards ──────────────────────────────────────────────

console.log('\n2. Workspace: Torque Core');
const kr = kanban.routes();

try {
  const ws1 = kr.create(as1({ name: 'Torque Core', description: 'Core framework development' }));
  const ws1Id = ws1.data.id;
  try { kr.invite(as1({ email: users[1].email }, { workspaceId: ws1Id })); } catch {}
  try { kr.invite(as1({ email: users[2].email }, { workspaceId: ws1Id })); } catch {}

  // Board: Platform Sprint Q2
  console.log('   Board: Platform Sprint Q2');
  const b1 = kr.createBoard(as1({ name: 'Platform Sprint Q2' }, { workspaceId: ws1Id }));
  const b1Id = b1.data.id;

  const backlog = kr.createList(as1({ name: 'Backlog' }, { boardId: b1Id }));
  const sprint = kr.createList(as1({ name: 'Sprint 23' }, { boardId: b1Id }));
  const review = kr.createList(as1({ name: 'In Review' }, { boardId: b1Id }));
  const done = kr.createList(as1({ name: 'Done' }, { boardId: b1Id }));

  const lFE = kr.createLabel(as1({ name: 'Frontend', color: '#6EE7B7' }, { boardId: b1Id }));
  const lBE = kr.createLabel(as1({ name: 'Backend', color: '#93C5FD' }, { boardId: b1Id }));
  const lBug = kr.createLabel(as1({ name: 'Bug', color: '#FCA5A5' }, { boardId: b1Id }));
  const lInfra = kr.createLabel(as1({ name: 'Infra', color: '#FDBA74' }, { boardId: b1Id }));
  const lCLI = kr.createLabel(as1({ name: 'CLI', color: '#C4B5FD' }, { boardId: b1Id }));
  const lDesign = kr.createLabel(as1({ name: 'Design', color: '#F9A8D4' }, { boardId: b1Id }));

  const cards = [
    { name: 'Migrate auth to OAuth2', desc: 'Replace JWT-only flow with OIDC', list: backlog, labels: [lBE, lInfra] },
    { name: 'Database connection pooling', desc: 'Implement connection pool for SQLite', list: backlog, labels: [lBE] },
    { name: 'Design system v2', desc: 'New component library with dark mode', list: backlog, labels: [lFE, lDesign] },
    { name: 'Fix card ordering bug', list: sprint, labels: [lFE, lBug], assign: users[1], due: daysFromNow(3) },
    { name: 'Add rate limiting middleware', list: sprint, labels: [lBE], due: daysFromNow(5) },
    { name: 'Add bulk card move API', list: sprint, labels: [lBE], assign: users[0], due: daysFromNow(7) },
    { name: 'CLI generate view command', list: sprint, labels: [lCLI], assign: users[2] },
    { name: 'Refactor DataLayer booleans', list: sprint, labels: [lBE], assign: users[1] },
    { name: 'Bundle resolver v2', list: review, labels: [lBE], assign: users[0], due: daysFromNow(1) },
    { name: 'Board snapshot API', list: review, labels: [lBE], assign: users[2] },
    { name: 'Set up CI pipeline', list: done, labels: [lInfra], assign: users[3] },
    { name: 'Fix SQLite WAL mode', list: done, labels: [lBE] },
  ];

  const created = {};
  for (const c of cards) {
    const r = kr.createCard(as1({ listId: c.list.data.id, name: c.name, description: c.desc || '' }));
    created[c.name] = r.data.id;
    if (c.due) try { kr.updateCard(as1({ due_date: c.due }, { cardId: r.data.id })); } catch {}
    if (c.labels) for (const lbl of c.labels) try { kr.addCardLabel(as1({}, { cardId: r.data.id, labelId: lbl.data.id })); } catch {}
    if (c.assign) try { kr.addCardMember(as1({ userId: c.assign.id }, { cardId: r.data.id })); } catch {}
  }
  console.log(`     ${cards.length} cards, 6 labels`);

  // Checklists
  try {
    const cl = kr.createChecklist(as1({ name: 'Migration steps' }, { cardId: created['Migrate auth to OAuth2'] }));
    if (cl.data?.id) {
      for (const item of ['Audit current JWT flow', 'Set up OIDC provider', 'Update auth middleware', 'Update client token handling', 'Update documentation']) {
        kr.createCheckitem(as1({ name: item }, { checklistId: cl.data.id }));
      }
    }
    console.log('     Checklist: 5 items');
  } catch {}

  // Comments
  try {
    activity.routes().addComment(as2({ text: 'Reproduced the ordering bug on staging — happens when moving cards between lists.' }, { cardId: created['Fix card ordering bug'] }));
    activity.routes().addComment(as1({ text: 'Root cause: position values collide when two cards have the same pos.' }, { cardId: created['Fix card ordering bug'] }));
    activity.routes().addComment(as1({ text: '3x speedup confirmed after switching to lazy resolution.' }, { cardId: created['Bundle resolver v2'] }));
    activity.routes().addComment(ctx(users[2])({ text: 'OIDC provider evaluated — Auth0 and Keycloak both viable.' }, { cardId: created['Migrate auth to OAuth2'] }));
    console.log('     4 comments');
  } catch {}

  // Board: Infrastructure
  console.log('   Board: Infrastructure');
  const b2 = kr.createBoard(as1({ name: 'Infrastructure' }, { workspaceId: ws1Id }));
  const todo = kr.createList(as1({ name: 'To Do' }, { boardId: b2.data.id }));
  const prog = kr.createList(as1({ name: 'In Progress' }, { boardId: b2.data.id }));
  const done2 = kr.createList(as1({ name: 'Done' }, { boardId: b2.data.id }));
  for (const c of [
    { name: 'Docker containerization', list: todo },
    { name: 'Monitoring with Grafana', list: prog, assign: users[3] },
    { name: 'SSL cert automation', list: done2 },
    { name: 'Backup strategy', list: todo },
  ]) {
    const r = kr.createCard(as1({ listId: c.list.data.id, name: c.name }));
    if (c.assign) try { kr.addCardMember(as1({ userId: c.assign.id }, { cardId: r.data.id })); } catch {}
  }

  // ── Workspace 2: Design System ──
  console.log('   Workspace: Design System');
  const ws2 = kr.create(as1({ name: 'Design System', description: 'Shared component library' }));
  const b3 = kr.createBoard(as1({ name: 'Components v2' }, { workspaceId: ws2.data.id }));
  const dsBacklog = kr.createList(as1({ name: 'Backlog' }, { boardId: b3.data.id }));
  const dsProgress = kr.createList(as1({ name: 'In Progress' }, { boardId: b3.data.id }));
  const dsDone = kr.createList(as1({ name: 'Done' }, { boardId: b3.data.id }));
  for (const c of [
    { name: 'Button variants', list: dsDone },
    { name: 'Modal component', list: dsProgress },
    { name: 'Data table', list: dsBacklog },
    { name: 'Dark mode tokens', list: dsBacklog },
  ]) kr.createCard(as1({ listId: c.list.data.id, name: c.name }));

  // ── Workspace 3: Growth ──
  console.log('   Workspace: Growth');
  const ws3 = kr.create(as1({ name: 'Growth', description: 'User acquisition and retention' }));
  const b4 = kr.createBoard(as1({ name: 'Launch Prep' }, { workspaceId: ws3.data.id }));
  const gpTodo = kr.createList(as1({ name: 'To Do' }, { boardId: b4.data.id }));
  const gpDoing = kr.createList(as1({ name: 'Doing' }, { boardId: b4.data.id }));
  const gpDone = kr.createList(as1({ name: 'Done' }, { boardId: b4.data.id }));
  for (const c of [
    { name: 'Landing page copy', list: gpDoing },
    { name: 'Product demo video', list: gpTodo },
    { name: 'Press kit', list: gpTodo },
    { name: 'Logo finalization', list: gpDone },
  ]) kr.createCard(as1({ listId: c.list.data.id, name: c.name }));

} catch (e) { console.error('ERROR:', e.message); }

// ── 3. Search reindex ───────────────────────────────────────────────────

console.log('\n3. Reindexing search...');
try {
  const r = await search.routes().reindex({ currentUser: users[0], query: {}, body: {}, params: {} });
  console.log(`   Indexed ${r.data?.indexed || '?'} entities`);
} catch (e) { console.log('   (skipped:', e.message, ')'); }

console.log('\n========================================');
console.log('Seed complete!');
console.log('========================================');
console.log('\nSign in: mj@torque.dev / demo1234');
console.log('  Also: sarah@torque.dev, raj@torque.dev, kim@torque.dev');
console.log('========================================');

process.exit(0);
