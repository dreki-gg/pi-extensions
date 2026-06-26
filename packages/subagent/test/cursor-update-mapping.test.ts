import { describe, expect, it } from 'bun:test';
import type { SessionNotification } from '@agentclientprotocol/sdk';
import { CursorUpdateReducer, mapStopReason } from '../extensions/subagent/cursor/update-mapping.js';

type Update = SessionNotification['update'];

const textChunk = (text: string): Update => ({
  sessionUpdate: 'agent_message_chunk',
  content: { type: 'text', text },
});

const toolCall = (toolCallId: string, title: string, rawInput: Record<string, unknown>): Update =>
  ({
    sessionUpdate: 'tool_call',
    toolCallId,
    title,
    rawInput,
  }) as Update;

describe('CursorUpdateReducer', () => {
  it('coalesces message chunks into one assistant text part', () => {
    const r = new CursorUpdateReducer('composer-2.5');
    r.apply(textChunk('Hello'));
    r.apply(textChunk(' world'));
    const { messages, usage } = r.finalize('end_turn');
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('assistant');
    const textPart = (messages[0] as any).content.find((p: any) => p.type === 'text');
    expect(textPart.text).toBe('Hello world');
    expect(usage.turns).toBe(1);
  });

  it('records tool calls as toolCall parts', () => {
    const r = new CursorUpdateReducer('composer-2.5');
    r.apply(textChunk('working'));
    r.apply(toolCall('t1', 'Edit file', { path: 'a.ts' }));
    const { messages } = r.finalize('end_turn');
    const parts = (messages[0] as any).content;
    const tool = parts.find((p: any) => p.type === 'toolCall');
    expect(tool.name).toBe('Edit file');
    expect(tool.arguments).toEqual({ path: 'a.ts' });
  });

  it('produces no messages when nothing was emitted', () => {
    const r = new CursorUpdateReducer('composer-2.5');
    const { messages, usage } = r.finalize();
    expect(messages).toHaveLength(0);
    expect(usage.turns).toBe(0);
  });

  it('maps stop reasons to pi StopReason', () => {
    expect(mapStopReason('end_turn')).toBe('stop');
    expect(mapStopReason('max_tokens')).toBe('length');
    expect(mapStopReason('cancelled')).toBe('aborted');
    expect(mapStopReason('refusal')).toBe('error');
    expect(mapStopReason(undefined)).toBe('stop');
  });
});
