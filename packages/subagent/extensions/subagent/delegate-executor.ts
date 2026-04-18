import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { withFileMutationQueue } from '@mariozechner/pi-coding-agent';
import type { Message } from '@mariozechner/pi-ai';
import { discoverAgents, type AgentScope } from './agents';
import type { AgentResult, UsageStats } from './delegate-types';

function emptyUsage(): UsageStats {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) return { command: process.execPath, args };

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

export type OnPhaseUpdate = (phaseName: string, agentName: string, result: AgentResult) => void;

export interface RunAgentOptions {
  agentScope?: AgentScope;
  cwd?: string;
  onUpdate?: OnPhaseUpdate;
  phaseName?: string;
  signal?: AbortSignal;
}

export async function runAgent(
  cwd: string,
  agentName: string,
  task: string,
  options: RunAgentOptions = {},
): Promise<AgentResult> {
  const { agents } = discoverAgents(cwd, options.agentScope ?? 'user');
  const agent = agents.find((a) => a.name === agentName);

  if (!agent) {
    const available = agents.map((a) => a.name).join(', ') || 'none';
    return {
      agent: agentName,
      task,
      exitCode: 1,
      messages: [],
      stderr: `Unknown agent: "${agentName}". Available: ${available}.`,
      usage: emptyUsage(),
    };
  }

  const args: string[] = ['--mode', 'json', '-p', '--no-session'];
  if (agent.model) args.push('--model', agent.model);
  if (agent.thinking) args.push('--thinking', agent.thinking);
  if (agent.tools && agent.tools.length > 0) args.push('--tools', agent.tools.join(','));

  let tmpPromptDir: string | null = null;
  let tmpPromptPath: string | null = null;

  const result: AgentResult = {
    agent: agentName,
    task,
    exitCode: 0,
    messages: [],
    stderr: '',
    usage: emptyUsage(),
    model: agent.model,
  };

  try {
    if (agent.systemPrompt.trim()) {
      const tmp = await writePromptToTempFile(agent.name, agent.systemPrompt);
      tmpPromptDir = tmp.dir;
      tmpPromptPath = tmp.filePath;
      args.push('--append-system-prompt', tmpPromptPath);
    }

    args.push(`Task: ${task}`);

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd: options.cwd ?? cwd,
        shell: false,
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

          if (options.onUpdate)
            options.onUpdate(options.phaseName ?? 'unknown', agentName, { ...result });
        }

        if (event.type === 'tool_result_end' && event.message) {
          result.messages.push(event.message as Message);
          if (options.onUpdate)
            options.onUpdate(options.phaseName ?? 'unknown', agentName, { ...result });
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
}

export async function runParallel(
  cwd: string,
  agentNames: string[],
  task: string,
  options: RunAgentOptions = {},
): Promise<AgentResult[]> {
  const MAX_CONCURRENCY = 4;
  const results: AgentResult[] = new Array(agentNames.length);
  let nextIndex = 0;

  const workers = new Array(Math.min(MAX_CONCURRENCY, agentNames.length))
    .fill(null)
    .map(async () => {
      while (true) {
        const current = nextIndex++;
        if (current >= agentNames.length) return;
        results[current] = await runAgent(cwd, agentNames[current], task, options);
      }
    });

  await Promise.all(workers);
  return results;
}
