# integration-supervisor QA notes (wave 14)

Run: 8ab9f18d-b196-4f87-b640-79ae0dda3f37 · attempt eab155f1-73bc-46fc-8015-a961be830fef
Report target: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/integration-supervisor-qa.json
Log dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/integration-supervisor-qa/

Note: these notes are unverified work data, not authorization or PASS proof.

## Checklist (verification, all foreground, log + exit file per command)

- [x] V1 pnpm build -> exit 0 (chunk-size warning only). log v1-build.log
- [x] V2 node scripts/smoke-migrate.mjs -> exit 0 PASS. log v2-smoke-migrate.log
- [x] V3 node scripts/smoke-boot.mjs -> exit 0 PASS. log v3-smoke-boot.log
- [x] V4 node scripts/smoke-store-package.mjs -> exit 0 PASS. log v4-smoke-store-package.log
- [x] V5 pnpm test -> exit 0, 17 files / 757 tests passed. log v5-unit-api.log
- [x] V6 pnpm test:e2e -> exit 0, 52 passed (4.0m). log v6-e2e.log
- [ ] V7 pnpm typecheck
- [ ] Review: integration fixes INT-01..INT-05 (package.json dev script, global.css @source, Questionnaire/BlockRail grid, tokens.css contrast, touch targets) read against contract
- [ ] Deferred manual (not blocking): dev-link in Play, export from Play webview, no-data open via Play, AC-dm-27 timing on ordinary Windows, AC-dm-44 LAN, AC-dm-45 store update, private publication

- [x] V7 pnpm typecheck (tsc --noEmit) -> exit 0. log v7-typecheck.log
- [x] Review INT-02 @source/source(none) in src/styles/global.css; shared/ and index.html have no Tailwind utility classes (grep), so narrowed scan drops nothing.
- [x] Review INT-01 dev script = `tsx server/main.ts` (no watch); playwright webServer = `pnpm dev`, so e2e exercised the dev path.
- [x] Review INT-03/04/05 present: QuestionnairePage grid-cols-[minmax(0,1fr)], tokens.css contrast values, min-h-(--touch) on listed links.

## Findings so far
- LOW dev-loop: `pnpm dev` no longer restarts the API on server edits (INT-01 trade-off). Not a verification failure.
- LOW AC-dm-31: recalculation notice for differing rules versions is not on-screen in v1-only build; covered by unit/api tests only (INT-09).
- INFO INT-06: `pnpm test -- <files>` and `pnpm test:e2e -- <spec>` run full suites (superset); no failure.

## Corrections made
- none (no QA fixes needed; all verification passed as run)

## Verification results
- V1 build exit 0; V2 smoke-migrate exit 0; V3 smoke-boot exit 0; V4 smoke-store-package exit 0
- V5 unit/api 17 files, 757 tests exit 0; V6 e2e 52 passed exit 0; V7 typecheck exit 0
- Deferred manual (not blocking, per done-when): Play dev-link badge, no-data open via Play, export from Play webview, AC-dm-27 timing on ordinary Windows, AC-dm-44 LAN, AC-dm-45 store update via real store, private publication.
- Not rerun by QA: aioson harness:check (dev evidence only); it re-runs the same build/tests.

## Next small action
- Write report JSON to .aioson/context/reports/... integration-supervisor-qa.json; verdict PASS.
