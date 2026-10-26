# phase-2-frontend-evolution-portfolio — dev notes
started: 2026-10-25

## Checklist
- [ ] context:brief rules
- [ ] ComparePage uses shared/content/comparisonCopy.ts
- [ ] ReportOptions: controlled type + De/Até (AC-ra-12/14), send kind evolution fromId/toId
- [ ] ReportCenterPage wiring (NOT in allowed files -> message integration if needed)
- [ ] PortfolioReportPage (route relatorios/carteira; minha empresa explanation; empty state; preview + export) AC-ra-16
- [ ] ConsultantHome button "Relatório da carteira"
- [ ] App.tsx route
- [ ] pnpm typecheck PASS
- [ ] report JSON

## Findings
- ComparePage: done — local DELTA_WORDS/STAGE_MOVES/directionOf/formatMonth body/recalc text replaced by shared/content/comparisonCopy imports (formatMonth kept exported as wrapper; OwnerHome imports it).
- src/api/reportApi.ts ReportSelection = diagnosis only; NOT in write paths -> integration must widen (evolution, portfolio). ReportCenterPage NOT in allowed files -> integration wires evolution state.
- Prototype: portfolioPage() line ~820 (owner-mode empty-state text, "O que entra" list); rep-from/rep-to handlers line 1210.
- ReportOptions: done — controlled type (reportType/onReportTypeChange), EvolutionFields De/Até, helpers defaultEvolutionRange/diagnosesAfter/rangeWithFrom exported; optional props so ReportCenterPage still compiles.
- PortfolioReportPage: done — owner-mode notice -> /configuracoes, empty via getConsultantHome().companyCount===0 + NewCompanyButton, workspace uses useReportPreview/ReportPreview/ReportDelivery with cast `{kind:"portfolio"} as unknown as ReportSelection`.
- ConsultantHome: "Relatório da carteira" link (data-aioson-id home-portfolio-report). App.tsx: route relatorios/carteira.
- Verification: pnpm typecheck exit 0 (log typecheck.log/typecheck.exit in run temp dir). eslint not installed.
- Next: write report JSON.
