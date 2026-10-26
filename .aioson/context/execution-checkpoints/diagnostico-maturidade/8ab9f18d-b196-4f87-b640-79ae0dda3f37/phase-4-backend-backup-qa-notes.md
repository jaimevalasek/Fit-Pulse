# phase-4-backend-backup QA notes (run 8ab9f18d, attempt 66cc899b)

Unit: lane backend, wave 10, CAP-dm-backup / AC-dm-37 / IF-009
Done when: `pnpm test -- tests/api/backupRoutes.test.ts` passes (NOTE: runner ignores file filter per dev report, OBS-3370ac; run it anyway, record exit code)
Unit files (correction budget 3): server/validation/backupSchemas.ts, server/services/backupService.ts, server/routes/backupRoutes.ts, server/app.ts, tests/api/backupRoutes.test.ts

## Checklist
- [ ] C1 Read unit files (bounded reads) and check against AC-dm-37 / IF-009 contract
- [ ] C2 Verify: run `pnpm test -- tests/api/backupRoutes.test.ts` -> log + exit code in run dir
- [ ] C3 Verify: `npx vitest run tests/api/backupRoutes.test.ts` -> log + exit code
- [ ] C4 Verify: `pnpm typecheck` -> log + exit code
- [ ] C5 Check dev claims: skip-not-overwrite, draft skip (RULE-dm-13), export via readStoredAnswers/readStoredCalculator, 422 backup_invalid / backup_newer_version shape
- [ ] C6 Check frontend contract match (src/api/backupApi.ts): export {fileName,directory,companies,diagnoses}; import {imported,skipped}
- [ ] C7 Check saveFile usage from server/files/downloadsFolder.ts (FileWriteError mapping)
- [ ] C8 Write report JSON at .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-4-backend-backup-qa.json

Run dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-4-backend-backup-qa/

## Findings so far
- C1/C5 read: server/routes/backupRoutes.ts (27 lines) delegates only; server/app.ts mounts backup router before global express.json 1mb (correct order, 10MB route works).
- C5 service/backupService.ts insertMissing(): skip-by-id, draft skip via companiesWithDraft (RULE-dm-13), single transaction, export via saveFile + FileWriteError->writeFailed (500 write_failed). Matches dev claims.
- C5 validation/backupSchemas.ts: strict schema, duplicate ids and orphan companyId rejected; cnpj has no unique index in prisma/schema.prisma so createMany cannot fail on cnpj.
- C6 src/api/backupApi.ts shapes match server (export: fileName, directory, companies, diagnoses; import: imported, skipped).
- LOW (no fix): backupService.ts import(): when only formatVersion/schemaVersion is newer, newerBackup(fileRulesVersion) prints the file's rulesVersion (dev note confirmed).
- LOW (no fix): OBS-3370ac, `pnpm test -- <file>` runs the full suite (757 tests), exit 0.
- MEDIUM verification_not_run (integration): pnpm test:e2e -- tests/e2e/backup.spec.ts; smoke-migrate/boot/store-package; harness:check; manual Windows smoke.
- No critical/high finding. Verdict PASS. No corrections made (budget unused).

## Edits made
(none; no unit file needed correction)

## Verification results
- C2 `pnpm test -- tests/api/backupRoutes.test.ts` EXIT=0, log done-when.log: 17 files / 757 tests passed (runner ignores filter, as dev reported)
- C3 `npx vitest run tests/api/backupRoutes.test.ts` EXIT=0, focused.log: 1 file / 44 tests passed
- C4 `pnpm typecheck` EXIT=0, typecheck.log clean
(exit files in run dir: *.exit)

## Next small action
C8: write report JSON (verdict PASS), then final message. Checklist C1-C7 done.
