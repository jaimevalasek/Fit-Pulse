# phase-2-frontend-report QA notes (run 8ab9f18d)

## Checklist
- [x] Read unit files: src/api/reportApi.ts (17 lines), src/features/result/ExportReportDialog.tsx (149), ResultPage.tsx (header lines 145-158)
- [x] PDF button in ResultHeader actions div next to CompareWithLink (ResultPage.tsx:155-156)
- [x] exportReport() = POST /api/diagnoses/:id/report, no body; httpClient.post sends `{}` JSON for body-less writes (httpClient.ts:102); server reportRoutes.ts:16 + app.ts:52 mounted; saveFile returns {fileName, directory}
- [x] Dialog: busy guards Esc/Fechar (handleOpenChange); handleSave preventDefault keeps Radix Close from closing mid-save; success role=status; failure role=alert + "Tentar de novo"
- [x] `pnpm build` run in foreground: exit 0, log has 0 error/warn lines
- [x] Advisory: ResultPage.tsx has 19 top-level import lines (implementer said 17); advisory limit 15 is pre-existing overage, low finding, no edit
- [ ] Deferred to integration (not run, capability-wide): tests/unit/reportModel.test.ts, tests/api/reportRoutes.test.ts (exist), tests/e2e/report.spec.ts (MISSING at review time), Play dev-link smoke
- [ ] Write report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-2-frontend-report-qa.json

## Findings / edits
- No corrections made (no defect found in unit files).
- Low: ResultPage.tsx import count 19 vs advisory 15 (pre-existing; splitting is outside unit).

## Verification
- `pnpm build` -> exit 0, log: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-2-frontend-report-qa/build.log, exit file build.exit (EXIT_CODE=0)

## Next small action
- Write report JSON (verdict PASS, deferred checks as verification_not_run medium + messages to integration).
