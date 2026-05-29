import { describe, it, expect } from 'bun:test';
import { createMessageHandlers } from '../../extensions/pr-canvas/server/handlers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const fixturesDir = join(import.meta.dir, '..', 'fixtures');

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

/** Mock exec that returns fixture data based on command */
function createMockExec() {
  const prView = loadFixture('pr-view.json');
  const prDiff = loadFixture('pr-diff.txt');
  const prChecks = loadFixture('pr-checks.json');

  return async (command: string, args: string[]) => {
    if (command !== 'gh') return { stdout: '', stderr: 'unknown command', code: 1 };

    const subcommand = args.join(' ');

    if (subcommand.includes('pr list')) {
      return { stdout: JSON.stringify([JSON.parse(prView)]), stderr: '', code: 0 };
    }
    if (subcommand.includes('pr diff')) {
      return { stdout: prDiff, stderr: '', code: 0 };
    }
    if (subcommand.includes('pr checks')) {
      return { stdout: prChecks, stderr: '', code: 0 };
    }
    if (subcommand.includes('pr view')) {
      return { stdout: prView, stderr: '', code: 0 };
    }

    return { stdout: '', stderr: `unknown: ${subcommand}`, code: 1 };
  };
}

describe('createMessageHandlers', () => {
  const mockExec = createMockExec();
  const handler = createMessageHandlers(mockExec);

  it('handles pr:list and returns results', async () => {
    let response: any = null;
    await handler({ type: 'pr:list' } as any, (data) => {
      response = data;
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('pr:list:result');
    expect(Array.isArray(response.prs)).toBe(true);
    expect(response.prs.length).toBeGreaterThan(0);
  });

  it('handles pr:data and returns assembled PR data', async () => {
    let response: any = null;
    await handler({ type: 'pr:data', number: 142 } as any, (data) => {
      response = data;
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('pr:data:result');
    expect(response.number).toBe(142);
    expect(response.data).toBeDefined();
    expect(response.data.overview.title).toBe('Add authentication middleware');
    expect(response.rawDiff).toBeDefined();
    expect(response.mindMap).toBeDefined();
    expect(response.aiSummary).toBeDefined();
    expect(response.data.files.length).toBeGreaterThan(0);
  });

  it('handles pr:subscribe with ack', async () => {
    let response: any = null;
    await handler({ type: 'pr:subscribe', number: 42 } as any, (data) => {
      response = data;
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('pr:update');
    expect(response.number).toBe(42);
  });

  it('handles ai:chat without AI service', async () => {
    let response: any = null;
    await handler(
      { type: 'ai:chat', message: 'test', prNumber: 42 } as any,
      (data) => {
        response = data;
      },
    );

    expect(response).not.toBeNull();
    expect(response.type).toBe('error');
    expect(response.message).toContain('not available');
  });

  it('handles ai:chat with AI service', async () => {
    const mockAiChat = async (message: string, _context: string) =>
      `Answer to: ${message}`;
    const handlerWithAi = createMessageHandlers(mockExec, mockAiChat);

    let response: any = null;
    await handlerWithAi(
      { type: 'ai:chat', message: 'Why was this deleted?', prNumber: 42 } as any,
      (data) => {
        response = data;
      },
    );

    expect(response).not.toBeNull();
    expect(response.type).toBe('ai:chat:response');
    expect(response.message).toBe('Answer to: Why was this deleted?');
  });

  it('catches handler errors and returns error message', async () => {
    const failingExec = async () => {
      throw new Error('exec crashed');
    };
    const failHandler = createMessageHandlers(failingExec as any);

    let response: any = null;
    await failHandler({ type: 'pr:list' } as any, (data) => {
      response = data;
    });

    expect(response).not.toBeNull();
    expect(response.type).toBe('error');
    expect(typeof response.message).toBe('string');
    expect(response.message.length).toBeGreaterThan(0);
  });
});
