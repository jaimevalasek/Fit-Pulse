# phase-2-backend-evolution dev notes
Checklist (update after each slice):
- [ ] context:brief (rules must_load)
- [ ] read historyService, compareDiagnoses, reportService, reportSchemas, reportModel/documentParts (bounded)
- [ ] historyService.comparePair(fromId,toId)
- [ ] shared/content/comparisonCopy.ts (recalc notice fn)
- [ ] server/validation/reportSchemas.ts evolution selection
- [ ] server/report/evolutionDocument.ts
- [ ] reportService evolution + filename {empresa}-evolucao-{de}-a-{ate}.pdf
- [ ] tests/unit/evolutionDocument.test.ts (AC-ra-12/13, uses tests/fixtures/rulesV2.ts)
- [ ] run vitest (log in .aioson/runtime/execution-temp/.../phase-2-backend-evolution-dev/)
- [ ] write JSON report
Findings: (none yet)

## Findings (read phase done)
- history: historyService.compare(id) uses findPrevious+toComparable+compareDiagnoses(rules). Add comparePair(fromId,toId) here (DomainError codes 404/409).
- Document builders in server/report/reportModel.ts (buildDiagnosisDocument) use documentParts.ts: buildCoverPage/buildFooter/buildHowToReadPage/resolveBrand; copy in reportCopy.ts (NOT mine; put evolution copy inside evolutionDocument.ts/comparisonCopy.ts).
- reportService.prepare() switch on selection.kind; add "evolution". reportSelectionQuerySchema preprocess only maps includeAnswers.
- existing test reportRoutes: kind=evolution&diagnosisId=x must stay 400 validation_failed (needs fromId/toId).
- ComparePage.tsx has recalculation notice text + DELTA_WORDS/STAGE_MOVES: copy into shared/content/comparisonCopy.ts (frontend lane must adopt -> message to integration).
- app.ts builds reportService w/o rules; default to rulesV1 in reportService deps (rules?: Rules).
- Need previous recalculated result for cost/lock: plan to export helper from compareDiagnoses.ts.

## Design decisions
- compareDiagnoses.ts: add compareWithResults() -> {comparison, previousResult}; compareDiagnoses = .comparison (no behavior change)
- historyService.comparePair(fromId,toId) -> ComparedPair {companyId, comparison, previous/current sides w/ stored+compared result}; errors 404/409 (other company, archived, order)
- Pages: cover, "Antes e depois" (keyNumbers, lock facts, notice), 2 bar pages (fit/front; paired antes/depois bars; 8 bars/page fits A4), optional "O que foi feito no periodo" (actions + diary table, cap DIARY_CHART_MONTHS), como ler
- No new block kinds possible (reportDocument.ts / pdfCharts not mine). Diary storage not in schema (Phase 4) -> service passes no diary; actions from actionProgressRepository.findByDiagnosis(fromId) only rows with real tracking.
- reportService gets optional rules (default rulesV1); app.ts not mine -> message to integration to pass rules.

## Progress
- DONE: compareDiagnoses.ts (compareWithResults), comparisonCopy.ts, historyService.comparePair (errors different_companies/diagnosis_archived/comparison_out_of_order), reportSchemas evolution selection.
- NEXT: server/report/evolutionDocument.ts, reportService evolution, tests/unit/evolutionDocument.test.ts, run vitest.
- DONE: reportService.ts evolution wiring written (prepareEvolution/toPeriodActions). NEXT: tsc log at .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-evolution-dev/tsc.log, then tests/unit/evolutionDocument.test.ts
- FINDING: U+2192 (arrow right) missing in all 4 PDF fonts (checked with fontkit) -> PDF must not print '→'; use ' para '. Also tsc --noEmit exit 0 after wiring.
- DONE: tests/unit/evolutionDocument.test.ts written (pure + service describe). NEXT: run it: log .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-evolution-dev/evolution.log exit .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-evolution-dev/evolution.exit
- VERIFIED: done-when vitest (3 files, 113 tests) exit 0 (.aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-evolution-dev/done-when.log); tsc exit 0. NEXT: neighbours (compare/forbidden/pdfRenderer), then JSON report.
- FINAL: report JSON written (verdict PASS). Unit complete.
