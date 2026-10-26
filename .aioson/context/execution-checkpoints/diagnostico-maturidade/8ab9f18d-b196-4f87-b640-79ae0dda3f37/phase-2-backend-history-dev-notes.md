# phase-2-backend-history notes (unit checklist)

Started: 2026-10-23. Temp dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-2-backend-history-dev/

## Checklist
- [x] context:brief for rules (must_load)
- [x] read existing files
- [x] shared/domain/compareDiagnoses.ts (done: compareDiagnoses(previous, current, rules); output previous/current/stageChange/average/dimensions/risksResolved/risksNew/recalculated{fromVersion,toVersion,originalScore{stage,average}})
- [x] tests/unit/compareDiagnoses.test.ts (14 pass via `pnpm exec vitest run <file>`, exit 0; log in temp dir unit-run2.*). NOTE `pnpm test -- <files>` runs ALL suites (literal `--`); full run 11 files/580 tests exit 0
- [x] server/services/historyService.ts (written; in-file createHistoryData for listByCompany/setArchivedAt; archive/restore return TimelineEntry; timeline {draft|null, completed[], archived[]}; compare -> compareDiagnoses w/ app rules)
- [x] server/routes/historyRoutes.ts (written)
- [x] server/app.ts mount (written; shared `const rules`)
- [x] tsc check: `pnpm exec tsc --noEmit` exit 0 (tsc2.exit)
- [x] tests/api/historyRoutes.test.ts (20 tests; focused run3: 2 files/34 tests pass exit 0)
- [x] verify: `pnpm test -- <2 files>` exit 0 (12 files/600 tests; done-when.exit/.log in temp dir)
- [x] write report JSON (.aioson/context/reports/.../phase-2-backend-history.json, verdict PASS; e2e deferred as verification_not_run)
- DONE: nothing left for this unit.

## Discovered (reads done)
- rules brief: english identifiers, thin routes, persistence out of routes, pt-BR user text. No new files beyond allowed list -> history data access lives as in-file repo section in historyService.ts (report as note).
- diagnosisService.ts: private findPrevious(record, completed) + toCalculator (EMPTY_CALCULATOR merge); diagnosisRepository has findById/listCompleted (completedAt desc, id asc, non-archived). DomainError(status, code, msg). Routes factory pattern `createXRoutes({service})`, app.ts mounts after diagnosis routes.
- prisma Diagnosis: archivedAt, status, result JSON, stage, rulesVersion, completedAt.
- Prototype compare notice: avg = Math.round(mean of 8 scores); original = {stage, avg}. Design: recalculated = { fromVersion, toVersion, originalScore:{stage,average} }; previous recalculated with passed `rules` only if versions differ.
- archive/restore return TimelineEntry (DiagnosisView has no archivedAt). Mention in messages.
- Tests: pattern from tests/api/diagnosisRoutes.test.ts (startServer/callApi/G1..G4, createApp({prisma, now, downloadsDir, rules})), fixtures/rulesV2 (pc>=70 for stage 3). G3_PC_67 = stage 3 v1 / 2 v2.

## Findings
(none yet)
