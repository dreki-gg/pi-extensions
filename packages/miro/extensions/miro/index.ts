import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { getCredentialStatus } from './config.js';
import { MiroRuntime } from './runtime.js';
import { registerDiagramTool } from './tools/diagram-tool.js';
import { registerItemTools } from './tools/item-tools.js';
import { registerPrimitiveTools } from './tools/primitive-tools.js';

export default function miroExtension(pi: ExtensionAPI) {
  const runtime = new MiroRuntime();

  pi.on('session_start', async (_event, ctx) => {
    try {
      await runtime.loadConfig(ctx.cwd);
    } catch (err) {
      ctx.ui.notify(`Miro config error: ${(err as Error).message}`, 'warning');
    }
    if (!getCredentialStatus().hasAccessToken) {
      ctx.ui.notify('Miro: MIRO_ACCESS_TOKEN not set — Miro tools will be unavailable.', 'warning');
    }
  });

  registerDiagramTool(pi, runtime);
  registerPrimitiveTools(pi, runtime);
  registerItemTools(pi, runtime);
}
