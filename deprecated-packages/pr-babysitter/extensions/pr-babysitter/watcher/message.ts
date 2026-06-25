/**
 * Format new PR activity into the user-message that wakes the agent.
 * Pure string building — unit-tested against fixtures.
 */
import type { NewActivity } from './state';

function truncate(text: string, max = 240): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Build the followUp prompt the agent wakes up to. */
export function formatWakeMessage(activity: NewActivity, pr: number): string {
  const lines: string[] = [`🍼 PR #${pr} babysitter — new activity:`];

  for (const check of activity.newFailedChecks) {
    const link = check.link ? ` — ${check.link}` : '';
    lines.push(`❌ Check failed: \`${check.name}\`${link}`);
  }

  for (const comment of activity.newComments) {
    lines.push(`💬 @${comment.author} (${comment.kind}): "${truncate(comment.body)}"`);
  }

  lines.push('');
  lines.push(
    'Observe-only: investigate and address; I will not push or comment on the PR for you.',
  );

  return lines.join('\n');
}

/** Terminal message when the PR leaves OPEN and the watch stops. */
export function formatLifecycleMessage(pr: number, state: string): string {
  if (state === 'MERGED') {
    return `✅ PR #${pr} has been merged — I've stopped babysitting it.`;
  }
  return `🚫 PR #${pr} was closed without merging — I've stopped babysitting it.`;
}
