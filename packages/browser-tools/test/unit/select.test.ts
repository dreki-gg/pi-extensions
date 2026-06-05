import { describe, expect, test } from 'bun:test';
import { selectBrowserBackend } from '../../extensions/browser-tools/backends/select.js';

const available = async () => {};
const unavailable = async () => {
  throw new Error('agent-browser unavailable');
};

describe('selectBrowserBackend', () => {
  test('resolves agent-browser when available', async () => {
    const backend = await selectBrowserBackend(available);
    expect(backend.name).toBe('agent-browser');
  });

  test('hard-fails when agent-browser is unavailable', async () => {
    await expect(selectBrowserBackend(unavailable)).rejects.toThrow();
  });
});
