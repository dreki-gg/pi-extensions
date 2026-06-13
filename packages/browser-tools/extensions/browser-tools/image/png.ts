import { deflate, inflate } from 'pako';

/**
 * Minimal, self-contained PNG codec + area-average downscaler.
 *
 * Why this exists: agent-browser captures viewport screenshots at the headless
 * browser's device pixel ratio. On retina displays a 1280px-wide viewport
 * becomes a 2560px-wide PNG. Anthropic's API rejects any image whose longest
 * edge exceeds 2000px once a request carries many images ("many-image
 * requests"), which made long browsing sessions hard-fail. We downscale the
 * captured PNG so its longest edge never exceeds {@link MAX_EDGE} before it is
 * base64-encoded and handed to the model. This also trims image tokens.
 *
 * Scope: handles 8-bit, non-interlaced PNGs with colorType 2 (RGB) or 6 (RGBA),
 * which is what Chromium/Lightpanda screenshots produce. Anything else is left
 * untouched (safe fallback — better to forward the original than to crash).
 */

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Anthropic's recommended max long edge; also keeps us under the 2000px cap. */
export const MAX_EDGE = 1568;

export type DecodedImage = {
  width: number;
  height: number;
  /** Always normalized to RGBA, 4 bytes per pixel. */
  rgba: Uint8Array;
};

/**
 * Decode a PNG and downscale it to RGBA pixels whose longest edge is at most
 * `maxEdge`. Returns `null` for unsupported PNGs so callers can fall back to the
 * original bytes. Unlike {@link downscalePng}, this returns raw pixels (handy
 * for re-encoding to another format such as JPEG).
 */
export function decodeToCappedRgba(
  input: Uint8Array,
  maxEdge: number = MAX_EDGE,
): DecodedImage | null {
  let decoded: DecodedImage;
  try {
    decoded = decodePng(input);
  } catch {
    return null;
  }

  const longest = Math.max(decoded.width, decoded.height);
  if (longest <= maxEdge) {
    return decoded;
  }

  const scale = maxEdge / longest;
  const targetWidth = Math.max(1, Math.round(decoded.width * scale));
  const targetHeight = Math.max(1, Math.round(decoded.height * scale));
  return resampleArea(decoded, targetWidth, targetHeight);
}

/**
 * Downscale a PNG so neither dimension exceeds `maxEdge`, preserving aspect
 * ratio. Returns the original buffer unchanged when it already fits or when the
 * PNG uses an unsupported format.
 */
export function downscalePng(input: Uint8Array, maxEdge: number = MAX_EDGE): Uint8Array {
  let decoded: DecodedImage;
  try {
    decoded = decodePng(input);
  } catch {
    return input;
  }

  const longest = Math.max(decoded.width, decoded.height);
  if (longest <= maxEdge) {
    return input;
  }

  const scale = maxEdge / longest;
  const targetWidth = Math.max(1, Math.round(decoded.width * scale));
  const targetHeight = Math.max(1, Math.round(decoded.height * scale));

  const resized = resampleArea(decoded, targetWidth, targetHeight);
  return encodePng(resized);
}

export function decodePng(input: Uint8Array): DecodedImage {
  if (input.length < PNG_SIGNATURE.length) {
    throw new Error('Not a PNG: too short');
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (input[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Not a PNG: bad signature');
    }
  }

  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  let offset = PNG_SIGNATURE.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts: Uint8Array[] = [];

  while (offset < input.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(
      input[offset + 4],
      input[offset + 5],
      input[offset + 6],
      input[offset + 7],
    );
    const dataStart = offset + 8;

    if (type === 'IHDR') {
      width = view.getUint32(dataStart);
      height = view.getUint32(dataStart + 4);
      bitDepth = input[dataStart + 8];
      colorType = input[dataStart + 9];
      interlace = input[dataStart + 12];
    } else if (type === 'IDAT') {
      idatParts.push(input.subarray(dataStart, dataStart + length));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataStart + length + 4; // skip data + CRC
  }

  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(
      `Unsupported PNG (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`,
    );
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflate(concat(idatParts));
  const rgba = unfilter(raw, width, height, channels);
  return { width, height, rgba };
}

export function encodePng(image: DecodedImage): Uint8Array {
  const { width, height, rgba } = image;
  const stride = width * 4;
  const filtered = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0; // filter type: none
    filtered.set(rgba.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }

  const compressed = deflate(filtered);

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const chunks = [
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', new Uint8Array(0)),
  ];
  return concat([PNG_SIGNATURE, ...chunks]);
}

/** Area-average (box) downsampling — high quality for shrinking screenshots. */
function resampleArea(image: DecodedImage, targetWidth: number, targetHeight: number): DecodedImage {
  const { width, height, rgba } = image;
  const out = new Uint8Array(targetWidth * targetHeight * 4);
  const xRatio = width / targetWidth;
  const yRatio = height / targetHeight;

  for (let ty = 0; ty < targetHeight; ty++) {
    const sy0 = Math.floor(ty * yRatio);
    const sy1 = Math.max(sy0 + 1, Math.floor((ty + 1) * yRatio));
    for (let tx = 0; tx < targetWidth; tx++) {
      const sx0 = Math.floor(tx * xRatio);
      const sx1 = Math.max(sx0 + 1, Math.floor((tx + 1) * xRatio));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const i = (sy * width + sx) * 4;
          r += rgba[i];
          g += rgba[i + 1];
          b += rgba[i + 2];
          a += rgba[i + 3];
          count++;
        }
      }

      const o = (ty * targetWidth + tx) * 4;
      out[o] = Math.round(r / count);
      out[o + 1] = Math.round(g / count);
      out[o + 2] = Math.round(b / count);
      out[o + 3] = Math.round(a / count);
    }
  }

  return { width: targetWidth, height: targetHeight, rgba: out };
}

/** Reverse PNG scanline filters, normalizing output to RGBA. */
function unfilter(raw: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);

  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos++];
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;

      let value: number;
      switch (filterType) {
        case 0:
          value = rawByte;
          break;
        case 1:
          value = rawByte + a;
          break;
        case 2:
          value = rawByte + b;
          break;
        case 3:
          value = rawByte + ((a + b) >> 1);
          break;
        case 4:
          value = rawByte + paeth(a, b, c);
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }
      cur[x] = value & 0xff;
    }

    for (let x = 0; x < width; x++) {
      const src = x * channels;
      const dst = (y * width + x) * 4;
      rgba[dst] = cur[src];
      rgba[dst + 1] = cur[src + 1];
      rgba[dst + 2] = cur[src + 2];
      rgba[dst + 3] = channels === 4 ? cur[src + 3] : 255;
    }

    prev.set(cur);
  }

  return rgba;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
