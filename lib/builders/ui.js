function _cap(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_([a-z])/g, (_, c) => ' ' + c.toUpperCase());
}

export function buildUiKit() {
  return `function el(type, props = {}, children = null) { return { type, props, children }; }
export const Stack = (props, children) => el('stack', props, children);
export const Grid = (props, children) => el('grid', props, children);
export const Text = (props) => el('text', props);
export const TextField = (props) => el('text-field', props);
export const Button = (props) => el('button', props);
export const Alert = (props) => el('alert', props);
export const Card = (props, children) => el('card', props, children);
export const Badge = (props) => el('badge', props);
export const Divider = (props) => el('divider', props);
export const Spinner = (props) => el('spinner', props);
export const Form = (props, children) => el('form', props, children);
export const InlineEdit = (props) => el('inline-edit', props);
export const Icon = (props) => el('icon', props);
export const Modal = (props, children) => el('modal', props, children);
export const TabBar = (props) => el('tab-bar', props);
export const StatCard = (props) => el('stat-card', props);
export const Avatar = (props) => el('avatar', props);
export const Select = (props) => el('select', props);
export const ProgressBar = (props) => el('progress-bar', props);
export const FilterDropdown = (props) => el('filter-dropdown', props);
`;
}

export function buildListViewJs(name, fields) {
  const capName = name.charAt(0).toUpperCase() + name.slice(1);
  const stringFields = fields.filter(f => f.type === 'string' || f.type === 'text');
  const boolFields = fields.filter(f => f.type === 'boolean');
  const mainField = stringFields[0] || fields[0];
  const otherFields = fields.filter(f => f.name !== mainField.name);

  const formFieldLines = fields.map(f => {
    if (f.type === 'boolean') {
      return `        Select({ name: '${f.name}', options: [{ value: 'false', label: 'No' }, { value: 'true', label: 'Yes' }], label: '${_cap(f.name)}' }),`;
    }
    if (f.type === 'integer' || f.type === 'float') {
      return `        TextField({ name: '${f.name}', placeholder: '${_cap(f.name)}', type: 'number' }),`;
    }
    if (f.type === 'text') {
      return `        TextField({ name: '${f.name}', placeholder: '${_cap(f.name)}', multiline: true }),`;
    }
    return `        TextField({ name: '${f.name}', placeholder: '${_cap(f.name)}' }),`;
  }).join('\n');

  const cardFieldLines = otherFields.map(f => {
    if (f.type === 'boolean') {
      return `        Badge({ text: item.${f.name} ? '${_cap(f.name)}' : 'Not ${f.name}', color: item.${f.name} ? 'success' : 'default' }),`;
    }
    if (f.type === 'timestamp') {
      return `        Text({ content: item.${f.name} ? new Date(item.${f.name}).toLocaleDateString() : '', variant: 'caption', color: 'secondary' }),`;
    }
    return `        Text({ content: \`${_cap(f.name)}: \${item.${f.name} ?? ''}\`, variant: 'body2' }),`;
  }).join('\n');

  const bodyFields = fields.map(f => {
    if (f.type === 'boolean') return `        ${f.name}: e.target.elements.${f.name}.value === 'true',`;
    if (f.type === 'integer') return `        ${f.name}: parseInt(e.target.elements.${f.name}.value || '0', 10),`;
    if (f.type === 'float') return `        ${f.name}: parseFloat(e.target.elements.${f.name}.value || '0'),`;
    return `        ${f.name}: e.target.elements.${f.name}.value,`;
  }).join('\n');

  return `import { Stack, Grid, Text, TextField, Button, Alert, Card, Badge, Form, Spinner, StatCard, Select, FilterDropdown } from './ui-kit.js';

export default function ListView({ data, actions }) {
  if (!data) return Spinner({});
  const items = Array.isArray(data) ? data : [];

  return Stack({ spacing: 3, sx: { p: 3, maxWidth: 900, mx: 'auto' } }, [
    Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
      Text({ variant: 'h4', content: '${capName}' }),
      StatCard({ label: 'Total', value: items.length }),
    ]),

    Form({ onSubmit: async (e) => {
      await actions.api('/api/${name}', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
${bodyFields}
        }),
      });
      e.target.reset();
      actions.refresh();
    }}, [
      Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'flex-end', flexWrap: 'wrap' } }, [
${formFieldLines}
        Button({ label: 'Create', variant: 'contained', type: 'submit' }),
      ]),
    ]),

    ...items.map((item) =>
      Card({ sx: { cursor: 'pointer' }, onClick: () => actions.navigate('/${name}/' + item.id) }, [
        Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center', justifyContent: 'space-between' } }, [
          Text({ content: item.${mainField.name}, variant: 'subtitle1', sx: { fontWeight: 600 } }),
          item.created_at ? Text({ content: new Date(item.created_at).toLocaleDateString(), variant: 'caption', color: 'secondary' }) : null,
        ]),
${cardFieldLines}
      ])
    ),

    items.length === 0
      ? Alert({ severity: 'info', content: 'No items yet. Create one above.' })
      : null,
  ].filter(Boolean));
}
`;
}

export function buildDetailViewJs(name, fields) {
  const capName = name.charAt(0).toUpperCase() + name.slice(1);
  const stringFields = fields.filter(f => f.type === 'string' || f.type === 'text');
  const mainField = stringFields[0] || fields[0];
  const otherFields = fields.filter(f => f.name !== mainField.name);

  const fieldRenderers = otherFields.map(f => {
    if (f.type === 'string' || f.type === 'text') {
      return `    Stack({ spacing: 1 }, [
      Text({ variant: 'subtitle2', content: '${_cap(f.name)}' }),
      InlineEdit({
        value: item.${f.name} || '',
        variant: 'body1',
        onSave: async (value) => {
          await actions.api('/api/${name}/' + item.id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ${f.name}: value }),
          });
          actions.refresh();
        },
      }),
    ]),`;
    }
    if (f.type === 'boolean') {
      return `    Stack({ direction: 'row', spacing: 1, sx: { alignItems: 'center' } }, [
      Text({ variant: 'subtitle2', content: '${_cap(f.name)}:' }),
      Button({
        label: item.${f.name} ? 'Yes' : 'No',
        variant: item.${f.name} ? 'contained' : 'outlined',
        color: item.${f.name} ? 'success' : 'default',
        onClick: async () => {
          await actions.api('/api/${name}/' + item.id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ${f.name}: !item.${f.name} }),
          });
          actions.refresh();
        },
      }),
    ]),`;
    }
    if (f.type === 'integer' || f.type === 'float') {
      return `    Stack({ spacing: 1 }, [
      Text({ variant: 'subtitle2', content: '${_cap(f.name)}' }),
      InlineEdit({
        value: String(item.${f.name} ?? ''),
        variant: 'body1',
        onSave: async (value) => {
          await actions.api('/api/${name}/' + item.id, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ${f.name}: ${f.type === 'integer' ? 'parseInt(value, 10)' : 'parseFloat(value)'} }),
          });
          actions.refresh();
        },
      }),
    ]),`;
    }
    if (f.type === 'timestamp') {
      return `    Stack({ spacing: 1 }, [
      Text({ variant: 'subtitle2', content: '${_cap(f.name)}' }),
      Text({ content: item.${f.name} ? new Date(item.${f.name}).toLocaleString() : 'Not set', variant: 'body1', color: item.${f.name} ? 'default' : 'secondary' }),
    ]),`;
    }
    return `    Stack({ spacing: 1 }, [
      Text({ variant: 'subtitle2', content: '${_cap(f.name)}' }),
      Text({ content: String(item.${f.name} ?? '—'), variant: 'body1' }),
    ]),`;
  }).join('\n');

  return `import { Stack, Text, Button, Badge, Divider, InlineEdit, Spinner, Icon } from './ui-kit.js';

export default function DetailView({ data, actions }) {
  if (!data) return Spinner({});
  const item = data;

  return Stack({ spacing: 3, sx: { p: 3, maxWidth: 700, mx: 'auto' } }, [
    Stack({ direction: 'row', spacing: 2, sx: { alignItems: 'center' } }, [
      Button({ label: '← Back', variant: 'text', onClick: () => actions.navigate('/${name}') }),
      Text({ variant: 'caption', content: 'ID: ' + item.id, color: 'secondary' }),
    ]),

    InlineEdit({
      value: item.${mainField.name} || '',
      variant: 'h5',
      onSave: async (value) => {
        await actions.api('/api/${name}/' + item.id, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ${mainField.name}: value }),
        });
        actions.refresh();
      },
    }),

${fieldRenderers}

    item.created_at ? Text({ content: 'Created ' + new Date(item.created_at).toLocaleString(), variant: 'caption', color: 'secondary' }) : null,
    item.updated_at ? Text({ content: 'Updated ' + new Date(item.updated_at).toLocaleString(), variant: 'caption', color: 'secondary' }) : null,

    Divider({}),

    Button({ label: 'Delete', variant: 'outlined', color: 'error', onClick: async () => {
      await actions.api('/api/${name}/' + item.id, { method: 'DELETE' });
      actions.navigate('/${name}');
    }}),
  ].filter(Boolean));
}
`;
}

export function buildUiIndexJs(name) {
  return `import ListView from './ListView.js';
import DetailView from './DetailView.js';

export default {
  views: {
    '${name}-list': ListView,
    '${name}-detail': DetailView,
  },
};
`;
}
