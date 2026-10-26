---
feature: diagnostico-maturidade
classification: MEDIUM
feature_completeness: required
product_scope: approved
prd_ready: approved
sheldon_review: approved
prototype: .aioson/briefings/diagnostico-maturidade/prototype.html
prototype_status: current
prototype_feature: diagnostico-maturidade
identity: .aioson/briefings/diagnostico-maturidade/identity.md
identity_status: current
---

# PRD — FitPulse: diagnóstico de maturidade de crescimento

## Vision

O dono de uma pequena empresa instala o FitPulse pela loja do AIOSON Play e, em cerca de 12 minutos de perguntas em linguagem simples, descobre:
- em qual dos 4 estágios de crescimento o negócio está;
- qual dimensão impede o próximo estágio (a **trava**);
- quanto custa conquistar um cliente e quanto ele deixa;
- quais 3 ações atacam a trava nos próximos 30 dias.

Meses depois, ele refaz o diagnóstico e vê, dimensão por dimensão, se avançou. O consultor usa o mesmo app para manter uma carteira de empresas com o estágio e a evolução de cada uma. Tudo fica no computador de quem usa, sem login, sem funil de venda e sem servidor externo.

## Problem and users

**Problema.** O dono de pequena empresa decide quanto gastar com anúncio, agência ou vendedor sem saber quanto custa conquistar um cliente (CAC) nem quanto um cliente deixa ao longo do tempo (LTV). Ele acelera como se estivesse em escala e se descapitaliza.
- Os diagnósticos gratuitos que existem dão uma nota de uma vez só e terminam num contato comercial.
- A autoavaliação em nota livre é otimista e não tem relação com o desempenho (`researchs/growth-frameworks-diagnostico/summary.md` §5.5).

**Usuários.**

| Usuário | Situação | Progresso desejado | Contorno atual |
|---|---|---|---|
| Dono de pequena empresa (primário) | Vai decidir o próximo gasto com marketing ou vendas e não tem números | Saber em que estágio está, o que trava e o que fazer agora; ver a evolução depois | Intuição, conselho de quem vende mídia, quizzes de captação de lead |
| Consultor que atende várias pequenas empresas (secundário) | Aplica diagnósticos em vários clientes | Usar a mesma régua em todos, ver a carteira por estágio e mostrar a evolução ao cliente | Planilhas próprias, diagnóstico refeito do zero, sem série histórica |

**Fora do público do V1:** equipes com vários operadores na mesma instalação (não há login nem papéis).

## Feature Capability Map

| CAP | Promised outcome | Actor / trigger | Scope decision | Rationale |
|---|---|---|---|---|
| CAP-dm-first-run | Quem abre o app pela primeira vez escolhe o uso (minha empresa / consultoria), cadastra a empresa e cai no primeiro diagnóstico, sem nenhuma configuração técnica; o tour explica a tela inicial | Dono ou consultor abre o app recém-instalado | required | PROM-018, PROM-021, PROM-024; decisão do dono sobre o wizard |
| CAP-dm-company | O usuário cria, lista, busca, filtra por estágio, edita, arquiva, restaura e exclui empresas, cada uma com o seu histórico | Usuário em "Empresas" ou na página da empresa | required | PROM-012, PROM-019, PROM-020; regra `crud-surface-integrity` |
| CAP-dm-questionnaire | O usuário responde um questionário de 8 blocos com respostas descritivas, ajuda em cada pergunta, "não sei" só em fatos e salvamento automático. Pode retomar, descartar o rascunho, começar a partir do diagnóstico anterior e concluir num portão de confirmação | Usuário inicia ou continua um diagnóstico | required | PROM-007, PROM-013, PROM-024; decisões F1 e F2 |
| CAP-dm-unit-economics | A partir de gastos, clientes novos, ticket, frequência, tempo de relacionamento e margem, o app calcula custo por cliente (CAC), lucro por cliente (LTV), a relação entre os dois e o tempo para o cliente se pagar, explicando cada número | Usuário preenche o bloco "Seus números" | required | PROM-002, PROM-024; decisão F7 |
| CAP-dm-engine | Um motor determinístico calcula a nota de 0 a 100 de cada uma das 8 dimensões, o estágio pela trava das dimensões críticas, até 5 riscos por sinais numa matriz 5×5, a confiança nos dados e um plano de 3 ações. A versão das regras fica gravada e o resultado é imutável depois de concluído | Usuário conclui o diagnóstico | required | PROM-001 a PROM-006; decisões F1, F4, F6, F10 e F13 |
| CAP-dm-result | O resultado mostra primeiro o estágio, a trava e as 3 ações; abaixo vêm os detalhes (encaixes, frentes, números, riscos, confiança) e o aviso de orientação | Usuário termina o diagnóstico ou abre um concluído | required | PROM-014; decisões F8 e F13 |
| CAP-dm-history | Cada empresa tem uma linha do tempo com rascunho, concluídos e arquivados. A comparação com o diagnóstico anterior mostra a mudança de estágio e as diferenças por dimensão, recalculando o anterior quando as regras mudaram | Usuário abre a empresa ou o resultado | required | PROM-012, PROM-020, PROM-022; decisão F10 |
| CAP-dm-home | A tela inicial orienta a próxima decisão. No modo empresa: escada com trava, 3 ações, rascunho em andamento e evolução. No modo consultoria: carteira por estágio, rascunhos parados, empresas sem diagnóstico há mais de 90 dias e com risco alto. Cada indicador leva à lista filtrada | Usuário abre o app | required | PROM-012, PROM-019; regra `management-home-widgets` |
| CAP-dm-report | O usuário exporta o resultado como relatório PDF salvo no computador | Botão "Exportar PDF" no resultado | required | Decisão F7 (PDF) |
| CAP-dm-backup | O usuário exporta todos os dados para um arquivo e importa uma cópia sem apagar o que existe. Uma cópia de versão mais nova é recusada sem alterar nada | Configurações → Cópia de segurança | required | PROM-022 (troca de computador, segurança dos dados) |
| CAP-dm-settings | O usuário troca o modo de uso, a empresa em foco e o tema (escuro ou claro), lê como interpretar os resultados e vê o que o assistente do Play pode ler | Configurações | required | PROM-019, PROM-024; identidade visual |
| CAP-dm-play-runtime | O app roda dentro do AIOSON Play: instala e atualiza pela loja sem perder dados, não pede login, escuta só no próprio computador e informa ao Play só a saúde e o resumo do último diagnóstico de cada empresa | Play instala, inicia ou atualiza o app; assistente do Play consulta | required | PROM-008, PROM-016, PROM-018, PROM-021, PROM-022, PROM-023; decisão F9; contrato Play em `CLAUDE.md` |
| CAP-dm-file-bridge | Exportar as respostas no Play do cliente e importar no Play do consultor | Consultor e cliente | deferred | Não selecionada em F7; candidata a uma versão seguinte |
| CAP-dm-action-tracking | Marcar ações do plano como feitas e receber lembrete de reavaliação | Usuário | deferred | Não selecionadas em F7 |
| CAP-dm-benchmark | Comparar com outras empresas do mesmo segmento | Usuário | deferred | Exige dados agregados entre instalações (nuvem); fora do modelo local |
| CAP-dm-ai-plan | Plano de ação escrito por IA | Usuário | deferred | PROM-010; só depois de calibrar as regras determinísticas |

## Source Coverage

| Promise | Product decision | CAP / AC | Evidence / rationale |
|---|---|---|---|
| PROM-001 | required | CAP-dm-engine, CAP-dm-result / AC-dm-20, AC-dm-28 | SRC-001 §2 e RF-04. Estágios com nomes próprios (F2) e regra de trava (F4) |
| PROM-002 | required | CAP-dm-engine, CAP-dm-unit-economics / AC-dm-21, AC-dm-15 | SRC-001 RF-01. Sem custo de cliente conhecido, a empresa fica no estágio 1 com a trava "descobrir quanto custa cada cliente novo" |
| PROM-003 | required | CAP-dm-engine / AC-dm-18 | SRC-001 §2. Fits calculados de perguntas descritivas (F1), definidos como encaixes entre pares (Q-3 resolvida aqui com a recomendação da pesquisa) |
| PROM-004 | required | CAP-dm-engine / AC-dm-18 | SRC-001 RF-03. Pilares renomeados para Aquisição, Engajamento, Conversão e Retenção (F2), calculados de perguntas (F1) |
| PROM-005 | required | CAP-dm-engine / AC-dm-23, AC-dm-24 | SRC-001 RF-05. Matriz 5×5 por sinais com alerta em ≥ 16 e mitigação por risco (F6) |
| PROM-006 | required | CAP-dm-engine, CAP-dm-result / AC-dm-25, AC-dm-26 | SRC-001 RF-06. Plano priorizado pela trava e pelas dimensões mais fracas; etapas de pesquisa descritas pela função (F2) |
| PROM-007 | required | CAP-dm-questionnaire, CAP-dm-company / AC-dm-08, AC-dm-12, AC-dm-14 | SRC-001 RF-01/RF-07. Validação por campo, máscaras e alerta de respostas faltando |
| PROM-008 | required | CAP-dm-play-runtime / AC-dm-41, AC-dm-42 | SRC-001 §5. A API HTTP do app atende a interface. Para o Play são expostos só a saúde e a leitura do resumo (F9); o cálculo pelo assistente não é exposto |
| PROM-009 | not_applicable | — | O runtime serverless `handler(context)` não existe no Play (M-01). O cálculo vira lógica de domínio chamada pelo backend do app; o tempo máximo de 3000 ms vira meta (AC-dm-27) |
| PROM-010 | deferred | CAP-dm-ai-plan | Plano por IA só depois de calibrar as regras determinísticas (briefing Q-24) |
| PROM-011 | not_applicable | — | Decisão do dono: app independente, sem dados proprietários da V4 |
| PROM-012 | required | CAP-dm-company, CAP-dm-home, CAP-dm-history / AC-dm-09, AC-dm-34, AC-dm-35 | SRC-001 §1. Pré-venda, kickoff e auditoria de carteira atendidos pelo modo consultoria e pelo histórico |
| PROM-013 | required | CAP-dm-first-run, CAP-dm-questionnaire, CAP-dm-result / AC-dm-02, AC-dm-16 | SRC-001 §6. Jornada: assistente → questionário → resultado |
| PROM-014 | required | CAP-dm-result, CAP-dm-report / AC-dm-28, AC-dm-36 | SRC-001 §6. Painel em camadas (F8); o wireframe do PRD técnico é substituído pelo protótipo aprovado |
| PROM-015 | not_applicable | — | Contexto de mercado, não comportamento do app |
| PROM-016 | required | CAP-dm-play-runtime / AC-dm-43 | SRC-002. Nome "FitPulse" (F3); "V-Stage" não aparece na interface |
| PROM-017 | required | CAP-dm-engine, CAP-dm-result / AC-dm-29 | Decisão do dono: independente, sem termos V1–V4, Método V4, PPA, CREP ou "vacinas" |
| PROM-018 | required | CAP-dm-play-runtime, CAP-dm-first-run / AC-dm-01, AC-dm-44 | Decisão do dono: instalação pela loja e uso sozinho |
| PROM-019 | required | CAP-dm-home, CAP-dm-settings, CAP-dm-company / AC-dm-34, AC-dm-38 | Decisão do dono: consultores também usam |
| PROM-020 | required | CAP-dm-history / AC-dm-30, AC-dm-31 | Decisão do dono: histórico por empresa |
| PROM-021 | required | CAP-dm-first-run, CAP-dm-play-runtime / AC-dm-01, AC-dm-02, AC-dm-44 | Pedido do dono: instalação automática e wizard que realmente funcione |
| PROM-022 | required | CAP-dm-play-runtime, CAP-dm-engine, CAP-dm-backup / AC-dm-45, AC-dm-22, AC-dm-37 | Pedido do dono: update sem perder dados; versão das regras gravada (F10) |
| PROM-023 | required | CAP-dm-play-runtime / AC-dm-40 | Decisão do dono: sem aioson-auth, sem tela de login |
| PROM-024 | required | CAP-dm-first-run, CAP-dm-questionnaire, CAP-dm-unit-economics / AC-dm-03, AC-dm-11, AC-dm-15, AC-dm-47 | Pedido do dono: acessível a pequenas empresas (linguagem simples, ajuda, "não sei", calculadora, tour) |

**Decisões da revisão aprovada** (`refinement-feedback.applied-round1.json`, rodada 1, `binding`):

| Decisão | Seleção | Onde está |
|---|---|---|
| F1 | ancoras-calculadas | Business Rules RULE-dm-01, RULE-dm-02; Conteúdo metodológico |
| F2 | nomes-proprios | RULE-dm-14; Conteúdo metodológico; AC-dm-29 |
| F3 | fitpulse | AC-dm-43 |
| F4 | trava-dimensoes-criticas | RULE-dm-04, RULE-dm-05; AC-dm-20 |
| F5 | product-rascunha-dono-aprova | Conteúdo metodológico v1, rascunhado pelo @product e aprovado pelo dono em 2026-10-22 (OQ-1 resolvida) |
| F6 | 5x5-por-sinais | RULE-dm-07; AC-dm-23 |
| F7 | calculadora-cac-ltv + relatorio-pdf | CAP-dm-unit-economics, CAP-dm-report; demais opcionais deferidos |
| F8 | resultado-em-camadas | CAP-dm-result; AC-dm-28 |
| F9 | leitura-resumo | AC-dm-41, AC-dm-42 |
| F10 | recalcular-preservar | RULE-dm-11; AC-dm-31 |
| F11 | gratuito-validar | Out of scope (sem cobrança, sem licença no V1) |
| F12 | aceitar-medium | Frontmatter `classification` |
| F13 | recomendação legada aceita | RULE-dm-10; AC-dm-26, AC-dm-28 |
| F14 | identity-intent, **superada** | Depois da rodada, o dono escolheu explicitamente as referências do design system do ecossistema. A decisão está em `prototype-manifest.md` § Design system decision, e a identidade vinculada é `identity.md` (`source: references`) |

## Current System Fit

| CAP | Existing behavior / evidence | Fit decision | Required product delta |
|---|---|---|---|
| CAP-dm-first-run | Repositório inspecionado em 2026-10-22 (`.aioson/context/project.context.md` com a stack prevista): só existe `manifest.json` (stub `{slug, name, version, description}`), sem `package.json`, `src/` ou interface. Nenhum fluxo de primeiro uso existe | new | Criar o assistente de primeiro uso e o tour |
| CAP-dm-company | Inspecionados `manifest.json` (stub, `systems: []`) , a raiz do repositório e `.aioson/context/project.context.md` (stack prevista, sem código): nenhuma entidade de empresa nem persistência (sem `package.json`, sem banco) | new | Criar a gestão de empresas com histórico |
| CAP-dm-questionnaire | Inspecionados `manifest.json` e `plans/plano-de-desenvolvimento-inicial.md` (L160–319): só um payload JSON único descrito, nenhum formulário implementado | new | Criar o questionário em blocos com rascunho persistido |
| CAP-dm-unit-economics | `plans/plano-de-desenvolvimento-inicial.md` (L205–212) recebe `cac_value`/`ltv_value` prontos e não calcula nada; `manifest.json` sem código associado | new | Criar a calculadora a partir de entradas simples |
| CAP-dm-engine | `plans/plano-de-desenvolvimento-inicial.md` (L439–655): handler de exemplo com as contradições M-06 a M-27 de `.aioson/briefings/diagnostico-maturidade/motor-de-diagnostico.md`, nunca implementado no repositório | new | Implementar as regras deste PRD; o handler de exemplo não é reaproveitado |
| CAP-dm-result | `plans/plano-de-desenvolvimento-inicial.md` (L686–741): só um wireframe ASCII, substituído pelo protótipo aprovado; nenhuma tela no repositório (`manifest.json` stub) | new | Criar o resultado em camadas conforme o protótipo |
| CAP-dm-history | `plans/plano-de-desenvolvimento-inicial.md` (L16): operação stateless (M-02); nenhum histórico no repositório (`manifest.json` stub) | new | Criar a linha do tempo e a comparação |
| CAP-dm-home | Inspecionados `manifest.json` , a raiz do repositório e `.aioson/context/project.context.md` (stack prevista, sem código): nenhuma tela inicial existe | new | Criar a tela inicial por modo |
| CAP-dm-report | Inspecionados `manifest.json` e `plans/plano-de-desenvolvimento-inicial.md`: nenhuma exportação descrita nem implementada | new | Criar a exportação em PDF |
| CAP-dm-backup | Inspecionados `manifest.json` , a raiz do repositório e `.aioson/context/project.context.md` (stack prevista, sem código): nenhuma exportação ou importação de dados existe | new | Criar a cópia de segurança |
| CAP-dm-settings | Inspecionados `manifest.json` , a raiz do repositório e `.aioson/context/project.context.md` (stack prevista, sem código): nenhuma tela de configurações existe | new | Criar as configurações |
| CAP-dm-play-runtime | `manifest.json` é stub, sem `runtime`, `processes`, `has_api` ou `compatibility`; `.aioson/context/project.context.md` fixa Express + React (Vite) split-stack, SQLite via Prisma 7, sem aioson-auth e bind em `127.0.0.1` | new | Declarar o contrato do Play e implementar a rota `GET /api/aioson-play` |

## MVP scope

**Core (sem isso o produto não existe):**
- assistente de primeiro uso e tour;
- gestão de empresas;
- questionário com rascunho, retomada, descarte e conclusão;
- calculadora de unidade econômica;
- motor versionado;
- resultado em camadas com aviso de orientação;
- configurações essenciais;
- contrato com o Play (instalação, atualização, sem login, `127.0.0.1`, `/api/aioson-play`).

**Também no V1 (Recommended MVP aceito no refinamento):**
- comparação com o diagnóstico anterior;
- tela inicial de decisão nos dois modos;
- relatório PDF;
- cópia de segurança;
- tema escuro e claro.

## Out of scope

| Item | Motivo |
|---|---|
| Troca de respostas por arquivo entre Plays (CAP-dm-file-bridge) | Não selecionada em F7 |
| Marcar ações como feitas e lembrete de reavaliação (CAP-dm-action-tracking) | Não selecionadas em F7 |
| Benchmark entre empresas de instalações diferentes (CAP-dm-benchmark) | Exige nuvem e tratamento de privacidade |
| Plano escrito por IA (CAP-dm-ai-plan) | Depois da calibração das regras |
| Check-in mensal de números e gráficos financeiros | V2 (briefing, Option C) |
| Espaço de trabalho para executar as etapas de pesquisa (persona, concorrentes etc.) | V2; o V1 só recomenda as etapas |
| Login, vários operadores, papéis e permissões | Decisão do dono: sem aioson-auth |
| Cobrança, licença, versão paga | Decisão F11: V1 gratuito |
| Dados pessoais de contato (nome, e-mail ou telefone de pessoas) | Coleta mínima (LGPD): o V1 guarda só dados da empresa |
| Marca do consultor no PDF | Não selecionada em F7 |
| Qualquer termo, marca ou material da V4 Company | Decisão do dono: app independente |
| "Recomeçar do zero" e os dados de demonstração do protótipo | Recursos só do protótipo |

## User flows

**F-01 — Primeiro uso (dono).**
1. O Play instala o app pela loja e o abre.
2. Sem empresas cadastradas, o app mostra "Vamos descobrir em que degrau a sua empresa está".
3. O usuário escolhe "Para a minha empresa".
4. Preenche nome, segmento e como vende. Faturamento e CNPJ são opcionais.
5. Clica em "Começar o diagnóstico" e cai no bloco "Seus números".

- **Falha:** campo obrigatório vazio mostra erro no próprio campo; CNPJ com dígito verificador errado mostra "CNPJ inválido. Formato: 00.000.000/0000-00.". O envio não acontece.
- **Recuperação:** corrigir o campo limpa o erro dele.

**F-02 — Responder o diagnóstico.**
1. O usuário percorre os 8 blocos. Cada resposta é salva na hora ("Salvo automaticamente às HH:MM").
2. Pode sair e voltar dias depois para o mesmo ponto.
3. No último bloco, clica em "Ver meu resultado".
4. Se faltam respostas, aparece um alerta com os blocos pendentes e links para eles, e nada é concluído.
5. Se está completo, abre a confirmação "Concluir o diagnóstico?", em ouro (portão).
6. Confirmar mostra "Calculando o seu diagnóstico" e depois o resultado. Cancelar mantém o rascunho.

**F-03 — Ler o resultado.**
1. No topo: a escada com o estágio, o degrau anterior tracejado, o cadeado no próximo degrau, a trava em uma frase e as 3 ações.
2. Abaixo: encaixes, frentes, números, riscos (ou "Nenhum risco encontrado nas suas respostas") e a confiança nos dados.
3. "Exportar PDF" gera o relatório.

**F-04 — Voltar meses depois.**
1. Na empresa, "Novo diagnóstico" cria um rascunho já preenchido com as respostas e os valores da calculadora do último concluído.
2. O usuário muda só o que mudou e conclui.
3. "Comparar com {mês}" mostra a mudança de estágio, as diferenças por dimensão e os riscos resolvidos e novos.
4. Se o anterior foi calculado com outras regras, um aviso explica que ele foi recalculado e qual número vale.

- Se já existe um rascunho, o app oferece "Continuar diagnóstico" em vez de criar outro.

**F-05 — Consultor.**
1. No assistente ou em Configurações, escolhe "Consultoria".
2. A tela inicial mostra a carteira por estágio. Tocar num degrau abre a lista filtrada.
3. As listas de atenção (rascunhos parados há mais de 7 dias, sem diagnóstico há mais de 90 dias, com risco alto) levam às empresas.
4. Arquivar uma empresa pede confirmação e a tira da carteira sem apagar o histórico.
5. Excluir só é possível para empresa arquivada e apaga a empresa com os seus diagnósticos, depois de uma confirmação destrutiva.

**F-06 — Cópia de segurança.**
1. Em Configurações, "Exportar meus dados" salva um arquivo com todas as empresas e diagnósticos.
2. "Importar uma cópia" adiciona os dados do arquivo sem apagar nada.
3. Um arquivo de uma versão mais nova do app é recusado com a mensagem "O arquivo veio de uma versão mais nova do app (regras vN). Atualize o FitPulse pela loja do Play e tente de novo. Nenhum dado foi alterado."

**F-07 — Atualização pela loja.**
1. O Play atualiza o app.
2. Ao abrir, as empresas, os diagnósticos, os rascunhos e as preferências continuam lá.
3. Os diagnósticos antigos mostram a nota e a versão das regras com que foram calculados.
4. Se a atualização dos dados falhar, o app não abre com dados corrompidos e o Play mantém o backup da versão anterior (`.aioson/docs/integrations/software-update-compatibility.md` §10.1).

## Business Rules

| Rule | Statement | Kind | Applies to | Source |
|---|---|---|---|---|
| RULE-dm-01 | A nota de cada dimensão é calculada das respostas âncora (0 a 3) e nunca digitada: `round(soma ÷ (itens × 3) × 100)`. "Não sei" ou "não acompanho" vale 0 | rule | CAP-dm-engine | F1; pesquisa §7 |
| RULE-dm-02 | Canal e receita soma às suas respostas um item calculado da relação LTV:CAC: menor que 1 vale 0; de 1 a menos de 3 vale 1; acima de 5 vale 2; de 3 a 5 vale 3. Sem relação calculável, esse item vale 0 na nota da dimensão; ele não entra de novo na contagem da RULE-dm-08, que já conta as origens desconhecidas da calculadora | rule | CAP-dm-engine | F1; pesquisa §3 |
| RULE-dm-03 | CAC = gasto para atrair clientes nos últimos 3 meses ÷ clientes novos nesses 3 meses. LTV = valor médio da compra × compras por ano × anos de relacionamento × margem. Payback em meses = CAC ÷ (valor médio × compras por ano ÷ 12 × margem). Faixas usam o ponto médio e marcam o valor como estimado. Valores em reais são arredondados para o centavo (meio para cima). A relação é exibida com uma casa decimal (4,6×) e o payback em meses inteiros arredondados para cima (3,9 → "4 meses"), como no protótipo; as travas e os riscos usam os valores exatos | rule | CAP-dm-unit-economics | Pesquisa §3 |
| RULE-dm-04 | Estágio 2 (Ajuste) exige custo de cliente conhecido (medido ou estimado) e Mercado e produto ≥ 50. Estágio 3 (Escala) exige o estágio 2, custo de cliente **medido**, LTV:CAC ≥ 3, payback ≤ 12 meses, Produto e canal ≥ 60 e Retenção ≥ 50. Estágio 4 (Estruturação) exige o estágio 3, Receita e mercado ≥ 60, Conversão ≥ 70 e trabalho dividido em áreas com responsáveis | rule | CAP-dm-engine | F4; F13 (escala só com custo medido) |
| RULE-dm-05 | A trava é o primeiro critério não atendido do estágio seguinte, na ordem da RULE-dm-04. No estágio 4 não há trava | rule | CAP-dm-engine | F4 |
| RULE-dm-06 | Cada dimensão indica o estágio que sustentaria sozinha: menos de 40 → 1; de 40 a 59 → 2; de 60 a 79 → 3; 80 ou mais → 4. O estágio da empresa nunca passa do permitido pela RULE-dm-04 | rule | CAP-dm-engine | Pesquisa §5.4 (Churchill & Lewis) |
| RULE-dm-07 | Riscos vêm só do catálogo de sinais. Nota = probabilidade (1–5) × impacto (1–5). Alto ≥ 16, médio de 6 a 15, baixo ≤ 5. No máximo 5 riscos, ordenados pela nota e depois pela ordem do catálogo; a lista pode ser vazia | rule | CAP-dm-engine | F6 |
| RULE-dm-08 | Confiança nos dados: conta os itens "não sei" e as duas origens desconhecidas da calculadora (gasto e clientes novos), de um total de 26. Até 10% → alta; até 25% → média; acima → baixa. Se a calculadora usou faixas, a confiança é no máximo média | rule | CAP-dm-engine | Pesquisa §7 |
| RULE-dm-09 | O plano tem exatamente 3 ações, sem repetir, escolhidas nesta ordem: (1) a ação da trava, se houver; (2) a ação `dep`, se o sinal SIG-04 existir; (3) a ação `invest`, se elegível pela RULE-dm-10; (4) as ações das dimensões mais fracas, da menor nota para a maior. O empate entre dimensões segue a ordem mp, pc, mm, aq, en, co, re. Canal e receita (cm) e a estrutura (es1) não têm ação de dimensão própria: entram só pelas travas `cac`, `measure`, `ratio`, `payback` e `es` | rule | CAP-dm-engine | F4; M-27; casos de referência G1–G4 |
| RULE-dm-10 | Ações que aumentam investimento só entram no plano com custo de cliente medido e confiança alta | invariant | CAP-dm-engine | F13 |
| RULE-dm-11 | Todo diagnóstico grava a versão das regras com que foi calculado. Depois de concluído, o resultado não muda. Para comparar diagnósticos de versões diferentes, o anterior é recalculado com as regras atuais a partir das respostas guardadas, e a nota original continua visível | invariant | CAP-dm-engine, CAP-dm-history | F10 |
| RULE-dm-12 | Valores em reais são guardados e calculados em centavos inteiros | invariant | feature-wide | Regra `example-monetary-values` |
| RULE-dm-13 | Uma empresa tem no máximo um rascunho por vez. Um diagnóstico novo começa com as respostas do último concluído da mesma empresa | rule | CAP-dm-questionnaire | Briefing (histórico) |
| RULE-dm-14 | A interface não usa V1–V4, "Método V4", "V4 Company", PPA, CREP nem "vacinas"; os estágios se chamam Descoberta, Ajuste, Escala e Estruturação | invariant | feature-wide | F2; decisão do dono |
| RULE-dm-15 | Excluir é possível só para empresa arquivada e apaga a empresa com todos os seus diagnósticos; arquivar e restaurar nunca apagam dados | rule | CAP-dm-company | Regra `status-change-confirmation`; LGPD art. 16 |
| RULE-dm-16 | O app não pede login e os seus servidores escutam só em `127.0.0.1` | invariant | CAP-dm-play-runtime | Decisão do dono; contexto do projeto |
| RULE-dm-19 | Em execução, o app não faz nenhuma requisição a serviços fora do próprio computador: as fontes (Inter, JetBrains Mono) vêm empacotadas com o app, e a única conversa externa permitida é com o próprio Play em `localhost` | invariant | CAP-dm-play-runtime | Promessa de dados locais e sem funil (briefing); regra 3 do contrato Play em `CLAUDE.md` |
| RULE-dm-17 | A rota `GET /api/aioson-play` lista só rotas reais e expõe ao assistente do Play apenas a saúde e, por empresa ativa, o nome, o estágio, a dimensão que mais trava e a data do último diagnóstico. Nunca expõe valores em reais nem respostas | invariant | CAP-dm-play-runtime | F9 |
| RULE-dm-18 | Importar uma cópia nunca apaga nem sobrescreve dados existentes. Uma cópia de versão de dados mais nova que a do app é recusada inteira | invariant | CAP-dm-backup | Briefing (expansion-scout) |

## Decision Branches

| Branch | Condition | Expected behavior | AC |
|---|---|---|---|
| BR-dm-01 | Gasto ou clientes novos marcados como "não sei" | CAC não calculado; estágio 1 com a trava "descobrir quanto custa cada cliente novo"; risco "Investir em divulgação sem saber quanto custa um cliente" (4×4 = 16, alto) | AC-dm-21 |
| BR-dm-02 | Gasto ou clientes novos informados por faixa | O valor usa o ponto médio, aparece como "estimado" e a confiança fica no máximo média; o estágio 3 fica bloqueado pelo custo não medido | AC-dm-15, AC-dm-20 |
| BR-dm-03 | Relação LTV:CAC < 1, 1–3, 3–5 ou > 5 | Mostra "Crítico", "Atenção", "Saudável" ou "Pode investir mais", com a frase correspondente | AC-dm-15 |
| BR-dm-04 | Nenhum sinal de risco disparado | O bloco de riscos mostra "Nenhum risco encontrado nas suas respostas" | AC-dm-24 |
| BR-dm-05 | A empresa já tem um rascunho | "Novo diagnóstico" vira "Continuar diagnóstico"; não se cria um segundo rascunho | AC-dm-13 |
| BR-dm-06 | A empresa tem diagnóstico concluído anterior | O novo rascunho começa preenchido com as respostas do último concluído | AC-dm-13 |
| BR-dm-07 | Diagnóstico anterior com versão de regras diferente | A comparação recalcula o anterior e mostra o aviso com a nota original | AC-dm-31 |
| BR-dm-08 | Primeiro diagnóstico concluído da empresa | O resultado e a tela inicial não oferecem comparação; a escada não mostra degrau anterior | AC-dm-30 |
| BR-dm-09 | Modo de uso "minha empresa" ou "consultoria" | A tela inicial e o menu mudam (empresa em foco ou carteira); os dados não mudam | AC-dm-33, AC-dm-34 |
| BR-dm-10 | Arquivo de cópia de versão mais nova ou inválido | Recusa com mensagem; nenhum dado alterado | AC-dm-37 |
| BR-dm-11 | Nenhuma empresa cadastrada | Abre o assistente de primeiro uso | AC-dm-01 |
| BR-dm-12 | Concluir com blocos sem resposta | Alerta com os blocos pendentes; nada concluído | AC-dm-14 |
| BR-dm-13 | Estágio 4 | Sem cadeado; a frase vira "Último degrau. Manter margem, equipe e números em dia." | AC-dm-20 |
| BR-dm-14 | Gasto informado, mas 0 clientes novos no período | O campo aceita 0. O custo por cliente aparece como "não calculado", com a frase "Sem clientes novos no período, não dá para calcular o custo de um cliente"; o efeito no estágio e no risco é o do BR-dm-01 | AC-dm-51 |
| BR-dm-15 | Margem informada como R$ 0 de cada R$ 100 | O lucro por cliente é R$ 0,00, a relação é 0,0× ("Crítico") e o tempo para se pagar aparece como "não se paga"; o risco SIG-02 dispara | AC-dm-51 |

## Acceptance Criteria

| AC | CAP | Observable behavior | Evidence |
|---|---|---|---|
| AC-dm-01 | CAP-dm-first-run | Numa instalação nova pela loja do Play, sem dados, o app abre direto no assistente "Vamos descobrir em que degrau a sua empresa está", sem nenhuma tela de banco, porta, login ou configuração técnica | smoke manual: instalação limpa pela loja (Windows) + teste e2e da rota inicial sem dados |
| AC-dm-02 | CAP-dm-first-run | Escolher "Para a minha empresa", preencher nome, segmento e como vende e clicar em "Começar o diagnóstico" cria a empresa, define o modo empresa e abre o bloco "Seus números" de um rascunho novo | teste e2e (walkthrough do assistente) · interação do protótipo: `wizard-choose-mode`, `wizard-create-company` |
| AC-dm-03 | CAP-dm-first-run | Na primeira abertura da tela inicial com dados, o tour aparece com 5 passos (modo empresa) ou 4 (modo consultoria), cada um destacando a região que explica; "Pular o tour" fecha e o botão "?" do topo reabre | teste e2e · interação do protótipo: `tour-reopen` |
| AC-dm-04 | CAP-dm-company | "Nova empresa" abre o formulário com nome (obrigatório, 2 a 80 caracteres), segmento (obrigatório), como vende (obrigatório), faturamento (opcional) e CNPJ (opcional); salvar mostra a empresa criada | teste e2e (cria e confere na lista) · interação do protótipo: `company-create` |
| AC-dm-05 | CAP-dm-company | Editar uma empresa mostra os mesmos campos do cadastro já preenchidos; salvar altera só aquela empresa, e a lista mostra o novo valor | teste e2e (edita uma linha específica e confere o registro certo) · interação do protótipo: `company-edit` |
| AC-dm-06 | CAP-dm-company | Arquivar uma empresa abre a confirmação "Arquivar {nome}?" com a consequência; confirmar a tira da carteira e da tela inicial; "Ver arquivadas" a mostra com "Restaurar"; restaurar a devolve com o histórico intacto | teste e2e (confirmar e cancelar) · interação do protótipo: `company-archive`, `company-restore` |
| AC-dm-07 | CAP-dm-company | Excluir aparece só em empresa arquivada, abre uma confirmação destrutiva com a quantidade de diagnósticos que serão apagados e, ao confirmar, remove a empresa e os seus diagnósticos; cancelar não muda nada (RULE-dm-15) | teste e2e + teste de persistência · interação do protótipo: `company-delete` |
| AC-dm-08 | CAP-dm-company | O CNPJ tem máscara 00.000.000/0000-00 durante a digitação (`inputmode="numeric"`, até 18 caracteres); ao sair do campo, um CNPJ com dígito verificador errado mostra no próprio campo "CNPJ inválido. Formato: 00.000.000/0000-00." com `aria-invalid` | teste unitário da validação + teste e2e |
| AC-dm-09 | CAP-dm-company | A lista de empresas tem busca por nome, filtro por estágio (Todos, 1 a 4) e alternância entre ativas e arquivadas; uma busca sem resultado mostra "Nenhuma empresa encontrada" com "Limpar filtros"; sem nenhuma empresa aparece o estado vazio com "Cadastrar a primeira empresa" | teste e2e |
| AC-dm-10 | CAP-dm-questionnaire | O questionário tem os 8 blocos e as 24 perguntas do Conteúdo metodológico v1, mais os 6 campos da calculadora; o trilho lateral mostra o número de cada bloco e marca os respondidos | teste e2e · interação do protótipo: `diagnosis-answer-anchored-item` |
| AC-dm-11 | CAP-dm-questionnaire | Cada pergunta tem um botão "?" que mostra e esconde a ajuda (`aria-expanded`); "Não sei" ou "Não acompanho" existe só nas perguntas sobre fatos marcadas no catálogo | teste e2e · interação do protótipo: `diagnosis-dont-know-range` |
| AC-dm-12 | CAP-dm-questionnaire | Cada resposta é gravada ao ser escolhida. Fechar o app e abrir de novo mostra o rascunho com as mesmas respostas, e o indicador "Salvo automaticamente às HH:MM" é atualizado | teste e2e com recarga da página + teste de persistência · interação do protótipo: `diagnosis-autosave-resume` |
| AC-dm-13 | CAP-dm-questionnaire | Com um diagnóstico concluído e sem rascunho, "Novo diagnóstico" cria um rascunho já preenchido com as respostas do último concluído. Com rascunho existente, o botão vira "Continuar diagnóstico" e não cria outro (RULE-dm-13) | teste e2e · interação do protótipo: `diagnosis-start-from-previous` |
| AC-dm-14 | CAP-dm-questionnaire | "Ver meu resultado" com blocos incompletos mostra um alerta (`role="alert"`) listando os blocos pendentes, com links para eles, e não conclui. Com tudo respondido, abre a confirmação em ouro "Concluir o diagnóstico?"; cancelar mantém o rascunho | teste e2e · interação do protótipo: `diagnosis-complete` |
| AC-dm-15 | CAP-dm-unit-economics | Os campos em reais têm máscara de moeda brasileira (R$ 1.234,56) e valor em centavos inteiros; o painel ao lado recalcula, a cada alteração, custo por cliente, lucro por cliente, relação ("Crítico", "Atenção", "Saudável" ou "Pode investir mais") e meses para se pagar; valores de faixa aparecem como "estimado por faixa" | teste unitário das fórmulas (RULE-dm-03, RULE-dm-12 em centavos inteiros, casos de borda) + teste e2e · interação do protótipo: `cac-ltv-calculator` |
| AC-dm-16 | CAP-dm-questionnaire | Descartar um rascunho abre a confirmação "Descartar o rascunho de {data}?"; confirmar apaga só aquele rascunho e mantém os concluídos | teste e2e · interação do protótipo: `diagnosis-discard-draft` |
| AC-dm-17 | CAP-dm-questionnaire | Corrigir um campo com erro limpa o erro dele. Clicar em enviar logo depois de corrigir um campo validado ao sair dele envia o formulário: a mensagem de erro nunca desloca o botão no meio do clique | teste e2e (corrigir e clicar em seguida) |
| AC-dm-18 | CAP-dm-engine | Para um conjunto de respostas conhecido, cada uma das 8 dimensões recebe a nota da RULE-dm-01 e da RULE-dm-02, de 0 a 100, inteira | teste unitário com tabela de casos |
| AC-dm-19 | CAP-dm-engine | Cada dimensão mostra "Sustentaria o estágio N" conforme a RULE-dm-06, e notas abaixo de 50 mostram "Abaixo de 50" | teste unitário + teste e2e |
| AC-dm-20 | CAP-dm-engine | O estágio segue a RULE-dm-04 e a trava segue a RULE-dm-05 nos casos de referência G1 a G4 (sem custo → estágio 1; trava de retenção no estágio 2; trava de conversão no estágio 3; estágio 4 sem trava) e numa tabela de casos de borda que inclui custo estimado bloqueando o estágio 3 | teste unitário com os casos de referência + tabela de casos de borda |
| AC-dm-21 | CAP-dm-engine | Com gasto ou clientes novos "não sei", o resultado é estágio 1, com a trava "Descobrir quanto custa cada cliente novo" e o risco alto de nota 16 | teste unitário + teste e2e |
| AC-dm-22 | CAP-dm-engine | Todo diagnóstico concluído guarda a versão das regras e o resultado calculado na conclusão; o resultado não muda depois, nem com uma atualização do app que troque as regras (RULE-dm-11) | teste unitário + teste de persistência com troca de versão das regras |
| AC-dm-23 | CAP-dm-engine | Os riscos seguem o catálogo de sinais e a RULE-dm-07: cada risco mostra título, causa, "Probabilidade P de 5", "Impacto I de 5", "Nota P × I = N", o nível (Alto, Médio ou Baixo) e "Como reduzir:" | teste unitário + teste e2e |
| AC-dm-24 | CAP-dm-engine | Quando nenhum sinal dispara, o bloco de riscos mostra "Nenhum risco encontrado nas suas respostas" | teste unitário + teste e2e |
| AC-dm-25 | CAP-dm-engine | O plano tem exatamente 3 ações escolhidas pela RULE-dm-09, cada uma com título, motivo e como fazer. Os casos de referência produzem exatamente os planos G1 (cac, mp, mm), G2 (re, dep, mp), G3 (co, invest, pc) e G4 (invest, pc, mp); dois diagnósticos no mesmo estágio com dimensões fracas diferentes geram planos diferentes | teste unitário com os casos de referência |
| AC-dm-26 | CAP-dm-engine | Uma ação de aumentar investimento só aparece com custo de cliente medido e confiança alta (RULE-dm-10) | teste unitário |
| AC-dm-27 | CAP-dm-engine | Depois de confirmar a conclusão, o estado "Calculando o seu diagnóstico" aparece e o resultado é exibido em até 3 segundos num computador comum | medição manual em smoke (Windows) |
| AC-dm-28 | CAP-dm-result | No topo do resultado ficam a escada com o estágio, o degrau anterior tracejado e o cadeado no próximo (com descrição acessível do tipo "Estágio 2 de 4: Ajuste. Diagnóstico anterior no estágio 1. Trava para subir: …"); a frase da trava em itálico; as 3 ações; o aviso "Orientação baseada nas suas respostas. Não substitui uma análise financeira." Abaixo vêm encaixes, frentes, números, riscos e confiança | teste e2e + comparação visual com o protótipo · interação do protótipo: `result-layered-view` |
| AC-dm-29 | CAP-dm-result | Nenhuma tela, relatório ou mensagem do app contém "V1", "V2", "V3", "V4", "Método V4", "V4 Company", "PPA", "CREP" ou "vacinas"; os estágios aparecem como Descoberta, Ajuste, Escala e Estruturação (RULE-dm-14) | teste e2e (varredura do texto das telas e do PDF) |
| AC-dm-30 | CAP-dm-history | A página da empresa mostra a linha do tempo (rascunho com progresso, concluídos com estágio, versão do cálculo e confiança, arquivados recolhidos); arquivar e restaurar um diagnóstico pedem e respeitam confirmação; o primeiro diagnóstico não oferece comparação | teste e2e |
| AC-dm-31 | CAP-dm-history | "Comparar" mostra estágio anterior → atual, a nota de cada dimensão antes e depois com a diferença (seta e texto, não só cor) e os riscos resolvidos e novos. Se as versões das regras diferem, o aviso diz que o anterior foi recalculado, qual número vale e qual era a nota original (RULE-dm-11) | teste unitário do recálculo + teste e2e · interação do protótipo: `result-compare-previous` |
| AC-dm-32 | CAP-dm-home | No modo empresa, a tela inicial mostra a escada da empresa em foco com a data do último diagnóstico, a trava com a dimensão que mais trava, as 3 ações, o rascunho em andamento (com "Continuar de onde parei") e a evolução da pontuação média, com link para comparar | teste e2e |
| AC-dm-33 | CAP-dm-home | Mudar um diagnóstico (concluir, arquivar) muda os indicadores da tela inicial na próxima abertura; nenhum número da tela inicial é fixo | teste e2e (altera os dados e confere os indicadores) |
| AC-dm-34 | CAP-dm-home | No modo consultoria, a tela inicial mostra a carteira por estágio; tocar num degrau abre a lista filtrada por aquele estágio; as listas de rascunhos parados há mais de 7 dias, sem diagnóstico há mais de 90 dias e com risco alto levam às empresas certas | teste e2e |
| AC-dm-35 | CAP-dm-home | Sem empresas no modo consultoria, aparece o estado vazio com "Cadastrar a primeira empresa"; uma empresa sem diagnóstico concluído mostra "Começar o primeiro diagnóstico" | teste e2e |
| AC-dm-36 | CAP-dm-report | "Exportar PDF" gera um arquivo PDF salvo no computador com empresa, data, versão do cálculo, confiança, estágio, trava, notas das 8 dimensões, riscos, 3 ações e o aviso de orientação; o nome sugerido é `{empresa}-{data}.pdf`. Se o usuário cancelar ou a gravação falhar, aparece uma mensagem e o resultado continua aberto, sem nada alterado | smoke manual no webview do Play + teste do conteúdo do PDF · interação do protótipo: `result-export-pdf` |
| AC-dm-37 | CAP-dm-backup | "Exportar meus dados" salva um arquivo com todas as empresas e diagnósticos; importar esse arquivo noutra instalação reproduz o mesmo histórico; importar nunca apaga dados existentes; um arquivo inválido ou de versão mais nova é recusado com mensagem (`role="alert"`) e nada muda (RULE-dm-18) | teste de ida e volta (exportar → importar) + teste e2e da recusa · interação do protótipo: `backup-export`, `backup-import` |
| AC-dm-38 | CAP-dm-settings | Configurações permite trocar entre "Minha empresa" e "Consultoria", escolher a empresa em foco e o tema "Escuro" ou "Claro"; as escolhas valem na hora e continuam depois de fechar e abrir o app | teste e2e com recarga · interação do protótipo: `switch-usage-mode`, `switch-theme` |
| AC-dm-39 | CAP-dm-settings | Configurações explica como ler os resultados (orientação, versão do cálculo) e lista exatamente o que o assistente do Play pode ler | teste e2e |
| AC-dm-40 | CAP-dm-play-runtime | O app não tem tela de login nem campo de senha e não declara `requires_services` no `manifest.json` | inspeção do manifest + teste e2e |
| AC-dm-41 | CAP-dm-play-runtime | `GET /api/aioson-play` responde com o esquema de capacidades listando só rotas que existem: a saúde e a leitura do resumo do último diagnóstico | teste de API |
| AC-dm-42 | CAP-dm-play-runtime | A leitura do resumo devolve, por empresa ativa, nome, estágio, dimensão que mais trava e data, e não devolve nenhum valor em reais nem respostas do questionário (RULE-dm-17) | teste de API |
| AC-dm-43 | CAP-dm-play-runtime | O `manifest.json` declara o nome "FitPulse" e o contrato split-stack do Play (processos com `port_env`, `webview_target` no frontend, `has_api: true`, `compatibility.schema_version`); a interface mostra "FitPulse" e nunca "V-Stage" | inspeção do manifest + teste e2e |
| AC-dm-44 | CAP-dm-play-runtime | Frontend e backend leem as portas das variáveis injetadas pelo Play e escutam só em `127.0.0.1`; de outro computador da mesma rede, nenhuma rota do app responde (RULE-dm-16) | smoke manual de rede |
| AC-dm-45 | CAP-dm-play-runtime | Atualizar o app pela loja de uma versão com dados para uma versão com mudança de esquema mantém empresas, diagnósticos, rascunhos e preferências; o arquivo de dados nunca viaja no pacote publicado | smoke manual de atualização + inspeção do pacote |
| AC-dm-46 | CAP-dm-home, CAP-dm-questionnaire, CAP-dm-result, CAP-dm-company, CAP-dm-settings | Em 390 px de largura não há rolagem horizontal em nenhuma tela; os alvos de toque têm pelo menos 44 px (ou ficam dentro de um rótulo clicável desse tamanho); o foco do teclado é sempre visível; o texto tem contraste de pelo menos 4,5:1 nos temas escuro e claro | verificação visual em runtime (`verify:artifact --kind=visual --runtime`) + teste e2e por teclado |
| AC-dm-47 | CAP-dm-home, CAP-dm-result | Com `prefers-reduced-motion: reduce`, nenhuma animação roda (entrada das seções, traço da legenda, preenchimento das barras, poeira do fundo) e as telas aparecem já no estado final | teste e2e com movimento reduzido |
| AC-dm-49 | CAP-dm-engine | O resultado mostra "Confiança nos dados: alta, média ou baixa" calculada pela RULE-dm-08; com custo estimado por faixa, a confiança nunca passa de média; com confiança baixa, o texto diz que o resultado é provisório até medir os números | teste unitário com tabela de casos + teste e2e |
| AC-dm-48 | CAP-dm-company, CAP-dm-questionnaire, CAP-dm-history | Ações de status e destrutivas (arquivar, restaurar com troca de lista, excluir, descartar rascunho, concluir) usam modal do próprio app com título, consequência, verbo no botão e "Cancelar"; Esc cancela e o foco fica preso no modal; nenhum `alert`, `confirm` ou `prompt` nativo | teste e2e (confirmar e cancelar cada ação) |
| AC-dm-50 | CAP-dm-play-runtime | Com a rede externa desligada, o app abre, calcula e exporta normalmente, com as fontes Inter e JetBrains Mono renderizadas; durante um diagnóstico completo, nenhuma requisição sai para fora de `127.0.0.1`/`localhost` (RULE-dm-19) | teste e2e com rede externa bloqueada + captura de requisições |
| AC-dm-51 | CAP-dm-unit-economics | Com 0 clientes novos, o custo por cliente mostra "não calculado" com a explicação do BR-dm-14; com margem R$ 0, o lucro é R$ 0,00, a relação é "0,0× Crítico" e o tempo para se pagar é "não se paga" (BR-dm-15); nenhuma tela mostra "NaN", "Infinity" ou um valor vazio | teste unitário das fórmulas + teste e2e |

## Conteúdo metodológico v1 (aprovado pelo dono em 2026-10-22; calibração pendente)

Este conteúdo é a versão 1 das regras ("regras v1"). Ele nasce das pesquisas aprovadas (`researchs/growth-frameworks-diagnostico/summary.md`, `researchs/ferramentas-diagnostico-mercado/summary.md`) e foi aprovado pelo dono em 2026-10-22, na resposta "Aprovo" à pergunta de aprovação do conteúdo (decisão F5). Antes de congelar as regras v1, falta só a calibração com casos reais (OQ-7), que pode ajustar os limiares sem mudar a estrutura.

Os limiares são hipóteses de produto, não fatos de mercado.

### Estágios

| Nº | Nome | Frase mostrada |
|---|---|---|
| 1 | Descoberta | Você ainda está descobrindo quanto custa conquistar e manter um cliente. |
| 2 | Ajuste | Os números básicos existem. Agora o foco é deixá-los saudáveis e mais baratos. |
| 3 | Escala | Os números sustentam investir mais para crescer mais rápido. |
| 4 | Estruturação | Crescer agora depende de dividir o trabalho e cuidar da margem. |

### Dimensões

| Chave | Nome | Pergunta que ela responde | Grupo |
|---|---|---|---|
| mp | Mercado e produto | As pessoas querem o que você vende, a ponto de voltar? | Encaixe |
| pc | Produto e canal | Você sabe por onde os clientes chegam e o que cada canal traz? | Encaixe |
| cm | Canal e receita | O que um cliente deixa paga o que ele custou? | Encaixe |
| mm | Receita e mercado | O seu mercado comporta a meta que você tem? | Encaixe |
| aq | Aquisição | Atrair as pessoas certas | Frente |
| en | Engajamento | Ganhar a confiança de quem chegou | Frente |
| co | Conversão | Transformar interesse em venda | Frente |
| re | Retenção | Vender de novo para quem já comprou | Frente |

### Calculadora (bloco 1, "Seus números")

| Campo | Formato | "Não sei" |
|---|---|---|
| Gasto para atrair clientes nos últimos 3 meses | Modo "sei os valores": seis campos em reais (anúncios; agência ou freelancer; comissões; descontos e brindes de primeira compra; parte do salário de quem vende ou divulga; ferramentas). Modo "sei mais ou menos": faixas até R$ 1.000 / R$ 1.000 a 5.000 / R$ 5.000 a 15.000 / R$ 15.000 a 50.000 / acima de R$ 50.000 | Sim |
| Clientes que compraram pela primeira vez nesses 3 meses | Número inteiro, ou faixas 1–10 / 11–30 / 31–100 / 101–300 / mais de 300 | Sim |
| Valor médio de uma compra | Reais | Não (obrigatório) |
| Compras por ano de um cliente | 1 / 2–3 / 4–6 / 7–12 / mais de 12 | Não |
| Tempo que um cliente continua comprando | menos de 6 meses / 6–12 meses / 1–2 anos / 2–4 anos / mais de 4 anos | Não |
| De cada R$ 100 vendidos, quanto sobra depois de pagar produto, insumo e entrega | R$ 0 a R$ 100 | Não |

### Banco de perguntas (24 itens; respostas âncora de 0 a 3; "NS" = opção "não sei/não acompanho", que vale 0)

| ID | Bloco | Dimensão | Pergunta | 0 | 1 | 2 | 3 | NS |
|---|---|---|---|---|---|---|---|---|
| mp1 | Clientes e produto | mp | Dos clientes que compraram há uns 6 meses, quantos ainda compram de você? | Menos de 1 em cada 4 | Cerca de 1 em cada 3 | Mais ou menos metade | Mais da metade | Não acompanho |
| mp2 | Clientes e produto | mp | Se você parasse toda a divulgação paga por um mês, as vendas… | Iriam quase a zero | Cairiam muito | Cairiam um pouco | Continuariam, por indicação e clientes antigos | — |
| mp3 | Clientes e produto | mp | De cada 10 clientes novos, quantos chegam por indicação ou procurando o seu nome? | Nenhum ou 1 | 2 ou 3 | 4 a 6 | 7 ou mais | Não sei dizer |
| mp4 | Clientes e produto | mp | Quando um cliente deixa de comprar, você sabe o motivo? | Não sei | Desconfio | Pergunto às vezes | Pergunto sempre e anoto | — |
| pc1 | Canais e preço | pc | Que parte dos clientes novos vem do seu principal canal? | Não sei de onde eles vêm | Vem um pouco de cada lugar | Mais ou menos metade de um canal | Mais de 70% de um canal só | — |
| pc2 | Canais e preço | pc | Você sabe quanto cada canal custa e quantos clientes traz? | Não sei | Tenho uma ideia | Anoto para alguns canais | Anoto para todos, todo mês | — |
| pc3 | Canais e preço | pc | Nos últimos 6 meses, você testou um canal novo medindo o resultado? | Não testei | Testei sem medir | Testei e medi um | Testo com frequência e meço | — |
| cm1 | Canais e preço | cm | O lucro de um cliente novo paga o que você gastou para atraí-lo? | Só depois de muitas compras, ou nunca | Depois de várias compras | Na segunda ou terceira compra | Já na primeira compra | Não sei |
| cm2 | Canais e preço | cm | Você acompanha quanto sobra de cada venda (margem)? | Não | Tenho uma ideia | Calculei uma vez | Acompanho todo mês | — |
| mm1 | Mercado e equipe | mm | Para bater a sua meta, que parte dos clientes possíveis você precisaria conquistar? | Mais de 30% | Entre 10% e 30% | Entre 3% e 10% | Menos de 3% | Não sei calcular |
| mm2 | Mercado e equipe | mm | Você tem uma meta de faturamento para os próximos 12 meses? | Não | Tenho uma ideia | Tenho um número | Tenho um número por mês e acompanho | — |
| es1 | Mercado e equipe | estrutura | Como o trabalho de marketing e vendas está dividido hoje? | Eu faço tudo | Tenho ajuda de vez em quando | Uma pessoa cuida disso comigo | Áreas separadas, cada uma com responsável | — |
| aq1 | Atrair | aq | Você sabe de onde veio cada cliente? | Não sei | Tenho uma ideia | Pergunto às vezes | Anoto a origem de cada cliente | — |
| aq2 | Atrair | aq | Quantos canais trazem clientes todo mês, com resultado que você mede? | Nenhum constante | Um | Dois | Três ou mais | — |
| aq3 | Atrair | aq | Você sabe quanto paga, em média, por cada pessoa interessada que chega (contato, orçamento ou visita)? | Não | Tenho uma ideia | Calculo às vezes | Acompanho todo mês | — |
| en1 | Conversar | en | Quem conhece a sua marca encontra um lugar claro para comprar ou pedir orçamento? | Não tenho | Só o perfil na rede social | Uma página geral | Uma página por oferta, com botão de contato | — |
| en2 | Conversar | en | Com que frequência você publica algo útil para o seu cliente? | Quase nunca | Quando sobra tempo | Toda semana | Toda semana, com calendário planejado | — |
| en3 | Conversar | en | Quanto tempo você leva para responder quem pede orçamento ou informação? | Mais de um dia | No mesmo dia | Em algumas horas | Em até 1 hora | — |
| co1 | Vender | co | De cada 10 orçamentos ou conversas sobre compra, quantos viram venda? | 1 ou menos | 2 ou 3 | 4 a 6 | 7 ou mais | Não acompanho |
| co2 | Vender | co | Quando alguém decide comprar, quantos passos existem até pagar? | Muitos, e perco vendas no caminho | Alguns, às vezes travam | Poucos | Um clique ou um contato e pronto | — |
| co3 | Vender | co | Quando alguém não compra, você volta a falar com essa pessoa? | Não | Às vezes | Sim, com uma mensagem padrão | Sim, com um roteiro de retorno | — |
| re1 | Manter | re | Você tem a lista dos seus clientes com um contato? | Não tenho | Tenho parte, espalhada | Sim, numa planilha | Sim, num sistema, atualizada | — |
| re2 | Manter | re | Depois da compra, você volta a falar com o cliente? | Não | Às vezes | Sim, quando tenho oferta | Sim, com mensagens planejadas para recompra | — |
| re3 | Manter | re | Você tem algo que faz o cliente voltar (fidelidade, assinatura, pacote, lembrete)? | Não | Já tentei | Tenho um | Tenho e meço quantos voltam | — |

O texto de ajuda de cada pergunta segue o padrão do protótipo: uma ou duas frases com um exemplo do dia a dia, em linguagem do 6º ao 8º ano. Ele é escrito junto com a implementação e revisado na calibração.

### Catálogo de sinais → riscos (matriz 5×5)

| ID | Sinal | Título mostrado | P | I | Nota | Como reduzir |
|---|---|---|---|---|---|---|
| SIG-01 | Custo de cliente não calculável | Investir em divulgação sem saber quanto custa um cliente | 4 | 4 | 16 (alto) | Durante 30 dias, anote o que gastou para atrair clientes e quantos compraram pela primeira vez. |
| SIG-02 | LTV:CAC < 1 | Cada venda nova aumenta o prejuízo | 4 | 5 | 20 (alto) | Teste um combo ou uma oferta de recompra para quem já comprou e meça por 30 dias. |
| SIG-03 | 1 ≤ LTV:CAC < 3 | Margem apertada para crescer com anúncio | 3 | 3 | 9 (médio) | Igual ao SIG-02. |
| SIG-04 | pc1 = "Mais de 70% de um canal só" | Depender de um só canal | 3 | 4 | 12 (médio) | Separe 10% do orçamento por 60 dias para um canal novo e compare o custo por cliente. |
| SIG-05 | Retenção < 40 | Vender só para gente nova | 3 | 4 | 12 (médio) | Junte o contato de quem comprou nos últimos 6 meses e mande uma sugestão de recompra 15 dias depois da compra. |
| SIG-06 | Payback > 12 meses | Caixa preso em clientes novos | 3 | 3 | 9 (médio) | Crie uma segunda compra para os primeiros 60 dias, como um pacote ou uma assinatura. |
| SIG-07 | mm1 = "Mais de 30%" | Meta maior do que o mercado | 2 | 4 | 8 (médio) | Estime quantos clientes possíveis existem; se a meta pede mais de 30%, amplie a região ou a oferta. |
| SIG-08 | co2 = "Muitos, e perco vendas no caminho" | Vendas perdidas entre o interesse e o pagamento | 3 | 3 | 9 (médio) | Liste cada passo de uma compra e corte um deles nesta semana, como um link de pagamento direto. |

### Catálogo de ações

| Chave | Quando entra | Título | Motivo | Como fazer |
|---|---|---|---|---|
| cac | Trava "custo de cliente" | Descobrir quanto custa cada cliente novo | Sem esse número, qualquer aumento de anúncio é uma aposta. | Durante 30 dias, anote o que gastou para atrair clientes e quantos compraram pela primeira vez. Divida um pelo outro. |
| measure | Trava "custo de cliente medido" (custo só estimado por faixa) | Trocar a estimativa por um número medido | Para escalar, o custo de cada cliente precisa ser medido, não estimado. | Registre gasto e clientes novos por 30 dias, canal por canal. |
| mp | Trava ou dimensão fraca: Mercado e produto | Perguntar a 10 clientes por que eles voltam, ou por que não voltaram | Quem volta a comprar mostra o que o produto resolve. | Mande uma mensagem curta para 10 clientes de 3 a 6 meses atrás e anote as respostas. |
| ratio | Trava LTV:CAC | Aumentar o que cada cliente deixa antes de atrair mais gente | Hoje cada cliente deixa menos de 3 vezes o que custou. | Teste um combo ou uma oferta de recompra para quem já comprou e meça por 30 dias. |
| payback | Trava payback | Recuperar mais rápido o custo de cada cliente | O dinheiro gasto para atrair um cliente demora mais de um ano para voltar. | Crie uma segunda compra para os primeiros 60 dias. |
| pc | Trava ou dimensão fraca: Produto e canal | Medir o resultado de cada canal todo mês | Sem saber o que cada canal traz, o orçamento vai para o canal errado. | Pergunte "como nos conheceu?" em toda venda e some por canal no fim do mês. |
| re | Trava ou dimensão fraca: Retenção | Falar com quem já comprou, 15 dias depois da compra | Vender de novo custa menos do que conquistar alguém novo. | Junte nome e contato de quem comprou nos últimos 6 meses e mande uma sugestão de recompra. |
| mm | Trava ou dimensão fraca: Receita e mercado | Conferir se o seu mercado comporta a sua meta | A meta pode exigir clientes demais para a sua região ou nicho. | Estime os clientes possíveis e quantos você precisaria ter; acima de 30%, amplie a região ou a oferta. |
| co | Trava ou dimensão fraca: Conversão | Encurtar o caminho até o pagamento | Vendas se perdem entre o interesse e o pagamento. | Liste cada passo de uma compra e corte um deles nesta semana. |
| aq | Dimensão fraca: Aquisição | Anotar a origem de cada cliente | Sem a origem, não dá para saber o que funciona. | Inclua a pergunta "como nos conheceu?" no atendimento e registre numa planilha. |
| en | Dimensão fraca: Engajamento | Criar um lugar claro para a sua oferta principal | Quem chega não encontra com facilidade como comprar. | Monte uma página ou um catálogo de WhatsApp com preço, fotos e um botão de contato. |
| es | Trava "estrutura" | Dar um responsável para marketing e outro para vendas | Crescer mais depende de dividir o trabalho. | Escreva o que cada função entrega por semana e quem responde por isso. |
| dep | Sinal SIG-04 | Testar um segundo canal com orçamento pequeno | Mais de 70% dos clientes vêm de um só lugar. | Separe 10% do orçamento por 60 dias para um canal novo e compare o custo por cliente. |
| invest | Estágio ≥ 3, custo medido e confiança alta (RULE-dm-10) | Aumentar aos poucos o investimento no canal que mais traz clientes | Os números sustentam crescer com mais divulgação. | Aumente 20% por mês no canal com menor custo por cliente e pare se a relação cair abaixo de 3. |

No estágio 1, quando a trava é o custo de cliente, a descrição do estágio menciona as etapas de pesquisa do PRD técnico pela função: conhecer o cliente ideal, o momento em que ele percebe o problema, a sazonalidade, os pontos fortes e fracos, os concorrentes e a proposta de valor, e testar ofertas com orçamento pequeno. Isso aparece sem os nomes PPA, FOFA ou "vacinas" (RULE-dm-14). A trava `measure` corresponde ao critério "custo de cliente medido" da RULE-dm-04.

### Casos de referência do motor (regras v1)

Estes quatro casos são a prova executável das regras. Os testes do motor (AC-dm-20, AC-dm-25) os reproduzem exatamente, e qualquer mudança de regra que altere um resultado exige uma nova versão das regras. Notas = RULE-dm-01 e RULE-dm-02, arredondadas.

| Caso | Calculadora | Respostas (nível 0–3; NS = não sei) | Notas mp/pc/cm/mm/aq/en/co/re | Estágio e trava | Riscos | Plano | Confiança |
|---|---|---|---|---|---|---|---|
| G1 · sem números | Gasto "não sei"; clientes novos por faixa 11–30; compra R$ 45,00; 2–3 compras/ano; 1–2 anos; margem R$ 40 | Todas as perguntas em 1, exceto mp1, mp3, cm1, mm1 e co1 em NS | 17 / 33 / 11 / 17 / 33 / 33 / 22 / 33 | 1 Descoberta; trava `cac` | SIG-01 (16, alto); SIG-05 (12, médio) | cac, mp, mm | média (6 de 26 desconhecidos; custo por faixa) |
| G2 · ajuste | Gasto medido R$ 3.540,00; 59 clientes novos (CAC R$ 60,00); compra R$ 48,00; 7–12/ano; 1–2 anos; margem R$ 40 (LTV R$ 273,60; relação 4,6×; payback 3,9, exibido "4 meses") | mp 2,2,2,2; pc1 3, pc2 2, pc3 2; cm 2,2; mm 2,2; es1 1; aq 3,2,2; en 2,2,2; co 2,2,2; re1 2, re2 0, re3 1 | 67 / 78 / 78 / 67 / 78 / 67 / 67 / 33 | 2 Ajuste; trava `re` | SIG-04 (12); SIG-05 (12) | re, dep, mp | alta |
| G3 · escala | Gasto medido R$ 24.000,00; 80 clientes novos (CAC R$ 300,00); compra R$ 450,00; 2–3/ano; 2–4 anos; margem R$ 55 (LTV R$ 1.856,25; relação 6,2×; payback 5,8, exibido "6 meses") | mp 3,3,2,3; pc1 2, pc2 3, pc3 2; cm 3,3; mm 2,3; es1 2; aq 3,3,2; en 3,2,3; co 2,2,2; re 3,2,3 | 92 / 78 / 89 / 83 / 89 / 89 / 67 / 89 | 3 Escala; trava `co` | nenhum ("Nenhum risco encontrado nas suas respostas") | co, invest, pc | alta |
| G4 · estruturação | Gasto medido R$ 30.000,00; 100 clientes novos (CAC R$ 300,00); compra R$ 200,00; 4–6/ano; 2–4 anos; margem R$ 50 (LTV R$ 1.500,00; relação 5,0×; payback 7,2, exibido "8 meses") | Todas em 3, exceto pc1 em 2 | 100 / 89 / 100 / 100 / 100 / 100 / 100 / 100 | 4 Estruturação; sem trava | nenhum | invest, pc, mp | alta |

Na G4, a relação 5,0× fica na faixa "de 3 a 5" (item 3, "Saudável"); acima de 5 seria "Pode investir mais" (item 2).

## Success metrics

O app é local e não coleta telemetria. As metas são verificadas em sessões de validação, não por analytics.

| Métrica | Meta proposta | Como medir | Quando |
|---|---|---|---|
| Conclusão sem ajuda | 4 de 5 donos de PME concluem o primeiro diagnóstico em até 15 minutos sem ajuda | 5 entrevistas cognitivas com o build de teste (briefing Q-14) | Antes de publicar |
| Acerto do estágio | O estágio do motor coincide com o de um consultor experiente em pelo menos 7 de 10 casos reais | Calibração com 10 empresas (briefing Q-15) | Antes de congelar as regras v1 |
| Intenção de retorno | Pelo menos 3 de 5 donos dizem que refariam o diagnóstico em 3 meses | Mesmas entrevistas (briefing Q-20) | Antes de publicar |
| Perda de dados em atualização | Zero empresas ou diagnósticos perdidos | Teste de atualização da versão N para N+1 com mudança de esquema (AC-dm-45) | A cada versão publicada |

## Prototype contract

- status: current
- feature: diagnostico-maturidade
- prototype: .aioson/briefings/diagnostico-maturidade/prototype.html
- manifest: .aioson/briefings/diagnostico-maturidade/prototype-manifest.md
- manifest_status: approved (2026-10-22)
- identity: .aioson/briefings/diagnostico-maturidade/identity.md

**O que o protótipo fixa (layout, estados e interações):**
- **Telas:** assistente (modo de uso e cadastro), tela inicial nos dois modos, empresas, página da empresa, questionário com calculadora, resultado em camadas, comparação e configurações.
- **Estados:** carregando, vazio, erro e sucesso.
- **Interações:** as 22 listadas em `## Core interactions` do manifesto, incluindo o tour reabrível, o portão em ouro na conclusão, as confirmações por modal e a troca de tema.
- **Assinatura:** a escada com trava sobre a pauta.

**Desvios aprovados neste PRD:**
1. O questionário do protótipo tem 16 perguntas de demonstração; o produto usa as 24 do Conteúdo metodológico v1.
2. As regras de cálculo do protótipo são de demonstração; as regras do produto são as deste PRD (RULE-dm-01 a RULE-dm-11). Na RULE-dm-04, o estágio 3 também exige custo de cliente medido, coisa que o protótipo não verifica.
3. PDF, exportação e importação, simulados no protótipo, geram e leem arquivos reais.
4. A faixa "Protótipo de demonstração", a seção "Demonstração" das Configurações ("Recomeçar do zero") e as empresas de exemplo existem só no protótipo e não entram no produto.
5. As máscaras de moeda e CNPJ do protótipo só aceitam digitação no fim do campo; o produto preserva a posição do cursor ao editar no meio do valor.

**Estados materiais:** carregando, vazio, erro e sucesso são obrigatórios (AC-dm-09, AC-dm-14, AC-dm-27, AC-dm-35, AC-dm-37). O estado permission-denied (permissão negada) não se aplica: o app não tem login, papéis nem permissões (RULE-dm-16), assim como no `## Runtime matrix` do manifesto.

## Visual identity

identity: .aioson/briefings/diagnostico-maturidade/identity.md

identity_status: current (source: references)

**O que a identidade fixa:**
- os temas escuro ("tinta") e claro ("porcelana");
- nenhum azul estrutural;
- as três vozes tipográficas: Inter na estrutura, Georgia itálico só na intenção humana, JetBrains Mono na máquina;
- o metal do app (bronze antigo);
- o ouro só na marca e nos portões de decisão;
- profundidade só por bordas;
- os dispositivos batuta, pauta e poeira, com movimento reduzido respeitado.

A composição vem do protótipo. O metal "bronze antigo" é uma proposta para o dono incluir no design system de origem (OQ-9), e isso não bloqueia a implementação.

## Open questions

| ID | Pergunta | Classe | Dono | Bloqueia |
|---|---|---|---|---|
| OQ-1 | O dono aprova o Conteúdo metodológico v1? **Resolvida em 2026-10-22: aprovado** ("Aprovo"). Só a calibração (OQ-7) pode ajustar os limiares | decision-required | dono | não |
| OQ-2 | Existe binário pré-compilado de `better-sqlite3 ^12.6` para o Node usado pelo Play em Windows x64/arm64 e macOS? Se não, qual adaptador usar? | research-able | @planner | não para o PRD; sim para fechar a stack do banco |
| OQ-3 | Desinstalar o app no Play apaga a pasta com o banco SQLite? Se sim, o app deve lembrar de exportar a cópia antes | research-able | @planner | não |
| OQ-4 | Como o webview do Play trata salvar arquivo (PDF, cópia) e escolher arquivo (importar)? | research-able | @planner | não para o PRD; sim para AC-dm-36 e AC-dm-37 |
| OQ-5 | O `slug` técnico do app no Play muda de `v-stage` para `fitpulse` antes da primeira publicação? | decision-required | dono + @planner | não; decidir antes de publicar |
| OQ-6 | O Play exige login no aioson.com para abrir apps? (Afeta só o texto de segurança.) | research-able | @planner | não |
| OQ-7 | Validação com 5 donos e calibração com 10 casos reais (Success metrics) | testable | dono + @product | não para construir; sim para publicar e congelar as regras v1 |
| OQ-8 | Busca no INPI pelo nome "FitPulse" antes de publicar | research-able | dono | não para construir; sim para publicar |
| OQ-9 | Incluir o "bronze antigo" como material do FitPulse no design system do ecossistema | decision-required | dono | não |
