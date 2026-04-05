export function buildAgentMd(name, className, fields) {
  const fieldList = fields.map(f => `- **${f.name}** (${f.type})`).join('\n');

  return `---
meta:
  name: ${name}-expert
  description: "Expert on the ${name} bundle"
  modes:
    - name: implement
      trigger: "work on ${name}"
    - name: debug
      trigger: "debug ${name}"
  context:
    include:
      - foundation/context/DESIGN_PRINCIPLES.md
      - foundation/context/DOMAIN_CONVENTIONS.md
---

# ${className} Bundle — Agent Guide

## What this bundle does
Manages ${name} with full CRUD operations. Provides REST API endpoints and
cross-bundle interfaces for querying ${name} data.

## Domain model
### Items table
${fieldList}
- **id** (uuid, primary key)
- **created_at** (timestamp)
- **updated_at** (timestamp)

## Key interfaces
- **getItem({ itemId })** — Retrieve a single item by ID
- **listItems()** — List all items

## API routes
- \`GET /api/${name}\` — List all items
- \`GET /api/${name}/:id\` — Get item by ID
- \`POST /api/${name}\` — Create a new item
- \`PATCH /api/${name}/:id\` — Update an item
- \`DELETE /api/${name}/:id\` — Delete an item

## Events published
- \`${name}.item.created\` — When a new item is created
- \`${name}.item.updated\` — When an item is updated
- \`${name}.item.deleted\` — When an item is deleted

## Anti-patterns
- Never import from other bundles — use coordinator.call()
- Never access other bundles' database tables
- Never hardcode config — use this.config from mount plan
- Events are past-tense facts, not commands
`;
}
