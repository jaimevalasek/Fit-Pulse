# phase-3-frontend-actions QA notes (lane frontend, run 1ccec491)

Checklist
- [x] 1. Run `pnpm typecheck` (foreground) -> exit 0; log saved at runtime execution-temp/.../phase-3-frontend-actions-qa/typecheck.log (EXIT_CODE=0 appended)
- [x] 2. Read unit files: DateField, UndoNotice, useActionStatus, ActionEditDialog, ActionProgressRow, ActionPlanList, CompanyActionsTab, CompanyTabs, App.tsx, ResultPage (action hook only)
- [x] 3. IF-005 only: no direct fetch in unit files; actions calls go through src/api/actionsApi.ts (getCompanyActions / getDiagnosisActions / updateAction). AC-ra-26/27/28/30/63 read in code: present.
- [ ] 4. Fix only if a simple local defect exists (none found so far; low-risk UndoNotice pending wiring is optional)
- [ ] 5. Write report JSON to .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-3-frontend-actions-qa.json

Findings so far (concrete)
- LOW: TrackedActionRows (ActionProgressRow.tsx ~L184) renders UndoNotice without `pending`; undo() in useActionStatus.ts (~L130-135) returns silently while the row save is in flight, no visual cue.
- DEFERRED (integration, not unit defect): App.tsx has no route for empresa/:companyId/relatorios; CompanyTabs 'Relatórios' tab and ResultPage link to it. phase-1-frontend-report-center notes already deferred this to integration.
- DEFERRED (integration): e2e tests/e2e/actions.spec.ts, result.spec.ts, history.spec.ts and Play dev-link walkthrough not run (sibling unit / no live Play).

Edits made
- none

Verification results
- pnpm typecheck: exit 0 (tsc --noEmit clean)

Next small action
- Write report JSON (verdict PASS: typecheck green, no critical/high finding).
