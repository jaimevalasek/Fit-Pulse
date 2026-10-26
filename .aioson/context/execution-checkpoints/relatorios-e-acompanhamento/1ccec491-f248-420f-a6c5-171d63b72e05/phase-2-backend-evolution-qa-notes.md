# phase-2-backend-evolution QA notes (lane backend, wave 5)

Unit: CAP-ra-evolution-report, AC-ra-12, AC-ra-13, IF-001, IF-004
Verification: `pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/api/historyRoutes.test.ts tests/api/reportRoutes.test.ts`
Correction budget: 3 files, unit files only.
Report: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-evolution-qa.json

## Checklist
- [x] C1 Run verification command (foreground), save log + exit code under runtime/execution-temp/.../phase-2-backend-evolution-qa/ -> PASS exit 0 (3 files, 113 tests, 44.8s). log: verify-unit.log, exitcode: verify-unit.exitcode
- [ ] C2 If fail: locate defect in unit files only (<=3 files), fix, rerun
- [ ] C3 Review unit files vs AC-ra-12 (evolution page/sheet structure, pairs before/after), AC-ra-13 (same notice/copy as compare), IF-001 routes/validation, IF-004
- [ ] C4 Confirm implementer deferred items are reported (not fail): playwright e2e, forbiddenTerms evolution case, diary (phase 4)
- [ ] C5 Write JSON report (version=1 ... verdict, findings[], evidence[], messages[])

## Findings / edits
- AC source: .aioson/context/execution-prompts/relatorios-e-acompanhamento/phase-2-backend-evolution.md (table row AC-ra-12/13/14, line ~67-70).
  AC-ra-12 wants: capa; "Antes e depois" (estágio antes → depois, custo/cliente, média 8 dimensões, trava antes/agora, barras antes/depois com diferença escrita); "O que foi feito no período" (part 2, only with andamento or diário, else page absent); "Como ler".
- Implementer deviations (review, not fail): (a) "→" replaced by "para" (no U+2192 glyph in PDF fonts) = low; (b) "Antes e depois" spans 3 sheets = low. Both reported in messages/findings, not blocking.
- Deferred (integration, not this unit): playwright report.spec/history.spec, forbiddenTerms evolution case, diary (phase 4 period.diary).
- Read OK (no defect so far): reportSchemas.ts evolutionSelectionSchema (lines 21-37, ids required, trim, max 64); reportService.ts prepareEvolution (~207-238, uses comparePair, stored plan, fileKind evolution_pdf, stem '-evolucao-'); historyService.ts refusal factories (~96-145) and comparePair (~322-337: same company, archived, isOlder); compareDiagnoses.ts compareWithResults (~132+).
- OK: isOlder (historyService ~197) same id -> not older -> 409 comparison_out_of_order. requireCompleted ~267.
- OK: evolutionDocument.ts read 1-319 fully. Pages: cover, before-after, before-after-fit, before-after-front, period (null unless actions/diary), how-to-read. Numbers from comparison + previousResult/currentResult.
- LOW finding (candidate, maintainability): evolutionDocument.ts:169 and :194 hard-code rulesV1.dimensionSupport.warnBelow for bar threshold text while belowWarning flag uses passed rules (dimensionScores.ts:80). Same pattern in reportModel.ts:335. No live defect: rulesV2 fixture and rulesV1 share warnBelow=50. Report low, do not fix (reportModel outside unit).
- Still to check: toPeriodActions in reportService (sem andamento rule), comparisonCopy.ts quick read, reportService.ts line 245+ (export name / record).

## Verification log
- verify-unit (Done when cmd): exit 0, "Test Files 3 passed (3), Tests 113 passed (113)".

- verify-unit re-run: not needed (no corrections made).
- Static review done: reportSchemas, reportRoutes (preview uses query schema, export uses body schema), reportService prepareEvolution + toPeriodActions (status mapping consistent with isActionOverdue), historyService comparePair + refusals, compareWithResults, evolutionDocument.ts (all 319 lines), comparisonCopy.ts, generatedFileRepository (evolution_pdf kind present).
- Corrections: none. Findings: 2 verification_not_run (playwright e2e; forbiddenTerms evolution case) medium deferred to integration; diary half of AC-ra-12 deferred to phase 4 (medium); low: "→" -> "para"; 3-sheet before/after; warnBelow hard-coded rulesV1 (latent).
- Verdict decided: PASS (no critical/high remains).

## Next small action
C5: write JSON report at .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-evolution-qa.json, then final message.
