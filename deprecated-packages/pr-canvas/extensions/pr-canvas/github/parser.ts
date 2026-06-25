import type { PrFile } from './types';

/**
 * Parse a unified diff (output of `gh pr diff`) into structured file entries.
 */
export function parseDiff(rawDiff: string): PrFile[] {
  if (!rawDiff.trim()) return [];

  const files: PrFile[] = [];

  // Split on `diff --git` boundaries, keeping each file's full diff block
  const blocks = rawDiff.split(/^diff --git /m).filter((b) => b.trim());

  for (const block of blocks) {
    const fullBlock = `diff --git ${block}`;
    const file = parseFileBlock(fullBlock);
    if (file) files.push(file);
  }

  return files;
}

function parseFileBlock(block: string): PrFile | null {
  // Extract file path from "diff --git a/path b/path"
  const headerMatch = block.match(/^diff --git a\/(.+?) b\/(.+)/m);
  if (!headerMatch) return null;

  const path = headerMatch[2];
  const status = detectStatus(block);
  const isBinary = /^Binary files /m.test(block);

  let additions = 0;
  let deletions = 0;

  if (!isBinary) {
    // Count + and - lines in the patch (skip --- and +++ header lines)
    const lines = block.split('\n');
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      if (!inHunk) continue;

      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
  }

  // Build the patch content (everything after the diff --git header line)
  const patch = isBinary ? `Binary files differ` : extractPatch(block);

  return { path, status, additions, deletions, patch };
}

function detectStatus(block: string): PrFile['status'] {
  if (/^new file mode/m.test(block)) return 'added';
  if (/^deleted file mode/m.test(block)) return 'deleted';
  if (/^rename from /m.test(block)) return 'renamed';
  return 'modified';
}

function extractPatch(block: string): string {
  // Return from the first @@ hunk header onwards
  const hunkStart = block.indexOf('@@');
  if (hunkStart === -1) return block;
  return block.slice(hunkStart);
}
