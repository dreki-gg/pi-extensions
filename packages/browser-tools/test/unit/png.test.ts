import { describe, expect, test } from 'bun:test';
import { deflateSync } from 'node:zlib';
import {
  decodePng,
  downscalePng,
  encodePng,
  MAX_EDGE,
} from '../../extensions/browser-tools/image/png.js';

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * Build a valid PNG independently of the production codec, using Node's zlib so
 * the decoder is exercised against a non-pako-deflated stream. `colorType` is
 * 2 (RGB) or 6 (RGBA). `fill(x, y)` returns channel values.
 */
function buildPng(
  width: number,
  height: number,
  colorType: 2 | 6,
  fill: (x: number, y: number) => number[],
): Uint8Array {
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const px = fill(x, y);
      const base = y * (stride + 1) + 1 + x * channels;
      for (let c = 0; c < channels; c++) raw[base + c] = px[c];
    }
  }

  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = colorType;

  const compressed = new Uint8Array(deflateSync(Buffer.from(raw)));
  const parts = [
    PNG_SIGNATURE,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', new Uint8Array(0)),
  ];
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

describe('decodePng', () => {
  test('decodes an RGBA PNG into normalized pixels', () => {
    const png = buildPng(2, 2, 6, (x, y) => [x * 100, y * 100, 50, 255]);
    const decoded = decodePng(png);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect([...decoded.rgba.slice(0, 4)]).toEqual([0, 0, 50, 255]);
    expect([...decoded.rgba.slice(4, 8)]).toEqual([100, 0, 50, 255]);
  });

  test('normalizes RGB (colorType 2) to opaque RGBA', () => {
    const png = buildPng(1, 1, 2, () => [10, 20, 30]);
    const decoded = decodePng(png);
    expect([...decoded.rgba]).toEqual([10, 20, 30, 255]);
  });

  test('rejects non-PNG input', () => {
    expect(() => decodePng(Uint8Array.from([1, 2, 3]))).toThrow();
  });
});

describe('encodePng round-trip', () => {
  test('encodes pixels that decode back identically', () => {
    const src = buildPng(3, 2, 6, (x, y) => [x * 40, y * 40, 7, 255]);
    const decoded = decodePng(src);
    const reencoded = encodePng(decoded);
    const again = decodePng(reencoded);
    expect(again.width).toBe(3);
    expect(again.height).toBe(2);
    expect([...again.rgba]).toEqual([...decoded.rgba]);
  });
});

describe('downscalePng', () => {
  test('leaves small images unchanged', () => {
    const png = buildPng(10, 10, 6, () => [120, 120, 120, 255]);
    expect(downscalePng(png)).toBe(png);
  });

  test('shrinks oversized images so the longest edge hits MAX_EDGE', () => {
    const png = buildPng(2600, 1000, 6, () => [200, 100, 50, 255]);
    const result = downscalePng(png);
    expect(result).not.toBe(png);
    const decoded = decodePng(result);
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(MAX_EDGE);
    expect(decoded.width).toBe(MAX_EDGE);
  });

  test('preserves aspect ratio when shrinking', () => {
    const png = buildPng(4000, 2000, 6, () => [10, 20, 30, 255]);
    const decoded = decodePng(downscalePng(png));
    expect(decoded.width).toBe(MAX_EDGE);
    expect(decoded.height).toBe(Math.round(MAX_EDGE / 2));
  });

  test('preserves solid color through resampling', () => {
    const png = buildPng(3000, 100, 6, () => [77, 88, 99, 255]);
    const decoded = decodePng(downscalePng(png));
    expect([...decoded.rgba.slice(0, 4)]).toEqual([77, 88, 99, 255]);
  });

  test('returns the original buffer for unsupported PNGs', () => {
    const bogus = Uint8Array.from([0, 1, 2, 3, 4]);
    expect(downscalePng(bogus)).toBe(bogus);
  });
});
