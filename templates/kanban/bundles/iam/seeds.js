/**
 * Seeds for IAM bundle.
 * Creates users, roles, profiles, and teams.
 */
export default async function seed({ routes, registry }) {
  console.log('  Seeding IAM...');
  const r = routes();

  // Users
  const u1 = r.signUp({ body: { email: 'mj@torque.dev', password: 'demo1234', name: 'MJ' } });
  const u2 = r.signUp({ body: { email: 'sarah@torque.dev', password: 'demo1234', name: 'Sarah Chen' } });
  const u3 = r.signUp({ body: { email: 'raj@torque.dev', password: 'demo1234', name: 'Raj Patel' } });
  const u4 = r.signUp({ body: { email: 'kim@torque.dev', password: 'demo1234', name: 'Kim Lee' } });

  const users = [u1, u2, u3, u4].map(s => s.data.user);
  const ctx = (user) => (body = {}, params = {}) => ({ body, params, currentUser: user, query: {} });
  const as1 = ctx(users[0]);

  // Roles
  try {
    const roles = r.listRoles({ currentUser: users[0] });
    const superAdmin = roles.data?.find(r => r.name === 'super-admin');
    const member = roles.data?.find(r => r.name === 'member');
    if (superAdmin) r.assignRole({ params: { userId: users[0].id }, body: { role_id: superAdmin.id }, currentUser: users[0] });
    for (const u of users.slice(1)) {
      if (member) r.assignRole({ params: { userId: u.id }, body: { role_id: member.id }, currentUser: users[0] });
    }
  } catch {}

  // Profiles
  try {
    r.updateProfile({ body: { display_name: 'MJ', bio: 'Platform lead' }, currentUser: users[0] });
    r.updateProfile({ body: { display_name: 'Sarah Chen', bio: 'Frontend engineer' }, currentUser: users[1] });
    r.updateProfile({ body: { display_name: 'Raj Patel', bio: 'Backend engineer' }, currentUser: users[2] });
    r.updateProfile({ body: { display_name: 'Kim Lee', bio: 'DevOps engineer' }, currentUser: users[3] });
  } catch {}

  // Teams
  try {
    const t1 = r.createTeam(as1({ name: 'Platform Team', description: 'Core platform engineering' }));
    if (t1.data?.id) {
      r.addTeamMember(as1({ userId: users[1].id }, { teamId: t1.data.id }));
      r.addTeamMember(as1({ userId: users[2].id }, { teamId: t1.data.id }));
    }
    const t2 = r.createTeam(as1({ name: 'DevOps Team', description: 'Infrastructure and deployment' }));
    if (t2.data?.id) {
      r.addTeamMember(as1({ userId: users[3].id }, { teamId: t2.data.id }));
    }
  } catch {}

  console.log('    4 users, 2 teams');
  return { users };
}
