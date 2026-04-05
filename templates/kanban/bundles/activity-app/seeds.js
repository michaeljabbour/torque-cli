/**
 * Seeds for activity-app bundle.
 * Adds comments to cards and creates sample activity.
 */
export default async function seed({ routes, registry }) {
  console.log('  Seeding activity-app...');
  const r = routes();

  let users, created;
  try {
    users = registry._seedResults?.iam?.users;
    created = registry._seedResults?.['kanban-app']?.created;
  } catch {}

  if (!users || !created) {
    console.log('    (skipped — depends on IAM + kanban-app seeds)');
    return;
  }

  const ctx = (user) => (body = {}, params = {}) => ({ body, params, currentUser: user, query: {} });

  // Add comments to cards
  const comments = [
    { card: 'Fix card ordering bug', user: users[1], text: 'Reproduced the ordering bug on staging — happens when moving cards between lists.' },
    { card: 'Fix card ordering bug', user: users[0], text: 'Root cause: position values collide when two cards have the same pos. Need to add a conflict resolver.' },
    { card: 'Bundle resolver v2', user: users[0], text: '3x speedup confirmed after switching to lazy resolution.' },
    { card: 'Migrate auth to OAuth2', user: users[2], text: 'OIDC provider evaluated — Auth0 and Keycloak both viable. Leaning Auth0 for managed.' },
  ];

  let count = 0;
  for (const c of comments) {
    const cardId = created[c.card];
    if (!cardId) continue;
    try {
      r.addComment(ctx(c.user)({ text: c.text }, { cardId }));
      count++;
    } catch {}
  }

  console.log('    ' + count + ' comments added');
}
