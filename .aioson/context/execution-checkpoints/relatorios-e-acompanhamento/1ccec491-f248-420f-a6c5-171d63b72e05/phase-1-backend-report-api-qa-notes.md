# phase-1-backend-report-api — QA notes (run 1ccec491)

## Checklist
- [x] Run verify: `pnpm exec vitest run tests/api/reportRoutes.test.ts tests/api/fileRoutes.test.ts` -> exit 0, 2 files / 113 tests passed (log: runtime/execution-temp/.../phase-1-backend-report-api-qa/vitest.log, exit: vitest.exit)
- [x] Review unit files: reportSchemas.ts, reportService.ts, reportRoutes.ts, downloadsFolder.ts, src/api/reportApi.ts, tests/api/reportRoutes.test.ts
  - reportService.ts:75-164 export: FileWriteError -> writeFailed (500); insert failure -> rm PDF + writeFailed. OK.
  - DATE_SUFFIX_LENGTH (11) matches formatFileDate YYYY-MM-DD + "-" (server/report/reportModel.ts:152). OK.
  - reportSchemas.ts: includeAnswers default false; query "true"/"false" coerced. OK.
  - reportApi.ts: exports getReportPreview/exportReportFile/exportReport + types. OK.
  - No defect found so far.
- [x] Check claimed contract (IF-001, AC-ra-17, AC-ra-19) against code
  - tests cover: naming/(2), 500 write_failed no file/record, retry, open-by-id via fake SystemOpener (reportRoutes.test.ts:707).
  - Confirmed: server/app.ts:68 lacks now (low finding).
  - tsc --noEmit exit 0 (log tsc.log).
- [x] Write report JSON (verdict PASS, no corrections) to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-report-api-qa.json

## Findings so far
- contract_gap low: server/app.ts:68 no `now` (integration)
- verification_not_run medium x2: Play webview smoke, Playwright e2e (outside unit)

## Edits made
- none

## Next small action
- Done. Next: none (report written).
