import { describe, expect, test } from 'bun:test';
import { buildCdpConnectError } from '../../extensions/browser-tools/backends/cdp-connect-error.js';

describe('buildCdpConnectError', () => {
  test('adds Chrome 136 relaunch guidance for connection-refused failures', () => {
    const message = buildCdpConnectError(
      '9222',
      new Error(
        'All CDP discovery methods failed for 127.0.0.1:9222: Connection refused (os error 61)',
      ),
    );
    expect(message).toContain('Could not connect to a browser over CDP at 9222');
    expect(message).toContain('Chrome 136+');
    expect(message).toContain('--user-data-dir="$HOME/.chrome-debug"');
    expect(message).toContain('curl -s http://localhost:9222/json/version');
    expect(message).toContain('Connection refused (os error 61)');
  });

  test('omits the relaunch guidance for unrelated failures', () => {
    const message = buildCdpConnectError('9222', new Error('some other failure'));
    expect(message).toContain('Could not connect to a browser over CDP at 9222');
    expect(message).not.toContain('Chrome 136+');
    expect(message).toContain('Underlying error: some other failure');
  });

  test('stringifies non-Error values', () => {
    const message = buildCdpConnectError('ws://x', 'raw string failure');
    expect(message).toContain('Underlying error: raw string failure');
  });
});
