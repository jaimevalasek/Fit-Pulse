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

# Unit contract — relatorios-e-acompanhamento / phase-4-frontend-diary

- Feature: relatorios-e-acompanhamento
- Lane: frontend (write paths: src/App.tsx, src/components/**, src/features/**, src/styles/**)
- Phase: 4-frontend-diary — wave 9 of 14
- Depends on: phase-4-backend-diary-api (after its implementation), phase-4-backend-diary-domain (after its implementation), phase-4-backend-diary-prefill (after its implementation), phase-3-frontend-actions (after its implementation), phase-2-frontend-evolution-portfolio (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-diary, CAP-ra-diary-prefill; AC-ra-38, AC-ra-40, AC-ra-41, AC-ra-42, AC-ra-44, AC-ra-46; IF-004, IF-006, IF-007
- Capabilities: CAP-ra-diary, CAP-ra-diary-prefill
- Acceptance criteria: AC-ra-38, AC-ra-40, AC-ra-41, AC-ra-42, AC-ra-44, AC-ra-46
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-39, AC-ra-43, AC-ra-45, AC-ra-47, AC-ra-57, AC-ra-58, AC-ra-59
- Allowed files (create/modify ONLY these):
  - src/components/form/MonthField.tsx
  - src/components/form/MoneyField.tsx
  - src/features/diary/CompanyDiaryTab.tsx
  - src/features/diary/DiaryMonthForm.tsx
  - src/features/diary/DiaryCostChart.tsx
  - src/features/companies/CompanyTabs.tsx
  - src/App.tsx
  - src/features/diagnosis/CalculatorBlock.tsx
  - src/features/result/NumbersSummary.tsx
- Done when: `pnpm typecheck` passa e as telas usam só o IF-006 e o IF-007
- Verification:
  - `pnpm typecheck` passa e as telas usam só o IF-006 e o IF-007
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-ra-38 | CAP-ra-diary | Na aba "Diário", "Anotar um mês" abre o formulário com:<br>• mês com máscara `MM/AAAA` (`inputmode="numeric"`);<br>• clientes novos, inteiro de até 5 dígitos;<br>• gasto nas 6 partes da calculadora com máscara de reais, ou "Só sei o total do gasto" com um campo único.<br>"Anotar mês" grava e mostra o mês na lista com o custo por cliente | teste e2e (formulário) · interação do protótipo: `diary-add-month`, `diary-total-only |
| AC-ra-39 | CAP-ra-diary | Cada erro aparece no próprio campo, e nada é gravado:<br>• mês futuro;<br>• mês inválido;<br>• mês já anotado: "{Mês} já está no diário. Edite o mês em vez de anotar de novo.";<br>• clientes vazios;<br>• gasto vazio: "Preencha pelo menos uma parte do gasto, ou marque 'Só sei o total'."<br>O servidor recusa o mesmo mês repetido para a mesma empresa | teste e2e + teste de API |
| AC-ra-40 | CAP-ra-diary | "Editar" um mês mostra os mesmos campos preenchidos, com o mês só para leitura e a explicação "Para mudar o mês, exclua e anote de novo." (RULE-ra-08). "Excluir" pede "Excluir {mês} do diário?" com a consequência e "Excluir mês"; cancelar não muda nada | teste e2e · interação do protótipo: `diary-edit-month`, `diary-delete-month |
| AC-ra-41 | CAP-ra-diary | Com 0 clientes novos, o custo do mês é "não calculado". A aba mostra:<br>• o gráfico do custo por cliente dos últimos 6 meses anotados, com o valor escrito em cada barra e uma frase-resumo;<br>• o progresso "N de 3 meses anotados", ou "Medido: de {mês} a {mês}" com 3 ou mais.<br>Nenhuma tela mostra "NaN", "Infinity" ou valor vazio | teste e2e · interação do protótipo: `diary-measured-after-three-months |
| AC-ra-42 | CAP-ra-diary | Sem meses anotados, aparece o estado vazio "Por que anotar todo mês?", com o texto aprovado e "Anotar o primeiro mês". No modo consultoria, a aba diz que o consultor anota os números do cliente (F12) | teste e2e |
| AC-ra-43 | CAP-ra-diary | O gasto do diário vai e volta da API em centavos inteiros. Um valor com fração de centavo, negativo ou acima de R$ 99.999.999,99 é recusado | teste de API |
| AC-ra-44 | CAP-ra-diary-prefill | Com 3 meses ou mais anotados, "Novo diagnóstico" cria o rascunho com o bloco "Seus números" já preenchido: gasto e clientes novos são a soma dos 3 meses mais recentes, com a marca "do diário: {mês} a {mês}". Se algum dos 3 meses tem só o total, o gasto aparece como um total único, sem divisão por parte, e o painel recalcula igual. Ao concluir, o custo por cliente conta como medido para a RULE-dm-04 e a confiança (RULE-ra-09) | teste de unidade + teste e2e |
| AC-ra-45 | CAP-ra-diary-prefill | Com 1 ou 2 meses, o bloco oferece "Usar o diário", com o valor projetado para 3 meses e a marca "do diário: N mês(es), estimado". Aceito, conta como estimado: a confiança não passa de média (AC-dm-49). Sem meses, o bloco é igual ao da versão 1 | teste de unidade + teste e2e |
| AC-ra-46 | CAP-ra-diary-prefill | Qualquer número vindo do diário pode ser corrigido antes de concluir; corrigido, perde a marca "do diário" e segue a regra da versão 1. O resultado concluído mostra de onde veio o custo por cliente ("do diário, medido", "do diário, estimado" ou o que foi digitado). Mudar o diário depois não altera um rascunho já criado nem um diagnóstico concluído | teste e2e + teste de API |
| AC-ra-47 | CAP-ra-diary-prefill | Com o diário, as respostas do questionário continuam vindo do último diagnóstico concluído, como na versão 1 (AC-dm-13); só o bloco "Seus números" muda de origem | teste de API |
| AC-ra-57 | CAP-ra-report-center, CAP-ra-brand, CAP-ra-action-tracking, CAP-ra-diary, CAP-ra-home-followup | Em 390 px de largura:<br>• nenhuma tela nova tem rolagem horizontal;<br>• a prévia empilha as páginas na vertical;<br>• os alvos de toque têm pelo menos 44 px ou ficam dentro de um rótulo clicável desse tamanho;<br>• o foco do teclado é sempre visível;<br>• o texto tem contraste de pelo menos 4,5:1 nos dois temas | teste e2e com axe nos dois temas · interação do protótipo: `switch-theme |
| AC-ra-58 | CAP-ra-report-center, CAP-ra-home-followup, CAP-ra-diary | Com `prefers-reduced-motion: reduce`, nenhuma animação nova roda: faixa de reimpressão, entrada em sequência, revelação das páginas, traço sob a aba e poeira do fundo. As telas aparecem já no estado final | teste e2e com emulação de movimento reduzido |
| AC-ra-59 | CAP-ra-diary, CAP-ra-brand, CAP-ra-remote-questionnaire | Excluir um mês, remover a logo, voltar à marca FitPulse e substituir um rascunho usam o modal do app, com título, consequência, verbo no botão e "Cancelar". Esc cancela e o foco fica preso no modal. Nenhum `alert`, `confirm` ou `prompt` nativo | teste e2e (confirmar e cancelar em cada um) |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-ra-diary | 4 | prisma/schema.prisma, prisma/migrations/20261026000200_diary_entries/migration.sql, shared/domain/diary.ts, shared/format/dates.ts, src/components/form/MonthField.tsx, src/components/form/MoneyField.tsx, shared/content/calculatorOptions.ts, tests/unit/dates.test.ts, server/repositories/diaryRepository.ts, server/validation/diarySchemas.ts, server/services/diaryService.ts, server/routes/diaryRoutes.ts, server/app.ts, src/api/diaryApi.ts, src/features/diary/CompanyDiaryTab.tsx, src/features/diary/DiaryMonthForm.tsx, src/features/diary/DiaryCostChart.tsx, src/features/companies/CompanyTabs.tsx, src/App.tsx, tests/unit/diary.test.ts, tests/api/diaryRoutes.test.ts, tests/e2e/diary.spec.ts | pnpm exec vitest run tests/unit/diary.test.ts tests/unit/dates.test.ts tests/api/diaryRoutes.test.ts` + `node scripts/smoke-migrate.mjs` + `pnpm exec playwright test tests/e2e/diary.spec.ts |
| CAP-ra-diary-prefill | 4 | shared/domain/types.ts, shared/domain/unitEconomics.ts, shared/domain/completeness.ts, shared/domain/diaryPrefill.ts, server/validation/diagnosisSchemas.ts, server/services/diagnosisService.ts, server/routes/diagnosisRoutes.ts, server/repositories/diaryRepository.ts, src/api/diagnosesApi.ts, src/features/diagnosis/CalculatorBlock.tsx, src/features/result/NumbersSummary.tsx, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/services/reportService.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts, tests/unit/unitEconomics.test.ts, tests/unit/diaryPrefill.test.ts, tests/api/diagnosisRoutes.test.ts, tests/e2e/calculator.spec.ts | pnpm exec vitest run tests/unit/unitEconomics.test.ts tests/unit/diaryPrefill.test.ts tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts tests/api/diagnosisRoutes.test.ts tests/api/backupRoutes.test.ts` + `pnpm exec playwright test tests/e2e/calculator.spec.ts tests/e2e/questionnaire.spec.ts |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-ra-diary | modify | prisma/schema.prisma | DiaryEntry` (`diary_entries`: id, company_id com cascata, month `YYYY-MM`, spend_parts JSON em centavos ou spend_total_cents, new_customers, created_at, updated_at; único (company_id, month)) |
| CAP-ra-diary | create | prisma/migrations/20261026000200_diary_entries/migration.sql | Só criação |
| CAP-ra-diary | create | shared/domain/diary.ts | Custo do mês com o arredondamento de `unitEconomics`, "não calculado" com 0, progresso, "Medido: de {mês} a {mês}", últimos 6 meses |
| CAP-ra-diary | create | shared/format/dates.ts | Máscara `MM/AAAA` e mês futuro |
| CAP-ra-diary | create | tests/unit/dates.test.ts | Máscara `MM/AAAA` e mês futuro |
| CAP-ra-diary | create | src/components/form/MonthField.tsx | inputmode="numeric" |
| CAP-ra-diary | reuse | src/components/form/MoneyField.tsx | Sem mudança |
| CAP-ra-diary | reuse | shared/content/calculatorOptions.ts | Sem mudança |
| CAP-ra-diary | create | server/repositories/diaryRepository.ts | Listar, criar, editar, excluir, 3 mais recentes |
| CAP-ra-diary | create | server/validation/diarySchemas.ts | Mês, clientes, partes ou total, limites |
| CAP-ra-diary | create | server/services/diaryService.ts | 409 `month_taken`; mês imutável |
| CAP-ra-diary | create | server/routes/diaryRoutes.ts | GET`/`POST /api/companies/:id/diary`, `PUT`/`DELETE /api/companies/:id/diary/:month |
| CAP-ra-diary | modify | server/app.ts | Rotas do diário |
| CAP-ra-diary | create | src/api/diaryApi.ts | CRUD do diário |
| CAP-ra-diary | create | src/features/diary/CompanyDiaryTab.tsx | Lista, progresso, vazio "Por que anotar todo mês?", aviso do modo consultoria; linhas com chave pelo mês |
| CAP-ra-diary | create | src/features/diary/DiaryMonthForm.tsx | Criar e editar (mês só leitura com a explicação), "Só sei o total do gasto", erros no campo; exclusão no modal |
| CAP-ra-diary | create | src/features/diary/DiaryCostChart.tsx | 6 meses, valor escrito em cada barra, frase-resumo |
| CAP-ra-diary | create | src/features/companies/CompanyTabs.tsx | Aba "Diário" |
| CAP-ra-diary | modify | src/App.tsx | Rota `empresa/:companyId/diario |
| CAP-ra-diary | create | tests/unit/diary.test.ts | Custo, 0 clientes, progresso, gráfico |
| CAP-ra-diary | create | tests/api/diaryRoutes.test.ts | Centavos, limites, mês futuro, repetido, em paralelo |
| CAP-ra-diary | create | tests/e2e/diary.spec.ts | Anotar, total único, editar um mês específico, excluir com modal, vazio, "Medido" |
| CAP-ra-diary-prefill | modify | shared/domain/types.ts | spendTotalCents` e `diarySource` opcionais |
| CAP-ra-diary-prefill | modify | shared/domain/unitEconomics.ts | Aceita o total; valor do diário estimado conta como estimado |
| CAP-ra-diary-prefill | modify | shared/domain/completeness.ts | Aceita o total |
| CAP-ra-diary-prefill | create | shared/domain/diaryPrefill.ts | RULE-ra-09: 3+ meses somados e medidos (total se algum mês tem só o total); 1–2 meses → média × 3 estimada; 0 → nada |
| CAP-ra-diary-prefill | modify | server/validation/diagnosisSchemas.ts | Patch aceita `spendTotalCents`; o calculador guardado aceita `diarySource` e `diarySuggestion`, que o cliente não envia |
| CAP-ra-diary-prefill | modify | server/services/diagnosisService.ts | start` põe o diário no calculador; edição à mão tira a marca do campo; `applyDiarySuggestion |
| CAP-ra-diary-prefill | modify | server/routes/diagnosisRoutes.ts | POST /api/diagnoses/:id/diary-suggestion |
| CAP-ra-diary-prefill | create | server/repositories/diaryRepository.ts | 3 meses mais recentes da empresa |
| CAP-ra-diary-prefill | modify | src/api/diagnosesApi.ts | applyDiarySuggestion(id) |
| CAP-ra-diary-prefill | modify | src/features/diagnosis/CalculatorBlock.tsx | Marca "do diário: {mês} a {mês}", total único, "Usar o diário" com "N mês(es), estimado" |
| CAP-ra-diary-prefill | modify | src/features/result/NumbersSummary.tsx | "do diário, medido", "do diário, estimado" ou digitado |
| CAP-ra-diary-prefill | modify | server/report/reportModel.ts | Origem do custo em "Seus números" |
| CAP-ra-diary-prefill | create | server/report/evolutionDocument.ts | Custo por cliente do diário no período |
| CAP-ra-diary-prefill | modify | server/services/reportService.ts | Passa o diário do período ao documento de evolução |
| CAP-ra-diary-prefill | modify | tests/unit/reportModel.test.ts | Origem do custo em "Seus números" |
| CAP-ra-diary-prefill | create | tests/unit/evolutionDocument.test.ts | Custo do diário no período |
| CAP-ra-diary-prefill | modify | tests/unit/unitEconomics.test.ts | Total e estimado do diário |
| CAP-ra-diary-prefill | create | tests/unit/diaryPrefill.test.ts | 3, 2, 1 e 0 meses; total único |
| CAP-ra-diary-prefill | modify | tests/api/diagnosisRoutes.test.ts | Rascunho com o diário; diário mudado depois não altera o rascunho; respostas do último concluído (AC-ra-47) |
| CAP-ra-diary-prefill | modify | tests/e2e/calculator.spec.ts | Bloco preenchido, "Usar o diário", correção à mão, origem no resultado |

## Plan section for this phase (from the plan)

## Phase 4 — O diário mensal mostra o custo por cliente, e o próximo diagnóstico chega com esse número medido

- CAP/AC:
  - CAP-ra-diary: AC-ra-38, AC-ra-39, AC-ra-40, AC-ra-41, AC-ra-42, AC-ra-43.
  - CAP-ra-diary-prefill: AC-ra-44, AC-ra-45, AC-ra-46, AC-ra-47.
  - Completa no PDF de evolução: AC-ra-12 (custo por cliente do diário no período).
  - Nas telas desta fase: AC-ra-57, AC-ra-58, AC-ra-59 (excluir um mês).
  - Interações do protótipo: `diary-add-month`, `diary-edit-month`, `diary-delete-month`, `diary-total-only`, `diary-measured-after-three-months`.
- User-visible outcome:
  - Na aba "Diário", "Anotar um mês" grava mês, clientes novos e as 6 partes (ou "Só sei o total do gasto"). A lista mostra o custo por cliente, o gráfico dos 6 meses e "N de 3 meses anotados", até "Medido: de {mês} a {mês}".
  - Mês repetido, mês futuro e gasto vazio mostram o erro no campo.
  - "Novo diagnóstico" com 3 meses chega com "Seus números" somados e marcados "do diário: {mês} a {mês}". Com 1 ou 2 meses, o bloco oferece "Usar o diário" como estimado.
  - O resultado diz de onde veio o custo.
- Implementation, nesta ordem:
  1. **Domínio puro com testes antes:** `diary.ts`, `diaryPrefill.ts`, a máscara `MM/AAAA` em `dates.ts`, e `spendTotalCents`/`diarySource` em `types.ts`, `unitEconomics.ts` e `completeness.ts`.
     - Os testes `diagnosisRules` e `evaluateDiagnosis` da versão 1 têm de passar sem mudança.
  2. **Diário:** modelo `DiaryEntry`, migração `20261026000200_diary_entries`, `diaryRepository`, `diarySchemas`, `diaryService` e `diaryRoutes`.
  3. **Preenchimento:**
     - `diagnosisService.start` lê os 3 meses mais recentes e grava o calculador com o diário ou a `diarySuggestion`.
     - `diagnosisSchemas` aceita os campos guardados e recusa marcas vindas do cliente.
     - O merge tira a marca do campo editado.
     - `POST /api/diagnoses/:id/diary-suggestion` aplica a sugestão.
  4. **Tela:**
     - `diaryApi`, `MonthField`, `DiaryMonthForm` (linhas com chave pelo mês; mês só leitura ao editar), `DiaryCostChart`, `CompanyDiaryTab` na rota `diario` e a aba em `CompanyTabs`.
     - `CalculatorBlock` mostra a origem, o total único e "Usar o diário". `NumbersSummary` mostra a origem.
     - A composição segue `#/empresa/c1/diario` e `#/empresa/c2/diario`.
  5. **Relatórios:** origem do custo em "Seus números" (`reportModel`) e custo do diário no período (`evolutionDocument`).
- Create/modify/reuse/retire:
  - modify: prisma/schema.prisma, server/app.ts, src/App.tsx, shared/domain/types.ts, shared/domain/unitEconomics.ts, shared/domain/completeness.ts, server/validation/diagnosisSchemas.ts, server/services/diagnosisService.ts, server/routes/diagnosisRoutes.ts, src/api/diagnosesApi.ts, src/features/diagnosis/CalculatorBlock.tsx, src/features/result/NumbersSummary.tsx, server/report/reportModel.ts, server/services/reportService.ts, tests/unit/reportModel.test.ts, tests/unit/unitEconomics.test.ts, tests/api/diagnosisRoutes.test.ts, tests/e2e/calculator.spec.ts.
  - create: prisma/migrations/20261026000200_diary_entries/migration.sql, shared/domain/diary.ts, shared/format/dates.ts, src/components/form/MonthField.tsx, server/repositories/diaryRepository.ts, server/validation/diarySchemas.ts, server/services/diaryService.ts, server/routes/diaryRoutes.ts, src/api/diaryApi.ts, src/features/diary/CompanyDiaryTab.tsx, src/features/diary/DiaryMonthForm.tsx, src/features/diary/DiaryCostChart.tsx, src/features/companies/CompanyTabs.tsx, tests/unit/diary.test.ts, tests/api/diaryRoutes.test.ts, tests/e2e/diary.spec.ts, shared/domain/diaryPrefill.ts, server/report/evolutionDocument.ts, tests/unit/diaryPrefill.test.ts, tests/unit/dates.test.ts, tests/unit/evolutionDocument.test.ts.
  - reuse: src/components/form/MoneyField.tsx, shared/content/calculatorOptions.ts.
- Verification:
  - `pnpm build`.
  - `pnpm exec vitest run tests/unit/diary.test.ts tests/unit/diaryPrefill.test.ts tests/unit/dates.test.ts tests/unit/unitEconomics.test.ts tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts tests/api/diaryRoutes.test.ts tests/api/diagnosisRoutes.test.ts tests/api/backupRoutes.test.ts tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts`.
  - `node scripts/smoke-migrate.mjs`.
  - `pnpm exec playwright test tests/e2e/diary.spec.ts tests/e2e/calculator.spec.ts tests/e2e/questionnaire.spec.ts`.
  - No dev-link do Play: anotar 3 meses, começar um diagnóstico novo, concluir e ver "do diário, medido" no resultado.
- Done when:
  - O diário grava sem duplicar mês.
  - O próximo rascunho segue a RULE-ra-09 nos três casos.
  - Um rascunho ou diagnóstico já criado não muda quando o diário muda.

## Context contract

- Plan: .aioson/context/implementation-plan-relatorios-e-acompanhamento.md — your phase section and table rows are embedded above; open the whole plan only for a cross-reference.
- PRD: .aioson/context/prd-relatorios-e-acompanhamento.md — the acceptance criteria of your capabilities are embedded above; open it only for a business rule they cite.
- Prototype: .aioson/briefings/relatorios-e-acompanhamento/prototype.html (144 KB) — the visual contract for the UI files of this unit; a unit without UI files never opens it.
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=src/components/form/MonthField.tsx,src/components/form/MoneyField.tsx,src/features/diary/CompanyDiaryTab.tsx,src/features/diary/DiaryMonthForm.tsx,src/features/diary/DiaryCostChart.tsx,src/features/companies/CompanyTabs.tsx,src/App.tsx,src/features/diagnosis/CalculatorBlock.tsx,src/features/result/NumbersSummary.tsx --task="unit phase-4-frontend-diary of relatorios-e-acompanhamento"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
