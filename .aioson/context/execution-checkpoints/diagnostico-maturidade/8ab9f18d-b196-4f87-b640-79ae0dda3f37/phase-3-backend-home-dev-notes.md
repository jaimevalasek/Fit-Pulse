# phase-3-backend-home notes
Checklist:
- [ ] context:brief (rules)
- [ ] read app.ts, preferenceService.ts, prisma schema (company/diagnostic), existing routes/services pattern, test helpers
- [ ] homeService.ts (now injected)
- [ ] homeRoutes.ts + mount in app.ts
- [ ] tests/api/homeRoutes.test.ts
- [ ] run `pnpm test -- tests/api/homeRoutes.test.ts` (log in runtime/execution-temp/.../phase-3-backend-home-dev/)
- [ ] write report JSON

## Findings (after 6 reads)
- Pattern: services = createXService({prisma, now, ...}); routes = createXRoutes({x}) (Router); errors via DomainError(status, code, msg) in server/services/domainError.ts; app.ts mounts routes at lines ~50-55.
- preferenceService.get() -> {usageMode, focusCompanyId(active or null), theme, tourSeen}.
- IF-007 (plan line 446): owner: {company, latest?, draft?, trend[]}; consultant: {byStage[1..4], withoutDiagnosis[], staleDrafts[], overdue[], highRisk[]} each item with companyId+name. 400 validation_failed, 404 company_not_found.
- src/api/homeApi.ts does NOT exist yet (frontend lane writing it concurrently) -> I define the contract; report it as message.
- Prisma: Company(archivedAt), Diagnosis(status draft|completed, archivedAt, result Json, stage, completedAt, currentBlock, updatedAt).
- historyService.toDraft uses pendingBlocks(readStoredAnswers, toCalculator) for draft progress.

## Design decisions (made, not yet verified)
- mode required (zod in homeRoutes.ts; 400 validation_failed); companyId optional/blank=absent. Owner fallback: param -> prefs.focusCompanyId -> first active company (createdAt asc) -> else 404 company_not_found. Archived/unknown param -> 404.
- Data access section inside homeService.ts (no repository file allowed). Select shared HOME_DIAGNOSIS_SELECT. Stage from column `stage`, details from frozen `result`.
- Owner: {mode,company{id,name},latest|null{id,completedAt,stage,previous|null,lock,weakestDimension,plan,confidence},draft|null (TimelineDraft shape),trend[{diagnosisId,completedAt,stage,averageScore,rulesVersion}] oldest first}.
- Consultant: {mode,companyCount,byStage[4]{stage,count,companies[{companyId,name,lastDiagnosisAt}]},withoutDiagnosis[],staleDrafts[{..,draftId,updatedAt,idleDays}],overdue[{..,lastDiagnosisAt,daysSince}],highRisk[{..,diagnosisId,signalId,riskScore}]}. Thresholds strict > 7d (draft updatedAt) and > 90d (latest completedAt); high risk = frozen level "high" (>=16 in rules v1).
- Tests: set draft updatedAt via prisma.diagnosis.update (Prisma @updatedAt uses real clock, not injected).
- File limit <300 logic lines ideal.

## Progress
- [x] DONE (unverified): server/services/homeService.ts, server/routes/homeRoutes.ts, server/app.ts (import+mount after preferences)
- [ ] next: typecheck (tsc --noEmit scoped), then write tests/api/homeRoutes.test.ts
- [x] tsc --noEmit exit 0 (service+route+app, before tests)
- [x] tests/api/homeRoutes.test.ts written (validation, owner, consultant incl 7d/90d boundaries, high risk, AC-dm-33 archive/restore)
- [ ] next: run `pnpm test -- tests/api/homeRoutes.test.ts` -> log runtime/execution-temp/.../phase-3-backend-home-dev/home.log + home.exit
- [x] VERIFIED: `pnpm test -- tests/api/homeRoutes.test.ts` exit 0 (note: filter ignored, whole suite ran: 16 files/713 tests); focused `pnpm exec vitest run tests/api/homeRoutes.test.ts` exit 0, 32 tests; tsc --noEmit exit 0. Logs in runtime/execution-temp/.../phase-3-backend-home-dev/ (home-final.log, home-focused-final.log, tsc-final.log + .exit files)
- [x] Mutation check: `>`->`>=` on 7d/90d line made 4 boundary tests fail; reverted (grep confirms no ">= days").
- [x] src/api/homeApi.ts (frontend lane) matches my response shapes exactly.
- [ ] next: write report JSON, stop.
- [x] Accident: unquoted heredoc expanded backticks -> ran `pnpm test:e2e` (no playwright config/tests exist; wrote test-results/.last-run.json) and `pnpm test`; created empty file `=` in root. Both removed (test-results/ and `=`). dist/ was rebuilt at 02:01 by another lane, not by me.
- [ ] next: write report JSON with a QUOTED heredoc (python), then stop.
