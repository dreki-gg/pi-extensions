/**
 * ast-grep tool — structural code search/rewrite for Pi.
 * Requires `ast-grep` (alias `sg`) installed on PATH.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';

const run = promisify(execFile);

export default function astGrepExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: 'ast_grep',
    label: 'ast-grep',
    description:
      'Structural (AST-based) code search and rewrite using ast-grep. ' +
      'Prefer this over text grep when matching code shape, e.g. ' +
      '`console.log($A)`, function/class structure, or refactors. ' +
      'Pattern uses $VAR metavariables. Set rewrite to transform matches (dry-run unless updateAll).',
    promptSnippet:
      'Structural AST search/rewrite via ast-grep; use for code-shape matches and refactors',
    promptGuidelines: [
      'Prefer the ast_grep tool over text grep (grep/rg) when searching for code by structure — call shapes like `console.log($A)`, function/class definitions, imports, or any refactor. Use text grep only for plain string or comment matches.',
    ],
    parameters: Type.Object({
      pattern: Type.String({ description: 'ast-grep pattern, e.g. `console.log($A)`' }),
      lang: Type.String({
        description: 'Language: ts, tsx, js, jsx, py, go, rust, java, etc.',
      }),
      path: Type.Optional(Type.String({ description: 'File or dir to search (default: .)' })),
      rewrite: Type.Optional(
        Type.String({ description: 'Replacement pattern, e.g. `logger.debug($A)`' }),
      ),
      updateAll: Type.Optional(
        Type.Boolean({ description: 'Apply the rewrite to disk. Default false = dry-run diff.' }),
      ),
    }),
    async execute(_id, params, signal) {
      const args: string[] = ['run', '--pattern', params.pattern, '--lang', params.lang];
      if (params.rewrite) {
        args.push('--rewrite', params.rewrite);
        if (params.updateAll) args.push('--update-all');
      }
      args.push(params.path ?? '.');

      try {
        const { stdout, stderr } = await run('ast-grep', args, {
          signal,
          maxBuffer: 10 * 1024 * 1024,
        });
        const text = stdout.trim() || stderr.trim() || 'No matches.';
        return { content: [{ type: 'text' as const, text }], details: { args, error: false } };
      } catch (err: any) {
        const text = (err.stdout || '') + (err.stderr || err.message || '');
        return {
          content: [{ type: 'text' as const, text: text.trim() || 'ast-grep failed' }],
          details: { args, error: true },
        };
      }
    },
  });
}
