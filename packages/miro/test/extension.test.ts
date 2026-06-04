import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import miroExtension from '../extensions/miro/index.js';

type ToolDef = {
  name: string;
  description?: string;
  promptSnippet?: string;
  parameters?: unknown;
  execute: (
    id: string,
    params: unknown,
    signal?: unknown,
    update?: unknown,
    ctx?: unknown,
  ) => Promise<unknown>;
};

function mockPi() {
  const tools: ToolDef[] = [];
  return {
    tools,
    on() {},
    registerTool(tool: ToolDef) {
      tools.push(tool);
    },
    registerCommand() {},
    registerShortcut() {},
    registerFlag() {},
  };
}

describe('miro extension registration', () => {
  test('registers all five tools', () => {
    const pi = mockPi();
    miroExtension(pi as never);
    const names = pi.tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      'miro_create_connector',
      'miro_create_diagram',
      'miro_create_frame',
      'miro_create_shape',
      'miro_list_boards',
    ]);
  });

  test('every tool has a description, snippet, and parameters', () => {
    const pi = mockPi();
    miroExtension(pi as never);
    for (const tool of pi.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.promptSnippet).toBeTruthy();
      expect(tool.parameters).toBeDefined();
    }
  });
});

describe('miro tools without credentials', () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.MIRO_ACCESS_TOKEN;
    delete process.env.MIRO_ACCESS_TOKEN;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.MIRO_ACCESS_TOKEN;
    else process.env.MIRO_ACCESS_TOKEN = original;
  });

  test('miro_create_diagram returns a clean error when token is missing', async () => {
    const pi = mockPi();
    miroExtension(pi as never);
    const diagram = pi.tools.find((tool) => tool.name === 'miro_create_diagram')!;
    const result = (await diagram.execute(
      'call-1',
      { nodes: [{ id: 'a', label: 'A' }], edges: [] },
      undefined,
      undefined,
      { cwd: process.cwd() },
    )) as { isError?: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('MIRO_ACCESS_TOKEN');
  });
});
