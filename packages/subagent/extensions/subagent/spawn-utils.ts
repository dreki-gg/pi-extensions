/**
 * Shared utilities for spawning pi subagent processes.
 * Used by both the `subagent` tool (index.ts) and the `/run-agent` command (agent-runner.ts).
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { withFileMutationQueue } from '@earendil-works/pi-coding-agent';
import type { Message } from '@earendil-works/pi-ai';
import type { UsageStats } from './agent-runner-types.js';

export function emptyUsage(): UsageStats {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];

  // Bun standalone binaries set argv[1] to a virtual FS path (e.g. /$bunfs/root/pi)
  // that only resolves inside the running Bun process. Skip it — the binary IS the entry point.
  const isBunVirtualPath = currentScript?.startsWith('/$bunfs/');

  if (currentScript && !isBunVirtualPath && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    // Standalone binary (e.g. pi compiled with Bun) — invoke directly
    return { command: process.execPath, args };
  }

  return { command: 'pi', args };
}

async function writePromptToTempFile(
  agentName: string,
  prompt: string,
): Promise<{ dir: string; filePath: string }> {
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pi-subagent-'));
  const safeName = agentName.replace(/[^\w.-]+/g, '_');
  const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
  await withFileMutationQueue(filePath, async () => {
    await fs.promises.writeFile(filePath, prompt, { encoding: 'utf-8', mode: 0o600 });
  });
  return { dir: tmpDir, filePath };
}

function cleanupTempFiles(tmpPromptPath: string | null, tmpPromptDir: string | null): void {
  if (tmpPromptPath)
    try {
      fs.unlinkSync(tmpPromptPath);
    } catch {
      /* ignore */
    }
  if (tmpPromptDir)
    try {
      fs.rmdirSync(tmpPromptDir);
    } catch {
      /* ignore */
    }
}

export interface ToolExecutionStartEvent {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

export interface SpawnPiAgentOptions {
  cwd: string;
  agentName: string;
  task: string;
  systemPrompt?: string;
  model?: string;
  thinking?: string;
  tools?: string[];
  signal?: AbortSignal;
  onMessage?: (msg: Message) => void;
  onToolResult?: (msg: Message) => void;
  onToolExecutionStart?: (event: ToolExecutionStartEvent) => void;
}

export interface SpawnPiAgentResult {
  exitCode: number;
  messages: Message[];
  stderr: string;
  wasAborted: boolean;
  usage: UsageStats;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
}

/**
 * Spawn a pi process for a subagent and collect results.
 * This is the shared core that both the tool and the /run-agent command use.
 */
export async function spawnPiAgent(options: SpawnPiAgentOptions): Promise<SpawnPiAgentResult> {
  const args: string[] = ['--mode', 'json', '-p', '--no-session'];
  if (options.model) args.push('--model', options.model);
  if (options.thinking) args.push('--thinking', options.thinking);
  if (options.tools && options.tools.length > 0) args.push('--tools', options.tools.join(','));

  let tmpPromptDir: string | null = null;
  let tmpPromptPath: string | null = null;

  const result: SpawnPiAgentResult = {
    exitCode: 0,
    messages: [],
    stderr: '',
    wasAborted: false,
    usage: emptyUsage(),
  };

  try {
    if (options.systemPrompt?.trim()) {
      const tmp = await writePromptToTempFile(options.agentName, options.systemPrompt);
      tmpPromptDir = tmp.dir;
      tmpPromptPath = tmp.filePath;
      args.push('--append-system-prompt', tmpPromptPath);
    }

    args.push(`Task: ${options.task}`);

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const needsShell = process.platform === 'win32' && invocation.command === 'pi';
      const proc = spawn(invocation.command, invocation.args, {
        cwd: options.cwd,
        shell: needsShell,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let buffer = '';

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        if (event.type === 'message_end' && event.message) {
          const msg = event.message as Message;
          result.messages.push(msg);

          if (msg.role === 'assistant') {
            result.usage.turns++;
            const usage = msg.usage;
            if (usage) {
              result.usage.input += usage.input || 0;
              result.usage.output += usage.output || 0;
              result.usage.cacheRead += usage.cacheRead || 0;
              result.usage.cacheWrite += usage.cacheWrite || 0;
              result.usage.cost += usage.cost?.total || 0;
              result.usage.contextTokens = usage.totalTokens || 0;
            }
            if (!result.model && msg.model) result.model = msg.model;
            if (msg.stopReason) result.stopReason = msg.stopReason;
            if (msg.errorMessage) result.errorMessage = msg.errorMessage;
          }

          options.onMessage?.(msg);
        }

        if (event.type === 'tool_result_end' && event.message) {
          result.messages.push(event.message as Message);
          options.onToolResult?.(event.message as Message);
        }

        if (event.type === 'tool_execution_start' && event.toolName) {
          options.onToolExecutionStart?.({
            toolCallId: event.toolCallId ?? '',
            toolName: event.toolName,
            args: event.args ?? {},
          });
        }
      };

      proc.stdout.on('data', (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) processLine(line);
      });

      proc.stderr.on('data', (data: Buffer) => {
        result.stderr += data.toString();
      });

      proc.on('close', (code: number | null) => {
        if (buffer.trim()) processLine(buffer);
        resolve(code ?? 0);
      });

      proc.on('error', () => resolve(1));

      if (options.signal) {
        const killProc = () => {
          result.wasAborted = true;
          proc.kill('SIGTERM');
          setTimeout(() => {
            if (!proc.killed) proc.kill('SIGKILL');
          }, 5000);
        };
        if (options.signal.aborted) killProc();
        else options.signal.addEventListener('abort', killProc, { once: true });
      }
    });

    result.exitCode = exitCode;
    return result;
  } finally {
    cleanupTempFiles(tmpPromptPath, tmpPromptDir);
  }
}
