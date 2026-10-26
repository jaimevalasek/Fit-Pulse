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

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-dm-04 | CAP-dm-company | "Nova empresa" abre o formulário com nome (obrigatório, 2 a 80 caracteres), segmento (obrigatório), como vende (obrigatório), faturamento (opcional) e CNPJ (opcional); salvar mostra a empresa criada | teste e2e (cria e confere na lista) · interação do protótipo: `company-create |
| AC-dm-05 | CAP-dm-company | Editar uma empresa mostra os mesmos campos do cadastro já preenchidos; salvar altera só aquela empresa, e a lista mostra o novo valor | teste e2e (edita uma linha específica e confere o registro certo) · interação do protótipo: `company-edit |
| AC-dm-06 | CAP-dm-company | Arquivar uma empresa abre a confirmação "Arquivar {nome}?" com a consequência; confirmar a tira da carteira e da tela inicial; "Ver arquivadas" a mostra com "Restaurar"; restaurar a devolve com o histórico intacto | teste e2e (confirmar e cancelar) · interação do protótipo: `company-archive`, `company-restore |
| AC-dm-07 | CAP-dm-company | Excluir aparece só em empresa arquivada, abre uma confirmação destrutiva com a quantidade de diagnósticos que serão apagados e, ao confirmar, remove a empresa e os seus diagnósticos; cancelar não muda nada (RULE-dm-15) | teste e2e + teste de persistência · interação do protótipo: `company-delete |
| AC-dm-08 | CAP-dm-company | O CNPJ tem máscara 00.000.000/0000-00 durante a digitação (`inputmode="numeric"`, até 18 caracteres); ao sair do campo, um CNPJ com dígito verificador errado mostra no próprio campo "CNPJ inválido. Formato: 00.000.000/0000-00." com `aria-invalid | teste unitário da validação + teste e2e |
| AC-dm-09 | CAP-dm-company | A lista de empresas tem busca por nome, filtro por estágio (Todos, 1 a 4) e alternância entre ativas e arquivadas; uma busca sem resultado mostra "Nenhuma empresa encontrada" com "Limpar filtros"; sem nenhuma empresa aparece o estado vazio com "Cadastrar a primeira empresa" | teste e2e |
| AC-dm-46 | CAP-dm-home, CAP-dm-questionnaire, CAP-dm-result, CAP-dm-company, CAP-dm-settings | Em 390 px de largura não há rolagem horizontal em nenhuma tela; os alvos de toque têm pelo menos 44 px (ou ficam dentro de um rótulo clicável desse tamanho); o foco do teclado é sempre visível; o texto tem contraste de pelo menos 4,5:1 nos temas escuro e claro | verificação visual em runtime (`verify:artifact --kind=visual --runtime`) + teste e2e por teclado |
| AC-dm-48 | CAP-dm-company, CAP-dm-questionnaire, CAP-dm-history | Ações de status e destrutivas (arquivar, restaurar com troca de lista, excluir, descartar rascunho, concluir) usam modal do próprio app com título, consequência, verbo no botão e "Cancelar"; Esc cancela e o foco fica preso no modal; nenhum `alert`, `confirm` ou `prompt` nativo | teste e2e (confirmar e cancelar cada ação) |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-dm-company | 1 | components.json, src/lib/utils.ts, src/components/ui/button.tsx, src/components/ui/alert-dialog.tsx, src/components/ui/input.tsx, src/components/ui/label.tsx, src/components/feedback/ConfirmDialog.tsx, src/components/feedback/StatusView.tsx, src/components/form/TextField.tsx, src/components/form/CnpjField.tsx, shared/format/cnpj.ts, shared/content/companyOptions.ts, src/api/httpClient.ts, src/api/companiesApi.ts, src/features/companies/CompaniesPage.tsx, src/features/companies/CompanyFormDialog.tsx, src/features/companies/CompanyPage.tsx, server/routes/companyRoutes.ts, server/services/companyService.ts, server/services/domainError.ts, server/repositories/companyRepository.ts, server/validation/companySchemas.ts, tests/unit/cnpj.test.ts, tests/api/companyRoutes.test.ts, tests/e2e/companies.spec.ts | pnpm test -- tests/unit/cnpj.test.ts tests/api/companyRoutes.test.ts` + `pnpm test:e2e -- tests/e2e/companies.spec.ts |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-dm-company | create | components.json | Configuração do shadcn para Tailwind v4 com aliases `@/components` e `@/lib/utils |
| CAP-dm-company | create | src/lib/utils.ts | Ajudante `cn` do shadcn |
| CAP-dm-company | create | src/components/ui/button.tsx | Botão do shadcn com variantes nos tokens (padrão, metal, ouro de portão, destrutivo) |
| CAP-dm-company | create | src/components/ui/alert-dialog.tsx | AlertDialog do shadcn (Radix: foco preso, Esc cancela) |
| CAP-dm-company | create | src/components/ui/input.tsx | Campo do shadcn nos tokens |
| CAP-dm-company | create | src/components/ui/label.tsx | Rótulo do shadcn |
| CAP-dm-company | create | src/components/feedback/ConfirmDialog.tsx | Título, consequência, botão com o verbo (variantes destrutiva e ouro) e "Cancelar"; o confirmar não fica sob o clique que abriu; estado pendente impede confirmar duas vezes |
| CAP-dm-company | create | src/components/feedback/StatusView.tsx | Estados carregando, vazio e erro com `data-state` e ação de tentar de novo |
| CAP-dm-company | create | src/components/form/TextField.tsx | Rótulo, erro na linha reservada, `aria-invalid`/`aria-describedby`; não renderiza o erro do blur quando o foco vai para o enviar; corrigir limpa o erro do campo |
| CAP-dm-company | create | src/components/form/CnpjField.tsx | Máscara 00.000.000/0000-00 preservando o cursor, `inputmode="numeric"`, até 18 caracteres, dígito verificador no blur |
| CAP-dm-company | create | shared/format/cnpj.ts | Mascarar, extrair dígitos e validar os dígitos verificadores |
| CAP-dm-company | create | shared/content/companyOptions.ts | Opções de segmento, de como vende e de faturamento por ano (chaves em inglês, rótulos pt-BR) |
| CAP-dm-company | create | src/api/httpClient.ts | fetch` para `/api` na mesma origem, só JSON, converte `{ error }` em erro tipado |
| CAP-dm-company | create | src/api/companiesApi.ts | Chamadas das rotas de empresa |
| CAP-dm-company | create | src/features/companies/CompaniesPage.tsx | Busca, filtro por estágio (Todos, 1 a 4) sincronizado com `?estagio=`, alternância ativas/arquivadas, linhas com chave pelo id, estado vazio e "Nenhuma empresa encontrada" com "Limpar filtros" |
| CAP-dm-company | create | src/features/companies/CompanyFormDialog.tsx | Criar e editar com os mesmos campos (paridade); nome 2 a 80, segmento e como vende obrigatórios, faturamento e CNPJ opcionais |
| CAP-dm-company | create | src/features/companies/CompanyPage.tsx | Cabeçalho, editar, arquivar/restaurar/excluir com ConfirmDialog (excluir mostra a quantidade de diagnósticos), "Começar o primeiro diagnóstico" / "Novo diagnóstico" / "Continuar diagnóstico" e link para o último resultado |
| CAP-dm-company | create | server/routes/companyRoutes.ts | GET /api/companies` (q, stage, archived), `POST`, `GET/PATCH /api/companies/:id`, `POST :id/archive`, `POST :id/restore`, `DELETE :id` (409 se não arquivada) |
| CAP-dm-company | create | server/services/companyService.ts | Casos de uso de empresa; arquivar e restaurar nunca apagam dados (RULE-dm-15) |
| CAP-dm-company | create | server/services/domainError.ts | Erro de domínio com `code` e status HTTP |
| CAP-dm-company | create | server/repositories/companyRepository.ts | Consultas parametrizadas; estágio pelo último concluído não arquivado; exclusão da empresa e dos diagnósticos numa transação |
| CAP-dm-company | create | server/validation/companySchemas.ts | Mesmo conjunto de campos para criar e editar; limites de tamanho; opções só do catálogo; texto vazio vira ausente de forma explícita; CNPJ validado |
| CAP-dm-company | create | tests/unit/cnpj.test.ts | Máscara e dígitos verificadores válidos e inválidos |
| CAP-dm-company | create | tests/api/companyRoutes.test.ts | CRUD, filtros, excluir só arquivada, exclusão em cascata persistida, limites e campos inválidos |
| CAP-dm-company | create | tests/e2e/companies.spec.ts | Preenche o cadastro, edita uma linha específica e confere o registro certo; arquivar/restaurar/excluir confirmando e cancelando; CNPJ inválido, corrigir e clicar em salvar na sequência (AC-dm-17); busca, filtro e estados vazios; 390 px e axe |

## Plan section for this phase (from the plan)

## Phase 1 — O dono abre o FitPulse no Play, cadastra a empresa, responde o diagnóstico e vê o resultado

- CAP/AC:
  - CAP-dm-play-runtime: AC-dm-40, AC-dm-41, AC-dm-42, AC-dm-43, AC-dm-44, AC-dm-45, AC-dm-50.
  - CAP-dm-company: AC-dm-04, AC-dm-05, AC-dm-06, AC-dm-07, AC-dm-08, AC-dm-09, AC-dm-17.
  - CAP-dm-questionnaire: AC-dm-10, AC-dm-11, AC-dm-12, AC-dm-13, AC-dm-14, AC-dm-16.
  - CAP-dm-unit-economics: AC-dm-15, AC-dm-51.
  - CAP-dm-engine: AC-dm-18, AC-dm-19, AC-dm-20, AC-dm-21, AC-dm-22, AC-dm-23, AC-dm-24, AC-dm-25, AC-dm-26, AC-dm-27, AC-dm-49.
  - CAP-dm-result: AC-dm-28, AC-dm-29.
  - Nas telas desta fase: AC-dm-46, AC-dm-47, AC-dm-48.
  - Interações do protótipo: `company-create`, `company-edit`, `company-archive`, `company-restore`, `company-delete`, `diagnosis-start-from-previous`, `diagnosis-answer-anchored-item`, `diagnosis-dont-know-range`, `diagnosis-autosave-resume`, `diagnosis-discard-draft`, `cac-ltv-calculator`, `diagnosis-complete`, `result-layered-view`.
- User-visible outcome: no dev-link do Play, o FitPulse abre em `127.0.0.1` com a marca FitPulse e sem login.
  - Em "Empresas", o dono cadastra, edita, busca, filtra, arquiva, restaura e exclui.
  - Na página da empresa, ele começa o diagnóstico. Cada resposta e cada valor da calculadora ficam gravados, e o rascunho volta depois de fechar o app.
  - "Ver meu resultado" passa pelo portão em ouro e mostra o resultado em camadas, calculado pelas regras v1.
- Implementation, nesta ordem:
  1. **Instalação e runtime primeiro**, para tirar logo o risco de instalação:
     - `package.json`, `pnpm-workspace.yaml`, as configurações, `manifest.json` e `system.json`;
     - schema e migration inicial;
     - `scripts/prepare-app.mjs`;
     - `server/main.ts`, `server/app.ts`, as guardas e `playRoutes`;
     - casca da interface com tokens e fontes.
     - Pronto quando: `pnpm install` limpo, os três smokes passam e o dev-link do Play mostra a casca.
  2. **Domínio puro, com os testes antes do código:** `rulesV1`, conteúdo, `unitEconomics` e `evaluateDiagnosis`. G1–G4 e os casos de borda passam antes de qualquer tela usar o motor.
  3. **Empresas:** API, repositório e telas.
  4. **Questionário, calculadora e gravação automática.**
  5. **Conclusão e resultado** e as specs e2e.
  6. **Contrato de runtime:** criar `.aioson/plans/diagnostico-maturidade/harness-contract.json` com os critérios abaixo e rodar `aioson harness:check . --slug=diagnostico-maturidade`:
     - RG-build: `pnpm build`;
     - RG-migrate: `node scripts/smoke-migrate.mjs`;
     - RG-boot: `node scripts/smoke-boot.mjs`;
     - RG-smoke: `pnpm test:e2e`, cobrindo as interações Core do protótipo;
     - C-unit: `pnpm test`;
     - C-package: `node scripts/smoke-store-package.mjs`.
  - Esquema:
    - `companies`: id, name, segment, sales_channel, annual_revenue_range?, cnpj? (14 dígitos), archived_at?, created_at, updated_at.
    - `diagnoses`: id, company_id (FK em cascata), status `draft|completed`, archived_at?, answers (JSON), calculator (JSON, dinheiro em centavos inteiros), current_block, rules_version?, result (JSON congelado)?, stage?, completed_at?, created_at, updated_at; índice (company_id, status).
    - `preferences`: key, value.
  - Textos, estados e composição seguem o protótipo aprovado, com os desvios 1, 2, 3, 4 e 5 do `## Prototype contract` do PRD.
- Create/modify/reuse/retire:
  - CAP-dm-play-runtime: modify `manifest.json`; create `system.json`; create `package.json`; create `pnpm-workspace.yaml`; create `pnpm-lock.yaml`; modify `.gitignore`; create `tsconfig.json`; create `vite.config.ts`; create `index.html`; create `prisma.config.ts`; create `prisma/schema.prisma`; create `prisma/migrations/migration_lock.toml`; create `prisma/migrations/20261023000000_init/migration.sql`; create `scripts/prepare-app.mjs`; create `scripts/smoke-migrate.mjs`; create `scripts/smoke-boot.mjs`; create `scripts/smoke-store-package.mjs`; create `server/main.ts`; create `server/app.ts`; create `server/db/databaseUrl.ts`; create `server/db/prismaClient.ts`; create `server/http/requestGuards.ts`; create `server/http/errorHandler.ts`; create `server/routes/playRoutes.ts`; create `server/services/assistantSummaryService.ts`; create `src/main.tsx`; create `src/App.tsx`; create `src/styles/tokens.css`; create `src/styles/global.css`; create `src/components/layout/AppShell.tsx`; create `vitest.config.ts`; create `playwright.config.ts`; create `tests/helpers/testDatabase.ts`; create `tests/api/playRoutes.test.ts`; create `tests/e2e/global-setup.ts`; create `tests/e2e/support/fixtures.ts`; create `tests/e2e/shell.spec.ts`; create `.aioson/plans/diagnostico-maturidade/harness-contract.json`
  - CAP-dm-company: create `components.json`; create `src/lib/utils.ts`; create `src/components/ui/button.tsx`; create `src/components/ui/alert-dialog.tsx`; create `src/components/ui/input.tsx`; create `src/components/ui/label.tsx`; create `src/components/feedback/ConfirmDialog.tsx`; create `src/components/feedback/StatusView.tsx`; create `src/components/form/TextField.tsx`; create `src/components/form/CnpjField.tsx`; create `shared/format/cnpj.ts`; create `shared/content/companyOptions.ts`; create `src/api/httpClient.ts`; create `src/api/companiesApi.ts`; create `src/features/companies/CompaniesPage.tsx`; create `src/features/companies/CompanyFormDialog.tsx`; create `src/features/companies/CompanyPage.tsx`; create `server/routes/companyRoutes.ts`; create `server/services/companyService.ts`; create `server/services/domainError.ts`; create `server/repositories/companyRepository.ts`; create `server/validation/companySchemas.ts`; create `tests/unit/cnpj.test.ts`; create `tests/api/companyRoutes.test.ts`; create `tests/e2e/companies.spec.ts`
  - CAP-dm-questionnaire: create `shared/content/questionBank.ts`; create `shared/domain/completeness.ts`; create `src/api/diagnosesApi.ts`; create `src/features/diagnosis/QuestionnairePage.tsx`; create `src/features/diagnosis/BlockRail.tsx`; create `src/features/diagnosis/AnchoredQuestion.tsx`; create `src/features/diagnosis/useDraftAutosave.ts`; create `src/features/diagnosis/CompletionGate.tsx`; create `server/routes/diagnosisRoutes.ts`; create `server/services/diagnosisService.ts`; create `server/repositories/diagnosisRepository.ts`; create `server/validation/diagnosisSchemas.ts`; create `tests/unit/questionBank.test.ts`; create `tests/api/diagnosisRoutes.test.ts`; create `tests/e2e/questionnaire.spec.ts`
  - CAP-dm-unit-economics: create `shared/content/calculatorOptions.ts`; create `shared/domain/unitEconomics.ts`; create `shared/format/money.ts`; create `shared/format/displayNumbers.ts`; create `src/components/form/MoneyField.tsx`; create `src/features/diagnosis/CalculatorBlock.tsx`; create `src/features/diagnosis/UnitEconomicsPanel.tsx`; create `tests/unit/unitEconomics.test.ts`; create `tests/unit/money.test.ts`; create `tests/e2e/calculator.spec.ts`
  - CAP-dm-engine: create `shared/rules/rulesV1.ts`; create `shared/content/stageContent.ts`; create `shared/content/riskCatalog.ts`; create `shared/content/actionCatalog.ts`; create `shared/domain/types.ts`; create `shared/domain/dimensionScores.ts`; create `shared/domain/stageGate.ts`; create `shared/domain/riskSignals.ts`; create `shared/domain/confidence.ts`; create `shared/domain/actionPlan.ts`; create `shared/domain/evaluateDiagnosis.ts`; create `tests/fixtures/rulesV2.ts`; create `tests/unit/evaluateDiagnosis.test.ts`; create `tests/unit/diagnosisRules.test.ts`
  - CAP-dm-result: create `src/features/result/ResultPage.tsx`; create `src/features/result/StageLadder.tsx`; create `src/features/result/ActionPlanList.tsx`; create `src/features/result/DimensionScores.tsx`; create `src/features/result/RiskList.tsx`; create `src/features/result/NumbersSummary.tsx`; create `src/features/result/ConfidenceNote.tsx`; create `tests/unit/forbiddenTerms.test.ts`; create `tests/e2e/result.spec.ts`
- Verification:
  - Comandos: `pnpm install` (limpo), `pnpm typecheck`, `pnpm test`, `pnpm build`, `node scripts/smoke-migrate.mjs`, `node scripts/smoke-boot.mjs`, `pnpm test:e2e`, `node scripts/smoke-store-package.mjs` e `aioson harness:check . --slug=diagnostico-maturidade`.
  - No Play (Settings → Instalar App → Linkar pasta): o webview mostra o FitPulse e o badge fica verde.
  - Concluir um diagnóstico no Play e medir até 3 s até o resultado (AC-dm-27).
- Done when: no dev-link do Play, uma empresa cadastrada conclui um diagnóstico e o resultado aparece com estágio, trava, 3 ações, riscos e confiança. Além disso, `pnpm test`, `pnpm test:e2e`, os três smokes e `aioson harness:check` saem com código 0.

## Context contract

- Plan: .aioson/context/implementation-plan-diagnostico-maturidade.md — your phase section and table rows are embedded above; open the whole plan only for a cross-reference.
- PRD: .aioson/context/prd-diagnostico-maturidade.md — the acceptance criteria of your capabilities are embedded above; open it only for a business rule they cite.
- Prototype: .aioson/briefings/diagnostico-maturidade/prototype.html (143 KB) — the visual contract for the UI files of this unit; a unit without UI files never opens it.
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=src/api/companiesApi.ts,src/features/companies/CompaniesPage.tsx,src/features/companies/CompanyFormDialog.tsx,src/features/companies/CompanyPage.tsx,src/App.tsx --task="unit phase-1-frontend-companies of diagnostico-maturidade"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
