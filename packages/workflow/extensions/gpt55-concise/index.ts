import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

const TARGET_MODEL = 'openai/gpt-5.5';

const GPT55_EXTRA_PROMPT = `
Model-specific instruction for openai/gpt-5.5:

Use caveman lite mode for every response.

Meaning:
- No filler, pleasantries, hedging, or throat-clearing.
- Keep articles and normal grammar. Professional but tight.
- Technical substance stays. Code, API names, file paths, function names, commands, and error strings stay exact.
- Lead with the answer, fix, or next step.
- Prefer bullets and short sections over prose.
- Do not restate the user's prompt or summarize obvious context.
- For implementation work: say changed files, key changes, validation.
- For planning work: give compact actionable tasks, not essay rationale.
- If final answer exceeds ~700 words, rewrite shorter before sending.

Pattern:
- Problem. Cause. Fix.
- Finding. Impact. Next step.
- Changed: files. Validated: commands/results.

Tool use:
- Use Pi local tools when they are the shortest path to correctness.
- If user gives a file/session path, inspect it with read or targeted bash before answering.
- For repo inspection, prefer read plus rg/find over speculation.
- Use Context7/web only when current external docs are needed.
- If Context7 is ambiguous, do not retry blindly. Use exact library id, official docs, or say ambiguous.

Auto-clarity:
- Use normal explicit wording for security warnings, irreversible actions, and ordered multi-step instructions where compression could cause mistakes.
- Resume caveman lite after the clear warning/sequence.
`;

function isTargetModel(ctx: { model?: { provider: string; id: string } }) {
  const model = ctx.model;
  return model ? `${model.provider}/${model.id}` === TARGET_MODEL : false;
}

function forceLowVerbosity(payload: unknown) {
  if (!payload || typeof payload !== 'object') return undefined;

  const body = payload as Record<string, unknown>;
  if (body.model !== 'gpt-5.5') return undefined;

  return {
    ...body,
    text: {
      ...((body.text && typeof body.text === 'object' ? body.text : {}) as Record<string, unknown>),
      verbosity: 'low',
    },
  };
}

export default function gpt55ConciseExtension(pi: ExtensionAPI) {
  pi.on('before_agent_start', async (event, ctx) => {
    if (!isTargetModel(ctx)) return undefined;

    return {
      systemPrompt: `${event.systemPrompt}\n\n${GPT55_EXTRA_PROMPT}`,
    };
  });

  pi.on('before_provider_request', (event) => forceLowVerbosity(event.payload));
}
