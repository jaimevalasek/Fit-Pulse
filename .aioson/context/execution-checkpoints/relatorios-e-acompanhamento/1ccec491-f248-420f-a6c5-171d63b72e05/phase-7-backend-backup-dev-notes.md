# phase-7-backend-backup dev notes (retry1; prev attempt: engine "database is locked", not code)
Temp dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-7-backend-backup-dev/
Report: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-7-backend-backup.retry1.json
## Findings so far (read-only phase done)
- Existing: backupSchemas.ts (v1 strict, BACKUP_FORMAT_VERSION=1/SCHEMA=1, envelope), backupService.ts (readBackup + insertMissing tx + import w/ envelope check), backupApi.ts counts {companies,diagnoses}, tests use toEqual on counts -> must update.
- Brand lives in `preferences` table keys: brand.name/phone/email/website/logo_mime/logo_data(base64)/logo_updated_at (brandService.ts KEY). Interval key: reevaluation_interval_days (text '60|90|120|180').
- Prisma models to export: ActionProgress(diagnosisId,actionKey,status,dueDate,ownerRole,note,inheritedFromId), DiaryEntry(companyId,month,newCustomers,spendParts Json?,spendTotalCents BigInt?, unique company+month), QuestionnaireSend(companyId,fileName,sentAt,answeredAt,clientSavedAt,draftId no FK).
## Design
- v2: formatVersion=2, schemaVersion=2; dispatch on formatVersion (1 -> old schema, 2 -> new strict). New keys: actionProgress[], diaryEntries[], questionnaireSends[], brand|null{name,phone,email,website,logo|null}, reevaluationIntervalDays|null.
- Import: skip existing ids; brand only if dest has no brand.* key; interval only if dest has no stored key; no generated_files.
- Counts add: actions, diaryEntries, questionnaireSends, brand(0/1), reevaluationInterval(0/1).
## Checklist
- [x] schemas v2 (written backupSchemas.ts: parseBackupFile(raw,formatVersion), backupFileV1Schema, v2 strict; NOT yet type-checked)   - [x] service (backupService.ts rewritten; not yet typechecked)   - [x] backupApi (done, tsc ok; remaining tsc errors only src/features/home = other unit)   - [~] backupRoutes.test.ts (existing expectations migrated to counts()/NO_RECORDS + snapshotOf extended; NEXT: add seedFollowUp helper + describe "version 2" + v2 tamperings + validBackup richer)   - [x] playRoutes.test.ts (added describe AC-ra-56; not yet run)   - [ ] vitest run (log+exit in temp dir)   - [ ] report JSON
- existing backupRoutes tests: 8 fail only because counts toEqual lacks new keys -> add counts() helper w\/ full zero-counts; then add v2 tests (brand PUT \/api\/brand + \/logo, PUT \/api\/preferences interval, PATCH actions, POST diary, POST questionnaire)
- playRoutes.test.ts PASS 51 tests (log vitest-play1.log in temp dir). tsc: only src/features/home errors (other unit). manifest/system/package/smokes/BackupSection/e2e NOT in this unit's allowed files -> message to integration.
- backupRoutes.test.ts: v2 describe + v2 tamperings + richer validBackup inserted. NEXT: tsc + run vitest backupRoutes, fix failures.
- tsc clean; backupRoutes.test.ts 92 pass (vitest2.log). NEXT: official command both files, grep other users of backup constants/BackupSection, write report.
- DONE: vitest both files exit 0 (143 tests), tsc clean, report written (phase-7-backend-backup.retry1.json).
