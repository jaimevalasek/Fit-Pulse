# phase-2-frontend-report — dev notes (attempt ab384408)

## Checklist
- [x] Upstream repair check: src/api/httpClient.ts already sends Content-Type + `{}` on body-less POST/PUT/PATCH (JSON_WRITE_METHODS) — previous 415 finding is fixed upstream; no edit needed.
- [x] src/api/reportApi.ts — exportReport(id) -> { fileName, directory } (POST /api/diagnoses/:id/report)
- [x] src/features/result/ExportReportDialog.tsx — exports, shows directory/fileName; failure in role="alert", result intact
- [x] src/features/result/ResultPage.tsx — "Exportar PDF" button next to CompareWithLink in ResultHeader actions div (import count limit 15; already 16)
- [x] pnpm build exit 0 (build.log + build.exit=0 in run temp dir)
- [ ] report JSON

## Findings
- ExportReportDialog: AlertDialog "Relatório em PDF" (data-aioson-id pdf-modal), trigger Button data-aioson-id result-pdf; saved -> role=status result-pdf-saved with fileName+directory; failure -> role=alert result-pdf-error; after close a role=status result-pdf-notice (saved / cancelada / falhou, nada alterado). Dialog content extracted to ExportDialogContent (function-size limit).
- ResultPage: import added (now 17 imports, advisory limit 15 noted by history QA); button placed next to CompareWithLink.
## Next
- [x] report JSON written (verdict PASS); unit done
