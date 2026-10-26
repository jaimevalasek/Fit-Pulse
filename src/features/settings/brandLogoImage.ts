// Prepares the logo picked in "Seus relatórios" (AC-ra-21): the format is read from the first bytes,
// not from the name or the type the browser guessed, and the size is checked before anything is
// decoded. A picture larger than 600 px on its longer side is redrawn smaller in the same format.
import type { BrandLogoUpload } from "@/api/brandApi";

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MAX_SIDE = 600;
const JPEG_QUALITY = 0.9;
const LOGO_REFUSED_MESSAGE = "Use uma imagem PNG ou JPG de até 2 MB.";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

type LogoMimeType = BrandLogoUpload["mimeType"];

interface PreparedLogo extends BrandLogoUpload {
  // For the thumbnail before the logo is saved
  dataUrl: string;
  width: number;
  height: number;
  resized: boolean;
}

class LogoRefusedError extends Error {
  constructor() {
    super(LOGO_REFUSED_MESSAGE);
    this.name = "LogoRefusedError";
  }
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);
}

function detectLogoMimeType(bytes: Uint8Array): LogoMimeType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, JPEG_SIGNATURE)) return "image/jpeg";
  return null;
}

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = "";
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

function canvasToBytes(canvas: HTMLCanvasElement, mimeType: LogoMimeType): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new LogoRefusedError());
          return;
        }
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      mimeType,
      mimeType === "image/jpeg" ? JPEG_QUALITY : undefined,
    );
  });
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Right signature but a broken picture
    throw new LogoRefusedError();
  }
}

async function shrink(bitmap: ImageBitmap, mimeType: LogoMimeType): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const scale = LOGO_MAX_SIDE / Math.max(bitmap.width, bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new LogoRefusedError();
  // JPEG has no transparency: a white ground keeps transparent pixels from turning black
  if (mimeType === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  return { bytes: await canvasToBytes(canvas, mimeType), width, height };
}

// Throws LogoRefusedError for anything but a PNG or JPEG up to 2 MB
async function prepareBrandLogo(file: File): Promise<PreparedLogo> {
  if (file.size === 0 || file.size > LOGO_MAX_BYTES) throw new LogoRefusedError();
  const original = new Uint8Array(await file.arrayBuffer());
  const mimeType = detectLogoMimeType(original);
  if (!mimeType) throw new LogoRefusedError();

  const bitmap = await decode(file);
  try {
    const resized = Math.max(bitmap.width, bitmap.height) > LOGO_MAX_SIDE;
    const output = resized ? await shrink(bitmap, mimeType) : { bytes: original, width: bitmap.width, height: bitmap.height };
    const dataBase64 = bytesToBase64(output.bytes);
    return {
      mimeType,
      dataBase64,
      dataUrl: `data:${mimeType};base64,${dataBase64}`,
      width: output.width,
      height: output.height,
      resized,
    };
  } finally {
    bitmap.close();
  }
}

export { LOGO_MAX_SIDE, LOGO_REFUSED_MESSAGE, LogoRefusedError, detectLogoMimeType, prepareBrandLogo };
export type { PreparedLogo };
