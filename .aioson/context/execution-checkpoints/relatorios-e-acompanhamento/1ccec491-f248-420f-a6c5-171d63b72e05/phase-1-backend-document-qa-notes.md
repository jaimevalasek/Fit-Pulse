# phase-1-backend-document QA notes

Run: relatorios-e-acompanhamento / 1ccec491-f248-420f-a6c5-171d63b72e05
Attempt: dd212abf-8b5b-4657-b48b-d9c090fe5662

## Checklist
- [ ] Locate unit files (9 files) and confirm they exist
- [ ] Run Done-when verification (vitest, 3 files) -> capture log + exit code
- [ ] Read unit code against AC-ra-05/09/10/11/23 (bounded reads)
- [ ] Check deferred items (not in scope): pdfRenderer, reportRoutes, e2e
- [ ] Decide corrections (max 3 unit files), re-run verification if any
- [ ] Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-document-qa.json

## Findings so far
- (none yet)

## Verification log
- (none yet; log dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-document-qa/)

## Next action
- Run vitest verification in foreground, capture to log dir.
- vitest unit (3 files): EXIT 0, 50 tests passed; log in .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-document-qa/vitest-unit.log
- reviewed: confidenceText.ts + test OK (AC-ra-23); reportCopy texts match PRD Conteudo v2 (lines 341-352); reportModel buildDiagnosisDocument/answers/summary read OK. Candidate defect: progressTag applies overdue to any status (done/notApplicable too) -> BR-ra-11 says only todo/doing
- FIX 1 (reportModel.ts progressTag): overdue only when status todo/doing (RULE-ra-06). Test added in reportModel.test.ts action tracking block ('never marks a done action as overdue'). Re-run: EXIT 0, 51 tests; log vitest-unit-after-fix.log

## Review result (attempt dd212abf)
- tsc --noEmit: EXIT 0 (log phase-1-backend-document-qa/tsc.log)
- Final vitest unit (3 files): EXIT 0, 51 tests (after fix)
- Findings: (a) deferred PDF checks for pdfRenderer (sibling unit phase-1-backend-pdf) -> integration; (b) status vocabulary mismatch: ReportActionStatus todo|doing|done|notApplicable vs domain ACTION_STATUSES todo|in_progress|done|not_applicable -> integration must map; (c) v1 server/report/pdfRenderer.ts:248 still prints "limitado pela dimensão mais fraca" until pdf unit replaces it -> integration gate for AC-ra-10
- Corrections: server/report/reportModel.ts (progressTag overdue guard), tests/unit/reportModel.test.ts (regression test)
- Next action: write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-backend-document-qa.json
