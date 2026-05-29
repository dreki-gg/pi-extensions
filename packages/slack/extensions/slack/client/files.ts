import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Effect } from 'effect';
import { slackGet, slackDownload } from './http.js';
import { SlackFileError } from './errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlackFileInfo {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  size: number;
  urlPrivate: string;
  permalink: string;
  isImage: boolean;
  imageWidth?: number;
  imageHeight?: number;
}

export interface DownloadedFile {
  info: SlackFileInfo;
  localPath: string;
}

// ---------------------------------------------------------------------------
// Raw Slack shapes
// ---------------------------------------------------------------------------

interface RawFile {
  id: string;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  size: number;
  url_private: string;
  permalink: string;
  original_w?: number;
  original_h?: number;
}

const IMAGE_MIMETYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

function normalizeFileInfo(raw: RawFile): SlackFileInfo {
  const isImage = IMAGE_MIMETYPES.has(raw.mimetype);
  const info: SlackFileInfo = {
    id: raw.id,
    name: raw.name,
    title: raw.title,
    mimetype: raw.mimetype,
    filetype: raw.filetype,
    size: raw.size,
    urlPrivate: raw.url_private,
    permalink: raw.permalink,
    isImage,
  };
  if (isImage && raw.original_w) info.imageWidth = raw.original_w;
  if (isImage && raw.original_h) info.imageHeight = raw.original_h;
  return info;
}

// ---------------------------------------------------------------------------
// Temp directory for downloads
// ---------------------------------------------------------------------------

const DOWNLOAD_DIR = join(tmpdir(), 'pi-slack-files');

function ensureDownloadDir() {
  return Effect.tryPromise({
    try: () => mkdir(DOWNLOAD_DIR, { recursive: true }),
    catch: (err) => new SlackFileError({ fileId: 'n/a', reason: `Cannot create temp dir: ${err}` }),
  });
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export function getFileInfo(fileId: string) {
  return Effect.gen(function* () {
    const resp = yield* slackGet<{ ok: true; file: RawFile }>('files.info', {
      file: fileId,
    });
    return normalizeFileInfo(resp.file);
  });
}

export function downloadFile(fileId: string) {
  return Effect.gen(function* () {
    yield* ensureDownloadDir();

    const info = yield* getFileInfo(fileId);

    const buffer = yield* slackDownload(info.urlPrivate).pipe(
      Effect.mapError((err) => new SlackFileError({ fileId, reason: `Download failed: ${err}` })),
    );

    const ext = info.name.includes('.') ? '' : `.${info.filetype}`;
    const filename = `${info.id}-${info.name}${ext}`;
    const localPath = join(DOWNLOAD_DIR, filename);

    yield* Effect.tryPromise({
      try: () => writeFile(localPath, Buffer.from(buffer)),
      catch: (err) => new SlackFileError({ fileId, reason: `Write failed: ${err}` }),
    });

    return { info, localPath } satisfies DownloadedFile;
  });
}
