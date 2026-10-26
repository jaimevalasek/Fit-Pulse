# phase-4-backend-backup dev notes
Checklist:
- [x] context:brief, read patterns (app.ts, reportService, downloadsFolder, schemas, testDatabase)
- [x] server/validation/backupSchemas.ts (envelope + strict file schema; reuses companyInputSchema.shape, diagnosisPatchSchema.shape.*.unwrap())
- [x] server/services/backupService.ts (export via saveFile; import: envelope -> newer check -> full schema -> tx createMany skipping known ids; second draft per company skipped)
- [x] server/routes/backupRoutes.ts (10MB express.json only on /import)
- [x] server/app.ts mount before 1mb json parser; `rules` const moved above it
- [x] typecheck exit 0 (log in temp dir)
- [x] tests/api/backupRoutes.test.ts: npx vitest run <file> -> exit 0, 44 passed (focused.log/focused.exit in temp dir)
- [x] Done-when pnpm test -- file: exit 0 (17 files, 757 tests); typecheck exit 0
- [x] report JSON written (verdict PASS)
Assumptions to report: skipped = {companies, diagnoses}; drafts skipped when company already has a draft; newer message uses file rulesVersion; export drops unreadable leftover answer keys.
Findings: OBS-3370ac (pnpm test -- file runs whole suite; not mine)
