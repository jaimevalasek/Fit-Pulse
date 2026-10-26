import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { APP_ROOT } from "./prepare-app.mjs";
import { assertPortsClosed, checkServing, findFreePorts, runPnpm, startApp, stopApp } from "./smoke-boot.mjs";

// Proves AC-dm-45 and AC-ra-54 on what the store really ships: package the app the
// way `aioson system:package` does, check the package carries what release 0.2.0
// adds (schema version 2, the four migrations, the questionnaire runtime files),
// install release 0.1.0 into an empty folder (no lockfile), put owner data in,
// lay the current package over the installed copy, run `pnpm install` like the
// Play does, boot it, and check the data is untouched. The owner's data file must
// never be part of the package.
// The 0.1.0 archive is not kept, so it is rebuilt from the current package by
// taking away what 0.2.0 added (the migrations and the questionnaire runtime files)
// and stamping the 0.1.0 versions; the database the owner keeps is a real 0.1.0 one.
// Everything happens in a throwaway folder; the project folder only receives the
// package descriptor that the CLI writes, and it is removed again.

const PACKAGES_ROOT = path.join(APP_ROOT, ".aioson", "system-packages");
const LOCKFILES = new Set(["pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb"]);
// Files the app cannot install or boot without; a missing one means the packager dropped it.
const REQUIRED_FILES = [
  "system.json",
  "manifest.json",
  "package.json",
  "pnpm-workspace.yaml",
  "prisma.config.ts",
  "prisma/schema.prisma",
  "prisma/migrations/migration_lock.toml",
  "scripts/prepare-app.mjs",
  "server/main.ts",
  "server/questionnaire/questionnaireClient.js",
  "server/questionnaire/questionnaireStyles.css",
  "vite.config.ts",
  "index.html",
  "src/main.tsx",
];
// Folders of the project whose every file (tests aside) belongs in the package.
const SOURCE_FOLDERS = ["src", "server", "shared", "prisma", "scripts"];
const FORBIDDEN_FILES = [
  [(file) => file.startsWith("data/"), "the data folder"],
  [(file) => /\.db(-journal|-wal|-shm)?$/i.test(file), "a database file"],
  [(file) => LOCKFILES.has(path.posix.basename(file)), "a lockfile"],
  [
    (file) => /(^|\/)(__tests__|__mocks__|__snapshots__)\//.test(file) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(file),
    "a test file",
  ],
  [(file) => path.posix.basename(file) === "aioson-models.json", "local model credentials"],
  [(file) => /(^|\/)\.env(\..+)?$/.test(file) && !file.endsWith(".env.example"), "an env file"],
  [(file) => /(^|\/)(node_modules|dist|test-results|playwright-report)\//.test(file) || file.startsWith("server/generated/"), "install or build output"],
];
// What release 0.1.0 shipped, and what release 0.2.0 added on top of it.
const FIRST_RELEASE = { version: "0.1.0", schemaVersion: 1, requiresMigration: false };
const CURRENT_RELEASE = { schemaVersion: 2, requiresMigration: true };
const V1_MIGRATIONS = ["20261023000000_init"];
const V2_MIGRATIONS = [
  "20261026000000_generated_files",
  "20261026000100_action_progress",
  "20261026000200_diary_entries",
  "20261026000300_questionnaire_sends",
];
const V2_RUNTIME_FILES = ["server/questionnaire/questionnaireClient.js", "server/questionnaire/questionnaireStyles.css"];
// Table -> primary key column. Rows are compared ordered by key.
const DATA_TABLES = { companies: "id", diagnoses: "id", preferences: "key" };
const V2_TABLES = ["generated_files", "action_progress", "diary_entries", "questionnaire_sends"];
// The app must come from the package alone: nothing inherited may point it elsewhere.
const CLEAN_ENV = { DATABASE_URL: undefined, PORT: undefined, BACKEND_PORT: undefined, NODE_ENV: undefined };

function step(message) {
  console.log(`[smoke-store-package] ${message}`);
}

function tail(text, chars = 3_000) {
  return text.length > chars ? `...${text.slice(-chars)}` : text;
}

/** `aioson` without a shell where possible; on Windows the bin shim is a .cmd that cannot be spawned directly. */
function aiosonInvocation(args) {
  if (process.platform !== "win32") {
    return { file: "aioson", argv: args, shell: false };
  }
  for (const dir of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
    const entry = path.join(dir, "node_modules", "@jaimevalasek", "aioson", "bin", "aioson.js");
    if (existsSync(entry)) {
      return { file: process.execPath, argv: [entry, ...args], shell: false };
    }
  }
  return { file: `aioson ${args.join(" ")}`, argv: [], shell: true };
}

function packageProject() {
  const system = JSON.parse(readFileSync(path.join(APP_ROOT, "system.json"), "utf8"));
  const slugDir = path.join(PACKAGES_ROOT, system.slug);
  const descriptorFile = path.join(slugDir, `${system.slug}-${system.version}.json`);
  const cleanup = {
    slugDir: existsSync(slugDir) ? null : slugDir,
    packagesRoot: existsSync(PACKAGES_ROOT) ? null : PACKAGES_ROOT,
    descriptorFile: existsSync(descriptorFile) ? null : descriptorFile,
  };
  const packageJsonFile = path.join(APP_ROOT, "package.json");
  const packageJsonBefore = readFileSync(packageJsonFile, "utf8");
  const startedAt = Date.now();

  const { file, argv, shell } = aiosonInvocation(["system:package", "."]);
  const result = spawnSync(file, argv, { cwd: APP_ROOT, shell, encoding: "utf8", windowsHide: true, timeout: 180_000 });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();

  const packageJsonAfter = readFileSync(packageJsonFile, "utf8");
  if (packageJsonAfter !== packageJsonBefore) {
    // The CLI aligns package.json to system.json; leave the working tree as it was and tell the owner.
    writeFileSync(packageJsonFile, packageJsonBefore);
    assert.fail("system:package rewrote package.json: its version differs from system.json; keep both equal");
  }
  assert.equal(result.status, 0, `aioson system:package exited with ${result.status}\n${tail(output)}`);
  assert.ok(existsSync(descriptorFile), `aioson system:package left no descriptor at ${descriptorFile}\n${tail(output)}`);
  assert.ok(statSync(descriptorFile).mtimeMs >= startedAt - 2_000, "the package descriptor is stale: system:package did not write it");

  const { manifest, files } = JSON.parse(readFileSync(descriptorFile, "utf8"));
  return { manifest, files, cleanup };
}

function removePackageDescriptor({ descriptorFile, slugDir, packagesRoot }) {
  // Only what this run created: a descriptor or folder that already existed belongs to the owner.
  for (const target of [descriptorFile, slugDir, packagesRoot]) {
    if (target) {
      rmSync(target, { recursive: true, force: true });
    }
  }
}

/** Every file of a source folder of the project that the package is expected to carry. */
function projectSourceFiles(folder) {
  const found = [];
  for (const entry of readdirSync(path.join(APP_ROOT, folder), { withFileTypes: true })) {
    const relative = path.posix.join(folder, entry.name);
    if (entry.isDirectory()) {
      found.push(...projectSourceFiles(relative));
    } else if (!FORBIDDEN_FILES.some(([matches]) => matches(relative))) {
      found.push(relative);
    }
  }
  return found;
}

function assertPackageContents(files) {
  const names = Object.keys(files);
  for (const name of names) {
    for (const [matches, label] of FORBIDDEN_FILES) {
      assert.ok(!matches(name), `the package ships ${label}: ${name}`);
    }
  }
  // The packager skips folders by their name wherever they are (a `reports` folder included), and the app cannot build without them.
  const dropped = SOURCE_FOLDERS.flatMap(projectSourceFiles).filter((file) => !names.includes(file));
  assert.deepEqual(dropped, [], `the package dropped ${dropped.length} project file(s) the app needs to build`);
  for (const required of REQUIRED_FILES) {
    assert.ok(names.includes(required), `the package is missing ${required}`);
  }
  for (const migration of [...V1_MIGRATIONS, ...V2_MIGRATIONS]) {
    assert.ok(names.includes(`prisma/migrations/${migration}/migration.sql`), `the package is missing the migration ${migration}`);
  }

  const { version, compatibility } = JSON.parse(files["manifest.json"]);
  assert.notEqual(version, FIRST_RELEASE.version, "the package still carries the version of release 0.1.0");
  assert.equal(compatibility.schema_version, CURRENT_RELEASE.schemaVersion, "manifest.json must declare compatibility.schema_version 2");
  assert.equal(compatibility.requires_migration, CURRENT_RELEASE.requiresMigration, "manifest.json must declare requires_migration");
  for (const name of ["system.json", "package.json"]) {
    assert.equal(JSON.parse(files[name]).version, version, `${name} and manifest.json carry different versions`);
  }
}

function withVersion(content, change) {
  const json = JSON.parse(content);
  change(json);
  return `${JSON.stringify(json, null, 2)}\n`;
}

/** Release 0.1.0 as the store shipped it: the current package without what 0.2.0 added, stamped with the 0.1.0 versions. */
function rebuildFirstRelease(files) {
  const addedMigrations = V2_MIGRATIONS.map((migration) => `prisma/migrations/${migration}/`);
  const firstRelease = {};
  for (const [name, content] of Object.entries(files)) {
    const addedInSecondRelease = V2_RUNTIME_FILES.includes(name) || addedMigrations.some((folder) => name.startsWith(folder));
    if (!addedInSecondRelease) {
      firstRelease[name] = content;
    }
  }
  const stamp = (json) => {
    json.version = FIRST_RELEASE.version;
  };
  firstRelease["system.json"] = withVersion(files["system.json"], stamp);
  firstRelease["package.json"] = withVersion(files["package.json"], stamp);
  firstRelease["manifest.json"] = withVersion(files["manifest.json"], (json) => {
    stamp(json);
    json.compatibility.schema_version = FIRST_RELEASE.schemaVersion;
    json.compatibility.requires_migration = FIRST_RELEASE.requiresMigration;
  });
  return firstRelease;
}

function writePackageFiles(files, appDir) {
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.resolve(appDir, relativePath);
    assert.ok(target.startsWith(`${appDir}${path.sep}`), `package entry escapes the app folder: ${relativePath}`);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

function installDependencies(appDir, label) {
  const result = runPnpm(["install", "--no-frozen-lockfile", "--prefer-offline"], { cwd: appDir, env: CLEAN_ENV });
  assert.equal(result.status, 0, `pnpm install (${label}) exited with ${result.status}\n${tail(`${result.stdout}\n${result.stderr}`)}`);
}

function assertSqliteBinaryLoads(appDir) {
  // A short-lived process, so the temp folder holds no loaded binary when it is removed.
  const script = "const D=require('better-sqlite3');if(new D(':memory:').prepare('select 1 as v').get().v!==1)process.exit(3)";
  const result = spawnSync(process.execPath, ["-e", script], { cwd: appDir, encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, `better-sqlite3 did not load from the installed package\n${tail(`${result.stdout}\n${result.stderr}`)}`);
}

function withDatabase(databaseFile, action) {
  const database = new Database(databaseFile);
  database.pragma("foreign_keys = ON");
  try {
    return action(database);
  } finally {
    database.close();
  }
}

function snapshot(database) {
  return Object.fromEntries(
    Object.entries(DATA_TABLES).map(([table, keyColumn]) => [
      table,
      database.prepare(`SELECT * FROM "${table}" ORDER BY "${keyColumn}"`).all(),
    ]),
  );
}

function tableNames(database) {
  return database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
}

function appliedMigrations(database) {
  return database
    .prepare("SELECT COUNT(*) AS total FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")
    .get().total;
}

function shippedMigrations(appDir) {
  return readdirSync(path.join(appDir, "prisma", "migrations"), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
}

function seedOwnerData(database) {
  const now = new Date().toISOString();
  const companyId = randomUUID();
  database
    .prepare(
      `INSERT INTO companies (id, name, segment, sales_channel, annual_revenue_range, cnpj, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(companyId, "Academia Smoke", "gym", "in_person", "up_to_1m", "11222333000181", null, now, now);

  const insertDiagnosis = database.prepare(
    `INSERT INTO diagnoses (id, company_id, status, archived_at, answers, calculator, current_block,
                            rules_version, result, stage, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertDiagnosis.run(
    randomUUID(), companyId, "draft", null,
    JSON.stringify({ "item-1": 2, "item-2": null }), JSON.stringify({ monthlyRevenueCents: 1500000 }), 3,
    null, null, null, null, now, now,
  );
  insertDiagnosis.run(
    randomUUID(), companyId, "completed", null,
    JSON.stringify({ "item-1": 3 }), JSON.stringify({ monthlyRevenueCents: 1200000 }), 8,
    1, JSON.stringify({ stage: 2, actions: [1, 2, 3] }), 2, now, now, now,
  );

  const insertPreference = database.prepare("INSERT INTO preferences (key, value) VALUES (?, ?)");
  insertPreference.run("usageMode", "owner");
  insertPreference.run("theme", "light");
}

function assertInstalled(appDir) {
  assertSqliteBinaryLoads(appDir);
  assert.ok(existsSync(path.join(appDir, "server", "generated", "prisma")), "prisma generate did not run on install");

  const databaseFile = path.join(appDir, "data", "fitpulse.db");
  assert.ok(existsSync(databaseFile), "the install did not create data/fitpulse.db");
  withDatabase(databaseFile, (database) => {
    const tables = tableNames(database);
    for (const table of Object.keys(DATA_TABLES)) {
      assert.ok(tables.includes(table), `table ${table} was not created by the install`);
    }
    assert.equal(appliedMigrations(database), shippedMigrations(appDir), "not every shipped migration was applied on install");
  });

  assert.ok(existsSync(path.join(appDir, "dist", "index.html")), "the install did not build dist/");
  const assets = readdirSync(path.join(appDir, "dist", "assets"));
  for (const family of ["inter", "jetbrains-mono"]) {
    assert.ok(
      assets.some((asset) => asset.startsWith(`${family}-`) && asset.endsWith(".woff2")),
      `dist/ has no ${family} font file, so the app would reach for the network`,
    );
  }
}

/** What release 0.1.0 left on disk: none of what 0.2.0 adds, so the update has to bring it. */
function assertFirstReleaseInstalled(appDir) {
  for (const name of V2_RUNTIME_FILES) {
    assert.ok(!existsSync(path.join(appDir, name)), `release 0.1.0 must not carry ${name}`);
  }
  const { version, compatibility } = JSON.parse(readFileSync(path.join(appDir, "manifest.json"), "utf8"));
  assert.equal(version, FIRST_RELEASE.version);
  assert.equal(compatibility.schema_version, FIRST_RELEASE.schemaVersion);
  withDatabase(path.join(appDir, "data", "fitpulse.db"), (database) => {
    const tables = tableNames(database);
    for (const table of V2_TABLES) {
      assert.ok(!tables.includes(table), `table ${table} must not exist before the update`);
    }
  });
}

/** The update kept the owner's rows, ran the migrations of the new release and delivered its files. */
function assertUpdated(appDir, files, before) {
  for (const name of V2_RUNTIME_FILES) {
    const installed = path.join(appDir, name);
    assert.ok(existsSync(installed), `the update did not bring ${name}`);
    assert.ok(readFileSync(installed, "utf8") === files[name], `${name} differs from the one in the package`);
  }
  const { version, compatibility } = JSON.parse(readFileSync(path.join(appDir, "manifest.json"), "utf8"));
  assert.equal(version, JSON.parse(files["manifest.json"]).version, "the update left the old manifest version");
  assert.equal(compatibility.schema_version, CURRENT_RELEASE.schemaVersion, "compatibility.schema_version is not 2 after the update");
  assert.equal(compatibility.requires_migration, CURRENT_RELEASE.requiresMigration);

  withDatabase(path.join(appDir, "data", "fitpulse.db"), (database) => {
    assert.equal(appliedMigrations(database), before.applied + V2_MIGRATIONS.length, "the update applied the wrong number of migrations");
    assert.equal(appliedMigrations(database), shippedMigrations(appDir), "not every shipped migration was applied by the update");
    const tables = tableNames(database);
    for (const table of V2_TABLES) {
      assert.ok(tables.includes(table), `table ${table} was not created by the update`);
      assert.equal(database.prepare(`SELECT COUNT(*) AS total FROM "${table}"`).get().total, 0, `table ${table} must start empty`);
    }
    assert.deepEqual(database.pragma("foreign_key_check"), [], "the update left dangling foreign keys");
    assert.deepEqual(snapshot(database), before.rows, "companies, diagnoses, drafts or preferences changed by the update");
  });
}

async function bootAndCheck(appDir, label) {
  const [frontend, backend] = await findFreePorts(2);
  const app = startApp({ cwd: appDir, ports: { frontend, backend }, env: CLEAN_ENV });
  try {
    await checkServing(app);
    step(`${label}: backend, UI and /api proxy answer on PORT=${frontend} BACKEND_PORT=${backend}`);
    return app;
  } catch (error) {
    await stopApp(app);
    throw error;
  }
}

async function runSmoke(workDir) {
  step("1/8 packaging the project with `aioson system:package .`");
  const { manifest, files, cleanup } = packageProject();
  try {
    assertPackageContents(files);
    step(
      `2/8 ${manifest.name} ${manifest.version}: ${Object.keys(files).length} files, schema version ${CURRENT_RELEASE.schemaVersion} with its ` +
        `${V2_MIGRATIONS.length} new migrations and the questionnaire files; no data folder, database, lockfile, test or secret`,
    );

    const appDir = path.join(workDir, "app");
    mkdirSync(appDir);
    writePackageFiles(rebuildFirstRelease(files), appDir);

    step(`3/8 installing release ${FIRST_RELEASE.version} into an empty folder (pnpm install, no lockfile)`);
    installDependencies(appDir, "first install");
    assertInstalled(appDir);
    assertFirstReleaseInstalled(appDir);
    step("4/8 install ran prisma generate, created the 0.1.0 database (no 0.2.0 table) and built dist/ with the Inter and JetBrains Mono fonts");

    const databaseFile = path.join(appDir, "data", "fitpulse.db");
    withDatabase(databaseFile, seedOwnerData);
    const before = withDatabase(databaseFile, (database) => ({ rows: snapshot(database), applied: appliedMigrations(database) }));
    assert.ok(before.rows.companies.length > 0 && before.rows.diagnoses.length > 0, "the owner data was not written");
    step("5/8 owner data written (companies, drafts, completed diagnoses, preferences)");

    step("6/8 update: laying the current package over the installed copy and running pnpm install");
    writePackageFiles(files, appDir);
    installDependencies(appDir, "update");
    const updatedApp = await bootAndCheck(appDir, "7/8 updated app");
    await stopApp(updatedApp);
    await assertPortsClosed(updatedApp.ports);

    assertUpdated(appDir, files, before);
    step("8/8 companies, diagnoses, drafts and preferences identical, 4 new tables, questionnaire files and schema version 2 in place");
  } finally {
    removePackageDescriptor(cleanup);
  }
}

async function main() {
  const workDir = mkdtempSync(path.join(os.tmpdir(), "fitpulse-smoke-package-"));
  try {
    await runSmoke(workDir);
    console.log("[smoke-store-package] PASS");
  } catch (error) {
    console.error(`[smoke-store-package] FAIL: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    rmSync(workDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}

await main();
