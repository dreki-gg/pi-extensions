import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerPrCanvasCommand } from './command';

export default function prCanvasExtension(pi: ExtensionAPI) {
  registerPrCanvasCommand(pi);
}
