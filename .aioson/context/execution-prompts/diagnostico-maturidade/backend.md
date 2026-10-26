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

# Lane contract — diagnostico-maturidade / backend

- Write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore
- Units in wave order (15); units of other lanes run concurrently on disjoint files:
  - phase-1-backend-foundation: phase 1-backend-foundation, wave 1 — package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, .gitignore, manifest.json, prisma.config.ts, prisma/schema.prisma, server/db/databaseUrl.ts
  - phase-1-backend-db: phase 1-backend-db, wave 2 — prisma/migrations/migration_lock.toml, prisma/migrations/20261023000000_init/migration.sql, scripts/prepare-app.mjs, scripts/smoke-migrate.mjs, server/db/prismaClient.ts, tests/helpers/testDatabase.ts (depends on phase-1-backend-foundation after its implementation)
  - phase-1-backend-content: phase 1-backend-content, wave 2 — shared/rules/rulesV1.ts, shared/content/stageContent.ts, shared/content/riskCatalog.ts, shared/content/actionCatalog.ts, shared/content/questionBank.ts, shared/content/calculatorOptions.ts, shared/domain/types.ts, tests/unit/questionBank.test.ts, tests/unit/forbiddenTerms.test.ts (depends on phase-1-backend-foundation after its implementation)
  - phase-1-backend-formats: phase 1-backend-formats, wave 2 — shared/format/cnpj.ts, shared/format/money.ts, shared/format/displayNumbers.ts, shared/content/companyOptions.ts, tests/unit/cnpj.test.ts, tests/unit/money.test.ts (depends on phase-1-backend-foundation after its implementation)
  - phase-1-backend-rules: phase 1-backend-rules, wave 3 — shared/domain/unitEconomics.ts, shared/domain/dimensionScores.ts, shared/domain/stageGate.ts, shared/domain/confidence.ts, shared/domain/riskSignals.ts, shared/domain/completeness.ts, tests/unit/unitEconomics.test.ts, tests/unit/diagnosisRules.test.ts (depends on phase-1-backend-content after its implementation, phase-1-backend-formats after its implementation)
  - phase-1-backend-http: phase 1-backend-http, wave 3 — server/main.ts, server/app.ts, server/http/requestGuards.ts, server/http/errorHandler.ts, server/services/domainError.ts, server/routes/playRoutes.ts, server/services/assistantSummaryService.ts, tests/api/playRoutes.test.ts (depends on phase-1-backend-db after its implementation, phase-1-backend-content after its implementation)
  - phase-1-backend-package: phase 1-backend-package, wave 3 — system.json, scripts/smoke-boot.mjs, scripts/smoke-store-package.mjs (depends on phase-1-backend-db after its implementation)
  - phase-1-backend-evaluate: phase 1-backend-evaluate, wave 4 — shared/domain/actionPlan.ts, shared/domain/evaluateDiagnosis.ts, tests/fixtures/rulesV2.ts, tests/unit/evaluateDiagnosis.test.ts (depends on phase-1-backend-rules after its implementation)
  - phase-1-backend-companies: phase 1-backend-companies, wave 4 — server/routes/companyRoutes.ts, server/services/companyService.ts, server/repositories/companyRepository.ts, server/validation/companySchemas.ts, server/app.ts, tests/api/companyRoutes.test.ts (depends on phase-1-backend-http after its implementation, phase-1-backend-formats after its implementation)
  - phase-1-backend-diagnoses: phase 1-backend-diagnoses, wave 5 — server/routes/diagnosisRoutes.ts, server/services/diagnosisService.ts, server/repositories/diagnosisRepository.ts, server/validation/diagnosisSchemas.ts, server/app.ts, tests/api/diagnosisRoutes.test.ts (depends on phase-1-backend-evaluate after its implementation, phase-1-backend-companies after its implementation)
  - phase-2-backend-history: phase 2-backend-history, wave 6 — shared/domain/compareDiagnoses.ts, server/routes/historyRoutes.ts, server/services/historyService.ts, server/app.ts, tests/unit/compareDiagnoses.test.ts, tests/api/historyRoutes.test.ts (depends on phase-1-backend-diagnoses after its implementation)
  - phase-2-backend-report: phase 2-backend-report, wave 7 — server/files/downloadsFolder.ts, server/report/reportModel.ts, server/report/pdfRenderer.ts, server/services/reportService.ts, server/routes/reportRoutes.ts, server/app.ts, tests/unit/reportModel.test.ts, tests/api/reportRoutes.test.ts (depends on phase-2-backend-history after its implementation)
  - phase-3-backend-preferences: phase 3-backend-preferences, wave 8 — server/routes/preferenceRoutes.ts, server/services/preferenceService.ts, server/repositories/preferenceRepository.ts, server/validation/preferenceSchemas.ts, server/app.ts, tests/api/preferenceRoutes.test.ts (depends on phase-2-backend-report after its implementation)
  - phase-3-backend-home: phase 3-backend-home, wave 9 — server/routes/homeRoutes.ts, server/services/homeService.ts, server/app.ts, tests/api/homeRoutes.test.ts (depends on phase-3-backend-preferences after its implementation)
  - phase-4-backend-backup: phase 4-backend-backup, wave 10 — server/validation/backupSchemas.ts, server/services/backupService.ts, server/routes/backupRoutes.ts, server/app.ts, tests/api/backupRoutes.test.ts (depends on phase-3-backend-home after its implementation, phase-2-backend-report after its implementation)

# Unit contract — diagnostico-maturidade / phase-1-backend-foundation

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-foundation — wave 1 of 13
- Scope: CAP-dm-play-runtime; AC-dm-40
- Capabilities: CAP-dm-play-runtime
- Acceptance criteria: AC-dm-40
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-41, AC-dm-42, AC-dm-43, AC-dm-44, AC-dm-45, AC-dm-50
- Allowed files (create/modify ONLY these):
  - package.json
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - tsconfig.json
  - vitest.config.ts
  - .gitignore
  - manifest.json
  - prisma.config.ts
  - prisma/schema.prisma
  - server/db/databaseUrl.ts
- Done when: `pnpm install` sai com 0 sem build ignorado e `pnpm exec prisma validate` passa; `manifest.json` sem `requires_services` nem `auth`
- Verification:
  - `pnpm install` sai com 0 sem build ignorado e `pnpm exec prisma validate` passa; `manifest.json` sem `requires_services` nem `auth`
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-db

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-db — wave 2 of 13
- Depends on: phase-1-backend-foundation (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-play-runtime; AC-dm-45
- Capabilities: CAP-dm-play-runtime
- Acceptance criteria: AC-dm-45
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-40, AC-dm-41, AC-dm-42, AC-dm-43, AC-dm-44, AC-dm-50
- Allowed files (create/modify ONLY these):
  - prisma/migrations/migration_lock.toml
  - prisma/migrations/20261023000000_init/migration.sql
  - scripts/prepare-app.mjs
  - scripts/smoke-migrate.mjs
  - server/db/prismaClient.ts
  - tests/helpers/testDatabase.ts
- Done when: `node scripts/smoke-migrate.mjs` sai com 0
- Verification:
  - `node scripts/smoke-migrate.mjs` sai com 0
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-content

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-content — wave 2 of 13
- Depends on: phase-1-backend-foundation (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-engine, CAP-dm-questionnaire, CAP-dm-result; AC-dm-10, AC-dm-11, AC-dm-29; IF-004
- Capabilities: CAP-dm-engine, CAP-dm-questionnaire, CAP-dm-result
- Acceptance criteria: AC-dm-10, AC-dm-11, AC-dm-29
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-12, AC-dm-13, AC-dm-14, AC-dm-16, AC-dm-17, AC-dm-18, AC-dm-19, AC-dm-20, AC-dm-21, AC-dm-22, AC-dm-23, AC-dm-24, AC-dm-25, AC-dm-26, AC-dm-27, AC-dm-28, AC-dm-46, AC-dm-47, AC-dm-49, AC-dm-48
- Allowed files (create/modify ONLY these):
  - shared/rules/rulesV1.ts
  - shared/content/stageContent.ts
  - shared/content/riskCatalog.ts
  - shared/content/actionCatalog.ts
  - shared/content/questionBank.ts
  - shared/content/calculatorOptions.ts
  - shared/domain/types.ts
  - tests/unit/questionBank.test.ts
  - tests/unit/forbiddenTerms.test.ts
- Done when: `pnpm test -- tests/unit/questionBank.test.ts tests/unit/forbiddenTerms.test.ts` passa
- Verification:
  - `pnpm test -- tests/unit/questionBank.test.ts tests/unit/forbiddenTerms.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-formats

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-formats — wave 2 of 13
- Depends on: phase-1-backend-foundation (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-company, CAP-dm-unit-economics; AC-dm-08; IF-004
- Capabilities: CAP-dm-company, CAP-dm-unit-economics
- Acceptance criteria: AC-dm-08
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-04, AC-dm-05, AC-dm-06, AC-dm-07, AC-dm-09, AC-dm-15, AC-dm-46, AC-dm-48, AC-dm-51
- Allowed files (create/modify ONLY these):
  - shared/format/cnpj.ts
  - shared/format/money.ts
  - shared/format/displayNumbers.ts
  - shared/content/companyOptions.ts
  - tests/unit/cnpj.test.ts
  - tests/unit/money.test.ts
- Done when: `pnpm test -- tests/unit/cnpj.test.ts tests/unit/money.test.ts` passa
- Verification:
  - `pnpm test -- tests/unit/cnpj.test.ts tests/unit/money.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-rules

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-rules — wave 3 of 13
- Depends on: phase-1-backend-content (after its implementation), phase-1-backend-formats (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-unit-economics, CAP-dm-engine, CAP-dm-questionnaire; AC-dm-15, AC-dm-51, AC-dm-19, AC-dm-21, AC-dm-23, AC-dm-24; IF-004
- Capabilities: CAP-dm-unit-economics, CAP-dm-engine, CAP-dm-questionnaire
- Acceptance criteria: AC-dm-15, AC-dm-51, AC-dm-19, AC-dm-21, AC-dm-23, AC-dm-24
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-10, AC-dm-11, AC-dm-12, AC-dm-13, AC-dm-14, AC-dm-16, AC-dm-17, AC-dm-18, AC-dm-20, AC-dm-22, AC-dm-25, AC-dm-26, AC-dm-27, AC-dm-46, AC-dm-49, AC-dm-48
- Allowed files (create/modify ONLY these):
  - shared/domain/unitEconomics.ts
  - shared/domain/dimensionScores.ts
  - shared/domain/stageGate.ts
  - shared/domain/confidence.ts
  - shared/domain/riskSignals.ts
  - shared/domain/completeness.ts
  - tests/unit/unitEconomics.test.ts
  - tests/unit/diagnosisRules.test.ts
- Done when: `pnpm test -- tests/unit/unitEconomics.test.ts tests/unit/diagnosisRules.test.ts` passa
- Verification:
  - `pnpm test -- tests/unit/unitEconomics.test.ts tests/unit/diagnosisRules.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-http

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-http — wave 3 of 13
- Depends on: phase-1-backend-db (after its implementation), phase-1-backend-content (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-play-runtime; AC-dm-41, AC-dm-42; IF-001, IF-010
- Capabilities: CAP-dm-play-runtime
- Acceptance criteria: AC-dm-41, AC-dm-42
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-40, AC-dm-43, AC-dm-44, AC-dm-45, AC-dm-50
- Allowed files (create/modify ONLY these):
  - server/main.ts
  - server/app.ts
  - server/http/requestGuards.ts
  - server/http/errorHandler.ts
  - server/services/domainError.ts
  - server/routes/playRoutes.ts
  - server/services/assistantSummaryService.ts
  - tests/api/playRoutes.test.ts
- Done when: `pnpm test -- tests/api/playRoutes.test.ts` passa
- Verification:
  - `pnpm test -- tests/api/playRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-package

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-package — wave 3 of 13
- Depends on: phase-1-backend-db (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-play-runtime; AC-dm-44
- Capabilities: CAP-dm-play-runtime
- Acceptance criteria: AC-dm-44
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-40, AC-dm-41, AC-dm-42, AC-dm-43, AC-dm-45, AC-dm-50
- Allowed files (create/modify ONLY these):
  - system.json
  - scripts/smoke-boot.mjs
  - scripts/smoke-store-package.mjs
- Done when: `node --check scripts/smoke-boot.mjs`, `node --check scripts/smoke-store-package.mjs` e `aioson system:package . --dry-run` saem com 0, e a lista não tem `data/`, `*.db` nem lockfile
- Verification:
  - `node --check scripts/smoke-boot.mjs`, `node --check scripts/smoke-store-package.mjs` e `aioson system:package . --dry-run` saem com 0, e a lista não tem `data/`, `*.db` nem lockfile
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-evaluate

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-evaluate — wave 4 of 13
- Depends on: phase-1-backend-rules (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-engine; AC-dm-18, AC-dm-20, AC-dm-25, AC-dm-26, AC-dm-49; IF-004
- Capabilities: CAP-dm-engine
- Acceptance criteria: AC-dm-18, AC-dm-20, AC-dm-25, AC-dm-26, AC-dm-49
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-19, AC-dm-21, AC-dm-22, AC-dm-23, AC-dm-24, AC-dm-27
- Allowed files (create/modify ONLY these):
  - shared/domain/actionPlan.ts
  - shared/domain/evaluateDiagnosis.ts
  - tests/fixtures/rulesV2.ts
  - tests/unit/evaluateDiagnosis.test.ts
- Done when: `pnpm test -- tests/unit/evaluateDiagnosis.test.ts` passa com G1–G4 exatos
- Verification:
  - `pnpm test -- tests/unit/evaluateDiagnosis.test.ts` passa com G1–G4 exatos
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-companies

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-companies — wave 4 of 13
- Depends on: phase-1-backend-http (after its implementation), phase-1-backend-formats (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-company; AC-dm-07, AC-dm-09; IF-002
- Capabilities: CAP-dm-company
- Acceptance criteria: AC-dm-07, AC-dm-09
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-04, AC-dm-05, AC-dm-06, AC-dm-08, AC-dm-46, AC-dm-48
- Allowed files (create/modify ONLY these):
  - server/routes/companyRoutes.ts
  - server/services/companyService.ts
  - server/repositories/companyRepository.ts
  - server/validation/companySchemas.ts
  - server/app.ts
  - tests/api/companyRoutes.test.ts
- Done when: `pnpm test -- tests/api/companyRoutes.test.ts` passa
- Verification:
  - `pnpm test -- tests/api/companyRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-1-backend-diagnoses

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 1-backend-diagnoses — wave 5 of 13
- Depends on: phase-1-backend-evaluate (after its implementation), phase-1-backend-companies (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-questionnaire, CAP-dm-engine; AC-dm-13, AC-dm-16, AC-dm-22; IF-003
- Capabilities: CAP-dm-questionnaire, CAP-dm-engine
- Acceptance criteria: AC-dm-13, AC-dm-16, AC-dm-22
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-10, AC-dm-11, AC-dm-12, AC-dm-14, AC-dm-17, AC-dm-18, AC-dm-19, AC-dm-20, AC-dm-21, AC-dm-23, AC-dm-24, AC-dm-25, AC-dm-26, AC-dm-27, AC-dm-46, AC-dm-49, AC-dm-48
- Allowed files (create/modify ONLY these):
  - server/routes/diagnosisRoutes.ts
  - server/services/diagnosisService.ts
  - server/repositories/diagnosisRepository.ts
  - server/validation/diagnosisSchemas.ts
  - server/app.ts
  - tests/api/diagnosisRoutes.test.ts
- Done when: `pnpm test -- tests/api/diagnosisRoutes.test.ts` passa, inclusive o resumo do assistente depois de uma conclusão real
- Verification:
  - `pnpm test -- tests/api/diagnosisRoutes.test.ts` passa, inclusive o resumo do assistente depois de uma conclusão real
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-2-backend-history

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 2-backend-history — wave 6 of 13
- Depends on: phase-1-backend-diagnoses (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-history; AC-dm-30, AC-dm-31; IF-005
- Capabilities: CAP-dm-history
- Acceptance criteria: AC-dm-30, AC-dm-31
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-48
- Allowed files (create/modify ONLY these):
  - shared/domain/compareDiagnoses.ts
  - server/routes/historyRoutes.ts
  - server/services/historyService.ts
  - server/app.ts
  - tests/unit/compareDiagnoses.test.ts
  - tests/api/historyRoutes.test.ts
- Done when: `pnpm test -- tests/unit/compareDiagnoses.test.ts tests/api/historyRoutes.test.ts` passa
- Verification:
  - `pnpm test -- tests/unit/compareDiagnoses.test.ts tests/api/historyRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-2-backend-report

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 2-backend-report — wave 7 of 13
- Depends on: phase-2-backend-history (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-report; AC-dm-36; IF-006
- Capabilities: CAP-dm-report
- Acceptance criteria: AC-dm-36
- Allowed files (create/modify ONLY these):
  - server/files/downloadsFolder.ts
  - server/report/reportModel.ts
  - server/report/pdfRenderer.ts
  - server/services/reportService.ts
  - server/routes/reportRoutes.ts
  - server/app.ts
  - tests/unit/reportModel.test.ts
  - tests/api/reportRoutes.test.ts
- Done when: `pnpm test -- tests/unit/reportModel.test.ts tests/api/reportRoutes.test.ts` passa
- Verification:
  - `pnpm test -- tests/unit/reportModel.test.ts tests/api/reportRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-3-backend-preferences

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 3-backend-preferences — wave 8 of 13
- Depends on: phase-2-backend-report (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-settings; AC-dm-38; IF-008
- Capabilities: CAP-dm-settings
- Acceptance criteria: AC-dm-38
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-39, AC-dm-46
- Allowed files (create/modify ONLY these):
  - server/routes/preferenceRoutes.ts
  - server/services/preferenceService.ts
  - server/repositories/preferenceRepository.ts
  - server/validation/preferenceSchemas.ts
  - server/app.ts
  - tests/api/preferenceRoutes.test.ts
- Done when: `pnpm test -- tests/api/preferenceRoutes.test.ts` passa
- Verification:
  - `pnpm test -- tests/api/preferenceRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-3-backend-home

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 3-backend-home — wave 9 of 13
- Depends on: phase-3-backend-preferences (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-home; AC-dm-33, AC-dm-34; IF-007
- Capabilities: CAP-dm-home
- Acceptance criteria: AC-dm-33, AC-dm-34
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-dm-32, AC-dm-35, AC-dm-46, AC-dm-47
- Allowed files (create/modify ONLY these):
  - server/routes/homeRoutes.ts
  - server/services/homeService.ts
  - server/app.ts
  - tests/api/homeRoutes.test.ts
- Done when: `pnpm test -- tests/api/homeRoutes.test.ts` passa
- Verification:
  - `pnpm test -- tests/api/homeRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

# Unit contract — diagnostico-maturidade / phase-4-backend-backup

- Feature: diagnostico-maturidade
- Lane: backend (write paths: server/**, shared/**, prisma/**, scripts/**, tests/api/**, tests/unit/**, tests/helpers/**, tests/fixtures/**, package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig.json, vitest.config.ts, prisma.config.ts, manifest.json, system.json, .gitignore)
- Phase: 4-backend-backup — wave 10 of 13
- Depends on: phase-3-backend-home (after its implementation), phase-2-backend-report (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-dm-backup; AC-dm-37; IF-009
- Capabilities: CAP-dm-backup
- Acceptance criteria: AC-dm-37
- Allowed files (create/modify ONLY these):
  - server/validation/backupSchemas.ts
  - server/services/backupService.ts
  - server/routes/backupRoutes.ts
  - server/app.ts
  - tests/api/backupRoutes.test.ts
- Done when: `pnpm test -- tests/api/backupRoutes.test.ts` passa
- Verification:
  - `pnpm test -- tests/api/backupRoutes.test.ts` passa
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.
