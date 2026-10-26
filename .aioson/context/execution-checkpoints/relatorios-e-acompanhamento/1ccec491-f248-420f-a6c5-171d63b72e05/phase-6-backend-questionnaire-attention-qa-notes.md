# QA notes — phase-6-backend-questionnaire-attention (lane backend)

Unverified work data. Current code and execution contract win.

## Checklist
- [x] Create run-scoped temp dir and report dir
- [x] Run unit verification (vitest 4 files) — PASS locally, see Evidence
- [ ] Review unit files (portfolioRepository, portfolioService, historyService, companySchemas, historyApi, questionnaireRoutes.test)
- [ ] Check implementer deviation: awaitingQuestionnaires / clientAnswersSavedAt optional (IF-008 / IF-011)
- [ ] Check cross-unit claims (questionnaireRepository listAwaiting / findClientSavedAtByDraft exist)
- [ ] Decide corrections (budget 3 unit files) — none so far
- [ ] Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-backend-questionnaire-attention-qa.json

## Evidence
- Command: pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/historyRoutes.test.ts
- Log: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-backend-questionnaire-attention-qa/vitest-run1.log
- Exit code file: .../phase-6-backend-questionnaire-attention-qa/vitest-run1.exit (EXIT_CODE=0)
- Result: Test Files 4 passed (4); Tests 185 passed (185)

## Findings so far
- portfolioService.ts awaitingOf (~L202-221) + buildPortfolio (~L223-306) + ATTENTION_LISTS.aguardando (~L315): read OK; awaiting omitted when empty (~L301).
- portfolioRepository.ts listAwaitingSends (~L58) -> questionnaireRepository.listAwaiting: exists (questionnaireRepository.ts L58, L75).
- companySchemas.ts ATTENTION_FILTERS (L83-90) includes "aguardando": OK.
- historyService.ts toDraft (~L243-254): clientAnswersSavedAt omitted when null.
- CONTRACT (implementation-plan-relatorios-e-acompanhamento.md L705 IF-008, L708 IF-011): IF-011 says `draft.clientAnswersSavedAt | null` (null value expected, key present); IF-008 says `awaitingQuestionnaires[]`. Implementer deviation (omit when empty) is real. Blocked by homeRoutes.test.ts (toEqual exact view) and historyRoutes.test.ts (toEqual exact draft), both OUTSIDE unit files -> cannot fix in this unit. Report as medium finding + integration message.
- Unit verification: PASS (185/185).

## Investigation calls used (since last checkpoint): ~10 — next slice must be small.

## Corrections made
- none (unit code correct; only deviation is contract shape, which needs out-of-unit test edits)

## Verification after review
- tsc --noEmit: exit 0, 0 errors (log tsc-run1.log, exit tsc-run1.exit)
- Playwright e2e and Play dev-link: NOT run (frontend units in flight; Play runtime) -> reported as verification_not_run, medium

## Report
- Written: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-backend-questionnaire-attention-qa.json
- Verdict: PASS (no critical/high). Findings: 2 medium contract_deviation (optional shape vs IF-008/IF-011), 2 medium verification_not_run.

## Next action
- None for this unit. Work complete; final message only.
