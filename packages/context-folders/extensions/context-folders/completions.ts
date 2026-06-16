export interface SubcommandCompletion {
  value: string;
  label: string;
  description?: string;
}

const SUBCOMMANDS: SubcommandCompletion[] = [
  { value: 'list', label: 'list', description: 'List configured context folders' },
  { value: 'add', label: 'add <path> [label]', description: 'Add a folder to the context' },
  { value: 'remove', label: 'remove <path-or-label>', description: 'Remove a configured folder' },
  { value: 'init', label: 'init', description: 'Create a starter context-folders config' },
];

/**
 * Argument completions for `/context-folders`. Completes the sub-command while
 * the user is still typing the first token; returns `null` once a space was
 * typed (e.g. while typing a path after `add`/`remove`).
 */
export function getContextFoldersCompletions(
  argumentPrefix: string,
): SubcommandCompletion[] | null {
  if (/\s/.test(argumentPrefix)) return null;
  const prefix = argumentPrefix.toLowerCase();
  return SUBCOMMANDS.filter((s) => s.value.startsWith(prefix));
}
