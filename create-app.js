#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const appName = process.argv[2];

if (!appName) {
  console.error('Usage: npx @torquedev/create-app <app-name>');
  process.exit(1);
}

const appDir = resolve(appName);

if (existsSync(appDir)) {
  console.error(`Directory '${appName}' already exists.`);
  process.exit(1);
}

console.log();
console.log(`  Creating Torque app: ${appName}`);
console.log(`  Directory: ${appDir}`);
console.log();

// Create directory structure
mkdirSync(join(appDir, 'config', 'mount_plans'), { recursive: true });
mkdirSync(join(appDir, 'bundles'), { recursive: true });
mkdirSync(join(appDir, 'data'), { recursive: true });
mkdirSync(join(appDir, 'foundation', 'context'), { recursive: true });
mkdirSync(join(appDir, 'foundation', 'behaviors'), { recursive: true });
mkdirSync(join(appDir, 'foundation', 'recipes'), { recursive: true });

// Write boot.js
writeFileSync(join(appDir, 'boot.js'), `import { boot } from '@torquedev/core/boot';

const app = await boot({
  plan: process.env.MOUNT_PLAN || 'config/mount_plans/development.yml',
  db: process.env.DB_PATH || 'data/dev.sqlite3',
  port: process.env.PORT || 9292,
});
`);

// Write mount plan
writeFileSync(join(appDir, 'config', 'mount_plans', 'development.yml'), `app:
  name: "${appName}"
  description: "A Torque application"

# Contract validation: "warn" (default) or "strict"
validation:
  contracts: warn
  events: warn

# Behaviors: composable capability add-ons loaded at boot
behaviors:
  - foundation/behaviors/development.yaml

# Context: knowledge files loaded for AI agent sessions
context:
  include:
    - foundation/context/DESIGN_PRINCIPLES.md
    - foundation/context/DOMAIN_CONVENTIONS.md
    - foundation/context/EVENT_PATTERNS.md

# Bundles: the features that compose this application
bundles: {}
`);

// Write package.json
const pkg = {
  name: appName,
  version: '0.1.0',
  private: true,
  type: 'module',
  scripts: {
    start: 'node boot.js',
    dev: 'node --watch boot.js',
    test: "node --test 'bundles/*/test/*.test.js'",
  },
  dependencies: {
    '@torquedev/core': '^0.1.0',
    '@torquedev/datalayer': '^0.1.0',
    '@torquedev/eventbus': '^0.1.0',
    '@torquedev/server': '^0.1.0',
  },
  devDependencies: {
    '@torquedev/cli': '^0.1.0',
    '@torquedev/test-helpers': '^0.1.0',
  },
};
writeFileSync(join(appDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

// Write .gitignore
writeFileSync(join(appDir, '.gitignore'), `node_modules/
data/
.bundles/
bundle.lock
*.sqlite3
`);

// ---------------------------------------------------------------------------
// Foundation files — architecture knowledge baked into every generated app
// ---------------------------------------------------------------------------

writeFileSync(join(appDir, 'foundation', 'context', 'DESIGN_PRINCIPLES.md'), `# Design principles

These principles govern every decision in the Torque ecosystem. When in doubt, return to these.

## 1. The mount plan is the product

An application is defined by a YAML file — not a codebase. Changing what an app does means editing the mount plan, not writing code. This is the most important principle. If a feature requires code changes in multiple repos to "turn on," the architecture has failed.

## 2. Bundles are stateless compute with declared schemas

A bundle declares what it needs and what it provides. The kernel and shared services supply everything else. A bundle never:
- Holds a database connection
- Imports another bundle's code
- Reads environment variables directly
- Knows what application it's part of

## 3. Events are facts, not commands

\`pipeline.deal.stage_changed\` is a statement that something happened — not a request for someone to do something. Events fire whether or not anyone subscribes. This is what makes bundles independently deployable.

## 4. Interfaces are stable contracts, not convenience wrappers

When identity exposes \`getUser({ userId })\`, it returns \`{ id, name, email, role }\` — a DTO that won't change when identity's internal schema changes. Interfaces are the public API of a bundle. They should be small, focused, and versioned.

## 5. The kernel provides mechanisms, not policies

The kernel knows how to resolve bundles, boot them, route requests, and enforce isolation. It does not know what a "deal" is, what "funded" means, or how to calculate a commission split. Business logic lives in bundles. Always.

## 6. Domain-neutral naming

Not "CRM contact" — "entity." Not "Twilio SMS" — "message channel." Not "deal pipeline" — "stage-based workflow." Names should work across verticals. A pipeline bundle should work for deal tracking, recruiting, support tickets, or any item-through-stages process.

## 7. Convention over configuration, configuration over code

Follow the conventions in this foundation. When conventions don't cover your case, use configuration (mount plan). When configuration isn't enough, write code in a bundle. Never write code when configuration would suffice.

## 8. Small, boring, stable center — fast, interesting edges

The kernel, data layer, and event bus should be boring. They should change rarely and never break. Bundles are where innovation happens. A new feature is a new bundle or a bundle update — never a kernel change.

## 9. Composition over inheritance

Bundles don't extend each other. They compose through events and interfaces. There is no "base bundle." There is no class hierarchy. Each bundle is a flat, self-contained unit that the kernel orchestrates.

## 10. Frontend and backend compose the same way

Backend routes auto-register from manifest declarations. Frontend views are no different: bundles export view functions that return ui-kit descriptors (pure JavaScript, framework-agnostic). The shell provides a renderer that maps those descriptors to React+MUI components. Adding a bundle with API endpoints and a UI view requires zero edits to the server or the shell. If you find yourself editing the shell renderer or \`server/index.js\` to support a new bundle, the architecture has failed. The mount plan is the product — on both sides of the stack.

The three layers of the frontend architecture:
- **Shell (mechanism):** Provides React+MUI rendering, routing, theme
- **UI Kit (protocol):** Pure JS descriptor functions, zero framework deps
- **Bundles (policy):** Compose from ui-kit, framework-agnostic, reusable

The swap test: to move from React+MUI to Vue+Vuetify, rewrite the shell. Bundles and ui-kit are untouched.

## 11. Delete before you abstract

If a pattern appears in two bundles, leave it duplicated. If it appears in five, consider a shared service. Never create an abstraction for fewer than three concrete use cases. The cost of a wrong abstraction is higher than the cost of duplication.

## 12. Bundles describe, the shell renders

Bundles compose UI from \`@torquedev/ui-kit\` descriptor functions—pure JavaScript functions that return declarative component trees, with zero framework dependencies. The shell provides a renderer that maps those descriptors to framework-specific components (React+MUI today, anything tomorrow). Swapping frameworks means rewriting the shell renderer, not touching a single bundle. This keeps bundles portable across applications and frameworks. A bundle's UI is a data structure, not a component tree.
`);

writeFileSync(join(appDir, 'foundation', 'context', 'DOMAIN_CONVENTIONS.md'), `# Domain conventions

These conventions apply to every bundle in the ecosystem. Follow them to ensure bundles compose cleanly.

## Naming

### Bundle names
- Lowercase, hyphens for word separation: \`entity-graph\`, \`pipeline\`, \`pulse\`
- Domain-neutral: describe the capability, not the vertical
- No "torque-" prefix in the name field — the repo has the prefix, the manifest name doesn't

### Table names
- Lowercase, underscores: \`deals\`, \`stage_transitions\`, \`payment_items\`
- Plural nouns: \`users\` not \`user\`, \`activities\` not \`activity\`
- No bundle prefix in the manifest — the data layer adds it: \`pipeline_deals\`

### Column names
- Lowercase, underscores: \`owner_id\`, \`created_at\`, \`amount_cents\`
- Foreign references use \`<entity>_id\`: \`user_id\`, \`stage_id\`, \`deal_id\`
- Boolean columns are positive assertions: \`is_active\`, \`read\`, \`verified\` — not \`not_deleted\`

### Event names
- Pattern: \`<bundle>.<entity>.<past_tense_verb>\`
- Examples: \`pipeline.deal.created\`, \`identity.user.authenticated\`, \`accounting.payment.processed\`
- Past tense because events are facts about what already happened
- No future tense: not \`pipeline.deal.will_move\` — that's a command, not an event

### Interface names
- camelCase verbs: \`getUser\`, \`listDealsByStage\`, \`createCompletion\`
- Queries start with \`get\` or \`list\`: \`getUser\`, \`listDeals\`
- Commands start with action verbs: \`sendMessage\`, \`submitDocument\`

## Data types

### IDs
- Always UUID v4 strings: \`"a1b2c3d4-e5f6-7890-abcd-ef1234567890"\`
- Generated by the data layer, not by bundles
- Column type: \`uuid\`

### Money
- Always integer cents: \`7500000\` = $75,000.00
- Column type: \`integer\`
- Column name suffix: \`_cents\` — \`amount_cents\`, \`funded_amount_cents\`, \`fee_cents\`
- Never use floats for money

### Timestamps
- Always ISO 8601 strings: \`"2026-03-27T15:00:00.000Z"\`
- Always UTC — never local time
- Column type: \`timestamp\`
- Standard columns: \`created_at\`, \`updated_at\` (auto-managed by data layer if declared)

### Status fields
- Column type: \`string\`
- Use clear, lowercase values: \`active\`, \`archived\`, \`draft\`, \`submitted\`, \`funded\`
- Don't encode transitions in status names: not \`moved_to_funded\` — just \`funded\`

### Booleans
- Column type: \`boolean\`
- Stored as INTEGER (0/1) in SQLite
- Use positive names: \`verified\`, \`read\`, \`active\` — not \`unverified\`, \`unread\`

## Cross-bundle references

### Referencing entities from other bundles
- Store only the UUID: \`owner_id: "abc-123"\`
- Resolve via coordinator when you need the full object
- Never denormalize (don't store \`owner_name\` alongside \`owner_id\`)
- Handle the null case: the referenced entity might not exist

### Example
\`\`\`javascript
// Store the reference
const deal = this.data.insert('deals', {
  title: 'Acme Corp',
  owner_id: userId,  // UUID from identity bundle
});

// Resolve when needed
const owner = this.coordinator.call('identity', 'getUser', { userId: deal.owner_id });
const ownerName = owner?.name || 'Unknown';
\`\`\`

## Config conventions

### Mount plan config
- Use snake_case keys: \`jwt_secret\`, \`max_entries\`, \`default_stages\`
- Use environment variable references for secrets: \`"\${AUTH_SECRET}"\`
- Provide sensible defaults in the bundle logic, not in the mount plan

### Bundle defaults
\`\`\`javascript
constructor({ config }) {
  this.maxEntries = config.config?.max_entries || 200;   // Default in code
  this.jwtSecret = config.config?.jwt_secret || 'change-me';  // Fail-safe default
}
\`\`\`

## Soft delete convention

- Use a \`status\` column with value \`archived\` instead of deleting rows
- The data layer's \`delete()\` method does hard deletes — use \`update(table, id, { status: 'archived' })\` for soft deletes
- When querying, filter by \`status: 'active'\` to exclude archived records

## Pagination convention (future)

When bundles need pagination, use cursor-based pagination:
\`\`\`javascript
data.query('deals', { status: 'active' }, {
  order: 'created_at DESC',
  limit: 20,
  // cursor support is a future data layer enhancement
})
\`\`\`
`);

writeFileSync(join(appDir, 'foundation', 'context', 'EVENT_PATTERNS.md'), `# Event patterns

Events are the primary mechanism for cross-bundle communication. This document defines the conventions that every bundle must follow when publishing or subscribing to events.

## Event anatomy

\`\`\`javascript
eventBus.publish('pipeline.deal.stage_changed', {
  deal_id: 'abc-123',
  from_stage_id: 'stage-1',
  to_stage_id: 'stage-2',
  changed_by: 'user-456',
});
\`\`\`

| Field | Convention |
|-------|-----------|
| Event name | \`<bundle>.<entity>.<past_tense_verb>\` |
| Payload keys | snake_case |
| ID values | UUID strings |
| Timestamps | ISO 8601 UTC (if included) |

## Naming rules

### The event name is a fact

Events describe what happened, not what should happen:

\`\`\`
pipeline.deal.created          # A deal was created
identity.user.authenticated    # A user logged in
accounting.payment.processed   # A payment was processed

# NOT:
pipeline.deal.create           # This is a command, not an event
pipeline.deal.creating         # This is in-progress, not completed
pipeline.notify_analytics      # This names the subscriber, not the fact
\`\`\`

### Bundle prefix is mandatory

Every event starts with the publishing bundle's name. This prevents namespace collisions and makes it clear who owns the event:

\`\`\`
pipeline.deal.created          # Published by pipeline
identity.user.authenticated    # Published by identity
pulse.activity.recorded        # Published by pulse (if it published)
\`\`\`

### Entity is singular

\`\`\`
pipeline.deal.created          # Correct
pipeline.deals.created         # Wrong — use singular
\`\`\`

## Payload conventions

### Always include the entity ID

\`\`\`javascript
// Correct — includes the entity that changed
{ deal_id: 'abc-123', from_stage_id: 'stage-1', to_stage_id: 'stage-2' }

// Wrong — missing the entity reference
{ from_stage: 'New lead', to_stage: 'Contacted' }
\`\`\`

### Use IDs, not denormalized data

\`\`\`javascript
// Correct — subscribers resolve names themselves
{ deal_id: 'abc-123', changed_by: 'user-456' }

// Wrong — embeds data that might be stale
{ deal_title: 'Acme Corp', changed_by_name: 'Demo Admin' }
\`\`\`

### Include enough context to avoid round-trips

\`\`\`javascript
// Good — subscriber has enough to record an activity without extra queries
{
  deal_id: 'abc-123',
  title: 'Acme Corp',          // Included because it's immutable in this context
  amount_cents: 7500000,
  stage_id: 'stage-1',
  owner_id: 'user-456',
}

// Too minimal — subscriber must query pipeline for every field
{ deal_id: 'abc-123' }
\`\`\`

The balance: include data that is known at publish time and unlikely to change. Leave out data that the subscriber should resolve fresh (like user names, which might have changed since the event).

## Subscription patterns

### Subscribe in setupSubscriptions only

\`\`\`javascript
// Correct — during the kernel's subscription phase
setupSubscriptions(eventBus) {
  eventBus.subscribe('pipeline.deal.created', 'pulse', (payload) => {
    this._record({ ... });
  });
}

// Wrong — subscribing in the constructor or during a request
constructor({ events }) {
  events.subscribe('pipeline.deal.created', 'pulse', (payload) => { ... });
}
\`\`\`

### Handle missing dependencies gracefully

If your subscription handler calls a coordinator interface, the target bundle might not be active:

\`\`\`javascript
setupSubscriptions(eventBus) {
  eventBus.subscribe('pipeline.deal.stage_changed', 'pulse', (payload) => {
    let actorName = 'Unknown';
    try {
      const user = this.coordinator.call('identity', 'getUser', { userId: payload.changed_by });
      actorName = user?.name || 'Unknown';
    } catch {
      // Identity bundle not active — degrade gracefully
    }
    this._record({ actor_name: actorName, ... });
  });
}
\`\`\`

### Don't throw from event handlers

If a handler throws, it's caught by the event bus and logged — but it stops other handlers from running. Always handle errors internally:

\`\`\`javascript
// Correct
eventBus.subscribe('pipeline.deal.created', 'analytics', (payload) => {
  try {
    this.data.insert('metrics', { ... });
  } catch (e) {
    console.error(\`[analytics] Failed to record metric: \${e.message}\`);
  }
});
\`\`\`

## Event catalog

### Identity bundle
| Event | Payload | When |
|-------|---------|------|
| \`identity.user.authenticated\` | \`{ user_id, email }\` | After successful sign-in or sign-up |
| \`identity.session.created\` | \`{ user_id, jti }\` | After JWT + refresh token created |

### Pipeline bundle
| Event | Payload | When |
|-------|---------|------|
| \`pipeline.deal.created\` | \`{ deal_id, title, amount_cents, stage_id, owner_id }\` | After deal inserted |
| \`pipeline.deal.stage_changed\` | \`{ deal_id, from_stage_id, to_stage_id, changed_by }\` | After stage transition |
| \`pipeline.deal.archived\` | \`{ deal_id, archived_by }\` | After deal archived |

### Tasks bundle
| Event | Payload | When |
|-------|---------|------|
| \`tasks.task.created\` | \`{ task_id, title, entity_type, entity_id, assigned_to, created_by }\` | After task inserted |
| \`tasks.task.completed\` | \`{ task_id, completed_by }\` | After task marked complete |

### Planned events (from catalog)
| Event | Bundle | Status |
|-------|--------|--------|
| \`entity.created\` | entity-graph | planned |
| \`entity.updated\` | entity-graph | planned |
| \`accounting.report.submitted\` | accounting | planned |
| \`accounting.payment.processed\` | accounting | planned |
| \`communications.message.sent\` | communications | planned |
| \`communications.call.completed\` | communications | planned |
| \`intelligence.completion.finished\` | intelligence | planned |
| \`integrations.document.signed\` | integrations | planned |
| \`integrations.offer.received\` | integrations | planned |

## Event versioning (future)

When an event payload needs to change, add a version suffix:

\`\`\`
pipeline.deal.created          # v1 (current)
pipeline.deal.created.v2       # v2 (new fields)
\`\`\`

Publish both during a transition period. Subscribers migrate at their own pace. Remove the old event when all subscribers have updated. This is a future concern — not yet implemented.
`);

writeFileSync(join(appDir, 'foundation', 'behaviors', 'development.yaml'), `name: development
version: "1.0.0"
description: "Development-mode behavior. Loads all architecture context for AI-assisted development."

context:
  include:
    - context/DESIGN_PRINCIPLES.md
    - context/DOMAIN_CONVENTIONS.md
    - context/EVENT_PATTERNS.md

config:
  verbose_errors: true
  seed_on_boot: true
  log_level: debug
`);

writeFileSync(join(appDir, 'foundation', 'recipes', 'onboard-bundle.yaml'), `name: onboard-bundle
version: "1.0.0"
description: "End-to-end workflow for creating a new bundle from requirements to validated implementation"

inputs:
  - { name: bundle_name, required: true, description: "Name of the bundle to create" }

steps:
  - name: scaffold
    action: "torque generate bundle \${bundle_name}"
  - name: design-manifest
    prompt: "Design a complete manifest.yml for \${bundle_name} with schema, interfaces, events, API routes, and behavioral specs"
  - name: generate-skeleton
    action: "torque generate from-manifest bundles/\${bundle_name}/manifest.yml"
  - name: implement-logic
    prompt: "Implement business logic in bundles/\${bundle_name}/logic.js following cross-bundle-calls and error-handling patterns"
  - name: write-seeds
    prompt: "Create realistic seed data in bundles/\${bundle_name}/seeds.js"
  - name: generate-tests
    action: "torque generate tests bundles/\${bundle_name}/manifest.yml"
  - name: validate
    action: "torque validate"
  - name: review
    prompt: "Review \${bundle_name} bundle for contract compliance and composability"
    approval: "Bundle ready for review"
`);

// Write agents.md — AI agent instructions for the app (language/model agnostic)
writeFileSync(join(appDir, 'agents.md'), `# Torque Application

This is a Torque composable monolith application.

## Architecture

- **Mount plan** (\`config/mount_plans/development.yml\`) defines which bundles are active
- **Bundles** (\`bundles/\`) are isolated feature modules with manifest.yml + logic.js
- **Foundation** (\`foundation/\`) contains architecture principles and conventions

## Key Commands

- \`npm start\` — Boot the application
- \`npm run dev\` — Boot with file watching
- \`npx torque generate bundle <name>\` — Scaffold a new bundle
- \`npx torque validate\` — Check composability rules

## Bundle Contract

Every bundle has:
- \`manifest.yml\` — Declares schema, events, interfaces, routes
- \`logic.js\` — Implements business logic, receives { data, events, config, coordinator }
- \`agent.md\` — AI agent guide for this bundle
- \`test/\` — Tests

## Rules

- Bundles NEVER import from other bundles — use coordinator.call()
- Bundles NEVER access other bundles' database tables
- Events are facts (past tense), not commands
- All money in integer cents (amount_cents)
- All IDs are UUID v4
- All timestamps are ISO 8601 UTC
- Read foundation/context/ for full conventions
`);

console.log('  Created:');
console.log('    boot.js');
console.log('    config/mount_plans/development.yml');
console.log('    bundles/');
console.log('    data/');
console.log('    foundation/context/DESIGN_PRINCIPLES.md');
console.log('    foundation/context/DOMAIN_CONVENTIONS.md');
console.log('    foundation/context/EVENT_PATTERNS.md');
console.log('    foundation/behaviors/development.yaml');
console.log('    foundation/recipes/onboard-bundle.yaml');
console.log('    agents.md');
console.log('    package.json');
console.log('    .gitignore');
console.log();
console.log('  Next steps:');
console.log(`    cd ${appName}`);
console.log('    npm install');
console.log('    npm start');
console.log();
console.log('  Generate your first bundle:');
console.log('    npx torque generate bundle <name>');
console.log();
