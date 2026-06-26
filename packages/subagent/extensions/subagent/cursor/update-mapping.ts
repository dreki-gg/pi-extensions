/**
 * Map Cursor ACP `session/update` notifications into the pi Message[] +
 * UsageStats shape the rest of the subagent code consumes.
 *
 * A single ACP prompt turn is accumulated into one pi AssistantMessage whose
 * content interleaves text parts and toolCall parts in arrival order, so the
 * existing renderers (getFinalOutput / getDisplayItems) work unchanged.
 */

import type {
  AssistantMessage,
  Message,
  StopReason,
  TextContent,
  ThinkingContent,
  ToolCall,
} from '@earendil-works/pi-ai';
import type { SessionNotification } from '@agentclientprotocol/sdk';
import type { UsageStats } from '../agent-runner-types.js';
import { emptyUsage } from '../spawn-utils.js';

type SessionUpdate = SessionNotification['update'];

function blockText(content: { type: string; text?: string }): string {
  return content?.type === 'text' ? (content.text ?? '') : '';
}

export function mapStopReason(raw?: string): StopReason {
  switch (raw) {
    case 'end_turn':
    case 'completed':
      return 'stop';
    case 'max_tokens':
    case 'max_turn_requests':
      return 'length';
    case 'cancelled':
      return 'aborted';
    case 'refusal':
    case 'error':
      return 'error';
    default:
      return 'stop';
  }
}

/**
 * Accumulates ACP session updates into a single pi assistant message.
 * Stateful but free of I/O — unit-testable by feeding `apply()` a sequence.
 */
export class CursorUpdateReducer {
  private readonly assistant: AssistantMessage;
  private hasContent = false;
  readonly usage: UsageStats = emptyUsage();

  constructor(model: string) {
    this.assistant = {
      role: 'assistant',
      content: [],
      api: 'cursor-acp',
      provider: 'cursor',
      model,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: 'stop',
      timestamp: Date.now(),
    };
  }

  /** Apply one `update` payload from a SessionNotification. */
  apply(update: SessionUpdate): void {
    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const text = blockText(update.content);
        if (text) {
          this.markTurn();
          this.appendText(text);
        }
        break;
      }
      case 'agent_thought_chunk': {
        const text = blockText(update.content);
        if (text) {
          this.markTurn();
          const part: ThinkingContent = { type: 'thinking', thinking: text };
          this.assistant.content.push(part);
        }
        break;
      }
      case 'tool_call': {
        this.markTurn();
        const part: ToolCall = {
          type: 'toolCall',
          id: update.toolCallId,
          name: update.title || update.kind || 'tool',
          arguments: (update.rawInput as Record<string, unknown>) ?? {},
        };
        this.assistant.content.push(part);
        break;
      }
      // tool_call_update / plan / available_commands_update / current_mode_update:
      // no projection needed for subagent output.
      default:
        break;
    }
  }

  private markTurn(): void {
    if (!this.hasContent) {
      this.hasContent = true;
      this.usage.turns = Math.max(this.usage.turns, 1);
    }
  }

  private appendText(text: string): void {
    const last = this.assistant.content.at(-1);
    if (last && last.type === 'text') {
      (last as TextContent).text += text;
    } else {
      const part: TextContent = { type: 'text', text };
      this.assistant.content.push(part);
    }
  }

  /** Current assistant message (live snapshot for streaming callbacks). */
  current(): AssistantMessage {
    return this.assistant;
  }

  /** Finalize and return the collected messages + usage. */
  finalize(rawStopReason?: string): { messages: Message[]; usage: UsageStats; stopReason: string } {
    this.assistant.stopReason = mapStopReason(rawStopReason);
    const messages: Message[] = this.hasContent ? [this.assistant] : [];
    return { messages, usage: this.usage, stopReason: rawStopReason ?? 'end_turn' };
  }
}
