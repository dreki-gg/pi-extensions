import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerContext7Tools } from './tools';

export default function context7Extension(pi: ExtensionAPI) {
  registerContext7Tools(pi);
}
