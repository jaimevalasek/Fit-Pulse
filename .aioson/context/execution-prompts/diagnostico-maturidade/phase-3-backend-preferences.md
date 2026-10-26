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

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-dm-38 | CAP-dm-settings | Configurações permite trocar entre "Minha empresa" e "Consultoria", escolher a empresa em foco e o tema "Escuro" ou "Claro"; as escolhas valem na hora e continuam depois de fechar e abrir o app | teste e2e com recarga · interação do protótipo: `switch-usage-mode`, `switch-theme |
| AC-dm-39 | CAP-dm-settings | Configurações explica como ler os resultados (orientação, versão do cálculo) e lista exatamente o que o assistente do Play pode ler | teste e2e |
| AC-dm-46 | CAP-dm-home, CAP-dm-questionnaire, CAP-dm-result, CAP-dm-company, CAP-dm-settings | Em 390 px de largura não há rolagem horizontal em nenhuma tela; os alvos de toque têm pelo menos 44 px (ou ficam dentro de um rótulo clicável desse tamanho); o foco do teclado é sempre visível; o texto tem contraste de pelo menos 4,5:1 nos temas escuro e claro | verificação visual em runtime (`verify:artifact --kind=visual --runtime`) + teste e2e por teclado |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-dm-settings | 3 | server/routes/preferenceRoutes.ts, server/services/preferenceService.ts, server/repositories/preferenceRepository.ts, server/validation/preferenceSchemas.ts, server/app.ts, src/api/preferencesApi.ts, src/features/preferences/PreferencesProvider.tsx, src/features/settings/SettingsPage.tsx, src/components/layout/AppShell.tsx, src/main.tsx, src/App.tsx, tests/api/preferenceRoutes.test.ts, tests/e2e/settings.spec.ts, tests/e2e/accessibility.spec.ts | pnpm test -- tests/api/preferenceRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/settings.spec.ts tests/e2e/accessibility.spec.ts |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-dm-settings | create | server/routes/preferenceRoutes.ts | GET/PUT /api/preferences |
| CAP-dm-settings | create | server/services/preferenceService.ts | Lê e grava as preferências |
| CAP-dm-settings | create | server/repositories/preferenceRepository.ts | Tabela `preferences` (chave e valor) |
| CAP-dm-settings | create | server/validation/preferenceSchemas.ts | Modo `owner\|consultant`, empresa em foco ativa e existente, tema `dark\|light`, tour visto por modo |
| CAP-dm-settings | create | server/app.ts | Monta `preferenceRoutes |
| CAP-dm-settings | create | src/api/preferencesApi.ts | Chamadas das preferências |
| CAP-dm-settings | create | src/features/preferences/PreferencesProvider.tsx | Carrega antes da primeira tela, aplica `data-theme` no `<html>` e grava cada troca |
| CAP-dm-settings | create | src/features/settings/SettingsPage.tsx | #/configuracoes`: modo, empresa em foco, tema; "Como ler os resultados"; "O que o assistente do Play pode ler" com exatamente os campos da RULE-dm-17; nota de segurança (OQ-6) |
| CAP-dm-settings | create | src/components/layout/AppShell.tsx | Navegação Início, Empresas e Configurações conforme o modo (BR-dm-09) |
| CAP-dm-settings | create | src/main.tsx | Envolve o app no PreferencesProvider |
| CAP-dm-settings | create | src/App.tsx | Rota `#/configuracoes |
| CAP-dm-settings | create | tests/api/preferenceRoutes.test.ts | Gravação, leitura e valores inválidos |
| CAP-dm-settings | create | tests/e2e/settings.spec.ts | Troca de modo, empresa em foco e tema valendo na hora e depois de recarregar; textos da AC-dm-39 |
| CAP-dm-settings | create | tests/e2e/accessibility.spec.ts | Todas as rotas nos dois temas em 390 px: sem rolagem horizontal, alvos ≥ 44 px, foco visível pelo teclado, contraste pelo axe; movimento reduzido no estado final |

## Plan section for this phase (from the plan)

## Phase 3 — A tela inicial orienta a próxima decisão nos dois modos, com assistente de primeiro uso, tour e configurações

- CAP/AC:
  - CAP-dm-home: AC-dm-32, AC-dm-33, AC-dm-34, AC-dm-35.
  - CAP-dm-first-run: AC-dm-01, AC-dm-02, AC-dm-03.
  - CAP-dm-settings: AC-dm-38, AC-dm-39.
  - Nas telas desta fase e na varredura de todas as rotas: AC-dm-46, AC-dm-47.
  - Interações do protótipo: `wizard-choose-mode`, `wizard-create-company`, `switch-usage-mode`, `tour-reopen`, `switch-theme`.
- User-visible outcome:
  - Sem empresas, o app abre no assistente, e o assistente leva até "Seus números".
  - A tela inicial mostra a empresa em foco (modo empresa) ou a carteira por estágio e as listas de atenção (modo consultoria). Cada indicador leva à lista filtrada.
  - O tour aparece na primeira abertura e reabre pelo "?".
  - Configurações troca modo, empresa em foco e tema, e as escolhas continuam depois de fechar o app.
- Implementation:
  - Preferências (repositório, serviço, rotas, provider que aplica o tema antes da primeira tela).
  - `homeService` com relógio injetado e `homeRoutes`.
  - Telas inicial, assistente e tour.
  - Configurações.
  - Rota raiz decide entre assistente e tela inicial.
  - Varredura de acessibilidade de todas as rotas.
- Create/modify/reuse/retire:
  - CAP-dm-home: create `server/routes/homeRoutes.ts`; create `server/services/homeService.ts`; create `server/app.ts`; create `src/api/homeApi.ts`; create `src/features/home/HomePage.tsx`; create `src/features/home/OwnerHome.tsx`; create `src/features/home/ConsultantHome.tsx`; create `src/features/home/ScoreTrend.tsx`; create `src/App.tsx`; create `tests/api/homeRoutes.test.ts`; create `tests/e2e/home.spec.ts`
  - CAP-dm-settings: create `server/routes/preferenceRoutes.ts`; create `server/services/preferenceService.ts`; create `server/repositories/preferenceRepository.ts`; create `server/validation/preferenceSchemas.ts`; create `server/app.ts`; create `src/api/preferencesApi.ts`; create `src/features/preferences/PreferencesProvider.tsx`; create `src/features/settings/SettingsPage.tsx`; create `src/components/layout/AppShell.tsx`; create `src/main.tsx`; create `src/App.tsx`; create `tests/api/preferenceRoutes.test.ts`; create `tests/e2e/settings.spec.ts`; create `tests/e2e/accessibility.spec.ts`
  - CAP-dm-first-run: create `src/features/firstRun/WelcomeModePage.tsx`; create `src/features/firstRun/WelcomeCompanyPage.tsx`; create `src/features/home/OnboardingTour.tsx`; create `src/components/layout/AppShell.tsx`; create `src/App.tsx`; create `tests/e2e/firstRun.spec.ts`
- Verification:
  - Testes da fase: `pnpm test -- tests/api/homeRoutes.test.ts tests/api/preferenceRoutes.test.ts` e `pnpm test:e2e -- tests/e2e/firstRun.spec.ts tests/e2e/home.spec.ts tests/e2e/settings.spec.ts tests/e2e/accessibility.spec.ts`.
  - Regressão: `pnpm test` e `pnpm test:e2e` completos.
  - No dev-link do Play, com `data/` apagado: o app abre no assistente.
- Done when:
  - No Play, sem dados, o app abre no assistente e termina em "Seus números".
  - Depois de concluir, a tela inicial mostra os números reais nos dois modos.
  - Tema e modo continuam depois de reabrir.
  - As suítes completas saem com código 0.

## Context contract

- Plan: .aioson/context/implementation-plan-diagnostico-maturidade.md — your phase section and table rows are embedded above; open the whole plan only for a cross-reference.
- PRD: .aioson/context/prd-diagnostico-maturidade.md — the acceptance criteria of your capabilities are embedded above; open it only for a business rule they cite.
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=server/routes/preferenceRoutes.ts,server/services/preferenceService.ts,server/repositories/preferenceRepository.ts,server/validation/preferenceSchemas.ts,server/app.ts,tests/api/preferenceRoutes.test.ts --task="unit phase-3-backend-preferences of diagnostico-maturidade"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
