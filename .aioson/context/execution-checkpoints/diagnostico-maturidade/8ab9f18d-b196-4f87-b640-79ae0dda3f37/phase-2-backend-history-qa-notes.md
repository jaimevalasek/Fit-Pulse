# phase-2-backend-history QA notes (attempt 3fdf870d)

## Checklist
- [ ] Run Done-when command: `pnpm test -- tests/unit/compareDiagnoses.test.ts tests/api/historyRoutes.test.ts` (log in temp dir, exit code saved)
- [ ] Run focused: `pnpm exec vitest run tests/unit/compareDiagnoses.test.ts tests/api/historyRoutes.test.ts` (log + exit code)
- [ ] Read unit files against AC-dm-30 / AC-dm-31 / IF-005 (bounded reads)
- [ ] Check implementer messages (timeline shape, archive/restore 409/404, comparison 409 no_previous_diagnosis)
- [ ] Write report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-2-backend-history-qa.json

## Runs
- Temp dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-2-backend-history-qa/
- Execution mode: foreground only (session is unattended)

## Verified slices
- Done-when cmd (pnpm test -- ...): exit 0, 12 files / 600 tests (filter dropped by literal --). Log: phase-2-backend-history-qa/done-when.log, exit: done-when.exit
- Focused cmd (pnpm exec vitest run ...): exit 0, 2 files / 34 tests. Log: focused.log, exit: focused.exit
- Read shared/domain/compareDiagnoses.ts (152 lines): recalculation only when rulesVersion differs; originalScore kept from stored result; pure. OK.
- Read server/routes/historyRoutes.ts (33) and server/app.ts (54): thin delegation; rules injected once. OK.
- Read server/services/historyService.ts (267): listCompleted filters archivedAt null (diagnosisRepository.ts:70-75), so compare/canCompare use non-archived list as documented. changeArchiveState idempotent. OK.

- tests/api/historyRoutes.test.ts uses createApp + createPrismaClient(db.databaseUrl): real DB, not mocks. 20 tests incl. recalculation (line 507). OK.
- tests/unit/compareDiagnoses.test.ts 167-229: originalScore average pinned from stored result; recalculation from answers; no mutation. OK.
- tsc --noEmit: exit 0, 0 lines (phase-2-backend-history-qa/tsc.log, tsc.exit).
- Tie-break parity: historyService.ts findPrevious == diagnosisService.ts:124 (same rule).
- Implementer messages on IF-005 shape/status codes checked against code: match (draft null, 409 diagnosis_not_completed, 404 diagnosis_not_found, 409 no_previous_diagnosis).

## Findings
- LOW maintainability: findPrevious/toCalculator in historyService.ts duplicate diagnosisService.ts private ordering; must stay in sync (no shared export).
- LOW process: `pnpm test -- <files>` drops filter (literal --) so Done-when runs whole suite (package.json script). Focused run used.
- MEDIUM verification_not_run: `pnpm test:e2e -- tests/e2e/history.spec.ts` (capability check, depends on frontend lane). Deferred to integration.
- No critical/high findings.

## Corrections made
none (no defect found in unit files)

## Next small action
Write report JSON (verdict PASS) to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-2-backend-history-qa.json and stop.
