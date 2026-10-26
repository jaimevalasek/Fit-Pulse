# QA notes — phase-1-frontend-company-tabs (lane frontend, wave 1)

Attempt: 4097a607-9d9b-4877-975b-19c019caa8c3
Started: 2026-10-25T22:54Z

## Checklist
- [ ] Read unit files: src/App.tsx, src/features/companies/CompanyPage.tsx, CompanyTabs.tsx, CompanyDiagnosesTab.tsx (bounded reads)
- [ ] Verify index tab keeps v1 timeline (CompanyDiagnosesTab) — code read
- [ ] Verify tab nav / 'Relatórios' link (CompanyTabs) and route status (App.tsx)
- [ ] Run `pnpm typecheck` -> log in runtime execution-temp dir, save exit code
- [ ] Optional: run companies/history e2e specs -> log + exit code
- [ ] Write report JSON at reports dir

## Runner / log locations
- Temp dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-1-frontend-company-tabs-qa/
- Typecheck log: .../typecheck.log, exit code in .../typecheck.exit
- Report: C:\dev\playapps\v-stage\.aioson\context\reports\relatorios-e-acompanhamento\1ccec491-f248-420f-a6c5-171d63b72e05\phase-1-frontend-company-tabs-qa.json

## Findings so far
- pnpm typecheck (tsc --noEmit): exit 0, log typecheck.log, exit saved typecheck.exit = 0.
- src/features/companies/CompanyTabs.tsx buildTabs(): index tab "diagnosticos" (path "") + "relatorios" (path "relatorios", label Relatórios). Nav aria-label "Seções da empresa", data-aioson-tour "abas".
- src/App.tsx L84-86: company route has ONLY index child CompanyDiagnosesTab. No "relatorios" child route (ReportCenterPage not present). Known: implementer deferred to integration (medium). Click on Relatórios -> falls to `*` NotFoundScreen (L91). Deferred, not a unit defect.
- src/features/companies/CompanyDiagnosesTab.tsx: index tab renders CompanyTimeline (features/history) with empty state + archive/restore/delete links. Looks intact.
- CompanyPage.tsx: exports useCompanyOutlet, StartDiagnosisButton, CompanyOutletContext (L42-51, L297-298). countCompanyDiagnoses (companiesApi L81) is sync -> describeDeletion ok.
- No code defect found in the 4 unit files so far.

## Edits made
- none (no defect to fix)

- e2e: `pnpm exec playwright test tests/e2e/companies.spec.ts tests/e2e/history.spec.ts` -> 15 passed, exit 0 (e2e.log, e2e.exit in temp dir). Covers index timeline, archive/restore/delete, 390 px + axe.
- Wording grep "versão 1" in src/features/history: no literal match; "versão 1" refers to the existing timeline (AC-dm-30 comment), covered by history.spec.

## Status
- Report written and JSON-validated: C:\dev\playapps\v-stage\.aioson\context\reports\relatorios-e-acompanhamento\1ccec491-f248-420f-a6c5-171d63b72e05\phase-1-frontend-company-tabs-qa.json
- Verdict PASS, corrections [] (no edits to source). Findings: 2 medium deferred (route to integration; report.spec not run).
- Task complete. No further action.
