import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

export default async function validate() {
  const appDir = resolve(process.cwd());
  const bundlesRoot = join(appDir, 'bundles');
  const violations = [];

  // Discover all bundles in ./bundles/
  let bundleDirs = [];
  if (existsSync(bundlesRoot)) {
    bundleDirs = readdirSync(bundlesRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => ({ name: d.name, dir: join(bundlesRoot, d.name) }))
      .filter(b => existsSync(join(b.dir, 'manifest.yml')));
  }

  console.log(`Validating ${bundleDirs.length} bundles...\n`);

  if (bundleDirs.length === 0) {
    console.log('No bundles found in bundles/. Generate one with: torque generate bundle <name>');
    return 0;
  }

  for (const bundle of bundleDirs) {
    const manifest = yaml.load(readFileSync(join(bundle.dir, 'manifest.yml'), 'utf8'));
    const logicPath = join(bundle.dir, 'logic.js');

    // Check cross-bundle imports in logic.js
    if (existsSync(logicPath)) {
      const code = readFileSync(logicPath, 'utf8');
      for (const other of bundleDirs) {
        if (other.name === bundle.name) continue;
        if (code.includes(`torque-bundle-${other.name}`) || code.includes(`../bundles/${other.name}`) || code.includes(`../${other.name}`)) {
          violations.push({
            bundle: bundle.name, rule: 'cross_bundle_import',
            message: `imports from bundle '${other.name}' — violates isolation`,
            fix: `Use coordinator.call('${other.name}', ...) instead`,
          });
        }
      }
    }

    // Check declared events have schemas
    for (const event of manifest.events?.publishes || []) {
      if (!event.schema || Object.keys(event.schema).length === 0) {
        violations.push({
          bundle: bundle.name, rule: 'event_schema_missing',
          message: `Event '${event.name}' has no payload schema`,
          fix: `Add schema fields to events.publishes in manifest.yml`,
        });
      }
    }

    // Check subscriber targets exist
    for (const eventName of manifest.events?.subscribes || []) {
      const [pubBundle] = eventName.split('.');
      const pubDir = bundleDirs.find(b => b.name === pubBundle);
      if (pubDir) {
        const pubManifest = yaml.load(readFileSync(join(pubDir.dir, 'manifest.yml'), 'utf8'));
        const declared = pubManifest.events?.publishes?.find(e => e.name === eventName);
        if (!declared) {
          violations.push({
            bundle: bundle.name, rule: 'subscribes_undeclared',
            message: `Subscribes to '${eventName}' but '${pubBundle}' doesn't declare it`,
            fix: `Add '${eventName}' to events.publishes in ${pubBundle}/manifest.yml`,
          });
        }
      }
    }

    // Check depends_on targets exist
    for (const dep of manifest.depends_on || []) {
      if (!bundleDirs.find(b => b.name === dep)) {
        violations.push({
          bundle: bundle.name, rule: 'dependency_missing',
          message: `Depends on '${dep}' but no bundle found in bundles/`,
          fix: `Create bundle '${dep}' with: torque generate bundle ${dep}`,
        });
      }
    }

    // Check agent.md exists
    if (!existsSync(join(bundle.dir, 'agent.md'))) {
      violations.push({
        bundle: bundle.name, rule: 'agent_guide_missing',
        message: `No agent.md found`,
        fix: `Create ${bundle.dir}/agent.md with YAML frontmatter`,
      });
    }

    // Check for implemented interfaces not declared in manifest
    if (existsSync(logicPath)) {
      try {
        const absoluteLogicPath = resolve(logicPath);
        const mod = await import(absoluteLogicPath);
        const BundleClass = mod.default;
        if (BundleClass) {
          const mockInstance = new BundleClass({
            data: { insert() {}, find() {}, query() { return []; }, update() {}, delete() {}, count() { return 0; } },
            events: { publish() {} },
            config: { config: {} },
            coordinator: { call: async () => null },
          });

          if (typeof mockInstance.interfaces === 'function') {
            const implemented = new Set(Object.keys(mockInstance.interfaces()));
            const declared = new Set([
              ...(manifest.interfaces?.queries || []),
              ...Object.keys(manifest.interfaces?.contracts || {}),
            ]);

            for (const ifaceName of implemented) {
              if (!declared.has(ifaceName)) {
                violations.push({
                  bundle: bundle.name, rule: 'interface_undeclared',
                  message: `Interface '${ifaceName}' is implemented in logic.js but not declared in manifest`,
                  fix: `Add '${ifaceName}' to interfaces.queries or interfaces.contracts in manifest.yml`,
                });
              }
            }

            for (const ifaceName of declared) {
              if (!implemented.has(ifaceName)) {
                violations.push({
                  bundle: bundle.name, rule: 'interface_unimplemented',
                  message: `Interface '${ifaceName}' is declared in manifest but not implemented in logic.js`,
                  fix: `Add '${ifaceName}' to the interfaces() return value in logic.js`,
                });
              }
            }
          }
        }
      } catch (e) {
        violations.push({
          bundle: bundle.name, rule: 'interface_check_skipped',
          message: `Could not import logic.js for interface validation: ${e.message}`,
          fix: `Ensure logic.js can be imported standalone for validation`,
        });
      }
    }
  }

  // Check for 4-bundle pattern (advisory, not a violation)
  const bundleNames = bundleDirs.map(b => b.name);
  const hasIam = bundleNames.some(n => n === 'iam' || n === 'identity');
  const hasDomain = bundleNames.some(n => !['iam', 'identity', 'activity-app', 'activity', 'search-app', 'search'].includes(n));
  const hasActivity = bundleNames.some(n => n === 'activity-app' || n === 'activity');
  const hasSearch = bundleNames.some(n => n === 'search-app' || n === 'search');

  if (violations.length === 0) {
    console.log(`All composability checks passed`);
    console.log(`  ${bundleDirs.length} bundles validated`);

    if (bundleDirs.length >= 2) {
      console.log('\n4-Bundle Pattern:');
      console.log(`  IAM:      ${hasIam ? '✓' : '—'}`);
      console.log(`  Domain:   ${hasDomain ? '✓' : '—'}`);
      console.log(`  Activity: ${hasActivity ? '✓' : '—'}`);
      console.log(`  Search:   ${hasSearch ? '✓' : '—'}`);
      if (!hasIam || !hasActivity || !hasSearch) {
        console.log('\n  Tip: The 4-bundle pattern (IAM + Domain + Activity + Search)');
        console.log('  provides auth, event tracking, and full-text search out of the box.');
      }
    }

    return 0;
  }

  console.log(`${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.log(`  [${v.rule}] ${v.bundle}: ${v.message}`);
    console.log(`    Fix: ${v.fix}\n`);
  }
  return 1;
}
