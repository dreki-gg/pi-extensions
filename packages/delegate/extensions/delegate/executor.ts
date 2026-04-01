import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  withFileMutationQueue,
  getAgentDir,
  parseFrontmatter,
} from '@mariozechner/pi-coding-agent';
import type { Message } from '@mariozechner/pi-ai';
import type { AgentResult, UsageStats } from './types';

export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  source: 'user' | 'project';
  filePath: string;
}

function loadAgentsFromDir(dir: string, source: 'user' | 'project'): AgentConfig[] {
  if (!fs.existsSync(dir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const agents: AgentConfig[] = [];
  for (const entry of entries) {
    if (!entry.name.endsWith('.md')) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);
    if (!frontmatter.name || !frontmatter.description) continue;

    const tools = frontmatter.tools
      ?.split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: tools && tools.length > 0 ? tools : undefined,
      model: frontmatter.model,
      systemPrompt: body,
      source,
      filePath,
    });
  }

  return agents;
}

export function discoverAgents(): AgentConfig[] {
  const userDir = path.join(getAgentDir(), 'agents');
  return loadAgentsFromDir(userDir, 'user');
}

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
  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pi-delegate-'));
  const safeName = agentName.replace(/[^\w.-]+/g, '_');
  const filePath = path.join(tmpDir, `prompt-${safeName}.md`);
  await withFileMutationQueue(filePath, async () => {
    await fs.promises.writeFile(filePath, prompt, { encoding: 'utf-8', mode: 0o600 });
  });
  return { dir: tmpDir, filePath };
}

export type OnPhaseUpdate = (phaseName: string, agentName: string, result: AgentResult) => void;

export async function runAgent(
  cwd: string,
  agentName: string,
  task: string,
  onUpdate?: OnPhaseUpdate,
  phaseName?: string,
): Promise<AgentResult> {
  const agents = discoverAgents();
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
        cwd,
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

          if (onUpdate) onUpdate(phaseName ?? 'unknown', agentName, { ...result });
        }

        if (event.type === 'tool_result_end' && event.message) {
          result.messages.push(event.message as Message);
          if (onUpdate) onUpdate(phaseName ?? 'unknown', agentName, { ...result });
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
  onUpdate?: OnPhaseUpdate,
  phaseName?: string,
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
        results[current] = await runAgent(cwd, agentNames[current], task, onUpdate, phaseName);
      }
    });

  await Promise.all(workers);
  return results;
}
