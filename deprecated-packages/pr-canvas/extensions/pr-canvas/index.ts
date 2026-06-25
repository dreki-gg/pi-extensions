import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerPrCanvasCommands } from './commands';

export default function prCanvasExtension(pi: ExtensionAPI) {
  registerPrCanvasCommands(pi);
}
