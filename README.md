# @torquedev/cli

The command-line interface for the Torque composable monolith framework. Scaffolds applications and bundles, starts servers, validates composability contracts, generates code, and provides AI-powered development tools.

## Install

### From npm (recommended)

```bash
npm install -g @torquedev/cli
```

Or run without installing:

```bash
npx @torquedev/cli <command>
```

### From source

```bash
gh repo clone torque-framework/torque-cli
cd torque-cli && npm install && npm link
```

**Requires:** Node.js 22+, `@torquedev/core` (peer dependency).

## Commands

### Create & Run

#### `torque new <name> [--template <name>]`

Interactive app creation wizard. Prompts for:
1. **Frontend shell** -- React + MUI, or API-only
2. **Template** -- e.g. `kanban` (full Trello-like app with 8 bundles)
3. **Bundle preset** (if no template) -- `all` (identity + pipeline + pulse + tasks), `auth` (identity only), or `empty`

Generates:
- `boot.js` -- entry point that imports `@torquedev/core/boot`
- `config/mount_plans/development.yml` -- mount plan with selected bundles
- `config/app.js` -- theme, branding, auth, shell layout (if React shell)
- `package.json` -- with `start`, `dev`, `test`, `seed` scripts
- `seeds/` -- demo data (if template selected)
- `agents.md` -- AI context for the project

```bash
torque new my-app --template kanban
cd my-app && npm install
AUTH_SECRET=change-me npm run seed
AUTH_SECRET=change-me npm start
# -> http://localhost:9292  (demo@example.com / demo1234)
```

#### `torque start [--plan <path>] [--port <n>]`

Validates the mount plan, checks port availability (auto-kills stale Node processes if needed), runs `npm install` if necessary, then spawns `node boot.js`.

#### `torque dev [--plan <path>] [--port <n>]`

Same as `start` but with `--watch-path` on `boot.js` and `bundles/` for auto-restart on changes. Also watches `../torque-core` if present (monorepo-aware).

### Generate

#### `torque generate scaffold <name> [field:type ...]`

Rails-style full-stack CRUD bundle generator. Creates everything needed for a working bundle in one command:

```bash
torque generate scaffold invoice amount:integer client:text status:text --belongs-to workspace
```

Generates:
- `manifest.yml` -- schema, events (created/updated/deleted with payloads), interfaces with output contracts, REST API routes, UI routes, BDD behavior spec
- `logic.js` -- full CRUD implementation with validation, event publishing, routes, interfaces
- `agent.md` -- AI agent definition with domain model docs
- `test/<name>.test.js` -- complete test suite covering routes, interfaces, and events
- `ui/` -- ListView, DetailView, ui-kit descriptors, component index
- `seeds/<name>.js` -- seed data script
- Auto-patches `development.yml` mount plan to include the new bundle

**Flags:**
- `--belongs-to <bundle>` -- adds nested routes under parent
- `--no-auth` -- skip authentication middleware
- `--ai "<description>"` -- use Claude to generate field definitions from a natural language description

#### `torque generate bundle <name>`

Empty bundle skeleton with stub manifest, stub logic class, agent.md, and test file.

#### `torque generate intent <bundle> <name>`

IDD triplet: creates `context.js`, `behavior.js`, and `intent.js` in `bundles/<bundle>/intents/<name>/`.

#### `torque generate from-manifest <path>`

Generates a `logic.js` stub from manifest contracts. With `--ai`, calls Claude to write a full implementation saved as `logic.ai-generated.js`.

#### `torque generate tests <path>`

Generates behavior test stubs from `manifest.specs` / `manifest.behaviors` GIVEN/WHEN/THEN declarations.

#### `torque generate seed <bundle>`

Generates a seed script from the bundle's schema definition.

#### `torque generate view <ViewName> [--route <path>]`

Generates an app-level view override at `ui/views/ViewName.js` with a scaffold descriptor template. Also creates `ui/views/ui-kit.js` if missing. Default route path is kebab-case from the PascalCase name.

```bash
torque generate view DashboardPage --route /dashboard
```

### Migrations

#### `torque migrate generate`

Diffs each bundle's `manifest.yml` schema against a stored snapshot and generates numbered migration files:

```bash
torque migrate generate
#   iam: up to date
#   kanban-app: generated 002_add_column.js
#     add_column: Add column kanban-app_cards.priority
```

Migrations are stored per-bundle in `bundles/<name>/migrations/`. Each migration exports `up(db)` and `down(db)` functions.

#### `torque migrate run`

Applies pending migrations in bundle dependency order. Tracks applied migrations in a `_torque_migrations` table.

```bash
torque migrate run
#   Applying kanban-app/002_add_column.js...
#   Applied 1 migration(s).
```

#### `torque migrate status`

Shows migration state for each bundle.

#### `torque migrate rollback`

Reverses the last applied migration (planned).

### Validate & Diagnose

#### `torque validate`

Checks 7 composability rules against your application:

1. No cross-bundle imports (bundle A never imports from bundle B)
2. All published events have declared schemas
3. All event subscriptions reference declared events
4. All `depends_on` targets exist in the mount plan
5. Every bundle has an `agent.md`
6. Every manifest-declared interface is implemented in `logic.js`
7. Every implemented interface is declared in `manifest.yml`

Rules 6 and 7 live-import `logic.js` with a mock kernel to inspect `interfaces()`.

#### `torque doctor`

Health check diagnostics:
- Node.js version (>= 20 required)
- Core packages installed (`@torquedev/core`, `@torquedev/datalayer`, `@torquedev/eventbus`, `@torquedev/server`)
- Mount plan YAML is valid
- `boot.js` exists
- Foundation context is accessible
- Each bundle has `manifest.yml`, `logic.js`, and `agent.md`
- `agents.md` exists at app root

### AI-Powered

#### `torque ai "<prompt>"`

Interactive AI assistant with full Torque context. System prompt is built from `torque-foundation/context/*.md` + all bundle `agent.md` files. Streams Claude responses. Available tools: Read, Grep, Glob.

Requires `ANTHROPIC_API_KEY` environment variable.

#### `torque context --for <file>`

Dumps the full contract context for a bundle identified by file path: interface contracts, callers, events, dependencies, behaviors.

#### `torque context --diff [--ref HEAD]`

Scans all `torque-*` git repos for changed files, groups by bundle, and dumps context for each changed bundle. Useful for AI-assisted code review.

### Explore

#### `torque list [all|behaviors|context|agents|recipes|skills]`

Browse resources from `torque-foundation/`: agents, behaviors, context documents, recipes, skills. Includes both foundation-level agents and per-bundle `agent.md` files.

#### `torque info <bundle>`

Detailed bundle inspection: schema tables, interfaces, events, API routes, dependencies, `logic.js` line count, test file count.

#### `torque recipe [list|execute <name>]`

Discover and run multi-step YAML recipes from `torque-foundation/recipes/`. Supports `--auto-approve` to skip confirmation prompts.

#### `torque console [--plan <path>]`

Boots `@torquedev/core/boot` with `serve: false`, starts a Node REPL with live handles:
- `registry` -- the kernel registry
- `dataLayer`, `eventBus`, `hookBus` -- kernel services
- Each booted bundle instance as a named variable (e.g. `identity`, `kanban`)

### Maintain

#### `torque update [--fresh-db]`

Pulls latest across workspace repos (`git pull --ff-only` on torque-app, torque-core, @torquedev/cli), then runs `npm install`. `--fresh-db` wipes SQLite databases first.

#### `torque clean [--deps|--data|--all]`

Removes artifacts:
- `--deps` -- `node_modules/`
- `--data` -- `data/*.sqlite3`
- `--all` -- `node_modules/` + `data/` + `.bundles/`

## Templates

| Template | Description | Bundles |
|----------|-------------|---------|
| `kanban` | Full Kanban board app (like Trello) | workspace, boards, kanban, activity, search, admin, profile, realtime |

Template bundles are resolved from git URLs at boot time. The kanban template includes a rich seed file with 2 users, 3 workspaces, 4 boards, and 30+ cards.

## Standalone App Creation

For users without the Torque workspace:

```bash
npx @torquedev/create-app my-app
```

This generates a more comprehensive initial app than `torque new`, including the foundation context tree and a detailed `agents.md`.

## Project Structure

```
torque-cli/
  bin/torque.js           Entry point -- arg parsing, command routing
  commands/               14 command modules
    new.js                App creation wizard
    start.js              Server launcher
    dev.js                Watch-mode launcher
    generate.js           Code generation (7 sub-commands)
    migrate.js            Per-bundle database migrations
    validate.js           Composability checks (7 rules)
    doctor.js             Health diagnostics
    console.js            Live REPL
    ai.js                 Claude integration
    context.js            AI context for file/diff
    recipe.js             Multi-step recipe runner
    list.js               Foundation resource browser
    info.js               Bundle inspector
    update.js             Workspace git pull + npm install
    clean.js              Remove artifacts
  lib/
    builders/             Code generation templates (8 modules)
      manifest.js         manifest.yml generator
      logic.js            logic.js CRUD class generator
      tests.js            Test suite generator
      ui.js               ListView + DetailView generator
      agent-md.js         AI agent definition generator
      seed.js             Seed script generator
      app.js              boot.js + package.json + mount plan generator
      utils.js            Helpers
    ai.js                 Claude SDK wrapper
    plans.js              Mount plan discovery + validation
    port.js               Port availability + stale process cleanup
    templates.js          Template listing + application
    ui.js                 chalk + ora terminal helpers
    workspace.js          Workspace root detection
  templates/
    kanban/               Kanban template (app config + seeds)
  create-app.js           Standalone npx entry point
  test/                   10 test files (node --test)
```

## License

MIT — see [LICENSE](./LICENSE)
