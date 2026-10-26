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

# Unit contract — relatorios-e-acompanhamento / phase-1-frontend-report-center

- Feature: relatorios-e-acompanhamento
- Lane: frontend (write paths: src/App.tsx, src/components/**, src/features/**, src/styles/**)
- Phase: 1-frontend-report-center — wave 4 of 14
- Depends on: phase-1-frontend-company-tabs (after its implementation), phase-1-backend-document (after its implementation), phase-1-backend-report-api (after its implementation), phase-1-backend-files (after its implementation) — their files are done work you build on, never files you edit
- Scope: CAP-ra-report-center, CAP-ra-pdf-delivery; AC-ra-01, AC-ra-02, AC-ra-03, AC-ra-04, AC-ra-19, AC-ra-58; IF-001, IF-002, IF-004
- Capabilities: CAP-ra-report-center, CAP-ra-pdf-delivery
- Acceptance criteria: AC-ra-01, AC-ra-02, AC-ra-03, AC-ra-04, AC-ra-19, AC-ra-58
- Other acceptance criteria of these capabilities (context only — sibling units or integration deliver them): AC-ra-17, AC-ra-18, AC-ra-57, AC-ra-60, AC-ra-61
- Allowed files (create/modify ONLY these):
  - src/features/reports/ReportCenterPage.tsx
  - src/features/reports/ReportOptions.tsx
  - src/features/reports/ReportPreview.tsx
  - src/features/reports/ReportSheet.tsx
  - src/features/reports/ReportSheetCharts.tsx
  - src/features/reports/useReportPreview.ts
  - src/features/reports/ReportDelivery.tsx
  - src/styles/global.css
- Done when: `pnpm typecheck` passa e as telas usam só as rotas e campos do IF-001 e do IF-002
- Verification:
  - `pnpm typecheck` passa e as telas usam só as rotas e campos do IF-001 e do IF-002
- Verification ownership: ONLY the local Done when / Verification above decides this unit. Capability/phase checks quoted below are deferred integration evidence, not a prerequisite for this unit. Never fail a local unit because a sibling has not yet produced its test or UI. Report the remaining integration checks as messages to integration; do not claim the whole capability passed.

## Acceptance criteria (from the PRD)

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-ra-01 | CAP-ra-report-center | "Relatórios" abre a central da empresa a partir de três lugares: a aba "Relatórios" da página da empresa, o topo do resultado e a tela inicial do dono. No modo consultoria, a tela inicial tem também "Relatório da carteira". A central mostra à esquerda o tipo, o diagnóstico ou o par e as opções; à direita, a prévia paginada | teste e2e · interação do protótipo: `report-type-diagnosis`, `portfolio-report |
| AC-ra-02 | CAP-ra-report-center | Trocar o tipo, o diagnóstico, o par da evolução ou a opção de respostas muda a prévia na hora. A prévia tem as mesmas páginas, na mesma ordem e com os mesmos títulos e números do PDF exportado a seguir. A página alterada é destacada, com a faixa de "reimpressão" e a rolagem até ela | teste e2e comparando os títulos da prévia com o texto do PDF (unpdf) · interação do protótipo: `report-type-evolution`, `report-include-answers |
| AC-ra-03 | CAP-ra-report-center | Empresa sem diagnóstico concluído: a central mostra o estado vazio com o caminho para começar ou continuar o diagnóstico e não oferece exportar. Com 1 diagnóstico concluído, "Evolução" fica desativada e explica "A evolução precisa de 2 diagnósticos concluídos da mesma empresa." | teste e2e |
| AC-ra-04 | CAP-ra-report-center | Enquanto a central carrega, aparece o estado de carregamento (`aria-busy`). Uma falha ao ler os dados mostra o erro (`role="alert"`) com "Tentar de novo", sem prévia parcial | teste e2e com falha simulada na API |
| AC-ra-17 | CAP-ra-pdf-delivery | "Exportar PDF" mostra "Salvando…" e depois "PDF salvo", com o nome do arquivo, a pasta, "Abrir PDF" e "Mostrar na pasta". Os nomes são `{empresa}-{data}.pdf`, `{empresa}-evolucao-{de}-a-{ate}.pdf` e `carteira-{data}.pdf`, com datas `AAAA-MM-DD` e nomes saneados como na versão 1; um nome repetido ganha " (2)" | teste de API + teste e2e · interação do protótipo: `report-export-pdf |
| AC-ra-18 | CAP-ra-pdf-delivery | "Abrir PDF" abre o arquivo no leitor padrão do computador e "Mostrar na pasta" abre a pasta Downloads com o arquivo, pelo backend do app. O pedido só identifica um arquivo que o próprio app salvou na pasta Downloads; nenhum caminho vem da tela. Se o sistema não conseguir abrir, aparece "Não foi possível abrir. O arquivo está em {pasta}." | teste de API (arquivo do app aceito, nome fora da pasta recusado, falha do sistema) + smoke manual no webview do Play · interação do protótipo: `report-open-pdf`, `report-show-folder |
| AC-ra-19 | CAP-ra-pdf-delivery | Uma falha de gravação mostra o erro com "Tentar de novo", a central continua aberta e nada muda; tentar de novo depois de resolvida a falha salva o arquivo | teste e2e com falha de gravação simulada · interação do protótipo: `report-export-failure-retry |
| AC-ra-57 | CAP-ra-report-center, CAP-ra-brand, CAP-ra-action-tracking, CAP-ra-diary, CAP-ra-home-followup | Em 390 px de largura:<br>• nenhuma tela nova tem rolagem horizontal;<br>• a prévia empilha as páginas na vertical;<br>• os alvos de toque têm pelo menos 44 px ou ficam dentro de um rótulo clicável desse tamanho;<br>• o foco do teclado é sempre visível;<br>• o texto tem contraste de pelo menos 4,5:1 nos dois temas | teste e2e com axe nos dois temas · interação do protótipo: `switch-theme |
| AC-ra-58 | CAP-ra-report-center, CAP-ra-home-followup, CAP-ra-diary | Com `prefers-reduced-motion: reduce`, nenhuma animação nova roda: faixa de reimpressão, entrada em sequência, revelação das páginas, traço sob a aba e poeira do fundo. As telas aparecem já no estado final | teste e2e com emulação de movimento reduzido |
| AC-ra-60 | CAP-ra-report-center, CAP-ra-pdf-delivery | Com a rede externa desligada, a central gera e salva os três PDFs com as fontes embutidas. Nenhuma tela nova faz requisição fora de `127.0.0.1`/`localhost` (RULE-dm-19) | teste e2e com a fixture que reprova requisições externas |
| AC-ra-61 | CAP-ra-report-center | O botão "Relatórios" fica visível na primeira dobra da página da empresa e do resultado, em 1280 px e em 390 px | teste e2e nas duas larguras |

## Capability delivery (from the plan)

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-ra-report-center | 1 | src/App.tsx, src/features/companies/CompanyPage.tsx, src/features/companies/CompanyTabs.tsx, src/features/companies/CompanyDiagnosesTab.tsx, src/features/reports/ReportCenterPage.tsx, src/features/reports/ReportOptions.tsx, src/features/reports/ReportPreview.tsx, src/features/reports/ReportSheet.tsx, src/features/reports/ReportSheetCharts.tsx, src/features/reports/useReportPreview.ts, src/api/reportApi.ts, src/features/home/OwnerHome.tsx, src/styles/global.css, shared/report/reportDocument.ts, shared/report/paperPalette.ts, server/validation/reportSchemas.ts, server/routes/reportRoutes.ts, tests/e2e/report.spec.ts, tests/e2e/accessibility.spec.ts, tests/e2e/support/fixtures.ts, .aioson/plans/relatorios-e-acompanhamento/harness-contract.json | pnpm exec playwright test tests/e2e/report.spec.ts tests/e2e/accessibility.spec.ts` + `aioson harness:check . --slug=relatorios-e-acompanhamento` + central aberta no dev-link do Play |
| CAP-ra-pdf-delivery | 1 | prisma/schema.prisma, prisma/migrations/20261026000000_generated_files/migration.sql, server/repositories/generatedFileRepository.ts, server/services/reportService.ts, server/files/downloadsFolder.ts, server/files/systemOpener.ts, server/services/fileService.ts, server/routes/fileRoutes.ts, server/app.ts, server/main.ts, src/api/filesApi.ts, src/features/reports/ReportDelivery.tsx, tests/api/reportRoutes.test.ts, tests/api/fileRoutes.test.ts | pnpm exec vitest run tests/api/reportRoutes.test.ts tests/api/fileRoutes.test.ts` + `node scripts/smoke-migrate.mjs` + "Abrir PDF" e "Mostrar na pasta" no webview do Play no Windows (OQ-ra-1) |

## Implementation delta (from the plan)

| CAP | Action | Exact paths | Required change |
|---|---|---|---|
| CAP-ra-report-center | modify | src/App.tsx | Rotas aninhadas `empresa/:companyId` (índice = Diagnósticos) e `empresa/:companyId/relatorios |
| CAP-ra-report-center | modify | src/features/companies/CompanyPage.tsx | Vira o layout da empresa (cabeçalho, `CompanyTabs`, `<Outlet>` com a empresa no contexto); o conteúdo dos diagnósticos sai para `CompanyDiagnosesTab |
| CAP-ra-report-center | create | src/features/companies/CompanyTabs.tsx | Abas por rota com o traço sob a ativa; "Relatórios" na primeira dobra em 1280 e 390 px |
| CAP-ra-report-center | create | src/features/companies/CompanyDiagnosesTab.tsx | Mesmo conteúdo da versão 1 como aba índice |
| CAP-ra-report-center | create | src/features/reports/ReportCenterPage.tsx | Opções à esquerda e prévia à direita; carregando (`aria-busy`), erro (`role="alert"` + "Tentar de novo", sem prévia parcial), vazio sem concluído (BR-ra-01); `?diagnostico=` vindo do resultado |
| CAP-ra-report-center | create | src/features/reports/ReportOptions.tsx | Tipo (Evolução desativada com a explicação da BR-ra-02), diagnóstico, "Incluir as respostas do questionário" desligado com o motivo |
| CAP-ra-report-center | create | src/features/reports/ReportPreview.tsx | Folhas paginadas do `ReportDocument`; página alterada com a faixa de reimpressão e rolagem até ela; empilha em 390 px |
| CAP-ra-report-center | create | src/features/reports/ReportSheet.tsx | Blocos de uma página (títulos, fatos, parágrafos, listas, tabelas, avisos) com a paleta do papel |
| CAP-ra-report-center | create | src/features/reports/ReportSheetCharts.tsx | Barras agrupadas com nota escrita e linha de 50; matriz 5×5 numerada com descrição acessível |
| CAP-ra-report-center | create | src/features/reports/useReportPreview.ts | Busca a prévia a cada troca, cancela a anterior e devolve o id da página que mudou |
| CAP-ra-report-center | modify | src/api/reportApi.ts | getReportPreview(selection)` e `exportReportFile(selection)`; `exportReport` mantido para o resultado |
| CAP-ra-report-center | modify | src/features/home/OwnerHome.tsx | Botão "Relatórios" para a central da empresa em foco |
| CAP-ra-report-center | modify | src/styles/global.css | Classes da folha, faixa de reimpressão (700 ms) e entrada da página (220 ms) só sob `prefers-reduced-motion: no-preference |
| CAP-ra-report-center | create | shared/report/reportDocument.ts | Tipos `ReportDocument`, `ReportPage` (id estável, título, blocos) e a união `ReportBlock |
| CAP-ra-report-center | create | shared/report/paperPalette.ts | Fonte única da paleta do papel para o PDF e a prévia |
| CAP-ra-report-center | create | server/validation/reportSchemas.ts | Seleção discriminada `diagnosis` (`diagnosisId`, `includeAnswers`); limites de id |
| CAP-ra-report-center | modify | server/routes/reportRoutes.ts | GET /api/reports/preview` e `POST /api/reports/export`; a rota da versão 1 delega ao mesmo serviço |
| CAP-ra-report-center | modify | tests/e2e/report.spec.ts | Três pontos de entrada; troca de opção muda a prévia; títulos da prévia = texto do PDF salvo (unpdf); vazio; evolução desativada; carregando e erro com falha simulada da API; "Relatórios" na primeira dobra |
| CAP-ra-report-center | modify | tests/e2e/accessibility.spec.ts | Central em 390 px, axe nos dois temas, movimento reduzido |
| CAP-ra-report-center | modify | tests/e2e/support/fixtures.ts | Ler o texto de um PDF salvo na pasta Downloads do workspace |
| CAP-ra-report-center | create | .aioson/plans/relatorios-e-acompanhamento/harness-contract.json | RG-build, RG-migrate, RG-boot, RG-smoke, C-unit, C-package |
| CAP-ra-pdf-delivery | modify | prisma/schema.prisma | Modelo `GeneratedFile` (`generated_files`: id, company_id com cascata, kind, file_name, directory, created_at) |
| CAP-ra-pdf-delivery | create | prisma/migrations/20261026000000_generated_files/migration.sql | Gerada por `prisma migrate diff`; só criação |
| CAP-ra-pdf-delivery | create | server/repositories/generatedFileRepository.ts | Grava e lê os arquivos do app; último PDF por empresa |
| CAP-ra-pdf-delivery | modify | server/services/reportService.ts | preview(selection)` sem desenhar; `export(selection)` desenha, salva, registra e responde `{ fileId, fileName, directory }`; registro falho apaga o arquivo e dá `write_failed |
| CAP-ra-pdf-delivery | reuse | server/files/downloadsFolder.ts | Sem mudança |
| CAP-ra-pdf-delivery | create | server/files/systemOpener.ts | openFile`/`revealFile` com `spawn` sem shell: Windows `explorer.exe` (`/select,` com `windowsVerbatimArguments`; o código de saída do explorer não indica falha, só o evento `error`), macOS `open`/`open -R`, Linux `xdg-open` (a pasta) |
| CAP-ra-pdf-delivery | create | server/services/fileService.ts | Id → registro → caminho dentro da pasta Downloads do app → arquivo presente → abridor; falha → `open_failed` com a pasta |
| CAP-ra-pdf-delivery | create | server/routes/fileRoutes.ts | POST /api/files/:fileId/open` e `POST /api/files/:fileId/reveal |
| CAP-ra-pdf-delivery | modify | server/app.ts | Dependência `systemOpener` (padrão: o real) e rotas de arquivo |
| CAP-ra-pdf-delivery | modify | server/main.ts | Passa o abridor real |
| CAP-ra-pdf-delivery | create | src/api/filesApi.ts | openSavedFile(id)` e `revealSavedFile(id) |
| CAP-ra-pdf-delivery | create | src/features/reports/ReportDelivery.tsx | "Salvando…" → "PDF salvo" com nome, pasta, "Abrir PDF" e "Mostrar na pasta"; falha de gravação com "Tentar de novo"; falha ao abrir com a pasta |
| CAP-ra-pdf-delivery | modify | tests/api/reportRoutes.test.ts | Prévia e exportação por seleção, nome, " (2)", registro, falha sem arquivo nem registro |
| CAP-ra-pdf-delivery | create | tests/api/fileRoutes.test.ts | Abridor falso: arquivo do app aceito; id desconhecido e arquivo apagado → 404; falha do sistema → erro com a pasta; campo de caminho ignorado |

## Plan section for this phase (from the plan)

## Phase 1 — Na página da empresa, o usuário monta o relatório do diagnóstico vendo a folha mudar, salva o PDF e o abre

- CAP/AC:
  - CAP-ra-report-center: AC-ra-01 (empresa, resultado e tela inicial do dono; a carteira entra na Fase 2), AC-ra-02, AC-ra-03, AC-ra-04, AC-ra-61.
  - CAP-ra-diagnosis-report: AC-ra-05, AC-ra-06, AC-ra-07, AC-ra-08, AC-ra-09, AC-ra-10, AC-ra-11.
  - CAP-ra-pdf-delivery: AC-ra-17, AC-ra-18, AC-ra-19.
  - CAP-ra-polish: AC-ra-23, AC-ra-24, AC-ra-25.
  - Nas telas desta fase: AC-ra-57, AC-ra-58, AC-ra-60.
  - Interações do protótipo: `report-type-diagnosis`, `report-include-answers`, `report-export-pdf`, `report-open-pdf`, `report-show-folder`, `report-export-failure-retry`.
- User-visible outcome:
  - "Relatórios" aparece na primeira dobra da empresa (nova aba), no topo do resultado e na tela inicial do dono.
  - A central mostra o último diagnóstico concluído e, à direita, as folhas do PDF. Ligar "Incluir as respostas do questionário" faz descer a faixa na página nova e rola a prévia até ela.
  - "Exportar PDF" salva `{empresa}-{data}.pdf` em Downloads com a capa, o resumo de uma página, as barras agrupadas, a matriz 5×5 e o "Como ler" do `## Conteúdo v2`. "Abrir PDF" abre no leitor do computador e "Mostrar na pasta" abre a pasta.
  - No resultado, "Exportar PDF" é o botão principal, a confiança diz "itens" e os rótulos de risco não quebram.
- Implementation, nesta ordem:
  1. **Contrato do documento:** `shared/report/reportDocument.ts` e `paperPalette.ts`. Depois `reportCopy.ts`, `documentParts.ts` e `buildDiagnosisDocument` em `reportModel.ts`, com os testes de unidade antes do desenho.
     - O apêndice de respostas é dividido em páginas fixas, para cada página do documento caber numa A4.
     - O resumo é uma página só.
     - Sem respostas, o documento não leva `spendParts`, `averagePurchaseCents` nem `marginPercent`.
  2. **Desenho:** `pdfRenderer.ts` passa a percorrer páginas e blocos, com `pdfBlocks.ts` e `pdfCharts.ts`.
     - Some a frase da linha 248.
     - O teste garante que o PDF tem o mesmo número de páginas do documento e o texto esperado em cada uma.
  3. **Entrega:**
     - Modelo `GeneratedFile` e a migração `20261026000000_generated_files`. `reportService` com `preview`/`export`, `reportSchemas.ts` e as rotas novas.
     - Arquivos: `generatedFileRepository`, `systemOpener`, `fileService`, `fileRoutes`; `app.ts` e `main.ts` injetam o abridor.
     - A rota da versão 1 continua.
  4. **Tela:**
     - Rotas aninhadas da empresa (`CompanyPage` como layout, `CompanyTabs`, `CompanyDiagnosesTab`) e a central (`ReportCenterPage`, `ReportOptions`, `ReportPreview`, `ReportSheet`, `ReportSheetCharts`, `useReportPreview`, `ReportDelivery`).
     - A composição, os textos e os estados seguem as rotas `#/empresa/c1/relatorios` e `#/empresa/c3/relatorios` do protótipo.
  5. **Resultado e acabamento:**
     - `ResultPage` ganha "Relatórios" e "Exportar PDF" com a entrega inline. `ExportReportDialog.tsx` sai.
     - Também mudam `ConfidenceNote` (com `shared/format/confidenceText.ts`), `RiskList` e o botão "Relatórios" em `OwnerHome`.
  6. **Contrato de runtime:** criar `.aioson/plans/relatorios-e-acompanhamento/harness-contract.json` (`aioson harness:init . --slug=relatorios-e-acompanhamento`) com:
     - RG-build: `pnpm build`;
     - RG-migrate: `node scripts/smoke-migrate.mjs`;
     - RG-boot: `node scripts/smoke-boot.mjs`;
     - RG-smoke: `pnpm test:e2e`;
     - C-unit: `pnpm test`;
     - C-package: `node scripts/smoke-store-package.mjs`.

     Depois rodar `aioson harness:check . --slug=relatorios-e-acompanhamento`.
- Create/modify/reuse/retire:
  - modify: src/App.tsx, src/features/companies/CompanyPage.tsx, src/api/reportApi.ts, src/features/home/OwnerHome.tsx, src/styles/global.css, server/routes/reportRoutes.ts, tests/e2e/report.spec.ts, tests/e2e/accessibility.spec.ts, tests/e2e/support/fixtures.ts, server/report/reportModel.ts, server/report/pdfRenderer.ts, tests/unit/reportModel.test.ts, tests/unit/forbiddenTerms.test.ts, prisma/schema.prisma, server/services/reportService.ts, server/app.ts, server/main.ts, tests/api/reportRoutes.test.ts, src/features/result/ConfidenceNote.tsx, src/features/result/RiskList.tsx, src/features/result/ResultPage.tsx, tests/e2e/result.spec.ts.
  - create: src/features/companies/CompanyTabs.tsx, src/features/companies/CompanyDiagnosesTab.tsx, src/features/reports/ReportCenterPage.tsx, src/features/reports/ReportOptions.tsx, src/features/reports/ReportPreview.tsx, src/features/reports/ReportSheet.tsx, src/features/reports/ReportSheetCharts.tsx, src/features/reports/useReportPreview.ts, shared/report/reportDocument.ts, shared/report/paperPalette.ts, server/validation/reportSchemas.ts, .aioson/plans/relatorios-e-acompanhamento/harness-contract.json, server/report/reportCopy.ts, server/report/documentParts.ts, server/report/pdfBlocks.ts, server/report/pdfCharts.ts, shared/format/confidenceText.ts, tests/unit/pdfRenderer.test.ts, prisma/migrations/20261026000000_generated_files/migration.sql, server/repositories/generatedFileRepository.ts, server/files/systemOpener.ts, server/services/fileService.ts, server/routes/fileRoutes.ts, src/api/filesApi.ts, src/features/reports/ReportDelivery.tsx, tests/api/fileRoutes.test.ts, tests/unit/confidenceText.test.ts.
  - reuse: server/files/downloadsFolder.ts.
  - retire: src/features/result/ExportReportDialog.tsx.
- Verification:
  - `pnpm build`.
  - `pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/pdfRenderer.test.ts tests/unit/forbiddenTerms.test.ts tests/unit/confidenceText.test.ts tests/api/reportRoutes.test.ts tests/api/fileRoutes.test.ts`.
  - `node scripts/smoke-migrate.mjs`.
  - `pnpm exec playwright test tests/e2e/report.spec.ts tests/e2e/result.spec.ts tests/e2e/accessibility.spec.ts`.
  - `aioson harness:check . --slug=relatorios-e-acompanhamento`.
  - Caminho real no dev-link do Play, no Windows:
    - abrir a empresa → "Relatórios" → ligar e desligar as respostas → "Exportar PDF";
    - "Abrir PDF" abre o leitor e "Mostrar na pasta" abre o Explorer com o arquivo (OQ-ra-1);
    - imprimir a página das dimensões em escala de cinza.
  - No macOS, o mesmo smoke quando houver uma máquina. Sem ela, vale a mensagem com a pasta (BR-ra-06).
- Done when:
  - No webview do Play, a central exporta o PDF do diagnóstico e o abre.
  - Os títulos da prévia são os títulos do PDF.
  - Os comandos acima passam.

## Context contract

- Plan: .aioson/context/implementation-plan-relatorios-e-acompanhamento.md — your phase section and table rows are embedded above; open the whole plan only for a cross-reference.
- PRD: .aioson/context/prd-relatorios-e-acompanhamento.md — the acceptance criteria of your capabilities are embedded above; open it only for a business rule they cite.
- Prototype: .aioson/briefings/relatorios-e-acompanhamento/prototype.html (144 KB) — the visual contract for the UI files of this unit; a unit without UI files never opens it.
- Rules: run `aioson context:brief . --agent=dev --mode=executing --paths=src/features/reports/ReportCenterPage.tsx,src/features/reports/ReportOptions.tsx,src/features/reports/ReportPreview.tsx,src/features/reports/ReportSheet.tsx,src/features/reports/ReportSheetCharts.tsx,src/features/reports/useReportPreview.ts,src/features/reports/ReportDelivery.tsx,src/styles/global.css --task="unit phase-1-frontend-report-center of relatorios-e-acompanhamento"` and load only what it selects (`must_load` is binding); never read `.aioson/rules/` wholesale.
- Everything else (other phases, other lanes, the briefing) is out of your context on purpose: what you need from another unit arrives as messages appended below, and what another unit needs from you goes into `messages[]` of your report.
