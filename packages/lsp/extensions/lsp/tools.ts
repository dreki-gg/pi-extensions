/**
 * Single unified `lsp` tool registration.
 *
 * 11 operations routed to the right server by file extension.
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { StringEnum } from '@earendil-works/pi-ai';

import type { LspClient } from './client';
import {
  formatCallHierarchy,
  formatCodeActions,
  formatDiagnostics,
  formatDocumentSymbols,
  formatHover,
  formatIncomingCalls,
  formatLocations,
  formatOutgoingCalls,
  formatWorkspaceSymbols,
} from './formatting';
import type { Diagnostic } from './types';
import {
  FILE_ONLY_OPERATIONS,
  LSP_OPERATIONS,
  type LspOperation,
  POSITION_OPERATIONS,
  QUERY_OPERATIONS,
} from './types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function cleanPath(path: string): string {
  return path.replace(/^@/, '');
}

function toZeroIndexed(oneIndexed: number): number {
  return Math.max(0, oneIndexed - 1);
}

function validateParams(
  operation: LspOperation,
  filePath?: string,
  line?: number,
  character?: number,
  query?: string,
): string | null {
  if (POSITION_OPERATIONS.includes(operation)) {
    if (!filePath) return `Operation '${operation}' requires filePath`;
    if (line === undefined) return `Operation '${operation}' requires line`;
    if (character === undefined) return `Operation '${operation}' requires character`;
  }
  if (FILE_ONLY_OPERATIONS.includes(operation)) {
    if (!filePath) return `Operation '${operation}' requires filePath`;
  }
  if (QUERY_OPERATIONS.includes(operation)) {
    if (!query) return `Operation '${operation}' requires query`;
  }
  return null;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface ServerManager {
  /** Get all LSP clients that handle a given file extension. */
  clientsForFile: (filePath: string) => LspClient[];
  /** Get the first LSP client that handles a file and has a capability. */
  clientForFileWithCapability: (filePath: string, capability: string) => LspClient | null;
  /** Get any initialized client (for workspace-wide ops). */
  anyClient: () => LspClient | null;
  /** Current root path. */
  getRootPath: () => string;
}

// ── Capability map ──────────────────────────────────────────────────────────

const CAPABILITY_MAP: Record<LspOperation, string> = {
  diagnostics: 'textDocumentSync', // all servers with sync support
  hover: 'hoverProvider',
  goToDefinition: 'definitionProvider',
  findReferences: 'referencesProvider',
  goToImplementation: 'implementationProvider',
  documentSymbol: 'documentSymbolProvider',
  workspaceSymbol: 'workspaceSymbolProvider',
  prepareCallHierarchy: 'callHierarchyProvider',
  incomingCalls: 'callHierarchyProvider',
  outgoingCalls: 'callHierarchyProvider',
  codeActions: 'codeActionProvider',
};

// ── Registration ────────────────────────────────────────────────────────────

export function registerLspTool(pi: ExtensionAPI, mgr: ServerManager) {
  pi.registerTool({
    name: 'lsp',
    label: 'LSP',
    description: [
      'Interact with Language Server Protocol servers for code intelligence.',
      '',
      'Supported operations:',
      '  goToDefinition    — find where a symbol is defined',
      '  findReferences    — find all references to a symbol',
      '  hover             — get type info and documentation for a symbol',
      '  diagnostics       — get type errors and lint warnings for a file',
      '  documentSymbol    — get all symbols in a file (with line:column positions)',
      '  workspaceSymbol   — search for symbols across the workspace',
      '  goToImplementation — find implementations of an interface/abstract method',
      '  prepareCallHierarchy — get call hierarchy item at a position',
      '  incomingCalls     — find callers of a function/method (auto-prepares hierarchy)',
      '  outgoingCalls     — find callees of a function/method (auto-prepares hierarchy)',
      '  codeActions       — get quick fixes and refactoring suggestions',
      '',
      'Parameters:',
      '  operation (required) — one of the operations above',
      '  filePath  — file path relative to project root (required for most operations)',
      '  line      — line number, 1-indexed (required for position-based operations)',
      '  character — column number, 1-indexed (required for position-based operations)',
      '  query     — search string (required for workspaceSymbol)',
      '',
      'Tips:',
      '  — Position the character in the middle of the symbol name for best results.',
      '  — Use hover before goToDefinition to quickly check signatures and docs.',
      '  — workspaceSymbol may need a retry if the server is still indexing.',
    ].join('\n'),
    promptSnippet:
      'Interact with LSP servers for code intelligence: definitions, references, hover, diagnostics, symbols, call hierarchy, code actions',
    promptGuidelines: [
      'lsp line and character params are 1-indexed — use the values from the read tool or rg output directly.',
      'lsp `hover` is the fastest way to get a function signature, type params, and doc comment — prefer it over `goToDefinition` for quick type inspection.',
      'lsp `documentSymbol` returns line:column positions for each symbol — use those values directly for follow-up lsp operations.',
      'For lsp position-based operations, place the character in the **middle** of the symbol name, not at the first character.',
      'lsp `incomingCalls` and `outgoingCalls` automatically prepare the call hierarchy — no need to call `prepareCallHierarchy` first.',
      'lsp `workspaceSymbol` may return empty results while the LSP server is still indexing. If it returns nothing, wait a few seconds and retry.',
      'lsp `diagnostics` relies on server-pushed notifications which may be slow for some servers. For compiled languages (Rust, Go, C++), prefer running the compiler directly (e.g. `cargo check`, `go build`) for reliable error checking.',
      'Use lsp for type info, macro-generated symbols, and cross-module navigation. Use rg for simple text search and file discovery — it is faster and needs no server.',
      'lsp servers are auto-detected by file extension. Use /lsp to check status.',
    ],
    parameters: Type.Object({
      operation: StringEnum(LSP_OPERATIONS),
      filePath: Type.Optional(Type.String({ description: 'File path relative to project root' })),
      line: Type.Optional(Type.Number({ description: 'Line number (1-indexed)' })),
      character: Type.Optional(Type.Number({ description: 'Column number (1-indexed)' })),
      query: Type.Optional(Type.String({ description: 'Search query (for workspaceSymbol)' })),
    }),
    async execute(_toolCallId, params) {
      const operation = params.operation as LspOperation;
      const filePath = params.filePath ? cleanPath(params.filePath) : undefined;
      const line = params.line;
      const character = params.character;
      const query = params.query;
      const rootPath = mgr.getRootPath();

      // Validate required params
      const validationError = validateParams(operation, filePath, line, character, query);
      if (validationError) throw new Error(validationError);

      // ── diagnostics (aggregate from all matching servers) ──
      if (operation === 'diagnostics') {
        return executeDiagnostics(mgr, filePath!, rootPath);
      }

      // ── workspaceSymbol (doesn't need a file-based server lookup) ──
      if (operation === 'workspaceSymbol') {
        return executeWorkspaceSymbol(mgr, query!, rootPath);
      }

      // ── all other operations: route to first capable server ──
      const capability = CAPABILITY_MAP[operation];
      const client = mgr.clientForFileWithCapability(filePath!, capability);
      if (!client) {
        throw new Error(
          `No LSP server with '${operation}' capability found for ${filePath}. Check /lsp status.`,
        );
      }

      const pos = { line: toZeroIndexed(line!), character: toZeroIndexed(character!) };

      switch (operation) {
        case 'hover': {
          const result = await client.hover(filePath!, pos);
          return ok(formatHover(result, filePath!, pos.line, pos.character));
        }

        case 'goToDefinition': {
          const locs = await client.definition(filePath!, pos);
          return ok(
            formatLocations(locs, 'Definition', filePath!, pos.line, pos.character, rootPath),
          );
        }

        case 'findReferences': {
          const locs = await client.references(filePath!, pos);
          return ok(
            formatLocations(locs, 'References', filePath!, pos.line, pos.character, rootPath),
          );
        }

        case 'goToImplementation': {
          const locs = await client.implementation(filePath!, pos);
          return ok(
            formatLocations(locs, 'Implementation', filePath!, pos.line, pos.character, rootPath),
          );
        }

        case 'documentSymbol': {
          const symbols = await client.documentSymbol(filePath!);
          return ok(formatDocumentSymbols(symbols, filePath!, rootPath));
        }

        case 'prepareCallHierarchy': {
          const items = await client.prepareCallHierarchy(filePath!, pos);
          return ok(formatCallHierarchy(items, filePath!, pos.line, pos.character, rootPath));
        }

        case 'incomingCalls': {
          const items = await client.prepareCallHierarchy(filePath!, pos);
          if (items.length === 0) {
            return ok(`No call hierarchy item at ${filePath!}:${line}:${character}`);
          }
          const calls = await client.incomingCalls(items[0]);
          return ok(formatIncomingCalls(calls, items[0], rootPath));
        }

        case 'outgoingCalls': {
          const items = await client.prepareCallHierarchy(filePath!, pos);
          if (items.length === 0) {
            return ok(`No call hierarchy item at ${filePath!}:${line}:${character}`);
          }
          const calls = await client.outgoingCalls(items[0]);
          return ok(formatOutgoingCalls(calls, items[0], rootPath));
        }

        case 'codeActions': {
          const diagsForFile = await client.getDiagnostics(filePath!);
          const zeroLine = toZeroIndexed(line!);
          const lineDiags = diagsForFile.filter(
            (d) => d.range.start.line <= zeroLine && d.range.end.line >= zeroLine,
          );
          const range = {
            start: { line: zeroLine, character: 0 },
            end: { line: zeroLine, character: Number.MAX_SAFE_INTEGER },
          };
          const actions = await client.codeActions(filePath!, range, { diagnostics: lineDiags });
          return ok(formatCodeActions(actions, filePath!, zeroLine));
        }

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    },
  });
}

// ── Operation executors ─────────────────────────────────────────────────────

async function executeDiagnostics(mgr: ServerManager, filePath: string, _rootPath: string) {
  const groups: { source: string; diagnostics: Diagnostic[] }[] = [];
  const errors: string[] = [];

  // Gather from all LSP servers that handle this file
  const clients = mgr.clientsForFile(filePath);
  for (const client of clients) {
    try {
      const diags = await client.getDiagnostics(filePath);
      if (diags.length > 0) {
        groups.push({ source: client.config.name, diagnostics: diags });
      }
    } catch (err) {
      errors.push(`${client.config.name}: ${(err as Error).message}`);
    }
  }

  const text = formatDiagnostics(filePath, groups);
  const errorNote = errors.length > 0 ? `\n\nNote: ${errors.join('; ')}` : '';

  return {
    content: [{ type: 'text' as const, text: text + errorNote }],
    details: {
      groups: groups.map((g) => ({ source: g.source, count: g.diagnostics.length })),
      errors,
    },
  };
}

async function executeWorkspaceSymbol(mgr: ServerManager, query: string, rootPath: string) {
  const client = mgr.anyClient();
  if (!client) throw new Error('No LSP server available for workspace symbol search.');

  const symbols = await client.workspaceSymbol(query);
  return ok(formatWorkspaceSymbols(symbols, query, rootPath));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function ok(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    details: {},
  };
}
