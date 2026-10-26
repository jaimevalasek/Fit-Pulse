import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client.ts";
import { resolveDatabaseUrl } from "./databaseUrl.ts";

const BUSY_TIMEOUT_MS = 5000;

// busy_timeout and foreign_keys belong to the connection, so they are applied on
// every connect. journal_mode=WAL is stored in the database file itself.
const CONNECTION_PRAGMAS = `
  PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS};
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`;

class FitPulseSqliteAdapterFactory extends PrismaBetterSqlite3 {
  override async connect() {
    const adapter = await super.connect();
    await adapter.executeScript(CONNECTION_PRAGMAS);
    return adapter;
  }
}

export function createPrismaClient(databaseUrl: string = resolveDatabaseUrl()): PrismaClient {
  const adapter = new FitPulseSqliteAdapterFactory({ url: databaseUrl, timeout: BUSY_TIMEOUT_MS });
  return new PrismaClient({ adapter });
}
