# phase-4-frontend-diary QA notes (lane frontend, wave 9)

## Checklist
- [x] C1 pnpm typecheck -> log in runtime execution-temp .../phase-4-frontend-diary-qa/typecheck.log, exit code recorded
- [x] C2 Unit files: no fetch(), only IF-006 (@/api/diaryApi) and IF-007 (applyDiarySuggestion) imports in diary screens/CalculatorBlock
- [x] C3 Unit files read: MonthField, MoneyField, CompanyDiaryTab, DiaryMonthForm, DiaryCostChart, CompanyTabs, App.tsx, CalculatorBlock, NumbersSummary
- [x] C4 (diary unit suites instead of e2e; e2e not re-run) Run focused e2e (calculator/companies) only if it adds evidence; record result as observation
- [x] C5 (report written, verdict BLOCKED) Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-4-frontend-diary-qa.json

## Findings so far
- C1 typecheck: EXIT=1, 4 TS errors (typecheck.log): server/services/backupService.ts(89,5) [phase-7-backend-backup, concurrent]; src/features/home/OwnerHome.tsx(5,36),(198,35) and ScoreTrend.tsx(1,15) [phase-5-frontend-owner-home, concurrent]. 0 errors in unit files.
- C2 imports: diary screens use @/api/diaryApi + @/api/httpClient(isApiError); CalculatorBlock uses applyDiarySuggestion only; no fetch( in unit files.
- DiaryMonthForm save() redraws via onSaved(view) and CompanyDiaryTab.tsx:202 consumes it; delete at :186 also redraws from response.
- CalculatorBlock.tsx:324 apply() -> applyDiarySuggestion -> onApplied(diagnosis.calculator); generic error copy on failure.
- DiaryMonthForm.tsx:147 payload is spendTotalCents XOR spendParts (exclusive) - OK. Submit at ~153 calls add/updateDiaryMonth.

## Edits made
- none (no unit-file defects found)

## Verification results
- typecheck (first run): EXIT=1, 4 errors (incl. backupService.ts, concurrent phase-7). Rerun: EXIT=1, 3 errors, all in OwnerHome.tsx/ScoreTrend.tsx (phase-5-frontend-owner-home, concurrent). Logs: typecheck.log, typecheck-rerun.log (+ .exit files).
- vitest tests/unit/diary.test.ts tests/unit/diaryPrefill.test.ts: EXIT=0, 65 passed. Log vitest-diary-unit.log.
- Findings for integration: ResultPage.tsx:314 does not pass calculator to NumbersSummary (AC-ra-46 origin not wired). tests/e2e/diary.spec.ts absent.

## Next small action
- Write report JSON with verdict BLOCKED (typecheck blocked by concurrent phase-5-frontend-owner-home files; unit files clean).
