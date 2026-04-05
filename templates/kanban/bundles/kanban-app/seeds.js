/**
 * Seeds for kanban-app bundle.
 * Creates workspaces, boards, lists, cards, labels, and checklists.
 */
export default async function seed({ routes, registry }) {
  console.log('  Seeding kanban-app...');
  const kr = routes();

  // Get users from IAM
  let users;
  try {
    const iamSeedResult = registry._seedResults?.iam;
    users = iamSeedResult?.users;
  } catch {}
  if (!users || users.length < 2) {
    console.log('    (skipped — IAM seeds not found)');
    return;
  }

  const ctx = (user) => (body = {}, params = {}) => ({ body, params, currentUser: user, query: {} });
  const as1 = ctx(users[0]);
  const as2 = ctx(users[1]);
  function daysFromNow(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString(); }

  // ── Workspace 1: Torque Core ──
  const ws1 = kr.create(as1({ name: 'Torque Core', description: 'Core framework development' }));
  const ws1Id = ws1.data.id;
  try { kr.invite(as1({ email: users[1].email }, { workspaceId: ws1Id })); } catch {}
  try { kr.invite(as1({ email: users[2].email }, { workspaceId: ws1Id })); } catch {}

  // Board: Platform Sprint Q2
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

  // Checklists
  try {
    const cl = kr.createChecklist(as1({ name: 'Migration steps' }, { cardId: created['Migrate auth to OAuth2'] }));
    if (cl.data?.id) {
      for (const item of ['Audit current JWT flow', 'Set up OIDC provider', 'Update auth middleware', 'Update client token handling', 'Update documentation']) {
        kr.createCheckitem(as1({ name: item }, { checklistId: cl.data.id }));
      }
    }
  } catch {}

  // Board: Infrastructure
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

  console.log('    3 workspaces, 5 boards, ' + (cards.length + 4 + 4 + 4) + ' cards');
  return { workspaces: [ws1, ws2, ws3], created };
}
