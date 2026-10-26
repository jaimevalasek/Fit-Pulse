import { mkdirSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { request, type FullConfig } from "@playwright/test";

// Fixed test ports, away from the Vite (5173) and backend (3301) fallbacks of a local `pnpm dev`.
export const E2E_PORT = 5390;
export const E2E_BACKEND_PORT = 3390;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

const RUN_DIR_ENV = "FITPULSE_E2E_DIR";
const RUN_DIR_PREFIX = "fitpulse-e2e-";

export interface E2eWorkspace {
  /** Folder of this run: the database and the fake home live here. */
  root: string;
  databaseUrl: string;
  /** HOME / USERPROFILE of the app under test, so PDFs and backups land in a temp Downloads. */
  homeDir: string;
  downloadsDir: string;
}

function describeWorkspace(root: string): E2eWorkspace {
  const homeDir = path.join(root, "home");
  return {
    root,
    databaseUrl: `file:${path.join(root, "fitpulse-e2e.db").replaceAll("\\", "/")}`,
    homeDir,
    downloadsDir: path.join(homeDir, "Downloads"),
  };
}

/**
 * The e2e workspace of this run. Playwright starts the `webServer` before `globalSetup`, so the
 * old database has to be gone before the config hands the env to `pnpm dev`: the first load of the
 * config (main process) deletes the previous runs and creates an empty folder; `pnpm dev` then
 * migrates the new database with `prisma migrate deploy`, the same path the Play uses. Workers load
 * the config again and find the folder through the inherited env variable.
 */
export function prepareE2eWorkspace(): E2eWorkspace {
  const existing = process.env[RUN_DIR_ENV];
  if (existing) return describeWorkspace(existing);

  const parent = os.tmpdir();
  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(RUN_DIR_PREFIX)) continue;
    try {
      rmSync(path.join(parent, entry.name), { recursive: true, force: true, maxRetries: 2 });
    } catch {
      // A folder still held by a server that did not stop is left for the next run
    }
  }
  const root = path.join(parent, `${RUN_DIR_PREFIX}${Date.now()}-${process.pid}`);
  const workspace = describeWorkspace(root);
  mkdirSync(workspace.downloadsDir, { recursive: true });
  process.env[RUN_DIR_ENV] = root;
  return workspace;
}

export function readE2eWorkspace(): E2eWorkspace {
  const root = process.env[RUN_DIR_ENV];
  if (!root) throw new Error(`${RUN_DIR_ENV} is not set; run the specs through playwright.config.ts`);
  return describeWorkspace(root);
}

// Runs once the webServer answers: the migrated e2e database must be empty, so every spec
// (and the fresh-db project first) starts from a new installation.
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const api = await request.newContext({ baseURL: E2E_BASE_URL });
  try {
    const health = await api.get("/api/health");
    if (!health.ok()) throw new Error(`GET /api/health answered ${health.status()}`);
    for (const archived of ["false", "true"]) {
      const response = await api.get(`/api/companies?archived=${archived}`);
      if (!response.ok()) {
        throw new Error(`GET /api/companies answered ${response.status()}: the e2e database is not migrated`);
      }
      const companies = (await response.json()) as unknown[];
      if (companies.length > 0) {
        throw new Error(`The e2e database at ${readE2eWorkspace().databaseUrl} is not empty`);
      }
    }
  } finally {
    await api.dispose();
  }
}
