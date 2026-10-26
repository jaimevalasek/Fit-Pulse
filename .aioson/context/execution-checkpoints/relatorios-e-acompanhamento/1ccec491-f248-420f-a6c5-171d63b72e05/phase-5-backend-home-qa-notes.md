# phase-5-backend-home QA — progress notes (unverified work data, not PASS proof)

## Checklist
- [x] C1 Run verification: `pnpm exec vitest run tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/preferenceRoutes.test.ts` (foreground, log+exit code in phase-5-backend-home-qa/)
- [x] C2 Read unit files for contract match (AC-ra-33/35/36, IF-008, IF-010): portfolioService, homeService, homeApi, companySchemas, companyService, app.ts, companiesApi, tests
- [x] C3 Check implementer claims: app.ts `now: deps.now` to createReportService; attention filter 400 on invalid; archived => []
- [x] C4 Confirm typecheck failures are outside unit (OwnerHome.tsx, ScoreTrend.tsx) — deferred to integration, not a unit defect
- [ ] C5 Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-5-backend-home-qa.json

## Findings so far
- none yet

## Edits made
- none yet

## Verification results
- none yet

## Next small action
- C1: run the unit verification command in foreground, capture to phase-5-backend-home-qa/ dir.

## Slice log
- C1 DONE: unit verification `pnpm exec vitest run tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/preferenceRoutes.test.ts` => 3 files, 182 tests passed, EXIT=0. Log: phase-5-backend-home-qa/unit-verify.log, exit: unit-verify.exit
- C3 DONE (read): companySchemas.ts ATTENTION_FILTERS 5 keys, invalid => 400 via ATTENTION_FILTER_MESSAGE; portfolioService.ts ATTENTION_LISTS Record<AttentionFilter,...> shared with companyService.list (archived under filter => []). app.ts:88 passes now: deps.now to createReportService (signature accepts now). No defect seen.
- Next: C4 typecheck capture to phase-5-backend-home-qa/typecheck.log (run foreground, record exit).
- C4 DONE: `pnpm typecheck` => EXIT=1, exactly 3 TS errors, all in OwnerHome.tsx (HomeTrendPoint import, trend prop) and ScoreTrend.tsx (HomeTrendPoint). None in unit files. Matches implementer report. Deferred to integration (5-frontend-owner-home, wave 10). Log: phase-5-backend-home-qa/typecheck.log, exit: typecheck.exit
- C2 DONE: tests use real createApp with db (not fixtures of parallel impl). Plan line 555 defers aguardando part of AC-ra-35 to phase 6; plan line 312 mentions phase-5 companySchemas edit for aguardando (low divergence, noted as finding).
- Edits made: none. Corrections: none.
- Verdict: PASS (local Done-when passes; no critical/high finding). Next: C5 write report JSON.
