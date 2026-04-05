/**
 * Optional AI integration for Torque CLI.
 * Requires ANTHROPIC_API_KEY env var and @anthropic-ai/claude-agent-sdk.
 * Falls back gracefully when unavailable.
 */

let sdk = null;

export function isAIAvailable() {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  try {
    // Dynamic import check — will be resolved at call time via loadSDK()
    return true;
  } catch {
    return false;
  }
}

async function loadSDK() {
  if (sdk) return sdk;
  try {
    sdk = await import('@anthropic-ai/claude-agent-sdk');
    return sdk;
  } catch {
    return null;
  }
}

export async function callClaude(prompt, options = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set. Run: export ANTHROPIC_API_KEY=sk-ant-...');
  }

  const mod = await loadSDK();
  if (!mod) {
    throw new Error(
      '@anthropic-ai/claude-agent-sdk not installed. Run: npm install @anthropic-ai/claude-agent-sdk',
    );
  }

  try {
    const { query } = mod;
    const results = [];

    for await (const message of query({
      prompt,
      options: {
        maxTurns: options.maxTurns || 10,
        allowedTools: options.allowedTools || [],
        systemPrompt: options.systemPrompt || '',
        ...options,
      },
    })) {
      if (message.type === 'assistant' && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === 'text') {
            results.push(block.text);
            if (options.stream) process.stdout.write(block.text);
          }
        }
      }
      if (message.type === 'result' && message.subtype === 'success') {
        results.push(message.result);
      }
    }

    return results.join('\n');
  } catch (err) {
    throw new Error(`Claude SDK error: ${err.message}`);
  }
}

export async function getSystemPrompt(appDir) {
  const { readFileSync, existsSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');

  let prompt = 'You are an expert on the Torque composable monolith framework.\n\n';

  try {
    // Foundation context
    const contextDir = join(appDir, 'foundation', 'context');
    if (existsSync(contextDir)) {
      for (const f of readdirSync(contextDir)) {
        if (f.endsWith('.md')) {
          prompt += readFileSync(join(contextDir, f), 'utf8') + '\n\n';
        }
      }
    }

    // Bundle agent guides
    const bundlesDir = join(appDir, 'bundles');
    if (existsSync(bundlesDir)) {
      for (const b of readdirSync(bundlesDir)) {
        const agentPath = join(bundlesDir, b, 'agent.md');
        if (existsSync(agentPath)) {
          prompt += `## Bundle: ${b}\n` + readFileSync(agentPath, 'utf8') + '\n\n';
        }
      }
    }
  } catch {
    // Gracefully degrade — return whatever we have so far
  }

  return prompt;
}
