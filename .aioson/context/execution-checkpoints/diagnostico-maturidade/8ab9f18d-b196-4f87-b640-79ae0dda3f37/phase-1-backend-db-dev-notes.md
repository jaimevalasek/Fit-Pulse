# phase-1-backend-db (backend lane) — dev notes
Unit files: prisma/migrations/migration_lock.toml, prisma/migrations/20261023000000_init/migration.sql, scripts/prepare-app.mjs, scripts/smoke-migrate.mjs, server/db/prismaClient.ts, tests/helpers/testDatabase.ts
Done when: `node scripts/smoke-migrate.mjs` exits 0.

## Checklist
- [ ] context:brief (rules)
- [ ] migration_lock.toml + init migration.sql (prisma migrate diff --from-empty --to-schema ... --script)
- [ ] scripts/prepare-app.mjs (--generate --migrate --build; data/; CHECKPOINT_DISABLE=1)
- [ ] scripts/smoke-migrate.mjs (temp DB, deploy, write data, synthetic migration from copy, check data, redeploy no-op)
- [ ] server/db/prismaClient.ts (PrismaBetterSqlite3 + WAL/busy_timeout/foreign_keys)
- [ ] tests/helpers/testDatabase.ts (migrated template copy per test file -> createApp deps)
- [ ] run smoke-migrate (log+exit under execution-temp/.../phase-1-backend-db-dev/)
- [ ] report JSON

## Log
- Context: foundation DONE by other unit: schema.prisma (Company/Diagnosis/Preference, enum DiagnosisStatus, generator out ../server/generated/prisma, importFileExtension ts), prisma.config.ts (url = resolveDatabaseUrl()), server/db/databaseUrl.ts (resolveDatabaseUrl/resolveAppRoot/resolveDataDir). Node 24.19, pnpm 11.21, prisma 7.10.1. server/generated and data/ do not exist right now. pnpm test <file> (NOT `-- file`).
- NOTE: never print .env (holds a secret key).
- [x] context:brief done (must_load = naming/English, disk-first, brevity, file-size; nothing blocking). Plan IF: createApp(deps) = { prisma, now(), downloadsDir }.
- [x] WROTE migration_lock.toml + init migration.sql (via `prisma migrate diff --from-empty --to-schema`, CHECKPOINT_DISABLE=1; output byte-identical copy). Tables companies/diagnoses/preferences + index diagnoses_company_id_status_idx; DEFAULT '{}' ok.
- NEXT: inspect @prisma/adapter-better-sqlite3 (dist) for url/timeout/pragma hooks -> prismaClient.ts; then prepare-app.mjs; then smoke-migrate.mjs; then testDatabase.ts.
- FINDINGS (adapter): PrismaBetterSqlite3(config{url,...betterSqlite3Options}) opens ONE better-sqlite3 Database per connect(); `timeout` option = busy timeout. SqlDriverAdapter has executeScript(db.exec)/queryRaw/dispose. No @types/better-sqlite3 installed (and package.json not mine) -> avoid importing better-sqlite3 in .ts; use adapter.executeScript in testDatabase.ts. In .mjs scripts better-sqlite3 import is fine.
- DESIGN: prismaClient.ts = subclass of PrismaBetterSqlite3 overriding connect() -> executeScript(PRAGMAs: busy_timeout, journal_mode=WAL, foreign_keys=ON); createPrismaClient(url=resolveDatabaseUrl()) sync. testDatabase.ts = createTestDatabase() flat {prisma, now, downloadsDir, databaseUrl, setNow, resetData, dispose}; migrates by applying prisma/migrations/*/migration.sql via adapter.executeScript (no template copy: ms cost; deviation noted). prepare-app.mjs exports helpers (APP_ROOT, runPackageBin) guarded by main-check; smoke-migrate imports them. Synthetic migration = `prisma migrate diff --from-schema --to-schema` with NOT NULL column added to Company (expect RedefineTables) applied via temp --config pointing to migrations copy.
- [x] WROTE server/db/prismaClient.ts, scripts/prepare-app.mjs. VERIFIED prepare-app: `--generate --migrate --build` exit 0 w/ DATABASE_URL temp (log: execution-temp/.../phase-1-backend-db-dev/prepare.log); bad flag -> exit 2. server/generated/prisma now exists (gitignored, left in place); dist/ also built by frontend lane's src/.
- NEXT: scripts/smoke-migrate.mjs (check `prisma migrate diff --from-schema --to-schema` + `migrate deploy --config <tmp>.mjs` work), then testDatabase.ts, then prismaClient pragma verification via tsx.
- [x] WROTE scripts/smoke-migrate.mjs; VERIFIED `node scripts/smoke-migrate.mjs` exit 0 (log+exit: execution-temp/.../phase-1-backend-db-dev/smoke-migrate.{log,exit}). Steps: prepare-app --migrate on empty DB; seed (better-sqlite3); synthetic RedefineTables migration from `prisma migrate diff --from-schema --to-schema` applied via `migrate deploy --config <tmp>/prisma.config.mjs` on a copy of prisma/migrations; data identical; repeat deploy "No pending migrations"; FK cascade companies->diagnoses still works. Fixed: snapshot ORDER BY pk (not column 1).
- NEXT: tests/helpers/testDatabase.ts; scratch tsx check of prismaClient pragmas (WAL/foreign_keys/busy_timeout, incl. $transaction); tsc --noEmit on my files; negative-control for smoke; cleanup tmp; report.
- [x] WROTE tests/helpers/testDatabase.ts (createTestDatabase -> {prisma, now, downloadsDir, databaseUrl, setNow, resetData, dispose}). VERIFIED: tsc --noEmit exit 0 (0 errors); tsx probe: journal=wal, foreign_keys=1, busy_timeout=5000 incl. after $transaction; cascade via Prisma; dispose idempotent+dir removed (probe-pragmas.log); rules:check RULES=OK; negative control (mutant migration deleting diagnoses) => smoke exit 1 "rows of diagnoses changed"; final `node scripts/smoke-migrate.mjs` exit 0 (smoke-migrate-final.{log,exit}).
- NEXT: write report JSON, then stop.
- DONE: report written (PASS).
