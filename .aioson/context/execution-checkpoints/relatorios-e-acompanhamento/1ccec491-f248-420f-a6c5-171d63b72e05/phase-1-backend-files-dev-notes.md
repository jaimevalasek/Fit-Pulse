# phase-1-backend-files notes (unverified work data)
Checklist:
- [ ] context:brief (rules)
- [ ] prisma GeneratedFile model + migration (migrate diff)
- [ ] generatedFileRepository
- [ ] systemOpener
- [ ] fileService
- [ ] fileRoutes + app.ts + main.ts
- [ ] src/api/filesApi.ts
- [ ] tests/api/fileRoutes.test.ts
- [ ] verify: prisma validate, vitest fileRoutes, smoke-migrate
- [ ] report JSON
Logs dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-files-dev/

## Findings (read phase done)
- Patterns: server/repositories/companyRepository.ts (factory createXRepository(prisma)), routes: createXRoutes({svc}) Router, DomainError(status, code, msg, details) in server/services/domainError.ts; tests: tests/api/reportRoutes.test.ts uses createTestDatabase (tests/helpers/testDatabase.ts, NOT mine; replays all migration.sql; resetData deletes company -> cascade covers generated_files)
- saveFile in server/files/downloadsFolder.ts returns {fileName, directory}; reportService.ts NOT in my allowed files -> integration must call generatedFileRepository.insert after saveFile (report as message)
- app.ts deps: AppDependencies {prisma, now, downloadsDir, backendPort?, rules?}; add systemOpener?: SystemOpener
- smoke-migrate DATA_TABLES lists only companies/diagnoses/preferences; new table fine.
- Decisions: GeneratedFile.companyId NULLABLE (cascade) so portfolio/evolution-less files (carteira) can be registered; kind String, TS union GENERATED_FILE_KINDS in repo (diagnosis_pdf, evolution_pdf, portfolio_pdf, questionnaire_html); createdAt input from service clock.
- old schema copy saved at $TMP/schema.before.prisma for migrate diff

## Progress
- [x] prisma GeneratedFile model (schema.prisma), prisma validate exit 0; migration.sql created from migrate diff (CREATE TABLE + INDEX only); prisma generate done (server/generated/prisma/models/GeneratedFile.ts)
- next: generatedFileRepository, systemOpener, fileService, fileRoutes, app.ts/main.ts, filesApi.ts, test
- [x] written: generatedFileRepository.ts, systemOpener.ts (createSystemOpener({platform, spawnProcess}), SystemOpenError), fileService.ts (open_failed 500 w/ directory; file_not_found 404), fileRoutes.ts (204), app.ts (+systemOpener? dep, default real), main.ts, src/api/filesApi.ts
- next: write tests/api/fileRoutes.test.ts; run tsc --noEmit (check only my files), vitest fileRoutes, smoke-migrate, prisma validate; then report JSON
- [x] tests/api/fileRoutes.test.ts written; vitest fileRoutes exit 0 (44 passed) log: $TMP/vitest-fileRoutes.log
- next: smoke-migrate (log smoke-migrate.log), tsc --noEmit filtered to my files, prisma validate final, report JSON
- [x] ALL DONE: prisma validate 0, vitest fileRoutes 0 (44), smoke-migrate 0, tsc 0, regression 0 (129). Report written to .aioson/context/reports/.../phase-1-backend-files.json (PASS, 2 verification_not_run findings)
