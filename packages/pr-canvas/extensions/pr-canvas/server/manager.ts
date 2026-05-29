import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { get } from 'node:http';
import { ServerStartError, ServerStopError } from '../effect/errors';

export interface ServerManager {
  start(options: { port: number; wsBridgeUrl: string }): Promise<void>;
  stop(): Promise<void>;
  readonly isRunning: boolean;
  readonly port: number | null;
  readonly url: string | null;
}

/**
 * Manage the SolidStart server as a child process.
 * Spawns `node .output/server/index.mjs` and polls for readiness.
 */
export function createServerManager(appDir: string): ServerManager {
  let childProcess: ChildProcess | null = null;
  let activePort: number | null = null;

  return {
    get isRunning() {
      return childProcess !== null && !childProcess.killed;
    },

    get port() {
      return activePort;
    },

    get url() {
      return activePort ? `http://localhost:${activePort}` : null;
    },

    async start(options) {
      if (childProcess && !childProcess.killed) {
        throw new ServerStartError({ reason: 'Server is already running' });
      }

      const serverEntry = join(appDir, '.output', 'server', 'index.mjs');

      childProcess = spawn('node', [serverEntry], {
        env: {
          ...process.env,
          PORT: String(options.port),
          HOST: '0.0.0.0',
          WS_BRIDGE_URL: options.wsBridgeUrl,
          NODE_ENV: 'production',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      activePort = options.port;

      // Handle unexpected crashes
      childProcess.on('exit', (code) => {
        if (code !== null && code !== 0) {
          childProcess = null;
          activePort = null;
        }
      });

      childProcess.on('error', () => {
        childProcess = null;
        activePort = null;
      });

      // Wait for server to be ready by polling
      await waitForReady(`http://localhost:${options.port}`, 15_000, 500);
    },

    async stop() {
      if (!childProcess) return;

      const proc = childProcess;
      childProcess = null;
      activePort = null;

      // Try graceful shutdown first
      proc.kill('SIGTERM');

      const exited = await Promise.race([
        new Promise<boolean>((resolve) => {
          proc.on('exit', () => resolve(true));
        }),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), 5_000);
        }),
      ]);

      // Force kill if graceful shutdown didn't work
      if (!exited && !proc.killed) {
        proc.kill('SIGKILL');
      }
    },
  };
}

/**
 * Poll a URL until it responds with 200, or timeout.
 */
function waitForReady(url: string, timeoutMs: number, intervalMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    function poll() {
      if (Date.now() > deadline) {
        reject(new ServerStartError({ reason: `Server did not become ready within ${timeoutMs}ms` }));
        return;
      }

      const req = get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          setTimeout(poll, intervalMs);
        }
        res.resume(); // drain response
      });

      req.on('error', () => {
        setTimeout(poll, intervalMs);
      });

      req.end();
    }

    poll();
  });
}

/**
 * Resolve the app directory relative to the extension's location.
 */
export function resolveAppDir(): string {
  // In the published package, app/.output is next to extensions/
  // Walk up from this file: extensions/pr-canvas/server/manager.ts → package root
  return join(__dirname, '..', '..', '..', 'app');
}
