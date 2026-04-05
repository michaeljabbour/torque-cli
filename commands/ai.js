import { resolve } from 'node:path';
import { isAIAvailable, callClaude, getSystemPrompt } from '../lib/ai.js';
import chalk from 'chalk';

export default async function ai() {
  const prompt = process.argv.slice(3).join(' ');

  if (!prompt) {
    console.log('Usage: torque ai <prompt>');
    console.log('');
    console.log('Examples:');
    console.log('  torque ai "how does auth work in this app?"');
    console.log('  torque ai "generate a manifest for a comments bundle"');
    console.log('  torque ai "explain the event flow when a card is moved"');
    console.log('');
    console.log('Requires: ANTHROPIC_API_KEY environment variable');
    return 0;
  }

  if (!isAIAvailable()) {
    console.error(chalk.yellow('AI features require ANTHROPIC_API_KEY.'));
    console.error('');
    console.error('Set it up:');
    console.error('  export ANTHROPIC_API_KEY=sk-ant-...');
    console.error('');
    console.error('Get your key at: https://console.anthropic.com/');
    return 1;
  }

  const appDir = resolve(process.cwd());
  const systemPrompt = await getSystemPrompt(appDir);

  console.log(chalk.dim('Thinking...'));
  console.log('');

  try {
    await callClaude(prompt, {
      systemPrompt,
      stream: true,
      maxTurns: 5,
      allowedTools: ['Read', 'Grep', 'Glob'],
    });
    console.log('');
  } catch (err) {
    console.error(chalk.red('AI error: ' + err.message));
    return 1;
  }

  return 0;
}
