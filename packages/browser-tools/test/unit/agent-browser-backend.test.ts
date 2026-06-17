import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

const calls: string[][] = [];

// Mock the CLI layer so the backend's connect/open/close orchestration is
// observable without spawning a real agent-browser process.
mock.module('../../extensions/browser-tools/backends/agent-browser-cli.js', () => ({
  assertAgentBrowserAvailable: async () => undefined,
  viewportFor: (_preset?: string, width?: number, height?: number) => ({
    width: width ?? 1280,
    height: height ?? 800,
  }),
  runAgentBrowserJson: async (args: string[]) => {
    calls.push(args);
    if (args[0] === 'set' && args[1] === 'viewport') {
      return { width: Number(args[2]), height: Number(args[3]) };
    }
    if (args[0] === 'get' && args[1] === 'url') {
      return { url: 'https://app.example.com/dashboard' };
    }
    return {};
  },
}));

const { agentBrowserBackend } = await import(
  '../../extensions/browser-tools/backends/agent-browser.js'
);

function commandNames(): string[] {
  return calls.map((args) => args.join(' '));
}

describe('AgentBrowserBackend CDP connect', () => {
  beforeEach(() => {
    calls.length = 0;
  });

  afterEach(async () => {
    await agentBrowserBackend.close();
    calls.length = 0;
  });

  test('connects via CDP instead of launching a browser when a target is bound', async () => {
    agentBrowserBackend.bindCdpTarget('http://localhost:9222');
    await agentBrowserBackend.navigate('https://app.example.com/dashboard');

    const names = commandNames();
    expect(names).toContain('connect http://localhost:9222');
    expect(names).toContain('open https://app.example.com/dashboard');
    // A bare `open` (no url) would risk spawning a second browser.
    expect(names).not.toContain('open');
  });

  test('does not call close on the connected (user-owned) browser', async () => {
    agentBrowserBackend.bindCdpTarget('http://localhost:9222');
    await agentBrowserBackend.navigate('https://app.example.com/dashboard');
    calls.length = 0;

    await agentBrowserBackend.close();

    expect(commandNames()).not.toContain('close');
    expect(agentBrowserBackend.isOpen()).toBe(false);
  });

  test('first non-null target wins; later binds are ignored', async () => {
    agentBrowserBackend.bindCdpTarget('http://localhost:9222');
    agentBrowserBackend.bindCdpTarget(null);
    agentBrowserBackend.bindCdpTarget('http://localhost:9333');
    await agentBrowserBackend.navigate('https://app.example.com/dashboard');

    expect(commandNames()).toContain('connect http://localhost:9222');
    expect(commandNames()).not.toContain('connect http://localhost:9333');
  });

  test('launches its own browser and closes it when no target is bound', async () => {
    await agentBrowserBackend.navigate('https://example.com');
    expect(commandNames()).toContain('open https://example.com');
    expect(commandNames().some((name) => name.startsWith('connect'))).toBe(false);

    calls.length = 0;
    await agentBrowserBackend.close();
    expect(commandNames()).toContain('close');
  });
});
