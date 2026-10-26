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

# Lane contract — relatorios-e-acompanhamento / backend

- Write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json
- Units in wave order (21); units of other lanes run concurrently on disjoint files:
  - phase-1-backend-document: phase 1-backend-document, wave 1 — shared/report/reportDocument.ts, shared/report/paperPalette.ts, shared/format/confidenceText.ts, server/report/reportCopy.ts, server/report/documentParts.ts, server/report/reportModel.ts, tests/unit/reportModel.test.ts, tests/unit/confidenceText.test.ts, tests/unit/forbiddenTerms.test.ts
  - phase-1-backend-files: phase 1-backend-files, wave 1 — prisma/schema.prisma, prisma/migrations/20261026000000_generated_files/migration.sql, server/repositories/generatedFileRepository.ts, server/files/systemOpener.ts, server/services/fileService.ts, server/routes/fileRoutes.ts, server/app.ts, server/main.ts, src/api/filesApi.ts, tests/api/fileRoutes.test.ts
  - phase-2-backend-brand: phase 2-backend-brand, wave 1 — shared/format/phone.ts, shared/format/contact.ts, tests/unit/contactFormat.test.ts, server/validation/brandSchemas.ts, server/files/imageSignature.ts, tests/unit/imageSignature.test.ts, server/services/brandService.ts, server/routes/brandRoutes.ts, server/repositories/preferenceRepository.ts, server/services/preferenceService.ts
  - phase-6-backend-questionnaire-file: phase 6-backend-questionnaire-file, wave 1 — server/questionnaire/questionnaireFile.ts, server/questionnaire/questionnaireClient.js, server/questionnaire/questionnaireStyles.css, tests/unit/questionnaireFile.test.ts, shared/content/questionBank.ts
  - phase-1-backend-pdf: phase 1-backend-pdf, wave 2 — server/report/pdfRenderer.ts, server/report/pdfBlocks.ts, server/report/pdfCharts.ts, tests/unit/pdfRenderer.test.ts (depends on phase-1-backend-document after its implementation)
  - phase-3-backend-action-domain: phase 3-backend-action-domain, wave 2 — shared/domain/actionProgress.ts, shared/content/actionProgressOptions.ts, shared/format/dates.ts, tests/unit/actionProgress.test.ts, tests/unit/dates.test.ts, prisma/schema.prisma, prisma/migrations/20261026000100_action_progress/migration.sql, server/repositories/actionProgressRepository.ts, shared/domain/actionPlan.ts (depends on phase-1-backend-files after its implementation)
  - phase-1-backend-report-api: phase 1-backend-report-api, wave 3 — server/validation/reportSchemas.ts, server/services/reportService.ts, server/routes/reportRoutes.ts, server/files/downloadsFolder.ts, src/api/reportApi.ts, tests/api/reportRoutes.test.ts (depends on phase-1-backend-pdf after its implementation, phase-1-backend-files after its implementation)
  - phase-4-backend-diary-domain: phase 4-backend-diary-domain, wave 3 — shared/domain/diary.ts, tests/unit/diary.test.ts, shared/format/dates.ts, tests/unit/dates.test.ts, shared/domain/types.ts, shared/domain/unitEconomics.ts, shared/domain/completeness.ts, shared/domain/diaryPrefill.ts, tests/unit/unitEconomics.test.ts, tests/unit/diaryPrefill.test.ts (depends on phase-3-backend-action-domain after its implementation)
  - phase-2-backend-brand-reports: phase 2-backend-brand-reports, wave 4 — server/app.ts, src/api/brandApi.ts, tests/api/brandRoutes.test.ts, server/report/documentParts.ts, server/report/pdfRenderer.ts, server/services/reportService.ts, tests/unit/pdfRenderer.test.ts (depends on phase-2-backend-brand after its implementation, phase-1-backend-report-api after its implementation, phase-1-backend-pdf after its implementation, phase-1-backend-files after its implementation)
  - phase-2-backend-evolution: phase 2-backend-evolution, wave 5 — server/services/historyService.ts, shared/domain/compareDiagnoses.ts, shared/content/comparisonCopy.ts, server/report/evolutionDocument.ts, server/validation/reportSchemas.ts, server/services/reportService.ts, tests/unit/evolutionDocument.test.ts, tests/fixtures/rulesV2.ts (depends on phase-2-backend-brand-reports after its implementation)
  - phase-3-backend-actions-api: phase 3-backend-actions-api, wave 5 — server/validation/actionSchemas.ts, server/services/actionService.ts, server/routes/actionRoutes.ts, server/app.ts, src/api/actionsApi.ts, tests/api/actionRoutes.test.ts, server/repositories/diagnosisRepository.ts, server/services/diagnosisService.ts, tests/api/diagnosisRoutes.test.ts (depends on phase-3-backend-action-domain after its implementation, phase-2-backend-brand-reports after its implementation)
  - phase-2-backend-portfolio: phase 2-backend-portfolio, wave 6 — shared/domain/followUp.ts, tests/unit/followUp.test.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/services/homeService.ts, tests/api/homeRoutes.test.ts, server/report/portfolioDocument.ts, tests/unit/portfolioDocument.test.ts, server/services/reportService.ts, tests/unit/forbiddenTerms.test.ts (depends on phase-2-backend-evolution after its implementation)
  - phase-4-backend-diary-api: phase 4-backend-diary-api, wave 6 — prisma/schema.prisma, prisma/migrations/20261026000200_diary_entries/migration.sql, server/repositories/diaryRepository.ts, server/validation/diarySchemas.ts, server/services/diaryService.ts, server/routes/diaryRoutes.ts, server/app.ts, src/api/diaryApi.ts, tests/api/diaryRoutes.test.ts, shared/content/calculatorOptions.ts (depends on phase-4-backend-diary-domain after its implementation, phase-3-backend-actions-api after its implementation, phase-3-backend-action-domain after its implementation)
  - phase-3-backend-action-reports: phase 3-backend-action-reports, wave 7 — server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/report/portfolioDocument.ts, server/services/reportService.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts, tests/unit/portfolioDocument.test.ts (depends on phase-3-backend-actions-api after its implementation, phase-2-backend-portfolio after its implementation)
  - phase-5-backend-preferences: phase 5-backend-preferences, wave 7 — server/validation/preferenceSchemas.ts, server/services/preferenceService.ts, src/api/preferencesApi.ts, tests/api/preferenceRoutes.test.ts, shared/domain/followUp.ts, tests/unit/followUp.test.ts (depends on phase-2-backend-brand after its implementation, phase-2-backend-portfolio after its implementation)
  - phase-4-backend-diary-prefill: phase 4-backend-diary-prefill, wave 8 — server/validation/diagnosisSchemas.ts, server/services/diagnosisService.ts, server/routes/diagnosisRoutes.ts, src/api/diagnosesApi.ts, tests/api/diagnosisRoutes.test.ts, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/services/reportService.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts (depends on phase-4-backend-diary-api after its implementation, phase-3-backend-action-reports after its implementation, phase-3-backend-actions-api after its implementation)
  - phase-5-backend-home: phase 5-backend-home, wave 8 — server/services/portfolioService.ts, server/services/homeService.ts, src/api/homeApi.ts, tests/api/homeRoutes.test.ts, server/validation/companySchemas.ts, server/services/companyService.ts, server/app.ts, src/api/companiesApi.ts, tests/api/companyRoutes.test.ts (depends on phase-5-backend-preferences after its implementation, phase-3-backend-action-reports after its implementation, phase-4-backend-diary-api after its implementation)
  - phase-6-backend-questionnaire-api: phase 6-backend-questionnaire-api, wave 9 — prisma/schema.prisma, prisma/migrations/20261026000300_questionnaire_sends/migration.sql, server/validation/questionnaireSchemas.ts, server/repositories/questionnaireRepository.ts, server/repositories/diagnosisRepository.ts, server/services/questionnaireService.ts, server/routes/questionnaireRoutes.ts, server/app.ts, src/api/questionnaireApi.ts, tests/api/questionnaireRoutes.test.ts (depends on phase-6-backend-questionnaire-file after its implementation, phase-5-backend-home after its implementation, phase-4-backend-diary-api after its implementation, phase-3-backend-actions-api after its implementation, phase-2-backend-brand after its implementation)
  - phase-6-backend-questionnaire-attention: phase 6-backend-questionnaire-attention, wave 10 — server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/services/historyService.ts, server/validation/companySchemas.ts, src/api/historyApi.ts, tests/api/questionnaireRoutes.test.ts (depends on phase-6-backend-questionnaire-api after its implementation, phase-5-backend-home after its implementation, phase-2-backend-evolution after its implementation)
  - phase-7-backend-backup: phase 7-backend-backup, wave 10 — server/validation/backupSchemas.ts, server/services/backupService.ts, src/api/backupApi.ts, tests/api/backupRoutes.test.ts, tests/api/playRoutes.test.ts, server/services/assistantSummaryService.ts, server/routes/playRoutes.ts (depends on phase-6-backend-questionnaire-api after its implementation, phase-4-backend-diary-api after its implementation, phase-3-backend-actions-api after its implementation, phase-5-backend-preferences after its implementation, phase-2-backend-brand after its implementation)
  - phase-7-backend-release: phase 7-backend-release, wave 11 — manifest.json, system.json, package.json, scripts/smoke-migrate.mjs, scripts/smoke-store-package.mjs (depends on phase-6-backend-questionnaire-api after its implementation, phase-6-backend-questionnaire-attention after its implementation, phase-7-backend-backup after its implementation)

# Unit contract — relatorios-e-acompanhamento / phase-1-backend-document

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 1-backend-document — wave 1 of 14
- Scope: CAP-ra-report-center, CAP-ra-diagnosis-report, CAP-ra-polish; AC-ra-05, AC-ra-09, AC-ra-10, AC-ra-11, AC-ra-23; IF-004
- Capabilities: CAP-ra-report-center, CAP-ra-diagnosis-report, CAP-ra-polish
- Acceptance criteria: AC-ra-05, AC-ra-09, AC-ra-10, AC-ra-11, AC-ra-23
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-01, AC-ra-02, AC-ra-03, AC-ra-04, AC-ra-06, AC-ra-07, AC-ra-08, AC-ra-24, AC-ra-25, AC-ra-57, AC-ra-58, AC-ra-60, AC-ra-61
- Allowed files (create/modify ONLY these):
  - shared/report/reportDocument.ts
  - shared/report/paperPalette.ts
  - shared/format/confidenceText.ts
  - server/report/reportCopy.ts
  - server/report/documentParts.ts
  - server/report/reportModel.ts
  - tests/unit/reportModel.test.ts
  - tests/unit/confidenceText.test.ts
  - tests/unit/forbiddenTerms.test.ts
- Done when: `pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/confidenceText.test.ts tests/unit/forbiddenTerms.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/confidenceText.test.ts tests/unit/forbiddenTerms.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-1-backend-files

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 1-backend-files — wave 1 of 14
- Scope: CAP-ra-pdf-delivery; AC-ra-18; IF-002
- Capabilities: CAP-ra-pdf-delivery
- Acceptance criteria: AC-ra-18
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-17, AC-ra-19, AC-ra-60
- Allowed files (create/modify ONLY these):
  - prisma/schema.prisma
  - prisma/migrations/20261026000000_generated_files/migration.sql
  - server/repositories/generatedFileRepository.ts
  - server/files/systemOpener.ts
  - server/services/fileService.ts
  - server/routes/fileRoutes.ts
  - server/app.ts
  - server/main.ts
  - src/api/filesApi.ts
  - tests/api/fileRoutes.test.ts
- Done when: `pnpm exec prisma validate` + `pnpm exec vitest run tests/api/fileRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam
- Verification:
  - `pnpm exec prisma validate` + `pnpm exec vitest run tests/api/fileRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-2-backend-brand

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 2-backend-brand — wave 1 of 14
- Scope: CAP-ra-brand; AC-ra-21; IF-003, IF-004
- Capabilities: CAP-ra-brand
- Acceptance criteria: AC-ra-21
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-20, AC-ra-22, AC-ra-57, AC-ra-59
- Allowed files (create/modify ONLY these):
  - shared/format/phone.ts
  - shared/format/contact.ts
  - tests/unit/contactFormat.test.ts
  - server/validation/brandSchemas.ts
  - server/files/imageSignature.ts
  - tests/unit/imageSignature.test.ts
  - server/services/brandService.ts
  - server/routes/brandRoutes.ts
  - server/repositories/preferenceRepository.ts
  - server/services/preferenceService.ts
- Done when: `pnpm exec vitest run tests/unit/contactFormat.test.ts tests/unit/imageSignature.test.ts tests/api/preferenceRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/unit/contactFormat.test.ts tests/unit/imageSignature.test.ts tests/api/preferenceRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-6-backend-questionnaire-file

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 6-backend-questionnaire-file — wave 1 of 14
- Scope: CAP-ra-remote-questionnaire; AC-ra-49, AC-ra-50; IF-004
- Capabilities: CAP-ra-remote-questionnaire
- Acceptance criteria: AC-ra-49, AC-ra-50
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-48, AC-ra-51, AC-ra-52, AC-ra-53, AC-ra-59
- Allowed files (create/modify ONLY these):
  - server/questionnaire/questionnaireFile.ts
  - server/questionnaire/questionnaireClient.js
  - server/questionnaire/questionnaireStyles.css
  - tests/unit/questionnaireFile.test.ts
  - shared/content/questionBank.ts
- Done when: `pnpm exec vitest run tests/unit/questionnaireFile.test.ts` passa e grava `test-results/questionario-exemplo.html` + smoke: teste Q-10 do dono (Gmail, Outlook e WhatsApp; Chrome, Edge, Firefox e Safari)
- Verification:
  - `pnpm exec vitest run tests/unit/questionnaireFile.test.ts` passa e grava `test-results/questionario-exemplo.html` + smoke: teste Q-10 do dono (Gmail, Outlook e WhatsApp; Chrome, Edge, Firefox e Safari)
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-1-backend-pdf

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 1-backend-pdf — wave 2 of 14
- Depends on: phase-1-backend-document (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-diagnosis-report; AC-ra-06, AC-ra-07, AC-ra-08
- Capabilities: CAP-ra-diagnosis-report
- Acceptance criteria: AC-ra-06, AC-ra-07, AC-ra-08
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-05, AC-ra-09, AC-ra-10, AC-ra-11
- Allowed files (create/modify ONLY these):
  - server/report/pdfRenderer.ts
  - server/report/pdfBlocks.ts
  - server/report/pdfCharts.ts
  - tests/unit/pdfRenderer.test.ts
- Done when: `pnpm exec vitest run tests/unit/pdfRenderer.test.ts tests/unit/reportModel.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/unit/pdfRenderer.test.ts tests/unit/reportModel.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-3-backend-action-domain

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 3-backend-action-domain — wave 2 of 14
- Depends on: phase-1-backend-files (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-action-tracking, CAP-ra-action-inheritance; AC-ra-31; IF-004
- Capabilities: CAP-ra-action-tracking, CAP-ra-action-inheritance
- Acceptance criteria: AC-ra-31
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-26, AC-ra-27, AC-ra-28, AC-ra-29, AC-ra-30, AC-ra-63, AC-ra-32, AC-ra-57
- Allowed files (create/modify ONLY these):
  - shared/domain/actionProgress.ts
  - shared/content/actionProgressOptions.ts
  - shared/format/dates.ts
  - tests/unit/actionProgress.test.ts
  - tests/unit/dates.test.ts
  - prisma/schema.prisma
  - prisma/migrations/20261026000100_action_progress/migration.sql
  - server/repositories/actionProgressRepository.ts
  - shared/domain/actionPlan.ts
- Done when: `pnpm exec prisma validate` + `pnpm exec vitest run tests/unit/actionProgress.test.ts tests/unit/dates.test.ts` + `node scripts/smoke-migrate.mjs` passam
- Verification:
  - `pnpm exec prisma validate` + `pnpm exec vitest run tests/unit/actionProgress.test.ts tests/unit/dates.test.ts` + `node scripts/smoke-migrate.mjs` passam
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-1-backend-report-api

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 1-backend-report-api — wave 3 of 14
- Depends on: phase-1-backend-pdf (after its implementation), phase-1-backend-files (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-report-center, CAP-ra-pdf-delivery; AC-ra-17, AC-ra-19; IF-001
- Capabilities: CAP-ra-report-center, CAP-ra-pdf-delivery
- Acceptance criteria: AC-ra-17, AC-ra-19
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-01, AC-ra-02, AC-ra-03, AC-ra-04, AC-ra-18, AC-ra-57, AC-ra-58, AC-ra-60, AC-ra-61
- Allowed files (create/modify ONLY these):
  - server/validation/reportSchemas.ts
  - server/services/reportService.ts
  - server/routes/reportRoutes.ts
  - server/files/downloadsFolder.ts
  - src/api/reportApi.ts
  - tests/api/reportRoutes.test.ts
- Done when: `pnpm exec vitest run tests/api/reportRoutes.test.ts tests/api/fileRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/api/reportRoutes.test.ts tests/api/fileRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-4-backend-diary-domain

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 4-backend-diary-domain — wave 3 of 14
- Depends on: phase-3-backend-action-domain (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-diary, CAP-ra-diary-prefill; AC-ra-41, AC-ra-44, AC-ra-45; IF-004
- Capabilities: CAP-ra-diary, CAP-ra-diary-prefill
- Acceptance criteria: AC-ra-41, AC-ra-44, AC-ra-45
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-38, AC-ra-39, AC-ra-40, AC-ra-42, AC-ra-43, AC-ra-46, AC-ra-47, AC-ra-57, AC-ra-58, AC-ra-59
- Allowed files (create/modify ONLY these):
  - shared/domain/diary.ts
  - tests/unit/diary.test.ts
  - shared/format/dates.ts
  - tests/unit/dates.test.ts
  - shared/domain/types.ts
  - shared/domain/unitEconomics.ts
  - shared/domain/completeness.ts
  - shared/domain/diaryPrefill.ts
  - tests/unit/unitEconomics.test.ts
  - tests/unit/diaryPrefill.test.ts
- Done when: `pnpm exec vitest run tests/unit/diary.test.ts tests/unit/dates.test.ts tests/unit/unitEconomics.test.ts tests/unit/diaryPrefill.test.ts tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts` passa sem mudar as expectativas da versão 1
- Verification:
  - `pnpm exec vitest run tests/unit/diary.test.ts tests/unit/dates.test.ts tests/unit/unitEconomics.test.ts tests/unit/diaryPrefill.test.ts tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts` passa sem mudar as expectativas da versão 1
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-2-backend-brand-reports

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 2-backend-brand-reports — wave 4 of 14
- Depends on: phase-2-backend-brand (after its implementation), phase-1-backend-report-api (after its implementation), phase-1-backend-pdf (after its implementation), phase-1-backend-files (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-brand; AC-ra-21, AC-ra-22; IF-003
- Capabilities: CAP-ra-brand
- Acceptance criteria: AC-ra-21, AC-ra-22
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-20, AC-ra-57, AC-ra-59
- Allowed files (create/modify ONLY these):
  - server/app.ts
  - src/api/brandApi.ts
  - tests/api/brandRoutes.test.ts
  - server/report/documentParts.ts
  - server/report/pdfRenderer.ts
  - server/services/reportService.ts
  - tests/unit/pdfRenderer.test.ts
- Done when: `pnpm exec vitest run tests/api/brandRoutes.test.ts tests/unit/pdfRenderer.test.ts tests/api/reportRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/api/brandRoutes.test.ts tests/unit/pdfRenderer.test.ts tests/api/reportRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-2-backend-evolution

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 2-backend-evolution — wave 5 of 14
- Depends on: phase-2-backend-brand-reports (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-evolution-report; AC-ra-12, AC-ra-13; IF-001, IF-004
- Capabilities: CAP-ra-evolution-report
- Acceptance criteria: AC-ra-12, AC-ra-13
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-11, AC-ra-14
- Allowed files (create/modify ONLY these):
  - server/services/historyService.ts
  - shared/domain/compareDiagnoses.ts
  - shared/content/comparisonCopy.ts
  - server/report/evolutionDocument.ts
  - server/validation/reportSchemas.ts
  - server/services/reportService.ts
  - tests/unit/evolutionDocument.test.ts
  - tests/fixtures/rulesV2.ts
- Done when: `pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/api/historyRoutes.test.ts tests/api/reportRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/api/historyRoutes.test.ts tests/api/reportRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-3-backend-actions-api

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 3-backend-actions-api — wave 5 of 14
- Depends on: phase-3-backend-action-domain (after its implementation), phase-2-backend-brand-reports (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-action-tracking, CAP-ra-action-inheritance; AC-ra-29, AC-ra-31, AC-ra-32; IF-005
- Capabilities: CAP-ra-action-tracking, CAP-ra-action-inheritance
- Acceptance criteria: AC-ra-29, AC-ra-31, AC-ra-32
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-26, AC-ra-27, AC-ra-28, AC-ra-30, AC-ra-63, AC-ra-57
- Allowed files (create/modify ONLY these):
  - server/validation/actionSchemas.ts
  - server/services/actionService.ts
  - server/routes/actionRoutes.ts
  - server/app.ts
  - src/api/actionsApi.ts
  - tests/api/actionRoutes.test.ts
  - server/repositories/diagnosisRepository.ts
  - server/services/diagnosisService.ts
  - tests/api/diagnosisRoutes.test.ts
- Done when: `pnpm exec vitest run tests/api/actionRoutes.test.ts tests/api/diagnosisRoutes.test.ts tests/api/historyRoutes.test.ts tests/api/companyRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/api/actionRoutes.test.ts tests/api/diagnosisRoutes.test.ts tests/api/historyRoutes.test.ts tests/api/companyRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-2-backend-portfolio

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 2-backend-portfolio — wave 6 of 14
- Depends on: phase-2-backend-evolution (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-portfolio-report, CAP-ra-evolution-report; AC-ra-11, AC-ra-15; IF-001, IF-008
- Capabilities: CAP-ra-portfolio-report, CAP-ra-evolution-report
- Acceptance criteria: AC-ra-11, AC-ra-15
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-12, AC-ra-13, AC-ra-14, AC-ra-16
- Allowed files (create/modify ONLY these):
  - shared/domain/followUp.ts
  - tests/unit/followUp.test.ts
  - server/repositories/portfolioRepository.ts
  - server/services/portfolioService.ts
  - server/services/homeService.ts
  - tests/api/homeRoutes.test.ts
  - server/report/portfolioDocument.ts
  - tests/unit/portfolioDocument.test.ts
  - server/services/reportService.ts
  - tests/unit/forbiddenTerms.test.ts
- Done when: `pnpm exec vitest run tests/unit/followUp.test.ts tests/unit/portfolioDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/homeRoutes.test.ts` passa com a tela do consultor igual
- Verification:
  - `pnpm exec vitest run tests/unit/followUp.test.ts tests/unit/portfolioDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/homeRoutes.test.ts` passa com a tela do consultor igual
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-4-backend-diary-api

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 4-backend-diary-api — wave 6 of 14
- Depends on: phase-4-backend-diary-domain (after its implementation), phase-3-backend-actions-api (after its implementation), phase-3-backend-action-domain (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-diary, CAP-ra-diary-prefill; AC-ra-39, AC-ra-43; IF-006
- Capabilities: CAP-ra-diary, CAP-ra-diary-prefill
- Acceptance criteria: AC-ra-39, AC-ra-43
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-38, AC-ra-40, AC-ra-41, AC-ra-42, AC-ra-44, AC-ra-45, AC-ra-46, AC-ra-47, AC-ra-57, AC-ra-58, AC-ra-59
- Allowed files (create/modify ONLY these):
  - prisma/schema.prisma
  - prisma/migrations/20261026000200_diary_entries/migration.sql
  - server/repositories/diaryRepository.ts
  - server/validation/diarySchemas.ts
  - server/services/diaryService.ts
  - server/routes/diaryRoutes.ts
  - server/app.ts
  - src/api/diaryApi.ts
  - tests/api/diaryRoutes.test.ts
  - shared/content/calculatorOptions.ts
- Done when: `pnpm exec vitest run tests/api/diaryRoutes.test.ts tests/api/companyRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam
- Verification:
  - `pnpm exec vitest run tests/api/diaryRoutes.test.ts tests/api/companyRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-3-backend-action-reports

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 3-backend-action-reports — wave 7 of 14
- Depends on: phase-3-backend-actions-api (after its implementation), phase-2-backend-portfolio (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-action-tracking, CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report; AC-ra-05, AC-ra-12, AC-ra-15; IF-001
- Capabilities: CAP-ra-action-tracking, CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report
- Acceptance criteria: AC-ra-05, AC-ra-12, AC-ra-15
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-06, AC-ra-07, AC-ra-08, AC-ra-09, AC-ra-10, AC-ra-11, AC-ra-13, AC-ra-14, AC-ra-16, AC-ra-26, AC-ra-27, AC-ra-28, AC-ra-29, AC-ra-30, AC-ra-63, AC-ra-57
- Allowed files (create/modify ONLY these):
  - server/repositories/portfolioRepository.ts
  - server/services/portfolioService.ts
  - server/report/reportModel.ts
  - server/report/evolutionDocument.ts
  - server/report/portfolioDocument.ts
  - server/services/reportService.ts
  - tests/unit/reportModel.test.ts
  - tests/unit/evolutionDocument.test.ts
  - tests/unit/portfolioDocument.test.ts
- Done when: `pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts tests/unit/portfolioDocument.test.ts tests/api/reportRoutes.test.ts tests/api/homeRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts tests/unit/portfolioDocument.test.ts tests/api/reportRoutes.test.ts tests/api/homeRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-5-backend-preferences

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 5-backend-preferences — wave 7 of 14
- Depends on: phase-2-backend-brand (after its implementation), phase-2-backend-portfolio (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-home-followup; AC-ra-34; IF-004, IF-009
- Capabilities: CAP-ra-home-followup
- Acceptance criteria: AC-ra-34
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-33, AC-ra-35, AC-ra-36, AC-ra-37, AC-ra-57, AC-ra-58, AC-ra-62
- Allowed files (create/modify ONLY these):
  - server/validation/preferenceSchemas.ts
  - server/services/preferenceService.ts
  - src/api/preferencesApi.ts
  - tests/api/preferenceRoutes.test.ts
  - shared/domain/followUp.ts
  - tests/unit/followUp.test.ts
- Done when: `pnpm exec vitest run tests/api/preferenceRoutes.test.ts tests/unit/followUp.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/api/preferenceRoutes.test.ts tests/unit/followUp.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-4-backend-diary-prefill

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 4-backend-diary-prefill — wave 8 of 14
- Depends on: phase-4-backend-diary-api (after its implementation), phase-3-backend-action-reports (after its implementation), phase-3-backend-actions-api (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-diary-prefill, CAP-ra-evolution-report; AC-ra-12, AC-ra-46, AC-ra-47; IF-007
- Capabilities: CAP-ra-diary-prefill, CAP-ra-evolution-report
- Acceptance criteria: AC-ra-12, AC-ra-46, AC-ra-47
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-11, AC-ra-13, AC-ra-14, AC-ra-44, AC-ra-45
- Allowed files (create/modify ONLY these):
  - server/validation/diagnosisSchemas.ts
  - server/services/diagnosisService.ts
  - server/routes/diagnosisRoutes.ts
  - src/api/diagnosesApi.ts
  - tests/api/diagnosisRoutes.test.ts
  - server/report/reportModel.ts
  - server/report/evolutionDocument.ts
  - server/services/reportService.ts
  - tests/unit/reportModel.test.ts
  - tests/unit/evolutionDocument.test.ts
- Done when: `pnpm exec vitest run tests/api/diagnosisRoutes.test.ts tests/api/backupRoutes.test.ts tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/api/diagnosisRoutes.test.ts tests/api/backupRoutes.test.ts tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-5-backend-home

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 5-backend-home — wave 8 of 14
- Depends on: phase-5-backend-preferences (after its implementation), phase-3-backend-action-reports (after its implementation), phase-4-backend-diary-api (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-home-followup; AC-ra-33, AC-ra-35, AC-ra-36; IF-008, IF-010
- Capabilities: CAP-ra-home-followup
- Acceptance criteria: AC-ra-33, AC-ra-35, AC-ra-36
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-34, AC-ra-37, AC-ra-57, AC-ra-58, AC-ra-62
- Allowed files (create/modify ONLY these):
  - server/services/portfolioService.ts
  - server/services/homeService.ts
  - src/api/homeApi.ts
  - tests/api/homeRoutes.test.ts
  - server/validation/companySchemas.ts
  - server/services/companyService.ts
  - server/app.ts
  - src/api/companiesApi.ts
  - tests/api/companyRoutes.test.ts
- Done when: `pnpm exec vitest run tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/preferenceRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/preferenceRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-6-backend-questionnaire-api

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 6-backend-questionnaire-api — wave 9 of 14
- Depends on: phase-6-backend-questionnaire-file (after its implementation), phase-5-backend-home (after its implementation), phase-4-backend-diary-api (after its implementation), phase-3-backend-actions-api (after its implementation), phase-2-backend-brand (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-remote-questionnaire; AC-ra-48, AC-ra-51, AC-ra-52, AC-ra-53; IF-011
- Capabilities: CAP-ra-remote-questionnaire
- Acceptance criteria: AC-ra-48, AC-ra-51, AC-ra-52, AC-ra-53
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-49, AC-ra-50, AC-ra-59
- Allowed files (create/modify ONLY these):
  - prisma/schema.prisma
  - prisma/migrations/20261026000300_questionnaire_sends/migration.sql
  - server/validation/questionnaireSchemas.ts
  - server/repositories/questionnaireRepository.ts
  - server/repositories/diagnosisRepository.ts
  - server/services/questionnaireService.ts
  - server/routes/questionnaireRoutes.ts
  - server/app.ts
  - src/api/questionnaireApi.ts
  - tests/api/questionnaireRoutes.test.ts
- Done when: `pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/diagnosisRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam
- Verification:
  - `pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/diagnosisRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-6-backend-questionnaire-attention

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 6-backend-questionnaire-attention — wave 10 of 14
- Depends on: phase-6-backend-questionnaire-api (after its implementation), phase-5-backend-home (after its implementation), phase-2-backend-evolution (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-remote-questionnaire; AC-ra-35, AC-ra-48, AC-ra-51; IF-008, IF-010, IF-011
- Capabilities: CAP-ra-remote-questionnaire
- Acceptance criteria: AC-ra-35, AC-ra-48, AC-ra-51
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-49, AC-ra-50, AC-ra-52, AC-ra-53, AC-ra-59
- Allowed files (create/modify ONLY these):
  - server/repositories/portfolioRepository.ts
  - server/services/portfolioService.ts
  - server/services/historyService.ts
  - server/validation/companySchemas.ts
  - src/api/historyApi.ts
  - tests/api/questionnaireRoutes.test.ts
- Done when: `pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/historyRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/historyRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-7-backend-backup

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 7-backend-backup — wave 10 of 14
- Depends on: phase-6-backend-questionnaire-api (after its implementation), phase-4-backend-diary-api (after its implementation), phase-3-backend-actions-api (after its implementation), phase-5-backend-preferences (after its implementation), phase-2-backend-brand (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-data-continuity; AC-ra-55, AC-ra-56; IF-012
- Capabilities: CAP-ra-data-continuity
- Acceptance criteria: AC-ra-55, AC-ra-56
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-54
- Allowed files (create/modify ONLY these):
  - server/validation/backupSchemas.ts
  - server/services/backupService.ts
  - src/api/backupApi.ts
  - tests/api/backupRoutes.test.ts
  - tests/api/playRoutes.test.ts
  - server/services/assistantSummaryService.ts
  - server/routes/playRoutes.ts
- Done when: `pnpm exec vitest run tests/api/backupRoutes.test.ts tests/api/playRoutes.test.ts` passa
- Verification:
  - `pnpm exec vitest run tests/api/backupRoutes.test.ts tests/api/playRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — relatorios-e-acompanhamento / phase-7-backend-release

- Feature: relatorios-e-acompanhamento
- Lane: backend (write paths: prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json)
- Phase: 7-backend-release — wave 11 of 14
- Depends on: phase-6-backend-questionnaire-api (after its implementation), phase-6-backend-questionnaire-attention (after its implementation), phase-7-backend-backup (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-data-continuity; AC-ra-54
- Capabilities: CAP-ra-data-continuity
- Acceptance criteria: AC-ra-54
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-55, AC-ra-56
- Allowed files (create/modify ONLY these):
  - manifest.json
  - system.json
  - package.json
  - scripts/smoke-migrate.mjs
  - scripts/smoke-store-package.mjs
- Done when: `node scripts/smoke-migrate.mjs` + `node --check scripts/smoke-store-package.mjs` passam
- Verification:
  - `node scripts/smoke-migrate.mjs` + `node --check scripts/smoke-store-package.mjs` passam
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.
