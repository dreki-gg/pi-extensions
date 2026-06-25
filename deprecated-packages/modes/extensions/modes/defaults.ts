import type { PresetsConfig } from './config';

export const DEFAULT_GLOBAL_PRESETS: PresetsConfig = {
  explore: {
    description: 'Read-only exploration and brainstorming',
    tools: ['read', 'lsp', 'context7_*', 'questionnaire'],
    thinkingLevel: 'high',
    instructions:
      'You are in EXPLORE MODE. Investigate, ask clarifying questions, compare options, and brainstorm. Do not make changes.',
  },
};
