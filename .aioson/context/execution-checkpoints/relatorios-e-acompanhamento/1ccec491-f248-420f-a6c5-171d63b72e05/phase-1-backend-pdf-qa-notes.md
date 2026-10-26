# phase-1-backend-pdf QA notes (unverified work data)

## Checklist
- [x] Create checkpoint/temp/report dirs
- [x] Run verification: `pnpm exec vitest run tests/unit/pdfRenderer.test.ts tests/unit/reportModel.test.ts`
  - log: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-pdf-qa/vitest-unit.log
  - exit: vitest-unit.exit (EXIT=0), 2 files / 58 tests passed
- [ ] Read unit files: server/report/pdfRenderer.ts, pdfBlocks.ts, pdfCharts.ts, tests/unit/pdfRenderer.test.ts (bounded reads)
- [ ] Check AC-ra-06, AC-ra-07, AC-ra-08 coverage in code/tests
- [ ] Check PageOverflowError / renderReportPdf(ReportDocument) contract vs reportModel.ts
- [ ] Decide corrections (max 3 files, unit files only) or findings
- [ ] Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-pdf-qa.json

## Findings so far
- Verification command: PASS (exit 0).
- Implementer-reported: server/services/reportService.ts(70,9) TS2739 and reportRoutes tests 500 — outside unit (other unit phase-1-backend-report-api owns it); to be reported as integration dependency, not failure of this unit.

## Next small action
- Read server/report/pdfRenderer.ts (bounded, first 120 lines).

## Slice 2 (read-only review, no edits yet)
- server/report/pdfRenderer.ts:135 renderReportPdf(document: ReportDocument) — one addPage per document.pages, drawPage:89 (title skipped when cover block), riskMatrix+riskList spread at :99; count check :165 throws plain Error; footer text from document.footer.text. Exports PageOverflowError (:30). Reads OK.
- server/report/pdfCharts.ts (191 lines, fully read): drawBar:39 labels threshold, scoreText, hatched fill (drawFill:20) when alertText!==null, drawPill alert; drawRiskMatrix:125 P x I text only when marks<=3, all marks numbered via drawCellMarks:107; drawRiskSpread:183 side by side. No defect seen.
- tests/unit/pdfRenderer.test.ts: describe blocks map to AC-ra-06 (:198), AC-ra-07 (:259), AC-ra-08 (:308), overflow (:380). Assertions are text-extraction based (weak for grayscale; implementer flagged as verification_not_run).
- Not yet read: pdfBlocks.ts (453 lines; check Sheet.require throws PageOverflowError, column(), place()).
- Next small action: grep pdfBlocks.ts for PageOverflowError/require/column; then check reportModel contract (buildDiagnosisDocument) only if needed.

## Slice 3 (final checks, no edits made by QA)
- server/report/pdfBlocks.ts:45-159 read: PageOverflowError:49, Sheet.require:78 throws above CONTENT_BOTTOM, column/place/write/rule OK. No defect.
- tsc --noEmit (re-run now): EXIT=1, single error server/services/reportService.ts(70,9) TS2739 — log .aioson/runtime/execution-temp/.../phase-1-backend-pdf-qa/tsc.log. Outside unit (phase-1-backend-report-api).
- vitest tests/api/reportRoutes.test.ts (re-run now): EXIT=1, 23 failed / 14 passed, "document.pages is not iterable" — same cause, other unit.
- Corrections made by QA: none (no defect in unit files).
- Checks not runnable: grayscale print/rasterize (no PDF rasterizer), e2e export (needs rewired service), pnpm build (needs rewired service).
- Decision: PASS for this unit (Done when passes, no critical/high in unit files). Report integration dependency as medium finding.
- Next small action: write report JSON at .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-pdf-qa.json
