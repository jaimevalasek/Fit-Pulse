# phase-3-frontend-actions — dev notes
started_at: 2026-10-25T23:44:16Z

## Checklist
- [x] context:brief rules
- [x] read existing: CompanyTabs, App routes, ActionPlanList, ResultPage, CnpjField (mask pattern), shared dates/options
- [x] DateField.tsx
- [x] UndoNotice.tsx
- [x] useActionStatus.ts
- [x] ActionEditDialog.tsx
- [x] ActionProgressRow.tsx
- [x] CompanyActionsTab.tsx + CompanyTabs tab + App route
- [x] ActionPlanList + ResultPage
- [x] pnpm typecheck (log in runtime/execution-temp/.../phase-3-frontend-actions-dev/)
- [x] report JSON

## Findings
- src/api/actionsApi.ts: getCompanyActions, getDiagnosisActions, updateAction (IF-005) present.
- rules loaded: status-change-confirmation (status change uses undo, not modal — per AC-ra-27), file-size (<500).
- Patterns: CnpjField wraps TextField+useCaretRestore+mask (copy for DateField); CompanyFormDialog uses AlertDialog + SELECT_CLASS; useCompanyOutlet()/StartDiagnosisButton exported from CompanyPage.tsx.
- Prototype: actionRow (proto L750-766), actionsTab (L768-778), edit dialog (L1099-1108), result closed notice (L969-971), toast undo 6s (L1163, L1208).
- App.tsx has NO route for empresa/:id/relatorios (ReportCenterPage unrouted) -> message to integration, not mine.
- Design: TrackedActionRows (in ActionProgressRow.tsx) composes rows+UndoNotice+ActionEditDialog via useActionStatus; ResultPage loads getDiagnosisActions (+getCompanyActions for closing date when !isCurrent).

## Edits (all done)
- DateField.tsx (mask via maskDateInput, validate getDateError on blur), UndoNotice.tsx (role=status, Desfazer)
- useActionStatus.ts (optimistic save, 6s undo, latest-request guard), ActionEditDialog.tsx (DateField, role select, note 500 + counter)
- ActionProgressRow.tsx (+TrackedActionRows), CompanyActionsTab.tsx (empty AC-ra-63, closed plans), CompanyTabs "Ações", App route acoes
- ActionPlanList: progress optional (OwnerHome still passes plan only); ResultPage useActionPlanProgress (getDiagnosisActions + getCompanyActions for closing date)
## Verification
- pnpm typecheck -> exit 0 (log runtime/execution-temp/.../phase-3-frontend-actions-dev/typecheck.log)
- eslint not installed (not a project check)
## Next: write report JSON
