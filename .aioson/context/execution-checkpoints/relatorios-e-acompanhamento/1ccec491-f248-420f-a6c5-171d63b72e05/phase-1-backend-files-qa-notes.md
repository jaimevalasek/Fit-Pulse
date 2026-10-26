# phase-1-backend-files QA — progress notes

## Checklist
- [x] C1 Read unit files (schema, migration, repo, systemOpener, fileService, fileRoutes, app.ts, main.ts, filesApi.ts, fileRoutes.test.ts)
- [x] C2 Run `pnpm exec prisma validate` -> log in runtime/execution-temp/.../phase-1-backend-files-qa/
- [x] C3 Run `pnpm exec vitest run tests/api/fileRoutes.test.ts` -> log
- [x] C4 Run `node scripts/smoke-migrate.mjs` -> log
- [x] C5 Check AC-ra-18 coverage vs. tests (unknown id, deleted, folder, outside Downloads, non-plain name, screen path ignored, system failure 500)
- [x] C6 Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-files-qa.json

## Findings (concrete)
- C1 read done: systemOpener.ts (argv arrays, no shell, win32 /select quote guard, exit-code policy), fileService.ts (lstat, isDirectChildOf, plain-name, 64-char id cap, open_failed 500 with directory), fileRoutes.ts (204, body never read), migration + schema (nullable company_id, cascade, consistent), app.ts/main.ts wiring (default createSystemOpener, main passes real one), filesApi.ts (204 handled by httpClient.readJson; error.directory -> ApiError.details via readErrorDetails).
- AC-ra-18 coverage in tests/api/fileRoutes.test.ts: 404 unknown/long/deleted/folder/outside/non-plain; screen path ignored; 500 open_failed; GET refused; opener command lines per platform (fake spawn). Matches PRD AC-ra-18.
- No correctness/security defect found in unit code.
- Deferred to integration (not unit defects): reportService does not register saved PDFs yet (outside unit); tests/helpers/testDatabase.ts and scripts/smoke-migrate.mjs do not reference generatedFile (fileRoutes test clears its own rows, line 140).
- Not run (environment): Windows Play webview manual smoke (OQ-ra-1); macOS/Linux real opener smoke.

## Edits made
- None. corrections[] empty.

## Verification results
- C2 prisma validate: exit 0, log phase-1-backend-files-qa/prisma-validate.log (valid)
- C3 vitest tests/api/fileRoutes.test.ts: exit 0, 44 passed, log phase-1-backend-files-qa/vitest-fileRoutes.log
- C4 node scripts/smoke-migrate.mjs: exit 0, PASS, log phase-1-backend-files-qa/smoke-migrate.log

## Next small action
C6: write report JSON (verdict PASS; findings = 2 verification_not_run medium + 1 deferred integration low; corrections []).
- C6 report written (PASS). Done.
