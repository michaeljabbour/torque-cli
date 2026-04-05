export function buildTestJs(name, className, fields, firstStringField) {
  const sampleData = {};
  for (const f of fields) {
    if (f.type === 'string' || f.type === 'text') sampleData[f.name] = `Test ${f.name}`;
    else if (f.type === 'boolean') sampleData[f.name] = false;
    else if (f.type === 'integer') sampleData[f.name] = 42;
    else if (f.type === 'float') sampleData[f.name] = 3.14;
    else sampleData[f.name] = `test-${f.name}`;
  }

  const createBody = JSON.stringify(sampleData, null, 6).replace(/\n/g, '\n    ');

  const validationFieldName = firstStringField ? firstStringField.name : null;
  const validationLabel = validationFieldName
    ? validationFieldName.charAt(0).toUpperCase() + validationFieldName.slice(1)
    : null;

  return `import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import ${className} from '../logic.js';

function createMockData() {
  const store = {};
  return {
    insert: (table, attrs) => {
      if (!store[table]) store[table] = [];
      const record = { id: \`test-\${Date.now()}-\${Math.random()}\`, ...attrs, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      store[table].push(record);
      return { ...record };
    },
    find: (table, id) => {
      const row = (store[table] || []).find(r => r.id === id);
      return row ? { ...row } : null;
    },
    query: (table) => [...(store[table] || [])],
    update: (table, id, attrs) => {
      const idx = (store[table] || []).findIndex(r => r.id === id);
      if (idx === -1) return null;
      store[table][idx] = { ...store[table][idx], ...attrs, updated_at: new Date().toISOString() };
      return { ...store[table][idx] };
    },
    delete: (table, id) => {
      const idx = (store[table] || []).findIndex(r => r.id === id);
      if (idx === -1) return false;
      store[table].splice(idx, 1);
      return true;
    },
    _store: store,
  };
}

function createMockEvents() {
  const published = [];
  return {
    publish: (event, payload) => published.push({ event, payload }),
    published,
  };
}

describe('${name} bundle', () => {
  let bundle;
  let mockData;
  let mockEvents;

  beforeEach(() => {
    mockData = createMockData();
    mockEvents = createMockEvents();
    const mockCoordinator = { call: async () => ({}) };

    bundle = new ${className}({
      data: mockData,
      events: mockEvents,
      config: {},
      coordinator: mockCoordinator,
    });
  });

  describe('routes', () => {
    describe('create', () => {
      it('creates an item with valid data', () => {
        const routes = bundle.routes();
        const result = routes.create({ body: ${createBody} });

        assert.equal(result.status, 201);
        assert.ok(result.data.id);${firstStringField ? `\n        assert.equal(result.data.${firstStringField.name}, 'Test ${firstStringField.name}');` : ''}
      });
${validationFieldName ? `
      it('returns 422 when ${validationFieldName} is missing', () => {
        const routes = bundle.routes();
        const result = routes.create({ body: {} });

        assert.equal(result.status, 422);
        assert.equal(result.data.error, '${validationLabel} is required');
      });

      it('returns 422 when ${validationFieldName} is empty', () => {
        const routes = bundle.routes();
        const result = routes.create({ body: { ${validationFieldName}: '' } });

        assert.equal(result.status, 422);
        assert.equal(result.data.error, '${validationLabel} is required');
      });
` : ''}    });

    describe('list', () => {
      it('lists all items', () => {
        const routes = bundle.routes();
        routes.create({ body: ${createBody} });
        routes.create({ body: ${createBody} });

        const result = routes.list({ query: {} });

        assert.equal(result.status, 200);
        assert.equal(result.data.length, 2);
      });
    });

    describe('get', () => {
      it('gets an item by ID', () => {
        const routes = bundle.routes();
        const created = routes.create({ body: ${createBody} });

        const result = routes.get({ params: { id: created.data.id } });

        assert.equal(result.status, 200);
        assert.equal(result.data.id, created.data.id);
      });

      it('returns 404 for non-existent item', () => {
        const routes = bundle.routes();
        const result = routes.get({ params: { id: 'non-existent' } });

        assert.equal(result.status, 404);
        assert.equal(result.data.error, 'Item not found');
      });
    });

    describe('update', () => {
      it('updates an existing item', () => {
        const routes = bundle.routes();
        const created = routes.create({ body: ${createBody} });

        const result = routes.update({ params: { id: created.data.id }, body: { ${fields[0].name}: ${fields[0].type === 'string' || fields[0].type === 'text' ? "'Updated value'" : fields[0].type === 'boolean' ? 'true' : fields[0].type === 'integer' ? '99' : '1.5'} } });

        assert.equal(result.status, 200);
      });

      it('returns 404 for non-existent item', () => {
        const routes = bundle.routes();
        const result = routes.update({ params: { id: 'non-existent' }, body: {} });

        assert.equal(result.status, 404);
        assert.equal(result.data.error, 'Item not found');
      });
    });

    describe('remove', () => {
      it('deletes an existing item', () => {
        const routes = bundle.routes();
        const created = routes.create({ body: ${createBody} });

        const result = routes.remove({ params: { id: created.data.id } });

        assert.equal(result.status, 200);
        assert.deepEqual(result.data, { deleted: true });

        const listResult = routes.list({ query: {} });
        assert.equal(listResult.data.length, 0);
      });

      it('returns 404 for non-existent item', () => {
        const routes = bundle.routes();
        const result = routes.remove({ params: { id: 'non-existent' } });

        assert.equal(result.status, 404);
        assert.equal(result.data.error, 'Item not found');
      });
    });
  });

  describe('interfaces', () => {
    describe('getItem', () => {
      it('returns an item by ID', () => {
        const routes = bundle.routes();
        const created = routes.create({ body: ${createBody} });

        const ifaces = bundle.interfaces();
        const item = ifaces.getItem({ itemId: created.data.id });

        assert.ok(item);
        assert.equal(item.id, created.data.id);
      });

      it('returns null for non-existent ID', () => {
        const ifaces = bundle.interfaces();
        const item = ifaces.getItem({ itemId: 'does-not-exist' });

        assert.equal(item, null);
      });
    });

    describe('listItems', () => {
      it('returns all items', () => {
        const routes = bundle.routes();
        routes.create({ body: ${createBody} });
        routes.create({ body: ${createBody} });

        const ifaces = bundle.interfaces();
        const items = ifaces.listItems();

        assert.equal(items.length, 2);
      });
    });
  });

  describe('events', () => {
    it('publishes ${name}.item.created on create', () => {
      const routes = bundle.routes();
      const result = routes.create({ body: ${createBody} });

      assert.equal(mockEvents.published.length, 1);
      assert.equal(mockEvents.published[0].event, '${name}.item.created');
      assert.equal(mockEvents.published[0].payload.item_id, result.data.id);
    });

    it('publishes ${name}.item.updated on update', () => {
      const routes = bundle.routes();
      const created = routes.create({ body: ${createBody} });
      routes.update({ params: { id: created.data.id }, body: { ${fields[0].name}: ${fields[0].type === 'string' || fields[0].type === 'text' ? "'Changed'" : fields[0].type === 'boolean' ? 'true' : '1'} } });

      assert.equal(mockEvents.published.length, 2);
      assert.equal(mockEvents.published[1].event, '${name}.item.updated');
      assert.equal(mockEvents.published[1].payload.item_id, created.data.id);
    });

    it('publishes ${name}.item.deleted on remove', () => {
      const routes = bundle.routes();
      const created = routes.create({ body: ${createBody} });
      routes.remove({ params: { id: created.data.id } });

      assert.equal(mockEvents.published.length, 2);
      assert.equal(mockEvents.published[1].event, '${name}.item.deleted');
      assert.equal(mockEvents.published[1].payload.item_id, created.data.id);
    });
  });
});
`;
}
