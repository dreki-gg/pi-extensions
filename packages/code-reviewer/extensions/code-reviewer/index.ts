import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { registerReviewCommand } from './commands/review';
import { registerReviewInitCommand } from './commands/review-init';
import { registerReviewLensesCommand } from './commands/review-lenses';
import { registerReviewTool } from './commands/review-tool';

export default function codeReviewerExtension(pi: ExtensionAPI) {
  registerReviewCommand(pi);
  registerReviewInitCommand(pi);
  registerReviewLensesCommand(pi);
  registerReviewTool(pi);
}
