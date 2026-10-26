# phase-1-backend-http QA — progress notes (unverified work data, not authorization or PASS)

Run: diagnostico-maturidade / 8ab9f18d-b196-4f87-b640-79ae0dda3f37 / attempt a8a7ca26-e0e2-4975-a54d-6533e7f28de0
Unit: phase-1-backend-http (lane backend), CAP-dm-play-runtime, AC-dm-41, AC-dm-42, IF-001, IF-010
Done when: `pnpm test -- tests/api/playRoutes.test.ts` passes (note: pnpm forwards `--`, so whole suite runs)
Correction budget: max 3 unit files (server/main.ts, server/app.ts, server/http/requestGuards.ts, server/http/errorHandler.ts, server/services/domainError.ts, server/routes/playRoutes.ts, server/services/assistantSummaryService.ts, tests/api/playRoutes.test.ts)

## Checklist
- [ ] C1 Run verification `pnpm test -- tests/api/playRoutes.test.ts` (log + exit code under runtime/execution-temp/.../phase-1-backend-http-qa/)
- [ ] C2 Read unit files (bounded): app.ts, requestGuards.ts, errorHandler.ts, domainError.ts, playRoutes.ts, assistantSummaryService.ts, main.ts
- [ ] C3 Read test file (bounded) and check AC-dm-41 / AC-dm-42 / IF-001 / IF-010 coverage claims
- [ ] C4 Check the dev-report claims (manual boot, typecheck) only if cheap; typecheck optional
- [ ] C5 Write JSON report at .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-http-qa.json

## Findings so far
- (none yet)

## Edits made
- (none yet)

## Verification results
- (none yet)

## Next small action
- C1: run the unit verification in the foreground, capture to log, record exit code.

## Slice 1 (done)
- C1 DONE: `pnpm test -- tests/api/playRoutes.test.ts` -> exit 0, 7 files / 395 tests (pnpm forwards `--`, whole suite). Log: runtime/execution-temp/.../phase-1-backend-http-qa/verify-unit.log, verify-unit.exit
- Isolated `npx vitest run tests/api/playRoutes.test.ts` -> exit 0, 48/48. Log: verify-isolated.log / .exit
- C2 DONE (read): app.ts (createApp, mounts guards, express.json 1mb, playRoutes, notFound, errorHandler), requestGuards.ts (Host regex, JSON content-type on POST/PUT/PATCH), errorHandler.ts (DomainError/Zod/HTTP-client/DB-503/500), domainError.ts, playRoutes.ts (health, aioson-play, assistant summary), assistantSummaryService.ts (5 fields, latest completed non-archived per company), main.ts (127.0.0.1 listen, SIGINT/SIGTERM shutdown).
- Observations (no defect yet): main.ts & resolveBackendPort read only BACKEND_PORT (no PORT fallback) -> check manifest processes/port_env (rule: PORT || fallback; split-stack also BACKEND_PORT).
- Design note: assistantSummaryService omits a company whose latest completed diagnosis has invalid result/stage instead of falling back to an older one (design choice, not a defect).
- Next small action: C3 map test describe/it names with Grep, then bounded reads of tests/api/playRoutes.test.ts for AC-dm-41/42, IF-001/010.

## Slice 2 (done)
- C3 DONE: tests/api/playRoutes.test.ts read (describe 187-612). AC-dm-41 (aioson-play from manifest, exact routes, existing routes only, BACKEND_PORT) covered; AC-dm-42 (exact 5 fields, latest completed non-archived, excludes draft/archived/no-diagnosis, no money/R$/answers) covered but SEEDED via Prisma, not through API (deferred to integration per implementer). IF-001 503 for 3 broken DB shapes (it.each BROKEN_DATABASES) covered. IF-010 guards: Host 403 (foreign/lookalike/userinfo/LAN/no/empty), 415 json_required, no CORS incl. preflight, 400 invalid_json, 413, 404; error format: DomainError, override protection, Zod fields + _root, 500 no leak.
- C4 DONE: `pnpm typecheck` (tsc --noEmit) -> exit 0. Log: typecheck.log / typecheck.exit
- Cross-unit (verified by reading only, not reproduced): server/db/prismaClient.ts connect() lines 16-18 call super.connect() then executeScript(PRAGMAS) without try/finally -> adapter leak on PRAGMA failure. Belongs to phase-1-backend-db. Low. Not edited.
- manifest.json port_env: frontend PORT, backend BACKEND_PORT -> backend reading only BACKEND_PORT is correct (no defect).
- Defects in unit files: NONE found. Corrections: none. Verdict leaning PASS (medium verification_not_run: AC-dm-42 via API, win32 real signal; integration: build/e2e/smoke/dev-link).
- Next small action: C5 write JSON report to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-http-qa.json

## Slice 3 (done)
- C5 DONE: report written and parses (verdict PASS, 0 corrections, 4 findings: 3 verification_not_run medium, 1 cross_unit low; 4 messages). Run finished. Nothing left to do locally.
