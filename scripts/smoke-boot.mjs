import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { APP_ROOT } from "./prepare-app.mjs";

// Proves AC-dm-44 on the real start path: `pnpm start` follows the ports it is
// given (PORT / BACKEND_PORT, the way the Play injects them), serves the app and
// the /api proxy on 127.0.0.1, and refuses connections on every other address of
// this computer. Throwaway database, nothing outside the temp folder is written.
// The helpers are exported for smoke-store-package.mjs; the steps only run when
// this file is executed directly.

const LOOPBACK = "127.0.0.1";
// What the app falls back to outside the Play; the smoke must prove the injected ports win.
const FALLBACK_PORTS = new Set([5173, 3301]);
const START_TIMEOUT_MS = 120_000;
const PORT_RELEASE_TIMEOUT_MS = 15_000;
const OUTPUT_TAIL_CHARS = 8_000;

function step(message) {
  console.log(`[smoke-boot] ${message}`);
}

function toFileUrl(filePath) {
  return `file:${filePath.replaceAll("\\", "/")}`;
}

/**
 * How to launch `pnpm <args>` without a shell where possible. A `.cmd` shim
 * cannot be spawned directly on Windows, so its JavaScript entry is used
 * instead; the shell is only the last resort (a single command string, so Node
 * has no argument list to warn about).
 */
function pnpmInvocation(args) {
  const fromEnv = process.env.npm_execpath;
  if (fromEnv && /^pnpm\.[cm]?js$/i.test(path.basename(fromEnv)) && existsSync(fromEnv)) {
    return { file: process.execPath, argv: [fromEnv, ...args], shell: false };
  }
  if (process.platform !== "win32") {
    return { file: "pnpm", argv: args, shell: false };
  }
  for (const dir of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const entry = path.join(dir, "node_modules", "pnpm", "bin", "pnpm.cjs");
    if (existsSync(entry)) {
      return { file: process.execPath, argv: [entry, ...args], shell: false };
    }
  }
  return { file: `pnpm ${args.join(" ")}`, argv: [], shell: true };
}

/** Runs a pnpm command to completion and returns its captured output. */
export function runPnpm(args, { cwd, env = {}, timeoutMs = 600_000 } = {}) {
  const { file, argv, shell } = pnpmInvocation(args);
  const result = spawnSync(file, argv, {
    cwd,
    env: { ...process.env, CHECKPOINT_DISABLE: "1", ...env },
    shell,
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: `${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`,
  };
}

/** Two distinct free loopback ports, none of them the app's fallbacks. */
export async function findFreePorts(count) {
  const holders = [];
  const ports = [];
  try {
    while (ports.length < count) {
      const server = net.createServer();
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, LOOPBACK, resolve);
      });
      holders.push(server);
      const { port } = server.address();
      if (!FALLBACK_PORTS.has(port)) {
        ports.push(port);
      }
    }
  } finally {
    await Promise.all(holders.map((server) => new Promise((resolve) => server.close(resolve))));
  }
  return ports;
}

/**
 * Starts `pnpm start` in `cwd` with the ports injected like the Play does.
 * Leave `DATABASE_URL` unset in `env` (value undefined) to use the app's own data folder.
 */
export function startApp({ cwd, ports, env = {} }) {
  const { file, argv, shell } = pnpmInvocation(["start"]);
  const child = spawn(file, argv, {
    cwd,
    env: {
      ...process.env,
      CHECKPOINT_DISABLE: "1",
      ...env,
      PORT: String(ports.frontend),
      BACKEND_PORT: String(ports.backend),
    },
    shell,
    // A POSIX process group lets stopApp signal the whole tree; Windows uses taskkill /T.
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  let tail = "";
  const collect = (chunk) => {
    tail = `${tail}${chunk}`.slice(-OUTPUT_TAIL_CHARS);
  };
  child.stdout.setEncoding("utf8").on("data", collect);
  child.stderr.setEncoding("utf8").on("data", collect);

  const app = { child, ports, exited: false, exitCode: null, output: () => tail };
  app.exit = new Promise((resolve) => {
    child.once("exit", (code, signal) => {
      app.exited = true;
      app.exitCode = code ?? signal;
      resolve();
    });
    child.once("error", (error) => {
      collect(`\n${error.message}`);
      app.exited = true;
      app.exitCode = "spawn-error";
      resolve();
    });
  });
  return app;
}

/** Stops the app and everything `pnpm start` spawned. Never throws, so it is safe in `finally`. */
export async function stopApp(app) {
  const { pid } = app.child;
  if (!app.exited && pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      signalGroup(pid, "SIGTERM");
    }
    await Promise.race([app.exit, delay(10_000)]);
    if (!app.exited && process.platform !== "win32") {
      signalGroup(pid, "SIGKILL");
      await Promise.race([app.exit, delay(5_000)]);
    }
  }
  app.child.stdout.destroy();
  app.child.stderr.destroy();
}

function signalGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch {
    // The group is already gone.
  }
}

export function httpGet(port, pathname, { timeoutMs = 5_000 } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: LOOPBACK, port, path: pathname, agent: false, timeout: timeoutMs }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () =>
        resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    request.on("timeout", () => request.destroy(new Error(`GET ${pathname} on port ${port} timed out`)));
    request.on("error", reject);
  });
}

/** "connected", or the error code of the failed connection (ECONNREFUSED when nothing listens). */
function probeTcp(host, port, timeoutMs = 3_000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      socket.destroy();
      resolve("connected");
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve("timeout");
    });
    socket.once("error", (error) => resolve(error.code ?? error.message));
  });
}

/** Polls `probe` until it returns something truthy; fails early when the app dies. */
export async function waitUntil(description, probe, { app, timeoutMs = START_TIMEOUT_MS, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (app?.exited) {
      throw new Error(`the app exited (${app.exitCode}) while waiting for ${description}\n${app.output()}`);
    }
    try {
      const value = await probe();
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }
  const reason = lastError ? `: ${lastError.message}` : "";
  throw new Error(`timed out after ${timeoutMs} ms waiting for ${description}${reason}\n${app?.output() ?? ""}`);
}

/** Backend health, the built UI and the /api proxy are all answering on loopback. */
export async function checkServing(app) {
  const { backend, frontend } = app.ports;

  await waitUntil(`GET /api/health on ${LOOPBACK}:${backend}`, async () => (await httpGet(backend, "/api/health")).status === 200, { app });
  const health = await httpGet(backend, "/api/health");
  assert.ok(health.body.trim().length > 0, "backend /api/health answered with an empty body");

  const page = await waitUntil(`GET / on ${LOOPBACK}:${frontend}`, async () => {
    const response = await httpGet(frontend, "/");
    return response.status === 200 ? response : null;
  }, { app });
  assert.match(page.headers["content-type"] ?? "", /text\/html/, "the frontend root is not HTML");
  assert.ok(page.body.includes('id="root"'), "the frontend root has no React mount point");
  assert.ok(page.body.includes("FitPulse"), "the frontend root does not carry the FitPulse name");
  assert.ok(!page.body.includes("V-Stage"), "the frontend root still carries the V-Stage name");

  const proxied = await httpGet(frontend, "/api/health");
  assert.equal(proxied.status, 200, "GET /api/health through the frontend proxy did not answer 200");
  assert.ok(proxied.body.trim().length > 0, "the proxied /api/health answered with an empty body");
}

/** RULE-dm-16: no address of this computer other than loopback accepts a connection. */
async function assertNotReachableFromNetwork(ports) {
  const addresses = [
    ...new Set(
      Object.values(os.networkInterfaces())
        .flat()
        .filter((entry) => entry && (entry.family === "IPv4" || entry.family === 4) && !entry.internal)
        .map((entry) => entry.address),
    ),
  ];
  if (addresses.length === 0) {
    step("WARNING: no external IPv4 interface on this computer; the network exposure check could not run");
    return 0;
  }
  for (const address of addresses) {
    for (const [name, port] of Object.entries(ports)) {
      const outcome = await probeTcp(address, port);
      // Windows may drop the SYN instead of refusing it: both mean "not reachable from the network".
      assert.ok(
        outcome === "ECONNREFUSED" || outcome === "timeout",
        `${name} port ${port} answered on ${address} (${outcome}); it must listen on ${LOOPBACK} only`,
      );
    }
  }
  return addresses.length;
}

/** After stopApp: nothing the app started is still holding its ports. */
export async function assertPortsClosed(ports) {
  for (const port of Object.values(ports)) {
    await waitUntil(`port ${port} to be released`, async () => (await probeTcp(LOOPBACK, port, 1_000)) === "ECONNREFUSED", {
      timeoutMs: PORT_RELEASE_TIMEOUT_MS,
      intervalMs: 250,
    });
  }
}

async function runSmoke(workDir) {
  assert.ok(existsSync(path.join(APP_ROOT, "dist", "index.html")), "dist/ is missing; run `pnpm build` first");

  const [frontend, backend] = await findFreePorts(2);
  const databaseFile = path.join(workDir, "fitpulse.db");
  step(`1/4 starting \`pnpm start\` with PORT=${frontend} BACKEND_PORT=${backend} and a throwaway database`);
  const app = startApp({ cwd: APP_ROOT, ports: { frontend, backend }, env: { DATABASE_URL: toFileUrl(databaseFile) } });

  try {
    await checkServing(app);
    step("2/4 backend, UI and /api proxy answer on the injected ports");
    assert.ok(existsSync(databaseFile), "the app did not create its database at DATABASE_URL");

    const interfaces = await assertNotReachableFromNetwork(app.ports);
    step(`3/4 both ports refuse connections on ${interfaces} external IPv4 address(es)`);
  } finally {
    await stopApp(app);
  }
  await assertPortsClosed(app.ports);
  step("4/4 app stopped and both ports released");
}

async function main() {
  const workDir = mkdtempSync(path.join(os.tmpdir(), "fitpulse-smoke-boot-"));
  try {
    await runSmoke(workDir);
    console.log("[smoke-boot] PASS");
  } catch (error) {
    console.error(`[smoke-boot] FAIL: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

// smoke-store-package.mjs imports the helpers above; only a direct `node scripts/smoke-boot.mjs` runs the steps.
const entryPoint = process.argv[1] ? realpathSync.native(path.resolve(process.argv[1])) : "";
if (entryPoint === realpathSync.native(fileURLToPath(import.meta.url))) {
  await main();
}
