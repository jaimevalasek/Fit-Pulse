# phase-1-backend-http notes (unverified work data)
## Checklist
- [x] read contracts: server/db/{databaseUrl,prismaClient}.ts, tests/helpers/testDatabase.ts, shared/domain/types.ts, shared/content/stageContent.ts
- [x] server/services/domainError.ts (DomainError(status, code, message, details?))
- [x] server/http/errorHandler.ts (errorHandler, notFoundHandler, ROOT_FIELD), server/http/requestGuards.ts (requireLocalHost, requireJsonWrites)
- [x] server/services/assistantSummaryService.ts (readAssistantSummary(prisma))
- [x] server/routes/playRoutes.ts (createPlayRoutes({prisma, backendPort}))
- [x] server/app.ts (createApp, resolveBackendPort, DEFAULT_BACKEND_PORT), server/main.ts — written, NOT yet run
- [ ] tests/api/playRoutes.test.ts
- [ ] run `pnpm test -- tests/api/playRoutes.test.ts` (log + exit code in .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-http-dev/)
- [ ] `pnpm typecheck` (tsc) on my files; ad-hoc boot of server/main.ts (temp DATABASE_URL, free BACKEND_PORT), curl health, SIGINT
- [ ] write report JSON at .aioson/context/reports/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-http.json

## Design decisions
- no supertest in package.json -> tests use app.listen(0,"127.0.0.1") + node:http for custom Host
- guard: Host regex ^(127.0.0.1|localhost)(:port)?$ else 403 host_not_allowed (hostname only; port irrelevant to rebinding); POST/PUT/PATCH content-type must be application/json else 415 json_required (header checked directly; req.is returns null on bodyless)
- errors: {error:{code,message,fields?,...details}}; zod -> 400 validation_failed fields{path.joined: first message, "_root" for pathless}; express.json errors -> 413 payload_too_large / 400 invalid_json
- Prisma DB-failure shapes (probed in runtime temp): TypeError "Cannot open database..." (missing dir), DriverAdapterError "file is not a database", PrismaClientKnownRequestError P2021 (no table) -> all 503 database_unavailable
- summary omits companies without completed non-archived diagnosis; lockingDimension = DIMENSIONS[weakest].name (display name); exactly 5 keys
- tests cannot complete a diagnosis via API yet (diagnosisRoutes not built in this wave) -> seed via prisma with typed DiagnosisResult carrying money; deferred to integration: extend with API completion

## Messages to emit in report
- integration: app.ts mount points for companyRoutes/diagnosisRoutes etc.; backup import (10 MB) must mount before global express.json; httpClient must send Content-Type: application/json on ALL writes incl. body-less POST (archive/restore/complete)
- frontend/others: DomainError signature + error body shape + fields format

## Progress (update 2)
- [x] tests/api/playRoutes.test.ts written; isolated `vitest run tests/api/playRoutes.test.ts` => 48 passed, exit 0 (log: $T/vitest-isolated3.log)
- NOTE: `pnpm test -- <file>` => `vitest run "--" file` runs ALL test files (6) => Done-when cmd also runs sibling tests; sibling failures must be reported as findings, not fixed
- Finding for db unit (not mine): server/db/prismaClient.ts connect() leaks the better-sqlite3 handle when PRAGMA script throws (garbage file) -> Windows EPERM on rmSync of the folder; my test uses best-effort cleanup
- NEXT: pnpm test -- tests/api/playRoutes.test.ts (official), pnpm typecheck (filter my files), ad-hoc boot main.ts + SIGINT, flakiness reruns, write report

## Final (update 3)
- Done-when `pnpm test -- tests/api/playRoutes.test.ts` exit 0 (6 files/234 tests); isolated 48 tests x5 runs ok; pnpm typecheck exit 0; ad-hoc boot of main.ts + SIGINT emit ok (exit 0)
- Report written: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-http.json (verdict PASS, 5 findings, 7 messages). Nothing left to do.
