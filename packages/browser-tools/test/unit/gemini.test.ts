import { describe, expect, test } from 'bun:test';
import {
  analyzeScreenshot,
  resolveAnalysisModel,
  resolveAnalyzeEnabled,
} from '../../extensions/browser-tools/analysis/gemini.js';

describe('resolveAnalysisModel', () => {
  test('defaults to google:gemini-2.5-flash', () => {
    expect(resolveAnalysisModel({})).toEqual({ provider: 'google', modelId: 'gemini-2.5-flash' });
  });

  test('parses provider:modelId', () => {
    expect(resolveAnalysisModel({ WEB_SCREENSHOT_MODEL: 'openai:gpt-4o' })).toEqual({
      provider: 'openai',
      modelId: 'gpt-4o',
    });
  });

  test('treats a bare value as a google model id', () => {
    expect(resolveAnalysisModel({ WEB_SCREENSHOT_MODEL: 'gemini-3-flash' })).toEqual({
      provider: 'google',
      modelId: 'gemini-3-flash',
    });
  });
});

describe('resolveAnalyzeEnabled', () => {
  test('explicit param wins over env (true)', () => {
    expect(resolveAnalyzeEnabled(true, { WEB_SCREENSHOT_ANALYZE: '0' })).toBe(true);
  });

  test('explicit param wins over env (false)', () => {
    expect(resolveAnalyzeEnabled(false, { WEB_SCREENSHOT_ANALYZE: '1' })).toBe(false);
  });

  test('env-only truthy values enable', () => {
    for (const value of ['1', 'true', 'YES', 'On']) {
      expect(resolveAnalyzeEnabled(undefined, { WEB_SCREENSHOT_ANALYZE: value })).toBe(true);
    }
  });

  test('env-only falsy / unset stays off', () => {
    expect(resolveAnalyzeEnabled(undefined, { WEB_SCREENSHOT_ANALYZE: 'no' })).toBe(false);
    expect(resolveAnalyzeEnabled(undefined, {})).toBe(false);
  });
});

describe('analyzeScreenshot', () => {
  const fakeModel = { id: 'fake' };
  const registry = {
    find: () => fakeModel,
    getApiKeyAndHeaders: async () => ({ ok: true as const, apiKey: 'k', headers: { h: 'v' } }),
  };

  test('builds an image+text context and returns joined text', async () => {
    let capturedContext: any;
    let capturedOptions: any;
    const complete = (async (_model: any, context: any, options: any) => {
      capturedContext = context;
      capturedOptions = options;
      return {
        content: [
          { type: 'text', text: 'A login form ' },
          { type: 'text', text: 'with two inputs.' },
        ],
      };
    }) as any;

    const result = await analyzeScreenshot({
      modelRegistry: registry,
      imageBase64: 'BASE64',
      complete,
      env: {},
    });

    expect(result.text).toBe('A login form with two inputs.');
    expect(result.model).toBe('google:gemini-2.5-flash');
    const content = capturedContext.messages[0].content;
    expect(content[0].type).toBe('text');
    expect(content[1]).toEqual({ type: 'image', data: 'BASE64', mimeType: 'image/png' });
    expect(capturedOptions).toMatchObject({ apiKey: 'k', headers: { h: 'v' } });
  });

  test('uses a custom prompt when provided', async () => {
    let capturedContext: any;
    const complete = (async (_m: any, context: any) => {
      capturedContext = context;
      return { content: [{ type: 'text', text: 'ok' }] };
    }) as any;

    await analyzeScreenshot({
      modelRegistry: registry,
      imageBase64: 'X',
      prompt: 'Only list the buttons.',
      complete,
    });

    expect(capturedContext.messages[0].content[0].text).toBe('Only list the buttons.');
  });

  test('throws when the model is not found', async () => {
    await expect(
      analyzeScreenshot({
        modelRegistry: { find: () => undefined, getApiKeyAndHeaders: async () => ({ ok: true }) },
        imageBase64: 'X',
        complete: (async () => ({ content: [] })) as any,
      }),
    ).rejects.toThrow(/not found/);
  });

  test('throws when auth is unavailable', async () => {
    await expect(
      analyzeScreenshot({
        modelRegistry: {
          find: () => fakeModel,
          getApiKeyAndHeaders: async () => ({ ok: false as const, error: 'no key' }),
        },
        imageBase64: 'X',
        complete: (async () => ({ content: [] })) as any,
      }),
    ).rejects.toThrow(/no usable auth/);
  });
});
