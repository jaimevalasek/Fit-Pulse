import { describe, expect, it } from "vitest";
import { readImageSignature } from "../../server/files/imageSignature.ts";

// AC-ra-21: the logo's format is read from the file's content, never from its name or declared type.
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function uint16(value: number): number[] {
  return [Math.floor(value / 0x100) % 0x100, value % 0x100];
}

function uint32(value: number): number[] {
  return [...uint16(Math.floor(value / 0x10000)), ...uint16(value % 0x10000)];
}

function pngWithSize(width: number, height: number): Buffer {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...uint32(13), 0x49, 0x48, 0x44, 0x52,
    ...uint32(width), ...uint32(height),
    0x08, 0x06, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
}

const JFIF_SEGMENT = [0xff, 0xe0, ...uint16(16), 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
// A Huffman table (C4) sits before the frame header in most files and must not be read as one.
const HUFFMAN_SEGMENT = [0xff, 0xc4, ...uint16(5), 0x00, 0x01, 0x02];

function jpegWithSize(width: number, height: number, frameMarker = 0xc0): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    ...JFIF_SEGMENT,
    ...HUFFMAN_SEGMENT,
    0xff, frameMarker, ...uint16(11), 0x08, ...uint16(height), ...uint16(width), 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, ...uint16(8), 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0xff, 0xd9,
  ]);
}

describe("readImageSignature on PNG (AC-ra-21)", () => {
  it("reads the size of a real PNG", () => {
    expect(readImageSignature(ONE_PIXEL_PNG)).toEqual({ mimeType: "image/png", width: 1, height: 1 });
  });

  it.each([
    [600, 600],
    [1200, 300],
    [64, 4000],
    [65535, 65536],
  ])("reads %i x %i from the IHDR", (width, height) => {
    expect(readImageSignature(pngWithSize(width, height))).toEqual({ mimeType: "image/png", width, height });
  });

  it("reads a size above 2^31 without turning it negative", () => {
    expect(readImageSignature(pngWithSize(0xffffffff, 2))).toEqual({
      mimeType: "image/png",
      width: 0xffffffff,
      height: 2,
    });
  });

  it("refuses a PNG whose size is zero", () => {
    expect(readImageSignature(pngWithSize(0, 10))).toBeNull();
    expect(readImageSignature(pngWithSize(10, 0))).toBeNull();
  });

  it("refuses a PNG whose first chunk is not a full IHDR", () => {
    const notHeader = pngWithSize(10, 10);
    notHeader.write("tEXt", 12, "latin1");
    expect(readImageSignature(notHeader)).toBeNull();

    const wrongLength = pngWithSize(10, 10);
    wrongLength[11] = 12;
    expect(readImageSignature(wrongLength)).toBeNull();
  });

  it("refuses a PNG cut before the size", () => {
    expect(readImageSignature(pngWithSize(10, 10).subarray(0, 8))).toBeNull();
    expect(readImageSignature(pngWithSize(10, 10).subarray(0, 23))).toBeNull();
  });
});

describe("readImageSignature on JPEG (AC-ra-21)", () => {
  it.each([
    [600, 400],
    [400, 600],
    [1200, 1200],
    [1, 1],
    [65535, 65535],
  ])("reads %i x %i from the frame header", (width, height) => {
    expect(readImageSignature(jpegWithSize(width, height))).toEqual({ mimeType: "image/jpeg", width, height });
  });

  it.each([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc9, 0xcf])("reads the size from frame marker %i", (marker) => {
    expect(readImageSignature(jpegWithSize(321, 123, marker))).toEqual({
      mimeType: "image/jpeg",
      width: 321,
      height: 123,
    });
  });

  it("skips fill bytes between segments", () => {
    const jpeg = jpegWithSize(80, 40);
    const withFill = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xff]), jpeg.subarray(2)]);
    expect(readImageSignature(withFill)).toEqual({ mimeType: "image/jpeg", width: 80, height: 40 });
  });

  it("refuses a JPEG whose size is zero", () => {
    expect(readImageSignature(jpegWithSize(0, 10))).toBeNull();
    expect(readImageSignature(jpegWithSize(10, 0))).toBeNull();
  });

  it("refuses a JPEG that reaches the scan or the end before any frame header", () => {
    expect(readImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xda, ...uint16(8), 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]))).toBeNull();
    expect(readImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x00, 0x00]))).toBeNull();
  });

  it("refuses a JPEG with a segment that is shorter than its own length field or lacks the marker prefix", () => {
    expect(readImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01, 0x00, 0x00]))).toBeNull();
    expect(readImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0x12, 0x34, 0x00, 0x00]))).toBeNull();
  });

  it("refuses a JPEG cut inside the frame header or before it", () => {
    const jpeg = jpegWithSize(600, 400);
    const frameStart = jpeg.indexOf(Buffer.from([0xff, 0xc0]));
    expect(readImageSignature(jpeg.subarray(0, frameStart + 8))).toBeNull();
    expect(readImageSignature(jpeg.subarray(0, 12))).toBeNull();
    expect(readImageSignature(jpeg.subarray(0, 3))).toBeNull();
  });
});

describe("readImageSignature on everything else (AC-ra-21)", () => {
  const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100"/></svg>`;

  it.each([
    ["an SVG", Buffer.from(SVG)],
    ["an SVG with an XML prolog", Buffer.from(`<?xml version="1.0"?>${SVG}`)],
    ["plain text renamed to .png", Buffer.from("isto não é uma imagem, só um texto com nome de .png")],
    ["a GIF", Buffer.from("GIF89a\x01\x00\x01\x00\x80\x00\x00", "latin1")],
    ["a WebP", Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x1a, 0, 0, 0]), Buffer.from("WEBPVP8 ")])],
    ["a PDF", Buffer.from("%PDF-1.7\n%âãÏÓ\n")],
    ["a BMP", Buffer.from("BM\x36\x00\x00\x00\x00\x00\x00\x00\x36\x00\x00\x00", "latin1")],
    ["an empty file", Buffer.alloc(0)],
    ["a single byte", Buffer.from([0xff])],
    ["zeros", Buffer.alloc(64)],
    ["only the PNG signature", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["a PNG signature broken by a text conversion", Buffer.from([0xef, 0xbf, 0xbd, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(24).fill(0)])],
  ])("refuses %s", (_label, bytes) => {
    expect(readImageSignature(bytes)).toBeNull();
  });

  it("never throws, whatever the bytes are", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const noise = Buffer.alloc(40 + (seed % 30));
      for (let index = 0; index < noise.length; index += 1) {
        noise[index] = (seed * 131 + index * 197 + (index >> 2) * 61) % 256;
      }
      const jpegLike = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), noise]);
      const pngLike = Buffer.concat([pngWithSize(10, 10).subarray(0, 8), noise]);
      expect(() => readImageSignature(noise)).not.toThrow();
      expect(() => readImageSignature(jpegLike)).not.toThrow();
      expect(() => readImageSignature(pngLike)).not.toThrow();
    }
  });
});
