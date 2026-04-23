import { spawn } from 'node:child_process';
import type { ViewportPreset } from './types.js';

const AGENT_BROWSER_BIN = 'agent-browser';
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const STDOUT_STDERR_EXCERPT_LENGTH = 1_000;
const BROWSER_TOOLS_SESSION_ID = `pi-browser-tools-${process.pid}`;
const AGENT_BROWSER_INSTALL_GUIDANCE = [
  'agent-browser backend selected, but the CLI is unavailable.',
  'Install with either:',
  '  brew install agent-browser && agent-browser install',
  'or',
  '  npm install -g agent-browser && agent-browser install',
].join('\n');
let agentBrowserAvailabilityCheck: Promise<void> | null = null;

export type AgentBrowserCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type AgentBrowserJsonEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: unknown;
};

export function getBrowserToolsSessionId(): string {
  return BROWSER_TOOLS_SESSION_ID;
}

export function viewportFor(
  preset: ViewportPreset = 'desktop',
  width?: number,
  height?: number,
): { width: number; height: number } {
  const base = preset === 'mobile' ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT;
  return {
    width: width ?? base.width,
    height: height ?? base.height,
  };
}

export async function runAgentBrowser(
  args: string[],
  options: { expectJson?: boolean; cwd?: string } = {},
): Promise<AgentBrowserCommandResult> {
  const finalArgs = withSessionAndJson(args, options.expectJson ?? false);

  return new Promise<AgentBrowserCommandResult>((resolve, reject) => {
    const child = spawn(AGENT_BROWSER_BIN, finalArgs, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += String(chunk);
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      reject(createSpawnError(finalArgs, error));
    });

    child.on('close', (exitCode) => {
      const result = {
        stdout,
        stderr,
        exitCode: exitCode ?? 1,
      } satisfies AgentBrowserCommandResult;

      if (result.exitCode !== 0) {
        reject(createCommandError(finalArgs, result));
        return;
      }

      resolve(result);
    });
  });
}

export async function runAgentBrowserJson<T>(
  args: string[],
  options: { cwd?: string } = {},
): Promise<T> {
  const result = await runAgentBrowser(args, {
    cwd: options.cwd,
    expectJson: true,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout.trim()) as unknown;
  } catch (error) {
    throw new Error(
      [
        `Failed to parse agent-browser JSON output for: ${formatCommand(withSessionAndJson(args, true))}`,
        `Parse error: ${error instanceof Error ? error.message : String(error)}`,
        `Stdout: ${excerpt(result.stdout)}`,
        `Stderr: ${excerpt(result.stderr)}`,
      ].join('\n'),
    );
  }

  if (isJsonEnvelope(parsed)) {
    if (parsed.success === false) {
      throw new Error(
        [
          `agent-browser returned an unsuccessful JSON response for: ${formatCommand(withSessionAndJson(args, true))}`,
          `Error: ${formatJsonError(parsed.error)}`,
          `Stdout: ${excerpt(result.stdout)}`,
          `Stderr: ${excerpt(result.stderr)}`,
        ].join('\n'),
      );
    }

    return parsed.data as T;
  }

  return parsed as T;
}

export async function assertAgentBrowserAvailable(): Promise<void> {
  agentBrowserAvailabilityCheck ??= checkAgentBrowserAvailable();
  await agentBrowserAvailabilityCheck;
}

async function checkAgentBrowserAvailable(): Promise<void> {
  type DoctorSummary = { fail?: number };
  type DoctorResponse = { success?: boolean; summary?: DoctorSummary; checks?: unknown[] };

  try {
    const result = await runAgentBrowserJson<DoctorResponse>(['doctor', '--offline', '--quick']);
    const failCount = result.summary?.fail ?? 0;

    if (result.success === false || failCount > 0) {
      throw new Error(AGENT_BROWSER_INSTALL_GUIDANCE);
    }
  } catch {
    throw new Error(AGENT_BROWSER_INSTALL_GUIDANCE);
  }
}

function withSessionAndJson(args: string[], expectJson: boolean): string[] {
  const finalArgs = [...args];

  if (expectJson && !finalArgs.includes('--json')) {
    finalArgs.push('--json');
  }

  if (!finalArgs.includes('--session')) {
    finalArgs.push('--session', getBrowserToolsSessionId());
  }

  return finalArgs;
}

function isJsonEnvelope(value: unknown): value is AgentBrowserJsonEnvelope<unknown> {
  return typeof value === 'object' && value !== null && ('data' in value || 'error' in value);
}

function createSpawnError(args: string[], error: unknown): Error {
  const command = formatCommand(args);

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  ) {
    return new Error(
      [
        `Failed to run agent-browser command: ${command}`,
        'The `agent-browser` executable was not found in PATH.',
        'Install with one of:',
        '  brew install agent-browser && agent-browser install',
        '  npm install -g agent-browser && agent-browser install',
      ].join('\n'),
    );
  }

  return new Error(
    [
      `Failed to run agent-browser command: ${command}`,
      `Spawn error: ${error instanceof Error ? error.message : String(error)}`,
    ].join('\n'),
  );
}

function createCommandError(args: string[], result: AgentBrowserCommandResult): Error {
  return new Error(
    [
      `agent-browser command failed: ${formatCommand(args)}`,
      `Exit code: ${result.exitCode}`,
      `Stdout: ${excerpt(result.stdout)}`,
      `Stderr: ${excerpt(result.stderr)}`,
    ].join('\n'),
  );
}

function formatCommand(args: string[]): string {
  return [AGENT_BROWSER_BIN, ...args].map(shellEscape).join(' ');
}

function shellEscape(value: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/u.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;
}

function excerpt(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '(empty)';
  if (trimmed.length <= STDOUT_STDERR_EXCERPT_LENGTH) return trimmed;
  return `${trimmed.slice(0, STDOUT_STDERR_EXCERPT_LENGTH)}…`;
}

function formatJsonError(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error === null || error === undefined) return 'Unknown error';

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
