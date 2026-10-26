# phase-1-backend-diagnoses dev notes
## Checklist
- [x] read app.ts, company* (route/service/repo/schemas), domainError, errorHandler, testDatabase, prisma schema, types, completeness, evaluateDiagnosis, src/api/diagnosesApi.ts (frontend shape)
- [ ] diagnosisSchemas.ts (answers/calculator patch via superRefine per-key issues; cents cap = MONEY_MAX_CENTS from shared/format/money.ts)
- [ ] diagnosisRepository.ts (start draft in tx; conditional updateMany status=draft)
- [ ] diagnosisService.ts (rules injectable, default rulesV1; view = IF-003 + createdAt/completedAt extras)
- [ ] diagnosisRoutes.ts + wire in app.ts (AppDependencies.rules?: Rules)
- [ ] tests/api/diagnosisRoutes.test.ts (G1..G4 inputs copied from tests/unit/evaluateDiagnosis.test.ts; v1/v2 divergence: G3 + pc1..3=2 -> v1 stage 3, v2 stage 2; import rulesV2 from tests/fixtures/rulesV2)
- [ ] run `pnpm test -- tests/api/diagnosisRoutes.test.ts`; logs in .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-diagnoses-dev/
- [ ] write report JSON at .aioson/context/reports/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-diagnoses.json
## Decisions
- POST start: 201 new / 200 existing draft; company archived -> 409 company_archived (my addition, flag to integration)
- PATCH merges answers per key; calculator top-level keys merge (spendParts replaced wholesale)
## Progress (update 2)
- DONE (typecheck exit 0): server/validation/diagnosisSchemas.ts, server/repositories/diagnosisRepository.ts (tx start/edit/complete), server/services/diagnosisService.ts, server/routes/diagnosisRoutes.ts, server/app.ts (rules?: Rules dep, default rulesV1)
- tests/api/diagnosisRoutes.test.ts written; NEXT: run it (log -> runtime temp dir diagnosisRoutes.log/.exit), fix failures
- Decision: no archived-company guard on POST start (PRD doesn't specify); extra view fields createdAt/completedAt (additive)
## Progress (update 3) - DONE
- `pnpm test -- tests/api/diagnosisRoutes.test.ts` exit 0 (log+exit in runtime temp dir; whole suite runs: 10 files / 564 tests). Own file alone: 70 tests, 6 repeated runs green.
- `pnpm typecheck` exit 0; `node scripts/smoke-boot.mjs` PASS.
- Report JSON written next; nothing left to implement.

## ROUND 1 REWORK (reviewer findings) - checklist
- [ ] F1 critical: body-less POST -> 415 (guard server/http/requestGuards.ts + client src/api/httpClient.ts:81 omit Content-Type). Both OUTSIDE my allowed files -> reproduce w/ test, message integration (fix: httpClient always sends Content-Type on writes)
- [ ] F2 low: readStoredAnswers/readStoredCalculator return {} on any invalid key -> autosave drops answers. Fix tolerant per-key read + test
- [ ] F3 low: startDraft on archived company (decide using companyService conventions / PRD)
- [ ] rerun `pnpm test -- tests/api/diagnosisRoutes.test.ts`, typecheck; write r1 report at reports/.../phase-1-backend-diagnoses.r1.json
- R1 F2 DONE: diagnosisSchemas.ts readAnswer() shared by schema+readStoredAnswers; readStoredCalculator per-key via calculatorPatchSchema.shape; 2 new tests in PATCH describe (red first: f2-red.log, then green). Full file 72 tests exit 0 (diagnosisRoutes-r1.log/.exit), typecheck exit 0.
- R1 F1 plan: keep suite GREEN (pnpm test runs the whole suite for sibling units, a red test of mine would contaminate them). Repro with probe in runtime temp (real src/api/httpClient.ts + real createApp). Fix owner = integration: src/api/httpClient.ts request() must send Content-Type on POST/PUT/PATCH even with no body; same bug hits companiesApi archive/restore. Fix callApi comment (it claimed to mirror client).
- R1 F3 decision: keep (PRD silent); surface to integration w/ recommendation (409 company_archived only when no open draft exists).
- R1 DONE: callApi comment made truthful; final `pnpm test -- tests/api/diagnosisRoutes.test.ts` exit 0 (566 tests), typecheck 0, smoke-boot PASS; client-probe.log reproduces F1 (415 on body-less POST via real httpClient). Report written: reports/.../phase-1-backend-diagnoses.r1.json (verdict PASS locally; F1 critical open for integration: src/api/httpClient.ts). Nothing left.
