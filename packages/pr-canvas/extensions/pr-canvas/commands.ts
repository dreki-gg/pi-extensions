import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createWsBridge, type WsBridge } from './server/ws-bridge';
import { createServerManager, resolveAppDir, type ServerManager } from './server/manager';
import { createMessageHandlers } from './server/handlers';

const WS_PORT = 3001;
const APP_PORT = 3000;

export function registerPrCanvasCommands(pi: ExtensionAPI) {
  let bridge: WsBridge | null = null;
  let manager: ServerManager | null = null;

  async function startServer(ctx: { ui: { notify: Function; setStatus: Function } }) {
    // 1. Check gh auth
    ctx.ui.setStatus('pr-canvas', '🔍 Checking gh CLI...');
    try {
      const authResult = await pi.exec('gh', ['auth', 'status']);
      if (authResult.code !== 0) {
        ctx.ui.notify(
          `gh CLI not authenticated: ${authResult.stderr}\nRun \`gh auth login\` first.`,
          'error',
        );
        ctx.ui.setStatus('pr-canvas', undefined);
        return;
      }
    } catch {
      ctx.ui.notify(
        'gh CLI not found. Install from https://cli.github.com/ and run `gh auth login`.',
        'error',
      );
      ctx.ui.setStatus('pr-canvas', undefined);
      return;
    }

    // 2. Start WebSocket bridge
    ctx.ui.setStatus('pr-canvas', '🔌 Starting WebSocket bridge...');
    bridge = createWsBridge();
    const handlers = createMessageHandlers(
      (cmd, args) => pi.exec(cmd, args),
      undefined, // AI chat — will be wired later
    );
    bridge.onMessage(handlers);

    try {
      await bridge.start(WS_PORT);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      ctx.ui.notify(`Failed to start WebSocket bridge: ${msg}`, 'error');
      ctx.ui.setStatus('pr-canvas', undefined);
      bridge = null;
      return;
    }

    // 3. Start SolidStart server
    ctx.ui.setStatus('pr-canvas', '🚀 Starting PR Canvas server...');
    const appDir = resolveAppDir();
    manager = createServerManager(appDir);

    try {
      await manager.start({ port: APP_PORT, wsBridgeUrl: `ws://localhost:${WS_PORT}` });
    } catch (err) {
      const reason = err instanceof Error ? err.message : err && typeof err === 'object' && 'reason' in err ? (err as any).reason : String(err);
      ctx.ui.notify(`Failed to start server: ${reason}\nApp dir: ${appDir}`, 'error');
      ctx.ui.setStatus('pr-canvas', undefined);
      await bridge.stop();
      bridge = null;
      manager = null;
      return;
    }

    // 4. Open browser
    const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
    await pi.exec(openCmd, [`http://localhost:${APP_PORT}`]);

    ctx.ui.setStatus('pr-canvas', `✅ Running on localhost:${APP_PORT}`);
    ctx.ui.notify(`PR Canvas running at http://localhost:${APP_PORT}`, 'info');
  }

  async function stopServer(ctx: { ui: { notify: Function; setStatus: Function } }) {
    ctx.ui.setStatus('pr-canvas', '⏹ Stopping...');

    if (manager) {
      await manager.stop();
      manager = null;
    }

    if (bridge) {
      await bridge.stop();
      bridge = null;
    }

    ctx.ui.setStatus('pr-canvas', undefined);
    ctx.ui.notify('PR Canvas stopped.', 'info');
  }

  pi.registerCommand('pr-canvas', {
    description:
      'Manage the PR Canvas server. Usage: /pr-canvas start | stop | open [number] | status',
    handler: async (args, ctx) => {
      const parts = (args?.trim() || '').split(/\s+/);
      const subcommand = parts[0] || '';

      switch (subcommand) {
        case 'start': {
          if (manager?.isRunning) {
            ctx.ui.notify(
              `PR Canvas is already running at http://localhost:${APP_PORT}`,
              'warning',
            );
            return;
          }
          await startServer(ctx);
          break;
        }

        case 'stop': {
          if (!manager?.isRunning && !bridge?.isRunning) {
            ctx.ui.notify('PR Canvas is not running.', 'warning');
            return;
          }
          await stopServer(ctx);
          break;
        }

        case 'open': {
          if (!manager?.isRunning) {
            ctx.ui.notify('PR Canvas is not running. Run /pr-canvas start first.', 'warning');
            return;
          }
          const prNumber = parts[1];
          const url = prNumber
            ? `http://localhost:${APP_PORT}/pr/${prNumber}`
            : `http://localhost:${APP_PORT}`;
          const openCmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
          await pi.exec(openCmd, [url]);
          ctx.ui.notify(`Opened ${url}`, 'info');
          break;
        }

        case 'status': {
          const serverStatus = manager?.isRunning ? `✅ Server: http://localhost:${APP_PORT}` : '⏹ Server: stopped';
          const bridgeStatus = bridge?.isRunning ? `✅ Bridge: ws://localhost:${WS_PORT}` : '⏹ Bridge: stopped';
          ctx.ui.notify(`${serverStatus}\n${bridgeStatus}`, 'info');
          break;
        }

        default:
          ctx.ui.notify(
            'Usage: /pr-canvas start | stop | open [number] | status',
            'warning',
          );
      }
    },
  });

  // Cleanup on session shutdown
  pi.on('session_shutdown', async () => {
    if (manager?.isRunning) await manager.stop();
    if (bridge?.isRunning) await bridge.stop();
    manager = null;
    bridge = null;
  });
}
