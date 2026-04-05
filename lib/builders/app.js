export function generateBootJs({ shell, auth }) {
  const useAuth = auth !== undefined ? auth : (shell === 'react');

  if (shell === 'react') {
    const authResolver = useAuth ? `
  authResolver: (req, registry) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7);
    try {
      const identity = registry.bundleInstance('iam') || registry.bundleInstance('identity');
      return identity.validateToken(token);
    } catch { return null; }
  },` : '';

    return `import { boot } from '@torquedev/core/boot';
import { createShell } from '@torquedev/shell-react';
import { createTypeValidator } from '@torquedev/schema';
import { appConfig } from './config/app.js';

await boot({
  plan: process.env.MOUNT_PLAN || 'config/mount_plans/development.yml',
  db: process.env.DB_PATH || 'data/dev.sqlite3',
  port: parseInt(process.env.PORT || '9292', 10),
  typeValidator: createTypeValidator(),
  shell: createShell(appConfig),${authResolver}
});
`;
  }

  if (useAuth) {
    return `import { boot } from '@torquedev/core/boot';
import { createTypeValidator } from '@torquedev/schema';

await boot({
  plan: process.env.MOUNT_PLAN || 'config/mount_plans/development.yml',
  db: process.env.DB_PATH || 'data/dev.sqlite3',
  port: parseInt(process.env.PORT || '9292', 10),
  typeValidator: createTypeValidator(),
  authResolver: (req, registry) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice(7);
    try {
      const auth = registry.bundleInstance('iam') || registry.bundleInstance('identity');
      return auth.validateToken(token);
    } catch { return null; }
  },
});
`;
  }

  return `import { boot } from '@torquedev/core/boot';
import { createTypeValidator } from '@torquedev/schema';

await boot({
  plan: process.env.MOUNT_PLAN || 'config/mount_plans/development.yml',
  db: process.env.DB_PATH || 'data/dev.sqlite3',
  port: parseInt(process.env.PORT || '9292', 10),
  typeValidator: createTypeValidator(),
});
`;
}

export function generatePackageJson(name, { shell, auth }) {
  // Core Torque framework dependencies (no React/MUI — framework-agnostic)
  const deps = {
    '@torquedev/core': 'github:michaeljabbour/torque-core',
    '@torquedev/datalayer': 'github:michaeljabbour/torque-service-datalayer',
    '@torquedev/eventbus': 'github:michaeljabbour/torque-service-eventbus',
    '@torquedev/server': 'github:michaeljabbour/torque-service-server',
    '@torquedev/schema': 'github:michaeljabbour/torque-schema',
    'bcryptjs': '^2.4.3',
    'better-sqlite3': '^11.0.0',
    'express': '^4.21.0',
    'js-yaml': '^4.1.0',
    'jsonwebtoken': '^9.0.0',
    'uuid': '^10.0.0',
  };

  if (shell === 'react') {
    deps['@torquedev/shell-react'] = 'github:michaeljabbour/torque-shell-react';
  }

  const pkg = {
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      start: 'torque start',
      dev: 'torque dev',
      seed: 'torque seed',
      test: "node --test 'bundles/*/test/*.test.js'",
    },
    dependencies: deps,
  };

  return JSON.stringify(pkg, null, 2) + '\n';
}

export function generateAppConfig(name, { shell, auth }) {
  if (shell !== 'react') return '';

  const useAuth = auth !== undefined ? auth : true;

  const authBlock = useAuth
    ? `  auth: {
    bundle: 'identity',
    loginPath: '/login',
    homePath: '/',
  },
`
    : `  auth: {
    loginPath: '/login',
    homePath: '/',
  },
`;

  return `export const appConfig = {
  app: {
    name: '${name}',
  },
  theme: {
    primaryColor: '#1976d2',
    mode: 'light',
  },
  branding: {
    title: '${name}',
    logo: null,
  },
${authBlock}  shell: {
    provider: 'react',
    layout: 'sidebar',
  },
};
`;
}

export function generateMountPlan(name, { bundles, template }) {
  const header = `app:
  name: "${name}"
  description: "A Torque application"

`;

  // Template-based mount plan
  if (template) {
    let plan = header;
    plan += `bundles:\n`;

    // If template includes IAM bundle, add jwt config; otherwise add legacy identity
    const hasIAM = template.bundles && ('iam' in template.bundles);
    if (template.identity && !hasIAM) {
      plan += `  identity:
    source: "git+https://github.com/michaeljabbour/torque-bundle-identity.git@main"
    enabled: true
    config:
      jwt_secret: "torque-dev-secret"
      token_expiry: "7d"

`;
    }

    // Template bundles from git sources
    const templateBundles = template.bundles || {};
    const bundleEntries = typeof templateBundles === 'object' && !Array.isArray(templateBundles)
      ? Object.entries(templateBundles)
      : templateBundles.map(b => [b, `path:./bundles/${b}`]);
    for (const [bName, source] of bundleEntries) {
      const isAuth = bName === 'iam' || bName === 'identity';
      const config = isAuth
        ? `config:\n      jwt_secret: "torque-dev-secret"\n      token_expiry: "7d"`
        : `config: {}`;
      plan += `  ${bName}:\n    source: "${source}"\n    enabled: true\n    ${config}\n\n`;
    }

    return plan;
  }

  if (bundles === 'empty') {
    return header + `bundles: {}\n`;
  }

  if (bundles === 'auth') {
    return (
      header +
      `bundles:
  identity:
    source: "@torquedev/identity"
    config:
      jwt_secret: "torque-dev-secret"
      token_expiry: "7d"
`
    );
  }

  if (bundles === 'all') {
    return (
      header +
      `bundles:
  identity:
    source: "@torquedev/identity"
    config:
      jwt_secret: "torque-dev-secret"
      token_expiry: "7d"

  pipeline:
    source: "@torquedev/pipeline"
    config:
      default_stages:
        - name: "New"
          order: 1
        - name: "In Progress"
          order: 2
        - name: "Done"
          order: 3

  pulse:
    source: "@torquedev/pulse"
    config:
      retention_days: 90

  tasks:
    source: "@torquedev/tasks"
    config:
      default_assignee: null
`
    );
  }

  // Unknown bundles value — default to empty
  return header + `bundles: {}
`;
}

export function generateDockerfile() {
  return `FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

# Mount torque-data:/app/data as a named volume in production
VOLUME /app/data

EXPOSE 9292

CMD ["node", "boot.js"]
`;
}

export function generateDeployYml() {
  return `# Torque deploy configuration
# Update server, user, and registry before deploying

server: 0.0.0.0  # replace with your server IP or hostname
user: deploy
port: 9292
# registry: ghcr.io/your-org/your-app

env:
  AUTH_SECRET: \${AUTH_SECRET}
  NODE_ENV: production
`;
}

export function generateEnvExample() {
  return `AUTH_SECRET=change-me
NODE_ENV=production
PORT=9292
DB_PATH=data/production.sqlite3
`;
}
