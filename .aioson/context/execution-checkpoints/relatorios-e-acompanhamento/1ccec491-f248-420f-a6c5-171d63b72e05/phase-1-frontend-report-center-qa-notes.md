# phase-1-frontend-report-center QA notes (attempt b176dd22)

## Checklist
- [x] Dirs created (notes, runtime temp qa dir, reports dir)
- [x] Read ReportCenterPage, useReportPreview, ReportDelivery, ReportOptions, ReportPreview (no defect found in these 5 so far)
- [x] Read ReportSheet.tsx (forwardRef OK), ReportSheetCharts.tsx (OK), global.css 826-880: reprint 700ms, page-in, skeleton, switch all inside @media (prefers-reduced-motion: no-preference) (AC-ra-58 OK; --dur value not yet checked vs 220ms)
- [x] IF-001 (implementation-plan row 698): GET /api/reports/preview, POST /api/reports/export, POST /api/diagnoses/:id/report; reportApi.ts matches. Unit uses getReportPreview + exportReportFile only; fields fileId/fileName/directory used. IF-002 (/api/files/:id/open|reveal) matches filesApi.ts; OpenFailureDetails.directory used.
- [x] Run `pnpm typecheck` x3 -> exit 1 each time; run1 pdfRenderer.test (sibling, cleared by run2); run2+run3 only src/features/result/ResultPage.tsx(21,26) describeConfidence (sibling phase-1-frontend-result, in progress). Zero errors in unit files.
- [x] Verify AC-ra-01/02/03/04/19/58 by reading code: all present (see Findings). e2e not runnable: App.tsx has no report route (grep empty) -> integration.
- [x] Apply <=3 local corrections if defect found: none needed.
- [x] Re-run typecheck after any correction: N/A (no corrections)
- [ ] Write JSON report to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-frontend-report-center-qa.json

## Findings so far
- Read ReportCenterPage.tsx (133 lines) and useReportPreview.ts (74 lines): structure matches AC-ra-01/02/04 claims; company layout via useCompanyOutlet; getTimeline for list; reportApi getReportPreview/exportReportFile used.
- typecheck run #1 (foreground): EXIT=1, 10 'error TS' lines, ALL in tests/unit/pdfRenderer.test.ts (TS2304 missing names ReportBrandInput, ReportKind, resolveBrand, buildFooter, buildCoverPage, buildHowToReadPage, inflateSync). That file is owned by concurrent phase-2-backend-brand-reports (in progress). Zero errors under src/features/reports. Must re-run before attributing (see below).

## Edits made
- (none yet)

## Verification
- typecheck run1/run2/run3 logs + exitcode in runtime temp qa dir: typecheck.log/.exitcode, typecheck-rerun.log, typecheck-rerun2.log. Exit 1 (sibling ResultPage.tsx). Unit-owned files: 0 errors.
- Verdict chosen: PASS for local scope; workspace typecheck deferred to integration.

## Runner / log paths
- Temp dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-frontend-report-center-qa/
- Typecheck log: (planned) .../phase-1-frontend-report-center-qa/typecheck.log

## Next small action
- Write JSON report to the reports path (verdict PASS local, findings: sibling typecheck + e2e/smoke deferred to integration). Then stop.
