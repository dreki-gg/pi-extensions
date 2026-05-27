import type { ResolvedFolder } from './types';

export function buildContextFoldersPrompt(folders: ResolvedFolder[]): string {
  const valid = folders.filter((f) => f.exists);
  if (valid.length === 0) return '';

  const rows = valid.map((f) => `| ${f.label} | ${f.path} |`).join('\n');

  return `## Extra Context Folders

The user has configured additional project folders you can search through using your existing tools (grep, find, read, ls). Use these when the user asks you to look at or reference code in these projects:

| Label | Path |
|-------|------|
${rows}

To search in these folders, use the path parameter in grep, find, ls, or read tools with the full paths listed above.`;
}

export function buildFolderListDisplay(folders: ResolvedFolder[]): string {
  if (folders.length === 0) {
    return 'No context folders configured. Use `/context-folders add <path>` to add one.';
  }

  const lines = folders.map((f) => {
    const status = f.exists ? '✓' : '✗';
    return `${status} ${f.label} — ${f.path}`;
  });

  return `Context Folders:\n${lines.join('\n')}`;
}
