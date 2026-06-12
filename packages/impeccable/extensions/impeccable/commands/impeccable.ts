import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

import { loadProjectContext } from '../context';
import {
  IMPECCABLE_COMMANDS,
  IMPECCABLE_COMMAND_NAMES,
  type ImpeccableCategory,
} from '../commands-meta';
import { loadReference } from '../reference';

const CATEGORY_ORDER: ImpeccableCategory[] = ['Build', 'Evaluate', 'Refine', 'Enhance', 'Fix'];

/** The full command table, grouped by category, for the no-arg menu prompt. */
function renderCommandMenu(): string {
  const lines: string[] = [];
  for (const category of CATEGORY_ORDER) {
    lines.push(`\n**${category}**`);
    for (const c of IMPECCABLE_COMMANDS.filter((cmd) => cmd.category === category)) {
      const hint = c.argumentHint ? ` ${c.argumentHint}` : '';
      lines.push(`- \`/impeccable ${c.command}${hint}\` — ${c.description}`);
    }
  }
  return lines.join('\n');
}

function buildMenuPrompt(hasProduct: boolean, hasDesign: boolean): string {
  return [
    'The user ran `/impeccable` with no command — they are asking "what should I do?"',
    '',
    "Follow the impeccable skill's routing rule 1 (no-argument menu):",
    hasProduct
      ? '- Project context: PRODUCT.md is present.' +
        (hasDesign
          ? ' DESIGN.md is present.'
          : ' DESIGN.md is missing — `document` is a strong pick when code exists.')
      : '- PRODUCT.md is MISSING. Treat this as setup: load `reference/init.md` and run `init` first instead of showing the menu.',
    '- Read the project signals yourself: `git status` for the changed surface, and any snapshots under `.impeccable/critique/`.',
    '- Run the `impeccable_detect` tool over the changed markup/style files once and fold the hits into your picks.',
    '- Lead with the 2-3 highest-value next commands (exact command to type + a one-line reason). Never auto-run a command.',
    '',
    'Then show the full menu as a fallback:',
    renderCommandMenu(),
  ].join('\n');
}

function buildCommandPrompt(command: string, target: string, reference: string | null): string {
  const head = [
    `The user invoked \`/impeccable ${command}${target ? ` ${target}` : ''}\`.`,
    '',
    'Follow the impeccable skill setup first (load PRODUCT.md / DESIGN.md context; pick the brand vs product register reference; read a representative project file). Then follow the command reference below exactly.',
  ];
  if (target) head.push('', `Target / focus: ${target}`);

  if (!reference) {
    head.push(
      '',
      `(No bundled reference was found for \`${command}\` — apply the general design guidance from the impeccable skill to the target.)`,
    );
    return head.join('\n');
  }

  return [...head, '', `## reference/${command}.md`, '', reference].join('\n');
}

function buildGeneralPrompt(input: string): string {
  return [
    `The user invoked \`/impeccable ${input}\` — this is a general design request, not a named command.`,
    '',
    'Map the intent to the closest command when one clearly fits (e.g. "fix the spacing" → `layout`, "rewrite this error message" → `clarify`, "the colors feel flat" → `colorize`) and load that command\'s reference. If two could fit, ask once which. Otherwise apply the impeccable skill\'s general design rules and the matching register reference, using the full request as context.',
    '',
    `Request: ${input}`,
  ].join('\n');
}

export function registerImpeccableCommand(pi: ExtensionAPI) {
  pi.registerCommand('impeccable', {
    description:
      'Design with impeccable. Usage: /impeccable [command] [target]. Run with no args for a context-aware menu.',
    handler: async (args, ctx) => {
      const input = (args ?? '').trim();
      const { product, design } = await loadProjectContext(ctx.cwd);

      if (!input) {
        pi.sendUserMessage(buildMenuPrompt(product !== null, design !== null), {
          deliverAs: 'followUp',
        });
        return;
      }

      const [firstRaw, ...rest] = input.split(/\s+/);
      const first = firstRaw.toLowerCase();
      const target = rest.join(' ');
      // `teach` is a deprecated alias for `init`.
      const command = first === 'teach' ? 'init' : first;

      if (IMPECCABLE_COMMAND_NAMES.has(command)) {
        const reference = await loadReference(command);
        pi.sendUserMessage(buildCommandPrompt(command, target, reference), {
          deliverAs: 'followUp',
        });
        return;
      }

      pi.sendUserMessage(buildGeneralPrompt(input), { deliverAs: 'followUp' });
    },
  });
}
