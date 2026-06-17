import { describe, expect, test } from 'bun:test';
import { resolveCdpTarget } from '../../extensions/browser-tools/backends/resolve-cdp-target.js';

describe('resolveCdpTarget', () => {
  test('returns null when neither param nor env is set', () => {
    expect(resolveCdpTarget(undefined, {})).toBeNull();
    expect(resolveCdpTarget('', {})).toBeNull();
    expect(resolveCdpTarget('   ', {})).toBeNull();
  });

  test('prefers the param over the env fallback', () => {
    expect(resolveCdpTarget('9333', { PI_BROWSER_CDP: '9222' })).toBe('9333');
  });

  test('falls back to PI_BROWSER_CDP when no param is given', () => {
    expect(resolveCdpTarget(undefined, { PI_BROWSER_CDP: '9222' })).toBe('9222');
  });

  test('passes a bare port through unchanged', () => {
    expect(resolveCdpTarget('9222', {})).toBe('9222');
  });

  test('passes ws/wss/http/https URLs through unchanged', () => {
    expect(resolveCdpTarget('ws://localhost:9222/devtools/browser/abc', {})).toBe(
      'ws://localhost:9222/devtools/browser/abc',
    );
    expect(resolveCdpTarget('wss://remote.example.com/cdp?token=x', {})).toBe(
      'wss://remote.example.com/cdp?token=x',
    );
    expect(resolveCdpTarget('http://127.0.0.1:9222', {})).toBe('http://127.0.0.1:9222');
    expect(resolveCdpTarget('https://browser.example.com', {})).toBe(
      'https://browser.example.com',
    );
  });

  test('prefixes http:// for host:port without a scheme', () => {
    expect(resolveCdpTarget('localhost:9222', {})).toBe('http://localhost:9222');
    expect(resolveCdpTarget('127.0.0.1:9222', {})).toBe('http://127.0.0.1:9222');
  });

  test('trims surrounding whitespace before normalizing', () => {
    expect(resolveCdpTarget('  localhost:9222  ', {})).toBe('http://localhost:9222');
    expect(resolveCdpTarget('  9222  ', {})).toBe('9222');
  });
});
