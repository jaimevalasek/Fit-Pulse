# phase-2-frontend-evolution-portfolio QA notes (lane frontend, wave 7)

Unit files: src/features/reports/ReportOptions.tsx, src/features/history/ComparePage.tsx, src/features/reports/PortfolioReportPage.tsx, src/features/home/ConsultantHome.tsx, src/App.tsx
Done when: `pnpm typecheck` passes. Correction budget: 3 unit files.
Report: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-frontend-evolution-portfolio-qa.json

## Checklist
- [x] 1. Run `pnpm typecheck` (foreground, log under .aioson/runtime/execution-temp/.../phase-2-frontend-evolution-portfolio-qa/, exit code saved)
- [x] 2. Read unit files (bounded) for defects vs contract (ReportOptions evolution De/Até, PortfolioReportPage empty state, ConsultantHome link, ComparePage imports)
- [x] 3. Check implementer claims: ReportSelection cast, server schema, ReportCenterPage wiring (out of unit, report only)
- [x] 4. Write JSON report, verdict (PASS; report written and parsed OK, 6 findings all medium deferred to integration/unit-external)

## Findings / edits
- No defect found in unit files; no corrections made (corrections[] empty).
- PortfolioReportPage.tsx:17 `as unknown as ReportSelection` cast remains: src/api/reportApi.ts ReportSelection (line 8) has only diagnosis; out of unit -> integration.
- server/validation/reportSchemas.ts reportSelectionSchema (lines 13-32) has diagnosis + evolution only; no portfolio member -> portfolio preview/export would 400 -> integration / phase-2-backend-portfolio.
- ReportCenterPage.tsx not wired (evolution stays off in live center) -> integration (per implementer).
- ComparePage.tsx imports DELTA_WORDS/STAGE_MOVES/formatDelta/formatComparisonMonth/recalculationNotice from shared/content/comparisonCopy.ts: confirmed.
- App.tsx:93 route relatorios/carteira -> PortfolioReportPage: confirmed.
- ESLint absent (node_modules/.bin/eslint missing): verification_not_run.

## Verification log
- `pnpm typecheck` -> EXIT=0, log typecheck.log (1 line "$ tsc --noEmit", no errors). Exit file typecheck.exit.
- Not run (not in unit Verification; depend on sibling/integration wiring): playwright tests/e2e/report.spec.ts, portfolioReport.spec.ts, home.spec.ts.

## Next action
- Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-frontend-evolution-portfolio-qa.json (verdict PASS, medium deferred findings).
