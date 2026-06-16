export interface SubcommandCompletion {
  value: string;
  label: string;
  description?: string;
}

const SUBCOMMANDS: SubcommandCompletion[] = [
  { value: 'list', label: 'list', description: 'List @chat/@session references' },
  { value: 'add', label: 'add <path> [label]', description: 'Add a chat/session reference' },
  { value: 'remove', label: 'remove <path-or-label>', description: 'Remove a reference' },
  { value: 'refresh', label: 'refresh', description: 'Re-index referenced chats/sessions' },
  { value: 'summarize', label: 'summarize', description: 'Summarize referenced chats/sessions' },
];

/**
 * Argument completions for `/past-chats`. Completes the sub-command while the
 * user is still typing the first token; returns `null` once a space was typed.
 */
export function getPastChatsCompletions(argumentPrefix: string): SubcommandCompletion[] | null {
  if (/\s/.test(argumentPrefix)) return null;
  const prefix = argumentPrefix.toLowerCase();
  return SUBCOMMANDS.filter((s) => s.value.startsWith(prefix));
}
