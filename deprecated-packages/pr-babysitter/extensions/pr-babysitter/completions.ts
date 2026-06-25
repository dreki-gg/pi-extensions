export interface SubcommandCompletion {
  value: string;
  label: string;
  description?: string;
}

const SUBCOMMANDS: SubcommandCompletion[] = [
  { value: 'start', label: 'start', description: "Start babysitting the current branch's PR" },
  { value: 'stop', label: 'stop', description: 'Stop babysitting' },
  { value: 'status', label: 'status', description: 'Show the current babysitting status' },
];

/**
 * Argument completions for `/babysit`. Completes the sub-command while the user
 * is still typing the first token; returns `null` once a space was typed.
 */
export function getBabysitCompletions(argumentPrefix: string): SubcommandCompletion[] | null {
  if (/\s/.test(argumentPrefix)) return null;
  const prefix = argumentPrefix.toLowerCase();
  return SUBCOMMANDS.filter((s) => s.value.startsWith(prefix));
}
