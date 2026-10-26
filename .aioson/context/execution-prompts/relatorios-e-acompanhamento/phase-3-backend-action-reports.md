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

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-ra-05 | CAP-ra-diagnosis-report | O PDF do diagnóstico tem, nesta ordem:<br>1. capa com a marca de quem entrega, a empresa, a data, a versão do cálculo e a confiança;<br>2. resumo executivo: estágio, trava, as 3 ações, custo por cliente e relação lucro ÷ custo;<br>3. notas das 8 dimensões;<br>4. riscos;<br>5. seus números, com a explicação de cada um;<br>6. andamento das ações, quando houver;<br>7. "Como ler este relatório";<br>8. as respostas, só se a opção estiver marcada | teste de unidade do PDF (texto extraído com unpdf) + teste e2e da exportação · interação do protótipo: `report-export-pdf |
| AC-ra-06 | CAP-ra-diagnosis-report | O resumo executivo ocupa exatamente uma página: estágio, trava, as 3 ações e os números-chave ficam na mesma página, e a página seguinte começa nas dimensões | teste de unidade do PDF (texto por página) |
| AC-ra-07 | CAP-ra-diagnosis-report | As 8 dimensões aparecem em barras agrupadas em "Encaixes do negócio" e "Frentes de crescimento", cada barra com a nota escrita e a linha de 50. Impressa em preto e branco, nenhuma informação depende só da cor | teste de unidade do PDF + inspeção de uma impressão em escala de cinza |
| AC-ra-08 | CAP-ra-diagnosis-report | A página de riscos tem a matriz 5×5 (probabilidade × impacto), com cada risco marcado pelo número dele, e ao lado a lista com título, nota P × I, nível e "Como reduzir:". Sem riscos, a página diz "Nenhum risco encontrado nas respostas" | teste de unidade do PDF |
| AC-ra-09 | CAP-ra-diagnosis-report | "Incluir as respostas do questionário" vem desligado e explica por quê (as respostas trazem valores em reais). Ligado, o PDF ganha o apêndice com as 24 perguntas e a resposta escolhida, e os 6 números da calculadora. Desligado, o PDF não traz as respostas nem os valores digitados na calculadora (gasto, compra média, margem), só os números calculados | teste de unidade do PDF com a opção ligada e desligada · interação do protótipo: `report-include-answers |
| AC-ra-10 | CAP-ra-diagnosis-report, CAP-ra-polish | "Como ler este relatório" traz o texto aprovado do `## Conteúdo v2` e explica que o estágio depende das condições de cada degrau (RULE-dm-04). Nenhum PDF diz que o estágio é o da dimensão mais fraca | teste de unidade do PDF (frase presente e frase proibida ausente) |
| AC-ra-11 | CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report | Nenhum PDF contém os termos proibidos da RULE-dm-14. O aviso "Orientação baseada nas respostas da empresa. Não substitui uma análise financeira." aparece no resumo e em "Como ler" | teste de unidade dos três PDFs |
| AC-ra-12 | CAP-ra-evolution-report | Com 2 ou mais diagnósticos concluídos, "Evolução" oferece "De" e "Até" (padrão: os dois mais recentes). O PDF tem:<br>• capa;<br>• "Antes e depois": estágio antes → depois, custo por cliente, média das 8 dimensões, trava antes e agora, barras antes e depois com a diferença escrita;<br>• "O que foi feito no período" (parte 2): ações do diagnóstico "De" com o estado e se continuam no plano novo, mais o custo por cliente do diário no período. Antes da parte 2, ou sem andamento e sem diário no período, essa página não aparece;<br>• "Como ler" | teste de unidade do PDF · interação do protótipo: `report-type-evolution |
| AC-ra-13 | CAP-ra-evolution-report | Para o mesmo par, os estágios, as notas e as diferenças do PDF de evolução são iguais aos da tela "Comparar". Quando as versões das regras diferem, o PDF traz o mesmo aviso de recálculo da tela (RULE-ra-02) | teste de unidade comparando o PDF com a saída da comparação, com `tests/fixtures/rulesV2.ts |
| AC-ra-14 | CAP-ra-evolution-report | A lista "Até" só oferece diagnósticos posteriores ao escolhido em "De"; trocar "De" para depois de "Até" ajusta "Até" para o seguinte | teste e2e |
| AC-ra-15 | CAP-ra-portfolio-report | No modo consultoria, o PDF da carteira tem capa, empresas por estágio e a lista das empresas ativas com estágio, data do último diagnóstico, reavaliação atrasada (RULE-ra-07), risco alto e, com a parte 2, ações vencidas (RULE-ra-06); antes da parte 2, a coluna não aparece. Os números são os mesmos da tela inicial do consultor | teste de unidade do PDF + teste de API · interação do protótipo: `portfolio-report |
| AC-ra-16 | CAP-ra-portfolio-report | No modo minha empresa, a rota da carteira explica que o relatório é do modo consultoria e leva a Configurações para trocar o modo. Com a carteira vazia, explica que não há empresas ativas e oferece "Cadastrar a primeira empresa" | teste e2e |
| AC-ra-26 | CAP-ra-action-tracking | Cada ação do plano atual mostra estado, prazo, responsável e nota na aba "Ações" da empresa, no resultado e em "Suas 3 ações" na tela inicial do dono. Uma ação nova começa "A fazer", sem prazo, responsável nem nota (RULE-ra-04) | teste e2e |
| AC-ra-27 | CAP-ra-action-tracking | Mudar o estado grava na hora e mostra "'{ação}' agora está {estado}." com "Desfazer" por 6 segundos. "Desfazer" volta ao estado anterior e grava de novo. Recarregar mostra o estado gravado (RULE-ra-12) | teste e2e com recarga · interação do protótipo: `action-status-change-undo |
| AC-ra-28 | CAP-ra-action-tracking | "Editar" abre o formulário com:<br>• prazo com máscara `DD/MM/AAAA` (`inputmode="numeric"`), com data inválida recusada ao sair do campo e mensagem no campo;<br>• responsável na lista de papéis, sem campo de nome;<br>• nota de até 500 caracteres, com contador.<br>Salvar altera só aquela ação; os mesmos campos voltam preenchidos ao editar de novo | teste e2e (formulário, edição de uma ação específica) · interação do protótipo: `action-edit-due-role-note |
| AC-ra-29 | CAP-ra-action-tracking | Mudar o andamento de uma ação ou concluir um diagnóstico novo não altera o resultado guardado de nenhum diagnóstico. A comparação e o PDF de um diagnóstico anterior continuam iguais (RULE-ra-01) | teste de API comparando o resultado antes e depois |
| AC-ra-30 | CAP-ra-action-tracking | O resultado de um diagnóstico cujo plano foi substituído mostra as 3 ações como encerradas, com o estado em que ficaram e sem controles de edição | teste e2e |
| AC-ra-63 | CAP-ra-action-tracking | Empresa sem diagnóstico concluído: a aba "Ações" mostra o estado vazio, que explica que as ações nascem do diagnóstico, com o caminho para começar ou continuar o diagnóstico. Rascunhos não têm ações | teste e2e |
| AC-ra-57 | CAP-ra-report-center, CAP-ra-brand, CAP-ra-action-tracking, CAP-ra-diary, CAP-ra-home-followup | Em 390 px de largura:<br>• nenhuma tela nova tem rolagem horizontal;<br>• a prévia empilha as páginas na vertical;<br>• os alvos de toque têm pelo menos 44 px ou ficam dentro de um rótulo clicável desse tamanho;<br>• o foco do teclado é sempre visível;<br>• o texto tem contraste de pelo menos 4,5:1 nos dois temas | teste e2e com axe nos dois temas · interação do protótipo: `switch-theme |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-ra-diagnosis-report | 1 | server/report/reportModel.ts, server/report/reportCopy.ts, server/report/documentParts.ts, server/report/pdfRenderer.ts, server/report/pdfBlocks.ts, server/report/pdfCharts.ts, shared/format/confidenceText.ts, tests/unit/reportModel.test.ts, tests/unit/pdfRenderer.test.ts, tests/unit/forbiddenTerms.test.ts | pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/pdfRenderer.test.ts tests/unit/forbiddenTerms.test.ts` + impressão em escala de cinza de um PDF exportado |
| CAP-ra-evolution-report | 2 | server/services/historyService.ts, shared/domain/compareDiagnoses.ts, shared/content/comparisonCopy.ts, src/features/history/ComparePage.tsx, server/report/evolutionDocument.ts, server/validation/reportSchemas.ts, server/services/reportService.ts, src/features/reports/ReportOptions.tsx, tests/unit/evolutionDocument.test.ts, tests/fixtures/rulesV2.ts, tests/e2e/report.spec.ts, tests/unit/forbiddenTerms.test.ts | pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/historyRoutes.test.ts` + `pnpm exec playwright test tests/e2e/report.spec.ts tests/e2e/history.spec.ts |
| CAP-ra-portfolio-report | 2 | shared/domain/followUp.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/services/homeService.ts, server/report/portfolioDocument.ts, server/services/reportService.ts, src/features/reports/PortfolioReportPage.tsx, src/features/home/ConsultantHome.tsx, src/App.tsx, tests/unit/followUp.test.ts, tests/unit/portfolioDocument.test.ts, tests/api/homeRoutes.test.ts, tests/e2e/portfolioReport.spec.ts, tests/unit/forbiddenTerms.test.ts | pnpm exec vitest run tests/unit/followUp.test.ts tests/unit/portfolioDocument.test.ts tests/api/homeRoutes.test.ts` + `pnpm exec playwright test tests/e2e/portfolioReport.spec.ts tests/e2e/home.spec.ts |
| CAP-ra-action-tracking | 3 | prisma/schema.prisma, prisma/migrations/20261026000100_action_progress/migration.sql, shared/domain/actionProgress.ts, shared/content/actionProgressOptions.ts, shared/format/dates.ts, src/components/form/DateField.tsx, server/repositories/actionProgressRepository.ts, server/validation/actionSchemas.ts, server/services/actionService.ts, server/routes/actionRoutes.ts, server/app.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/report/portfolioDocument.ts, server/services/reportService.ts, src/api/actionsApi.ts, src/features/actions/CompanyActionsTab.tsx, src/features/actions/ActionProgressRow.tsx, src/features/actions/ActionEditDialog.tsx, src/features/actions/useActionStatus.ts, src/components/feedback/UndoNotice.tsx, src/features/result/ActionPlanList.tsx, src/features/result/ResultPage.tsx, src/features/companies/CompanyTabs.tsx, src/App.tsx, tests/unit/actionProgress.test.ts, tests/unit/dates.test.ts, tests/api/actionRoutes.test.ts, tests/e2e/actions.spec.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts, tests/unit/portfolioDocument.test.ts | pnpm exec vitest run tests/unit/actionProgress.test.ts tests/unit/dates.test.ts tests/api/actionRoutes.test.ts tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts tests/unit/portfolioDocument.test.ts` + `node scripts/smoke-migrate.mjs` + `pnpm exec playwright test tests/e2e/actions.spec.ts |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-ra-diagnosis-report | modify | server/report/reportModel.ts | buildDiagnosisDocument` na ordem da AC-ra-05; respostas em páginas próprias só com `includeAnswers`; sem elas, nenhum valor digitado; mantém os formatadores de data |
| CAP-ra-diagnosis-report | create | server/report/reportCopy.ts | Textos do `## Conteúdo v2` ("Como ler", abertura das dimensões, aviso) e "Nenhum risco encontrado nas respostas" |
| CAP-ra-diagnosis-report | create | server/report/documentParts.ts | Capa, rodapé e "Como ler" para os três documentos |
| CAP-ra-diagnosis-report | modify | server/report/pdfRenderer.ts | Desenha qualquer `ReportDocument`, uma página por A4 (erro se não couber); capa; rodapé com "N de M"; mesmas fontes embutidas |
| CAP-ra-diagnosis-report | create | server/report/pdfBlocks.ts | Blocos de texto do documento |
| CAP-ra-diagnosis-report | create | server/report/pdfCharts.ts | Barras agrupadas com nota escrita e linha de 50 legíveis em cinza; matriz 5×5 com o número de cada risco |
| CAP-ra-diagnosis-report | create | shared/format/confidenceText.ts | Uma função para a tela e o PDF, sempre "itens" |
| CAP-ra-diagnosis-report | modify | tests/unit/reportModel.test.ts | Ordem das páginas, respostas ligadas e desligadas, "Como ler", frase proibida ausente |
| CAP-ra-diagnosis-report | create | tests/unit/pdfRenderer.test.ts | Páginas do PDF = páginas do documento; texto por página (resumo inteiro numa página, dimensões começando na seguinte); nota escrita em cada barra |
| CAP-ra-diagnosis-report | modify | tests/unit/forbiddenTerms.test.ts | Inclui o PDF do diagnóstico novo |
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
| CAP-ra-portfolio-report | create | shared/domain/followUp.ts | Data local, `DEFAULT_REEVALUATION_DAYS = 90`, data de reavaliação e atraso (RULE-ra-07) |
| CAP-ra-portfolio-report | create | server/repositories/portfolioRepository.ts | Leitura da carteira fora do serviço |
| CAP-ra-portfolio-report | create | server/services/portfolioService.ts | Fonte única da carteira e das listas de atenção para a tela do consultor, o PDF e os filtros |
| CAP-ra-portfolio-report | modify | server/services/homeService.ts | Delega ao `portfolioService`; contrato IF-007 igual |
| CAP-ra-portfolio-report | create | server/report/portfolioDocument.ts | Capa, empresas por estágio, lista ativa paginada |
| CAP-ra-portfolio-report | modify | server/services/reportService.ts | Seleção `portfolio`; nome `carteira-{data}.pdf |
| CAP-ra-portfolio-report | create | src/features/reports/PortfolioReportPage.tsx | Rota `relatorios/carteira`; explicação no modo minha empresa; carteira vazia com "Cadastrar a primeira empresa"; prévia e entrega |
| CAP-ra-portfolio-report | modify | src/features/home/ConsultantHome.tsx | "Relatório da carteira" |
| CAP-ra-portfolio-report | modify | src/App.tsx | Rota `relatorios/carteira |
| CAP-ra-portfolio-report | create | tests/unit/followUp.test.ts | Intervalo, atraso e virada do dia local |
| CAP-ra-portfolio-report | create | tests/unit/portfolioDocument.test.ts | Mesmos números da tela do consultor; paginação |
| CAP-ra-portfolio-report | modify | tests/api/homeRoutes.test.ts | Tela do consultor igual depois da extração |
| CAP-ra-portfolio-report | create | tests/e2e/portfolioReport.spec.ts | Prévia e exportação, modo minha empresa, carteira vazia |
| CAP-ra-portfolio-report | modify | tests/unit/forbiddenTerms.test.ts | Inclui o PDF da carteira |
| CAP-ra-action-tracking | modify | prisma/schema.prisma | ActionProgress` (`action_progress`: id, diagnosis_id com cascata, action_key, status, due_date `YYYY-MM-DD`, owner_role, note, inherited_from_id, created_at, updated_at; único (diagnosis_id, action_key)) |
| CAP-ra-action-tracking | create | prisma/migrations/20261026000100_action_progress/migration.sql | Só criação |
| CAP-ra-action-tracking | create | shared/domain/actionProgress.ts | Estados, papéis, padrão "A fazer", vencida (RULE-ra-06), herança pura (RULE-ra-05) |
| CAP-ra-action-tracking | create | shared/content/actionProgressOptions.ts | "A fazer", "Em andamento", "Feita", "Não se aplica" e os 5 papéis |
| CAP-ra-action-tracking | create | shared/format/dates.ts | Máscara `DD/MM/AAAA` com cursor, data real, conversão para `YYYY-MM-DD |
| CAP-ra-action-tracking | create | src/components/form/DateField.tsx | inputmode="numeric"`, erro ao sair do campo |
| CAP-ra-action-tracking | create | server/repositories/actionProgressRepository.ts | Ler por diagnóstico e empresa; criar na edição de um concluído da versão 1 |
| CAP-ra-action-tracking | create | server/validation/actionSchemas.ts | Estado, prazo, papel, nota ≤ 500 |
| CAP-ra-action-tracking | create | server/services/actionService.ts | Plano atual e encerrados da empresa; ações de um diagnóstico com `isCurrent`; edição com 409 `plan_closed |
| CAP-ra-action-tracking | create | server/routes/actionRoutes.ts | GET /api/companies/:id/actions`, `GET /api/diagnoses/:id/actions`, `PATCH /api/diagnoses/:id/actions/:actionKey |
| CAP-ra-action-tracking | modify | server/app.ts | Rotas das ações |
| CAP-ra-action-tracking | create | server/repositories/portfolioRepository.ts | Carrega o andamento do plano atual |
| CAP-ra-action-tracking | create | server/services/portfolioService.ts | Ações vencidas por empresa (RULE-ra-06) |
| CAP-ra-action-tracking | modify | server/report/reportModel.ts | Página "Andamento das ações" |
| CAP-ra-action-tracking | create | server/report/evolutionDocument.ts | Ações do "De" com estado e se continuam no plano novo |
| CAP-ra-action-tracking | create | server/report/portfolioDocument.ts | Coluna de ações vencidas |
| CAP-ra-action-tracking | modify | server/services/reportService.ts | Passa o andamento aos documentos |
| CAP-ra-action-tracking | create | src/api/actionsApi.ts | Ler e editar |
| CAP-ra-action-tracking | create | src/features/actions/CompanyActionsTab.tsx | Rota `empresa/:id/acoes`; plano atual e encerrados; vazio sem concluído (AC-ra-63) |
| CAP-ra-action-tracking | create | src/features/actions/ActionProgressRow.tsx | Estado editável, prazo, responsável, nota, vencida, "Continua do diagnóstico de {data}", encerrada sem controles; chave = `diagnosisId:actionKey |
| CAP-ra-action-tracking | create | src/features/actions/ActionEditDialog.tsx | Prazo mascarado, papel (sem nome), nota com contador |
| CAP-ra-action-tracking | create | src/features/actions/useActionStatus.ts | Grava na hora, "Desfazer" por 6 s |
| CAP-ra-action-tracking | create | src/components/feedback/UndoNotice.tsx | role="status"` com "Desfazer" |
| CAP-ra-action-tracking | modify | src/features/result/ActionPlanList.tsx | Andamento editável no plano atual; encerrado sem edição |
| CAP-ra-action-tracking | modify | src/features/result/ResultPage.tsx | Carrega as ações do diagnóstico |
| CAP-ra-action-tracking | create | src/features/companies/CompanyTabs.tsx | Aba "Ações" |
| CAP-ra-action-tracking | modify | src/App.tsx | Rota `empresa/:companyId/acoes |
| CAP-ra-action-tracking | create | tests/unit/actionProgress.test.ts | Vencida e herança |
| CAP-ra-action-tracking | create | tests/unit/dates.test.ts | Máscara e data real |
| CAP-ra-action-tracking | create | tests/api/actionRoutes.test.ts | Edição, `plan_closed`, resultado guardado igual (AC-ra-29) |
| CAP-ra-action-tracking | create | tests/e2e/actions.spec.ts | Estado, desfazer com recarga, edição de uma ação específica, encerradas, vazio |
| CAP-ra-action-tracking | modify | tests/unit/reportModel.test.ts | Página do andamento |
| CAP-ra-action-tracking | create | tests/unit/evolutionDocument.test.ts | "O que foi feito no período" com as ações |
| CAP-ra-action-tracking | create | tests/unit/portfolioDocument.test.ts | Coluna de vencidas |

## Plan section for this phase (from the plan)

## Phase 3 — Cada uma das 3 ações tem estado, prazo, responsável e nota, e o diagnóstico novo herda o que se repete

- CAP/AC:
  - CAP-ra-action-tracking: AC-ra-26 (aba Ações e resultado; "Suas 3 ações" na Fase 5), AC-ra-27, AC-ra-28, AC-ra-29, AC-ra-30, AC-ra-63.
  - CAP-ra-action-inheritance: AC-ra-31, AC-ra-32.
  - Completam nos PDFs: AC-ra-05 (página "Andamento das ações"), AC-ra-12 (ações em "O que foi feito no período") e AC-ra-15 (coluna de ações vencidas).
  - Nas telas desta fase: AC-ra-57.
  - Interações do protótipo: `action-status-change-undo`, `action-edit-due-role-note`, `action-inherited-from-previous`.
- User-visible outcome:
  - Na aba "Ações" da empresa e no resultado, o usuário muda o estado de uma ação. Aparece "'{ação}' agora está {estado}." com "Desfazer" por 6 segundos, e o estado continua depois de recarregar.
  - "Editar" grava prazo `DD/MM/AAAA`, papel e nota só daquela ação.
  - Ao concluir um diagnóstico novo, a ação que se repete aparece com "Continua do diagnóstico de {data}". As outras ficam encerradas, sem controles, no resultado anterior.
  - Arquivar o diagnóstico novo devolve o plano anterior com o andamento que tinha.
  - Os PDFs passam a mostrar o andamento, e a carteira mostra as ações vencidas.
- Implementation, nesta ordem:
  1. **Domínio puro com testes antes:** `actionProgress.ts` (padrão, vencida, `inheritActionProgress`), `actionProgressOptions.ts` e `dates.ts`.
  2. **Persistência:**
     - Modelo `ActionProgress` e a migração `20261026000100_action_progress`.
     - `actionProgressRepository`.
     - `completeDraft` cria as linhas na mesma transação.
     - `diagnosisService.complete` lê o plano anterior e aplica a herança.
  3. **API:** `actionSchemas`, `actionService` (`plan_closed` para plano encerrado) e `actionRoutes`.
  4. **Tela:**
     - Componentes: `actionsApi`, `UndoNotice`, `useActionStatus`, `ActionProgressRow` (chave `diagnosisId:actionKey`), `ActionEditDialog` com `DateField` e `CompanyActionsTab` na rota `acoes`.
     - `ActionPlanList` e `ResultPage` mostram o andamento.
     - A composição segue `#/empresa/c1/acoes`, `#/resultado/d2` e `#/resultado/d1`.
  5. **Relatórios:**
     - Página "Andamento das ações" em `reportModel` e ações do "De" em `evolutionDocument`.
     - Vencidas em `portfolioRepository`, `portfolioService` e `portfolioDocument`, passando por `reportService`.
- Create/modify/reuse/retire:
  - modify: prisma/schema.prisma, server/app.ts, server/report/reportModel.ts, server/services/reportService.ts, src/features/result/ActionPlanList.tsx, src/features/result/ResultPage.tsx, src/App.tsx, tests/unit/reportModel.test.ts, server/repositories/diagnosisRepository.ts, server/services/diagnosisService.ts, tests/api/diagnosisRoutes.test.ts.
  - create: prisma/migrations/20261026000100_action_progress/migration.sql, shared/domain/actionProgress.ts, shared/content/actionProgressOptions.ts, shared/format/dates.ts, src/components/form/DateField.tsx, server/repositories/actionProgressRepository.ts, server/validation/actionSchemas.ts, server/services/actionService.ts, server/routes/actionRoutes.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/report/evolutionDocument.ts, server/report/portfolioDocument.ts, src/api/actionsApi.ts, src/features/actions/CompanyActionsTab.tsx, src/features/actions/ActionProgressRow.tsx, src/features/actions/ActionEditDialog.tsx, src/features/actions/useActionStatus.ts, src/components/feedback/UndoNotice.tsx, src/features/companies/CompanyTabs.tsx, tests/unit/actionProgress.test.ts, tests/unit/dates.test.ts, tests/api/actionRoutes.test.ts, tests/e2e/actions.spec.ts, tests/unit/evolutionDocument.test.ts, tests/unit/portfolioDocument.test.ts.
  - reuse: shared/domain/actionPlan.ts.
- Verification:
  - `pnpm build`.
  - `pnpm exec vitest run tests/unit/actionProgress.test.ts tests/unit/dates.test.ts tests/api/actionRoutes.test.ts tests/api/diagnosisRoutes.test.ts tests/api/historyRoutes.test.ts tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts tests/unit/portfolioDocument.test.ts`.
  - `node scripts/smoke-migrate.mjs`.
  - `pnpm exec playwright test tests/e2e/actions.spec.ts tests/e2e/result.spec.ts tests/e2e/history.spec.ts`.
  - No dev-link do Play:
    - mudar o estado e desfazer;
    - concluir um segundo diagnóstico e ver a herança;
    - exportar o PDF com o andamento.
- Done when:
  - O andamento grava, desfaz e sobrevive à recarga.
  - A herança segue a RULE-ra-05 sem duplicar.
  - O resultado guardado de qualquer diagnóstico continua idêntico.

## Context contract

- Plan: .aioson/context/implementation-plan-relatorios-e-acompanhamento.md — your phase section and table rows are embedded above; open the whole plan only for a cross-reference.
- PRD: .aioson/context/prd-relatorios-e-acompanhamento.md — the acceptance criteria of your capabilities are embedded above; open it only for a business rule they cite.
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=server/repositories/portfolioRepository.ts,server/services/portfolioService.ts,server/report/reportModel.ts,server/report/evolutionDocument.ts,server/report/portfolioDocument.ts,server/services/reportService.ts,tests/unit/reportModel.test.ts,tests/unit/evolutionDocument.test.ts,tests/unit/portfolioDocument.test.ts --task="unit phase-3-backend-action-reports of relatorios-e-acompanhamento"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
