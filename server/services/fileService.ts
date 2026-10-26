import { lstat } from "node:fs/promises";
import path from "node:path";
import type { SystemOpener } from "../files/systemOpener.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { createGeneratedFileRepository } from "../repositories/generatedFileRepository.ts";
import { DomainError } from "./domainError.ts";

/** IF-002: acts on a file the app saved, named only by the id of its record. */
export interface FileService {
  /** Opens the file in the default reader of the computer. */
  open(fileId: string): Promise<void>;
  /** Opens the Downloads folder with the file selected. */
  reveal(fileId: string): Promise<void>;
}

export interface FileServiceDeps {
  prisma: PrismaClient;
  /** The app's Downloads folder: nothing outside it is ever opened. */
  downloadsDir: string;
  systemOpener: SystemOpener;
}

// Ids the app writes are UUIDs; anything longer cannot be one and never reaches the database.
const MAX_FILE_ID_LENGTH = 64;

function fileNotFound(): DomainError {
  return new DomainError(404, "file_not_found", "Esse arquivo não está mais na pasta Downloads.");
}

function openFailed(directory: string): DomainError {
  return new DomainError(500, "open_failed", `Não foi possível abrir. O arquivo está em ${directory}.`, { directory });
}

async function isRegularFile(filePath: string): Promise<boolean> {
  try {
    // lstat does not follow a link: a link put where the PDF was is not the file the app saved.
    return (await lstat(filePath)).isFile();
  } catch {
    return false;
  }
}

// `path.relative` compares the way the platform does (Windows ignores case).
function isDirectChildOf(directory: string, candidate: string): boolean {
  return path.relative(path.resolve(directory), path.dirname(path.resolve(candidate))) === "";
}

export function createFileService({ prisma, downloadsDir, systemOpener }: FileServiceDeps): FileService {
  const files = createGeneratedFileRepository(prisma);

  // The record gives the path; the request gave only the id. The path must be a plain file name
  // inside the app's Downloads folder, and the file must still be there.
  async function resolveSavedFile(fileId: string): Promise<{ filePath: string; directory: string }> {
    const record = fileId.length <= MAX_FILE_ID_LENGTH ? await files.findById(fileId) : null;
    if (record === null) {
      throw fileNotFound();
    }
    const filePath = path.join(record.directory, record.fileName);
    const isPlainName = record.fileName !== "" && record.fileName === path.basename(record.fileName);
    if (!isPlainName || !isDirectChildOf(downloadsDir, filePath) || !(await isRegularFile(filePath))) {
      throw fileNotFound();
    }
    return { filePath, directory: record.directory };
  }

  async function act(fileId: string, action: (filePath: string) => Promise<void>): Promise<void> {
    const { filePath, directory } = await resolveSavedFile(fileId);
    try {
      await action(filePath);
    } catch (error) {
      console.error("[fitpulse] system could not open the saved file:", error);
      throw openFailed(directory);
    }
  }

  return {
    open: (fileId) => act(fileId, (filePath) => systemOpener.openFile(filePath)),
    reveal: (fileId) => act(fileId, (filePath) => systemOpener.revealFile(filePath)),
  };
}
