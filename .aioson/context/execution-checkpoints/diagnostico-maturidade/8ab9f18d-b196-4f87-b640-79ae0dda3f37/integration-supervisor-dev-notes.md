# integration-supervisor dev notes

Log dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/integration-supervisor-dev/

## Checklist
- [x] Baseline: pnpm typecheck exit 0 (typecheck.log); pnpm test exit 0, 17 files / 757 tests (unit.log)
- [x] Installed Playwright chromium 1248 (pw-install.log exit 0); @playwright/test 1.64.1, @axe-core/playwright present
- [x] Baseline pnpm build exit 0, smoke-migrate PASS, smoke-boot PASS, smoke-store-package PASS (logs build.log, smoke-*.log)
- [ ] Create playwright.config.ts, tests/e2e/global-setup.ts, tests/e2e/support/fixtures.ts
- [ ] Core specs: shell, companies, questionnaire, calculator, result
- [ ] Feature specs: history, report, home, settings, accessibility, firstRun, backup
- [ ] Full pnpm test:e2e green
- [ ] .aioson/plans/diagnostico-maturidade/harness-contract.json + aioson harness:check
- [ ] Report JSON

## UI map (concrete)
- HashRouter routes (src/App.tsx): / -> /boas-vindas (no company) or /inicio; /empresas, /empresa/:id, /diagnostico/:id, /resultado/:id, /comparar/:id, /configuracoes
- Selectors: data-aioson-id everywhere (wizard-mode-empresa, wizard-mode-consultoria, wizard-submit, companies-new, company-create-submit, company-edit-submit, company-{archive,restore,delete}-confirm dialogs, company-archive/restore/delete links, company-new-diag, theme-toggle, tour-reopen)
- Company status dialog titles: "Arquivar X?" confirm "Arquivar empresa"; "Restaurar X?" "Restaurar empresa"; "Excluir X?" "Excluir definitivamente"
- Companies list filters via URL ?busca= ?estagio= ?arquivadas=1; row tr[data-row-id]; row buttons aria-label "Editar X"/"Arquivar X"/"Restaurar X"/"Excluir X"
- Backend downloadsDir = os.homedir()/Downloads (server/main.ts) -> set USERPROFILE/HOME in webServer env
- DATABASE_URL env wins (server/db/databaseUrl.ts); prepare-app --migrate uses prisma.config.ts -> same env

- Questionnaire: /diagnostico/:id?bloco=N; block1 calculator ids spend-<part>, new-customers, average-purchase, margin; mode radios name <diagId>-spendMode/newCustomersMode values exact|range|unknown; questions fieldset [data-aioson-id=item-<qid>] radios value 0..3 or 'unknown'; blocks 2:mp1-4 3:pc1-3,cm1-2 4:mm1-2,es1 5:aq1-3 6:en1-3 7:co1-3 8:re1-3
- quiz-finish -> quiz-missing alert or diagnosis-complete-confirm ('Concluir e ver resultado'); diagnosis-discard -> diagnosis-discard-confirm ('Descartar rascunho'); draft-saved text 'Salvo automaticamente às HH:MM'
- Result: result, escada/ladder-steps aria-label, result-trava, result-lock-phrase, result-actions li[data-action-key], result-guidance, dim-<key>, result-risks li[data-risk-id] / result-no-risks, result-confidence[data-level], result-provisional, result-pdf -> pdf-modal 'Salvar PDF' -> result-pdf-saved/result-pdf-notice
- G1-G4 answer/calculator fixtures in tests/unit/evaluateDiagnosis.test.ts lines 41-114 (stages 1..4, plans cac/mp/mm, re/dep/mp, co/invest/pc, invest/pc/mp)

## Findings
- tests/e2e/ and playwright.config.ts absent at start; .aioson/plans/ dir absent.

## Next action
- Map questionnaire/result/home/settings UI, then write config + fixtures.

## UI map 2
- Questionnaire: /diagnostico/:id?bloco=N; block1 calc ids spend-<part>, new-customers, average-purchase, margin; mode radios name <diagId>-spendMode / <diagId>-newCustomersMode values exact|range|unknown; question fieldset [data-aioson-id=item-<qid>] radios value 0..3 or 'unknown'; blocks 2:mp1-4 3:pc1-3,cm1-2 4:mm1-2,es1 5:aq1-3 6:en1-3 7:co1-3 8:re1-3
- quiz-finish -> quiz-missing alert or diagnosis-complete-confirm ('Concluir e ver resultado'); diagnosis-discard -> diagnosis-discard-confirm; draft-saved 'Salvo automaticamente às HH:MM'
- Result ids: result, ladder-steps (aria-label), result-trava, result-lock-phrase, result-actions li[data-action-key], result-guidance, dim-<key>, result-risks li[data-risk-id] | result-no-risks, result-confidence[data-level], result-provisional, result-pdf -> pdf-modal 'Salvar PDF' -> result-pdf-saved / result-pdf-notice
- G1-G4 fixtures: tests/unit/evaluateDiagnosis.test.ts lines 41-114
- Playwright order verified (lib/runner/index.js createGlobalSetupTasks): webServer plugin starts BEFORE globalSetup -> wipe e2e dir at config load (main process, guarded by env FITPULSE_E2E_DIR), pnpm dev migrates, global-setup verifies empty+migrated
- Tour auto-opens on /inicio when data + tourSeen[mode] false -> seed PUT /api/preferences {tourSeen:{owner:true,consultant:true}} in non-tour specs
- Backup import keeps ids/timestamps, skips known ids -> use export+rewrite ids/dates+import to seed old drafts/diagnoses for consultant home lists
- Theme applied as documentElement.dataset.theme

## Slice log
- Created playwright.config.ts, tests/e2e/global-setup.ts, tests/e2e/support/fixtures.ts, tests/e2e/shell.spec.ts
- DEFECT FIXED package.json "dev": `tsx watch server/main.ts` never starts when stdin is a pipe (concurrently gives piped stdin) -> backend never listened in pnpm dev / Play dev-link. Repro: probe-watch.mjs pipe -> no output; ignore -> listening. Replaced with `node --watch --import tsx server/main.ts` (probe-watch2 nodewatch -> listening).
- shell.spec 4/4 PASS (e2e-shell.log). NOTE: `pnpm test:e2e -- <file>` passes literal "--" and Playwright runs ALL specs (superset; ok)
- companies.spec written; run1 9/11: CNPJ caret test bug (fixed: click+End); axe color-contrast 4.49 on dialog (#8f8674 on #242019)
- DEFECT FIXED src/styles/tokens.css --text-muted dark #8f8674->#958c7a (>=4.87 all surfaces), light #7d7362->#6b6252 (light was 3.99 on ground)
- companies.spec 7/7 PASS after contrast fix (e2e-q.log)
- questionnaire.spec 6/6 PASS (e2e-q.log + e2e-q390.log)
- DEFECT FIXED src/features/diagnosis/QuestionnairePage.tsx: below lg the grid had an auto column, BlockRail ol (flex nowrap) widened page to 1163px at 390px; added grid-cols-[minmax(0,1fr)]
- fixtures: saveDraftAfter(page, action, field) waits for the PATCH carrying the field; expectNoHorizontalScroll reports offenders
- Run single files with `pnpm exec playwright test <file>` (pnpm test:e2e -- file runs all)
- NEXT: calculator.spec, result.spec
- calculator.spec 4/4 + result.spec 6/6 PASS (e2e-cr.log). Core line complete (shell, companies, questionnaire, calculator, result)
- NEXT: history, report, home, settings, accessibility, firstRun, backup specs
- history.spec 3/3 + report.spec 3/3 PASS (e2e-hr.log, e2e-h1.log); one flaky fail traced to API restarts
- DEFECT FIXED (2nd pass) package.json dev: `node --watch` restarts API on spurious change events (NTFS last access enabled, fsutil DisableLastAccess=2; events even for node_modules files) -> in-flight requests fail. Final: `tsx server/main.ts` (no backend watch; same as start). Vite HMR unchanged.
- home.spec 6/6 PASS (e2e-home.log); fixtures AppApi.backdateCompany(id, days) via export->shift->delete->import
- backup.spec 3/3 PASS, settings.spec 2/3 (locator fix applied) (e2e-sb.log); firstRun.spec written; NEXT accessibility.spec then full run
- firstRun.spec 5/5 PASS, settings 3/3 PASS (e2e-a11y.log). accessibility.spec written: run1 failed dark (rail overflow 675px with answered draft) + light (copper 4.37 on ground)
- DEFECT FIXED src/features/diagnosis/BlockRail.tsx: sr-only "(respondido)" (absolute) escaped overflow-x rail -> added `relative` on rail links
- DEFECT FIXED tokens.css light --copper #a55a30->#964e28, --peril #bf3d47->#b0343e (>=4.84 on ground/sunken)
- tokens 2nd pass (self-on-wash badges RiskList/DimensionScores): light copper ->#824421, light peril ->#9e2d37, dark peril #e25d5d->#ee7c7c; a11y spec: reload per route, test.step per route, G1 high-risk result route
- DEFECT FIXED src/styles/global.css: Tailwind auto source detection scanned .aioson/** + logs (no git repo -> .gitignore not applied); @tailwindcss/vite hotUpdate sends full-reload on any scanned non-module change -> random page reloads in dev (broke firstRun submit, a11y Tab loop). Now `@import "tailwindcss" source(none); @source "../";` CSS 75.4KB -> 70.8KB (build2.log exit 0)
- DEFECT FIXED touch targets <44px at 390: CompaniesPage row name link, CompanyPage breadcrumb + status link buttons (cn(... min-h-(--touch) max-sm:min-h-(--touch))), QuestionnairePage breadcrumb
- fixtures saveDraftAfter action type () => Promise<unknown> (tsc includes tests)
- NEXT: full `pnpm test:e2e` (e2e-full.log)
- FULL pnpm test:e2e exit 0, 52 passed (e2e-full.log) after home.spec reload fix. NEXT: harness-contract.json + aioson harness:check, then re-run typecheck/test/build/smokes
- wrote .aioson/plans/diagnostico-maturidade/harness-contract.json (RG-build/migrate/boot/smoke, C-unit, C-package); running harness:check (harness-check.log)
- aioson harness:check exit 0: 6/6 passed, integrity ok (harness-check.log). NEXT: literal per-CAP vitest commands (unit-cmds.log), write report
- REPORT written: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/integration-supervisor.json verdict PASS. DONE.
