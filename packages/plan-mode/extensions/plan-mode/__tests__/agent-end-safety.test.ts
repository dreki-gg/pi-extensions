/**
 * Regression tests for plan-mode extension wiring.
 *
 * These are static analysis tests that scan source code for common mistakes
 * that cause runtime errors in the pi extension lifecycle.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const INDEX_PATH = join(import.meta.dir, '..', 'index.ts');
const indexSource = readFileSync(INDEX_PATH, 'utf-8');

/**
 * Extract all `pi.on('agent_end', ...)` handler bodies from the source.
 *
 * The agent_end handler runs while the agent is still technically "processing",
 * so every sendUserMessage call inside it MUST include deliverAs to avoid:
 *   "Agent is already processing. Specify streamingBehavior..."
 */
function extractAgentEndBodies(source: string): string[] {
  const bodies: string[] = [];
  // Match pi.on('agent_end', ...) and extract everything until the matching });
  const pattern = /pi\.on\(\s*'agent_end'/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    const startIdx = match.index;
    // Find the handler body by counting braces
    let braceCount = 0;
    let inHandler = false;
    let bodyStart = startIdx;
    let bodyEnd = startIdx;

    for (let i = startIdx; i < source.length; i++) {
      if (source[i] === '{') {
        if (!inHandler) {
          inHandler = true;
          bodyStart = i;
        }
        braceCount++;
      } else if (source[i] === '}') {
        braceCount--;
        if (inHandler && braceCount === 0) {
          bodyEnd = i + 1;
          break;
        }
      }
    }

    bodies.push(source.slice(bodyStart, bodyEnd));
  }
  return bodies;
}

/**
 * Find all sendUserMessage calls in a code block, returning each call
 * with its line content and whether it has deliverAs.
 */
function findSendUserMessageCalls(code: string): Array<{
  line: string;
  hasDeliverAs: boolean;
  isCommand: boolean;
}> {
  const results: Array<{ line: string; hasDeliverAs: boolean; isCommand: boolean }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.includes('sendUserMessage')) continue;
    if (line.startsWith('//') || line.startsWith('*')) continue;

    // Look ahead generously — multi-line template literals can push deliverAs 12+ lines away
    const context = lines.slice(i, Math.min(i + 15, lines.length)).join(' ');
    const hasDeliverAs = context.includes('deliverAs');

    // Check if this is sending a slash command (e.g., '/plan-exec')
    const isCommand = /sendUserMessage\s*\(\s*['"`]\//.test(context);

    results.push({ line, hasDeliverAs, isCommand });
  }

  return results;
}

describe('agent_end handler safety', () => {
  test('all sendUserMessage calls inside agent_end must include deliverAs', () => {
    const bodies = extractAgentEndBodies(indexSource);
    expect(bodies.length).toBeGreaterThan(0);

    const violations: string[] = [];

    for (const body of bodies) {
      const calls = findSendUserMessageCalls(body);
      for (const call of calls) {
        if (!call.hasDeliverAs) {
          violations.push(call.line);
        }
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found sendUserMessage calls inside agent_end without deliverAs.\n` +
          `The agent is still "processing" during agent_end, so deliverAs is required.\n\n` +
          `Violations:\n${violations.map((v) => `  - ${v}`).join('\n')}\n\n` +
          `Fix: add { deliverAs: 'followUp' } to each call.`,
      );
    }
  });

  test('sendUserMessage calls sending slash commands must include deliverAs', () => {
    // Slash commands sent via sendUserMessage still go through the input pipeline
    // and need deliverAs when called during agent processing
    const bodies = extractAgentEndBodies(indexSource);

    for (const body of bodies) {
      const calls = findSendUserMessageCalls(body);
      const commandCalls = calls.filter((c) => c.isCommand);
      for (const call of commandCalls) {
        expect(call.hasDeliverAs).toBe(true);
      }
    }
  });
});
