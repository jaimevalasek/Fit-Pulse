# phase-4-backend-diary-prefill dev notes
## Checklist
- [x] context:brief run; read all source files
- [x] diagnosisSchemas.ts: patch+spendTotalCents; StoredCalculator shape w/ diarySource/diarySuggestion (readStoredCalculator uses it)
- [x] diagnosisService.ts: start (diaries.findMostRecent -> startingCalculator), update (withDiaryState/carryDiaryMarks), applyDiarySuggestion (409 no_diary_suggestion)
- [x] diagnosisRoutes.ts POST /api/diagnoses/:id/diary-suggestion; diagnosesApi.ts applyDiarySuggestion + strips marks in updateDiagnosis
- [x] reportModel.ts: ReportInput.costDiaryOrigin -> "(do diário, medido|estimado)" in numbers page; answers rows get diary mark; total-only spend via resolveSpendCents
- [x] reportService.ts (+buildPeriodDiary exported from evolutionDocument.ts; baseline 4 files PASS 194 tests, log in execution-temp run1.log): pass costDiaryOrigin (always read stored calc) + evolution period.diary (months from month(prev) to month(cur), usable entries, oldest first, cacCents via computeMonthCostCents)
- [x] tests/api/diagnosisRoutes.test.ts: new describe "the diary in block 1" (27 tests PASS, log run2.log)
- [x] tests/unit/reportModel.test.ts: +6 tests (origin, answers marks, total-only, service-level) PASS 51
- [x] tests/unit/evolutionDocument.test.ts: +buildPeriodDiary unit + service-level period diary (32 PASS)
- [x] RESOLVED (diagnosisPatchSchema calculator = stored shape + superRefine refuses marks; backup round-trip test added). Final run of the 4 files: exit 0, 236 tests (execution-temp/final.log+final.exit). Next: regression run of related suites, then write report JSON. RISK was: backupSchemas.ts restores calculator via diagnosisPatchSchema.shape.calculator.unwrap() (strict) -> a backup with diarySource would FAIL restore. Plan: make diagnosisPatchSchema.calculator lenient (stored shape) + superRefine refusing marks in PATCH route; test round-trip. (was: tests evolutionDocument (buildPeriodDiary + service-level period diary) (next; files are CRLF: diagnosisSchemas, reportService, diagnosisRoutes.test, reportModel.test, evolutionDocument.test -> use execution-temp/.../rep.cjs edit() helper): diagnosisRoutes (AC-ra-44/45/46/47), reportModel (origin), evolutionDocument (diary period via service? unit-level), reportRoutes maybe
- [ ] typecheck (pnpm exec tsc --noEmit?) + vitest 4 files; write report JSON
## Findings
- Earlier `node - <<EOF` heredoc did not apply edits; use `node -e` or Edit tool.
- evolutionDocument.ts already renders period.diary (no change needed unless tests reveal).

## Done
- Report written (verdict PASS). Final vitest 4 files exit 0 / 236 tests; regression 12 files exit 0 / 555 tests.
