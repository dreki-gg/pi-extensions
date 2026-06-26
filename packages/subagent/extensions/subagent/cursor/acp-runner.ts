/**
 * Run a subagent task on Cursor's Composer family via `cursor-agent acp`,
 * driven by the official @agentclientprotocol/sdk library (the current home of
 * the Agent Client Protocol TypeScript SDK, formerly @zed-industries/agent-client-protocol).
 *
 * Returns the same SpawnPiAgentResult shape as spawnPiAgent so it is a drop-in
 * backend behind dispatchSubagent — rendering, synthesis, and handoffs are
 * unchanged.
 */

import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';
import {
  ClientSideConnection,
  ndJsonStream,
  type Client,
  type RequestPermissionRequest,
  type SessionNotification,
} from '@agentclientprotocol/sdk';
import type { SpawnPiAgentOptions, SpawnPiAgentResult } from '../spawn-utils.js';
import { emptyUsage } from '../spawn-utils.js';
import { parseCursorModel } from './model.js';
import {
  buildCancelledResponse,
  buildPermissionResponse,
  selectPermissionOption,
} from './permissions.js';
import { CursorUpdateReducer } from './update-mapping.js';

const CURSOR_BIN = process.env.CURSOR_AGENT_BIN || 'cursor-agent';

export async function runCursorAcpAgent(options: SpawnPiAgentOptions): Promise<SpawnPiAgentResult> {
  const { model } = parseCursorModel(options.model);
  const displayModel = `cursor:${model}`;

  const result: SpawnPiAgentResult = {
    exitCode: 0,
    messages: [],
    stderr: '',
    wasAborted: false,
    usage: emptyUsage(),
    model: displayModel,
  };

  const reducer = new CursorUpdateReducer(displayModel);
  const seenToolCalls = new Set<string>();

  const proc = spawn(CURSOR_BIN, ['--model', model, 'acp'], {
    cwd: options.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  proc.stderr.on('data', (d: Buffer) => {
    result.stderr += d.toString();
  });

  // Bridge Node child stdio to Web streams for ndJsonStream.
  const stream = ndJsonStream(
    Writable.toWeb(proc.stdin) as WritableStream<Uint8Array>,
    Readable.toWeb(proc.stdout) as unknown as ReadableStream<Uint8Array>,
  );

  const client: Client = {
    async requestPermission(params: RequestPermissionRequest) {
      const optionId = selectPermissionOption(params.options);
      return optionId ? buildPermissionResponse(optionId) : buildCancelledResponse();
    },
    async sessionUpdate(note: SessionNotification) {
      const update = note.update;
      reducer.apply(update);

      if (update.sessionUpdate === 'tool_call' && !seenToolCalls.has(update.toolCallId)) {
        seenToolCalls.add(update.toolCallId);
        options.onToolExecutionStart?.({
          toolCallId: update.toolCallId,
          toolName: update.title || update.kind || 'tool',
          args: (update.rawInput as Record<string, unknown>) ?? {},
        });
      }

      // Live snapshot for streaming TUI updates.
      result.messages = [reducer.current()];
      options.onMessage?.(reducer.current());
    },
  };

  const conn = new ClientSideConnection(() => client, stream);

  let sessionId: string | undefined;
  const onAbort = () => {
    result.wasAborted = true;
    if (sessionId) conn.cancel({ sessionId }).catch(() => {});
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL');
    }, 5000);
  };
  if (options.signal) {
    if (options.signal.aborted) onAbort();
    else options.signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    await conn.initialize({
      protocolVersion: 1,
      clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
    });

    const session = await conn.newSession({ cwd: options.cwd, mcpServers: [] });
    sessionId = session.sessionId;

    const promptText = options.systemPrompt?.trim()
      ? `${options.systemPrompt}\n\nTask: ${options.task}`
      : `Task: ${options.task}`;

    const promptResult = await conn.prompt({
      sessionId,
      prompt: [{ type: 'text', text: promptText }],
    });

    const finalized = reducer.finalize(promptResult.stopReason);
    result.messages = finalized.messages;
    result.usage = finalized.usage;
    result.stopReason = finalized.stopReason;
    result.exitCode = result.wasAborted ? 1 : 0;
  } catch (err) {
    result.exitCode = 1;
    result.errorMessage = err instanceof Error ? err.message : String(err);
    const finalized = reducer.finalize(result.wasAborted ? 'cancelled' : 'error');
    result.messages = finalized.messages;
    result.usage = finalized.usage;
    result.stopReason = finalized.stopReason;
  } finally {
    try {
      proc.stdin.end();
    } catch {
      /* ignore */
    }
    if (!proc.killed) proc.kill();
  }

  return result;
}
