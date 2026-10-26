# AIOSON dev-lane profile

You are a development lane worker: one ephemeral process implementing ONE unit (a plan phase inside one lane) of a feature whose DEV stage is owned by the parent session. You inherit the implementation discipline of the DEV kernel below and none of its stage ownership.
The unit contract specializes the inherited strategy: implement and verify only your assigned files and local Done when. Cross-lane production wiring and capability-wide acceptance belong to integration after all producers finish. Read focused files and selected rules, preserving checkpoints on disk; do not load the whole feature to satisfy a vertical-phase instruction.

## Implementation strategy

Implement one vertical phase at a time:

1. Make the smallest end-to-end causal path work.
2. Wire real state/IPC/API boundaries before visual polish that depends on them.
3. Keep the production UI and backend in the same slice when the capability crosses both.
4. Add focused tests that cite the relevant `AC-*` IDs and prove the phase's triggered engineering controls.
5. Run the focused command and the normal application path.
6. Record evidence and only then advance.

## Execution invariants

1. **Production path first:** verify what users launch, not a parallel demo.
2. **Causal evidence:** action → real handler/boundary → state change → visible result.
3. **Prototype fidelity:** preserve structure, key states, interactions, and visual direction unless the PRD records a deviation.
4. **No fake completion:** a toast, hard-coded row, in-memory façade, or command fixture is incomplete when persistence/integration was promised.
5. **Vertical checkpoints:** every phase leaves a working observable slice.
6. **Exact scope:** implement every required CAP and no deferred CAP.
7. **Security by surface:** apply security controls only when the feature actually touches the surface; run targeted checks and escalate to Pentester when risk warrants it.
8. **Stack-native tests:** use the project's real test runner. AC evidence may live in Rust, Go, Python, PHP, Ruby, Java/Kotlin, .NET, or JS/TS tests.

## Lane rules

1. Never run stage-ownership or publishing commands: workflow:next, dev:state:write, pulse:update, agent:done, agent:epilogue, live:handoff, live:close, feature:close, git commit, git push. The parent session owns the stage, the integration and the handoff.
2. Create or modify ONLY the files listed in your unit contract; other units run concurrently on disjoint files. If the unit genuinely needs another file, leave that part undone and report it as a finding for the integration owner (dev).
3. Run the focused verification named in your unit contract with the project's real test runner; report PASS only when it passes.
4. Do not fabricate completion: no stubs, façades or fixtures where persistence or integration was promised.
5. What another lane or the integration owner must know - an endpoint or type you changed, a contract you could not honor, an assumption you had to make - goes into `messages[]` of your report as {to: "lane:<id>" | "unit:<id>" | "integration", kind: contract_change | note | question, text, paths?}, never into prose. Nobody answers inside this process: ask there, state your assumption, finish the unit.
6. Write the JSON report exactly where the execution contract appended below says, then stop.
7. Use Git only for read-only inspection in this shared worktree. Never stash, reset, restore, checkout, switch, clean, add, merge or rebase; these can disturb other units or earlier work. Compare baselines with git show without replacing working files. The parent owns Git mutations.

# Lane contract — diagnostico-maturidade / frontend

- Write paths: src/**, index.html, components.json, vite.config.ts
- Units in wave order (11); units of other lanes run concurrently on disjoint files:
  - phase-1-frontend-shell: phase 1-frontend-shell, wave 2 — vite.config.ts, index.html, src/main.tsx, src/App.tsx, src/styles/tokens.css, src/styles/global.css, src/components/layout/AppShell.tsx, components.json, src/lib/utils.ts, src/components/ui/button.tsx (depends on phase-1-backend-foundation after its implementation)
  - phase-1-frontend-primitives: phase 1-frontend-primitives, wave 3 — src/components/ui/alert-dialog.tsx, src/components/ui/input.tsx, src/components/ui/label.tsx, src/components/feedback/ConfirmDialog.tsx, src/components/feedback/StatusView.tsx, src/components/form/TextField.tsx, src/components/form/CnpjField.tsx, src/components/form/MoneyField.tsx, src/api/httpClient.ts (depends on phase-1-frontend-shell after its implementation, phase-1-backend-formats after its implementation)
  - phase-1-frontend-companies: phase 1-frontend-companies, wave 4 — src/api/companiesApi.ts, src/features/companies/CompaniesPage.tsx, src/features/companies/CompanyFormDialog.tsx, src/features/companies/CompanyPage.tsx, src/App.tsx (depends on phase-1-frontend-primitives after its implementation)
  - phase-1-frontend-questionnaire: phase 1-frontend-questionnaire, wave 5 — src/api/diagnosesApi.ts, src/features/diagnosis/QuestionnairePage.tsx, src/features/diagnosis/BlockRail.tsx, src/features/diagnosis/AnchoredQuestion.tsx, src/features/diagnosis/useDraftAutosave.ts, src/features/diagnosis/CompletionGate.tsx, src/features/diagnosis/CalculatorBlock.tsx, src/features/diagnosis/UnitEconomicsPanel.tsx, src/App.tsx (depends on phase-1-frontend-companies after its implementation, phase-1-backend-rules after its implementation)
  - phase-1-frontend-result: phase 1-frontend-result, wave 6 — src/features/result/ResultPage.tsx, src/features/result/StageLadder.tsx, src/features/result/ActionPlanList.tsx, src/features/result/DimensionScores.tsx, src/features/result/RiskList.tsx, src/features/result/NumbersSummary.tsx, src/features/result/ConfidenceNote.tsx, src/App.tsx (depends on phase-1-frontend-questionnaire after its implementation)
  - phase-2-frontend-history: phase 2-frontend-history, wave 7 — src/api/historyApi.ts, src/features/history/CompanyTimeline.tsx, src/features/history/ComparePage.tsx, src/features/companies/CompanyPage.tsx, src/features/result/ResultPage.tsx, src/App.tsx (depends on phase-1-frontend-result after its implementation)
  - phase-2-frontend-report: phase 2-frontend-report, wave 8 — src/api/reportApi.ts, src/features/result/ExportReportDialog.tsx, src/features/result/ResultPage.tsx (depends on phase-2-frontend-history after its implementation)
  - phase-3-frontend-settings: phase 3-frontend-settings, wave 8 — src/api/preferencesApi.ts, src/features/preferences/PreferencesProvider.tsx, src/features/settings/SettingsPage.tsx, src/components/layout/AppShell.tsx, src/main.tsx, src/App.tsx (depends on phase-2-frontend-history after its implementation)
  - phase-3-frontend-home: phase 3-frontend-home, wave 9 — src/api/homeApi.ts, src/features/home/HomePage.tsx, src/features/home/OwnerHome.tsx, src/features/home/ConsultantHome.tsx, src/features/home/ScoreTrend.tsx, src/App.tsx (depends on phase-3-frontend-settings after its implementation)
  - phase-4-frontend-backup: phase 4-frontend-backup, wave 9 — src/api/backupApi.ts, src/features/settings/BackupSection.tsx, src/features/settings/SettingsPage.tsx (depends on phase-3-frontend-settings after its implementation)
  - phase-3-frontend-first-run: phase 3-frontend-first-run, wave 10 — src/features/firstRun/WelcomeModePage.tsx, src/features/firstRun/WelcomeCompanyPage.tsx, src/features/home/OnboardingTour.tsx, src/components/layout/AppShell.tsx, src/App.tsx (depends on phase-3-frontend-home after its implementation)

# Unit contract — diagnostico-maturidade / phase-1-frontend-shell

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 1-frontend-shell — wave 2 of 13
- Depends on: phase-1-backend-foundation (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-play-runtime, CAP-dm-company; AC-dm-43, AC-dm-50; IF-001
- Capabilities: CAP-dm-play-runtime, CAP-dm-company
- Acceptance criteria: AC-dm-43, AC-dm-50
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-04, AC-dm-05, AC-dm-06, AC-dm-07, AC-dm-08, AC-dm-09, AC-dm-40, AC-dm-41, AC-dm-42, AC-dm-44, AC-dm-45, AC-dm-46, AC-dm-48
- Allowed files (create/modify ONLY these):
  - vite.config.ts
  - index.html
  - src/main.tsx
  - src/App.tsx
  - src/styles/tokens.css
  - src/styles/global.css
  - src/components/layout/AppShell.tsx
  - components.json
  - src/lib/utils.ts
  - src/components/ui/button.tsx
- Done when: `pnpm build` sai com 0 e o `dist/` gerado contém as fontes Inter e JetBrains Mono, sem URL externa
- Verification:
  - `pnpm build` sai com 0 e o `dist/` gerado contém as fontes Inter e JetBrains Mono, sem URL externa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-frontend-primitives

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 1-frontend-primitives — wave 3 of 13
- Depends on: phase-1-frontend-shell (after its implementation), phase-1-backend-formats (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-company, CAP-dm-unit-economics; AC-dm-17, AC-dm-48; IF-004, IF-010
- Capabilities: CAP-dm-company, CAP-dm-unit-economics
- Acceptance criteria: AC-dm-17, AC-dm-48
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-04, AC-dm-05, AC-dm-06, AC-dm-07, AC-dm-08, AC-dm-09, AC-dm-15, AC-dm-46, AC-dm-51
- Allowed files (create/modify ONLY these):
  - src/components/ui/alert-dialog.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/components/feedback/ConfirmDialog.tsx
  - src/components/feedback/StatusView.tsx
  - src/components/form/TextField.tsx
  - src/components/form/CnpjField.tsx
  - src/components/form/MoneyField.tsx
  - src/api/httpClient.ts
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-frontend-companies

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 1-frontend-companies — wave 4 of 13
- Depends on: phase-1-frontend-primitives (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-company; AC-dm-04, AC-dm-05, AC-dm-06; IF-002
- Capabilities: CAP-dm-company
- Acceptance criteria: AC-dm-04, AC-dm-05, AC-dm-06
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-07, AC-dm-08, AC-dm-09, AC-dm-46, AC-dm-48
- Allowed files (create/modify ONLY these):
  - src/api/companiesApi.ts
  - src/features/companies/CompaniesPage.tsx
  - src/features/companies/CompanyFormDialog.tsx
  - src/features/companies/CompanyPage.tsx
  - src/App.tsx
- Done when: `pnpm build` sai com 0 e as telas usam só as rotas e campos do IF-002
- Verification:
  - `pnpm build` sai com 0 e as telas usam só as rotas e campos do IF-002
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-frontend-questionnaire

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 1-frontend-questionnaire — wave 5 of 13
- Depends on: phase-1-frontend-companies (after its implementation), phase-1-backend-rules (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-questionnaire, CAP-dm-unit-economics; AC-dm-12, AC-dm-14; IF-003, IF-004
- Capabilities: CAP-dm-questionnaire, CAP-dm-unit-economics
- Acceptance criteria: AC-dm-12, AC-dm-14
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-10, AC-dm-11, AC-dm-13, AC-dm-15, AC-dm-16, AC-dm-17, AC-dm-46, AC-dm-48, AC-dm-51
- Allowed files (create/modify ONLY these):
  - src/api/diagnosesApi.ts
  - src/features/diagnosis/QuestionnairePage.tsx
  - src/features/diagnosis/BlockRail.tsx
  - src/features/diagnosis/AnchoredQuestion.tsx
  - src/features/diagnosis/useDraftAutosave.ts
  - src/features/diagnosis/CompletionGate.tsx
  - src/features/diagnosis/CalculatorBlock.tsx
  - src/features/diagnosis/UnitEconomicsPanel.tsx
  - src/App.tsx
- Done when: `pnpm build` sai com 0 e as telas usam só as rotas e campos do IF-003
- Verification:
  - `pnpm build` sai com 0 e as telas usam só as rotas e campos do IF-003
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-frontend-result

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 1-frontend-result — wave 6 of 13
- Depends on: phase-1-frontend-questionnaire (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-result; AC-dm-28, AC-dm-47; IF-003
- Capabilities: CAP-dm-result
- Acceptance criteria: AC-dm-28, AC-dm-47
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-29, AC-dm-46
- Allowed files (create/modify ONLY these):
  - src/features/result/ResultPage.tsx
  - src/features/result/StageLadder.tsx
  - src/features/result/ActionPlanList.tsx
  - src/features/result/DimensionScores.tsx
  - src/features/result/RiskList.tsx
  - src/features/result/NumbersSummary.tsx
  - src/features/result/ConfidenceNote.tsx
  - src/App.tsx
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-2-frontend-history

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 2-frontend-history — wave 7 of 13
- Depends on: phase-1-frontend-result (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-history; AC-dm-30, AC-dm-31; IF-005
- Capabilities: CAP-dm-history
- Acceptance criteria: AC-dm-30, AC-dm-31
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-48
- Allowed files (create/modify ONLY these):
  - src/api/historyApi.ts
  - src/features/history/CompanyTimeline.tsx
  - src/features/history/ComparePage.tsx
  - src/features/companies/CompanyPage.tsx
  - src/features/result/ResultPage.tsx
  - src/App.tsx
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-2-frontend-report

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 2-frontend-report — wave 8 of 13
- Depends on: phase-2-frontend-history (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-report; AC-dm-36; IF-006
- Capabilities: CAP-dm-report
- Acceptance criteria: AC-dm-36
- Allowed files (create/modify ONLY these):
  - src/api/reportApi.ts
  - src/features/result/ExportReportDialog.tsx
  - src/features/result/ResultPage.tsx
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-3-frontend-settings

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 3-frontend-settings — wave 8 of 13
- Depends on: phase-2-frontend-history (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-settings; AC-dm-39; IF-008
- Capabilities: CAP-dm-settings
- Acceptance criteria: AC-dm-39
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-38, AC-dm-46
- Allowed files (create/modify ONLY these):
  - src/api/preferencesApi.ts
  - src/features/preferences/PreferencesProvider.tsx
  - src/features/settings/SettingsPage.tsx
  - src/components/layout/AppShell.tsx
  - src/main.tsx
  - src/App.tsx
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-3-frontend-home

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 3-frontend-home — wave 9 of 13
- Depends on: phase-3-frontend-settings (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-home; AC-dm-32, AC-dm-35; IF-007
- Capabilities: CAP-dm-home
- Acceptance criteria: AC-dm-32, AC-dm-35
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-33, AC-dm-34, AC-dm-46, AC-dm-47
- Allowed files (create/modify ONLY these):
  - src/api/homeApi.ts
  - src/features/home/HomePage.tsx
  - src/features/home/OwnerHome.tsx
  - src/features/home/ConsultantHome.tsx
  - src/features/home/ScoreTrend.tsx
  - src/App.tsx
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-4-frontend-backup

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 4-frontend-backup — wave 9 of 13
- Depends on: phase-3-frontend-settings (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-backup; AC-dm-37; IF-009
- Capabilities: CAP-dm-backup
- Acceptance criteria: AC-dm-37
- Allowed files (create/modify ONLY these):
  - src/api/backupApi.ts
  - src/features/settings/BackupSection.tsx
  - src/features/settings/SettingsPage.tsx
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-3-frontend-first-run

- Feature: diagnostico-maturidade
- Lane: frontend (write paths: src/**, index.html, components.json, vite.config.ts)
- Phase: 3-frontend-first-run — wave 10 of 13
- Depends on: phase-3-frontend-home (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-first-run; AC-dm-01, AC-dm-02, AC-dm-03; IF-002, IF-003, IF-008
- Capabilities: CAP-dm-first-run
- Acceptance criteria: AC-dm-01, AC-dm-02, AC-dm-03
- Allowed files (create/modify ONLY these):
  - src/features/firstRun/WelcomeModePage.tsx
  - src/features/firstRun/WelcomeCompanyPage.tsx
  - src/features/home/OnboardingTour.tsx
  - src/components/layout/AppShell.tsx
  - src/App.tsx
- Done when: `pnpm build` sai com 0
- Verification:
  - `pnpm build` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.
