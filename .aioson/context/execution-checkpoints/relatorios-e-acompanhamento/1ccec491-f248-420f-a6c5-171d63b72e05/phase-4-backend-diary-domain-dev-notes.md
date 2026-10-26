# phase-4-backend-diary-domain — dev notes (unverified work data)
Started 2026-10-25. Lane backend. Files: shared/domain/{diary,diaryPrefill,types,unitEconomics,completeness}.ts, shared/format/dates.ts, tests/unit/{diary,dates,unitEconomics,diaryPrefill}.test.ts
## Checklist
- [ ] context:brief + read types/unitEconomics/completeness/dates (bounded)
- [ ] dates.ts + dates.test.ts (MM/AAAA mask, future month)
- [ ] types.ts spendTotalCents/diarySource
- [ ] unitEconomics.ts + completeness.ts accept total; estimated diary counts as estimated
- [ ] diary.ts + diary.test.ts
- [ ] diaryPrefill.ts + diaryPrefill.test.ts
- [ ] run vitest (6 files) -> log in execution-temp dir
- [ ] write report JSON
## Findings
(none yet)
## Discoveries (read-only, done)
- dates.ts ALREADY exists (phase 3: DD/MM/AAAA mask, maskDateInput w/ caret). Extend, don't replace; keep exports/behaviour.
- types.ts CalculatorInput L84-98, EMPTY_CALCULATOR L100 (leave unchanged); UnitEconomics L122.
- unitEconomics.ts: resolveSpend/resolveNewCustomers/combineOrigins; sumSpendParts exported (completeness imports it); roundHalfUp, isCents exported.
- completeness.ts isCalculatorComplete uses sumSpendParts !== null for exact spend.
- Plan: CalculatorInput gets optional spendTotalCents, diarySource {spend?, newCustomers?}, diarySuggestion|null (IF-007). Diary list shape IF-006: entries{month YYYY-MM,newCustomers,spendParts|null,spendTotalCents|null,totalCents,cacCents|null}, progress{count,measuredFrom,measuredTo}, chart[{month,cacCents|null}].
- RULE-ra-08/09 read: 3 most recent annotated months (not nec. consecutive); <3 => avg*3 estimated; 0 => nothing.
## Decisions
- parts win over spendTotalCents when both present (documented); estimated diary origin via diarySource.*.origin
## Progress
- [x] dates.ts: maskDigitsInput refactor + month helpers (maskMonth, maskMonthInput, monthInputToIso, isoToMonthInput, localIsoMonth, isFutureMonth, getMonthError, formatMonthLong/Short, isValidIsoMonth, isRealMonth, MONTH_* messages). dates.test.ts month tests appended. (verify run result below)
- NEXT: types.ts (DiarySource/DiarySuggestion + CalculatorInput optional fields) -> unitEconomics.ts -> completeness.ts -> diary.ts -> diaryPrefill.ts -> tests
- [x] types.ts: DiaryOrigin/DiaryFieldSource/DiarySource/DiarySuggestion + optional CalculatorInput.spendTotalCents/diarySource/diarySuggestion (LF file)
- [x] unitEconomics.ts + completeness.ts patched (CRLF files! patch with CRLF-aware script C:/Users/jaime/AppData/Local/Temp/ue_patch2.mjs; Edit tool ok for LF files): resolveSpendCents exported, exactOrigin() => diarySource.*.origin==="estimated" -> estimated
- Note: reportModel.ts:465/486 and CalculatorBlock.tsx read calculator.spendParts directly -> must handle spendTotalCents (other units; report as message)
- NEXT: diary.ts -> diaryPrefill.ts -> tests (diary, diaryPrefill, unitEconomics additions) -> run vitest 6 files -> report
- [x] diary.ts written (constants DIARY_*, DiaryEntry, diaryEntrySpendCents, isUsableDiaryEntry, computeMonthCostCents, listDiaryEntries, mostRecentDiaryEntries, buildDiaryChart, buildChartSummary, computeDiaryProgress, formatDiaryProgress, computeRecentCost, buildDiaryView, diaryMonthTakenMessage + messages). NOT yet tested.
- NEXT: diaryPrefill.ts (computeDiaryPrefill/applyDiaryToCalculator/applyDiarySuggestion/dropEditedDiaryMarks/isDiarySuggestionOffered + mark labels) -> tests
- [x] diaryPrefill.ts written (computeDiaryPrefill, applyDiaryToCalculator, applyDiarySuggestion, isDiarySuggestionOffered, carryDiaryMarks(before, after), formatDiaryMark, getCostDiaryOrigin, formatCostDiaryOrigin). tsc --noEmit exit 0 (log in execution-temp dir tsc-1.log).
- NEXT: write tests/unit/diary.test.ts, diaryPrefill.test.ts, append unitEconomics.test.ts; run 6-file vitest into execution-temp log; write report JSON
- [x] tests/unit/diary.test.ts + diaryPrefill.test.ts written; vitest on the two: exit 0, 65 passed (log vitest-new.log in execution-temp). (stageGate has no computeStageGate; used evaluateDiagnosis instead)
- NEXT: append describe blocks to tests/unit/unitEconomics.test.ts (total, estimated diary origin, completeness total); run 6-file command; report
- [x] unitEconomics.test.ts: appended describe "the diary's total and estimated numbers" (V1 expectations untouched).
## VERIFIED (logs in .aioson/runtime/execution-temp/.../phase-4-backend-diary-domain-dev/)
- vitest-done-when.log exit 0: 6 files / 353 tests (diary, dates, unitEconomics, diaryPrefill, diagnosisRules, evaluateDiagnosis)
- tsc-2.log exit 0 (tsconfig includes shared+tests); vitest-unit-all.log exit 0: 18 files / 750 tests
## Cross-unit notes for report messages
- reportModel.ts:465/486 + CalculatorBlock.tsx read spendParts only -> need resolveSpendCents/total-only handling
- diaryPrefill: diarySuggestion stays after applyDiarySuggestion; carryDiaryMarks(before, after) is the service merge helper; parts win over spendTotalCents
- NEXT: write report JSON, final message
