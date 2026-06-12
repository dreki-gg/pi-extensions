/**
 * Parse the tree output emitted by `stack status` / `stack sync` into a
 * typed model.
 *
 * Example input (from the stack README):
 *
 *   ● main
 *   └─ ● stack-a #101
 *      └─ ● stack-b #102
 *
 * GitHub references appear as `#101`, GitLab as `!101`. Each non-root node
 * carries a branch name and an optional PR/MR number. Indentation (via the
 * tree connector glyphs) encodes parent/child depth.
 */

export interface StackNode {
  /** Branch name (the trunk root has no PR number). */
  branch: string;
  /** PR (#) or MR (!) number, when present. */
  number?: number;
  /** "github" when referenced as #, "gitlab" when referenced as !. */
  provider?: 'github' | 'gitlab';
  /** Depth from the root (root = 0). */
  depth: number;
  /** Child nodes stacked on top of this one. */
  children: StackNode[];
}

const REF_RE = /\s([#!])(\d+)\s*$/;
// Connector glyphs / spaces that precede a node label, used to measure depth.
const CONNECTOR_RE = /[│|]|└─|├─|╰─|├|└|\s/g;

interface FlatNode extends Omit<StackNode, 'children'> {
  indent: number;
}

/** Parse stack tree text into a forest of roots. */
export function parseStackTree(output: string): StackNode[] {
  const flat: FlatNode[] = [];

  for (const rawLine of output.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const bulletIdx = indexOfBullet(line);
    if (bulletIdx === -1) continue;

    // Everything after the bullet marker is the label.
    const label = line.slice(bulletIdx + 1).trim();
    if (!label) continue;

    const indent = measureIndent(line.slice(0, bulletIdx));
    const node = parseLabel(label);
    flat.push({ ...node, indent, depth: 0 });
  }

  return buildForest(flat);
}

function indexOfBullet(line: string): number {
  // Accept common bullet glyphs used by the CLI.
  for (const glyph of ['●', '○', '◍', '•', '*']) {
    const idx = line.indexOf(glyph);
    if (idx !== -1) return idx;
  }
  return -1;
}

function measureIndent(prefix: string): number {
  // Count connector/whitespace columns; deeper nodes have longer prefixes.
  const matches = prefix.replace(CONNECTOR_RE, ' ').length;
  return matches;
}

function parseLabel(label: string): Omit<StackNode, 'children' | 'depth'> {
  const match = label.match(REF_RE);
  if (!match) {
    return { branch: label.trim() };
  }
  const provider = match[1] === '#' ? 'github' : 'gitlab';
  const number = Number.parseInt(match[2], 10);
  const branch = label.slice(0, match.index).trim();
  return { branch, number, provider };
}

/** Convert indent-sorted flat nodes into a parent/child forest. */
function buildForest(flat: FlatNode[]): StackNode[] {
  const roots: StackNode[] = [];
  // Stack of ancestors keyed by indent for O(n) nesting.
  const ancestors: Array<{ indent: number; node: StackNode }> = [];

  for (const item of flat) {
    const node: StackNode = {
      branch: item.branch,
      number: item.number,
      provider: item.provider,
      depth: 0,
      children: [],
    };

    while (ancestors.length > 0 && ancestors[ancestors.length - 1]!.indent >= item.indent) {
      ancestors.pop();
    }

    const parent = ancestors[ancestors.length - 1];
    if (parent) {
      node.depth = parent.node.depth + 1;
      parent.node.children.push(node);
    } else {
      roots.push(node);
    }

    ancestors.push({ indent: item.indent, node });
  }

  return roots;
}

/** Flatten a forest into depth-ordered nodes (pre-order). */
export function flattenStack(roots: StackNode[]): StackNode[] {
  const out: StackNode[] = [];
  const walk = (n: StackNode) => {
    out.push(n);
    n.children.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}
