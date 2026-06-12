/**
 * Render a parsed stack forest as a compact text tree for the pi TUI.
 */
import type { StackNode } from './parser';

function ref(node: StackNode): string {
  if (node.number === undefined) return '';
  const sigil = node.provider === 'gitlab' ? '!' : '#';
  return ` ${sigil}${node.number}`;
}

/** Render a forest into an indented tree string. */
export function renderStack(roots: StackNode[]): string {
  if (roots.length === 0) return 'No stack detected in this repo.';
  const lines: string[] = [];

  const walk = (node: StackNode, prefix: string, isLast: boolean, isRoot: boolean) => {
    const connector = isRoot ? '' : isLast ? '└─ ' : '├─ ';
    lines.push(`${prefix}${connector}● ${node.branch}${ref(node)}`);
    const childPrefix = isRoot ? '' : prefix + (isLast ? '   ' : '│  ');
    node.children.forEach((child, i) =>
      walk(child, childPrefix, i === node.children.length - 1, false),
    );
  };

  roots.forEach((root) => walk(root, '', true, true));
  return lines.join('\n');
}
