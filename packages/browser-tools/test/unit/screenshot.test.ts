import { describe, expect, test } from 'bun:test';
import { deflateSync } from 'node:zlib';
import { decode as decodeJpeg } from 'jpeg-js';
import { encodeScreenshot } from '../../extensions/browser-tools/image/screenshot.js';
import { MAX_EDGE } from '../../extensions/browser-tools/image/png.js';

const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
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

function buildRgbaPng(width: number, height: number, fill: (x: number, y: number) => number[]): Uint8Array {
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const px = fill(x, y);
      const base = y * (stride + 1) + 1 + x * 4;
      for (let c = 0; c < 4; c++) raw[base + c] = px[c];
    }
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
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

describe('encodeScreenshot', () => {
  test('re-encodes a PNG screenshot as JPEG', () => {
    const png = buildRgbaPng(64, 48, () => [120, 60, 200, 255]);
    const result = encodeScreenshot(png);
    expect(result.mimeType).toBe('image/jpeg');
    const bytes = Buffer.from(result.base64, 'base64');
    // Valid JPEG: SOI marker 0xFFD8.
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    const decoded = decodeJpeg(bytes, { useTArray: true });
    expect(decoded.width).toBe(64);
    expect(decoded.height).toBe(48);
  });

  test('caps the longest edge while converting to JPEG', () => {
    const png = buildRgbaPng(2600, 1000, () => [200, 100, 50, 255]);
    const result = encodeScreenshot(png);
    const decoded = decodeJpeg(Buffer.from(result.base64, 'base64'), { useTArray: true });
    expect(Math.max(decoded.width, decoded.height)).toBeLessThanOrEqual(MAX_EDGE);
    expect(decoded.width).toBe(MAX_EDGE);
  });

  test('falls back to the original PNG when it cannot be decoded', () => {
    const bogus = Uint8Array.from([0, 1, 2, 3, 4]);
    const result = encodeScreenshot(bogus);
    expect(result.mimeType).toBe('image/png');
    expect(result.base64).toBe(Buffer.from(bogus).toString('base64'));
  });
});
