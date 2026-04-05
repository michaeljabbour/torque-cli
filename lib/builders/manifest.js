import yaml from 'js-yaml';

// ── Field type mapping ─────────────────────────────────────────────────────
export const FIELD_TYPE_MAP = {
  string:    { type: 'string', null: false },
  text:      { type: 'text' },
  integer:   { type: 'integer', default: 0 },
  boolean:   { type: 'boolean', default: false },
  float:     { type: 'float' },
  timestamp: { type: 'timestamp' },
};

export function parseFields(rawArgs) {
  return rawArgs
    .filter(arg => arg.includes(':'))
    .map(arg => {
      const [name, type] = arg.split(':');
      return { name, type };
    });
}

function pluralize(word) {
  if (word.endsWith('s')) return word + 'es';
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) return word.slice(0, -1) + 'ies';
  return word + 's';
}

export function buildManifestYaml(name, fields, options = {}) {
  const capName = name.charAt(0).toUpperCase() + name.slice(1);
  const belongsTo = options.belongsTo || null;

  // Build columns object
  const columns = { id: { type: 'uuid', primary: true } };
  if (belongsTo) {
    columns[`${belongsTo}_id`] = { type: 'uuid', null: false };
  }
  for (const f of fields) {
    const mapped = FIELD_TYPE_MAP[f.type];
    if (mapped) {
      columns[f.name] = { ...mapped };
    } else {
      columns[f.name] = { type: f.type };
    }
  }
  columns.created_at = { type: 'timestamp' };
  columns.updated_at = { type: 'timestamp' };

  // Build output shape for contracts
  const shape = { id: 'uuid' };
  if (belongsTo) {
    shape[`${belongsTo}_id`] = 'uuid';
  }
  for (const f of fields) {
    shape[f.name] = f.type === 'text' ? 'string' : f.type;
  }

  // Build createItem input from fields with type mapping and required flags
  const createItemInput = {};
  for (const f of fields) {
    createItemInput[f.name] = { type: f.type === 'text' ? 'string' : f.type, required: true };
  }

  // Build event schema for created event
  const createdSchema = { item_id: 'uuid' };
  const firstString = fields.find(f => f.type === 'string' || f.type === 'text');
  if (firstString) {
    createdSchema[firstString.name] = 'string';
  }

  const auth = options.auth !== undefined ? options.auth : true;

  // Build route paths
  const parentPlural = belongsTo ? pluralize(belongsTo) : null;
  const parentParam = belongsTo ? `${belongsTo}Id` : null;
  const basePath = belongsTo
    ? `/api/${parentPlural}/:${parentParam}/${name}`
    : `/api/${name}`;
  const itemPath = belongsTo
    ? `/api/${parentPlural}/:${parentParam}/${name}/:id`
    : `/api/${name}/:id`;

  // Build UI paths
  const uiBasePath = belongsTo
    ? `/${parentPlural}/:${parentParam}/${name}`
    : `/${name}`;
  const uiItemPath = belongsTo
    ? `/${parentPlural}/:${parentParam}/${name}/:id`
    : `/${name}/:id`;

  const manifest = {
    name,
    version: '1.0.0',
    description: `${capName} bundle`,
    schema: {
      tables: {
        items: { columns },
      },
    },
    events: {
      publishes: [
        { name: `${name}.item.created`, schema: createdSchema },
        { name: `${name}.item.updated`, schema: { item_id: 'uuid' } },
        { name: `${name}.item.deleted`, schema: { item_id: 'uuid' } },
      ],
      subscribes: [],
    },
    interfaces: {
      queries: ['getItem', 'listItems'],
      contracts: {
        getItem: {
          description: 'Retrieve a single item by ID',
          input: { itemId: { type: 'uuid', required: true } },
          output: { type: 'object', nullable: true, shape },
        },
        listItems: {
          description: 'List all items',
          input: {},
          output: { type: 'array', shape },
        },
        createItem: {
          description: 'Create a new item',
          input: createItemInput,
          output: { type: 'object', shape },
        },
        updateItem: {
          description: 'Update an existing item',
          input: { itemId: { type: 'uuid', required: true } },
          output: { type: 'object', shape },
        },
        deleteItem: {
          description: 'Delete an item',
          input: { itemId: { type: 'uuid', required: true } },
          output: { type: 'object', shape: { deleted: 'boolean' } },
        },
      },
    },
    api: {
      routes: [
        { method: 'GET', path: basePath, handler: 'list', auth },
        { method: 'GET', path: itemPath, handler: 'get', auth },
        { method: 'POST', path: basePath, handler: 'create', auth },
        { method: 'PATCH', path: itemPath, handler: 'update', auth },
        { method: 'DELETE', path: itemPath, handler: 'remove', auth },
      ],
    },
    ui: {
      script: 'ui/index.js',
      routes: [
        { path: uiBasePath, component: `${name}-list`, fetchUrls: [basePath] },
        { path: uiItemPath, component: `${name}-detail`, fetchUrls: [itemPath] },
      ],
      navigation: [
        { label: capName, icon: 'list', path: uiBasePath },
      ],
    },
    behaviors: [
      {
        name: 'create item with valid data',
        given: [],
        when: [{ call: 'create', with: firstString ? { [firstString.name]: 'Test item' } : {} }],
        then: [
          firstString ? `result.${firstString.name} == "Test item"` : 'result.id != null',
          { event: `${name}.item.created` },
        ],
      },
    ],
    depends_on: belongsTo ? [belongsTo] : [],
    optional_deps: [],
    intents: [],
  };

  return yaml.dump(manifest, { lineWidth: -1, quotingType: '"', noRefs: true });
}
