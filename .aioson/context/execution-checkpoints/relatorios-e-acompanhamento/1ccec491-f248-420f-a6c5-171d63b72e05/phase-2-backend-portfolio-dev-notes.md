# phase-2-backend-portfolio dev notes

## Checklist
- [x] 0. context:brief + read homeService/reportService/evolutionDocument/documentParts/reportCopy/pdfBlocks.drawTable (patterns)
- [x] 1. shared/domain/followUp.ts + tests/unit/followUp.test.ts (14 pass, also TZ NY/Sydney). reevaluationOf(lastAt,today,interval)->{dueDate,daysSince,daysUntil,late,daysLate}
- [x] 2. portfolioRepository.ts (DIAGNOSIS_SUMMARY_SELECT, listActive) + portfolioService.ts (read()->{view,rows}, buildPortfolio, readCompleted, STALE_DRAFT_DAYS, OVERDUE_DIAGNOSIS_DAYS)
- [x] 3. DONE: homeRoutes.test.ts 38 pass (2 boundary tests adapted + midnight test + 5 AC-ra-15 API tests). homeService delegates DONE (tsc ok). homeRoutes: only 2 sub-day boundary tests fail (L584-613) -> DECISION C: RULE-ra-07 calendar-day rule (plan L77); rewrite those 2 tests to day boundary (90 on time / 91 late), add AC-ra-15 portfolio-vs-home test; flag in report. homeService delegates to portfolioService (IF-007 unchanged) + homeRoutes test
- [~] 4. portfolioDocument.ts DONE (buildPortfolioDocument({portfolio,generatedAt,timeZone,brand}); pages cover/by-stage/companies-N/how-to-read; 3-col table; paginate by estimated lines). test DONE: tests/unit/portfolioDocument.test.ts 25 pass (tuned CHARS_PER_LINE=[30,15,15], LIST_ROWS_BUDGET=560; probe: worst case fails only at 640 -> ~75pt margin)
- [x] 5. reportService: PortfolioSelection/ReportRequest local types, preparePortfolio (409 portfolio_empty, carteira-{date}), portfolios.read(at). tsc OK (exit 0)
- [x] 6. forbiddenTerms.test.ts: evolution + portfolio describes added (11 pass)
- [x] 7. run verification (logs under .aioson/runtime/execution-temp/.../phase-2-backend-portfolio-dev/)
- [x] 8. write JSON report

## Findings / locations
- server/services/homeService.ts: buildConsultantView + createHomeData.listPortfolio are what move to portfolioService/portfolioRepository. Exports STALE_DRAFT_DAYS, OVERDUE_DIAGNOSIS_DAYS, types (ConsultantHomeView...) are imported by tests/api/homeRoutes.test.ts -> keep re-exported from homeService.
- tests/api/homeRoutes.test.ts L584-612 pins overdue to an INSTANT boundary (exactly 90*24h on time, +1s overdue, daysSince=floor). RULE-ra-07 is local-calendar. Phase 2 must keep screen equal -> keep instant rule in portfolioService now; followUp.ts holds the local-date functions for Phase 5.
- server/validation/reportSchemas.ts NOT in my allowed files and has no `portfolio` kind (union: diagnosis, evolution). reportService must accept {kind:"portfolio"} -> widen type locally; message integration to add portfolioSelectionSchema.
- GeneratedFileKind already has "portfolio_pdf"; ReportKind already has "portfolio".
- drawTable (pdfBlocks.ts): first column fixed 60% width, others share 40%. 4+ columns too narrow (date breaks mid-word) -> portfolio list uses 3 columns: Empresa | Estágio e último diagnóstico | Atenção. Prototype (.aioson/briefings/.../prototype.html L943-954): cover, "Empresas por estágio", "O que precisa de atenção", Como ler; Atenção tags "Reavaliação atrasada", "N ação vencida", "Risco alto", "Em dia".
- Pages must fit one A4 (PageOverflowError) -> paginate rows by estimated height; prove with renderReportPdf in test.
- forbiddenTerms.test.ts has only diagnosis doc test; add evolution (buildEvolutionDocument) + portfolio.

## Verification
Last runs OK: followUp 14, portfolioDocument 25, forbiddenTerms 11, homeRoutes 38. FINAL: 4-file command exit 0 (88 tests), tsc exit 0, neighbors 249 pass, TZ variants pass; report JSON written (verdict PASS).

## Decision log
- C: lateness = calendar days (followUp.reevaluationOf) in portfolioService; IF-007 shape unchanged, `overdue.daysSince` now calendar days. 30/32 old home tests pass untouched; 2 boundary tests adapted.
- app.ts creates createReportService without `now`/rules (L77) -> message integration to pass now: deps.now.
