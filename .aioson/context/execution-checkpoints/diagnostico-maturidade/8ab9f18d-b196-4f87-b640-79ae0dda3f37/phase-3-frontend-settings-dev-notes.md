# phase-3-frontend-settings — dev notes
started_at: 2026-10-23T04:46:02Z
## Checklist
- [ ] context:brief rules
- [ ] check httpClient prior error (out of allowed files -> message integration if unfixed)
- [ ] read App.tsx, main.tsx, AppShell.tsx, httpClient.ts
- [ ] prototype settings section (switch-usage-mode, switch-theme, how to read, assistant reads)
- [ ] PRD RULE-dm-17, OQ-6, BR-dm-09
- [ ] preferencesApi.ts
- [ ] PreferencesProvider.tsx
- [ ] SettingsPage.tsx
- [ ] AppShell nav + App route + main wrap
- [ ] pnpm build exit 0
- [ ] report JSON
## Findings
- httpClient.ts already sends Content-Type on every POST/PUT/PATCH (body `{}` default) -> prior 415 finding resolved upstream; no edit needed.
- IF-008: GET/PUT /api/preferences; PUT {usageMode?, focusCompanyId?, theme?, tourSeen?{owner?,consultant?}} -> {usageMode|null, focusCompanyId?, theme, tourSeen}; 400 validation_failed, 404 company_not_found. Backend lane 3-backend-preferences concurrent (server/routes/preferenceRoutes.ts absent now).
- Prototype viewSettings (prototype.html:1104-1130): sections mode (radiogroup Minha empresa/Consultoria + select Empresa em foco), theme (Escuro/Claro), Sobre os resultados, Assistente do Play. Nav (prototype:750-757): Início; consultoria->Empresas; empresa->Minha empresa (#/empresa/:focus); Configurações.
- RULE-dm-17 fields: saúde + por empresa ativa nome, estágio, dimensão que mais trava, data último diagnóstico; nunca R$ nem respostas. OQ-6 (plan:45): nota diz acesso protegido pelo login do Play, app sem login próprio.
- Home route `#/inicio` belongs to 3-frontend-home (wave 9); `/` redirect to first-run belongs to first-run unit.
## Edits
- created src/api/preferencesApi.ts (getPreferences, updatePreferences; types Preferences, PreferencesUpdate, UsageMode, Theme, TourSeen)
- created src/features/preferences/PreferencesProvider.tsx (load gate w/ loading+error retry, applyTheme -> html[data-theme]+colorScheme, optimistic savePreferences w/ revert, usePreferences)
- created src/features/settings/SettingsPage.tsx (sections split: UsageModeSection, ThemeSection, ResultsGuideSection, AssistantSection, SecuritySection; useActiveCompanies)
- next: AppShell nav by mode + mode chip + theme toggle; App.tsx routes configuracoes (+ inicio placeholder); main.tsx wrap; pnpm build
- AppShell: buildNavItems by mode (Início /inicio, Minha empresa /empresa/:focus or Empresas, Configurações), mode chip, ThemeToggle; split into SkipLink/Brand/MainNav/HeaderTools (function-size).
- App.tsx: routes configuracoes -> SettingsPage, inicio -> Navigate /empresas placeholder (home unit replaces). main.tsx wraps App in PreferencesProvider.
## Verification
- pnpm build -> exit 0 (log+exit in runtime temp dir build.log/build.exit)
- aioson rules:check --paths=<6 files> -> 0 violations
- next: write report JSON
- report written; done
