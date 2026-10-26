import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STEP_FLAGS = ["--generate", "--migrate", "--build"];
const USAGE = `Usage: node scripts/prepare-app.mjs [${STEP_FLAGS.join("] [")}]`;

/** Resolves the JavaScript entry point of a bin shipped by a direct dependency. */
function resolvePackageBin(packageName, binName = packageName) {
  const packageJsonPath = path.join(APP_ROOT, "node_modules", packageName, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`${packageName} is not installed in ${APP_ROOT}; run pnpm install first`);
  }
  const { bin } = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const relativeEntry = typeof bin === "string" ? bin : bin?.[binName];
  if (!relativeEntry) {
    throw new Error(`${packageName} does not declare a "${binName}" bin`);
  }
  return path.join(path.dirname(packageJsonPath), relativeEntry);
}

/**
 * Runs a dependency's bin with the current Node binary, so it works the same on
 * Windows and POSIX without a shell. Telemetry and update checks stay off.
 */
export function runPackageBin(packageName, args, { env = {}, capture = false, binName } = {}) {
  const result = spawnSync(process.execPath, [resolvePackageBin(packageName, binName), ...args], {
    cwd: APP_ROOT,
    env: { ...process.env, CHECKPOINT_DISABLE: "1", ...env },
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function runStep(label, packageName, args) {
  console.log(`[prepare-app] ${label}`);
  const { status } = runPackageBin(packageName, args);
  if (status !== 0) {
    console.error(`[prepare-app] ${label} failed with exit code ${status}`);
    process.exit(status);
  }
}

function prepareApp(requestedFlags) {
  mkdirSync(path.join(APP_ROOT, "data"), { recursive: true });

  if (requestedFlags.has("--generate")) {
    runStep("prisma generate", "prisma", ["generate"]);
  }
  if (requestedFlags.has("--migrate")) {
    runStep("prisma migrate deploy", "prisma", ["migrate", "deploy"]);
  }
  if (requestedFlags.has("--build")) {
    if (existsSync(path.join(APP_ROOT, "src"))) {
      runStep("vite build", "vite", ["build"]);
    } else {
      console.log("[prepare-app] no src/ folder, skipping vite build");
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const unknownFlags = args.filter((arg) => !STEP_FLAGS.includes(arg));
  if (args.length === 0 || unknownFlags.length > 0) {
    if (unknownFlags.length > 0) {
      console.error(`[prepare-app] unknown argument: ${unknownFlags.join(" ")}`);
    }
    console.error(USAGE);
    process.exit(2);
  }

  try {
    prepareApp(new Set(args));
  } catch (error) {
    console.error(`[prepare-app] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

// Other scripts import the helpers above; only a direct `node scripts/prepare-app.mjs` runs the steps.
const entryPoint = process.argv[1] ? realpathSync.native(path.resolve(process.argv[1])) : "";
if (entryPoint === realpathSync.native(fileURLToPath(import.meta.url))) {
  main();
}
