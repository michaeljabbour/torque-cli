export function buildLogicJs(name, className, fields, options = {}) {
  const firstStringField = fields.find(f => f.type === 'string' || f.type === 'text');
  const belongsTo = options.belongsTo || null;
  const parentIdField = belongsTo ? `${belongsTo}_id` : null;
  const parentParam = belongsTo ? `${belongsTo}Id` : null;

  const spreadFields = fields.map(f => {
    if (f.type === 'boolean') return `      ${f.name}: ctx.body.${f.name} !== undefined ? ctx.body.${f.name} : false`;
    if (f.type === 'integer') return `      ${f.name}: ctx.body.${f.name} !== undefined ? ctx.body.${f.name} : 0`;
    return `      ${f.name}: ctx.body.${f.name}`;
  });

  // Add parent_id field to create spread if belongsTo, always append created_by
  const createSpreadFields = belongsTo
    ? [`      ${parentIdField}: ctx.params.${parentParam}`, ...spreadFields, `      created_by: ctx.currentUser?.id`]
    : [...spreadFields, `      created_by: ctx.currentUser?.id`];

  const updateFields = fields.map(f =>
    `      if (ctx.body.${f.name} !== undefined) attrs.${f.name} = ctx.body.${f.name};`
  ).join('\n');

  const validationCode = firstStringField
    ? `    const ${firstStringField.name} = ctx.body.${firstStringField.name}?.trim?.() ?? ctx.body.${firstStringField.name};
    if (!${firstStringField.name}) return { status: 422, data: { error: '${firstStringField.name.charAt(0).toUpperCase() + firstStringField.name.slice(1)} is required' } };
`
    : '';

  const createdEventPayload = firstStringField
    ? `{ item_id: item.id, ${firstStringField.name}: item.${firstStringField.name} }`
    : '{ item_id: item.id }';

  // List filter: when belongsTo, filter by parent_id
  const listBody = belongsTo
    ? `return { status: 200, data: this.data.query('items', { ${parentIdField}: ctx.params.${parentParam} }) };`
    : `return { status: 200, data: this.listItems() };`;

  return `export default class ${className} {
  constructor({ data, events, config, coordinator }) {
    this.data = data;
    this.events = events;
    this.config = config;
    this.coordinator = coordinator;
  }

  // --- Interfaces (for cross-bundle calls via coordinator) ---

  interfaces() {
    return {
      getItem: ({ itemId }) => this.getItem(itemId),
      listItems: () => this.listItems(),
    };
  }

  intents() {
    return {};
  }

  getItem(itemId) {
    return this.data.find('items', itemId);
  }

  listItems() {
    return this.data.query('items');
  }

  // --- Routes (HTTP handlers mapped from manifest api.routes) ---

  routes() {
    return {
      list: (ctx) => {
        ${listBody}
      },

      get: (ctx) => {
        const item = this.data.find('items', ctx.params.id);
        if (!item) return { status: 404, data: { error: 'Item not found' } };
        return { status: 200, data: item };
      },

      create: (ctx) => {
${validationCode}        const item = this.data.insert('items', {
${createSpreadFields.join(',\n')},
        });
        this.events.publish('${name}.item.created', ${createdEventPayload});
        return { status: 201, data: item };
      },

      update: (ctx) => {
        const existing = this.data.find('items', ctx.params.id);
        if (!existing) return { status: 404, data: { error: 'Item not found' } };

        const attrs = {};
${updateFields}
        const updated = this.data.update('items', ctx.params.id, attrs);
        this.events.publish('${name}.item.updated', { item_id: ctx.params.id });
        return { status: 200, data: updated };
      },

      remove: (ctx) => {
        const existing = this.data.find('items', ctx.params.id);
        if (!existing) return { status: 404, data: { error: 'Item not found' } };

        this.data.delete('items', ctx.params.id);
        this.events.publish('${name}.item.deleted', { item_id: ctx.params.id });
        return { status: 200, data: { deleted: true } };
      },
    };
  }

  setupSubscriptions(eventBus) {
    // No subscriptions by default.
  }
}
`;
}
