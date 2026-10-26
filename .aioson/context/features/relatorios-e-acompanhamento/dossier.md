---
feature_slug: relatorios-e-acompanhamento
schema_version: "1.2"
created_by: dossier-init
created_at: 2026-10-24T22:06:19.728Z
status: active
classification: MEDIUM
last_updated_by: dossier-init
last_updated_at: 2026-10-24T22:06:19.728Z
---
## Why


**Dono de pequena empresa.**
- **Quando** termina o diagnóstico e quer mostrar o resultado a um sócio, ao contador ou a um banco, **quero** um documento que pareça sério e se explique sozinho, **para** ser levado a sério sem precisar abrir o app na frente dos outros.
- Hoje, o botão de PDF fica escondido, o arquivo some na pasta Downloads e o documento é uma lista de texto sem resumo nem gráfico.

**Quando** sai do diagnóstico com 3 ações e o número de custo por cliente "não calculado"…
- **quero** ser lembrado do que combinei fazer e ter onde anotar gasto e clientes novos mês a mês;
- **para** chegar ao próximo diagnóstico com números medidos e ver se as ações funcionaram.

Hoje, o app só serve no dia do diagnóstico:
- as ações não têm prazo nem estado;
- nada lembra de refazer o diagnóstico;
- os números continuam desconhecidos 3 meses depois.

Com isso, o próximo diagnóstico repete a mesma trava e o método perde credibilidade.

**Consultor.**
- **Quando** entrega o diagnóstico a um cliente, **quero** um relatório com a minha marca, a evolução desde a última visita e o andamento das ações, **para** justificar o meu trabalho e manter o cliente.
- **Quando** o cliente está longe, **quero** que ele responda o questionário sem eu estar junto, **para** não perder uma reunião só com perguntas.
- Hoje, o consultor:
  - entrega um PDF com a marca FitPulse;
  - não tem relatório de evolução nem visão da carteira em PDF;
  - precisa preencher o questionário junto com o cliente.

**Custo de não fazer.** O FitPulse fica igual aos diagnósticos de disparo único que o PRD anterior quis superar (`researchs/ferramentas-diagnostico-mercado/summary.md` §1.4). É um retrato bonito, não uma ferramenta de acompanhamento.

## What


A direção foi fixada pelo dono: as quatro frentes, com a marca de quem entrega. Abaixo estão a forma recomendada de cada frente e as variações que o @product ainda decide. Nada aqui está aprovado como escopo.

**1. Central de relatórios e PDF profissional**
- **Onde encontrar:**
  - um botão "Relatórios" na página da empresa e no resultado;
  - no modo consultoria, também na tela inicial.
  - O botão "Exportar PDF" continua no resultado.
- **Relatório do diagnóstico, em versão nova:**
  - capa com a marca de quem entrega, a empresa e a data;
  - resumo executivo de 1 página: estágio, trava, 3 ações e o número-chave;
  - gráfico das 8 dimensões (radar ou barras agrupadas por encaixes e frentes);
  - matriz de riscos 5×5 desenhada;
  - números com explicação;
  - andamento das ações, quando houver acompanhamento;
  - apêndice "Como ler este relatório", com o método em linguagem simples;
  - opcional: apêndice com as respostas do questionário.
- **Relatório de evolução:**
  - compara dois diagnósticos da mesma empresa: estágio antes e depois, diferença por dimensão e ações concluídas no período;
  - quando houver diário, mostra a curva do custo por cliente.
- **Relatório da carteira** (modo consultoria):
  - empresas por estágio, data do último diagnóstico, atrasadas para reavaliação, risco alto e ações vencidas.
- **Depois de salvar:**
  - botões "Abrir PDF" e "Mostrar na pasta";
  - escolher a pasta fica como opção a investigar (Q-3).
- **Alternativa considerada:** gerar o PDF pelo "Imprimir" do navegador, a partir de uma página HTML.
  - Ganho: o layout é mais fácil de fazer.
  - Problema: depende do diálogo de impressão do webview do Play, que não foi verificado.
  - Recomendação: manter o gerador atual no servidor (`pdfkit`), que já tem fontes, quebra de página e testes.

**2. Marca de quem entrega**
- Em Configurações → "Seus relatórios": nome de quem entrega, logo (PNG ou JPG), contato livre e cor de destaque opcional.
- Tudo em branco significa a marca FitPulse.
- A marca entra:
  - na capa e no rodapé dos PDFs;
  - na cópia de segurança, para não se perder ao trocar de computador.

**3. Acompanhamento das ações**
- Cada ação do plano de um diagnóstico concluído ganha:
  - estado: a fazer, em andamento, feita ou não se aplica;
  - prazo;
  - responsável (texto livre);
  - nota.
- O resultado do diagnóstico continua imutável. O andamento é um registro separado, ligado ao diagnóstico.
- **Tela inicial do dono:** ações vencidas e "faltam N dias para refazer o diagnóstico". O intervalo é configurável, com 90 dias como padrão.
- **Tela inicial do consultor:** ganha "ações vencidas" na carteira.
- O lembrete aparece dentro do app; um aviso do sistema operacional depende do Play (Q-5).
- **Variação para o @product:** permitir que o usuário acrescente ações próprias além das 3 (Q-7).

**4. Diário de números**
- Por empresa, um registro por mês:
  - gasto para atrair clientes;
  - clientes novos;
  - opcional: origem dos clientes (por canal), que conversa com a ação "Anotar a origem de cada cliente".
- **O app mostra:**
  - o custo por cliente de cada mês;
  - a tendência;
  - o aviso "faltam N meses para ter um número medido".
- **No próximo diagnóstico:**
  - o bloco "Seus números" já vem preenchido com a média do diário e marcado como **medido**;
  - o usuário pode corrigir.
  - A regra de quantos meses contam como medido fica para Q-8.
- **Alternativa considerada:** importar planilha.
  - Recomendação: não importar no começo, porque o público é leigo e o formato da planilha varia.

**5. Questionário à distância**
- **Forma recomendada (B):**
  1. O consultor gera um **arquivo de questionário** da empresa: um HTML único, que abre em qualquer navegador sem instalar nada.
  2. O cliente responde com a mesma ajuda e a mesma opção "não sei".
  3. Ao terminar, o HTML gera um **arquivo de respostas**, que o cliente devolve por WhatsApp ou e-mail. O app não envia nada.
  4. O consultor importa o arquivo, que vira um rascunho da empresa para revisar e concluir.
- **Alternativas consideradas:**
  - (A) O cliente instala o Play e o FitPulse e exporta as respostas. É mais simples de construir, mas exige instalação do cliente, que é leigo.
  - (C) Questionário em PDF para imprimir, com o consultor digitando as respostas. Não precisa de tecnologia nenhuma, mas é trabalho manual e tem erro de digitação.
- A escolha é do @product com o dono (Q-9). Os riscos de B estão em `## Risks`.

**6. Acabamento** (defeitos vistos na inspeção, independentes das frentes acima)
- "1 de 26 item sem o número" → "itens".
- Na lista de riscos da tela de resultado, "Probabilidade 4 de 5" quebra em várias linhas na coluna estreita.
- O botão "Exportar PDF" precisa de mais destaque e de uma confirmação visível de onde o arquivo foi parar.

**Fatiamento sugerido** (o @product ou o @planner decide):

| Fatia | Conteúdo |
|---|---|
| 1 | Relatórios + marca + acabamento |
| 2 | Acompanhamento das ações + diário de números |
| 3 | Questionário à distância |

Cada fatia é utilizável sozinha.

## Code Map

```yaml
files: []
modules: []
patterns: []
```

## Rules & Design-Docs aplicáveis

_(vazio — populado a partir da Phase 2)_

## Agent Trail

_(vazio — populado a partir da Phase 2)_

<!-- sha256:ba7dd48ecf7045b944285a8766a4b528d78fb7b0984e3f60d92d07359a4de415 -->
**2026-10-24T22:06:19.733Z** | @briefing | _Agent Trail_

Briefing created: 6 themes, 10 risks, 14 open questions

<!-- sha256:c4d3b36ea473ebe5188b4cd4ea172175aff49601857daf4df8ce743c28ec3644 -->
**2026-10-25T02:54:59.147Z** | @product | _Agent Trail_

PRD: .aioson/context/prd-relatorios-e-acompanhamento.md; resultado: relatórios profissionais (diagnóstico, evolução, carteira) com marca e Abrir PDF + acompanhamento entre diagnósticos (ações com herança, lembrete, diário que torna o custo medido) + questionário à distância (forma B), em 3 partes (F10); deferidos: origem por canal no diário, CSV da carteira, ações próprias, diário pelo arquivo, plano por IA; benchmark rejeitado; 14 CAPs required, 62 ACs, 12 regras, 20 ramificações; desvios do protótipo: Como ler corrige a regra do estágio (OBS-9d1a49), diário preenche a soma de 3 meses; Conteúdo v2 aprovado pelo dono; classificação MEDIUM

<!-- sha256:3817c6556118faf3fed792dce7f0774459ab0cedf3bee9e062971170e0e63892 -->
**2026-10-25T02:58:05.292Z** | @sheldon | _Agent Trail_

PRD enriched in place; value delta: estado vazio da aba Ações (AC-ra-63), data local para vencidas/reavaliação, logo conferida pelo conteúdo, AAAA-MM-DD nos arquivos, parte 1 utilizável sem dados da parte 2, Exportar PDF direto no resultado, filtros de atenção com vazio, total único no preenchimento pelo diário; opportunity disposition: nenhuma ampliação de escopo (revisão enxuta a pedido do dono); acceptance criteria closed: 63 ACs; prototype deviations: explícitas (6); remaining risks: Q-10 antes da parte 3, OQ-ra-1 abrir PDF no webview, OQ-ra-3 diário antigo

<!-- sha256:0ae8ca868bf355937cc2e51ae2caeaaae2414a2688a82d6bec80a8e043305474 -->
**2026-10-25T19:04:17.194Z** | @planner | _Code Map_

Plan: .aioson/context/implementation-plan-relatorios-e-acompanhamento.md; production entry: pnpm dev/start (tsx server/main.ts + vite, 127.0.0.1); 7 vertical phases (P1 central+PDF diagnóstico, P2 marca+evolução+carteira, P3 ações, P4 diário, P5 tela inicial, P6 questionário Q-10 primeiro, P7 continuidade); orquestrado em 35 unidades / 14 ondas; Gate C bloqueado só por CAP-ra-benchmark=rejected no PRD

<!-- sha256:848dbb3496717cf9708f48e798a281c2e5b959e95f31bfec5b734c8b1f043d60 -->
**2026-10-25T19:42:21.033Z** | @sheldon | _Agent Trail_

Rodada curta de reparo: CAP-ra-benchmark rejected→not_applicable (desbloqueia o Gate C); o tour novo passou da parte 1 para a parte 2, alinhado à AC-ra-37; nenhuma mudança de AC, escopo funcional ou desvio do protótipo; risco restante: Q-10 (parte 3)

<!-- sha256:d494b5083520b0d4c1ed5e53f9bc6ceb609a810ca09db69d64b25ffecd1b2925 -->
**2026-10-25T22:39:28.411Z** | @planner | _Code Map_

Plan rebound to PRD sha 989df7e3 after Sheldon round 2; Gate C approved. No plan content changed: the new tour already sits in Phase 5, and CAP-ra-benchmark (not_applicable) was never planned.

<!-- sha256:39f8374bb4c4ff2a49ad60b9d304871e9649fe5151104fff51a23aaf80964e65 -->
**2026-10-25T22:49:03.757Z** | @dev | _Agent Trail_

Orchestrated run preflight: 4 role signatures renewed by owner (valid to 2026-10-26T22:44Z); execution:compile ok (35 units / 14 waves / 2 lanes + 3 integration rows); execution:run --preflight ready; warning unit_spans_surfaces on 6-backend-questionnaire-file (CSS file read at runtime by server, kept in backend lane by plan); focused checks per unit per Execution Sequence; production smoke at integration rows (pnpm build + e2e + Play dev-link)

<!-- sha256:177b8bebf9ac2971ab0dfc431d073ec3d3f3302c16fbc6909324bcacb9aca16c -->
**2026-10-26T00:56:24.802Z** | @dev | _Agent Trail_

Integration follow-ups from lane QA (to close after the run, outside lane write paths): (1) pnpm typecheck red until 5-frontend-owner-home removes HomeTrendPoint/trend + ScoreTrend.tsx — recheck after wave 10; (2) AC-ra-46: ResultPage.tsx:314 must pass calculator={diagnosis.calculator} to NumbersSummary (origin 'do diário, medido'); (3) companies.spec.ts strict-mode duplicate 'Limpar filtros' in CompaniesPage.tsx; (4) 'Usar o diário' vs in-flight autosave PATCH may drop diary marks — verify useDraftAutosave; (5) OnboardingTour consultant step still says 'mais de 90 dias' (sent to owner-home unit)

<!-- sha256:573476cf9d580f73f237d96402e178d267c6cceefa2cdbf58adc7dcf1d660bc3 -->
**2026-10-26T01:25:14.515Z** | @dev | _Agent Trail_

Integration repair (engine paused by killing pid 46884 after a contract-repair loop: phase-2-frontend-brand reworked twice for a cross-unit rename it could not own). Deviation: src/features/reports/ renamed to src/features/report-center/ because the aioson packager (store-system.js DEV_ONLY_DIRS) drops any folder named 'reports' at any depth, which broke the store build (AC-ra-54); importers updated in src/App.tsx, src/features/result/ResultPage.tsx, src/features/settings/BrandSection.tsx. Integration gap closed: src/App.tsx now routes empresa/:companyId/relatorios -> ReportCenterPage (the tab existed but no unit owned the route; AC-ra-01). AC-ra-46: ResultPage passes calculator to NumbersSummary. Verification: tsc --noEmit exit 0; vitest reportModel+pdfRenderer+reportRoutes 157/157. Note: Play preview on port 3543 holds data/fitpulse.db, so plain pnpm scripts hit 'database is locked' in verify-deps postinstall; run tsc/vitest binaries directly.

<!-- sha256:94c8a2e92d7018aae269b0ad7bb24e04eff76706895a429a005f7df58bba1df4 -->
**2026-10-26T03:32:26.585Z** | @dev | _Agent Trail_

Integration repair #2 (engine paused, pid 30352 killed): integration-supervisor looped BLOCKED x3 because tests/e2e/firstRun.spec.ts (still asserting the v1 tour) is in no unit's write paths. Applied the supervisor's verified patch: firstRun.spec.ts now asserts AC-ra-37 (5 prototype steps, step 1 on #/empresa/:id/relatorios, skip keeps the page, '?' reopens on step 1, one tour for both modes). Verification: playwright full suite (fresh-db + main) 91/91 passed in 4.6 min. Supervisor-fixed defects carried: portfolio selection in reportSchemas, evolution wiring in ReportCenterPage, rules passed to createReportService, e2e fixtures for part 2.

<!-- sha256:6033e6fe34d30c66e10335389b63fde43bf57c7393f9d15b35086edc0b742184 -->
**2026-10-26T04:44:08.643Z** | @dev | _Agent Trail_

Implemented all 14 required CAPs (CAP-ra-report-center, diagnosis-report, pdf-delivery, polish, brand, evolution-report, portfolio-report, action-tracking, action-inheritance, diary, diary-prefill, home-followup, remote-questionnaire, data-continuity) via orchestrated run 1ccec491 (36/36 units, QA PASS) + DEV integration repairs. Final DEV edits: AC citations added to existing test titles (AC-ra-03/05/09/10/25/29/43/56/57/62); CalculatorBlock flushes pending saves before 'Usar o diário' (precaution for the QA question; the loss could not be reproduced even without it) + e2e 'a number typed just before Usar o diário'. Verification: harness:check 6/6 (RG-build, RG-migrate, RG-boot, RG-smoke e2e with --timeout=600000, C-unit, C-package); ac:test-audit --strict PASS (63/63); playwright full suite 91/91 earlier + calculator/questionnaire 15/15 after the last edit; tsc 0. Production smoke: smoke-boot on Play ports + smoke-store-package 8/8 (0.1.0 with data -> 0.2.0). Pending manual (owner/QA): Q-10 in Gmail/Outlook/WhatsApp + Chrome/Edge/Firefox; Abrir PDF/Mostrar na pasta in the Play webview (OQ-ra-1); grayscale print; real Play update with data. Deviations: src/features/report-center (packager drops 'reports'); RG-smoke needs harness --timeout=600000. Run cost ~US$107 reported (owner flagged as wasteful).

## Revision Requests

_(vazio — populado a partir da Phase 2)_
