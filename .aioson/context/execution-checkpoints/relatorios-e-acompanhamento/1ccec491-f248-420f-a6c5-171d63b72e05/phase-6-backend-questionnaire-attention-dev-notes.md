# phase-6-backend-questionnaire-attention — dev notes

## Checklist
- [ ] context:brief (must_load)
- [ ] companySchemas.ts: add `aguardando` to ATTENTION_FILTERS
- [ ] portfolioRepository.ts: awaiting questionnaire sends loader
- [ ] portfolioService.ts: awaitingQuestionnaires in ConsultantHomeView + ATTENTION_LISTS entry
- [ ] historyService.ts: draft timeline mark "Respostas do cliente, salvas em {data}"
- [ ] src/api/historyApi.ts: field for draft mark
- [ ] tests/api/questionnaireRoutes.test.ts: add attention/timeline tests (AC-ra-35/48/51)
- [ ] fix companyRoutes test expecting 400 for attention=urgente if broken (not my file -> report)
- [ ] verify: pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/historyRoutes.test.ts
- [ ] write report JSON

## Findings
(none yet)

## Verification logs
dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-backend-questionnaire-attention-dev/

## Decisions (context read done)
- brief loaded; rules: english identifiers, thin routes, queries in repos.
- CONFLICT: homeRoutes.test.ts:653 toEqual exact consultant view (no awaitingQuestionnaires) and historyRoutes.test.ts:233 toEqual exact draft (no clientAnswersSavedAt); both outside my files -> make both new fields OMITTED when empty (optional), report to integration to update tests + drop `?`.
- buildPortfolio keeps 2-3 arg signature (tests call it); 4th param awaitingSends default [].
- portfolioRepository.listAwaitingSends delegates to createQuestionnaireRepository(prisma).listAwaiting().
- historyService: findClientSavedAtByDraft -> draft.clientAnswersSavedAt (omit when null).

## Progress
- DONE edits: companySchemas.ts (aguardando), portfolioRepository.ts (listAwaitingSends via questionnaireRepository), portfolioService.ts (awaitingOf, optional awaitingQuestionnaires, ATTENTION_LISTS.aguardando, read() 4th arg), historyService.ts (clientAnswersSavedAt optional), src/api/historyApi.ts (optional field).
- NEXT: add tests to tests/api/questionnaireRoutes.test.ts (home list, ?attention=aguardando, timeline mark), then run vitest + tsc.

## Final
- Tests added in questionnaireRoutes.test.ts (home list, ?attention=aguardando, timeline mark). vitest 4 files / 185 tests exit 0 (log in runtime dir). tsc exit 1: 3 errors in OwnerHome/ScoreTrend (other unit).
- Report written: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-.../phase-6-backend-questionnaire-attention.json (PASS).
