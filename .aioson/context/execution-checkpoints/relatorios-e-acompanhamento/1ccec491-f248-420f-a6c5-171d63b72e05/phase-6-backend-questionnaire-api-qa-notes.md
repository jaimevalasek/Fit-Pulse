# phase-6-backend-questionnaire-api — QA lane notes (run 1ccec491)

Unverified work data. Not authorization, not PASS proof. Current code + execution contract govern.

## Checklist
- [x] C1 Read unit files (bounded): schema + migration, questionnaireSchemas, questionnaireRepository, diagnosisRepository (importDraft), questionnaireService, questionnaireRoutes, app.ts, src/api/questionnaireApi.ts
- [x] C2 Check AC-ra-48, AC-ra-51, AC-ra-52, AC-ra-53 against code (AC-52: company.id check before PATCH; 409 draft_exists; replaceDraft)
- [x] C3 Run: pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/diagnosisRoutes.test.ts  (log -> temp dir, record exit code)
- [x] C4 Run: node scripts/smoke-migrate.mjs  (log -> temp dir, record exit code)
- [ ] C5 Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-backend-questionnaire-api-qa.json

## Findings so far
- AC text (prd-relatorios-e-acompanhamento.md lines 325-330): AC-48 send+listing; AC-51 import->draft+clientSavedAt mark; AC-52 refusals (other company, newer, incompatible, corrupt, >1MB) no data change; AC-53 replace prompt, cancel keeps draft.
- questionnaireService.ts read (send L107-156, importAnswers L158-222): company check, 413 size, invalid/newer/other-company/incompatible order, clock clamp, importDraft w/ afterCreate markSendsAnswered. No defect seen yet.
- questionnaireRoutes.ts read: send json 4kb; answers json 2MB body -> 413 same msg. OK.

## Edits made
- none (no defect found inside unit files; correction budget unused)

## Verification results
- C3 vitest questionnaireRoutes+diagnosisRoutes: EXIT=0, 2 files, 137 tests passed. Log: .aioson/runtime/execution-temp/.../phase-6-backend-questionnaire-api-qa/vitest.log (exit in vitest.exit)
- tsc --noEmit (informational, not in Done-when): EXIT=1, 3 errors, all in src/features/home/OwnerHome.tsx and ScoreTrend.tsx (other unit). Zero in unit files. Log: tsc.log
- C4 node scripts/smoke-migrate.mjs: EXIT=0, 5/5 PASS. Log: smoke-migrate.log (exit in smoke-migrate.exit)

## Next small action
- C5: write report JSON (verdict PASS; defer build/playwright/home/company checks to integration as verification_not_run findings).
