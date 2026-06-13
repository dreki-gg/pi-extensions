/**
 * Resolve the platform-specific command for opening a URL in the default
 * browser. Returns a `{ command, args }` pair suitable for `pi.exec`.
 *
 * Windows has no `xdg-open`; the browser is launched via the `cmd` builtin
 * `start`. The empty-string title argument (`start "" <url>`) prevents `start`
 * from treating a quoted URL as the window title and keeps URLs containing `&`
 * intact.
 */
export function openUrlCommand(
  url: string,
  platform: NodeJS.Platform = process.platform,
): { command: string; args: string[] } {
  switch (platform) {
    case 'darwin':
      return { command: 'open', args: [url] };
    case 'win32':
      return { command: 'cmd', args: ['/c', 'start', '', url] };
    default:
      return { command: 'xdg-open', args: [url] };
  }
}
