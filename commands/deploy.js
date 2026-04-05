import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, basename } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import chalk from 'chalk';

/**
 * Parse the config/deploy.yml content into a deploy config object.
 * @param {string} yamlContent - Raw YAML content from config/deploy.yml
 * @returns {{ server: string, user: string, port: number, registry?: string, env: object }}
 */
export function parseDeployConfig(yamlContent) {
  const raw = yamlLoad(yamlContent) ?? {};
  return {
    server:   raw.server,
    user:     raw.user ?? 'deploy',
    port:     raw.port ?? 9292,
    registry: raw.registry,
    env:      raw.env ?? {},
  };
}

/**
 * Build the shell command strings for build, transfer, and run phases.
 * @param {string} appName - Name of the application (used as Docker image name)
 * @param {{ server: string, user: string, port: number, registry?: string }} config
 * @returns {{ build: string, transfer: string, run: string }}
 */
export function buildDeployCommands(appName, config) {
  const { server, user, port, registry } = config;
  const ssh = `${user}@${server}`;
  const imageTag = registry ? `${registry}:latest` : `${appName}:latest`;
  const containerName = appName;

  const build = `docker build -t ${imageTag} .`;

  let transfer;
  if (registry) {
    transfer = `docker push ${imageTag}`;
  } else {
    transfer = [
      `docker save ${imageTag}`,
      `| ssh ${ssh} 'docker load'`,
    ].join(' ');
  }

  const runBase = [
    `ssh ${ssh} 'docker stop ${containerName} 2>/dev/null || true`,
    `docker rm ${containerName} 2>/dev/null || true`,
  ];

  if (registry) {
    runBase.push(`docker pull ${imageTag}`);
  }

  runBase.push(
    `docker run -d --name ${containerName} --restart unless-stopped -p ${port}:${port} -v torque-data:/app/data --env-file .env ${imageTag}'`
  );

  const run = runBase.join(' && ');

  return { build, transfer, run };
}

/**
 * Deploy the application to a VPS.
 * Reads config/deploy.yml, verifies Dockerfile exists, then builds/transfers/runs.
 * @returns {Promise<number>} Exit code — 0 on success, 1 on failure
 */
export default async function deploy() {
  const cwd = resolve(process.cwd());
  const configPath = resolve(cwd, 'config', 'deploy.yml');
  const dockerfilePath = resolve(cwd, 'Dockerfile');
  const appName = basename(cwd);

  console.log();
  console.log(chalk.bold.cyan('  ▲  Torque Deploy'));
  console.log();

  // Check for deploy config
  if (!existsSync(configPath)) {
    console.error(chalk.red('  ✗ config/deploy.yml not found'));
    console.log(chalk.dim('  Create config/deploy.yml with your server settings.'));
    console.log();
    return 1;
  }

  // Check for Dockerfile
  if (!existsSync(dockerfilePath)) {
    console.error(chalk.red('  ✗ Dockerfile not found'));
    console.log(chalk.dim('  A Dockerfile is required to build the production image.'));
    console.log();
    return 1;
  }

  let config;
  try {
    const yamlContent = readFileSync(configPath, 'utf8');
    config = parseDeployConfig(yamlContent);
  } catch (err) {
    console.error(chalk.red(`  ✗ Failed to parse config/deploy.yml: ${err.message}`));
    return 1;
  }

  if (!config.server) {
    console.error(chalk.red('  ✗ config/deploy.yml must specify a server'));
    return 1;
  }

  const cmds = buildDeployCommands(appName, config);

  console.log(chalk.dim(`  Server: ${config.user}@${config.server}`));
  console.log(chalk.dim(`  Port:   ${config.port}`));
  if (config.registry) {
    console.log(chalk.dim(`  Registry: ${config.registry}`));
  }
  console.log();

  try {
    // Step 1: Build
    console.log(chalk.cyan('  ● Building Docker image...'));
    execSync(cmds.build, { stdio: 'inherit', cwd });
    console.log(chalk.green('  ✓ Build complete'));
    console.log();

    // Step 2: Transfer
    if (config.registry) {
      console.log(chalk.cyan('  ● Pushing image to registry...'));
    } else {
      console.log(chalk.cyan('  ● Transferring image to server...'));
    }
    execSync(cmds.transfer, { stdio: 'inherit', cwd, shell: true });
    console.log(chalk.green('  ✓ Transfer complete'));
    console.log();

    // Step 3: Run
    console.log(chalk.cyan('  ● Starting container on server...'));
    execSync(cmds.run, { stdio: 'inherit', cwd, shell: true });
    console.log(chalk.green('  ✓ Deployed successfully'));
    console.log();

    console.log(chalk.bold.green(`  ▲ App is live at http://${config.server}:${config.port}`));
    console.log();

    return 0;
  } catch (err) {
    console.error();
    console.error(chalk.red(`  ✗ Deploy failed: ${err.message}`));
    console.log();
    return 1;
  }
}
