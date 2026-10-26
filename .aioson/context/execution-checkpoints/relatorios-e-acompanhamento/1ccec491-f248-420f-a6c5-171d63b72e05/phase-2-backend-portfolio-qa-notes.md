# phase-2-backend-portfolio QA notes (lane backend, qa attempt f5445d25)

## Checklist
- [x] 1. Declared verification (4 files): 4 files / 88 tests passed, EXIT=0. Log: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-portfolio-qa/verify-1.log
- [x] 2. Calendar-day rule: PRD .aioson/context/prd-relatorios-e-acompanhamento.md:240 (RULE-ra-07) says local computer day and "a data ja passou" -> spec-backed. Recorded as medium behavior_change for owner confirmation of "tela do consultor igual".
- [x] 3. Read followUp.ts, portfolioService.ts, portfolioRepository.ts, portfolioDocument.ts, reportService portfolio branch, homeService delegation, rewritten home boundary tests. No local defect found.
- [x] 4. Integration items recorded: reportSchemas.ts has no portfolio kind (plan gap: not in any unit file list); app.ts createReportService lacks now/rules (low impact in production).
- [x] 5. tsc --noEmit re-run: EXIT=0. Log: .../phase-2-backend-portfolio-qa/tsc-qa.log
- [x] 6. Report JSON written and parsed (verdict PASS). Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-portfolio-qa.json

## Findings
- F1 medium behavior_change: home/PDF reevaluation instant -> calendar day (followUp.ts reevaluationOf). Spec-backed; owner to confirm "tela do consultor igual". homeRoutes.test.ts 2 boundary tests rewritten to day line (90 on time, 91 late).
- F2 medium integration: server/validation/reportSchemas.ts no 'portfolio' kind; API preview/export 400 for kind portfolio. Not in any unit file list.
- F3 low integration: server/app.ts createReportService({prisma, downloadsDir}) without now/rules.
- F4 low design: overdue actions and high risk are words in one 'Atenção' cell, not separate columns (drawTable phase 1 limit).
- No corrections made (no simple local defect found).

## Verification runs
- verify-1.log: declared command, EXIT=0, 88 passed.
- tsc-qa.log: tsc --noEmit EXIT=0.
- Not run: playwright e2e (portfolioReport.spec.ts, home.spec.ts) - needs frontend units; vite build half; dev-link export check -> verification_not_run, integration.

## Next small action
- Write report JSON (verdict PASS: no critical/high remains; declared verification passes).
