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

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-ra-11 | CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report | Nenhum PDF contém os termos proibidos da RULE-dm-14. O aviso "Orientação baseada nas respostas da empresa. Não substitui uma análise financeira." aparece no resumo e em "Como ler" | teste de unidade dos três PDFs |
| AC-ra-12 | CAP-ra-evolution-report | Com 2 ou mais diagnósticos concluídos, "Evolução" oferece "De" e "Até" (padrão: os dois mais recentes). O PDF tem:<br>• capa;<br>• "Antes e depois": estágio antes → depois, custo por cliente, média das 8 dimensões, trava antes e agora, barras antes e depois com a diferença escrita;<br>• "O que foi feito no período" (parte 2): ações do diagnóstico "De" com o estado e se continuam no plano novo, mais o custo por cliente do diário no período. Antes da parte 2, ou sem andamento e sem diário no período, essa página não aparece;<br>• "Como ler" | teste de unidade do PDF · interação do protótipo: `report-type-evolution |
| AC-ra-13 | CAP-ra-evolution-report | Para o mesmo par, os estágios, as notas e as diferenças do PDF de evolução são iguais aos da tela "Comparar". Quando as versões das regras diferem, o PDF traz o mesmo aviso de recálculo da tela (RULE-ra-02) | teste de unidade comparando o PDF com a saída da comparação, com `tests/fixtures/rulesV2.ts |
| AC-ra-14 | CAP-ra-evolution-report | A lista "Até" só oferece diagnósticos posteriores ao escolhido em "De"; trocar "De" para depois de "Até" ajusta "Até" para o seguinte | teste e2e |
| AC-ra-44 | CAP-ra-diary-prefill | Com 3 meses ou mais anotados, "Novo diagnóstico" cria o rascunho com o bloco "Seus números" já preenchido: gasto e clientes novos são a soma dos 3 meses mais recentes, com a marca "do diário: {mês} a {mês}". Se algum dos 3 meses tem só o total, o gasto aparece como um total único, sem divisão por parte, e o painel recalcula igual. Ao concluir, o custo por cliente conta como medido para a RULE-dm-04 e a confiança (RULE-ra-09) | teste de unidade + teste e2e |
| AC-ra-45 | CAP-ra-diary-prefill | Com 1 ou 2 meses, o bloco oferece "Usar o diário", com o valor projetado para 3 meses e a marca "do diário: N mês(es), estimado". Aceito, conta como estimado: a confiança não passa de média (AC-dm-49). Sem meses, o bloco é igual ao da versão 1 | teste de unidade + teste e2e |
| AC-ra-46 | CAP-ra-diary-prefill | Qualquer número vindo do diário pode ser corrigido antes de concluir; corrigido, perde a marca "do diário" e segue a regra da versão 1. O resultado concluído mostra de onde veio o custo por cliente ("do diário, medido", "do diário, estimado" ou o que foi digitado). Mudar o diário depois não altera um rascunho já criado nem um diagnóstico concluído | teste e2e + teste de API |
| AC-ra-47 | CAP-ra-diary-prefill | Com o diário, as respostas do questionário continuam vindo do último diagnóstico concluído, como na versão 1 (AC-dm-13); só o bloco "Seus números" muda de origem | teste de API |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-ra-evolution-report | 2 | server/services/historyService.ts, shared/domain/compareDiagnoses.ts, shared/content/comparisonCopy.ts, src/features/history/ComparePage.tsx, server/report/evolutionDocument.ts, server/validation/reportSchemas.ts, server/services/reportService.ts, src/features/reports/ReportOptions.tsx, tests/unit/evolutionDocument.test.ts, tests/fixtures/rulesV2.ts, tests/e2e/report.spec.ts, tests/unit/forbiddenTerms.test.ts | pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/historyRoutes.test.ts` + `pnpm exec playwright test tests/e2e/report.spec.ts tests/e2e/history.spec.ts |
| CAP-ra-diary-prefill | 4 | shared/domain/types.ts, shared/domain/unitEconomics.ts, shared/domain/completeness.ts, shared/domain/diaryPrefill.ts, server/validation/diagnosisSchemas.ts, server/services/diagnosisService.ts, server/routes/diagnosisRoutes.ts, server/repositories/diaryRepository.ts, src/api/diagnosesApi.ts, src/features/diagnosis/CalculatorBlock.tsx, src/features/result/NumbersSummary.tsx, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/services/reportService.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts, tests/unit/unitEconomics.test.ts, tests/unit/diaryPrefill.test.ts, tests/api/diagnosisRoutes.test.ts, tests/e2e/calculator.spec.ts | pnpm exec vitest run tests/unit/unitEconomics.test.ts tests/unit/diaryPrefill.test.ts tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts tests/api/diagnosisRoutes.test.ts tests/api/backupRoutes.test.ts` + `pnpm exec playwright test tests/e2e/calculator.spec.ts tests/e2e/questionnaire.spec.ts |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-ra-evolution-report | modify | server/services/historyService.ts | comparePair(fromId, toId)` com o mesmo `compareDiagnoses`; recusa empresa diferente, arquivado ou ordem invertida |
| CAP-ra-evolution-report | reuse | shared/domain/compareDiagnoses.ts | Sem mudança (F9) |
| CAP-ra-evolution-report | create | shared/content/comparisonCopy.ts | O aviso como função, para a tela e o PDF |
| CAP-ra-evolution-report | modify | src/features/history/ComparePage.tsx | Usa o texto compartilhado |
| CAP-ra-evolution-report | create | server/report/evolutionDocument.ts | Capa, "Antes e depois", "O que foi feito no período" (só com andamento ou diário), "Como ler" |
| CAP-ra-evolution-report | create | server/validation/reportSchemas.ts | Seleção `evolution` com `fromId` e `toId |
| CAP-ra-evolution-report | modify | server/services/reportService.ts | Seleção de evolução; nome `{empresa}-evolucao-{de}-a-{ate}.pdf |
| CAP-ra-evolution-report | create | src/features/reports/ReportOptions.tsx | "De" e "Até"; "Até" só posteriores e ajustado ao trocar "De" |
| CAP-ra-evolution-report | create | tests/unit/evolutionDocument.test.ts | Mesmo par = mesmos números da comparação, com recálculo |
| CAP-ra-evolution-report | reuse | tests/fixtures/rulesV2.ts | Sem mudança |
| CAP-ra-evolution-report | modify | tests/e2e/report.spec.ts | Escolha do par e AC-ra-14 |
| CAP-ra-evolution-report | modify | tests/unit/forbiddenTerms.test.ts | Inclui o PDF de evolução |
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
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=server/validation/diagnosisSchemas.ts,server/services/diagnosisService.ts,server/routes/diagnosisRoutes.ts,src/api/diagnosesApi.ts,tests/api/diagnosisRoutes.test.ts,server/report/reportModel.ts,server/report/evolutionDocument.ts,server/services/reportService.ts,tests/unit/reportModel.test.ts,tests/unit/evolutionDocument.test.ts --task="unit phase-4-backend-diary-prefill of relatorios-e-acompanhamento"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
