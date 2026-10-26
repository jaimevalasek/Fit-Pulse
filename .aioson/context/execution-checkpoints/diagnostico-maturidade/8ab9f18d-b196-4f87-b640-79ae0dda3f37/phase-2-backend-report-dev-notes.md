# phase-2-backend-report dev notes
Checklist (update after each slice):
- [ ] context:brief + read app.ts, historyRoutes/Service pattern, deps (pdfkit, @fontsource, unpdf)
- [ ] server/files/downloadsFolder.ts
- [ ] server/report/reportModel.ts + tests/unit/reportModel.test.ts
- [ ] server/report/pdfRenderer.ts
- [ ] server/services/reportService.ts + server/routes/reportRoutes.ts + app.ts mount
- [ ] tests/api/reportRoutes.test.ts
- [ ] run pnpm test -- tests/unit/reportModel.test.ts tests/api/reportRoutes.test.ts (log in runtime/execution-temp/.../phase-2-backend-report-dev/)
- [ ] write JSON report
Findings: (none yet)

## Findings so far (context read done)
- app.ts: createApp(deps) already has `downloadsDir`; mount `createReportRoutes` after createHistoryRoutes. Pattern: service factory `createXService({prisma, now, ...})`, route factory `createXRoutes({x})`, DomainError(status, code, msg).
- Fonts: node_modules/@fontsource/{inter,jetbrains-mono}/files/*-latin-{400,600,700}-normal.woff ; pdfkit 0.20.2 + unpdf 1.9.1 installed.
- Guidance text lives in src/features/result/ResultPage.tsx:190 (copy wording into reportModel). Stage/dimension/risk/action/lock catalogs in shared/content/*.
- Plan: downloadsFolder throws FileWriteError; service maps to DomainError(500,"write_failed"). Reserve final name with open(wx) then rename temp.

## Progress
- DONE (unverified): server/files/downloadsFolder.ts (sanitizeFileStem, saveFile, FileWriteError, defaultDownloadsDir), server/report/reportModel.ts (buildReportModel, formatFileDate, GUIDANCE_NOTICE)
- NEXT: pdfRenderer.ts (pdfkit, fonts from node_modules/@fontsource/*/files/*-latin-*-normal.woff), reportService, reportRoutes, app.ts mount, 2 tests, run
- DONE (unverified, not yet run): pdfRenderer.ts, reportService.ts, reportRoutes.ts, app.ts mount (createReportRoutes after history). Added `level` to ReportRisk.
- NEXT: tests/unit/reportModel.test.ts then tests/api/reportRoutes.test.ts (unpdf extractText; hostile names; draft 409; write failure via downloadsDir being a file path), then run + typecheck, report JSON.
- unit test reportModel: run via 'pnpm exec vitest run <file>' (NOTE: 'pnpm test -- file' runs the WHOLE suite since '--' is passed literally)
- VERIFIED: `pnpm exec vitest run tests/unit/reportModel.test.ts tests/api/reportRoutes.test.ts` => 49 passed, exit 0 (log: runtime/execution-temp/.../phase-2-backend-report-dev/api.log).
- NEXT: visual check of sample PDF (scratch script in execution-temp dir), `pnpm typecheck` filtered to my files, then exact Done-when command `pnpm test -- <2 files>` (runs whole suite), write JSON report.
- FINAL: Done-when 'pnpm test -- <2 files>' exit 0 (14 files / 649 tests, whole suite as '--' drops filter). pnpm typecheck exit 0. Focused: 49 tests pass. Layout checked via pdfjs geometry (no pdftoppm). Not run: e2e report.spec, Play webview smoke. Report JSON written at .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-2-backend-report.json
