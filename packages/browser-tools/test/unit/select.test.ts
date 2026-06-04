import { describe, expect, test } from 'bun:test';
import { selectBrowserBackend } from '../../extensions/browser-tools/backends/select.js';

const available = async () => {};
const unavailable = async () => {
  throw new Error('agent-browser unavailable');
};

describe('selectBrowserBackend', () => {
  test('explicit playwright never probes agent-browser', async () => {
    let probed = false;
    const backend = await selectBrowserBackend('playwright', async () => {
      probed = true;
    });
    expect(backend.name).toBe('playwright');
    expect(probed).toBe(false);
  });

  test('explicit agent-browser resolves when available', async () => {
    const backend = await selectBrowserBackend('agent-browser', available);
    expect(backend.name).toBe('agent-browser');
  });

  test('explicit agent-browser hard-fails when unavailable', async () => {
    await expect(selectBrowserBackend('agent-browser', unavailable)).rejects.toThrow();
  });

  test('auto prefers agent-browser when available', async () => {
    const backend = await selectBrowserBackend('auto', available);
    expect(backend.name).toBe('agent-browser');
  });

  test('auto falls back to playwright when agent-browser is unavailable', async () => {
    const backend = await selectBrowserBackend('auto', unavailable);
    expect(backend.name).toBe('playwright');
  });
});
