# phase-3-backend-actions-api notes (unverified work data)
started: 2026-10-25
## Checklist
- [ ] context:brief (must_load)
- [ ] read repo/diagnosisRepository + diagnosisService (completeDraft, complete, archive/restore)
- [ ] server/validation/actionSchemas.ts
- [ ] server/services/actionService.ts
- [ ] server/routes/actionRoutes.ts + server/app.ts wiring
- [ ] diagnosisRepository/service: create 3 progress rows in completeDraft tx, inherit
- [ ] src/api/actionsApi.ts
- [ ] tests/api/actionRoutes.test.ts, diagnosisRoutes.test.ts additions
- [ ] run vitest (4 files), log under .aioson/runtime/execution-temp/.../phase-3-backend-actions-api-dev/
- [ ] write report JSON
## Findings
(none yet)
## Findings (2026-10-25)
- Read: diagnosisRepository.completeDraft (tx; build(draft)=>CompletionValues), diagnosisService.complete, historyService (archive/restore by archivedAt), actionProgressRepository (done), shared/domain/actionProgress (done).
- Design: diagnosisRepository.completeDraft build gets (draft, {latestCompleted:{record,progress}|null}) and returns {values, actionProgress:InheritedActionProgress[]}; createMany in same tx. Add listCompletedRecords(companyId) (null if no company).
- actionService: forCompany {current, closed}, forDiagnosis {isCurrent, actions}, update -> 409 plan_closed / 409 diagnosis_not_completed / 404 action_not_found. overdue only when isCurrent.
- Archived diagnoses excluded from company `closed` list (timeline treats them as put away).
- Prisma client already generated incl. ActionProgress. Test helper: tests/helpers/testDatabase.ts; API test pattern: tests/api/historyRoutes.test.ts (startServer/callApi).
## Progress
- DONE (unverified): actionSchemas.ts, actionService.ts, actionRoutes.ts, app.ts wiring, diagnosisRepository (CompletionContext/Completion, listCompletedRecords, createMany in tx; file is CRLF - patched via .cjs in execution-temp), diagnosisService.complete inheritance, src/api/actionsApi.ts.
- NEXT: run `pnpm typecheck` -> log in execution-temp/.../phase-3-backend-actions-api-dev/typecheck.log; then write tests/api/actionRoutes.test.ts and add diagnosisRoutes inheritance tests (diagnosisRoutes.test.ts is CRLF).
- typecheck PASS (exit 0) after impl; log in execution-temp/.../typecheck.log.
- NEXT: write tests/api/actionRoutes.test.ts (G1 plan cac,mp,mm; G2 plan re,dep,mp; copy inputs from diagnosisRoutes.test.ts lines 96-141); then append describe to diagnosisRoutes.test.ts (CRLF! patch via .cjs script) before 'GET /api/assistant/summary' describe. Company delete = POST archive then DELETE.
- actionRoutes.test.ts written; running
- actionRoutes.test.ts 33 pass; diagnosisRoutes.test.ts inheritance describe inserted (CRLF kept); NEXT run 4-file vitest + typecheck, then report
- DONE: Done-when PASS (4 files, 189 tests), typecheck PASS, tests/api all 495 PASS. Report written to .aioson/context/reports/.../phase-3-backend-actions-api.json
