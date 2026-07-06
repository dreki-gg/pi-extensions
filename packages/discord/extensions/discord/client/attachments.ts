import { writeFile, mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';
import { Effect } from 'effect';
import { discordDownload } from './http.js';
import { DiscordFileError } from './errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DownloadedAttachment {
  url: string;
  filename: string;
  localPath: string;
  isImage: boolean;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);

const DOWNLOAD_DIR = join(tmpdir(), 'pi-discord-files');

function ensureDownloadDir() {
  return Effect.tryPromise({
    try: () => mkdir(DOWNLOAD_DIR, { recursive: true }),
    catch: (err) => new DiscordFileError({ url: 'n/a', reason: `Cannot create temp dir: ${err}` }),
  });
}

/**
 * Derive a safe filename from a Discord CDN URL, stripping signed-URL query
 * params (`?ex=&is=&hm=`).
 */
function filenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const name = basename(pathname);
    return name || 'attachment';
  } catch {
    return 'attachment';
  }
}

function isImageFilename(filename: string): boolean {
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.has(filename.slice(dot + 1).toLowerCase());
}

// ---------------------------------------------------------------------------
// Effect
// ---------------------------------------------------------------------------

export function downloadAttachment(url: string) {
  return Effect.gen(function* () {
    yield* ensureDownloadDir();

    const buffer = yield* discordDownload(url).pipe(
      Effect.mapError((err) => new DiscordFileError({ url, reason: `Download failed: ${err}` })),
    );

    const filename = filenameFromUrl(url);
    const localPath = join(DOWNLOAD_DIR, `${Date.now()}-${filename}`);

    yield* Effect.tryPromise({
      try: () => writeFile(localPath, Buffer.from(buffer)),
      catch: (err) => new DiscordFileError({ url, reason: `Write failed: ${err}` }),
    });

    return {
      url,
      filename,
      localPath,
      isImage: isImageFilename(filename),
    } satisfies DownloadedAttachment;
  });
}
