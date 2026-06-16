export interface SubcommandCompletion {
  value: string;
  label: string;
  description?: string;
}

const SUBCOMMANDS: SubcommandCompletion[] = [
  { value: 'start', label: 'start', description: 'Start the PR Canvas server' },
  { value: 'stop', label: 'stop', description: 'Stop the PR Canvas server' },
  { value: 'open', label: 'open [number]', description: 'Open the canvas (optionally for a PR number)' },
  { value: 'status', label: 'status', description: 'Show server and bridge status' },
];

/**
 * Argument completions for `/pr-canvas`. Completes the sub-command while the
 * user is still typing the first token; returns `null` once a space was typed
 * (e.g. while typing the PR number after `open`).
 */
export function getPrCanvasCompletions(argumentPrefix: string): SubcommandCompletion[] | null {
  if (/\s/.test(argumentPrefix)) return null;
  const prefix = argumentPrefix.toLowerCase();
  return SUBCOMMANDS.filter((s) => s.value.startsWith(prefix));
}
