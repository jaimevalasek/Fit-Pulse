# phase-3-frontend-first-run — dev notes

## Checklist
- [x] Previous-attempt finding (httpClient body-less writes 415): already fixed in src/api/httpClient.ts (JSON_WRITE_METHODS sends Content-Type + `{}` body). No edit needed.
- [x] Read APIs: companiesApi, diagnosesApi, preferencesApi, PreferencesProvider, AppShell, HomePage/OwnerHome/ConsultantHome
- [x] Prototype: wizard + tour sections
- [x] WelcomeModePage (#/boas-vindas)
- [x] WelcomeCompanyPage (#/boas-vindas/empresa)
- [x] OnboardingTour (TourProvider+useTour exported) (5 owner / 4 consultant steps, data-aioson-tour)
- [x] AppShell "?" button + hide nav on boas-vindas
- [x] App.tsx (RootRedirect, routes, TourProvider) root gate (no companies -> boas-vindas, else inicio)
- [x] pnpm build exit 0 (build.log + build.exit=0 in run temp dir)
- [ ] report JSON

## Findings
- APIs: createCompany(CompanyInput) companiesApi; startDiagnosis(companyId)->{id}; usePreferences().savePreferences({usageMode, focusCompanyId, tourSeen:{owner|consultant}}).
- CompanyFormDialog exports only the dialog -> wizard builds its own form with TextField/CnpjField + shared/content/companyOptions.
- Home files have NO data-aioson-tour; tour falls back to data-aioson-id: escada, home-trava, result-actions, home-draft, nav | escada, consult-stalled, consult-old, nav.
- Prototype: wizard ~L1131-1155, tour ~L1400-1440 (5 owner / 4 consultant steps, "N de M", Pular o tour/Voltar/Próximo/Entendi, Esc closes).
- Design: TourProvider (in OnboardingTour.tsx) wraps AppShell in App.tsx; "?" in HeaderTools calls openTour (navigates to /inicio). Auto-open on /inicio when !tourSeen[mode] and first anchor exists.
- Next: run pnpm build -> log at .aioson/runtime/execution-temp/.../phase-3-frontend-first-run-dev/build.log
- [x] Report written (verdict PASS). Unit done.
