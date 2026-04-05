/**
 * Seeds for search-app bundle.
 * Reindexes all boards and cards for full-text search.
 */
export default async function seed({ routes, registry }) {
  console.log('  Seeding search-app...');
  const r = routes();

  let users;
  try { users = registry._seedResults?.iam?.users; } catch {}

  if (!users?.length) {
    console.log('    (skipped — depends on IAM seeds)');
    return;
  }

  try {
    const result = await r.reindex({ currentUser: users[0], query: {}, body: {}, params: {} });
    console.log('    Indexed ' + (result.data?.indexed || '?') + ' entities');
  } catch (e) {
    console.log('    (reindex skipped: ' + e.message + ')');
  }
}
