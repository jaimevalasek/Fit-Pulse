# phase-1-backend-companies QA notes (run 8ab9f18d)

Unit: CAP-dm-company, AC-dm-07, AC-dm-09, IF-002. Lane backend, wave 4. Reviewer: qa (haiku).
Unit files (only correctable): server/routes/companyRoutes.ts, server/services/companyService.ts, server/repositories/companyRepository.ts, server/validation/companySchemas.ts, server/app.ts, tests/api/companyRoutes.test.ts. Correction budget: 3 files.
Done when / verification: `pnpm test -- tests/api/companyRoutes.test.ts` passes.
Dev report: 55 tests pass in file (pnpm exec vitest run), full suite 494 pass via contract cmd (the `--` forwards to vitest and runs all files). Typecheck pass.

## Checklist
- [ ] 1. Run contract command (foreground), capture log + exit code under runtime execution-temp dir
- [ ] 2. Run file-scoped vitest for companyRoutes.test.ts, capture log + exit code
- [ ] 3. Run pnpm typecheck (if it covers unit), capture log + exit
- [ ] 4. Read unit code bounded: routes, service, validation, repository (AC-dm-07 delete count, AC-dm-09 archive/restore)
- [ ] 5. Check app.ts mount + env PORT rule (no hardcoded port)
- [ ] 6. Write report JSON to reports/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-companies-qa.json

## Findings / evidence (concrete only)
- Contract cmd `pnpm test -- tests/api/companyRoutes.test.ts` => vitest ran ALL 9 files, 494 pass, exit 0 (the `--` is forwarded; a pre-existing script quirk, not a unit defect; report as low note).
- File-scoped `pnpm exec vitest run tests/api/companyRoutes.test.ts` => 1 file, 55 pass, exit 0.
- `pnpm typecheck` => tsc --noEmit, exit 0.

## Runs (foreground, all completed, exit codes captured)
- test-contract.log / test-contract.exit => EXIT=0 (9 files, 494 tests)
- test-file.log / test-file.exit => EXIT=0 (1 file, 55 tests)
- typecheck.log / typecheck.exit => EXIT=0
Log dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-companies-qa/

## Code review (steps 4-5 done, read-only, no edits)
- companyService.ts: remove() 409 if not archived; 0-row delete -> 409; archive/restore idempotent, keep archivedAt; completedCount counts all completed (Diagnosis status enum is only draft|completed, so draft+completed = all rows). OK vs AC-dm-07.
- companyRepository.ts: deleteArchivedWithDiagnoses = $transaction(diagnosis.deleteMany + company.deleteMany, both guarded by archivedAt not null). OK.
- companySchemas.ts: CNPJ stored 14 digits; blank->null; stage/archived query parsing. OK.
- routes: 201 POST, 204 DELETE, errors via shared handler (express 5.3.0 async ok; ZodError -> validation_failed).
- app.ts: mounts createCompanyRoutes after play routes; port via BACKEND_PORT || 3301 (no hardcoded port in use). OK.
- tests/api/companyRoutes.test.ts 602-680: AC-dm-07 cases (409 active, cascade persisted via fresh connection, count before delete, 404 second delete). Covered.
- Deferred to integration (not this unit): e2e tests/e2e/companies.spec.ts not run; frontend completedCount>0 usage (src/api/companiesApi.ts) not checked. One-draft-per-company is not DB-enforced (no unique index); diagnoses unit owns it.

## Defects found: none in unit scope. Corrections: none.

## Status
- Report written: reports/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-companies-qa.json (JSON validated, verdict PASS, 1 finding = verification_not_run e2e medium, 4 evidence, 4 messages to integration).
- Task complete. No next action for this unit.
