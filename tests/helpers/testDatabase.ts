import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { resolveAppRoot } from "../../server/db/databaseUrl.ts";
import { createPrismaClient } from "../../server/db/prismaClient.ts";
import type { PrismaClient } from "../../server/generated/prisma/client.ts";

const DEFAULT_NOW = new Date("2026-10-23T12:00:00.000Z");

/** Matches the dependencies `createApp` receives, plus handles for test setup and cleanup. */
export interface TestDatabase {
  prisma: PrismaClient;
  now: () => Date;
  downloadsDir: string;
  databaseUrl: string;
  setNow(date: Date): void;
  resetData(): Promise<void>;
  dispose(): Promise<void>;
}

function readShippedMigrationScripts(): string[] {
  const migrationsDir = path.join(resolveAppRoot(), "prisma", "migrations");
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"));
}

// Replays the SQL of every shipped migration, in order, on an empty file. This is
// the schema `prisma migrate deploy` builds (smoke-migrate covers that exact path)
// without spawning the CLI per test file.
async function migrateEmptyDatabase(databaseUrl: string): Promise<void> {
  const adapter = await new PrismaBetterSqlite3({ url: databaseUrl }).connect();
  try {
    for (const script of readShippedMigrationScripts()) {
      await adapter.executeScript(script);
    }
  } finally {
    await adapter.dispose();
  }
}

/**
 * A fresh, fully migrated SQLite database in a temp folder, with a controllable
 * clock and an empty Downloads folder. Pass the result to `createApp`.
 */
export async function createTestDatabase(options: { now?: Date } = {}): Promise<TestDatabase> {
  const workDir = mkdtempSync(path.join(os.tmpdir(), "fitpulse-test-"));
  const databaseUrl = `file:${path.join(workDir, "fitpulse.db").replaceAll("\\", "/")}`;
  const downloadsDir = path.join(workDir, "Downloads");
  mkdirSync(downloadsDir);

  await migrateEmptyDatabase(databaseUrl);
  const prisma = createPrismaClient(databaseUrl);

  let currentTime = options.now ?? DEFAULT_NOW;
  let disposed = false;

  return {
    prisma,
    now: () => new Date(currentTime),
    downloadsDir,
    databaseUrl,
    setNow(date) {
      currentTime = date;
    },
    async resetData() {
      await prisma.diagnosis.deleteMany();
      await prisma.company.deleteMany();
      await prisma.preference.deleteMany();
    },
    async dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      await prisma.$disconnect();
      rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}
