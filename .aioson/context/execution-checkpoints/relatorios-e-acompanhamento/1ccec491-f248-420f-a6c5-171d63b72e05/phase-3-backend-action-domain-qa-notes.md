# QA notes — phase-3-backend-action-domain (lane backend, wave 2)

Run: 1ccec491-f248-420f-a6c5-171d63b72e05 · attempt 74a609f9-dd21-49de-8dd4-dd3e4e3a6e0e
Status: work data only, not proof of PASS. Final verdict lives in the JSON report.

## Checklist
- [x] C1 prisma validate — exit 0 (initial and after fix)
- [x] C2 vitest actionProgress + dates — exit 0, 32 passed (initial and after fix)
- [x] C3 node scripts/smoke-migrate.mjs — exit 0, PASS 5/5 (initial and after fix)
- [x] C4 read unit source: actionProgress.ts, dates.ts, actionProgressRepository.ts, actionProgressOptions.ts, actionPlan.ts (head), schema ActionProgress model, migration.sql — consistent with each other
- [x] C5 test names reviewed via grep; coverage matches AC-ra-31 (repeated/new/closed) and RULE-ra-04/05/06
- [x] C6 judged findings; one local correction made
- [x] C7 re-ran verification after correction — all green
- [ ] C8 write JSON report to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-3-backend-action-domain-qa.json

## Findings
- F1 (fixed): shared/domain/actionProgress.ts isActionOverdue(today: string) incompatible with localIsoDate(): string|null that the implementer's contract message tells integration to pass. Widened to `string | null`, added explicit `today === null` guard (isValidIsoDate is not a type guard). Behaviour unchanged: null/invalid today → false.
- F2 (pre-existing, other unit): `tsc --noEmit` exit 1 on server/services/reportService.ts(70,9) TS2739 ReportModel vs ReportDocument (kind, subject, footer, pages). reportService imports server/report/pdfRenderer.ts — owned by phase-1-backend-pdf (implementing). Not this unit's file; re-run gave same error. Report to integration; no edit.
- F3 (low, not blocking): repository behaviour (upsert, P2002 race, cascade, SetNull) verified only by an implementer throwaway script, not committed. No committed test for the repo layer in this unit.
- F4 (low, not blocking): scripts/smoke-migrate.mjs does not seed/compare action_progress rows (outside unit files).
- F5 (note to integration): repository save(patch) writes values unvalidated; read path normalizes. API validation (actionSchemas) must enforce ACTION_STATUSES / dates.
- Deferred checks not run by QA (capability-wide, belong to integration): tests/api/actionRoutes.test.ts, tests/api/diagnosisRoutes.test.ts inheritance cases, tests/unit/reportModel|evolutionDocument|portfolioDocument, pnpm build, playwright e2e actions/result/history, Play dev-link walkthrough.

## Edits made
- shared/domain/actionProgress.ts: isActionOverdue `today: string | null`; guard `today === null ||`. (1 file of 3 budget)

## Verification results (final)
- prisma validate exit 0 (final-prisma-validate.log)
- vitest unit exit 0, 2 files / 32 tests (final-vitest-unit.log)
- smoke-migrate exit 0 PASS (final-smoke-migrate.log)
- tsc --noEmit exit 1 only on reportService.ts (F2); no errors in unit files (final-tsc.log)

## Next small action
- Write JSON report (C8), then final message.
