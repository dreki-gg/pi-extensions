import type { AgentResult } from './agent-runner-types.js';

export function getFinalText(result: AgentResult): string {
  for (let i = result.messages.length - 1; i >= 0; i--) {
    const msg = result.messages[i];
    if (msg.role !== 'assistant') continue;
    for (const part of msg.content) {
      if (part.type === 'text') return part.text;
    }
  }
  return '(no output)';
}
