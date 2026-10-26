# phase-1-frontend-report-center — dev notes

## Checklist
- [x] context:brief rules (code-size: 60 lines/function guard)
- [x] read IF contracts: src/api/reportApi.ts, src/api/filesApi.ts(?), shared/report/reportDocument.ts, paperPalette.ts
- [x] read CompanyPage useCompanyOutlet, App.tsx route for relatorios
- [x] prototype #/empresa/c1/relatorios section
- [x] useReportPreview.ts (findChangedPageId, abort, revision)
- [x] ReportSheet + ReportSheetCharts
- [x] ReportPreview
- [x] ReportOptions (evolution off: evolutionSupported prop)
- [x] ReportDelivery (inline, reusable: onExport prop)
- [x] ReportCenterPage (timeline load/error/empty, ?diagnostico=)
- [x] global.css (appended @layer components report-*/sheet-*, motion under no-preference)
- [x] pnpm typecheck exit 0; vite build to run-temp outDir exit 0
- [ ] report JSON

## Findings
- IF-001 src/api/reportApi.ts: getReportPreview(selection, signal), exportReportFile(selection) -> {fileId,fileName,directory}; ReportSelection only diagnosis kind.
- IF-002 src/api/filesApi.ts: openSavedFile/revealSavedFile(id); open_failed details.directory.
- Company ctx: useCompanyOutlet() from CompanyPage; StartDiagnosisButton exported. Diagnosis list via getTimeline(companyId) (historyApi, v1 IF-005) — only way to list completed diagnoses.
- App.tsx NOT in allowed files: route empresa/:companyId/relatorios must be added by integration (message).
- Prototype: reportsLayout ~L833 (rep-types radiogroup, select #rep-diag, switch answers, preview-head, .pages, .paper footer "Página N de M"), CSS L261-355, reprint keyframe L60/L280.
- Brand line in controls skipped (CAP-ra-brand, phase 2).
- Verification: pnpm typecheck exit 0 (0 TS errors); vite build --outDir run-temp exit 0 (pre-existing chunk warning).
- Next: write report JSON (only remaining step).
