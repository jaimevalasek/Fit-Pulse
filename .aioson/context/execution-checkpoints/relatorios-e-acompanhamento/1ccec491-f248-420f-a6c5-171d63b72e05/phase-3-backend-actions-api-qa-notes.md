# QA notes: phase-3-backend-actions-api (run 1ccec491)

## Checklist
- [x] Done-when vitest (4 files): exit 0, 189 passed. Log: phase-3-backend-actions-api-qa/done-when.log, exit: done-when.exit
- [x] actionService.ts (216 lines): read in full; forCompany/forDiagnosis/update logic matches AC-ra-30/31/32 wording; no defect
- [x] actionRoutes.ts, actionSchemas.ts, app.ts: read; PATCH parse -> ZodError -> validation_failed (errorHandler.ts:81); no defect
- [x] diagnosisRepository.ts: completeDraft tx reads latest + tracked rows, createMany; listCompletedRecords ordering same as listCompleted; no defect
- [x] diagnosisService.ts complete (~line 216-233) + shared/domain/actionProgress.ts inheritActionProgress/isActionOverdue: no defect
- [x] src/api/actionsApi.ts: types match server view; httpClient.patch exists (httpClient.ts:120); import style matches siblings
- [x] Spec: PRD lines 305-309 (AC-ra-29/31/32). AC-ra-32 needs archive->previous current, restore, company delete cascade of action_progress; diary part = Phase 4 (deferred)
- [x] Tests titles: actionRoutes.test.ts:533 (AC-ra-29), :571 (archive/restore AC-ra-32 :572, delete cascade :606); diagnosisRoutes.test.ts ~890-1105 inheritance cases
- [x] pnpm typecheck: exit 0 (typecheck.log, typecheck.exit in temp dir)
- [x] Corrections: none (0 of 3)
- [x] Report written: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-3-backend-actions-api-qa.json, verdict PASS

## Findings so far
- none blocking. Deferred to integration (kind verification_not_run): AC-ra-32 diary cascade (Phase 4 table), AC-ra-29 PDF comparison (reports unit), Playwright e2e actions/result/history specs, pnpm build, smoke-migrate.

## Edits
- none

## Verification
- Done-when: exit 0, 4 files / 189 tests passed

## Next small action
- Done. Only the final message remains.
