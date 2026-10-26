# phase-6-frontend-questionnaire QA notes (bounded, attempt1 attempt_id 5090c825)

## Checklist
- [x] 1. `pnpm typecheck` (default, foreground) -> EXIT=1 (log typecheck-attempt1.log). Failure is pnpm's pre-run deps check -> postinstall `prisma migrate deploy` -> "database is locked" on data/fitpulse.db. tsc never ran.
- [x] 1b. `pnpm --config.verify-deps-before-run=false typecheck` (foreground) -> EXIT=0 (typecheck-noverify-attempt1.log, .exit). Body is `tsc --noEmit`, no output.
- [x] 2. Re-grep imports in src/features (questionnaire, companies, history, home): questionnaire dialogs import questionnaireApi (IF-011) + httpClient + filesApi.revealSavedFile (IF-002). No fetch(). Same as prior QA.
- [x] 3. SendQuestionnaireDialog.tsx:92,113 shows server `send.message` (IF-011 message field) with copy hook; no client-built text.
- [ ] 4. Write report JSON: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-frontend-questionnaire-qa.attempt1.json

## Findings
- F1 medium verification_not_run: default `pnpm typecheck` blocked by DB lock. Preview running (.aioson/preview.json: port 3543, running=true) holds data/fitpulse.db. Not stopped (not mine to stop).
- F2 low: "Mostrar na pasta" in SendQuestionnaireDialog uses filesApi.revealSavedFile (IF-002), not strictly IF-011. Plan (implementation-plan-relatorios-e-acompanhamento.md:56,314) lists it as the design; wording finding only.
- F3 medium deferred to integration: vitest tests/unit/questionnaireFile.test.ts, tests/api/questionnaireRoutes.test.ts; playwright tests/e2e/remoteQuestionnaire.spec.ts, home.spec.ts, questionnaire.spec.ts (not in unit Done-when; not run here).
- F4 low (prior QA): ComparePage/CompanyPage fetch whole consultant home for one line (contract gap, not defect).

## Edits made
- none (no defect found in the 6 unit files; corrections []).

## Verification
- typecheck default: EXIT=1 (env DB lock, see F1).
- typecheck verify-deps-before-run=false: EXIT=0.

## Next small action
- Write report attempt1 JSON with verdict PASS (no critical/high), then end turn.
