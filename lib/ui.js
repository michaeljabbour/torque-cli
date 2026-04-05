import chalk from 'chalk';
import ora from 'ora';

export const heading = (text) => console.log(chalk.bold(text));
export const success = (text) => console.log(chalk.green('  \u2713 ') + text);
export const error = (text) => console.error(chalk.red('  \u2717 ') + text);
export const warn = (text) => console.log(chalk.yellow('  \u26a0 ') + text);
export const info = (text) => console.log(chalk.blue('  \u2139 ') + text);
export const fileCreated = (path) => console.log(chalk.dim('    ') + path);
export const spinner = (text) => ora({ text, color: 'blue' }).start();
export const banner = (name, version) => {
  console.log();
  console.log(chalk.bold.blue('  Torque') + chalk.dim(` v${version || '0.1.0'}`));
  console.log();
};
