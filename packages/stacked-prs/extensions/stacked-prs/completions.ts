export interface SubcommandCompletion {
  value: string;
  label: string;
  description?: string;
}

const SUBCOMMANDS: SubcommandCompletion[] = [
  { value: 'status', label: 'status', description: 'Show the current stack and PR state' },
  { value: 'split', label: 'split', description: 'Split uncommitted changes into a stack of PRs' },
  { value: 'sync', label: 'sync', description: 'Rebase the stack and update PR bases' },
  { value: 'merge', label: 'merge', description: 'Merge the bottom-most ready PR in the stack' },
  { value: 'undo', label: 'undo', description: 'Undo the last stack operation' },
];

/**
 * Argument completions for `/stack`. Completes the sub-command while the user is
 * still typing the first token; returns `null` once a space was typed.
 */
export function getStackCompletions(argumentPrefix: string): SubcommandCompletion[] | null {
  if (/\s/.test(argumentPrefix)) return null;
  const prefix = argumentPrefix.toLowerCase();
  return SUBCOMMANDS.filter((s) => s.value.startsWith(prefix));
}
