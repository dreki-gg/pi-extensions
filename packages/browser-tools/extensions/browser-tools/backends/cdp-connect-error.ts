const CONNECTION_REFUSED = /connection refused|discovery methods failed|failed to connect|os error 61|econnrefused/iu;

/**
 * Build an actionable error message when `agent-browser connect <target>`
 * fails. The raw CLI error is a CDP discovery dump; for the common
 * "nothing is listening" case we surface the Chrome 136+ default-profile
 * caveat and the exact relaunch + verify commands.
 */
export function buildCdpConnectError(target: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  const lines = [`Could not connect to a browser over CDP at ${target}.`];

  if (CONNECTION_REFUSED.test(detail)) {
    lines.push(
      '',
      'Nothing is listening on that debug port. Chrome 136+ ignores',
      '--remote-debugging-port when it runs on the default profile directory,',
      'so the port never opens. Relaunch Chrome with a dedicated profile:',
      '',
      "  osascript -e 'quit app \"Google Chrome\"'",
      '  open -na "Google Chrome" --args \\',
      '    --remote-debugging-port=9222 \\',
      '    --user-data-dir="$HOME/.chrome-debug"',
      '',
      'Sign in once in that window, then verify the port is live:',
      '  curl -s http://localhost:9222/json/version',
    );
  }

  lines.push('', `Underlying error: ${detail}`);
  return lines.join('\n');
}
