export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg"] as const;

export type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

/** What the first bytes of a file say about it, whatever its name or declared type. */
export interface ImageSignature {
  mimeType: ImageMimeType;
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_IHDR_TYPE = [0x49, 0x48, 0x44, 0x52];
const PNG_IHDR_DATA_LENGTH = 13;
const PNG_IHDR_END = 8 + 4 + 4 + 8; // signature, chunk length, chunk type, width and height

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const JPEG_MARKER_PREFIX = 0xff;
const JPEG_FILL_BYTE = 0xff;
const JPEG_START_OF_SCAN = 0xda;
const JPEG_END_OF_IMAGE = 0xd9;
const JPEG_MARKER_AND_LENGTH_SIZE = 4;
const JPEG_FRAME_HEADER_SIZE = 9; // marker, length, precision, height and width
// Start-of-frame markers are C0-CF, except C4 (Huffman tables), C8 (reserved) and CC (arithmetic tables).
const JPEG_NOT_A_FRAME = new Set([0xc4, 0xc8, 0xcc]);

function startsWith(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return bytes.length >= offset + expected.length && expected.every((value, index) => bytes[offset + index] === value);
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) * 0x100 + (bytes[offset + 1] ?? 0);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return readUint16(bytes, offset) * 0x10000 + readUint16(bytes, offset + 2);
}

function isFrameMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && !JPEG_NOT_A_FRAME.has(marker);
}

function readPng(bytes: Uint8Array): ImageSignature | null {
  if (!startsWith(bytes, PNG_SIGNATURE) || bytes.length < PNG_IHDR_END) return null;
  // The first chunk of every PNG is IHDR, and it holds the size.
  if (readUint32(bytes, 8) !== PNG_IHDR_DATA_LENGTH || !startsWith(bytes, PNG_IHDR_TYPE, 12)) return null;

  const width = readUint32(bytes, 16);
  const height = readUint32(bytes, 20);
  return width > 0 && height > 0 ? { mimeType: "image/png", width, height } : null;
}

// Walks the segments until the frame header (SOFn), which holds the size. A scan or the end of the
// image before any frame header, a segment that does not fit, or a missing marker prefix is not a JPEG.
function readJpeg(bytes: Uint8Array): ImageSignature | null {
  if (!startsWith(bytes, JPEG_SIGNATURE)) return null;

  let offset = JPEG_SIGNATURE.length - 1;
  while (offset + JPEG_MARKER_AND_LENGTH_SIZE <= bytes.length) {
    if (bytes[offset] !== JPEG_MARKER_PREFIX) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === JPEG_FILL_BYTE) {
      offset += 1;
      continue;
    }
    if (marker === JPEG_START_OF_SCAN || marker === JPEG_END_OF_IMAGE || marker === 0x00) return null;

    if (isFrameMarker(marker)) {
      if (offset + JPEG_FRAME_HEADER_SIZE > bytes.length) return null;
      const height = readUint16(bytes, offset + 5);
      const width = readUint16(bytes, offset + 7);
      return width > 0 && height > 0 ? { mimeType: "image/jpeg", width, height } : null;
    }

    const segmentLength = readUint16(bytes, offset + 2);
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

/**
 * Recognises a PNG or a JPEG by its content and reads its size, or answers `null` for anything
 * else: SVG, GIF, WebP, text renamed to `.png`, a file cut short. It never decodes the image and
 * never throws, whatever the bytes are.
 */
export function readImageSignature(bytes: Uint8Array): ImageSignature | null {
  return readPng(bytes) ?? readJpeg(bytes);
}
