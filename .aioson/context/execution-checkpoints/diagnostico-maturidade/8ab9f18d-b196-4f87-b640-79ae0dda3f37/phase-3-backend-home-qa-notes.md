# phase-3-backend-home QA notes (attempt a23c03c0-3a82-4c9f-8ffe-8c673605454a)

Unit: CAP-dm-home; AC-dm-33, AC-dm-34; IF-007. Done when: `pnpm test -- tests/api/homeRoutes.test.ts` passes.
Unit files: server/routes/homeRoutes.ts, server/services/homeService.ts, server/app.ts, tests/api/homeRoutes.test.ts.
Correction budget: max 3 unit files.

## Checklist
- [ ] Read unit files (homeRoutes 40 lines, app.ts 63 lines, homeService 395 lines, test 696 lines — bounded reads)
- [ ] Verify AC-dm-33/34 coverage in tests (indicators, injected clock, filtered data)
- [ ] Run `pnpm test -- tests/api/homeRoutes.test.ts` (foreground, full output to log, exit code file)
- [ ] Run focused `pnpm exec vitest run tests/api/homeRoutes.test.ts` (foreground)
- [ ] Check implementer's claim that `pnpm test -- <file>` runs whole suite (literal `--`)
- [ ] Write report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-.../phase-3-backend-home-qa.json
- [ ] Clean up temp: .aioson/runtime/execution-temp/.../phase-3-backend-home-qa/ is engine-owned; do not leave files in project root

## Findings so far
- (none yet)

## Edits made
- none

## Verification results
- none yet

## Next action
- Read homeRoutes.ts and app.ts (small), then run the Done-when command in foreground.

## Progress (slice 1 done)
- Read homeRoutes.ts (40 lines): zod query validation, delegates to createHomeService; app.ts mounts home routes after preferences (line 58). OK.
- Read homeService.ts 1-395: data access, isReadableResult, consultant portfolio (buildConsultantView ~293-350), strict isOlderThan (7d/90d), owner resolveFocusCompany (explicit -> saved focus -> first active -> 404). No critical defect seen.
- Minor to verify: consultant draft = first draft in portfolio order (line ~308) vs owner findDraft orderBy createdAt asc (line ~186). Check whether one draft per company is enforced.
- Minor to verify: highRisk uses risks.find(level high) assuming stored risks sorted desc by score.
- Done-when run: `pnpm test -- tests/api/homeRoutes.test.ts` exit 0; 16 files / 713 tests (literal `--` runs whole suite). Log: .../phase-3-backend-home-qa/done-when.log, exit file done-when.exit (=0).
- Focused run: `pnpm exec vitest run tests/api/homeRoutes.test.ts` exit 0; 1 file / 32 tests. Log: focused.log / focused.exit (=0).
- Test names listed (32 tests, lines 139-696) cover AC-dm-33/34 API half: strict 7d/90d lines, clock moves, archive/restore, portfolio, high risk.
- Next: check test harness (top of test file lines 1-138: real prisma vs fake), check draft uniqueness, then report.

## Progress (slice 2 done)
- Test harness: real app via createApp + createTestDatabase helper (no fake fixture); injected clock NOW/APRIL/JULY; 32 tests.
- Risks sorted desc by score (shared/domain/riskSignals.ts:73) so highRisk find() is right. Draft uniqueness enforced by repository transaction (diagnosisRepository.ts:83-95), so consultant find() is fine.
- tsc --noEmit: exit 0, no diagnostics (log tsc.log, tsc.exit=0).
- Stray `=` file / test-results: absent from project root (verified).
- Finding (low, deferred interpretation): companies with no completed diagnosis go to withoutDiagnosis only, not overdue (homeService.ts ~319-320). PRD AC-dm-34 wording could include them: confirm with integration.
- Deferred (verification_not_run, medium): e2e for AC-dm-33/34 (no Playwright config / tests/e2e yet); AC-dm-32/35/46/47 out of this unit.
- Edits made: none. Corrections: none. Verdict: PASS (Done-when exit 0; focused exit 0).
- Next: write report JSON at reports/diagnostico-maturidade/8ab9f18d-.../phase-3-backend-home-qa.json, then final message.
- Report written and parsed (verdict PASS). Task complete.
