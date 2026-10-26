# phase-1-frontend-result — dev notes
started: 2026-10-25
## Checklist
- [x] ConfidenceNote -> formatConfidenceStatement + CONFIDENCE_LEVEL_EXPLANATIONS (AC-ra-23); describeConfidence removed
- [x] RiskList: RISK_LABEL_CLASS whitespace-nowrap; column 140px->160px so "Probabilidade 5 de 5" fits (AC-ra-24)
- [x] ResultPage: ResultHeader gets companyId; "Relatórios" link (result-reports) -> /empresa/:id/relatorios?diagnostico=:diag; ResultExport wraps ReportDelivery(onExport=exportReport) + "Fechar" (result-export-close) remounting via key (AC-ra-25)
- [x] ExportReportDialog.tsx deleted; grep importers in src/shared/server/tests -> none
- [x] OwnerHome: "Relatórios" link (home-reports) in header actions (AC-ra-01)
- [x] pnpm typecheck -> exit 0 (log typecheck.log/typecheck.exit in run temp dir)
- [x] report JSON written
## Findings
- eslint not installed in project (pnpm exec eslint not found) — no lint run
- ReportDelivery button id is report-export (prototype used result-pdf) — tell integration for result.spec.ts
