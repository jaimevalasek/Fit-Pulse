# phase-1-backend-companies notes
Checklist:
- [x] read existing server/app.ts, errorHandler, domainError, prisma schema, test helper, frontend api (src/api/companiesApi.ts)
- [x] server/validation/companySchemas.ts
- [x] server/repositories/companyRepository.ts
- [x] server/services/companyService.ts
- [x] server/routes/companyRoutes.ts + wired in server/app.ts (createCompanyRoutes after createPlayRoutes)
- [x] tests/api/companyRoutes.test.ts (55 tests)
- [x] run `pnpm test -- tests/api/companyRoutes.test.ts` (logs in .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-companies-dev/)
- [x] tsc check of my files (pnpm typecheck; other units' errors are not mine)
- [x] write report JSON at .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-companies.json

## Facts
- createApp(deps{prisma,now,downloadsDir,backendPort}); DomainError(status, code, msg, details); errorHandler: ZodError -> 400 validation_failed {fields: path->first message, root key "_root"}
- Test pattern: tests/api/playRoutes.test.ts (createTestDatabase from tests/helpers/testDatabase.ts; Host must be 127.0.0.1/localhost; writes need content-type application/json even without body)
- Frontend (concurrent unit) expects: list = array, DELETE 204, full-replace PATCH with nulls, delete count = completedCount + (draftId ? 1 : 0)

## Decisions
- empty optionals -> null in response; PATCH = full replace (same schema as POST); archive/restore idempotent; completedCount = ALL completed diagnoses incl. archived; latestStage = latest completed non-archived; DELETE -> 204 (409 company_not_archived when active)
- q search in service (accent/case-insensitive); stage filter via computed latestStage; delete = single $transaction deleteMany diagnoses + company, both conditioned on archivedAt not null
- cnpj stored 14 digits; masked input accepted; letters/!=14 digits/bad check digit -> CNPJ_INVALID_MESSAGE

## Messages for integration (to put in report)
- completedCount semantics (includes archived completed diagnoses)
- app.ts now builds createCompanyService({prisma, now}) and mounts createCompanyRoutes

## Result
- test-run1 exit 0 (whole suite 494 tests, "--" forwarded), test-run2 exit 0 (55 tests, file alone), typecheck exit 0. Report written. DONE.
