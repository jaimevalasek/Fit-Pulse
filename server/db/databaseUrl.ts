import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATABASE_FILE_NAME = "fitpulse.db";

// This file lives at <app root>/server/db, so the app root is two levels up
// regardless of the process working directory.
const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export function resolveAppRoot(): string {
  return APP_ROOT;
}

export function resolveDataDir(): string {
  return path.join(APP_ROOT, "data");
}

/**
 * The SQLite URL used by the app, the Prisma CLI and the tests.
 *
 * `DATABASE_URL` wins when set. Otherwise the database is `data/fitpulse.db`
 * inside the app folder, addressed by an absolute `file:` URL (forward slashes
 * keep the Windows drive path valid for both Prisma and better-sqlite3).
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.DATABASE_URL?.trim();
  if (configured) {
    return configured;
  }

  const dataDir = resolveDataDir();
  mkdirSync(dataDir, { recursive: true });
  return `file:${path.join(dataDir, DATABASE_FILE_NAME).replaceAll("\\", "/")}`;
}
