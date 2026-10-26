# phase-3-frontend-first-run QA notes (unverified work data)

## Checklist
- [x] Confirm unit files exist (WelcomeModePage, WelcomeCompanyPage, OnboardingTour, AppShell, App.tsx) — verified present
- [x] Run `pnpm build` in foreground (sync, not background), log: execution-temp/.../phase-3-frontend-first-run-qa/build.log, EXIT_CODE=0 (tsc + vite built in 1.36s; only >500kB chunk warning)
- [x] Read App.tsx (RootRedirect: hasAnyCompany -> /inicio or /boas-vindas; TourProvider wraps AppShell) — OK
- [x] Read WelcomeModePage.tsx (2 ModeCards -> /boas-vindas/empresa?modo=) — OK
- [x] Read WelcomeCompanyPage.tsx 1-324 (useWizardForm start(): createCompany reuse via createdRef -> savePreferences -> startDiagnosis -> /diagnostico/:id) — OK, no defect found
- [x] Read OnboardingTour.tsx 1-320 (TOURS 5 owner/4 consultant, useFirstVisitTour, TourProvider, closeTour saves tourSeen) — OK
- [x] tourSeen partial save: client mergeUpdate (PreferencesProvider.tsx:31) + server per-key upsert (preferenceService.ts:96-100) + schema partial (preferenceSchemas.ts:12-18) — no wipe defect
- [x] AppShell.tsx 205-254 (inWizard hides nav/'?' on /boas-vindas*; nav has data-aioson-tour="nav") — OK
- [x] archived=true server support (companySchemas.ts:86) — RootRedirect gate correct
- [x] Product name FitPulse matches manifest.json

## Verdict decision
- No defect found in unit files; 0 edits (corrections[] empty).
- Deferred to integration (verification_not_run, medium): e2e tests/e2e/firstRun.spec.ts (fresh-db), Play dev-link with data/ deleted.
- Report: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-3-frontend-first-run-qa.json — verdict PASS.
- [ ] Fix only simple local defects inside unit files (max 3), re-run build
- [ ] Write report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-3-frontend-first-run-qa.json

## Findings / edits
- (none yet)

## Next action
- Run pnpm build (foreground).
