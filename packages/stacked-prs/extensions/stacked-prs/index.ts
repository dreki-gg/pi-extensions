import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerStackedPrsCommands } from './commands';

export default function stackedPrsExtension(pi: ExtensionAPI) {
  registerStackedPrsCommands(pi);
}
