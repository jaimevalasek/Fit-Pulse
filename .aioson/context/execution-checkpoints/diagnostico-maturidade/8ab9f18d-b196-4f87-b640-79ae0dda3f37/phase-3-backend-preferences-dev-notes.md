# phase-3-backend-preferences — dev notes (unverified work data)

## Checklist
- [x] context:brief (rules: English identifiers, thin routes, parameterized data access, file-size/folder design-docs)
- [x] Inspected patterns: server/app.ts (createApp deps {prisma, now, downloadsDir}), companyRoutes/Service/Repository/Schemas, domainError, errorHandler (ZodError->400 validation_failed+fields; DomainError->status/code), tests/api/companyRoutes.test.ts (http server + fetch helper), tests/helpers/testDatabase.ts (createTestDatabase, resetData already clears preference)
- [x] server/repositories/preferenceRepository.ts (generic key/value: readAll, applyChanges{upserts,removals} in one $transaction, activeCompanyExists) — WRITTEN, not yet run
- [x] server/validation/preferenceSchemas.ts (usageMode enum, focusCompanyId string|null, theme enum, tourSeen {owner?,consultant?} booleans; strip unknown keys like companySchemas) — WRITTEN
- [x] server/services/preferenceService.ts (get/update; defaults usageMode null, theme "dark", tourSeen both false; stale/archived focus resolves to null on read; 404 company_not_found on write) — WRITTEN
- [x] server/routes/preferenceRoutes.ts (GET/PUT /api/preferences) — WRITTEN
- [x] server/app.ts mount (import + app.use after report routes) — DONE
- [x] tests/api/preferenceRoutes.test.ts — WRITTEN, not yet run
- [x] Run `pnpm test -- tests/api/preferenceRoutes.test.ts` — 1st run: 3 wrong test expectations (text/null body -> invalid_json from express.json strict; no-body PUT -> 200 empty update); fixed tests; 2nd run exit 0 (15 files / 681 tests pass; `--` makes vitest run whole suite). Log+exit: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-.../phase-3-backend-preferences-dev/preferences-test.{log,exit}
- [x] `pnpm typecheck` exit 0 (typecheck.log/.exit in same dir)
- [x] OBS-3370ac recorded (pnpm test -- <file> runs whole suite)
- [ ] Write report JSON (path in execution contract) — NEXT and last step

## Facts
- prisma model Preference {key @id, value String} map "preferences" already exists + migration 20261023000000_init.
- Frontend contract already in src/api/preferencesApi.ts (other unit): response {usageMode|null, focusCompanyId?: string|null, theme, tourSeen:{owner?,consultant?}}.
- Default theme dark (tokens.css: ink default, [data-theme=light] porcelain).

## Findings
(none yet)
