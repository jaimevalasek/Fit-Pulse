# phase-1-frontend-companies QA notes (run 8ab9f18d, attempt1 resume)

Runner: single foreground session. Logs: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-companies-qa/
Report: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-companies-qa.attempt1.json
Resume started_at: 2026-10-23T04:27:21Z

## Checklist
- [x] 1. Prior-pass evidence read (build.exit 00:53 was STALE: App.tsx changed 01:16, httpClient.ts 01:21)
- [x] 2. Re-ran pnpm build foreground -> EXIT=0 (build2.log, build2.exit) on current tree
- [x] 3. App.tsx now passes onStartDiagnosis={startDiagnosis} (diagnosesApi.ts exports startDiagnosis; signature matches CompanyPage prop) -> prior finding RESOLVED
- [x] 4. httpClient.ts readErrorDetails keeps extra keys (fields); CompanyFormDialog.tsx readServerFieldErrors reads details.fields -> prior finding RESOLVED
- [x] 5. rules:check with --paths over 5 unit files -> rules-check3.log/.exit EXIT=0, 7/224 enforced, 0 violations (no-arg run enforced 0 rules, superseded)
- [x] 6. Unit files companiesApi/CompaniesPage/CompanyFormDialog/CompanyPage unchanged since prior QA (mtime before 00:54); IF-002 route/field match carried forward from prior pass
- [x] 7. Report attempt1 JSON written (verdict PASS, corrections [])

## Open findings (current)
- medium verification_not_run: tests/e2e/companies.spec.ts absent; pnpm test:e2e not run; 390px/axe and Play dev-link walkthrough not run
- low: CompanyPage.tsx 'ultimo resultado' link needs latest completed diagnosis id; IF-002 company payload lacks it

## Edits
- none this pass

## Next small action
Done. Report written; stop.
