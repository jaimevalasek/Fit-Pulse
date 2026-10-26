import os from "node:os";
import path from "node:path";
import { createApp, resolveBackendPort } from "./app.ts";
import { createPrismaClient } from "./db/prismaClient.ts";
import { createSystemOpener } from "./files/systemOpener.ts";

// Loopback only (RULE-dm-16): other machines on the network must not reach the API.
const HOST = "127.0.0.1";
const FORCED_EXIT_AFTER_MS = 5000;

const port = resolveBackendPort();
const prisma = createPrismaClient();
const app = createApp({
  prisma,
  now: () => new Date(),
  downloadsDir: path.join(os.homedir(), "Downloads"),
  systemOpener: createSystemOpener(),
  backendPort: port,
});

const server = app.listen(port, HOST, () => {
  console.log(`[fitpulse] api listening on http://${HOST}:${port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(`[fitpulse] cannot listen on ${HOST}:${port}:`, error.message);
  process.exit(1);
});

let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[fitpulse] ${signal} received, shutting down`);

  // A keep-alive connection must not hold the process open.
  setTimeout(() => process.exit(1), FORCED_EXIT_AFTER_MS).unref();
  server.close(() => {
    prisma.$disconnect().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error("[fitpulse] failed to disconnect the database:", error);
        process.exit(1);
      },
    );
  });
  server.closeAllConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
