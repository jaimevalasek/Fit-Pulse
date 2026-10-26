import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** Longest file name stem (without extension) that is written; longer text is cut. */
export const MAX_FILE_STEM_LENGTH = 80;

const FALLBACK_STEM = "arquivo";
// Names Windows reserves for devices, with or without an extension ("CON", "con.txt", "COM1").
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
// Path separators, the characters Windows reserves in names and control characters.
const UNSAFE_CHARACTERS = /[\\/:*?"<>|\u0000-\u001f\u007f]+/g;
// Zero-width and direction-control characters that make two names look the same.
const INVISIBLE_CHARACTERS = /[​-‏‪-‮⁠-⁤﻿]/g;

/** The user's Downloads folder; it is created on the first save when it is missing. */
export function defaultDownloadsDir(home: string = os.homedir()): string {
  return path.join(home, "Downloads");
}

/**
 * A name that stays inside the folder it is written to: no separators, no characters Windows
 * reserves, no leading dots (so `..` and hidden files are impossible), no trailing dots or
 * spaces, no device names, at most `maxLength` characters. Never empty.
 */
export function sanitizeFileStem(text: string, maxLength: number = MAX_FILE_STEM_LENGTH): string {
  const cleaned = text
    .normalize("NFC")
    .replace(INVISIBLE_CHARACTERS, "")
    .replace(UNSAFE_CHARACTERS, "-")
    .replace(/\s+/g, " ");
  // Cutting by code point keeps an accent or emoji whole; the trim runs after the cut.
  const cut = Array.from(cleaned).slice(0, Math.max(maxLength, 1)).join("");
  const trimmed = cut.replace(/^[.\s-]+/, "").replace(/[.\s-]+$/, "");
  const stem = trimmed === "" ? FALLBACK_STEM : trimmed;
  return WINDOWS_RESERVED_NAME.test(stem.split(".")[0]) ? `_${stem}`.slice(0, maxLength) : stem;
}

/** The file could not be written; `cause` has the operating system error. Nothing was left behind. */
export class FileWriteError extends Error {
  constructor(cause: unknown) {
    super("Could not write the file to the Downloads folder.", { cause });
    this.name = "FileWriteError";
  }
}

export interface SavedFile {
  /** The name the file ended up with, e.g. `Academia Foco-2026-10-23 (2).pdf`. */
  fileName: string;
  /** Absolute path of the folder it was written to. */
  directory: string;
}

export interface FileToSave {
  directory: string;
  /** Name without extension; it is cleaned with `sanitizeFileStem`. */
  stem: string;
  /** With the dot, e.g. `.pdf`. */
  extension: string;
  content: Buffer | Uint8Array;
}

function isAlreadyThere(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "EEXIST";
}

// Takes the first free name by creating it empty with `wx`, so two saves at the same moment can
// never choose the same one; the rename that follows replaces this placeholder.
async function reserveFileName(directory: string, stem: string, extension: string): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    const suffix = attempt === 1 ? "" : ` (${attempt})`;
    const fileName = `${stem}${suffix}${extension}`;
    try {
      const handle = await open(path.join(directory, fileName), "wx");
      await handle.close();
      return fileName;
    } catch (error) {
      if (!isAlreadyThere(error)) {
        throw error;
      }
    }
  }
}

/**
 * Writes the content to a temporary file next to the final one and renames it, so a failure
 * never leaves a half-written file with the final name. A name already in use is kept and the
 * new file gets ` (2)`, ` (3)`... (nothing the owner saved before is overwritten).
 */
export async function saveFile({ directory, stem, extension, content }: FileToSave): Promise<SavedFile> {
  const safeStem = sanitizeFileStem(stem);
  const temporaryPath = path.join(directory, `.${randomUUID()}.tmp`);
  let reservedPath: string | null = null;
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, content, { flag: "wx" });
    const fileName = await reserveFileName(directory, safeStem, extension);
    reservedPath = path.join(directory, fileName);
    await rename(temporaryPath, reservedPath);
    return { fileName, directory };
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    if (reservedPath !== null) {
      await rm(reservedPath, { force: true }).catch(() => undefined);
    }
    throw new FileWriteError(error);
  }
}
