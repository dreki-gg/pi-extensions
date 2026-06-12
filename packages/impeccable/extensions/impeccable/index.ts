import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { registerDetectTool } from './commands/detect-tool';
import { registerImpeccableCommand } from './commands/impeccable';

export default function impeccableExtension(pi: ExtensionAPI) {
  registerDetectTool(pi);
  registerImpeccableCommand(pi);
}
