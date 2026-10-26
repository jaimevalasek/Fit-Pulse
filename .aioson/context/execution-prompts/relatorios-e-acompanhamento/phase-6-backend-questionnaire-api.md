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

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-ra-48 | CAP-ra-remote-questionnaire | No modo consultoria, a página da empresa tem "Enviar questionário".<br>• O diálogo explica o caminho em 3 passos e salva `{empresa}-questionario-{data}.html` (data `AAAA-MM-DD`) na pasta Downloads, com "Mostrar na pasta" e a mensagem aprovada ao cliente com "Copiar mensagem".<br>• Se a cópia automática falhar, o texto fica selecionável, com a dica de copiar à mão.<br>• A empresa passa a mostrar "Questionário enviado em {data}" e entra em "Questionários aguardando resposta" | teste e2e · interação do protótipo: `remote-questionnaire-send |
| AC-ra-49 | CAP-ra-remote-questionnaire | O arquivo abre direto no Chrome, no Edge, no Firefox e no Safari de um computador, sem internet e sem instalar nada.<br>• Mostra o aviso aprovado de abrir no computador; numa tela estreita, o aviso fica em destaque.<br>• Tem os 8 blocos e as 24 perguntas com a ajuda, "não sei" só onde o catálogo permite e os 6 campos da calculadora com as mesmas máscaras.<br>• Não faz nenhuma requisição de rede (RULE-ra-11) | teste e2e que abre o arquivo gerado no Chromium com a rede cortada + smoke manual nos 4 navegadores (Q-10) · interação do protótipo: `remote-questionnaire-client-answer |
| AC-ra-50 | CAP-ra-remote-questionnaire | No fim, o arquivo mostra "Revise e salve", com "N de 8 blocos respondidos" e um link para cada bloco que falta; dá para salvar com blocos faltando. "Salvar minhas respostas" baixa `respostas-{empresa}.fitpulse` e mostra "Respostas salvas", com a instrução aprovada de enviar a quem entrega (nome e contato da marca, se houver) | teste e2e no arquivo gerado |
| AC-ra-51 | CAP-ra-remote-questionnaire | "Importar respostas" aceita o arquivo, mostra "Lendo o arquivo…" e cria um rascunho da empresa com as respostas e os números, marcado "Respostas do cliente, salvas em {data}". "Revisar e concluir" abre o rascunho, que conclui pelo portão normal (AC-dm-14). A empresa sai de "Questionários aguardando resposta" | teste de API + teste e2e · interação do protótipo: `remote-questionnaire-import |
| AC-ra-52 | CAP-ra-remote-questionnaire | Um arquivo de outra empresa ("Este arquivo é de {empresa}, não de {empresa atual}."), de versão mais nova, de questionário incompatível, corrompido ("Este arquivo não é um arquivo de respostas do FitPulse.") ou com mais de 1 MB é recusado com a mensagem específica (`role="alert"`), "Nada foi alterado." e "Escolher outro arquivo". Nenhum dado muda (RULE-ra-10) | teste de API com cada tipo de arquivo + teste e2e · interação do protótipo: `remote-questionnaire-import-errors |
| AC-ra-53 | CAP-ra-remote-questionnaire | Se a empresa já tem um rascunho, importar pede "Substituir o rascunho de {data}?", com a consequência e o verbo no botão. Cancelar mantém o rascunho atual; confirmar troca, e a empresa continua com um rascunho só | teste e2e (confirmar e cancelar) · interação do protótipo: `remote-questionnaire-replace-draft |
| AC-ra-59 | CAP-ra-diary, CAP-ra-brand, CAP-ra-remote-questionnaire | Excluir um mês, remover a logo, voltar à marca FitPulse e substituir um rascunho usam o modal do app, com título, consequência, verbo no botão e "Cancelar". Esc cancela e o foco fica preso no modal. Nenhum `alert`, `confirm` ou `prompt` nativo | teste e2e (confirmar e cancelar em cada um) |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-ra-remote-questionnaire | 6 | prisma/schema.prisma, prisma/migrations/20261026000300_questionnaire_sends/migration.sql, shared/content/questionBank.ts, server/questionnaire/questionnaireFile.ts, server/questionnaire/questionnaireClient.js, server/questionnaire/questionnaireStyles.css, server/validation/questionnaireSchemas.ts, server/repositories/questionnaireRepository.ts, server/repositories/diagnosisRepository.ts, server/services/questionnaireService.ts, server/routes/questionnaireRoutes.ts, server/app.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/services/historyService.ts, server/validation/companySchemas.ts, src/api/questionnaireApi.ts, src/features/questionnaire/SendQuestionnaireDialog.tsx, src/features/questionnaire/ImportAnswersDialog.tsx, src/features/companies/CompanyPage.tsx, src/features/history/CompanyTimeline.tsx, src/api/historyApi.ts, src/features/home/ConsultantHome.tsx, src/features/companies/CompaniesPage.tsx, tests/unit/questionnaireFile.test.ts, tests/api/questionnaireRoutes.test.ts, tests/e2e/remoteQuestionnaire.spec.ts | Teste Q-10 aprovado pelo dono + `pnpm exec vitest run tests/unit/questionnaireFile.test.ts tests/api/questionnaireRoutes.test.ts` + `node scripts/smoke-migrate.mjs` + `pnpm exec playwright test tests/e2e/remoteQuestionnaire.spec.ts tests/e2e/home.spec.ts |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-ra-remote-questionnaire | modify | prisma/schema.prisma | QuestionnaireSend` (`questionnaire_sends`: id, company_id com cascata, file_name, sent_at, answered_at, client_saved_at, draft_id) |
| CAP-ra-remote-questionnaire | create | prisma/migrations/20261026000300_questionnaire_sends/migration.sql | Só criação |
| CAP-ra-remote-questionnaire | reuse | shared/content/questionBank.ts | Sem mudança |
| CAP-ra-remote-questionnaire | create | server/questionnaire/questionnaireFile.ts | HTML único com CSP, estilos e script embutidos e os dados em JSON escapado |
| CAP-ra-remote-questionnaire | create | server/questionnaire/questionnaireClient.js | Formulário no navegador: aviso de computador, 8 blocos, máscaras da calculadora, "Revise e salve", download de `respostas-{empresa}.fitpulse |
| CAP-ra-remote-questionnaire | create | server/questionnaire/questionnaireStyles.css | Tokens da identidade com as pilhas de fonte do sistema |
| CAP-ra-remote-questionnaire | create | server/validation/questionnaireSchemas.ts | Arquivo de respostas: marca, versão, empresa, respostas e calculadora pelos schemas do PATCH; ≤ 1 MB |
| CAP-ra-remote-questionnaire | create | server/repositories/questionnaireRepository.ts | Envios, aguardando, marcar respondido |
| CAP-ra-remote-questionnaire | modify | server/repositories/diagnosisRepository.ts | Criar ou substituir o rascunho com respostas numa transação |
| CAP-ra-remote-questionnaire | create | server/services/questionnaireService.ts | Gerar, salvar e registrar; importar com as recusas da RULE-ra-10 e a substituição confirmada |
| CAP-ra-remote-questionnaire | create | server/routes/questionnaireRoutes.ts | POST /api/companies/:id/questionnaire` e `POST /api/companies/:id/questionnaire-answers` (parser de 2 MB) |
| CAP-ra-remote-questionnaire | modify | server/app.ts | Rotas do questionário |
| CAP-ra-remote-questionnaire | create | server/repositories/portfolioRepository.ts | Carrega os envios sem resposta |
| CAP-ra-remote-questionnaire | create | server/services/portfolioService.ts | "Questionários aguardando resposta" |
| CAP-ra-remote-questionnaire | modify | server/services/historyService.ts | Rascunho da linha do tempo com "Respostas do cliente, salvas em {data}" |
| CAP-ra-remote-questionnaire | modify | server/validation/companySchemas.ts | Filtro `aguardando |
| CAP-ra-remote-questionnaire | create | src/api/questionnaireApi.ts | Enviar e importar |
| CAP-ra-remote-questionnaire | create | src/features/questionnaire/SendQuestionnaireDialog.tsx | 3 passos, "Mostrar na pasta", mensagem com "Copiar mensagem" e texto selecionável se a cópia falhar |
| CAP-ra-remote-questionnaire | create | src/features/questionnaire/ImportAnswersDialog.tsx | "Lendo o arquivo…", recusas com `role="alert"` e "Nada foi alterado.", substituição no modal, "Revisar e concluir" |
| CAP-ra-remote-questionnaire | modify | src/features/companies/CompanyPage.tsx | "Enviar questionário" e "Importar respostas" no modo consultoria; "Questionário enviado em {data}" |
| CAP-ra-remote-questionnaire | modify | src/features/history/CompanyTimeline.tsx | Marca do rascunho importado |
| CAP-ra-remote-questionnaire | modify | src/api/historyApi.ts | Campo da marca do rascunho |
| CAP-ra-remote-questionnaire | modify | src/features/home/ConsultantHome.tsx | "Questionários aguardando resposta" |
| CAP-ra-remote-questionnaire | modify | src/features/companies/CompaniesPage.tsx | Filtro `aguardando |
| CAP-ra-remote-questionnaire | create | tests/unit/questionnaireFile.test.ts | Sem URL de rede, CSP, escape de nome hostil, só empresa, catálogo e marca |
| CAP-ra-remote-questionnaire | create | tests/api/questionnaireRoutes.test.ts | Envio registrado; importação válida; outra empresa; versão mais nova; incompatível; corrompido; > 1 MB; rascunho existente (409) e substituição |
| CAP-ra-remote-questionnaire | create | tests/e2e/remoteQuestionnaire.spec.ts | Gerar; abrir o arquivo no Chromium com a rede bloqueada; responder; salvar; importar; recusas; substituir e cancelar |

## Plan section for this phase (from the plan)

## Phase 6 — O consultor manda o questionário por arquivo e importa as respostas do cliente como rascunho

- CAP/AC:
  - CAP-ra-remote-questionnaire: AC-ra-48, AC-ra-49, AC-ra-50, AC-ra-51, AC-ra-52, AC-ra-53.
  - Completa: AC-ra-35 ("Questionários aguardando resposta") e AC-ra-36 (a importação muda os números).
  - Nas telas desta fase: AC-ra-59 (substituir o rascunho), AC-ra-60.
  - Interações do protótipo: `remote-questionnaire-send`, `remote-questionnaire-client-answer`, `remote-questionnaire-import`, `remote-questionnaire-import-errors`, `remote-questionnaire-replace-draft`.
- User-visible outcome:
  - No modo consultoria, "Enviar questionário" salva `{empresa}-questionario-{data}.html` em Downloads, mostra a mensagem para "Copiar mensagem", e a empresa entra em "Questionários aguardando resposta".
  - O cliente abre o arquivo no navegador do computador sem internet, responde os 8 blocos e salva `respostas-{empresa}.fitpulse`.
  - "Importar respostas" cria o rascunho marcado "Respostas do cliente, salvas em {data}", que conclui pelo portão normal.
  - Arquivos de outra empresa, de versão mais nova, incompatíveis, corrompidos ou grandes demais são recusados sem mudar nada.
- Implementation, nesta ordem:
  1. **Gerador e teste Q-10 primeiro.** É o que mais pode falhar e decide se a parte 3 segue.
     - Escrever `questionnaireFile.ts`, `questionnaireClient.js` e `questionnaireStyles.css` com o catálogo real (`shared/content/questionBank.ts`), o aviso e os textos do `## Conteúdo v2`, mais `tests/unit/questionnaireFile.test.ts`.
     - O teste grava um arquivo de exemplo em `test-results/questionario-exemplo.html`.
     - O dono o envia por Gmail, Outlook e WhatsApp a outro computador, abre no Chrome, no Edge, no Firefox e no Safari, responde e salva. Ele anota se algum antivírus ou e-mail bloqueou.
     - O @dev registra a matriz com `aioson dossier:add-finding . --slug=relatorios-e-acompanhamento --agent=dev --section="Q-10"`.
     - **Se algum canal ou navegador exigido falhar, a Fase 6 para e volta ao @product** para escolher entre as formas A e C. A Fase 7 segue sem os envios de questionário.
  2. **Persistência e API:**
     - Modelo `QuestionnaireSend` e migração `20261026000300_questionnaire_sends`. `questionnaireSchemas` e `questionnaireRepository`.
     - Rascunho criado ou substituído numa transação em `diagnosisRepository`.
     - `questionnaireService` com o envio registrado em `generated_files` e as recusas da RULE-ra-10. `questionnaireRoutes` com parser de 2 MB.
  3. **Atenção:** "aguardando" em `portfolioRepository`, `portfolioService` e `companySchemas`; marca do rascunho importado em `historyService`.
  4. **Tela:**
     - `questionnaireApi`, `SendQuestionnaireDialog`, `ImportAnswersDialog` (substituição no `ConfirmDialog`), os botões e "Questionário enviado em {data}" em `CompanyPage`.
     - Também `CompanyTimeline`, `historyApi`, `ConsultantHome` e `CompaniesPage`.
     - A composição segue `#/empresa/c3`, `#/empresa/c1` e `#/questionario-cliente`. O arquivo real leva as 24 perguntas (desvio 5 do PRD).
- Create/modify/reuse/retire:
  - modify: prisma/schema.prisma, server/repositories/diagnosisRepository.ts, server/app.ts, server/services/historyService.ts, server/validation/companySchemas.ts, src/features/companies/CompanyPage.tsx, src/features/history/CompanyTimeline.tsx, src/api/historyApi.ts, src/features/home/ConsultantHome.tsx, src/features/companies/CompaniesPage.tsx.
  - create: prisma/migrations/20261026000300_questionnaire_sends/migration.sql, server/questionnaire/questionnaireFile.ts, server/questionnaire/questionnaireClient.js, server/questionnaire/questionnaireStyles.css, server/validation/questionnaireSchemas.ts, server/repositories/questionnaireRepository.ts, server/services/questionnaireService.ts, server/routes/questionnaireRoutes.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, src/api/questionnaireApi.ts, src/features/questionnaire/SendQuestionnaireDialog.tsx, src/features/questionnaire/ImportAnswersDialog.tsx, tests/unit/questionnaireFile.test.ts, tests/api/questionnaireRoutes.test.ts, tests/e2e/remoteQuestionnaire.spec.ts.
  - reuse: shared/content/questionBank.ts.
- Verification:
  - `pnpm build`.
  - Matriz Q-10 registrada e aprovada pelo dono, antes do passo 2.
  - `pnpm exec vitest run tests/unit/questionnaireFile.test.ts tests/api/questionnaireRoutes.test.ts tests/api/diagnosisRoutes.test.ts tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts`.
  - `node scripts/smoke-migrate.mjs`.
  - `pnpm exec playwright test tests/e2e/remoteQuestionnaire.spec.ts tests/e2e/home.spec.ts tests/e2e/questionnaire.spec.ts`.
  - No dev-link do Play: enviar, responder noutro navegador, importar, revisar e concluir.
- Done when:
  - Uma importação válida vira rascunho com as 24 respostas e os 6 números sem redigitar.
  - Cada arquivo inválido é recusado sem mudar nada.
  - O arquivo gerado não faz requisição de rede.

## Context contract

- Plan: .aioson/context/implementation-plan-relatorios-e-acompanhamento.md — your phase section and table rows are embedded above; open the whole plan only for a cross-reference.
- PRD: .aioson/context/prd-relatorios-e-acompanhamento.md — the acceptance criteria of your capabilities are embedded above; open it only for a business rule they cite.
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=prisma/schema.prisma,prisma/migrations/20261026000300_questionnaire_sends/migration.sql,server/validation/questionnaireSchemas.ts,server/repositories/questionnaireRepository.ts,server/repositories/diagnosisRepository.ts,server/services/questionnaireService.ts,server/routes/questionnaireRoutes.ts,server/app.ts,src/api/questionnaireApi.ts,tests/api/questionnaireRoutes.test.ts --task="unit phase-6-backend-questionnaire-api of relatorios-e-acompanhamento"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
