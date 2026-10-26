import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { APP_ROOT, runPackageBin } from "./prepare-app.mjs";

// Proves the update path of AC-dm-45 and AC-ra-54: a database that release 0.1.0
// filled keeps every row when this release's migrations run over it, re-running
// the deploy is a no-op, and a later release that rebuilds the companies table
// still keeps the rows of the new tables too. Everything happens in a throwaway folder.

const MIGRATIONS_DIR = path.join(APP_ROOT, "prisma", "migrations");
const SCHEMA_FILE = path.join(APP_ROOT, "prisma", "schema.prisma");
// What release 0.1.0 shipped, and what release 0.2.0 added on top of it.
const V1_MIGRATIONS = ["20261023000000_init"];
const V2_MIGRATIONS = [
  "20261026000000_generated_files",
  "20261026000100_action_progress",
  "20261026000200_diary_entries",
  "20261026000300_questionnaire_sends",
];
// Table -> primary key column. Column positions change when a table is rebuilt, so rows are ordered by key.
const V1_TABLES = { companies: "id", diagnoses: "id", preferences: "key" };
const V2_TABLES = { generated_files: "id", action_progress: "id", diary_entries: "id", questionnaire_sends: "id" };
const ALL_TABLES = { ...V1_TABLES, ...V2_TABLES };
// Tables whose rows belong to a company (and so go with it).
const COMPANY_OWNED_TABLES = ["diagnoses", "diary_entries", "questionnaire_sends", "generated_files"];
// Sorts after every real migration, whatever timestamps later releases use.
const SYNTHETIC_MIGRATION = "99991231235959_smoke_synthetic";
const SYNTHETIC_COLUMN = "smoke_note";
const SYNTHETIC_DEFAULT = "none";

function step(message) {
  console.log(`[smoke-migrate] ${message}`);
}

function toFileUrl(filePath) {
  return `file:${filePath.replaceAll("\\", "/")}`;
}

function describeFailure(label, { status, stdout, stderr }) {
  return `${label} exited with ${status}\n${stdout}\n${stderr}`.trim();
}

function openDatabase(databaseFile) {
  const database = new Database(databaseFile);
  database.pragma("foreign_keys = ON");
  return database;
}

function withDatabase(databaseFile, action) {
  const database = openDatabase(databaseFile);
  try {
    return action(database);
  } finally {
    database.close();
  }
}

function snapshot(database, tables) {
  return Object.fromEntries(
    Object.entries(tables).map(([table, keyColumn]) => [
      table,
      database.prepare(`SELECT * FROM "${table}" ORDER BY "${keyColumn}"`).all(),
    ]),
  );
}

function tableNames(database) {
  return database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row.name);
}

function tableShapes(database, tables) {
  return Object.fromEntries(Object.keys(tables).map((table) => [table, database.prepare(`PRAGMA table_info("${table}")`).all()]));
}

function indexNames(database) {
  return database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);
}

function appliedMigrationCount(database) {
  return database
    .prepare("SELECT COUNT(*) AS total FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")
    .get().total;
}

function countRows(database, sql, ...params) {
  return database.prepare(sql).get(...params).total;
}

function withoutSyntheticColumn(rows) {
  return rows.map(({ [SYNTHETIC_COLUMN]: _ignored, ...rest }) => rest);
}

function runPrepareMigrate(databaseUrl) {
  const result = spawnSync(process.execPath, [path.join(APP_ROOT, "scripts", "prepare-app.mjs"), "--migrate"], {
    cwd: APP_ROOT,
    env: { ...process.env, DATABASE_URL: databaseUrl, CHECKPOINT_DISABLE: "1" },
    encoding: "utf8",
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** Owner data as release 0.1.0 holds it: companies, drafts, completed diagnoses and preferences. */
function seedOwnerData(database) {
  const now = new Date().toISOString();
  const ids = {
    activeCompanyId: randomUUID(),
    archivedCompanyId: randomUUID(),
    activeDiagnosisId: randomUUID(),
    archivedDiagnosisId: randomUUID(),
  };

  const insertCompany = database.prepare(
    `INSERT INTO companies (id, name, segment, sales_channel, annual_revenue_range, cnpj, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertCompany.run(ids.activeCompanyId, "Academia Smoke", "gym", "in_person", "up_to_1m", "11222333000181", null, now, now);
  insertCompany.run(ids.archivedCompanyId, "Estudio Arquivado", "studio", "online", null, null, now, now, now);

  const insertDiagnosis = database.prepare(
    `INSERT INTO diagnoses (id, company_id, status, archived_at, answers, calculator, current_block,
                            rules_version, result, stage, completed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertDiagnosis.run(
    randomUUID(), ids.activeCompanyId, "draft", null,
    JSON.stringify({ "item-1": 2, "item-2": null }), JSON.stringify({ monthlyRevenueCents: 1500000 }), 3,
    null, null, null, null, now, now,
  );
  insertDiagnosis.run(
    ids.activeDiagnosisId, ids.activeCompanyId, "completed", null,
    JSON.stringify({ "item-1": 3 }), JSON.stringify({ monthlyRevenueCents: 1200000 }), 8,
    1, JSON.stringify({ stage: 2, actions: [1, 2, 3] }), 2, now, now, now,
  );
  insertDiagnosis.run(
    ids.archivedDiagnosisId, ids.archivedCompanyId, "completed", now,
    JSON.stringify({ "item-1": 1 }), JSON.stringify({}), 8,
    1, JSON.stringify({ stage: 1 }), 1, now, now, now,
  );

  const insertPreference = database.prepare("INSERT INTO preferences (key, value) VALUES (?, ?)");
  insertPreference.run("usageMode", "owner");
  insertPreference.run("theme", "light");

  return ids;
}

/** What the owner records with release 0.2.0, for both companies, so a cascade has something to remove and something to spare. */
function seedFollowUpData(database, ids) {
  const now = new Date().toISOString();

  const insertAction = database.prepare(
    `INSERT INTO action_progress (id, diagnosis_id, action_key, status, due_date, owner_role, note, inherited_from_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  // The active plan repeats an action of the archived company's plan, so deleting that plan must only clear the link.
  insertAction.run(randomUUID(), ids.activeDiagnosisId, "action-1", "doing", "2026-12-01", "owner", "Ligar para os alunos", ids.archivedDiagnosisId, now, now);
  insertAction.run(randomUUID(), ids.activeDiagnosisId, "action-2", "todo", null, null, null, null, now, now);
  insertAction.run(randomUUID(), ids.archivedDiagnosisId, "action-1", "done", null, null, null, null, now, now);

  const insertDiary = database.prepare(
    `INSERT INTO diary_entries (id, company_id, month, new_customers, spend_parts, spend_total_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  insertDiary.run(randomUUID(), ids.activeCompanyId, "2026-09", 12, JSON.stringify({ ads: 150000 }), null, now, now);
  insertDiary.run(randomUUID(), ids.activeCompanyId, "2026-10", 9, null, 99999999, now, now);
  insertDiary.run(randomUUID(), ids.archivedCompanyId, "2026-10", 3, null, 50000, now, now);

  const insertSend = database.prepare(
    `INSERT INTO questionnaire_sends (id, company_id, file_name, sent_at, answered_at, client_saved_at, draft_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  insertSend.run(randomUUID(), ids.activeCompanyId, "questionario-academia.html", now, now, now, randomUUID());
  insertSend.run(randomUUID(), ids.activeCompanyId, "questionario-pendente.html", now, null, null, null);
  insertSend.run(randomUUID(), ids.archivedCompanyId, "questionario-arquivado.html", now, null, null, null);

  const insertFile = database.prepare("INSERT INTO generated_files (id, company_id, kind, file_name, directory, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  insertFile.run(randomUUID(), ids.activeCompanyId, "report", "relatorio.pdf", "C:/Downloads", now);
  insertFile.run(randomUUID(), ids.archivedCompanyId, "report", "relatorio-arquivado.pdf", "C:/Downloads", now);
}

function writePrismaConfig(workDir, migrationsPath, databaseUrl) {
  const configFile = path.join(workDir, `prisma.config.${path.basename(migrationsPath)}.mjs`);
  const config = {
    schema: SCHEMA_FILE,
    migrations: { path: migrationsPath },
    datasource: { url: databaseUrl },
  };
  writeFileSync(configFile, `export default ${JSON.stringify(config, null, 2)};\n`);
  return configFile;
}

/** A migrations folder holding only what release 0.1.0 shipped, so the first deploy builds a real 0.1.0 database. */
function prepareFirstRelease(workDir, databaseUrl) {
  const migrationsCopy = path.join(workDir, "migrations-v1");
  mkdirSync(migrationsCopy);
  cpSync(path.join(MIGRATIONS_DIR, "migration_lock.toml"), path.join(migrationsCopy, "migration_lock.toml"));
  for (const name of V1_MIGRATIONS) {
    cpSync(path.join(MIGRATIONS_DIR, name), path.join(migrationsCopy, name), { recursive: true });
  }
  return writePrismaConfig(workDir, migrationsCopy, databaseUrl);
}

/** Builds the SQL Prisma itself would emit for a release that adds a required column to companies. */
function generateSyntheticMigrationSql(workDir) {
  const schemaText = readFileSync(SCHEMA_FILE, "utf8");
  const modifiedSchemaText = schemaText.replace(
    /^model Company \{/m,
    `model Company {\n  smokeNote String @default("${SYNTHETIC_DEFAULT}") @map("${SYNTHETIC_COLUMN}")`,
  );
  assert.notEqual(modifiedSchemaText, schemaText, "schema.prisma has no `model Company {` to extend");

  const modifiedSchemaFile = path.join(workDir, "modified.prisma");
  writeFileSync(modifiedSchemaFile, modifiedSchemaText);

  const result = runPackageBin(
    "prisma",
    ["migrate", "diff", "--from-schema", SCHEMA_FILE, "--to-schema", modifiedSchemaFile, "--script"],
    { capture: true },
  );
  assert.equal(result.status, 0, describeFailure("prisma migrate diff", result));
  // The risky update path rebuilds the parent table that diagnoses cascade from.
  assert.match(result.stdout, /RedefineTables/, "synthetic migration must rebuild the companies table");
  assert.match(result.stdout, /DROP TABLE "companies"/, "synthetic migration must drop and recreate companies");
  return result.stdout;
}

function prepareSyntheticRelease(workDir, databaseUrl) {
  const migrationsCopy = path.join(workDir, "migrations");
  cpSync(MIGRATIONS_DIR, migrationsCopy, { recursive: true });

  const syntheticDir = path.join(migrationsCopy, SYNTHETIC_MIGRATION);
  mkdirSync(syntheticDir);
  writeFileSync(path.join(syntheticDir, "migration.sql"), generateSyntheticMigrationSql(workDir));
  return writePrismaConfig(workDir, migrationsCopy, databaseUrl);
}

function deployMigrations(label, configFile) {
  const result = runPackageBin("prisma", ["migrate", "deploy", "--config", configFile], { capture: true });
  assert.equal(result.status, 0, describeFailure(`prisma migrate deploy (${label})`, result));
  return result.stdout;
}

function assertDataSurvivedRebuild(before, after) {
  for (const table of Object.keys(before)) {
    assert.deepEqual(withoutSyntheticColumn(after[table]), before[table], `rows of ${table} changed by the update`);
  }
  assert.ok(after.companies.length > 0 && after.diagnoses.length > 0, "seed data is missing");
  for (const company of after.companies) {
    assert.equal(company[SYNTHETIC_COLUMN], SYNTHETIC_DEFAULT, "new column was not backfilled with its default");
  }
}

function assertCascadeStillWorks(databaseFile, ids) {
  withDatabase(databaseFile, (database) => {
    const foreignKeys = database.prepare('PRAGMA foreign_key_list("diagnoses")').all();
    assert.equal(foreignKeys.length, 1, "diagnoses lost its foreign key");
    assert.equal(foreignKeys[0].table, "companies");
    assert.equal(foreignKeys[0].on_delete, "CASCADE");

    const spared = {};
    for (const table of COMPANY_OWNED_TABLES) {
      spared[table] = countRows(database, `SELECT COUNT(*) AS total FROM "${table}" WHERE company_id <> ?`, ids.archivedCompanyId);
      assert.ok(countRows(database, `SELECT COUNT(*) AS total FROM "${table}" WHERE company_id = ?`, ids.archivedCompanyId) > 0, `no ${table} row to cascade`);
    }
    spared.action_progress = countRows(database, "SELECT COUNT(*) AS total FROM action_progress WHERE diagnosis_id <> ?", ids.archivedDiagnosisId);

    database.prepare("DELETE FROM companies WHERE id = ?").run(ids.archivedCompanyId);

    for (const table of COMPANY_OWNED_TABLES) {
      assert.equal(countRows(database, `SELECT COUNT(*) AS total FROM "${table}" WHERE company_id = ?`, ids.archivedCompanyId), 0, `deleting a company must cascade to its ${table}`);
      assert.equal(countRows(database, `SELECT COUNT(*) AS total FROM "${table}"`), spared[table], `cascade must not touch other companies' ${table}`);
    }
    assert.equal(countRows(database, "SELECT COUNT(*) AS total FROM action_progress"), spared.action_progress, "deleting a diagnosis must only remove its own action progress");
    assert.equal(
      countRows(database, "SELECT COUNT(*) AS total FROM action_progress WHERE inherited_from_id IS NOT NULL"),
      0,
      "a plan that repeated a deleted diagnosis' action must keep the row and lose only the link",
    );
    assert.deepEqual(database.pragma("foreign_key_check"), [], "cascade left dangling foreign keys");
  });
}

function runSmoke(workDir) {
  const databaseFile = path.join(workDir, "fitpulse.db");
  const databaseUrl = toFileUrl(databaseFile);
  const shippedMigrations = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  for (const name of [...V1_MIGRATIONS, ...V2_MIGRATIONS]) {
    assert.ok(shippedMigrations.includes(name), `the migration ${name} is not shipped`);
  }

  step("1/6 release 0.1.0: only its migration on an empty database, then the owner's data");
  deployMigrations("release 0.1.0", prepareFirstRelease(workDir, databaseUrl));
  const before = withDatabase(databaseFile, (database) => {
    const tables = tableNames(database);
    for (const table of Object.keys(V1_TABLES)) {
      assert.ok(tables.includes(table), `table ${table} was not created`);
    }
    for (const table of Object.keys(V2_TABLES)) {
      assert.ok(!tables.includes(table), `table ${table} must not exist before the update`);
    }
    assert.equal(appliedMigrationCount(database), V1_MIGRATIONS.length, "the first release applied the wrong migrations");
    const ids = seedOwnerData(database);
    return {
      ids,
      tables,
      rows: snapshot(database, V1_TABLES),
      shapes: tableShapes(database, V1_TABLES),
      indexes: indexNames(database),
    };
  });
  assert.ok(before.rows.companies.length > 0 && before.rows.diagnoses.length > 0, "the seed data is missing");

  step("2/6 update: prepare-app --migrate (what install and start run) applies this release's migrations");
  const update = runPrepareMigrate(databaseUrl);
  assert.equal(update.status, 0, describeFailure("prepare-app --migrate (update)", update));
  for (const name of V2_MIGRATIONS) {
    assert.ok(update.stdout.includes(name), `the migration ${name} was not applied by the update`);
  }
  withDatabase(databaseFile, (database) => {
    assert.equal(appliedMigrationCount(database), shippedMigrations.length, "not every shipped migration was applied");
    assert.deepEqual(
      tableNames(database),
      [...before.tables, ...Object.keys(V2_TABLES)].sort(),
      "the update did not create exactly the new tables",
    );
    assert.deepEqual(snapshot(database, V1_TABLES), before.rows, "companies, diagnoses, drafts or preferences changed by the update");
    assert.deepEqual(tableShapes(database, V1_TABLES), before.shapes, "the update changed the columns of an existing table");
    for (const index of before.indexes) {
      assert.ok(indexNames(database).includes(index), `the update dropped the index ${index}`);
    }
    for (const [table, rows] of Object.entries(snapshot(database, V2_TABLES))) {
      assert.deepEqual(rows, [], `${table} must start empty`);
    }
    assert.deepEqual(database.pragma("foreign_key_check"), [], "update left dangling foreign keys");
  });
  step("3/6 companies, diagnoses, drafts and preferences identical, the four new tables created empty");

  const repeat = runPrepareMigrate(databaseUrl);
  assert.equal(repeat.status, 0, describeFailure("prepare-app --migrate (repeat)", repeat));
  assert.match(repeat.stdout, /No pending migrations to apply/, "second deploy must have nothing to do");
  withDatabase(databaseFile, (database) => {
    assert.equal(appliedMigrationCount(database), shippedMigrations.length, "second deploy re-applied a migration");
    assert.deepEqual(snapshot(database, V1_TABLES), before.rows, "second deploy changed the data");
    seedFollowUpData(database, before.ids);
  });
  step("4/6 repeated deploy is a no-op; follow-up data (actions, diary, questionnaires, files) written");

  const snapshotBeforeRebuild = withDatabase(databaseFile, (database) => ({
    rows: snapshot(database, ALL_TABLES),
    tables: tableNames(database),
    indexes: indexNames(database),
    applied: appliedMigrationCount(database),
  }));
  const syntheticConfig = prepareSyntheticRelease(workDir, databaseUrl);
  const rebuildOutput = deployMigrations("synthetic release", syntheticConfig);
  assert.ok(rebuildOutput.includes(SYNTHETIC_MIGRATION), "the synthetic migration was not applied");
  const snapshotAfterRebuild = withDatabase(databaseFile, (database) => {
    const columns = database.prepare('PRAGMA table_info("companies")').all().map((column) => column.name);
    assert.ok(columns.includes(SYNTHETIC_COLUMN), "the schema change did not reach the database");
    assert.equal(appliedMigrationCount(database), snapshotBeforeRebuild.applied + 1);
    assert.deepEqual(database.pragma("foreign_key_check"), [], "rebuild left dangling foreign keys");
    assert.deepEqual(indexNames(database), snapshotBeforeRebuild.indexes, "rebuild changed the indexes");
    assert.deepEqual(tableNames(database), snapshotBeforeRebuild.tables, "rebuild changed the set of tables");
    return snapshot(database, ALL_TABLES);
  });
  assertDataSurvivedRebuild(snapshotBeforeRebuild.rows, snapshotAfterRebuild);
  step("5/6 a later release that rebuilds companies keeps the rows of the old and the new tables");

  const repeatRebuild = deployMigrations("synthetic release, again", syntheticConfig);
  assert.match(repeatRebuild, /No pending migrations to apply/, "second deploy must have nothing to do");
  withDatabase(databaseFile, (database) => {
    assert.equal(appliedMigrationCount(database), snapshotBeforeRebuild.applied + 1, "second deploy re-applied a migration");
    assert.deepEqual(snapshot(database, ALL_TABLES), snapshotAfterRebuild, "second deploy changed the data");
  });
  assertCascadeStillWorks(databaseFile, before.ids);
  step("6/6 repeated deploy is a no-op and the company -> diagnoses, diary, questionnaires, files and plan -> actions cascades still work");
}

function main() {
  const workDir = mkdtempSync(path.join(os.tmpdir(), "fitpulse-smoke-migrate-"));
  try {
    runSmoke(workDir);
    console.log("[smoke-migrate] PASS");
  } catch (error) {
    console.error(`[smoke-migrate] FAIL: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  } finally {
    rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main();
