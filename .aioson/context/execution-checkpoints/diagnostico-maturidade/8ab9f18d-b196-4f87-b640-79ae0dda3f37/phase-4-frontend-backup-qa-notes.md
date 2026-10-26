# phase-4-frontend-backup QA notes (run 8ab9f18d)

Lane: frontend. Unit files: src/api/backupApi.ts, src/features/settings/BackupSection.tsx, src/features/settings/SettingsPage.tsx.
Done when: `pnpm build` exit 0.

## Checklist
- [ ] 1. Run `pnpm build` in foreground, log + exit code to execution-temp/phase-4-frontend-backup-qa/
- [ ] 2. Read unit files (bounded) and check contract vs IF-009 / AC-dm-37 (local only)
- [ ] 3. Fix only simple local defects inside unit files (budget 3); re-run build
- [ ] 4. Write report JSON to reports/diagnostico-maturidade/8ab9f18d-.../phase-4-frontend-backup-qa.json
- [ ] 5. Record deferred checks as verification_not_run (backup route test, backup e2e)

## Findings / edits
- Step 1 done: src/api/backupApi.ts (39 lines) read; exportBackup -> POST /api/backup/export, importBackup -> POST /api/backup/import; httpClient.post sends Content-Type + `{}` default body (src/api/httpClient.ts:93, :102, :119).
- Step 2 done: BackupSection.tsx (198 lines) read: role=alert results with data-aioson-id backup-export-saved/backup-export-error/backup-import-done/backup-import-error; 10 MB client guard; Button forwards props (src/components/ui/button.tsx:44,52). SettingsPage.tsx:331-338 inserts BackupSection after ThemeSection (import at :11).
- No simple local defect found in unit files. No corrections made (budget unused).
- Deferred (not in unit): server/routes/backupRoutes.ts, server/services/backupService.ts, tests/api/backupRoutes.test.ts, tests/e2e/backup.spec.ts do not exist yet (Glob empty) -> verification_not_run, integration.
- Cross-lane assumptions to hand to integration: `skipped` shape {companies, diagnoses}; server limit 10 MB must match BACKUP_MAX_BYTES; 422 backup_newer_version carries rulesVersion.

## Verification log
- `pnpm build` (cwd C:/dev/playapps/v-stage), foreground, exit 0. Log: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-4-frontend-backup-qa/build.log (tsc --noEmit && vite build; built in 666ms; EXIT_CODE=0 marker in log).

## Next action
- Write report JSON at reports/.../phase-4-frontend-backup-qa.json with verdict PASS (local Done-when met), then stop.
