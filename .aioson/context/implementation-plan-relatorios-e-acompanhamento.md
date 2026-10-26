---
feature: relatorios-e-acompanhamento
status: approved
plan_contract: 2
source_briefing: .aioson/briefings/relatorios-e-acompanhamento/briefings.md
sheldon_review: required
prototype: .aioson/briefings/relatorios-e-acompanhamento/prototype.html
prototype_status: current
prototype_feature: relatorios-e-acompanhamento
runtime_contract: required
source_prd: .aioson/context/prd-relatorios-e-acompanhamento.md
source_prd_sha256: 989df7e30fb4795bb75e3d1c964f4d0c48902e0f615027f1524e659175cb786c
---

# Implementation Plan — relatorios-e-acompanhamento

## Objective

No FitPulse aberto pelo AIOSON Play, o dono ou o consultor monta e abre os três relatórios em PDF com a marca de quem entrega, acompanha as 3 ações e o diário de números até o próximo diagnóstico, que chega com o custo por cliente medido, e recebe as respostas do cliente por arquivo. Tudo continua no computador e sobrevive à atualização pela loja.

## Repository evidence

- Production entry point: o Play roda `pnpm run dev` (dev-link) ou `pnpm start` (loja) na raiz.
  - `concurrently` sobe `tsx server/main.ts` (Express em `127.0.0.1:BACKEND_PORT`) e `vite` ou `vite preview` (`127.0.0.1:PORT`, proxy `/api`).
  - O webview carrega `http://127.0.0.1:<PORT>`. A interface usa `HashRouter` (`src/App.tsx`).
  - Instalação e update: `pnpm install` → `postinstall` → `scripts/prepare-app.mjs --generate --migrate --build`.
- Existing patterns to reuse (inspecionados em 2026-10-25):
  - Rotas finas → serviço → repositório: `server/routes/*Routes.ts`, `server/services/*Service.ts`, `server/repositories/*Repository.ts`, zod em `server/validation/*Schemas.ts`, erros em `server/services/domainError.ts` e `server/http/errorHandler.ts`.
  - `createApp(deps)` com `prisma`, `now` e `downloadsDir` injetados (`server/app.ts`). A cópia de segurança monta um parser maior antes do `express.json` de 1 MB.
  - Guardas `requireLocalHost` e `requireJsonWrites`: toda escrita é JSON (`server/http/requestGuards.ts`).
  - Gravação em Downloads: `server/files/downloadsFolder.ts` (`saveFile`, `sanitizeFileStem`).
  - PDF: `server/report/reportModel.ts` e `server/report/pdfRenderer.ts` (pdfkit 0.20.2, Inter e JetBrains Mono embutidas).
  - Comparação com recálculo: `shared/domain/compareDiagnoses.ts` e `server/services/historyService.ts`.
  - Carteira e listas de atenção: `server/services/homeService.ts` (`buildConsultantView`).
  - Preferências chave/valor: `server/repositories/preferenceRepository.ts` e `server/services/preferenceService.ts`.
  - Máscaras: `shared/format/{cnpj,money}.ts`, com `src/components/form/{TextField,CnpjField,MoneyField}.tsx` e `useCaretRestore`.
  - Modal do app: `src/components/feedback/ConfirmDialog.tsx`. Estados: `src/components/feedback/StatusView.tsx`.
  - Filtros na URL: `src/features/companies/CompaniesPage.tsx` (`?busca`, `?estagio`, `?arquivadas`).
  - Tour: `src/features/home/OnboardingTour.tsx`, com o botão "?" em `src/components/layout/AppShell.tsx`.
  - Testes de API com banco temporário (`tests/helpers/testDatabase.ts`) e `createApp` real. Para e2e, `tests/e2e/support/fixtures.ts` tem `AppApi` e reprova requisição externa e diálogo nativo.
- Test runner: `aioson detect:test-runner` → Vitest (`pnpm test`; unidade e API). E2E com Playwright (`pnpm test:e2e`; um servidor, um banco, `HOME` temporário com a pasta Downloads). O QA reutiliza os dois.
  - Comando focado: `pnpm exec vitest run <arquivos>` e `pnpm exec playwright test <arquivos>`. `pnpm test -- <arquivo>` roda a suíte inteira (OBS-3370ac).
- Observações abertas tratadas aqui:
  - OBS-9d1a49 entra na Fase 1 (CAP-ra-polish).
  - OBS-3370ac: os comandos focados acima a contornam.
  - As outras três (OBS-913cbf, OBS-f54104, OBS-af8fbe) são de ferramenta ou segurança de sessão e ficam com o @qa.

## Technical decisions

| Questão | Evidência | Decisão |
|---|---|---|
| Como a prévia fica igual ao PDF (AC-ra-02) | O conteúdo do PDF é montado no servidor (`reportModel.ts`). A comparação recalcula com as regras do servidor (`historyService.ts`) | O servidor monta um `ReportDocument` (`shared/report/reportDocument.ts`) com páginas explícitas. `GET /api/reports/preview` devolve esse documento e a tela o desenha. `POST /api/reports/export` desenha o mesmo documento com pdfkit. Invariante: uma página do documento = uma página A4. O renderizador falha se o conteúdo não couber, e o teste confere a contagem |
| Fontes do PDF | PRD: "mesmo gerador e mesmas fontes". A identidade usa a serif do sistema (Georgia), que não pode ser embutida | O PDF continua com Inter e JetBrains Mono embutidas. A serif itálica fica na prévia em HTML |
| Redução da logo para 600 px | Não há biblioteca de imagem no `package.json`. pdfkit desenha PNG e JPEG | Nenhuma dependência nova. O navegador confere o formato pelos bytes e o limite de 2 MB, e reduz com `createImageBitmap` + canvas no mesmo formato. O servidor confere de novo os bytes iniciais, o tamanho e as dimensões do cabeçalho (`server/files/imageSignature.ts`) e recusa acima de 600 px |
| Onde mora a marca | `Preference` chave/valor (`prisma/schema.prisma`) | Chaves `brand.name`, `brand.phone`, `brand.email`, `brand.website`, `brand.logo` (base64) e `brand.logoType`, sem migração. `preferenceRepository.readKeys` evita carregar a logo em `GET /api/preferences`. A imagem sai por `GET /api/brand/logo` |
| "Abrir PDF" e "Mostrar na pasta" | Nenhum código abre arquivo (Current System Fit). A tela não pode mandar caminho (AC-ra-18) | Tabela `generated_files` com o arquivo que o app salvou. O pedido manda só o id. O servidor resolve o caminho, confere a pasta Downloads e chama `spawn` sem shell (`explorer.exe`, `open`, `xdg-open`). A tabela também alimenta "último PDF salvo" na tela inicial |
| Andamento das ações | O resultado é imutável (RULE-dm-11). O plano atual é derivado do último concluído não arquivado (RULE-ra-06) | Tabela `action_progress`, uma linha por ação de diagnóstico concluído. A linha nasce na conclusão, na mesma transação, já com a herança. "Atual" e "encerrado" são calculados, nunca gravados: arquivar o mais recente devolve o plano anterior com o andamento que tinha (BR-ra-10). Concluídos da versão 1 sem linha leem "A fazer" e ganham a linha na primeira edição |
| Diário no rascunho | A calculadora pergunta os totais de 3 meses e não tem total único (`shared/domain/types.ts`) | `CalculatorInput` ganha `spendTotalCents` e `diarySource` opcionais. O rascunho guarda `diarySuggestion` (1 ou 2 meses), congelada na criação. O cliente não envia marcas: editar um campo à mão tira a marca no servidor, e "Usar o diário" é uma rota própria. Entradas no formato da versão 1 dão o mesmo resultado, então `rulesVersion` continua 1 |
| Arquivo do questionário à distância | RULE-ra-11: HTML único sem rede. Publicação em modo fonte (`server/` vai no pacote) | O servidor monta o HTML com `server/questionnaire/questionnaireStyles.css` e `server/questionnaire/questionnaireClient.js` (JavaScript puro, lido em tempo de execução, fora do `tsc`), com o catálogo e a marca em `<script type="application/json">`. CSP `default-src 'none'` no próprio arquivo, fontes do sistema (pilhas de fallback da identidade), sem fonte embutida |
| Pasta das telas de relatório (desvio do @dev, 2026-10-26) | O empacotador do AIOSON (`store-system.js`, `DEV_ONLY_DIRS`) descarta qualquer pasta chamada `reports`, em qualquer nível, e o build da loja quebrava (AC-ra-54) | As telas ficam em `src/features/report-center/`. Nenhuma pasta do app pode se chamar `reports`, `test-results` ou `playwright-report` |
| Migrações e versões | Migração inicial publicada (`20261023000000_init`). `compatibility.schema_version: 1`. A cópia é `BACKUP_FORMAT_VERSION = 1` | Uma migração aditiva por fase que cria tabela, nunca editando a inicial. Nenhuma parte é publicada antes da Fase 7, que sobe `schema_version` para 2, a cópia para a versão 2 e o app para 0.2.0. Se o dono quiser publicar uma parte antes, a parte seguinte sobe as duas versões de novo |
| Tour novo | AC-ra-37 fixa os 5 passos "com a parte 2", e o tour da versão 1 é marcado por modo (`tourSeen`) | O tour novo entra na Fase 5, quando as 5 âncoras existem, com a preferência `tourSeenVersion: 2`. Assim quem usava a versão 1 o vê uma vez. A parte 1 mantém o tour da versão 1 |
| Filtros de atenção na lista de empresas | `?estagio=` já existe | `?atencao=atrasada\|vencidas\|risco\|aguardando\|rascunhos\|sem-diagnostico`, calculado pelo mesmo `portfolioService` da tela do consultor |

## Engineering Controls

| Concern | Evidence / trigger | Planned control | Verification | Recovery |
|---|---|---|---|---|
| data/schema and recovery | 4 tabelas novas sobre um banco publicado. O update roda `prisma migrate deploy` no `postinstall`. `foreign_keys = ON` por conexão (`server/db/prismaClient.ts`) | Migrações só com `CREATE TABLE`/`CREATE INDEX`, geradas por `prisma migrate diff` (Fases 1, 3, 4 e 6), sem `ALTER` nas tabelas da versão 1. Cascata `companies → diary_entries, questionnaire_sends, generated_files` e `diagnoses → action_progress`. `schema_version: 2` na Fase 7 | `node scripts/smoke-migrate.mjs` (banco da versão 1 com dados → todas as migrações → dados intactos e tabelas novas) + `node scripts/smoke-store-package.mjs` (update sobre o pacote da versão 1) | Backup do app feito pelo Play antes do update. Migração publicada nunca é editada. Sem escrita nas tabelas antigas, então voltar ao pacote anterior lê o banco como antes |
| compatibility | O motor (`evaluateDiagnosis`, `unitEconomics`, `completeness`) passa a ler `spendTotalCents` e `diarySource`. Os resultados guardados são lidos pela comparação, pelo PDF e pela tela inicial | Campos novos opcionais. Entrada no formato da versão 1 dá saída idêntica. `rulesVersion` continua 1. Nenhum resultado guardado é regravado (RULE-ra-01). `POST /api/diagnoses/:id/report` continua e delega ao serviço novo. `GET /api/aioson-play` não muda (Fases 4 e 7) | `pnpm exec vitest run tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts tests/unit/unitEconomics.test.ts tests/api/playRoutes.test.ts` sem mudar as expectativas da versão 1 | Sem estado: a leitura nova é aditiva |
| authorization | Sem login (RULE-dm-16). "Abrir PDF" executa um programa do sistema. As rotas novas apagam e substituem dados | Guardas existentes em todas as rotas novas, com escrita só em JSON. O pedido de abrir só leva o id de `generated_files`. O servidor usa o caminho gravado, exige `path.dirname` igual à pasta Downloads do app e o arquivo presente, e chama `spawn` com argumentos literais, sem shell. O nome já passou por `sanitizeFileStem`, que tira aspas e separadores (Fase 1) | `pnpm exec vitest run tests/api/fileRoutes.test.ts` (abridor falso injetado; id desconhecido, arquivo apagado e campo de caminho recusados) + smoke manual no webview do Play | Sem estado |
| validation | Marca, ações, diário, seleção de relatório e arquivo de respostas recebem dados do usuário (SEC-SBD-01) | Schemas zod no servidor, com o mesmo schema para criar e editar: nome ≤ 80, telefone fixo/celular, e-mail e site, nota ≤ 500, prazo como data real, papel e estado do catálogo, mês `YYYY-MM` não futuro, clientes 0–99.999, centavos inteiros ≤ 9.999.999.999, ids ≤ 64 (Fases 1 a 6) | Casos negativos em `tests/api/brandRoutes.test.ts`, `actionRoutes.test.ts`, `diaryRoutes.test.ts`, `reportRoutes.test.ts` e `questionnaireRoutes.test.ts` | Recusado antes de gravar |
| upload | Logo (SEC-SBD-02) e arquivo de respostas | Logo: bytes iniciais PNG `89 50 4E 47` ou JPEG `FF D8 FF`, ≤ 2 MB decodificada, ≤ 600 px pelo cabeçalho. SVG e texto renomeado são recusados. O parser JSON da marca é de 3 MB, pela sobra do base64 (Fase 2). Respostas: só JSON com a marca `fitpulse-answers`, ≤ 1 MB, schema estrito, mesma empresa e versão conhecida, gravado numa transação (Fase 6) | `pnpm exec vitest run tests/unit/imageSignature.test.ts tests/api/brandRoutes.test.ts tests/api/questionnaireRoutes.test.ts` | Recusado antes de gravar. A transação desfaz a importação |
| concurrency/idempotency | Clique duplo em "Concluir" com herança; mesmo mês anotado duas vezes; importação com rascunho existente (RULE-dm-13); prévia trocada rápido | Herança dentro da transação condicional de `completeDraft`, com único (`diagnosis_id`, `action_key`), então a segunda conclusão não cria linha (Fase 3). Único (`company_id`, `month`) → 409 (Fase 4). Substituir o rascunho apaga e cria na mesma transação (Fase 6). A prévia cancela o pedido anterior com `AbortController` (Fase 1). Desfazer é um PATCH normal | Conclusões em paralelo em `tests/api/diagnosisRoutes.test.ts`, anotações em paralelo em `tests/api/diaryRoutes.test.ts`, substituição em `tests/api/questionnaireRoutes.test.ts` | A transação desfaz; nada fica pela metade |
| file writes | PDFs e questionário gravados em Downloads, e depois registrados em `generated_files` | `saveFile` (temporário + renomeação). Se o registro falhar depois de salvar, o arquivo é apagado e a resposta é `write_failed`: "nada muda" vale para o disco e para o banco (Fases 1 e 6) | `tests/api/reportRoutes.test.ts` com a pasta Downloads trocada por um arquivo e com falha de registro | Nenhum arquivo nem registro pela metade |
| output escaping | O HTML do questionário leva o nome da empresa e a marca e roda no navegador do cliente | Dados no `<script type="application/json">`, com `<`, `>`, `&`, U+2028 e U+2029 escapados. O texto entra por `textContent`, nunca `innerHTML`. CSP `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'` garante zero rede (RULE-ra-11) (Fase 6) | `tests/unit/questionnaireFile.test.ts` (nome hostil com `</script>`, nenhuma URL `http`) + `tests/e2e/remoteQuestionnaire.spec.ts` com a rede cortada | Sem estado |
| privacy | O PDF sem respostas não pode levar valores digitados (AC-ra-09). O resumo do assistente não pode levar dinheiro, diário, notas nem marca (RULE-dm-17). O arquivo do cliente não leva outra empresa (RULE-ra-11) | O documento do diagnóstico só inclui respostas e valores digitados com `includeAnswers`. `assistantSummaryService` sem mudança. O questionário leva só empresa, catálogo e marca (Fases 1, 6 e 7) | `tests/unit/reportModel.test.ts`, `tests/api/playRoutes.test.ts`, `tests/unit/questionnaireFile.test.ts` | Sem estado |
| accessibility/localization | AC-ra-57, AC-ra-58, AC-ra-59. "Hoje" é a data local do computador (RULE-ra-06/07) | Modais por `ConfirmDialog`, sem `alert`/`confirm`/`prompt`. Faixa de reimpressão, entrada em sequência, revelação, traço da aba e poeira só sob `prefers-reduced-motion: no-preference`. Datas pelo calendário local em `shared/domain/followUp.ts` a partir de `now()` injetado. `Intl` pt-BR (Fases 1 a 7) | `pnpm exec playwright test tests/e2e/accessibility.spec.ts` (390 px, axe nos dois temas, movimento reduzido) + virada de dia em `tests/unit/followUp.test.ts` | Sem estado |
| dependency risk | Instalação limpa pela loja sem lockfile (`scripts/smoke-store-package.mjs`) | Nenhuma dependência nova: canvas do navegador, cabeçalho de imagem lido à mão, `child_process`, pdfkit e unpdf já instalados | `node scripts/smoke-store-package.mjs` (Fase 7) | Sem estado |

Sem gatilho, sem controle: observabilidade (app local sem telemetria; erros inesperados vão para o stderr que o Play captura) e desempenho (a prévia monta o documento sem desenhar o PDF; o PDF só é desenhado em "Exportar").

## Implementation Delta

| CAP | Action | Existing evidence | Exact paths | Required change |
|---|---|---|---|---|
| CAP-ra-report-center | modify | `empresa/:companyId` é uma rota única, sem abas | src/App.tsx | Rotas aninhadas `empresa/:companyId` (índice = Diagnósticos) e `empresa/:companyId/relatorios` |
| CAP-ra-report-center | modify | 340 linhas: cabeçalho, linha do tempo e diálogos de status juntos; sem abas | src/features/companies/CompanyPage.tsx | Vira o layout da empresa (cabeçalho, `CompanyTabs`, `<Outlet>` com a empresa no contexto); o conteúdo dos diagnósticos sai para `CompanyDiagnosesTab` |
| CAP-ra-report-center | create | Nenhum componente de abas no app (inspecionado `src/components/`) | src/features/companies/CompanyTabs.tsx | Abas por rota com o traço sob a ativa; "Relatórios" na primeira dobra em 1280 e 390 px |
| CAP-ra-report-center | create | `CompanyDiagnoses` mora dentro de `CompanyPage.tsx` | src/features/companies/CompanyDiagnosesTab.tsx | Mesmo conteúdo da versão 1 como aba índice |
| CAP-ra-report-center | create | Não existe central; o PDF só sai do modal `ExportReportDialog.tsx` | src/features/report-center/ReportCenterPage.tsx | Opções à esquerda e prévia à direita; carregando (`aria-busy`), erro (`role="alert"` + "Tentar de novo", sem prévia parcial), vazio sem concluído (BR-ra-01); `?diagnostico=` vindo do resultado |
| CAP-ra-report-center | create | idem | src/features/report-center/ReportOptions.tsx | Tipo (Evolução desativada com a explicação da BR-ra-02), diagnóstico, "Incluir as respostas do questionário" desligado com o motivo |
| CAP-ra-report-center | create | idem | src/features/report-center/ReportPreview.tsx | Folhas paginadas do `ReportDocument`; página alterada com a faixa de reimpressão e rolagem até ela; empilha em 390 px |
| CAP-ra-report-center | create | idem | src/features/report-center/ReportSheet.tsx | Blocos de uma página (títulos, fatos, parágrafos, listas, tabelas, avisos) com a paleta do papel |
| CAP-ra-report-center | create | idem | src/features/report-center/ReportSheetCharts.tsx | Barras agrupadas com nota escrita e linha de 50; matriz 5×5 numerada com descrição acessível |
| CAP-ra-report-center | create | idem | src/features/report-center/useReportPreview.ts | Busca a prévia a cada troca, cancela a anterior e devolve o id da página que mudou |
| CAP-ra-report-center | modify | Só `exportReport(diagnosisId)` | src/api/reportApi.ts | `getReportPreview(selection)` e `exportReportFile(selection)`; `exportReport` mantido para o resultado |
| CAP-ra-report-center | modify | Tela inicial do dono sem entrada para relatórios | src/features/home/OwnerHome.tsx | Botão "Relatórios" para a central da empresa em foco |
| CAP-ra-report-center | modify | Sem estilos de papel | src/styles/global.css | Classes da folha, faixa de reimpressão (700 ms) e entrada da página (220 ms) só sob `prefers-reduced-motion: no-preference` |
| CAP-ra-report-center | create | O modelo atual (`server/report/reportModel.ts`) é só do servidor e só do PDF | shared/report/reportDocument.ts | Tipos `ReportDocument`, `ReportPage` (id estável, título, blocos) e a união `ReportBlock` |
| CAP-ra-report-center | create | Cores do papel fixas em `pdfRenderer.ts` (`COLORS`); `--paper*` só no protótipo | shared/report/paperPalette.ts | Fonte única da paleta do papel para o PDF e a prévia |
| CAP-ra-report-center | create | A rota da versão 1 não recebe opções | server/validation/reportSchemas.ts | Seleção discriminada `diagnosis` (`diagnosisId`, `includeAnswers`); limites de id |
| CAP-ra-report-center | modify | Uma rota: `POST /api/diagnoses/:id/report` | server/routes/reportRoutes.ts | `GET /api/reports/preview` e `POST /api/reports/export`; a rota da versão 1 delega ao mesmo serviço |
| CAP-ra-report-center | modify | Testa o modal de exportação da versão 1 | tests/e2e/report.spec.ts | Três pontos de entrada; troca de opção muda a prévia; títulos da prévia = texto do PDF salvo (unpdf); vazio; evolução desativada; carregando e erro com falha simulada da API; "Relatórios" na primeira dobra |
| CAP-ra-report-center | modify | Cobre as telas da versão 1 | tests/e2e/accessibility.spec.ts | Central em 390 px, axe nos dois temas, movimento reduzido |
| CAP-ra-report-center | modify | `AppApi` cria empresas e diagnósticos; reprova requisição externa e diálogo nativo | tests/e2e/support/fixtures.ts | Ler o texto de um PDF salvo na pasta Downloads do workspace |
| CAP-ra-report-center | create | `.aioson/plans/` não existe | .aioson/plans/relatorios-e-acompanhamento/harness-contract.json | RG-build, RG-migrate, RG-boot, RG-smoke, C-unit, C-package |
| CAP-ra-diagnosis-report | modify | `buildReportModel` monta 3 páginas de texto; `formatReportDate` e `formatFileDate` são usados por `backupService.ts` | server/report/reportModel.ts | `buildDiagnosisDocument` na ordem da AC-ra-05; respostas em páginas próprias só com `includeAnswers`; sem elas, nenhum valor digitado; mantém os formatadores de data |
| CAP-ra-diagnosis-report | create | Textos do PDF espalhados em `reportModel.ts` e `pdfRenderer.ts` | server/report/reportCopy.ts | Textos do `## Conteúdo v2` ("Como ler", abertura das dimensões, aviso) e "Nenhum risco encontrado nas respostas" |
| CAP-ra-diagnosis-report | create | Sem partes comuns entre relatórios | server/report/documentParts.ts | Capa, rodapé e "Como ler" para os três documentos |
| CAP-ra-diagnosis-report | modify | Modelo fixo de 3 páginas; frase errada na linha 248 (OBS-9d1a49) | server/report/pdfRenderer.ts | Desenha qualquer `ReportDocument`, uma página por A4 (erro se não couber); capa; rodapé com "N de M"; mesmas fontes embutidas |
| CAP-ra-diagnosis-report | create | O escritor de texto está dentro de `pdfRenderer.ts` | server/report/pdfBlocks.ts | Blocos de texto do documento |
| CAP-ra-diagnosis-report | create | Só barras simples (`drawDimension`) | server/report/pdfCharts.ts | Barras agrupadas com nota escrita e linha de 50 legíveis em cinza; matriz 5×5 com o número de cada risco |
| CAP-ra-diagnosis-report | create | `describeConfidence` duplicado em `ConfidenceNote.tsx:15` e `reportModel.ts`, com "item" | shared/format/confidenceText.ts | Uma função para a tela e o PDF, sempre "itens" |
| CAP-ra-diagnosis-report | modify | Testa o modelo de 3 páginas | tests/unit/reportModel.test.ts | Ordem das páginas, respostas ligadas e desligadas, "Como ler", frase proibida ausente |
| CAP-ra-diagnosis-report | create | Sem teste do desenho | tests/unit/pdfRenderer.test.ts | Páginas do PDF = páginas do documento; texto por página (resumo inteiro numa página, dimensões começando na seguinte); nota escrita em cada barra |
| CAP-ra-diagnosis-report | modify | Confere os termos proibidos na tela e no PDF da versão 1 | tests/unit/forbiddenTerms.test.ts | Inclui o PDF do diagnóstico novo |
| CAP-ra-pdf-delivery | modify | Só `Company`, `Diagnosis` e `Preference` | prisma/schema.prisma | Modelo `GeneratedFile` (`generated_files`: id, company_id com cascata, kind, file_name, directory, created_at) |
| CAP-ra-pdf-delivery | create | Só `20261023000000_init` | prisma/migrations/20261026000000_generated_files/migration.sql | Gerada por `prisma migrate diff`; só criação |
| CAP-ra-pdf-delivery | create | Nenhum registro de arquivo salvo | server/repositories/generatedFileRepository.ts | Grava e lê os arquivos do app; último PDF por empresa |
| CAP-ra-pdf-delivery | modify | `export(diagnosisId)` monta e salva | server/services/reportService.ts | `preview(selection)` sem desenhar; `export(selection)` desenha, salva, registra e responde `{ fileId, fileName, directory }`; registro falho apaga o arquivo e dá `write_failed` |
| CAP-ra-pdf-delivery | reuse | `saveFile` (nome saneado, " (2)", temporário + renomeação) | server/files/downloadsFolder.ts | Sem mudança |
| CAP-ra-pdf-delivery | create | Nenhum código abre arquivo ou pasta | server/files/systemOpener.ts | `openFile`/`revealFile` com `spawn` sem shell: Windows `explorer.exe` (`/select,` com `windowsVerbatimArguments`; o código de saída do explorer não indica falha, só o evento `error`), macOS `open`/`open -R`, Linux `xdg-open` (a pasta) |
| CAP-ra-pdf-delivery | create | idem | server/services/fileService.ts | Id → registro → caminho dentro da pasta Downloads do app → arquivo presente → abridor; falha → `open_failed` com a pasta |
| CAP-ra-pdf-delivery | create | idem | server/routes/fileRoutes.ts | `POST /api/files/:fileId/open` e `POST /api/files/:fileId/reveal` |
| CAP-ra-pdf-delivery | modify | `AppDependencies` com prisma, now e downloadsDir | server/app.ts | Dependência `systemOpener` (padrão: o real) e rotas de arquivo |
| CAP-ra-pdf-delivery | modify | Monta o app com Prisma real e a pasta Downloads | server/main.ts | Passa o abridor real |
| CAP-ra-pdf-delivery | create | Sem chamadas de arquivo no cliente | src/api/filesApi.ts | `openSavedFile(id)` e `revealSavedFile(id)` |
| CAP-ra-pdf-delivery | create | O estado de entrega mora no modal `ExportReportDialog.tsx` | src/features/report-center/ReportDelivery.tsx | "Salvando…" → "PDF salvo" com nome, pasta, "Abrir PDF" e "Mostrar na pasta"; falha de gravação com "Tentar de novo"; falha ao abrir com a pasta |
| CAP-ra-pdf-delivery | modify | Exportação da versão 1, nomes hostis, falha de gravação | tests/api/reportRoutes.test.ts | Prévia e exportação por seleção, nome, " (2)", registro, falha sem arquivo nem registro |
| CAP-ra-pdf-delivery | create | Sem rota de arquivo | tests/api/fileRoutes.test.ts | Abridor falso: arquivo do app aceito; id desconhecido e arquivo apagado → 404; falha do sistema → erro com a pasta; campo de caminho ignorado |
| CAP-ra-polish | modify | `describeConfidence` local com "item" | src/features/result/ConfidenceNote.tsx | Usa `shared/format/confidenceText.ts` |
| CAP-ra-polish | modify | Os rótulos quebram em coluna estreita | src/features/result/RiskList.tsx | Cada rótulo em `white-space: nowrap`; a quebra acontece entre rótulos |
| CAP-ra-polish | modify | `ExportReportDialog` no fim do resultado | src/features/result/ResultPage.tsx | Topo com "Relatórios" (central com `?diagnostico=`) e "Exportar PDF" principal com `ReportDelivery` direto; mensagem visível até fechar |
| CAP-ra-polish | retire | Modal da versão 1, substituído pela entrega inline | src/features/result/ExportReportDialog.tsx | Arquivo removido |
| CAP-ra-polish | create | Sem teste do texto de confiança | tests/unit/confidenceText.test.ts | "1 de 26 itens sem o número" |
| CAP-ra-polish | modify | Resultado da versão 1 | tests/e2e/result.spec.ts | Plural; rótulos sem quebra em 1280 e 390; "Exportar PDF" principal salvando direto |
| CAP-ra-brand | create | `preferenceSchemas.ts` aceita só modo, tema, foco e tour | server/validation/brandSchemas.ts | Nome ≤ 80, telefone, e-mail, site, logo `{ mimeType, dataBase64 }` |
| CAP-ra-brand | modify | `readAll()` lê todas as linhas | server/repositories/preferenceRepository.ts | `readKeys(keys)` |
| CAP-ra-brand | modify | `read()` usa `readAll()` | server/services/preferenceService.ts | Lê só as próprias chaves, sem a logo |
| CAP-ra-brand | create | Nenhuma leitura de imagem no servidor | server/files/imageSignature.ts | PNG/JPEG pelos bytes iniciais; largura e altura do IHDR ou do SOFn |
| CAP-ra-brand | create | Não existe marca | server/services/brandService.ts | Chaves `brand.*`; recusa da logo; remover logo; voltar para FitPulse |
| CAP-ra-brand | create | idem | server/routes/brandRoutes.ts | `GET/PUT/DELETE /api/brand`, `PUT/DELETE /api/brand/logo` (parser JSON de 3 MB), `GET /api/brand/logo` |
| CAP-ra-brand | modify | Parser maior só da cópia antes do `express.json` | server/app.ts | Monta `brandRoutes` antes do parser de 1 MB |
| CAP-ra-brand | modify | Os documentos saem com a marca FitPulse | server/services/reportService.ts | Passa a marca a todos os documentos |
| CAP-ra-brand | create | Criado na Fase 1 (ausente no Gate C) | server/report/documentParts.ts | Capa e rodapé com nome, logo e contato; em branco, FitPulse |
| CAP-ra-brand | modify | Sem imagem no PDF | server/report/pdfRenderer.ts | Desenha a logo na capa |
| CAP-ra-brand | create | `shared/format/` tem só cnpj, money e displayNumbers | shared/format/phone.ts | Máscara fixo/celular com cursor, validação e erro "Telefone inválido. Use (11) 91234-5678." |
| CAP-ra-brand | create | idem | shared/format/contact.ts | E-mail e site com as mensagens da AC-ra-20 |
| CAP-ra-brand | create | Padrão `CnpjField.tsx` + `useCaretRestore` | src/components/form/PhoneField.tsx | `inputmode="tel"` |
| CAP-ra-brand | create | Sem cliente da marca | src/api/brandApi.ts | Ler, salvar, logo, remover, voltar para FitPulse |
| CAP-ra-brand | create | Sem tratamento de imagem no cliente | src/features/settings/brandLogoImage.ts | Bytes PNG/JPEG e 2 MB antes de decodificar; reduz para 600 px no mesmo formato |
| CAP-ra-brand | create | `SettingsPage.tsx` sem marca | src/features/settings/BrandSection.tsx | "Seus relatórios" com campos, logo, prévia da capa, "Salvar marca" e confirmações no modal; rótulo do modo minha empresa |
| CAP-ra-brand | modify | Seções de modo, tema, guia, assistente e segurança | src/features/settings/SettingsPage.tsx | Mostra a `BrandSection` |
| CAP-ra-brand | create | Criado na Fase 1 (ausente no Gate C) | src/features/report-center/ReportSheet.tsx | Capa com a logo e o contato |
| CAP-ra-brand | reuse | Modal do app com foco preso e Esc | src/components/feedback/ConfirmDialog.tsx | Sem mudança |
| CAP-ra-brand | create | Sem teste de imagem | tests/unit/imageSignature.test.ts | PNG, JPG, SVG, texto renomeado, dimensões |
| CAP-ra-brand | create | Sem teste de contato | tests/unit/contactFormat.test.ts | Telefones fixo e celular, e-mails e sites válidos e inválidos |
| CAP-ra-brand | create | Sem rota da marca | tests/api/brandRoutes.test.ts | PNG, JPG, SVG, texto renomeado, 3 MB, 1200 px, campos inválidos, nada muda na recusa |
| CAP-ra-brand | create | Criado na Fase 1 (ausente no Gate C) | tests/unit/pdfRenderer.test.ts | Capa e rodapé com e sem marca nos três PDFs |
| CAP-ra-brand | create | Sem e2e da marca | tests/e2e/brand.spec.ts | Salvar, recusas no campo, remover, voltar para FitPulse, prévia da capa |
| CAP-ra-evolution-report | modify | `compare(id)` só com o anterior imediato | server/services/historyService.ts | `comparePair(fromId, toId)` com o mesmo `compareDiagnoses`; recusa empresa diferente, arquivado ou ordem invertida |
| CAP-ra-evolution-report | reuse | Comparação com recálculo (RULE-dm-11) | shared/domain/compareDiagnoses.ts | Sem mudança (F9) |
| CAP-ra-evolution-report | create | Aviso de recálculo escrito dentro de `ComparePage.tsx:117` | shared/content/comparisonCopy.ts | O aviso como função, para a tela e o PDF |
| CAP-ra-evolution-report | modify | idem | src/features/history/ComparePage.tsx | Usa o texto compartilhado |
| CAP-ra-evolution-report | create | Não existe PDF de evolução | server/report/evolutionDocument.ts | Capa, "Antes e depois", "O que foi feito no período" (só com andamento ou diário), "Como ler" |
| CAP-ra-evolution-report | create | Criado na Fase 1 (ausente no Gate C) | server/validation/reportSchemas.ts | Seleção `evolution` com `fromId` e `toId` |
| CAP-ra-evolution-report | modify | Só o documento do diagnóstico | server/services/reportService.ts | Seleção de evolução; nome `{empresa}-evolucao-{de}-a-{ate}.pdf` |
| CAP-ra-evolution-report | create | Criado na Fase 1 (ausente no Gate C) | src/features/report-center/ReportOptions.tsx | "De" e "Até"; "Até" só posteriores e ajustado ao trocar "De" |
| CAP-ra-evolution-report | create | Sem teste de evolução | tests/unit/evolutionDocument.test.ts | Mesmo par = mesmos números da comparação, com recálculo |
| CAP-ra-evolution-report | reuse | Regras v2 de teste | tests/fixtures/rulesV2.ts | Sem mudança |
| CAP-ra-evolution-report | modify | Atualizado na Fase 1 | tests/e2e/report.spec.ts | Escolha do par e AC-ra-14 |
| CAP-ra-evolution-report | modify | Atualizado na Fase 1 | tests/unit/forbiddenTerms.test.ts | Inclui o PDF de evolução |
| CAP-ra-portfolio-report | create | `OVERDUE_DIAGNOSIS_DAYS = 90` fixo em `homeService.ts` | shared/domain/followUp.ts | Data local, `DEFAULT_REEVALUATION_DAYS = 90`, data de reavaliação e atraso (RULE-ra-07) |
| CAP-ra-portfolio-report | create | `createHomeData(prisma).listPortfolio` dentro de `homeService.ts` | server/repositories/portfolioRepository.ts | Leitura da carteira fora do serviço |
| CAP-ra-portfolio-report | create | `buildConsultantView` em `homeService.ts` | server/services/portfolioService.ts | Fonte única da carteira e das listas de atenção para a tela do consultor, o PDF e os filtros |
| CAP-ra-portfolio-report | modify | 395 linhas; modo consultoria calculado ali | server/services/homeService.ts | Delega ao `portfolioService`; contrato IF-007 igual |
| CAP-ra-portfolio-report | create | Não existe PDF da carteira | server/report/portfolioDocument.ts | Capa, empresas por estágio, lista ativa paginada |
| CAP-ra-portfolio-report | modify | Sem seleção de carteira | server/services/reportService.ts | Seleção `portfolio`; nome `carteira-{data}.pdf` |
| CAP-ra-portfolio-report | create | Não existe rota da carteira | src/features/report-center/PortfolioReportPage.tsx | Rota `relatorios/carteira`; explicação no modo minha empresa; carteira vazia com "Cadastrar a primeira empresa"; prévia e entrega |
| CAP-ra-portfolio-report | modify | Sem entrada para relatório | src/features/home/ConsultantHome.tsx | "Relatório da carteira" |
| CAP-ra-portfolio-report | modify | Atualizado na Fase 1 | src/App.tsx | Rota `relatorios/carteira` |
| CAP-ra-portfolio-report | create | Sem teste de datas de reavaliação | tests/unit/followUp.test.ts | Intervalo, atraso e virada do dia local |
| CAP-ra-portfolio-report | create | Sem teste da carteira em PDF | tests/unit/portfolioDocument.test.ts | Mesmos números da tela do consultor; paginação |
| CAP-ra-portfolio-report | modify | Testa IF-007 | tests/api/homeRoutes.test.ts | Tela do consultor igual depois da extração |
| CAP-ra-portfolio-report | create | Sem e2e da carteira | tests/e2e/portfolioReport.spec.ts | Prévia e exportação, modo minha empresa, carteira vazia |
| CAP-ra-portfolio-report | modify | Atualizado na Fase 1 | tests/unit/forbiddenTerms.test.ts | Inclui o PDF da carteira |
| CAP-ra-action-tracking | modify | Atualizado na Fase 1 | prisma/schema.prisma | `ActionProgress` (`action_progress`: id, diagnosis_id com cascata, action_key, status, due_date `YYYY-MM-DD`, owner_role, note, inherited_from_id, created_at, updated_at; único (diagnosis_id, action_key)) |
| CAP-ra-action-tracking | create | Sem tabela de andamento | prisma/migrations/20261026000100_action_progress/migration.sql | Só criação |
| CAP-ra-action-tracking | create | `buildActionPlan` só grava chaves (`shared/domain/actionPlan.ts`) | shared/domain/actionProgress.ts | Estados, papéis, padrão "A fazer", vencida (RULE-ra-06), herança pura (RULE-ra-05) |
| CAP-ra-action-tracking | create | Sem rótulos de andamento | shared/content/actionProgressOptions.ts | "A fazer", "Em andamento", "Feita", "Não se aplica" e os 5 papéis |
| CAP-ra-action-tracking | create | `shared/format/` sem datas | shared/format/dates.ts | Máscara `DD/MM/AAAA` com cursor, data real, conversão para `YYYY-MM-DD` |
| CAP-ra-action-tracking | create | Padrão `CnpjField.tsx` | src/components/form/DateField.tsx | `inputmode="numeric"`, erro ao sair do campo |
| CAP-ra-action-tracking | create | Sem acesso ao andamento | server/repositories/actionProgressRepository.ts | Ler por diagnóstico e empresa; criar na edição de um concluído da versão 1 |
| CAP-ra-action-tracking | create | Sem schema | server/validation/actionSchemas.ts | Estado, prazo, papel, nota ≤ 500 |
| CAP-ra-action-tracking | create | Sem serviço | server/services/actionService.ts | Plano atual e encerrados da empresa; ações de um diagnóstico com `isCurrent`; edição com 409 `plan_closed` |
| CAP-ra-action-tracking | create | Sem rotas | server/routes/actionRoutes.ts | `GET /api/companies/:id/actions`, `GET /api/diagnoses/:id/actions`, `PATCH /api/diagnoses/:id/actions/:actionKey` |
| CAP-ra-action-tracking | modify | Atualizado nas Fases 1 e 2 | server/app.ts | Rotas das ações |
| CAP-ra-action-tracking | create | Criado na Fase 2 (ausente no Gate C) | server/repositories/portfolioRepository.ts | Carrega o andamento do plano atual |
| CAP-ra-action-tracking | create | Criado na Fase 2 (ausente no Gate C) | server/services/portfolioService.ts | Ações vencidas por empresa (RULE-ra-06) |
| CAP-ra-action-tracking | modify | Atualizado na Fase 1 | server/report/reportModel.ts | Página "Andamento das ações" |
| CAP-ra-action-tracking | create | Criado na Fase 2 (ausente no Gate C) | server/report/evolutionDocument.ts | Ações do "De" com estado e se continuam no plano novo |
| CAP-ra-action-tracking | create | Criado na Fase 2 (ausente no Gate C) | server/report/portfolioDocument.ts | Coluna de ações vencidas |
| CAP-ra-action-tracking | modify | Atualizado nas Fases 1 e 2 | server/services/reportService.ts | Passa o andamento aos documentos |
| CAP-ra-action-tracking | create | Sem cliente | src/api/actionsApi.ts | Ler e editar |
| CAP-ra-action-tracking | create | Sem aba de ações | src/features/actions/CompanyActionsTab.tsx | Rota `empresa/:id/acoes`; plano atual e encerrados; vazio sem concluído (AC-ra-63) |
| CAP-ra-action-tracking | create | idem | src/features/actions/ActionProgressRow.tsx | Estado editável, prazo, responsável, nota, vencida, "Continua do diagnóstico de {data}", encerrada sem controles; chave = `diagnosisId:actionKey` |
| CAP-ra-action-tracking | create | idem | src/features/actions/ActionEditDialog.tsx | Prazo mascarado, papel (sem nome), nota com contador |
| CAP-ra-action-tracking | create | idem | src/features/actions/useActionStatus.ts | Grava na hora, "Desfazer" por 6 s |
| CAP-ra-action-tracking | create | Nenhum aviso com ação em `src/components/feedback/` | src/components/feedback/UndoNotice.tsx | `role="status"` com "Desfazer" |
| CAP-ra-action-tracking | modify | Só mostra as 3 ações | src/features/result/ActionPlanList.tsx | Andamento editável no plano atual; encerrado sem edição |
| CAP-ra-action-tracking | modify | Atualizado na Fase 1 | src/features/result/ResultPage.tsx | Carrega as ações do diagnóstico |
| CAP-ra-action-tracking | create | Criado na Fase 1 (ausente no Gate C) | src/features/companies/CompanyTabs.tsx | Aba "Ações" |
| CAP-ra-action-tracking | modify | Atualizado nas Fases 1 e 2 | src/App.tsx | Rota `empresa/:companyId/acoes` |
| CAP-ra-action-tracking | create | Sem teste | tests/unit/actionProgress.test.ts | Vencida e herança |
| CAP-ra-action-tracking | create | Sem teste | tests/unit/dates.test.ts | Máscara e data real |
| CAP-ra-action-tracking | create | Sem teste | tests/api/actionRoutes.test.ts | Edição, `plan_closed`, resultado guardado igual (AC-ra-29) |
| CAP-ra-action-tracking | create | Sem e2e | tests/e2e/actions.spec.ts | Estado, desfazer com recarga, edição de uma ação específica, encerradas, vazio |
| CAP-ra-action-tracking | modify | Atualizado na Fase 1 | tests/unit/reportModel.test.ts | Página do andamento |
| CAP-ra-action-tracking | create | Criado na Fase 2 (ausente no Gate C) | tests/unit/evolutionDocument.test.ts | "O que foi feito no período" com as ações |
| CAP-ra-action-tracking | create | Criado na Fase 2 (ausente no Gate C) | tests/unit/portfolioDocument.test.ts | Coluna de vencidas |
| CAP-ra-action-inheritance | modify | `completeDraft(id, build)` faz a atualização condicional numa transação | server/repositories/diagnosisRepository.ts | Na mesma transação, cria as 3 linhas de andamento devolvidas pelo `build`; uma segunda conclusão não cria nada |
| CAP-ra-action-inheritance | modify | `complete` não olha o plano anterior | server/services/diagnosisService.ts | Lê o último concluído não arquivado e o andamento dele e aplica `inheritActionProgress` |
| CAP-ra-action-inheritance | reuse | Plano com chaves fixas, sem repetição | shared/domain/actionPlan.ts | Sem mudança |
| CAP-ra-action-inheritance | modify | Conclusão da versão 1, com corrida | tests/api/diagnosisRoutes.test.ts | Herança e conclusões em paralelo |
| CAP-ra-action-inheritance | create | Criado no mesmo commit da Fase 3 por CAP-ra-action-tracking | tests/api/actionRoutes.test.ts | Arquivar devolve o plano anterior; restaurar volta; excluir a empresa apaga andamento e diário (AC-ra-32) |
| CAP-ra-action-inheritance | create | Criado no mesmo commit da Fase 3 por CAP-ra-action-tracking | tests/unit/actionProgress.test.ts | Repetida, nova e encerrada |
| CAP-ra-diary | modify | Atualizado nas Fases 1 e 3 | prisma/schema.prisma | `DiaryEntry` (`diary_entries`: id, company_id com cascata, month `YYYY-MM`, spend_parts JSON em centavos ou spend_total_cents, new_customers, created_at, updated_at; único (company_id, month)) |
| CAP-ra-diary | create | Sem tabela | prisma/migrations/20261026000200_diary_entries/migration.sql | Só criação |
| CAP-ra-diary | create | Sem regras de diário | shared/domain/diary.ts | Custo do mês com o arredondamento de `unitEconomics`, "não calculado" com 0, progresso, "Medido: de {mês} a {mês}", últimos 6 meses |
| CAP-ra-diary | create | Criado na Fase 3 (ausente no Gate C) | shared/format/dates.ts | Máscara `MM/AAAA` e mês futuro |
| CAP-ra-diary | create | Criado na Fase 3 (ausente no Gate C) | tests/unit/dates.test.ts | Máscara `MM/AAAA` e mês futuro |
| CAP-ra-diary | create | Padrão `CnpjField.tsx` | src/components/form/MonthField.tsx | `inputmode="numeric"` |
| CAP-ra-diary | reuse | Máscara de reais em centavos | src/components/form/MoneyField.tsx | Sem mudança |
| CAP-ra-diary | reuse | `SPEND_PART_OPTIONS` (6 partes) | shared/content/calculatorOptions.ts | Sem mudança |
| CAP-ra-diary | create | Sem acesso | server/repositories/diaryRepository.ts | Listar, criar, editar, excluir, 3 mais recentes |
| CAP-ra-diary | create | Sem schema | server/validation/diarySchemas.ts | Mês, clientes, partes ou total, limites |
| CAP-ra-diary | create | Sem serviço | server/services/diaryService.ts | 409 `month_taken`; mês imutável |
| CAP-ra-diary | create | Sem rotas | server/routes/diaryRoutes.ts | `GET`/`POST /api/companies/:id/diary`, `PUT`/`DELETE /api/companies/:id/diary/:month` |
| CAP-ra-diary | modify | Atualizado nas Fases 1 a 3 | server/app.ts | Rotas do diário |
| CAP-ra-diary | create | Sem cliente | src/api/diaryApi.ts | CRUD do diário |
| CAP-ra-diary | create | Sem aba | src/features/diary/CompanyDiaryTab.tsx | Lista, progresso, vazio "Por que anotar todo mês?", aviso do modo consultoria; linhas com chave pelo mês |
| CAP-ra-diary | create | idem | src/features/diary/DiaryMonthForm.tsx | Criar e editar (mês só leitura com a explicação), "Só sei o total do gasto", erros no campo; exclusão no modal |
| CAP-ra-diary | create | idem | src/features/diary/DiaryCostChart.tsx | 6 meses, valor escrito em cada barra, frase-resumo |
| CAP-ra-diary | create | Criado na Fase 1 (ausente no Gate C) | src/features/companies/CompanyTabs.tsx | Aba "Diário" |
| CAP-ra-diary | modify | Atualizado nas Fases 1 a 3 | src/App.tsx | Rota `empresa/:companyId/diario` |
| CAP-ra-diary | create | Sem teste | tests/unit/diary.test.ts | Custo, 0 clientes, progresso, gráfico |
| CAP-ra-diary | create | Sem teste | tests/api/diaryRoutes.test.ts | Centavos, limites, mês futuro, repetido, em paralelo |
| CAP-ra-diary | create | Sem e2e | tests/e2e/diary.spec.ts | Anotar, total único, editar um mês específico, excluir com modal, vazio, "Medido" |
| CAP-ra-diary-prefill | modify | `CalculatorInput` sem total nem origem do diário | shared/domain/types.ts | `spendTotalCents` e `diarySource` opcionais |
| CAP-ra-diary-prefill | modify | Exato = soma das partes, sempre medido | shared/domain/unitEconomics.ts | Aceita o total; valor do diário estimado conta como estimado |
| CAP-ra-diary-prefill | modify | Gasto exato exige partes | shared/domain/completeness.ts | Aceita o total |
| CAP-ra-diary-prefill | create | Sem regra de preenchimento | shared/domain/diaryPrefill.ts | RULE-ra-09: 3+ meses somados e medidos (total se algum mês tem só o total); 1–2 meses → média × 3 estimada; 0 → nada |
| CAP-ra-diary-prefill | modify | Patch do calculador estrito | server/validation/diagnosisSchemas.ts | Patch aceita `spendTotalCents`; o calculador guardado aceita `diarySource` e `diarySuggestion`, que o cliente não envia |
| CAP-ra-diary-prefill | modify | Atualizado na Fase 3 | server/services/diagnosisService.ts | `start` põe o diário no calculador; edição à mão tira a marca do campo; `applyDiarySuggestion` |
| CAP-ra-diary-prefill | modify | Rotas do rascunho | server/routes/diagnosisRoutes.ts | `POST /api/diagnoses/:id/diary-suggestion` |
| CAP-ra-diary-prefill | create | Criado no mesmo commit da Fase 4 por CAP-ra-diary | server/repositories/diaryRepository.ts | 3 meses mais recentes da empresa |
| CAP-ra-diary-prefill | modify | Chamadas do rascunho | src/api/diagnosesApi.ts | `applyDiarySuggestion(id)` |
| CAP-ra-diary-prefill | modify | Seis campos da versão 1 | src/features/diagnosis/CalculatorBlock.tsx | Marca "do diário: {mês} a {mês}", total único, "Usar o diário" com "N mês(es), estimado" |
| CAP-ra-diary-prefill | modify | Números sem origem do diário | src/features/result/NumbersSummary.tsx | "do diário, medido", "do diário, estimado" ou digitado |
| CAP-ra-diary-prefill | modify | Atualizado nas Fases 1 e 3 | server/report/reportModel.ts | Origem do custo em "Seus números" |
| CAP-ra-diary-prefill | create | Criado na Fase 2 (ausente no Gate C) | server/report/evolutionDocument.ts | Custo por cliente do diário no período |
| CAP-ra-diary-prefill | modify | Atualizado nas Fases 1 a 3 | server/services/reportService.ts | Passa o diário do período ao documento de evolução |
| CAP-ra-diary-prefill | modify | Atualizado nas Fases 1 e 3 | tests/unit/reportModel.test.ts | Origem do custo em "Seus números" |
| CAP-ra-diary-prefill | create | Criado na Fase 2 (ausente no Gate C) | tests/unit/evolutionDocument.test.ts | Custo do diário no período |
| CAP-ra-diary-prefill | modify | Origens da versão 1 | tests/unit/unitEconomics.test.ts | Total e estimado do diário |
| CAP-ra-diary-prefill | create | Sem teste | tests/unit/diaryPrefill.test.ts | 3, 2, 1 e 0 meses; total único |
| CAP-ra-diary-prefill | modify | Atualizado na Fase 3 | tests/api/diagnosisRoutes.test.ts | Rascunho com o diário; diário mudado depois não altera o rascunho; respostas do último concluído (AC-ra-47) |
| CAP-ra-diary-prefill | modify | Calculadora da versão 1 | tests/e2e/calculator.spec.ts | Bloco preenchido, "Usar o diário", correção à mão, origem no resultado |
| CAP-ra-home-followup | modify | Modo, tema, foco e tour por modo | server/validation/preferenceSchemas.ts | `reevaluationIntervalDays` (60, 90, 120, 180) e `tourSeenVersion` |
| CAP-ra-home-followup | modify | Atualizado na Fase 2 | server/services/preferenceService.ts | Lê e grava as duas preferências; padrão 90 |
| CAP-ra-home-followup | modify | Tipos das preferências | src/api/preferencesApi.ts | Os dois campos |
| CAP-ra-home-followup | create | Criado na Fase 2 (ausente no Gate C) | shared/domain/followUp.ts | Contagem "N dias até" e "N dias de atraso"; linha Último/Hoje/Próximo |
| CAP-ra-home-followup | create | Criado na Fase 2 (ausente no Gate C) | server/services/portfolioService.ts | Intervalo configurado em vez de 90 fixo |
| CAP-ra-home-followup | modify | Atualizado na Fase 2 | server/services/homeService.ts | Dono: reavaliação, resumo e 3 ações do plano, resumo do diário, último PDF; sem `trend`. Consultor: ações vencidas e intervalo |
| CAP-ra-home-followup | modify | Tipos do IF-007 | src/api/homeApi.ts | Campos novos; sai `trend` |
| CAP-ra-home-followup | modify | Atualizado na Fase 1; escada grande e evolução da média (AC-dm-32) | src/features/home/OwnerHome.tsx | Foco "Refazer o diagnóstico" com os indicadores e "Suas 3 ações" (desvio 3 do PRD); "Continuar de onde parei" com rascunho |
| CAP-ra-home-followup | create | Sem contagem | src/features/home/ReevaluationCountdown.tsx | Contagem, linha Último/Hoje/Próximo, intervalo, trava, frase do lembrete só no app |
| CAP-ra-home-followup | create | Sem indicadores de acompanhamento | src/features/home/OwnerFollowUpWidgets.tsx | "Ações do plano", "Diário de números", "Relatórios", cada um abrindo a aba certa |
| CAP-ra-home-followup | modify | Atualizado na Fase 2 | src/features/home/ConsultantHome.tsx | "O que precisa de você" com ações vencidas; links para a lista filtrada |
| CAP-ra-home-followup | retire | Usado só por `OwnerHome.tsx:184`, que sai pelo desvio 3 do PRD | src/features/home/ScoreTrend.tsx | Arquivo removido |
| CAP-ra-home-followup | modify | 9 passos em 2 modos, `tourSeen` por modo | src/features/home/OnboardingTour.tsx | 5 passos do protótipo (relatórios, marca, ações, diário, modo) com `tourSeenVersion: 2`; reabre pelo "?" |
| CAP-ra-home-followup | create | Sem configuração de intervalo | src/features/settings/ReevaluationSection.tsx | 60, 90 ("recomendado"), 120 e 180 dias |
| CAP-ra-home-followup | modify | Atualizado na Fase 2 | src/features/settings/SettingsPage.tsx | Mostra a seção |
| CAP-ra-home-followup | modify | `companyListQuerySchema` com busca, estágio e arquivadas | server/validation/companySchemas.ts | `attention` com os filtros de atenção |
| CAP-ra-home-followup | modify | `list({ q, stage, archived })` | server/services/companyService.ts | Filtra pela atenção calculada no `portfolioService` |
| CAP-ra-home-followup | modify | Atualizado nas Fases 1 a 4 | server/app.ts | `companyService` recebe o `portfolioService` |
| CAP-ra-home-followup | modify | Filtros da lista | src/api/companiesApi.ts | `attention` |
| CAP-ra-home-followup | modify | `?busca`, `?estagio`, `?arquivadas` | src/features/companies/CompaniesPage.tsx | `?atencao=`; filtro ativo dito na tela; "Nenhuma empresa encontrada" e "Limpar filtros" |
| CAP-ra-home-followup | create | Criado na Fase 3 (ausente no Gate C) | src/features/actions/ActionProgressRow.tsx | Usado em "Suas 3 ações" |
| CAP-ra-home-followup | create | Criado na Fase 2 (ausente no Gate C) | tests/unit/followUp.test.ts | Contagem e atraso com cada intervalo |
| CAP-ra-home-followup | modify | Atualizado na Fase 2 | tests/api/homeRoutes.test.ts | Dono e consultor com intervalo, vencidas e diário |
| CAP-ra-home-followup | modify | Preferências da versão 1 | tests/api/preferenceRoutes.test.ts | Intervalo e versão do tour; valor fora da lista recusado |
| CAP-ra-home-followup | modify | Lista da versão 1 | tests/api/companyRoutes.test.ts | Cada filtro de atenção |
| CAP-ra-home-followup | modify | Telas iniciais da versão 1 | tests/e2e/home.spec.ts | Contagem, indicadores que seguem os dados, filtros abertos pelos indicadores, tour de 5 passos, troca de modo com recarga |
| CAP-ra-home-followup | modify | Configurações da versão 1 | tests/e2e/settings.spec.ts | Intervalo com recarga |
| CAP-ra-home-followup | modify | Lista da versão 1 | tests/e2e/companies.spec.ts | Filtro de atenção vazio e "Limpar filtros" |
| CAP-ra-remote-questionnaire | modify | Atualizado nas Fases 1, 3 e 4 | prisma/schema.prisma | `QuestionnaireSend` (`questionnaire_sends`: id, company_id com cascata, file_name, sent_at, answered_at, client_saved_at, draft_id) |
| CAP-ra-remote-questionnaire | create | Sem tabela | prisma/migrations/20261026000300_questionnaire_sends/migration.sql | Só criação |
| CAP-ra-remote-questionnaire | reuse | Os 8 blocos, as 24 perguntas, a ajuda e o "não sei" permitido | shared/content/questionBank.ts | Sem mudança |
| CAP-ra-remote-questionnaire | create | Não existe troca por arquivo (CAP-dm-file-bridge deferida) | server/questionnaire/questionnaireFile.ts | HTML único com CSP, estilos e script embutidos e os dados em JSON escapado |
| CAP-ra-remote-questionnaire | create | idem | server/questionnaire/questionnaireClient.js | Formulário no navegador: aviso de computador, 8 blocos, máscaras da calculadora, "Revise e salve", download de `respostas-{empresa}.fitpulse` |
| CAP-ra-remote-questionnaire | create | idem | server/questionnaire/questionnaireStyles.css | Tokens da identidade com as pilhas de fonte do sistema |
| CAP-ra-remote-questionnaire | create | Modelo do arquivo de cópia em `backupSchemas.ts` | server/validation/questionnaireSchemas.ts | Arquivo de respostas: marca, versão, empresa, respostas e calculadora pelos schemas do PATCH; ≤ 1 MB |
| CAP-ra-remote-questionnaire | create | Sem acesso | server/repositories/questionnaireRepository.ts | Envios, aguardando, marcar respondido |
| CAP-ra-remote-questionnaire | modify | Atualizado nas Fases 3 e 4 | server/repositories/diagnosisRepository.ts | Criar ou substituir o rascunho com respostas numa transação |
| CAP-ra-remote-questionnaire | create | Sem serviço | server/services/questionnaireService.ts | Gerar, salvar e registrar; importar com as recusas da RULE-ra-10 e a substituição confirmada |
| CAP-ra-remote-questionnaire | create | Sem rotas | server/routes/questionnaireRoutes.ts | `POST /api/companies/:id/questionnaire` e `POST /api/companies/:id/questionnaire-answers` (parser de 2 MB) |
| CAP-ra-remote-questionnaire | modify | Atualizado nas Fases 1 a 5 | server/app.ts | Rotas do questionário |
| CAP-ra-remote-questionnaire | create | Criado na Fase 2 (ausente no Gate C) | server/repositories/portfolioRepository.ts | Carrega os envios sem resposta |
| CAP-ra-remote-questionnaire | create | Criado na Fase 2 (ausente no Gate C) | server/services/portfolioService.ts | "Questionários aguardando resposta" |
| CAP-ra-remote-questionnaire | modify | Atualizado na Fase 2 | server/services/historyService.ts | Rascunho da linha do tempo com "Respostas do cliente, salvas em {data}" |
| CAP-ra-remote-questionnaire | modify | Atualizado na Fase 5 | server/validation/companySchemas.ts | Filtro `aguardando` |
| CAP-ra-remote-questionnaire | create | Sem cliente | src/api/questionnaireApi.ts | Enviar e importar |
| CAP-ra-remote-questionnaire | create | Sem diálogo | src/features/questionnaire/SendQuestionnaireDialog.tsx | 3 passos, "Mostrar na pasta", mensagem com "Copiar mensagem" e texto selecionável se a cópia falhar |
| CAP-ra-remote-questionnaire | create | Sem diálogo | src/features/questionnaire/ImportAnswersDialog.tsx | "Lendo o arquivo…", recusas com `role="alert"` e "Nada foi alterado.", substituição no modal, "Revisar e concluir" |
| CAP-ra-remote-questionnaire | modify | Atualizado na Fase 1 | src/features/companies/CompanyPage.tsx | "Enviar questionário" e "Importar respostas" no modo consultoria; "Questionário enviado em {data}" |
| CAP-ra-remote-questionnaire | modify | Linha do tempo da versão 1 | src/features/history/CompanyTimeline.tsx | Marca do rascunho importado |
| CAP-ra-remote-questionnaire | modify | Tipos da linha do tempo | src/api/historyApi.ts | Campo da marca do rascunho |
| CAP-ra-remote-questionnaire | modify | Atualizado nas Fases 2 e 5 | src/features/home/ConsultantHome.tsx | "Questionários aguardando resposta" |
| CAP-ra-remote-questionnaire | modify | Atualizado na Fase 5 | src/features/companies/CompaniesPage.tsx | Filtro `aguardando` |
| CAP-ra-remote-questionnaire | create | Sem teste | tests/unit/questionnaireFile.test.ts | Sem URL de rede, CSP, escape de nome hostil, só empresa, catálogo e marca |
| CAP-ra-remote-questionnaire | create | Sem teste | tests/api/questionnaireRoutes.test.ts | Envio registrado; importação válida; outra empresa; versão mais nova; incompatível; corrompido; > 1 MB; rascunho existente (409) e substituição |
| CAP-ra-remote-questionnaire | create | Sem e2e | tests/e2e/remoteQuestionnaire.spec.ts | Gerar; abrir o arquivo no Chromium com a rede bloqueada; responder; salvar; importar; recusas; substituir e cancelar |
| CAP-ra-data-continuity | modify | `BACKUP_FORMAT_VERSION = 1`, schema estrito com empresas e diagnósticos | server/validation/backupSchemas.ts | Versão 2 com marca e logo, intervalo, andamento, diário e envios; aceita a versão 1 |
| CAP-ra-data-continuity | modify | Lê e insere empresas e diagnósticos numa transação, pulando ids existentes | server/services/backupService.ts | Exporta e importa os registros novos; a marca e o intervalo só entram quando o destino não tem; `generated_files` fica de fora (caminho local) |
| CAP-ra-data-continuity | modify | Contagens de empresas e diagnósticos | src/api/backupApi.ts | Contagens novas |
| CAP-ra-data-continuity | modify | Mensagem de cópia com as contagens da versão 1 | src/features/settings/BackupSection.tsx | Mostra as contagens novas |
| CAP-ra-data-continuity | reuse | Resumo sem dinheiro nem respostas (RULE-dm-17) | server/services/assistantSummaryService.ts | Sem mudança |
| CAP-ra-data-continuity | reuse | Lista só `/api/health` e `/api/assistant/summary` | server/routes/playRoutes.ts | Sem mudança |
| CAP-ra-data-continuity | modify | `version: 0.1.0`, `schema_version: 1` | manifest.json | `version: 0.2.0`, `schema_version: 2`, `requires_migration: true` |
| CAP-ra-data-continuity | modify | Espelha a versão 0.1.0 | system.json | Versão 0.2.0 |
| CAP-ra-data-continuity | modify | `version: 0.1.0` | package.json | Versão 0.2.0; dependências iguais |
| CAP-ra-data-continuity | modify | Migração sintética sobre o banco da versão 1 | scripts/smoke-migrate.mjs | Banco com dados da versão 1 → as 4 migrações → dados intactos; deploy repetido sem efeito |
| CAP-ra-data-continuity | modify | Update simulado com migração sintética | scripts/smoke-store-package.mjs | Instala o pacote da versão 1, grava dados, sobrepõe o pacote atual, roda `pnpm install`, confere os dados e a presença de `server/questionnaire/questionnaireClient.js` e `questionnaireStyles.css` |
| CAP-ra-data-continuity | modify | Ida e volta da versão 1 | tests/api/backupRoutes.test.ts | Ida e volta da versão 2 com tudo; versão 1 importa; nada é apagado |
| CAP-ra-data-continuity | modify | Lista e resumo da versão 1 | tests/api/playRoutes.test.ts | Lista igual; resumo sem reais, diário, notas e marca |
| CAP-ra-data-continuity | modify | Exportar e importar da versão 1 | tests/e2e/backup.spec.ts | Cópia com marca, ações e diário reproduzida noutro banco |
| CAP-ra-data-continuity | modify | Atualizado nas Fases 1 a 6 | tests/e2e/accessibility.spec.ts | Todas as telas novas em 390 px, nos dois temas e com movimento reduzido |

## Capability Delivery Plan

| CAP | Phase | Files | Verification |
|---|---|---|---|
| CAP-ra-report-center | 1 | src/App.tsx, src/features/companies/CompanyPage.tsx, src/features/companies/CompanyTabs.tsx, src/features/companies/CompanyDiagnosesTab.tsx, src/features/report-center/ReportCenterPage.tsx, src/features/report-center/ReportOptions.tsx, src/features/report-center/ReportPreview.tsx, src/features/report-center/ReportSheet.tsx, src/features/report-center/ReportSheetCharts.tsx, src/features/report-center/useReportPreview.ts, src/api/reportApi.ts, src/features/home/OwnerHome.tsx, src/styles/global.css, shared/report/reportDocument.ts, shared/report/paperPalette.ts, server/validation/reportSchemas.ts, server/routes/reportRoutes.ts, tests/e2e/report.spec.ts, tests/e2e/accessibility.spec.ts, tests/e2e/support/fixtures.ts, .aioson/plans/relatorios-e-acompanhamento/harness-contract.json | `pnpm exec playwright test tests/e2e/report.spec.ts tests/e2e/accessibility.spec.ts` + `aioson harness:check . --slug=relatorios-e-acompanhamento` + central aberta no dev-link do Play |
| CAP-ra-diagnosis-report | 1 | server/report/reportModel.ts, server/report/reportCopy.ts, server/report/documentParts.ts, server/report/pdfRenderer.ts, server/report/pdfBlocks.ts, server/report/pdfCharts.ts, shared/format/confidenceText.ts, tests/unit/reportModel.test.ts, tests/unit/pdfRenderer.test.ts, tests/unit/forbiddenTerms.test.ts | `pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/pdfRenderer.test.ts tests/unit/forbiddenTerms.test.ts` + impressão em escala de cinza de um PDF exportado |
| CAP-ra-pdf-delivery | 1 | prisma/schema.prisma, prisma/migrations/20261026000000_generated_files/migration.sql, server/repositories/generatedFileRepository.ts, server/services/reportService.ts, server/files/downloadsFolder.ts, server/files/systemOpener.ts, server/services/fileService.ts, server/routes/fileRoutes.ts, server/app.ts, server/main.ts, src/api/filesApi.ts, src/features/report-center/ReportDelivery.tsx, tests/api/reportRoutes.test.ts, tests/api/fileRoutes.test.ts | `pnpm exec vitest run tests/api/reportRoutes.test.ts tests/api/fileRoutes.test.ts` + `node scripts/smoke-migrate.mjs` + "Abrir PDF" e "Mostrar na pasta" no webview do Play no Windows (OQ-ra-1) |
| CAP-ra-polish | 1 | src/features/result/ConfidenceNote.tsx, src/features/result/RiskList.tsx, src/features/result/ResultPage.tsx, src/features/result/ExportReportDialog.tsx, tests/unit/confidenceText.test.ts, tests/e2e/result.spec.ts | `pnpm exec vitest run tests/unit/confidenceText.test.ts` + `pnpm exec playwright test tests/e2e/result.spec.ts` |
| CAP-ra-brand | 2 | server/validation/brandSchemas.ts, server/repositories/preferenceRepository.ts, server/services/preferenceService.ts, server/files/imageSignature.ts, server/services/brandService.ts, server/routes/brandRoutes.ts, server/app.ts, server/services/reportService.ts, server/report/documentParts.ts, server/report/pdfRenderer.ts, shared/format/phone.ts, shared/format/contact.ts, src/components/form/PhoneField.tsx, src/api/brandApi.ts, src/features/settings/brandLogoImage.ts, src/features/settings/BrandSection.tsx, src/features/settings/SettingsPage.tsx, src/features/report-center/ReportSheet.tsx, src/components/feedback/ConfirmDialog.tsx, tests/unit/imageSignature.test.ts, tests/unit/contactFormat.test.ts, tests/api/brandRoutes.test.ts, tests/unit/pdfRenderer.test.ts, tests/e2e/brand.spec.ts | `pnpm exec vitest run tests/unit/imageSignature.test.ts tests/unit/contactFormat.test.ts tests/api/brandRoutes.test.ts tests/unit/pdfRenderer.test.ts tests/api/preferenceRoutes.test.ts` + `pnpm exec playwright test tests/e2e/brand.spec.ts` |
| CAP-ra-evolution-report | 2 | server/services/historyService.ts, shared/domain/compareDiagnoses.ts, shared/content/comparisonCopy.ts, src/features/history/ComparePage.tsx, server/report/evolutionDocument.ts, server/validation/reportSchemas.ts, server/services/reportService.ts, src/features/report-center/ReportOptions.tsx, tests/unit/evolutionDocument.test.ts, tests/fixtures/rulesV2.ts, tests/e2e/report.spec.ts, tests/unit/forbiddenTerms.test.ts | `pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/historyRoutes.test.ts` + `pnpm exec playwright test tests/e2e/report.spec.ts tests/e2e/history.spec.ts` |
| CAP-ra-portfolio-report | 2 | shared/domain/followUp.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/services/homeService.ts, server/report/portfolioDocument.ts, server/services/reportService.ts, src/features/report-center/PortfolioReportPage.tsx, src/features/home/ConsultantHome.tsx, src/App.tsx, tests/unit/followUp.test.ts, tests/unit/portfolioDocument.test.ts, tests/api/homeRoutes.test.ts, tests/e2e/portfolioReport.spec.ts, tests/unit/forbiddenTerms.test.ts | `pnpm exec vitest run tests/unit/followUp.test.ts tests/unit/portfolioDocument.test.ts tests/api/homeRoutes.test.ts` + `pnpm exec playwright test tests/e2e/portfolioReport.spec.ts tests/e2e/home.spec.ts` |
| CAP-ra-action-tracking | 3 | prisma/schema.prisma, prisma/migrations/20261026000100_action_progress/migration.sql, shared/domain/actionProgress.ts, shared/content/actionProgressOptions.ts, shared/format/dates.ts, src/components/form/DateField.tsx, server/repositories/actionProgressRepository.ts, server/validation/actionSchemas.ts, server/services/actionService.ts, server/routes/actionRoutes.ts, server/app.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/report/portfolioDocument.ts, server/services/reportService.ts, src/api/actionsApi.ts, src/features/actions/CompanyActionsTab.tsx, src/features/actions/ActionProgressRow.tsx, src/features/actions/ActionEditDialog.tsx, src/features/actions/useActionStatus.ts, src/components/feedback/UndoNotice.tsx, src/features/result/ActionPlanList.tsx, src/features/result/ResultPage.tsx, src/features/companies/CompanyTabs.tsx, src/App.tsx, tests/unit/actionProgress.test.ts, tests/unit/dates.test.ts, tests/api/actionRoutes.test.ts, tests/e2e/actions.spec.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts, tests/unit/portfolioDocument.test.ts | `pnpm exec vitest run tests/unit/actionProgress.test.ts tests/unit/dates.test.ts tests/api/actionRoutes.test.ts tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts tests/unit/portfolioDocument.test.ts` + `node scripts/smoke-migrate.mjs` + `pnpm exec playwright test tests/e2e/actions.spec.ts` |
| CAP-ra-action-inheritance | 3 | server/repositories/diagnosisRepository.ts, server/services/diagnosisService.ts, shared/domain/actionPlan.ts, tests/api/diagnosisRoutes.test.ts, tests/api/actionRoutes.test.ts, tests/unit/actionProgress.test.ts | `pnpm exec vitest run tests/api/diagnosisRoutes.test.ts tests/api/actionRoutes.test.ts tests/unit/actionProgress.test.ts` |
| CAP-ra-diary | 4 | prisma/schema.prisma, prisma/migrations/20261026000200_diary_entries/migration.sql, shared/domain/diary.ts, shared/format/dates.ts, src/components/form/MonthField.tsx, src/components/form/MoneyField.tsx, shared/content/calculatorOptions.ts, tests/unit/dates.test.ts, server/repositories/diaryRepository.ts, server/validation/diarySchemas.ts, server/services/diaryService.ts, server/routes/diaryRoutes.ts, server/app.ts, src/api/diaryApi.ts, src/features/diary/CompanyDiaryTab.tsx, src/features/diary/DiaryMonthForm.tsx, src/features/diary/DiaryCostChart.tsx, src/features/companies/CompanyTabs.tsx, src/App.tsx, tests/unit/diary.test.ts, tests/api/diaryRoutes.test.ts, tests/e2e/diary.spec.ts | `pnpm exec vitest run tests/unit/diary.test.ts tests/unit/dates.test.ts tests/api/diaryRoutes.test.ts` + `node scripts/smoke-migrate.mjs` + `pnpm exec playwright test tests/e2e/diary.spec.ts` |
| CAP-ra-diary-prefill | 4 | shared/domain/types.ts, shared/domain/unitEconomics.ts, shared/domain/completeness.ts, shared/domain/diaryPrefill.ts, server/validation/diagnosisSchemas.ts, server/services/diagnosisService.ts, server/routes/diagnosisRoutes.ts, server/repositories/diaryRepository.ts, src/api/diagnosesApi.ts, src/features/diagnosis/CalculatorBlock.tsx, src/features/result/NumbersSummary.tsx, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/services/reportService.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts, tests/unit/unitEconomics.test.ts, tests/unit/diaryPrefill.test.ts, tests/api/diagnosisRoutes.test.ts, tests/e2e/calculator.spec.ts | `pnpm exec vitest run tests/unit/unitEconomics.test.ts tests/unit/diaryPrefill.test.ts tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts tests/api/diagnosisRoutes.test.ts tests/api/backupRoutes.test.ts` + `pnpm exec playwright test tests/e2e/calculator.spec.ts tests/e2e/questionnaire.spec.ts` |
| CAP-ra-home-followup | 5 | server/validation/preferenceSchemas.ts, server/services/preferenceService.ts, src/api/preferencesApi.ts, shared/domain/followUp.ts, server/services/portfolioService.ts, server/services/homeService.ts, src/api/homeApi.ts, src/features/home/OwnerHome.tsx, src/features/home/ReevaluationCountdown.tsx, src/features/home/OwnerFollowUpWidgets.tsx, src/features/home/ConsultantHome.tsx, src/features/home/ScoreTrend.tsx, src/features/home/OnboardingTour.tsx, src/features/settings/ReevaluationSection.tsx, src/features/settings/SettingsPage.tsx, server/validation/companySchemas.ts, server/services/companyService.ts, server/app.ts, src/api/companiesApi.ts, src/features/companies/CompaniesPage.tsx, src/features/actions/ActionProgressRow.tsx, tests/unit/followUp.test.ts, tests/api/homeRoutes.test.ts, tests/api/preferenceRoutes.test.ts, tests/api/companyRoutes.test.ts, tests/e2e/home.spec.ts, tests/e2e/settings.spec.ts, tests/e2e/companies.spec.ts | `pnpm exec vitest run tests/unit/followUp.test.ts tests/api/homeRoutes.test.ts tests/api/preferenceRoutes.test.ts tests/api/companyRoutes.test.ts` + `pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/settings.spec.ts tests/e2e/companies.spec.ts tests/e2e/firstRun.spec.ts` |
| CAP-ra-remote-questionnaire | 6 | prisma/schema.prisma, prisma/migrations/20261026000300_questionnaire_sends/migration.sql, shared/content/questionBank.ts, server/questionnaire/questionnaireFile.ts, server/questionnaire/questionnaireClient.js, server/questionnaire/questionnaireStyles.css, server/validation/questionnaireSchemas.ts, server/repositories/questionnaireRepository.ts, server/repositories/diagnosisRepository.ts, server/services/questionnaireService.ts, server/routes/questionnaireRoutes.ts, server/app.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/services/historyService.ts, server/validation/companySchemas.ts, src/api/questionnaireApi.ts, src/features/questionnaire/SendQuestionnaireDialog.tsx, src/features/questionnaire/ImportAnswersDialog.tsx, src/features/companies/CompanyPage.tsx, src/features/history/CompanyTimeline.tsx, src/api/historyApi.ts, src/features/home/ConsultantHome.tsx, src/features/companies/CompaniesPage.tsx, tests/unit/questionnaireFile.test.ts, tests/api/questionnaireRoutes.test.ts, tests/e2e/remoteQuestionnaire.spec.ts | Teste Q-10 aprovado pelo dono + `pnpm exec vitest run tests/unit/questionnaireFile.test.ts tests/api/questionnaireRoutes.test.ts` + `node scripts/smoke-migrate.mjs` + `pnpm exec playwright test tests/e2e/remoteQuestionnaire.spec.ts tests/e2e/home.spec.ts` |
| CAP-ra-data-continuity | 7 | server/validation/backupSchemas.ts, server/services/backupService.ts, src/api/backupApi.ts, src/features/settings/BackupSection.tsx, server/services/assistantSummaryService.ts, server/routes/playRoutes.ts, manifest.json, system.json, package.json, scripts/smoke-migrate.mjs, scripts/smoke-store-package.mjs, tests/api/backupRoutes.test.ts, tests/api/playRoutes.test.ts, tests/e2e/backup.spec.ts, tests/e2e/accessibility.spec.ts | `pnpm build` + `pnpm test` + `pnpm test:e2e` + `node scripts/smoke-migrate.mjs` + `node scripts/smoke-boot.mjs` + `node scripts/smoke-store-package.mjs` + `aioson harness:check . --slug=relatorios-e-acompanhamento` + update de uma instalação da versão 1 com dados no Play |

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
  - create: src/features/companies/CompanyTabs.tsx, src/features/companies/CompanyDiagnosesTab.tsx, src/features/report-center/ReportCenterPage.tsx, src/features/report-center/ReportOptions.tsx, src/features/report-center/ReportPreview.tsx, src/features/report-center/ReportSheet.tsx, src/features/report-center/ReportSheetCharts.tsx, src/features/report-center/useReportPreview.ts, shared/report/reportDocument.ts, shared/report/paperPalette.ts, server/validation/reportSchemas.ts, .aioson/plans/relatorios-e-acompanhamento/harness-contract.json, server/report/reportCopy.ts, server/report/documentParts.ts, server/report/pdfBlocks.ts, server/report/pdfCharts.ts, shared/format/confidenceText.ts, tests/unit/pdfRenderer.test.ts, prisma/migrations/20261026000000_generated_files/migration.sql, server/repositories/generatedFileRepository.ts, server/files/systemOpener.ts, server/services/fileService.ts, server/routes/fileRoutes.ts, src/api/filesApi.ts, src/features/report-center/ReportDelivery.tsx, tests/api/fileRoutes.test.ts, tests/unit/confidenceText.test.ts.
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

## Phase 2 — O PDF sai com a marca de quem entrega, e a central passa a gerar a evolução e a carteira

- CAP/AC:
  - CAP-ra-brand: AC-ra-20, AC-ra-21, AC-ra-22.
  - CAP-ra-evolution-report: AC-ra-12 (sem "O que foi feito no período" até as Fases 3 e 4), AC-ra-13, AC-ra-14.
  - CAP-ra-portfolio-report: AC-ra-15 (sem a coluna de ações vencidas até a Fase 3), AC-ra-16, e AC-ra-01 para "Relatório da carteira".
  - AC-ra-11 nos três PDFs.
  - Nas telas desta fase: AC-ra-57, AC-ra-59 (remover logo e voltar para FitPulse), AC-ra-60.
  - Interações do protótipo: `brand-save`, `brand-logo-upload`, `brand-logo-remove`, `brand-reset`, `report-type-evolution`, `portfolio-report`.
- User-visible outcome:
  - Em Configurações → "Seus relatórios", o usuário salva nome, logo, telefone, e-mail e site. A prévia da capa muda, e os três PDFs saem com a marca na capa e no rodapé.
  - Uma logo SVG, um texto renomeado para .png ou um arquivo de 3 MB são recusados no campo, e nada muda.
  - Com 2 diagnósticos concluídos, "Evolução" mostra "Antes e depois" com os mesmos números da tela "Comparar".
  - No modo consultoria, "Relatório da carteira" na tela inicial gera `carteira-{data}.pdf`.
- Implementation, nesta ordem:
  1. **Marca no servidor:** `brandSchemas`, `imageSignature`, `brandService`, `brandRoutes` (com parser próprio montado antes do `express.json`) e `preferenceRepository.readKeys`.
     - O `preferenceService` deixa de ler a logo.
     - `documentParts` e `pdfRenderer` desenham nome, logo e contato.
  2. **Marca na tela:** `phone.ts`, `contact.ts`, `PhoneField`, `brandApi`, `brandLogoImage` (confere os bytes, reduz para 600 px no mesmo formato), `BrandSection` em `SettingsPage` e a capa da prévia em `ReportSheet`.
     - As confirmações usam `ConfirmDialog`.
     - O rótulo segue o modo de uso.
  3. **Evolução:**
     - `historyService.comparePair`, `comparisonCopy` (usado também por `ComparePage`) e `evolutionDocument`.
     - Seleção `evolution` em `reportSchemas` e `reportService`; "De"/"Até" em `ReportOptions`.
  4. **Carteira:**
     - `followUp.ts` com 90 dias fixos até a Fase 5.
     - `portfolioRepository` e `portfolioService` extraídos de `homeService`, sem mudar o IF-007.
     - `portfolioDocument`, `PortfolioReportPage` na rota `relatorios/carteira` e o botão em `ConsultantHome`.
- Create/modify/reuse/retire:
  - modify: server/repositories/preferenceRepository.ts, server/services/preferenceService.ts, server/app.ts, server/services/reportService.ts, server/report/pdfRenderer.ts, src/features/settings/SettingsPage.tsx, server/services/historyService.ts, src/features/history/ComparePage.tsx, tests/e2e/report.spec.ts, tests/unit/forbiddenTerms.test.ts, server/services/homeService.ts, src/features/home/ConsultantHome.tsx, src/App.tsx, tests/api/homeRoutes.test.ts.
  - create: server/validation/brandSchemas.ts, server/files/imageSignature.ts, server/services/brandService.ts, server/routes/brandRoutes.ts, server/report/documentParts.ts, shared/format/phone.ts, shared/format/contact.ts, src/components/form/PhoneField.tsx, src/api/brandApi.ts, src/features/settings/brandLogoImage.ts, src/features/settings/BrandSection.tsx, src/features/report-center/ReportSheet.tsx, tests/unit/imageSignature.test.ts, tests/unit/contactFormat.test.ts, tests/api/brandRoutes.test.ts, tests/unit/pdfRenderer.test.ts, tests/e2e/brand.spec.ts, shared/content/comparisonCopy.ts, server/report/evolutionDocument.ts, server/validation/reportSchemas.ts, src/features/report-center/ReportOptions.tsx, tests/unit/evolutionDocument.test.ts, shared/domain/followUp.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/report/portfolioDocument.ts, src/features/report-center/PortfolioReportPage.tsx, tests/unit/followUp.test.ts, tests/unit/portfolioDocument.test.ts, tests/e2e/portfolioReport.spec.ts.
  - reuse: src/components/feedback/ConfirmDialog.tsx, shared/domain/compareDiagnoses.ts, tests/fixtures/rulesV2.ts.
- Verification:
  - `pnpm build`.
  - `pnpm exec vitest run tests/unit/imageSignature.test.ts tests/unit/contactFormat.test.ts tests/api/brandRoutes.test.ts tests/api/preferenceRoutes.test.ts tests/unit/pdfRenderer.test.ts tests/unit/evolutionDocument.test.ts tests/unit/followUp.test.ts tests/unit/portfolioDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/historyRoutes.test.ts tests/api/homeRoutes.test.ts`.
  - `pnpm exec playwright test tests/e2e/brand.spec.ts tests/e2e/report.spec.ts tests/e2e/portfolioReport.spec.ts tests/e2e/history.spec.ts tests/e2e/home.spec.ts`.
  - No dev-link do Play: salvar uma logo PNG e outra JPG, exportar os três PDFs e conferir a capa e o rodapé.
- Done when:
  - Os três PDFs saem com a marca configurada, e com a marca FitPulse quando ela fica em branco.
  - Evolução e carteira exportam e abrem pelo mesmo estado de entrega.
  - A tela do consultor mostra os mesmos números de antes.

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

## Phase 5 — A tela inicial conta os dias para refazer o diagnóstico e aponta o que precisa de atenção

- CAP/AC:
  - CAP-ra-home-followup: AC-ra-33, AC-ra-34, AC-ra-35 (os questionários aguardando entram na Fase 6), AC-ra-36, AC-ra-37, AC-ra-62.
  - Também: AC-ra-26 em "Suas 3 ações" da tela inicial do dono.
  - Nas telas desta fase: AC-ra-57, AC-ra-58.
  - Interações do protótipo: `reevaluation-countdown`, `reevaluation-interval-setting`, `home-widget-drilldown`, `switch-usage-mode`, `switch-theme`, `tour-reopen`.
- User-visible outcome:
  - O dono abre o app e vê "N dias até {data}" (ou "N dias de atraso desde {data}"), com a linha Último / Hoje / Próximo e a trava.
  - Abaixo vêm "Ações do plano", "Diário de números", "Relatórios" e "Suas 3 ações" com o estado editável. Cada indicador abre a aba certa.
  - O consultor vê em "O que precisa de você" a reavaliação atrasada, as ações vencidas, o risco alto e os rascunhos parados. Cada item abre a lista de empresas filtrada, com o filtro dito e "Limpar filtros".
  - Em Configurações, 60, 90, 120 ou 180 dias muda a contagem na hora e continua depois de reabrir.
  - O tour de 5 passos aparece uma vez e volta pelo "?".
- Implementation, nesta ordem:
  1. **Preferências:** `reevaluationIntervalDays` e `tourSeenVersion` em `preferenceSchemas`, `preferenceService` e `preferencesApi`. Depois `ReevaluationSection` em `SettingsPage`.
  2. **Regras e dados:**
     - `followUp.ts` ganha a contagem e a linha. `portfolioService` usa o intervalo.
     - `homeService`: o dono ganha reavaliação, ações, diário e último PDF, e sai `trend`; o consultor ganha as ações vencidas.
     - `homeApi` acompanha.
  3. **Filtros:** `attention` em `companySchemas`, `companyService` (com o `portfolioService` injetado em `app.ts`), `companiesApi` e `CompaniesPage` (`?atencao=`).
  4. **Telas:**
     - `OwnerHome` no layout do protótipo, com `ReevaluationCountdown`, `OwnerFollowUpWidgets` e `ActionProgressRow`. Sai `ScoreTrend.tsx`.
     - `ConsultantHome` ganha a lista nova, e `OnboardingTour` os 5 passos.
     - A composição segue `#/inicio` nos dois modos e `#/empresas?filtro=…`.
- Create/modify/reuse/retire:
  - modify: server/validation/preferenceSchemas.ts, server/services/preferenceService.ts, src/api/preferencesApi.ts, server/services/homeService.ts, src/api/homeApi.ts, src/features/home/OwnerHome.tsx, src/features/home/ConsultantHome.tsx, src/features/home/OnboardingTour.tsx, src/features/settings/SettingsPage.tsx, server/validation/companySchemas.ts, server/services/companyService.ts, server/app.ts, src/api/companiesApi.ts, src/features/companies/CompaniesPage.tsx, tests/api/homeRoutes.test.ts, tests/api/preferenceRoutes.test.ts, tests/api/companyRoutes.test.ts, tests/e2e/home.spec.ts, tests/e2e/settings.spec.ts, tests/e2e/companies.spec.ts.
  - create: shared/domain/followUp.ts, server/services/portfolioService.ts, src/features/home/ReevaluationCountdown.tsx, src/features/home/OwnerFollowUpWidgets.tsx, src/features/settings/ReevaluationSection.tsx, src/features/actions/ActionProgressRow.tsx, tests/unit/followUp.test.ts.
  - retire: src/features/home/ScoreTrend.tsx.
- Verification:
  - `pnpm build`.
  - `pnpm exec vitest run tests/unit/followUp.test.ts tests/api/homeRoutes.test.ts tests/api/preferenceRoutes.test.ts tests/api/companyRoutes.test.ts`.
  - `pnpm exec playwright test tests/e2e/home.spec.ts tests/e2e/settings.spec.ts tests/e2e/companies.spec.ts tests/e2e/firstRun.spec.ts tests/e2e/accessibility.spec.ts`.
  - No dev-link do Play, com dados reais: marcar como "Feita" uma ação vencida, mudar o intervalo e trocar o modo, conferindo que os números das duas telas iniciais mudam.
- Done when:
  - As telas iniciais seguem os dados nos dois modos, e cada indicador abre a lista filtrada certa.
  - O tour novo aparece uma vez para quem já usava a versão 1.

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

## Phase 7 — A atualização pela loja mantém tudo, e a cópia de segurança leva e devolve os dados novos

- CAP/AC:
  - CAP-ra-data-continuity: AC-ra-54, AC-ra-55, AC-ra-56.
  - Regressão de todas as telas novas: AC-ra-57, AC-ra-58, AC-ra-59, AC-ra-60.
- User-visible outcome:
  - Uma instalação da versão 1 com empresas, diagnósticos, rascunhos e preferências é atualizada pela loja e abre com tudo.
  - "Exportar meus dados" gera a cópia na versão 2, com a marca e a logo, o intervalo, o andamento das ações, o diário e os questionários enviados. Importada noutra instalação, ela reproduz tudo. Uma cópia da versão 1 continua importando.
- Implementation, nesta ordem:
  1. **Cópia versão 2:**
     - `backupSchemas`: o envelope continua lendo a versão primeiro; a versão 1 vai pelo schema antigo e a 2 pelo novo, estrito.
     - `backupService`: inserção numa transação pulando ids existentes. A marca e o intervalo só entram quando o destino não tem.
     - `generated_files` fica de fora, porque guarda um caminho local.
     - `backupApi` e `BackupSection` mostram as contagens novas.
  2. **Versões:** `manifest.json` (0.2.0, `schema_version: 2`, `requires_migration: true`), `system.json` e `package.json` na 0.2.0, sem mudar dependências.
  3. **Smokes:** `smoke-migrate.mjs` parte de um banco com dados da versão 1 e aplica as 4 migrações. `smoke-store-package.mjs` simula o update a partir do pacote da versão 1.
  4. **Privacidade:** `playRoutes.test.ts` confere a lista igual e o resumo sem reais, diário, notas e marca.
  5. **Regressão completa:** `accessibility.spec.ts` cobre as telas novas; rodar a suíte inteira.
- Create/modify/reuse/retire:
  - modify: server/validation/backupSchemas.ts, server/services/backupService.ts, src/api/backupApi.ts, src/features/settings/BackupSection.tsx, manifest.json, system.json, package.json, scripts/smoke-migrate.mjs, scripts/smoke-store-package.mjs, tests/api/backupRoutes.test.ts, tests/api/playRoutes.test.ts, tests/e2e/backup.spec.ts, tests/e2e/accessibility.spec.ts.
  - reuse: server/services/assistantSummaryService.ts, server/routes/playRoutes.ts.
- Verification:
  - `pnpm build`, `pnpm test` e `pnpm test:e2e`.
  - `node scripts/smoke-migrate.mjs`, `node scripts/smoke-boot.mjs` e `node scripts/smoke-store-package.mjs`.
  - `aioson harness:check . --slug=relatorios-e-acompanhamento`.
  - No Play: atualizar uma instalação da versão 1 com dados (Settings → Instalar App → Linkar pasta, ou pacote local) e confirmar empresas, diagnósticos, rascunhos e preferências intactos e a badge verde.
- Done when:
  - Os três smokes, a suíte inteira e o harness passam.
  - A cópia da versão 2 faz a ida e volta completa, e a da versão 1 importa.
  - O update real no Play mantém os dados.

## Development execution lanes

Escolha do dono em 2026-10-25: equipes separadas. O arquivo de papéis `.aioson/config/execution-roles.json` já existe desde a versão 1 e continua valendo:
- servidor: Sonnet 5.5, esforço xhigh;
- telas: Opus 5.5, esforço high;
- QA: Haiku 5.5, esforço high;
- integrador: Opus 5.5, esforço xhigh.

As assinaturas venceram em 24/10. Renovar e assinar são atos do dono, começando por `aioson host:signature . --host=claude --model=claude-sonnet-5-5 --effort=xhigh`, uma vez para cada papel.

| Lane | Exact write paths | Integration owner |
|---|---|---|
| backend | prisma/**, server/**, shared/**, src/api/**, scripts/**, tests/api/**, tests/unit/**, tests/fixtures/**, manifest.json, system.json, package.json | dev |
| frontend | src/App.tsx, src/components/**, src/features/**, src/styles/** | dev |

Fora das duas equipes, sob o integrador (`integration_dev`): `tests/e2e/**` e `.aioson/plans/relatorios-e-acompanhamento/harness-contract.json`.

Regras para as equipes:
- Os clientes `src/api/*.ts` ficam com a equipe do servidor, junto com a rota que eles chamam. A equipe das telas só os importa.
- Nenhuma dependência nova entra no `package.json`. Uma falta vira achado para o integrador.
- Arquivos tocados por mais de uma unidade ficam em ondas diferentes, na ordem da tabela abaixo: `server/app.ts`, `prisma/schema.prisma`, `server/services/reportService.ts`, `server/services/portfolioService.ts`, `server/services/diagnosisService.ts`, `src/App.tsx`, `src/features/companies/CompanyTabs.tsx`, `src/features/result/ResultPage.tsx`, `src/features/home/ConsultantHome.tsx` e `src/features/settings/SettingsPage.tsx`.
- As unidades de tela conferem com `pnpm typecheck`. `pnpm build` e as specs e2e rodam só nas linhas de integração do fim, quando nenhuma unidade está escrevendo. As fases acima continuam descrevendo cada entrega.
- **Teste Q-10:** `6-backend-questionnaire-file` está na onda 1 e grava `test-results/questionario-exemplo.html`. O dono faz o Q-10 com esse arquivo enquanto as outras partes andam. Se falhar, o dono avisa: as unidades restantes da Fase 6 param e voltam ao @product, e `7-backend-backup` deixa de depender delas.

Dependências conferidas com `aioson execution:dependencies` (Jev) em 2026-10-25. Os pares que ele deixou "a decidir" ficaram independentes porque não dividem arquivo nem interface: os documentos ganham ações e diário só nas unidades `3-backend-action-reports` e `4-backend-diary-prefill`; a tela inicial lê o diário pelo repositório, não pelo preenchimento; a cópia lê `questionnaire_sends` da unidade da API; e `BackupSection.tsx` não toca as telas da Fase 5 nem da Fase 6. As linhas de integração ficam no fim de propósito, sem aresta, para o e2e rodar com a árvore parada. Projeção do Jev: cerca de 3h46 como escrito, sem contar retornos de QA nem a integração final.

Monitor: `aioson execution:dashboard . --feature=relatorios-e-acompanhamento`

## Interface Contract

Produtor → consumidor em cada linha. Os erros seguem o envelope da versão 1: `{ error: { code, message, fields? } }`, com 403 `host_not_allowed` e 415 `json_required`.

| IF | Boundary | Input | Output | Failure | CAP |
|---|---|---|---|---|---|
| IF-001 | `server/routes/reportRoutes.ts` → `src/api/reportApi.ts`: `GET /api/reports/preview`, `POST /api/reports/export`, `POST /api/diagnoses/:id/report` | Seleção `{ kind: "diagnosis", diagnosisId, includeAnswers }`, `{ kind: "evolution", fromId, toId }` ou `{ kind: "portfolio" }` (query no GET, corpo JSON no POST) | Prévia: `ReportDocument { kind, pages: [{ id, title, blocks[] }] }`. Exportar: `{ fileId, fileName, directory }` | 400 `validation_failed`; 404 `diagnosis_not_found`; 409 `diagnosis_not_completed`, `evolution_needs_two`, `evolution_invalid_pair`; 500 `write_failed` sem arquivo nem registro | CAP-ra-report-center, CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report, CAP-ra-pdf-delivery |
| IF-002 | `server/routes/fileRoutes.ts` → `src/api/filesApi.ts`: `POST /api/files/:fileId/open`, `POST /api/files/:fileId/reveal` | Só o id na rota; o corpo é `{}` | 204 | 404 `file_not_found` (registro ausente ou arquivo apagado); 500 `open_failed` com `directory` | CAP-ra-pdf-delivery |
| IF-003 | `server/routes/brandRoutes.ts` → `src/api/brandApi.ts`: `GET/PUT/DELETE /api/brand`, `PUT/DELETE /api/brand/logo`, `GET /api/brand/logo` | PUT `{ name?, phone?, email?, website? }` (mesmo schema para criar e editar); logo `{ mimeType: image/png\|image/jpeg, dataBase64 }` | `Brand { name, phone, email, website, hasLogo, logoUpdatedAt }`; a logo sai como bytes com o tipo | 400 `validation_failed` com `fields`; 422 `logo_invalid`; 413 corpo grande | CAP-ra-brand |
| IF-004 | `shared/**` → frontend, importado como código | Valores digitados, datas, registros | `reportDocument`, `paperPalette`, `confidenceText`, `phone`, `contact`, `dates`, `actionProgress`, `actionProgressOptions`, `diary`, `followUp`, `comparisonCopy` | Funções puras: entrada inválida dá `null` ou erro de campo, nunca exceção, NaN ou Infinity | CAP-ra-report-center, CAP-ra-brand, CAP-ra-action-tracking, CAP-ra-diary, CAP-ra-home-followup |
| IF-005 | `server/routes/actionRoutes.ts` → `src/api/actionsApi.ts`: `GET /api/companies/:id/actions`, `GET /api/diagnoses/:id/actions`, `PATCH /api/diagnoses/:id/actions/:actionKey` | PATCH parcial `{ status?, dueDate? YYYY-MM-DD \| null, ownerRole? \| null, note? ≤ 500 \| null }` | `ActionProgress { diagnosisId, actionKey, status, dueDate, ownerRole, note, overdue, inheritedFrom: { diagnosisId, completedAt } \| null, updatedAt }`; empresa: `{ current: { diagnosisId, completedAt, actions[] } \| null, closed: [{ diagnosisId, completedAt, actions[] }] }`; diagnóstico: `{ isCurrent, actions[] }` | 400 `validation_failed`; 404 `diagnosis_not_found`; 409 `plan_closed` | CAP-ra-action-tracking, CAP-ra-action-inheritance |
| IF-006 | `server/routes/diaryRoutes.ts` → `src/api/diaryApi.ts`: `GET/POST /api/companies/:id/diary`, `PUT/DELETE /api/companies/:id/diary/:month` | `{ month: YYYY-MM, newCustomers, spendParts? \| spendTotalCents? }` (centavos inteiros); no PUT o mês vem só da rota | `{ entries: [{ month, newCustomers, spendParts \| null, spendTotalCents \| null, totalCents, cacCents \| null }], progress: { count, measuredFrom \| null, measuredTo \| null }, chart: [{ month, cacCents \| null }] }` | 400 `validation_failed` com `fields`; 404 `company_not_found`, `diary_month_not_found`; 409 `month_taken` | CAP-ra-diary |
| IF-007 | `server/routes/diagnosisRoutes.ts` → `src/api/diagnosesApi.ts`: as rotas da versão 1 + `POST /api/diagnoses/:id/diary-suggestion` | Patch do calculador também com `spendTotalCents`; marcas do diário nunca vêm do cliente | `Diagnosis` da versão 1 com `calculator.spendTotalCents`, `calculator.diarySource { spend?, newCustomers? }` e `calculator.diarySuggestion \| null` | 409 `diagnosis_not_draft`, `no_diary_suggestion` | CAP-ra-diary-prefill |
| IF-008 | `server/routes/homeRoutes.ts` → `src/api/homeApi.ts`: `GET /api/home` | `mode=owner&companyId=` ou `mode=consultant` | Dono: `{ company, latest?, draft?, reevaluation: { lastAt, dueAt, daysUntil, daysOverdue, intervalDays }, actions: { counts, current[] }, diary: { count, cacCents, measuredFrom, measuredTo }, latestReport?: { fileId, fileName, savedAt } }`, sem `trend`. Consultor: os campos da versão 1 mais `overdueActions[]` e `awaitingQuestionnaires[]` | 400 `validation_failed`; 404 `company_not_found` | CAP-ra-home-followup, CAP-ra-portfolio-report, CAP-ra-remote-questionnaire |
| IF-009 | `server/routes/preferenceRoutes.ts` → `src/api/preferencesApi.ts`: `GET/PUT /api/preferences` | Os campos da versão 1 mais `reevaluationIntervalDays: 60\|90\|120\|180` e `tourSeenVersion` | A visão da versão 1 com os dois campos (padrão 90 e 0) | 400 `validation_failed` | CAP-ra-home-followup |
| IF-010 | `server/routes/companyRoutes.ts` → `src/api/companiesApi.ts`: `GET /api/companies` | Os filtros da versão 1 mais `attention=atrasada\|vencidas\|risco\|aguardando\|rascunhos\|sem-diagnostico` | A lista da versão 1 | 400 `validation_failed` | CAP-ra-home-followup, CAP-ra-remote-questionnaire |
| IF-011 | `server/routes/questionnaireRoutes.ts` → `src/api/questionnaireApi.ts`: `POST /api/companies/:id/questionnaire`, `POST /api/companies/:id/questionnaire-answers`; marca do rascunho no `GET /api/companies/:id/timeline` (`src/api/historyApi.ts`) | Enviar: `{}`. Importar: `{ content: texto do arquivo ≤ 1 MB, replaceDraft? }` | Enviar: `{ fileId, fileName, directory, sentAt, message }`. Importar: `{ draftId, clientSavedAt }`. Linha do tempo: `draft.clientAnswersSavedAt \| null` | 409 `draft_exists` com `draftCreatedAt`; 422 `answers_other_company` com os dois nomes, `answers_newer_version`, `answers_incompatible`, `answers_invalid`; 413 arquivo grande; nada muda em toda falha | CAP-ra-remote-questionnaire |
| IF-012 | `server/routes/backupRoutes.ts` → `src/api/backupApi.ts`: as rotas da versão 1 | Igual à versão 1; importar aceita as versões 1 e 2 | `{ fileName, directory, companies, diagnoses, actions, diaryEntries, questionnaires, brand }`; importar: `{ imported: { ... }, skipped }` | 422 `backup_invalid`, `backup_newer_version`; 500 `write_failed`; nada muda em toda falha | CAP-ra-data-continuity |

## Execution Sequence

| Phase | Wave | Depends on | Files | Scope | Done when |
|---|---|---|---|---|---|
| 1-backend-document | 1 | — | shared/report/reportDocument.ts, shared/report/paperPalette.ts, shared/format/confidenceText.ts, server/report/reportCopy.ts, server/report/documentParts.ts, server/report/reportModel.ts, tests/unit/reportModel.test.ts, tests/unit/confidenceText.test.ts, tests/unit/forbiddenTerms.test.ts | CAP-ra-report-center, CAP-ra-diagnosis-report, CAP-ra-polish; AC-ra-05, AC-ra-09, AC-ra-10, AC-ra-11, AC-ra-23; IF-004 | `pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/confidenceText.test.ts tests/unit/forbiddenTerms.test.ts` passa |
| 1-backend-files | 1 | — | prisma/schema.prisma, prisma/migrations/20261026000000_generated_files/migration.sql, server/repositories/generatedFileRepository.ts, server/files/systemOpener.ts, server/services/fileService.ts, server/routes/fileRoutes.ts, server/app.ts, server/main.ts, src/api/filesApi.ts, tests/api/fileRoutes.test.ts | CAP-ra-pdf-delivery; AC-ra-18; IF-002 | `pnpm exec prisma validate` + `pnpm exec vitest run tests/api/fileRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam |
| 2-backend-brand | 1 | — | shared/format/phone.ts, shared/format/contact.ts, tests/unit/contactFormat.test.ts, server/validation/brandSchemas.ts, server/files/imageSignature.ts, tests/unit/imageSignature.test.ts, server/services/brandService.ts, server/routes/brandRoutes.ts, server/repositories/preferenceRepository.ts, server/services/preferenceService.ts | CAP-ra-brand; AC-ra-21; IF-003, IF-004 | `pnpm exec vitest run tests/unit/contactFormat.test.ts tests/unit/imageSignature.test.ts tests/api/preferenceRoutes.test.ts` passa |
| 6-backend-questionnaire-file | 1 | — | server/questionnaire/questionnaireFile.ts, server/questionnaire/questionnaireClient.js, server/questionnaire/questionnaireStyles.css, tests/unit/questionnaireFile.test.ts, shared/content/questionBank.ts | CAP-ra-remote-questionnaire; AC-ra-49, AC-ra-50; IF-004 | `pnpm exec vitest run tests/unit/questionnaireFile.test.ts` passa e grava `test-results/questionario-exemplo.html` + smoke: teste Q-10 do dono (Gmail, Outlook e WhatsApp; Chrome, Edge, Firefox e Safari) |
| 1-frontend-company-tabs | 1 | — | src/App.tsx, src/features/companies/CompanyPage.tsx, src/features/companies/CompanyTabs.tsx, src/features/companies/CompanyDiagnosesTab.tsx | CAP-ra-report-center; AC-ra-61 | `pnpm typecheck` passa e a aba índice mantém a linha do tempo da versão 1 |
| 1-backend-pdf | 2 | 1-backend-document (dev) | server/report/pdfRenderer.ts, server/report/pdfBlocks.ts, server/report/pdfCharts.ts, tests/unit/pdfRenderer.test.ts | CAP-ra-diagnosis-report; AC-ra-06, AC-ra-07, AC-ra-08 | `pnpm exec vitest run tests/unit/pdfRenderer.test.ts tests/unit/reportModel.test.ts` passa |
| 3-backend-action-domain | 2 | 1-backend-files (dev) | shared/domain/actionProgress.ts, shared/content/actionProgressOptions.ts, shared/format/dates.ts, tests/unit/actionProgress.test.ts, tests/unit/dates.test.ts, prisma/schema.prisma, prisma/migrations/20261026000100_action_progress/migration.sql, server/repositories/actionProgressRepository.ts, shared/domain/actionPlan.ts | CAP-ra-action-tracking, CAP-ra-action-inheritance; AC-ra-31; IF-004 | `pnpm exec prisma validate` + `pnpm exec vitest run tests/unit/actionProgress.test.ts tests/unit/dates.test.ts` + `node scripts/smoke-migrate.mjs` passam |
| 1-backend-report-api | 3 | 1-backend-pdf (dev), 1-backend-files (dev) | server/validation/reportSchemas.ts, server/services/reportService.ts, server/routes/reportRoutes.ts, server/files/downloadsFolder.ts, src/api/reportApi.ts, tests/api/reportRoutes.test.ts | CAP-ra-report-center, CAP-ra-pdf-delivery; AC-ra-17, AC-ra-19; IF-001 | `pnpm exec vitest run tests/api/reportRoutes.test.ts tests/api/fileRoutes.test.ts` passa |
| 4-backend-diary-domain | 3 | 3-backend-action-domain (dev) | shared/domain/diary.ts, tests/unit/diary.test.ts, shared/format/dates.ts, tests/unit/dates.test.ts, shared/domain/types.ts, shared/domain/unitEconomics.ts, shared/domain/completeness.ts, shared/domain/diaryPrefill.ts, tests/unit/unitEconomics.test.ts, tests/unit/diaryPrefill.test.ts | CAP-ra-diary, CAP-ra-diary-prefill; AC-ra-41, AC-ra-44, AC-ra-45; IF-004 | `pnpm exec vitest run tests/unit/diary.test.ts tests/unit/dates.test.ts tests/unit/unitEconomics.test.ts tests/unit/diaryPrefill.test.ts tests/unit/diagnosisRules.test.ts tests/unit/evaluateDiagnosis.test.ts` passa sem mudar as expectativas da versão 1 |
| 1-frontend-report-center | 4 | 1-frontend-company-tabs (dev), 1-backend-document (dev), 1-backend-report-api (dev), 1-backend-files (dev) | src/features/report-center/ReportCenterPage.tsx, src/features/report-center/ReportOptions.tsx, src/features/report-center/ReportPreview.tsx, src/features/report-center/ReportSheet.tsx, src/features/report-center/ReportSheetCharts.tsx, src/features/report-center/useReportPreview.ts, src/features/report-center/ReportDelivery.tsx, src/styles/global.css | CAP-ra-report-center, CAP-ra-pdf-delivery; AC-ra-01, AC-ra-02, AC-ra-03, AC-ra-04, AC-ra-19, AC-ra-58; IF-001, IF-002, IF-004 | `pnpm typecheck` passa e as telas usam só as rotas e campos do IF-001 e do IF-002 |
| 2-backend-brand-reports | 4 | 2-backend-brand (dev), 1-backend-report-api (dev), 1-backend-pdf (dev), 1-backend-files (dev) | server/app.ts, src/api/brandApi.ts, tests/api/brandRoutes.test.ts, server/report/documentParts.ts, server/report/pdfRenderer.ts, server/services/reportService.ts, tests/unit/pdfRenderer.test.ts | CAP-ra-brand; AC-ra-21, AC-ra-22; IF-003 | `pnpm exec vitest run tests/api/brandRoutes.test.ts tests/unit/pdfRenderer.test.ts tests/api/reportRoutes.test.ts` passa |
| 1-frontend-result | 5 | 1-frontend-report-center (dev), 1-backend-document (dev) | src/features/result/ResultPage.tsx, src/features/result/ConfidenceNote.tsx, src/features/result/RiskList.tsx, src/features/result/ExportReportDialog.tsx, src/features/home/OwnerHome.tsx | CAP-ra-polish, CAP-ra-report-center; AC-ra-01, AC-ra-23, AC-ra-24, AC-ra-25; IF-001, IF-004 | `pnpm typecheck` passa e nada importa `ExportReportDialog` |
| 2-backend-evolution | 5 | 2-backend-brand-reports (dev) | server/services/historyService.ts, shared/domain/compareDiagnoses.ts, shared/content/comparisonCopy.ts, server/report/evolutionDocument.ts, server/validation/reportSchemas.ts, server/services/reportService.ts, tests/unit/evolutionDocument.test.ts, tests/fixtures/rulesV2.ts | CAP-ra-evolution-report; AC-ra-12, AC-ra-13; IF-001, IF-004 | `pnpm exec vitest run tests/unit/evolutionDocument.test.ts tests/api/historyRoutes.test.ts tests/api/reportRoutes.test.ts` passa |
| 2-frontend-brand | 5 | 2-backend-brand (dev), 2-backend-brand-reports (dev), 1-frontend-report-center (dev) | src/components/form/PhoneField.tsx, src/features/settings/brandLogoImage.ts, src/features/settings/BrandSection.tsx, src/features/settings/SettingsPage.tsx, src/features/report-center/ReportSheet.tsx, src/components/feedback/ConfirmDialog.tsx | CAP-ra-brand; AC-ra-20, AC-ra-21; IF-003, IF-004 | `pnpm typecheck` passa e a seção usa só o IF-003 |
| 3-backend-actions-api | 5 | 3-backend-action-domain (dev), 2-backend-brand-reports (dev) | server/validation/actionSchemas.ts, server/services/actionService.ts, server/routes/actionRoutes.ts, server/app.ts, src/api/actionsApi.ts, tests/api/actionRoutes.test.ts, server/repositories/diagnosisRepository.ts, server/services/diagnosisService.ts, tests/api/diagnosisRoutes.test.ts | CAP-ra-action-tracking, CAP-ra-action-inheritance; AC-ra-29, AC-ra-31, AC-ra-32; IF-005 | `pnpm exec vitest run tests/api/actionRoutes.test.ts tests/api/diagnosisRoutes.test.ts tests/api/historyRoutes.test.ts tests/api/companyRoutes.test.ts` passa |
| 2-backend-portfolio | 6 | 2-backend-evolution (dev) | shared/domain/followUp.ts, tests/unit/followUp.test.ts, server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/services/homeService.ts, tests/api/homeRoutes.test.ts, server/report/portfolioDocument.ts, tests/unit/portfolioDocument.test.ts, server/services/reportService.ts, tests/unit/forbiddenTerms.test.ts | CAP-ra-portfolio-report, CAP-ra-evolution-report; AC-ra-11, AC-ra-15; IF-001, IF-008 | `pnpm exec vitest run tests/unit/followUp.test.ts tests/unit/portfolioDocument.test.ts tests/unit/forbiddenTerms.test.ts tests/api/homeRoutes.test.ts` passa com a tela do consultor igual |
| 3-frontend-actions | 6 | 3-backend-actions-api (dev), 3-backend-action-domain (dev), 1-frontend-result (dev), 1-frontend-company-tabs (dev) | src/components/form/DateField.tsx, src/components/feedback/UndoNotice.tsx, src/features/actions/useActionStatus.ts, src/features/actions/ActionProgressRow.tsx, src/features/actions/ActionEditDialog.tsx, src/features/actions/CompanyActionsTab.tsx, src/features/companies/CompanyTabs.tsx, src/App.tsx, src/features/result/ActionPlanList.tsx, src/features/result/ResultPage.tsx | CAP-ra-action-tracking; AC-ra-26, AC-ra-27, AC-ra-28, AC-ra-30, AC-ra-63; IF-004, IF-005 | `pnpm typecheck` passa e as telas usam só o IF-005 |
| 4-backend-diary-api | 6 | 4-backend-diary-domain (dev), 3-backend-actions-api (dev), 3-backend-action-domain (dev) | prisma/schema.prisma, prisma/migrations/20261026000200_diary_entries/migration.sql, server/repositories/diaryRepository.ts, server/validation/diarySchemas.ts, server/services/diaryService.ts, server/routes/diaryRoutes.ts, server/app.ts, src/api/diaryApi.ts, tests/api/diaryRoutes.test.ts, shared/content/calculatorOptions.ts | CAP-ra-diary, CAP-ra-diary-prefill; AC-ra-39, AC-ra-43; IF-006 | `pnpm exec vitest run tests/api/diaryRoutes.test.ts tests/api/companyRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam |
| 2-frontend-evolution-portfolio | 7 | 2-backend-evolution (dev), 2-backend-portfolio (dev), 1-frontend-report-center (dev), 3-frontend-actions (dev) | src/features/report-center/ReportOptions.tsx, src/features/history/ComparePage.tsx, src/features/report-center/PortfolioReportPage.tsx, src/features/home/ConsultantHome.tsx, src/App.tsx | CAP-ra-evolution-report, CAP-ra-portfolio-report; AC-ra-12, AC-ra-14, AC-ra-16; IF-001, IF-004 | `pnpm typecheck` passa |
| 3-backend-action-reports | 7 | 3-backend-actions-api (dev), 2-backend-portfolio (dev) | server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/report/portfolioDocument.ts, server/services/reportService.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts, tests/unit/portfolioDocument.test.ts | CAP-ra-action-tracking, CAP-ra-diagnosis-report, CAP-ra-evolution-report, CAP-ra-portfolio-report; AC-ra-05, AC-ra-12, AC-ra-15; IF-001 | `pnpm exec vitest run tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts tests/unit/portfolioDocument.test.ts tests/api/reportRoutes.test.ts tests/api/homeRoutes.test.ts` passa |
| 5-backend-preferences | 7 | 2-backend-brand (dev), 2-backend-portfolio (dev) | server/validation/preferenceSchemas.ts, server/services/preferenceService.ts, src/api/preferencesApi.ts, tests/api/preferenceRoutes.test.ts, shared/domain/followUp.ts, tests/unit/followUp.test.ts | CAP-ra-home-followup; AC-ra-34; IF-004, IF-009 | `pnpm exec vitest run tests/api/preferenceRoutes.test.ts tests/unit/followUp.test.ts` passa |
| 4-backend-diary-prefill | 8 | 4-backend-diary-api (dev), 3-backend-action-reports (dev), 3-backend-actions-api (dev) | server/validation/diagnosisSchemas.ts, server/services/diagnosisService.ts, server/routes/diagnosisRoutes.ts, src/api/diagnosesApi.ts, tests/api/diagnosisRoutes.test.ts, server/report/reportModel.ts, server/report/evolutionDocument.ts, server/services/reportService.ts, tests/unit/reportModel.test.ts, tests/unit/evolutionDocument.test.ts | CAP-ra-diary-prefill, CAP-ra-evolution-report; AC-ra-12, AC-ra-46, AC-ra-47; IF-007 | `pnpm exec vitest run tests/api/diagnosisRoutes.test.ts tests/api/backupRoutes.test.ts tests/unit/reportModel.test.ts tests/unit/evolutionDocument.test.ts` passa |
| 5-backend-home | 8 | 5-backend-preferences (dev), 3-backend-action-reports (dev), 4-backend-diary-api (dev) | server/services/portfolioService.ts, server/services/homeService.ts, src/api/homeApi.ts, tests/api/homeRoutes.test.ts, server/validation/companySchemas.ts, server/services/companyService.ts, server/app.ts, src/api/companiesApi.ts, tests/api/companyRoutes.test.ts | CAP-ra-home-followup; AC-ra-33, AC-ra-35, AC-ra-36; IF-008, IF-010 | `pnpm exec vitest run tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/preferenceRoutes.test.ts` passa |
| 4-frontend-diary | 9 | 4-backend-diary-api (dev), 4-backend-diary-domain (dev), 4-backend-diary-prefill (dev), 3-frontend-actions (dev), 2-frontend-evolution-portfolio (dev) | src/components/form/MonthField.tsx, src/components/form/MoneyField.tsx, src/features/diary/CompanyDiaryTab.tsx, src/features/diary/DiaryMonthForm.tsx, src/features/diary/DiaryCostChart.tsx, src/features/companies/CompanyTabs.tsx, src/App.tsx, src/features/diagnosis/CalculatorBlock.tsx, src/features/result/NumbersSummary.tsx | CAP-ra-diary, CAP-ra-diary-prefill; AC-ra-38, AC-ra-40, AC-ra-41, AC-ra-42, AC-ra-44, AC-ra-46; IF-004, IF-006, IF-007 | `pnpm typecheck` passa e as telas usam só o IF-006 e o IF-007 |
| 5-frontend-owner-home | 10 | 5-backend-home (dev), 5-backend-preferences (dev), 3-frontend-actions (dev), 1-frontend-result (dev), 4-frontend-diary (dev) | src/features/home/OwnerHome.tsx, src/features/home/ReevaluationCountdown.tsx, src/features/home/OwnerFollowUpWidgets.tsx, src/features/home/ScoreTrend.tsx, src/features/actions/ActionProgressRow.tsx, src/features/home/OnboardingTour.tsx | CAP-ra-home-followup; AC-ra-26, AC-ra-33, AC-ra-37; IF-008, IF-009 | `pnpm typecheck` passa e nada importa `ScoreTrend` |
| 5-frontend-consultant-settings | 9 | 5-backend-home (dev), 5-backend-preferences (dev), 2-frontend-evolution-portfolio (dev), 2-frontend-brand (dev) | src/features/home/ConsultantHome.tsx, src/features/companies/CompaniesPage.tsx, src/features/settings/ReevaluationSection.tsx, src/features/settings/SettingsPage.tsx | CAP-ra-home-followup; AC-ra-34, AC-ra-35, AC-ra-62; IF-008, IF-009, IF-010 | `pnpm typecheck` passa |
| 6-backend-questionnaire-api | 9 | 6-backend-questionnaire-file (dev), 5-backend-home (dev), 4-backend-diary-api (dev), 3-backend-actions-api (dev), 2-backend-brand (dev) | prisma/schema.prisma, prisma/migrations/20261026000300_questionnaire_sends/migration.sql, server/validation/questionnaireSchemas.ts, server/repositories/questionnaireRepository.ts, server/repositories/diagnosisRepository.ts, server/services/questionnaireService.ts, server/routes/questionnaireRoutes.ts, server/app.ts, src/api/questionnaireApi.ts, tests/api/questionnaireRoutes.test.ts | CAP-ra-remote-questionnaire; AC-ra-48, AC-ra-51, AC-ra-52, AC-ra-53; IF-011 | `pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/diagnosisRoutes.test.ts` + `node scripts/smoke-migrate.mjs` passam |
| 6-backend-questionnaire-attention | 10 | 6-backend-questionnaire-api (dev), 5-backend-home (dev), 2-backend-evolution (dev) | server/repositories/portfolioRepository.ts, server/services/portfolioService.ts, server/services/historyService.ts, server/validation/companySchemas.ts, src/api/historyApi.ts, tests/api/questionnaireRoutes.test.ts | CAP-ra-remote-questionnaire; AC-ra-35, AC-ra-48, AC-ra-51; IF-008, IF-010, IF-011 | `pnpm exec vitest run tests/api/questionnaireRoutes.test.ts tests/api/homeRoutes.test.ts tests/api/companyRoutes.test.ts tests/api/historyRoutes.test.ts` passa |
| 7-backend-backup | 10 | 6-backend-questionnaire-api (dev), 4-backend-diary-api (dev), 3-backend-actions-api (dev), 5-backend-preferences (dev), 2-backend-brand (dev) | server/validation/backupSchemas.ts, server/services/backupService.ts, src/api/backupApi.ts, tests/api/backupRoutes.test.ts, tests/api/playRoutes.test.ts, server/services/assistantSummaryService.ts, server/routes/playRoutes.ts | CAP-ra-data-continuity; AC-ra-55, AC-ra-56; IF-012 | `pnpm exec vitest run tests/api/backupRoutes.test.ts tests/api/playRoutes.test.ts` passa |
| 7-backend-release | 11 | 6-backend-questionnaire-api (dev), 6-backend-questionnaire-attention (dev), 7-backend-backup (dev) | manifest.json, system.json, package.json, scripts/smoke-migrate.mjs, scripts/smoke-store-package.mjs | CAP-ra-data-continuity; AC-ra-54 | `node scripts/smoke-migrate.mjs` + `node --check scripts/smoke-store-package.mjs` passam |
| 6-frontend-questionnaire | 11 | 6-backend-questionnaire-api (dev), 6-backend-questionnaire-attention (dev), 5-frontend-consultant-settings (dev), 1-frontend-company-tabs (dev) | src/features/questionnaire/SendQuestionnaireDialog.tsx, src/features/questionnaire/ImportAnswersDialog.tsx, src/features/companies/CompanyPage.tsx, src/features/history/CompanyTimeline.tsx, src/features/home/ConsultantHome.tsx, src/features/companies/CompaniesPage.tsx | CAP-ra-remote-questionnaire; AC-ra-48, AC-ra-51, AC-ra-52, AC-ra-53; IF-011 | `pnpm typecheck` passa e os diálogos usam só o IF-011 |
| 7-frontend-backup | 11 | 7-backend-backup (dev) | src/features/settings/BackupSection.tsx | CAP-ra-data-continuity; AC-ra-55; IF-012 | `pnpm typecheck` passa |
| 2-integration-e2e | 12 | — | tests/e2e/support/fixtures.ts, tests/e2e/report.spec.ts, tests/e2e/result.spec.ts, tests/e2e/brand.spec.ts, tests/e2e/portfolioReport.spec.ts, .aioson/plans/relatorios-e-acompanhamento/harness-contract.json | CAP-ra-report-center, CAP-ra-pdf-delivery, CAP-ra-polish, CAP-ra-brand, CAP-ra-evolution-report, CAP-ra-portfolio-report; AC-ra-02, AC-ra-17, AC-ra-18, AC-ra-20, AC-ra-60, AC-ra-61; as demais ACs das CAPs citadas viajam como contexto e são exercitadas pelas specs desta linha | `pnpm build` + `pnpm exec playwright test tests/e2e/report.spec.ts tests/e2e/result.spec.ts tests/e2e/brand.spec.ts tests/e2e/portfolioReport.spec.ts tests/e2e/history.spec.ts` + smoke: no webview do Play no Windows, exportar os três PDFs com marca, "Abrir PDF" e "Mostrar na pasta" |
| 6-integration-e2e | 13 | 2-integration-e2e | tests/e2e/actions.spec.ts, tests/e2e/diary.spec.ts, tests/e2e/calculator.spec.ts, tests/e2e/home.spec.ts, tests/e2e/settings.spec.ts, tests/e2e/companies.spec.ts, tests/e2e/remoteQuestionnaire.spec.ts | CAP-ra-action-tracking, CAP-ra-action-inheritance, CAP-ra-diary, CAP-ra-diary-prefill, CAP-ra-home-followup, CAP-ra-remote-questionnaire; AC-ra-27, AC-ra-31, AC-ra-36, AC-ra-39, AC-ra-49, AC-ra-52; as demais ACs das CAPs citadas viajam como contexto e são exercitadas pelas specs desta linha | `pnpm build` + `pnpm exec playwright test tests/e2e/actions.spec.ts tests/e2e/diary.spec.ts tests/e2e/calculator.spec.ts tests/e2e/home.spec.ts tests/e2e/settings.spec.ts tests/e2e/companies.spec.ts tests/e2e/remoteQuestionnaire.spec.ts tests/e2e/questionnaire.spec.ts tests/e2e/firstRun.spec.ts` + smoke: no Play, concluir um segundo diagnóstico com 3 meses de diário e importar respostas de outro navegador |
| 7-integration-release | 14 | 6-integration-e2e | tests/e2e/backup.spec.ts, tests/e2e/accessibility.spec.ts | CAP-ra-data-continuity, CAP-ra-report-center, CAP-ra-brand, CAP-ra-diary, CAP-ra-home-followup, CAP-ra-remote-questionnaire; AC-ra-54, AC-ra-55, AC-ra-57, AC-ra-58, AC-ra-59, AC-ra-60 | `pnpm build` + `pnpm test` + `pnpm test:e2e` + `node scripts/smoke-migrate.mjs` + `node scripts/smoke-boot.mjs` + `node scripts/smoke-store-package.mjs` + `aioson harness:check . --slug=relatorios-e-acompanhamento` + smoke: update de uma instalação da versão 1 com dados no Play |

## Release notes for the owner

- A ordem das fases segue as 3 partes do PRD:
  - a parte 1 está nas Fases 1 e 2;
  - a parte 2, nas Fases 3, 4 e 5;
  - a parte 3, na Fase 6;
  - a Fase 7 fecha a atualização e a cópia de segurança.
- A Fase 6 começa por um teste que depende de você: mandar o arquivo do questionário por e-mail e WhatsApp e abrir em 4 navegadores. Se falhar, só a parte 3 volta para decisão. As partes 1 e 2 seguem para a loja.
- Nada vai para a loja antes da Fase 7. Se quiser publicar uma parte antes, avise: a parte seguinte precisa subir de novo a versão do banco e da cópia de segurança.
