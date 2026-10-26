# phase-3-backend-preferences — QA notes (unverified work data)

## Checklist
- [x] Notes created; temp dir .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-3-backend-preferences-qa/ created
- [x] Run Done-when `pnpm test -- tests/api/preferenceRoutes.test.ts` in foreground: exit 0, 15 files / 681 tests pass (preferences-test.log/.exit in temp dir). Confirmed `--` runs whole suite.
- [x] Focused `npx vitest run tests/api/preferenceRoutes.test.ts`: exit 0, 1 file / 32 tests pass (focused-vitest.log/.exit)
- [x] `pnpm typecheck`: exit 0 (typecheck.log/.exit)
- [x] Bounded review of unit files vs AC-dm-38 / IF-008: preferenceRoutes.ts, preferenceService.ts, preferenceRepository.ts, preferenceSchemas.ts, app.ts (mount line 55 only), tests/api/preferenceRoutes.test.ts (32 test names checked). No defect observed.
- [x] Corrections: none needed (0 of 3 budget used)
- [x] Write report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-3-backend-preferences-qa.json — verdict PASS, 0 corrections, 4 verification_not_run findings (medium, deferred to integration)
- [x] Final message (only remaining step)

## Facts
- Implementer claims: 681 tests pass, 15 files; `--` forwarded to vitest runs whole suite (OBS-3370ac, package.json outside unit). Confirmed in my run log.
- IF-008 (implementation-plan line 447): 404 company_not_found for focus company missing or archived — implemented on PUT; GET resolves archived/deleted focus to null.
- AC-dm-38 (prd line 300): persistence across reload; backend side covered by "keeps the choices after the app is closed and opened again" test. Real reload e2e is integration's (tests/e2e/settings.spec.ts), not run here.
- Dev notes: .aioson/context/execution-checkpoints/.../phase-3-backend-preferences-dev-notes.md

## Findings
- No unit defect. Verdict PASS.
- Deferred to integration (not run): pnpm test:e2e settings/accessibility specs (AC-dm-38 reload, AC-dm-39, AC-dm-46); Play dev-link check with data/ erased.

## Next action
Write report JSON, then final message.
