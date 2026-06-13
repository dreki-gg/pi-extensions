import { encode as encodeJpeg } from 'jpeg-js';
import { decodeToCappedRgba, MAX_EDGE } from './png.js';

/**
 * Prepare a raw PNG screenshot for transport to the model.
 *
 * Two limits motivate this:
 *
 * - Anthropic rejects images whose longest edge exceeds 2000px on many-image
 *   requests (HTTP 400). We cap the longest edge at {@link MAX_EDGE}.
 * - A long browsing session accumulates many screenshots and can blow past the
 *   total request-size limit (HTTP 413). PNG screenshots are large; re-encoding
 *   to JPEG shrinks them ~5-10x with no meaningful loss of legibility, which
 *   keeps the cumulative request well under the cap.
 *
 * Returns the JPEG (base64) plus its mime type. If the PNG can't be decoded
 * (unexpected format), the original PNG bytes are returned untouched so a
 * screenshot is never lost.
 */

/** JPEG quality (0-100). High enough to keep UI text crisp, low enough to be small. */
export const DEFAULT_JPEG_QUALITY = 80;

export type EncodedScreenshot = {
  base64: string;
  mimeType: 'image/jpeg' | 'image/png';
};

export function encodeScreenshot(
  png: Uint8Array,
  options: { maxEdge?: number; quality?: number } = {},
): EncodedScreenshot {
  const capped = decodeToCappedRgba(png, options.maxEdge ?? MAX_EDGE);
  if (!capped) {
    return { base64: Buffer.from(png).toString('base64'), mimeType: 'image/png' };
  }

  const jpeg = encodeJpeg(
    { width: capped.width, height: capped.height, data: capped.rgba },
    options.quality ?? DEFAULT_JPEG_QUALITY,
  );
  return { base64: Buffer.from(jpeg.data).toString('base64'), mimeType: 'image/jpeg' };
}
