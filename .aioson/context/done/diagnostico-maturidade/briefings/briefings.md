---
slug: diagnostico-maturidade
created_at: 2026-10-22
updated_at: 2026-10-22
source_plans: [plans/plano-de-desenvolvimento-inicial.md, plans/detalhes-do-app.md]
---

# Briefing — Diagnóstico de maturidade de crescimento para pequenas empresas (V-Stage)

## Context

**Origem.** O dono escreveu um PRD técnico (`SRC-001`) para um app que classifica a maturidade de crescimento de uma empresa em quatro estágios (V1 a V4), pontua "4 Fits" e "4 Pilares" de 0 a 100, lista riscos numa matriz probabilidade × impacto e emite um plano de ação. O `SRC-002` traz o nome (V-Stage, alternativa FitPulse) e o subtítulo "Diagnostic & Growth Readiness Index".

**Decisões do dono nesta sessão (2026-10-22)** que reenquadram o PRD:

| Decisão | Efeito |
|---|---|
| App **independente**, inspirado no método, sem marca nem dados proprietários da V4 Company | Cai a promessa do "First-Party Data Graph" de 1,7 milhão de perfis; nomenclatura precisa ser própria |
| Distribuído pela **loja do AIOSON Play**; o dono da PME instala e "se vira sozinho" | A instalação e o primeiro uso precisam funcionar sem configuração técnica |
| Persona **primária: dono de pequena empresa**; **secundária: consultor** que usa o próprio Play com várias empresas | Mesmos objetos servem às duas pontas; linguagem para leigo |
| **Histórico por empresa** | Persistência, comparação no tempo, versionamento das regras |
| **SQLite** local (Prisma 7), sem provisionar banco | Zero setup; migração no `postinstall` |
| **Sem aioson-auth**; servidores só em `127.0.0.1` | Sem tela de login nem cadastro de operador |
| Express + React (Vite) split-stack | Contexto em `.aioson/context/project.context.md` |

**Decisões do refinamento (rodada 1, 2026-10-22):**
- Nome na loja: **FitPulse** (F3). "V-Stage" segue como nome de trabalho do repositório; o `slug` técnico do app no manifest (`v-stage`) é decisão do @planner. Busca no INPI antes de publicar.
- Classificação da feature: **MEDIUM** (F12), pelo piso da CLI (5 fronteiras de runtime): PRD completo, revisão profunda do @sheldon e plano por fases.
- Modelo comercial do V1: **gratuito**, para validar a demanda e o motor (F11).
- Conteúdo metodológico: o @product rascunha a partir de `researchs/` e o dono aprova (F5).

**Mercado.** A V4 Company não oferece autodiagnóstico self-service: o diagnóstico dela é humano e pago (`researchs/v4-company-metodo/summary.md` §7). Os diagnósticos gratuitos do mercado (RD Station, CIGAM, HubSpot e o Índice de Maturidade Digital do Sebrae) funcionam como funil de venda e são de disparo único. Quase nenhum acompanha a evolução da mesma empresa ao longo do tempo (`researchs/ferramentas-diagnostico-mercado/summary.md` §1.4). Os números de Martech citados no PRD conferem com a edição **2025** do landscape do chiefmartec. A edição 2026 mostra estabilização (15.505 soluções, +0,79%).

**O que o PRD assume e não se sustenta neste projeto:**
- runtime serverless `handler(context)` com timeout de 3000 ms (não existe no Play);
- operação stateless;
- motores de IA sobre entradas qualitativas que o schema não coleta;
- benchmarks a partir de dados proprietários.

Detalhe em `motor-de-diagnostico.md` (M-01 a M-03).

## Problem

**Dono de PME (primária).** Quando estou tocando uma pequena empresa e pensando em gastar mais com anúncio, agência ou vendedor, quero saber em que estágio de crescimento o negócio está e o que está travando de verdade. Assim decido onde pôr o próximo real sem pagar uma consultoria nem cair no funil de venda de alguém.

- **Contorno atual:** intuição, conselho de quem vende mídia, ou quizzes gratuitos que dão uma nota e terminam num contato comercial.
- **A dor central (tese do próprio PRD, RF-01 e RF-04):** o dono não sabe quanto custa conquistar um cliente (CAC) nem quanto um cliente deixa ao longo do tempo (LTV). Mesmo assim acelera investimento em mídia como se estivesse em escala, e se descapitaliza.
- **O que ele não tem:**
  - uma régua que diga "você ainda está descobrindo seus números; escalar agora queima caixa";
  - uma forma de calcular esses números a partir do que ele já sabe;
  - uma forma de ver, meses depois, se avançou.

**Consultor (secundária).** Quando atendo várias pequenas empresas, quero aplicar o mesmo diagnóstico estruturado em cada uma e comparar diagnósticos ao longo do tempo. Assim justifico as recomendações e mostro progresso ao cliente.

- **Contorno atual:** planilhas próprias e diagnósticos refeitos do zero, sem série histórica.

**O que o PRD atual entrega contra esse problema:**
- pede ao dono que digite de 0 a 100 o próprio "Product-Market Fit", sem pergunta nem evidência (M-11);
- não guarda nada (M-02).

Autoavaliação em nota livre é otimista e não tem relação com o desempenho (World Management Survey, `researchs/growth-frameworks-diagnostico/summary.md` §5.5, §7).

## Proposed solution

**Recomendação para @product: Option B — Autodiagnóstico guiado com histórico** (`solution-options.md`). Mecanismos centrais:

1. **Primeiro uso sem infraestrutura.** O app instala pela loja, cria o banco SQLite no `postinstall` e abre num wizard:
   - "uso para minha empresa" ou "sou consultor";
   - cadastro da empresa (nome, segmento, modelo de vendas: loja física, venda consultiva, e-commerce ou híbrido);
   - início imediato do primeiro diagnóstico.
2. **Questionário para leigo.**
   - **Formato:** blocos curtos com 25 a 35 itens (~10–15 min). As respostas descrevem o que a empresa faz, com nível mais baixo honroso ("ainda não faço isso"), e não pedem nota.
   - **Ajuda:** "?" em todo termo técnico.
   - **Salvamento:** automático; dá para sair e retomar.
   - **"Não sei":** só em dados numéricos, e sempre com faixas antes ("entre R$50 e R$100").
3. **Calculadora de CAC/LTV embutida.**
   - O dono informa o gasto para atrair clientes, por checklist (anúncio, agência, comissão, desconto de 1ª compra, parte do salário de quem vende).
   - Informa também clientes novos, ticket, frequência de compra, tempo de relacionamento e margem.
   - O app calcula CAC, LTV, LTV:CAC e payback e explica cada número.
4. **Motor determinístico e versionado.** Princípios da pesquisa (`researchs/growth-frameworks-diagnostico/summary.md`, Implicações A–H):
   - Fits e Pilares **calculados** a partir de itens com âncoras, nunca digitados (decidido em F1).
   - Os 4 Fits definidos como **encaixes entre pares**, como no framework de Brian Balfour de onde vêm: Mercado–Produto, Produto–Canal, Canal–Modelo e Modelo–Mercado.
   - Estágio geral com **trava pelas dimensões críticas** (não existe "escala" com LTV:CAC < 1) e estágio por dimensão. Decidido em F4: os limiares em reais do PRD (R$10 mil e R$50 mil) não decidem o estágio.
   - Riscos **gerados por sinais** (LTV:CAC < 1, mais de 70% dos clientes de um canal, CAC desconhecido, fatia de mercado necessária acima de 30%), com estado explícito "nenhum risco crítico". Matriz 5×5: probabilidade e impacto de 1 a 5 com âncoras, alerta em ≥ 16, P e I exibidos separados (F6).
   - Confiança do resultado (alta, média ou baixa) conforme a proporção de dados medidos, estimados ou desconhecidos.
   - **Versão das regras** gravada em cada diagnóstico, para que atualizações do app não reescrevam notas antigas.
5. **Resultado em camadas (F8).**
   - No topo: estágio com nome simples e o porquê, o principal gargalo e as 3 próximas ações.
   - Abaixo, como detalhe: Fits, Pilares, riscos e confiança.
   - Aviso curto de que é uma orientação baseada nas respostas e não substitui análise financeira; ações de aumentar investimento só aparecem com CAC/LTV de confiança alta (F13).
   - Plano de 3 a 5 ações priorizado pelas **dimensões mais fracas e pelos riscos**, não só pelo estágio (corrige M-26/M-27).
6. **Histórico e comparação.** Linha do tempo por empresa. O novo diagnóstico parte das respostas anteriores e, ao concluir, mostra o delta de cada dimensão e a mudança de estágio. Esse é o diferencial que o mercado quase não entrega. Diagnósticos feitos com versões diferentes das regras são comparados recalculando o anterior com as regras atuais, a partir das respostas guardadas; a nota original continua visível (F10).
7. **Saídas:** relatório PDF e backup/importação de todos os dados (troca de computador, portabilidade).
8. **Home de decisão** (regra `management-home-widgets`). A home precisa servir a estas decisões:
   - **Modo empresa:**
     - estágio atual e data (foco dominante);
     - a dimensão que mais trava agora;
     - progresso do plano;
     - quando reavaliar.
   - **Modo consultoria:**
     - empresas por estágio;
     - rascunhos parados;
     - reavaliações vencidas;
     - empresas com risco crítico.
   - Cada widget leva à lista filtrada.
9. **Vocabulário próprio (F2).** Estágios 1 a 4 com nomes próprios (proposta inicial: Descoberta, Ajuste, Escala, Estruturação). Pilares Aquisição, Engajamento, Conversão e Retenção. Etapas de pesquisa descritas pela função ("testes de oferta de baixo orçamento", "matriz de riscos"). Nenhum V1–V4, PPA, "vacinas" ou CREP na interface.
10. **Integração com o Play (F9).** `GET /api/aioson-play` lista a saúde e a leitura do resumo do último diagnóstico por empresa (estágio, principal gargalo, data). O assistente do Play não cria nem altera diagnósticos.
11. **Protótipo e sistema de design (F14).** O @refiner constrói o protótipo da feature antes do PRD; a direção que o dono aprovar vira o sistema de design do app.

**Menor fatia coerente** (Core):
- wizard de primeiro uso;
- Empresa com gestão completa;
- Diagnóstico com rascunho, retomada e conclusão;
- motor versionado;
- resultado com estágio, scores, riscos (inclusive "nenhum"), plano e confiança;
- ajuda contextual.

Comparação com o anterior, calculadora de CAC/LTV, home de decisão, PDF e backup formam o **Recommended MVP**, a versão que de fato se diferencia do mercado.

**Decidido em F7:** a calculadora de CAC/LTV e o relatório PDF entram no V1.

**Fora do V1** (não selecionados em F7; candidatos a uma versão seguinte):
- exportar e importar respostas por arquivo entre Plays (o cliente responde no Play dele e o consultor importa e conclui);
- marcar ações do plano como feitas;
- lembrete de reavaliação (padrão 90 dias).

**Alternativas consideradas:**
- **A**, calculadora fiel ao PRD sem histórico: viola a decisão de histórico.
- **C**, painel contínuo com check-in mensal de números: melhor candidato a V2.
- **D**, consultor-first: a ponte por arquivo ficou fora do V1 (F7); o PDF entra, sem marca do consultor.

Detalhe em `solution-options.md` e `expansion-scout.md`.

## Themes

1. **Instalação e primeiro uso sem fricção.** Loja do Play → `postinstall` cria o banco → wizard. Nenhuma tela de banco, login ou porta. A atualização preserva dados (`software-update-compatibility.md` §10.1).
2. **Motor de diagnóstico confiável.** Corrigir as 30 contradições entre regras, schema, código e wireframe do PRD (`motor-de-diagnostico.md`). Trocar a autonota por itens âncora. Travar o estágio por dimensões críticas. Versionar as regras.
3. **Questionário para quem não é especialista.** Linguagem de 6º–8º ano, ajuda contextual, "não sei" só para números, calculadora de CAC/LTV, salvar e retomar, máscaras e validação de moeda (regra `form-fields-masks-and-validation`).
4. **Histórico, comparação e evolução.** Empresa como entidade gerenciável, diagnósticos em rascunho/concluído/arquivado, comparação com o anterior, resultado imutável após concluir.
5. **Duas pontas, um modelo.** Modo empresa (1 empresa em foco) e modo consultoria (lista), com os mesmos objetos. A ponte entre Plays por arquivo é opcional.
6. **Saídas e portabilidade.** Resultado, plano priorizado, PDF, backup e importação.
7. **Marca e nomenclatura próprias.** Estágios, nome do produto e termos sem dependência de vocabulário possivelmente interno da V4 (PPA, "vacinas", CREP).
8. **Distribuição e operação no Play.**
   - SQLite em WAL; Prisma fixado em `^7.10.1` (o `latest` hoje é o 8 RC).
   - O `.db` nunca vai no pacote; `migrate deploy` no `postinstall`; `schema_version` no manifest.
   - Bind em `127.0.0.1`; `GET /api/aioson-play`.
9. **Privacidade (LGPD).**
   - Os números da empresa (PJ) não são dado pessoal; os dados de contato são.
   - Coleta mínima; excluir ou anonimizar empresa; dados ficam locais (`researchs/ferramentas-diagnostico-mercado/summary.md` §4).

## Risks

| # | Risco | Tipo | Evidência | Mitigação candidata |
|---|---|---|---|---|
| R-01 | **Marca:** rótulos "V1–V4" e o nome "V-Stage" evocam a V4 Company, marca registrada no INPI na classe 35 (processos 912895276 e 918130603). O app pode ser notificado ou recusado na loja | Viabilidade/legal | `researchs/v4-company-metodo/summary.md` §8 | Decidido: nomenclatura própria (F2) e nome FitPulse (F3); busca no INPI antes de publicar |
| R-02 | **Conteúdo interno de franquia:** "PPA", "vacinas" e "Matriz CREP" não têm nenhuma fonte pública e parecem jargão interno. Reproduzi-los pode violar confidencialidade ou direito autoral | Legal | idem §4–6 | Descrever pela função ("testes de oferta de baixo orçamento", "matriz de riscos"); FOFA no lugar de "FUFA" |
| R-03 | **Diagnóstico errado causa dano:** o PRD ecoa notas autodeclaradas (M-11), usa limiares de mídia de R$10k/R$50k sem fonte (M-10) e constantes fixas de risco (M-24). Um estágio errado pode levar a PME a investir em mídia antes da hora, exatamente o dano que o produto quer evitar | Valor | `motor-de-diagnostico.md`; WMS (autonota sem relação com desempenho) | Decidido: itens âncora calculados (F1), trava por dimensões críticas (F4), riscos 5×5 por sinais (F6); confiança visível; calibração com casos reais (Q-15) |
| R-04 | **Abandono pelo leigo:** CAC, LTV e "Fit" são jargão; questionários longos geram respostas no automático | Usabilidade | NN/g (plain language); Wang et al. (77 itens = satisficing) | 25–35 itens; ajuda contextual; calculadora; teste com 5 donos (Q-14) |
| R-05 | **Instalação quebra na máquina do usuário:** `better-sqlite3` usa binário pré-compilado e, sem ele, compila (Visual Studio + Python no Windows); o `prisma@latest` instala o 8 RC | Viabilidade técnica | `researchs/ferramentas-diagnostico-mercado/summary.md` §5 | Fixar Prisma `^7.10.1`; testar instalação limpa pela loja em Windows x64/arm64 e macOS com o Node do Play (Q-11) |
| R-06 | **Perda de dados no update:** o Play sobrepõe o pacote novo e sobrescreve o que vier nele. Um `.db` publicado, um `db push --accept-data-loss` ou uma mudança de regra sem versão apagam ou distorcem o histórico | Viabilidade técnica | `software-update-compatibility.md` §10.1 | `.db` fora do pacote; só `migrate deploy`; `schema_version`; versão das regras por diagnóstico; backup exportável |
| R-07 | **Exposição na rede local:** sem auth, um servidor em `0.0.0.0` (padrão dos exemplos do Play) expõe faturamento, mídia e CAC/LTV para a rede do escritório | Segurança | `manifest-and-runtime.md` (exemplo `0.0.0.0`); `port-management.md` (webview em `127.0.0.1`) | Bind só em `127.0.0.1` nos dois processos; verificação de QA a partir de outra máquina |
| R-08 | **Diferenciação fraca:** existem diagnósticos gratuitos (Sebrae IMD, RD Station, CIGAM) | Viabilidade | `ferramentas-diagnostico-mercado` §1 | Decidido (F11): V1 gratuito para validar a demanda. Diferenciais: histórico/evolução, plano priorizado, calculadora, dados locais e sem funil de venda |
| R-09 | **Expectativa de benchmark impossível:** o PRD promete benchmark por segmento a partir de dados proprietários; cada instalação é isolada | Valor | PRD L18; decisão de independência | Não prometer benchmark no MVP; no modo consultoria, média do próprio portfólio com N visível (Optional) |
| R-10 | **Recomendação vista como consultoria financeira:** um plano que diz "aumente mídia" pode gerar prejuízo e responsabilização | Viabilidade/legal | Inferência | Decidido (F13): orientação + aviso curto no resultado e no PDF; aumento de investimento só com CAC/LTV de confiança alta |
| R-11 | **Escopo maior que MICRO:** gestão de Empresa e Diagnóstico, motor versionado, comparação, PDF e backup | Entrega | `expansion-scout.md` | Decidido: classificação MEDIUM aceita (F12); opcionais do V1 reduzidos a calculadora e PDF (F7) |
| R-12 | **Custo de não fazer:** sem régua, o dono de PME continua decidindo mídia por intuição ou por quem vende mídia | Inação | Tese do PRD (RF-01/RF-04) | — |

## Identified gaps

**Estado atual → estado desejado → delta.**

| # | Atual (PRD) | Desejado | Delta |
|---|---|---|---|
| G-01 | Runtime serverless `handler(context)`, 3000 ms (M-01) | Função pura de domínio chamada por rota Express; 3000 ms vira meta de desempenho | Reinterpretar RF-08 |
| G-02 | Stateless, sem entidade Empresa (M-02, M-30) | Empresa e Diagnóstico persistidos, com ciclo de vida e gestão completa | Modelo de dados e telas de gestão inexistentes no PRD |
| G-03 | Fits = nota 0–100 digitada (M-11, M-14) | Fits calculados de itens âncora, definidos como encaixes entre pares | Fonte decidida (F1); banco de perguntas e regra de cálculo **ainda não escritos** (G-14) |
| G-04 | Regras V1–V4 contraditórias e com lacunas (M-06 a M-10) | Regra de estágio sem sobreposição, coberta para todas as combinações e com limiares justificados | Trava por dimensão crítica decidida (F4); critérios mínimos por estágio a escrever (G-14) |
| G-05 | Pilares com 2 perguntas binárias e fórmulas divergentes do código (M-15 a M-20) | 4–6 itens âncora por pilar, normalizados de 0 a 100 | Banco de perguntas e regra de normalização |
| G-06 | Riscos com constantes fixas, possível lista vazia contra `minItems: 1`, sem campo de mitigação (M-21 a M-24) | Riscos derivados de sinais, escala documentada, mitigação por risco, estado "sem riscos críticos" | Catálogo de sinais → risco → mitigação; escala 5×5 com alerta ≥ 16 decidida (F6) |
| G-07 | Plano igual para V2/V3/V4 e cego às dimensões fracas (M-26, M-27) | Plano de 3–5 ações priorizado por dimensão e risco | Catálogo de ações por dimensão e nível |
| G-08 | Saída sem data, id, autor, versão das regras e confiança (M-29) | Resultado imutável com versão das regras e confiança; comparação definida entre versões de regras diferentes | Contrato de saída ampliado; política decidida (F10): recalcular o anterior e preservar o original |
| G-14 | Banco de perguntas, âncoras, limiares e catálogos de risco e ação inexistentes; sem dono do conteúdo | Conteúdo metodológico v1 escrito, revisado por quem tem autoridade no método e calibrado com casos reais | Decidido (F5): @product rascunha no PRD a partir de `researchs/`, o dono aprova; calibração (Q-15) |
| G-15 | Endpoints do PRD sem decisão sobre o que o assistente do Play enxerga (PROM-008) | `GET /api/aioson-play` com saúde e leitura do resumo do último diagnóstico por empresa; nenhuma escrita por fora da interface | Decidido (F9) |
| G-09 | Sem rascunho, retomada, configurações ou exclusão (`expansion-scout.md`, Missing Management Surfaces) | Rascunho, retomar, descartar, arquivar e restaurar; Configurações; excluir/anonimizar | Superfícies de gestão |
| G-10 | Nenhuma direção visual: há só um wireframe ASCII cujos números são impossíveis pelas fórmulas (M-19, M-23) e nenhum protótipo ou registro de identidade | Autoridade visual resolvida antes do PRD | **Gap de autoridade visual:** rota decidida: protótipo pelo @refiner; a direção aprovada vira o sistema de design (F14) |
| G-11 | Nomenclatura dependente da V4 (V1–V4, PPA, CREP, "vacinas", FUFA) | Vocabulário próprio e explicável a leigo | Decidido (F2): nomes próprios; nome do produto FitPulse (F3) |
| G-12 | Home de decisão inexistente (só a tela de resultado) | Home com 3–6 widgets por modo, foco dominante e drill-down | Definição dos widgets pelo @product |
| G-13 | Restrições de superfície em prosa (acessibilidade, estados vazios, desempenho) | Restrições como critérios de aceite observáveis (`expansion-scout.md`, Observable check) | @product converte em ACs |

## Sources

### Source Inventory

Os fingerprints foram calculados com `sha256sum`. O `aioson briefing:sources . --json` não emite fingerprint para arquivos soltos em `plans/` (só para pacotes `plans/{slug}/`), e as pesquisas em `researchs/` ficam fixadas da mesma forma (`feature-completeness-contract.md`).

| Source | Path | Type | Role | Fingerprint | Usage | Purpose |
|---|---|---|---|---|---|---|
| SRC-001 | plans/plano-de-desenvolvimento-inicial.md | documentation | intent | sha256:3592670a5ff34d986dd223f820d8f552d932d91244e57a235f6d50c0405573aa | consulted | PRD técnico do dono: frameworks, RFs, schemas, endpoints, handler, UI e prompts |
| SRC-002 | plans/detalhes-do-app.md | documentation | intent | sha256:598136908e3248826e2d577337cf5bdf6f1232483a46bd30ad8c2af00e4cb30d | consulted | Nome, subtítulo e racional do nome do app |
| SRC-003 | researchs/v4-company-metodo/summary.md | research | evidence | sha256:17308fcf90777278a02c5a899a911076e1db328716128bc45cc46dd851195412 | consulted | Método V4, Steps, termos sem fonte pública, marcas no INPI (R-01, R-02) |
| SRC-004 | researchs/growth-frameworks-diagnostico/summary.md | research | evidence | sha256:8eb9cbfad57736633fd40a78c61cdaaa3c0a28e3be06c1391fe9c08404ab8d59 | consulted | Base metodológica do motor: Four Fits, PMF, unit economics, maturidade de PME, risco, desenho de questionário |
| SRC-005 | researchs/ferramentas-diagnostico-mercado/summary.md | research | evidence | sha256:471fcee75a26487482b726f94867a5fc7ed56edaf26621a97a599ee424abe745 | consulted | Análogos, padrões de workflow, Martech 2025/2026, LGPD, fact-check técnico |

### Source Promise Map

| PROM | Source | Locator | Approved intent | State |
|---|---|---|---|---|
| PROM-001 | SRC-001 | §2 "Framework V1-V4", L28–36; RF-04 L113–122 | Classificar a empresa em quatro estágios sequenciais de maturidade de crescimento | required |
| PROM-002 | SRC-001 | RF-01 L85; RF-04 L117 | Sem CAC/LTV conhecidos, a empresa fica no estágio inicial (descoberta) | required |
| PROM-003 | SRC-001 | §2 "Framework dos 4 Fits", L50–57; RF-02 L92–100 | Pontuar 4 Fits de 0 a 100 com alerta de atrito crítico quando < 50 | required |
| PROM-004 | SRC-001 | §2 "Matriz dos 4 Pilares", L59–66; RF-03 L102–111 | Pontuar 4 Pilares (Tráfego, Engajamento, Conversão, Retenção) de 0 a 100 | required |
| PROM-005 | SRC-001 | §2 "Matriz CREP", L68–75; RF-05 L124–132 | Riscos com causa, risco, efeito, probabilidade, impacto, score e alerta crítico, mais mitigação prioritária | required |
| PROM-006 | SRC-001 | RF-06 L134–141; §2 PPA L38–48 | Plano de ação por estágio; no estágio inicial, orientar as etapas de pesquisa (persona, níveis de consciência, sazonalidade, FOFA, benchmark/PUV, oferta) e testes de oferta de baixo orçamento | required |
| PROM-007 | SRC-001 | RF-01 L81–90; RF-07 L143–149 | Validar a entrada e recusar dados inválidos com erro claro | required |
| PROM-008 | SRC-001 | §5 tabela de endpoints, L422–429 | API HTTP para avaliar, expor o schema de entrada e checar saúde | required |
| PROM-009 | SRC-001 | §1 L16; RF-08 L151–158; L431–439 | Executar como handler serverless ESM com timeout de 3000 ms | not_applicable |
| PROM-010 | SRC-001 | §1 L17 | Motores de IA para inferências qualitativas e geração dos planos | deferred |
| PROM-011 | SRC-001 | §1 L18 | Calibrar Fits e benchmarks por segmento com o grafo de 1,7 milhão de perfis da V4 | not_applicable |
| PROM-012 | SRC-001 | §1 "Casos de Uso Operacionais", L20–24 | Pré-vendas/qualificação, onboarding/kickoff e auditoria de carteira com transição de fase | required |
| PROM-013 | SRC-001 | §6 "Jornada do Usuário em 4 Passos", L658–683 | Jornada: coleta → avaliação de Fits/Pilares → processamento → dashboard | required |
| PROM-014 | SRC-001 | §6 "Wireframe ASCII do Dashboard", L686–741 | Dashboard com badge de estágio, barras de Fits/Pilares, riscos e plano | required |
| PROM-015 | SRC-001 | §1 "Contexto e Propósito", L7 | Contexto de mercado Martech (15.384 soluções, hypertail) | not_applicable |
| PROM-016 | SRC-002 | item 1 | Nome "V-Stage" (ou "FitPulse") com o subtítulo "Diagnostic & Growth Readiness Index" | required |
| PROM-017 | conversational 2026-10-22 | decisão "relação com a V4" | App independente, inspirado no método, sem marca nem dados da V4 | required |
| PROM-018 | conversational 2026-10-22 | "Vai ser um app instalavel dentro do play do cliente e ele vai se virar sozinho" | Instalável pela loja do Play e usável sozinho pelo dono da PME | required |
| PROM-019 | conversational 2026-10-22 | "profissionais possam usar o play para consultorias… ambas as pontas" | Também serve a consultores que atendem várias empresas | required |
| PROM-020 | conversational 2026-10-22 | decisão "histórico" | Diagnósticos guardados por empresa, com histórico | required |
| PROM-021 | conversational 2026-10-22 | "fique automatico ou um simples wizard de instalação que realmente funcione" | Instalação automática e wizard de primeiro uso que funcione | required |
| PROM-022 | conversational 2026-10-22 | "com relação a update… não vai ser problema né?" | Atualizações pela loja preservam os dados | required |
| PROM-023 | conversational 2026-10-22 | "daria para criar o app sem o aioson-auth?" | Sem aioson-auth e sem tela de login | required |
| PROM-024 | conversational 2026-10-22 | "software inspirado para pequenas empresas terem acesso" | Acessível a pequenas empresas: linguagem e esforço adequados a não especialistas | required |

Notas de estado:
- **PROM-009:** o runtime não existe no Play (M-01). A intenção vira "cálculo rápido como função de domínio".
- **PROM-011:** a decisão de independência o torna inaplicável; benchmark próprio fica em V2 (R-09).
- **PROM-015:** é contexto, não comportamento. Se for citado em material do app, use "Martech Landscape 2025".
- **PROM-016:** o nome segue como intenção, mas depende de Q-2 (R-01).

### Pesquisa consultada (cache em `researchs/`)

- `researchs/v4-company-metodo/summary.md`, 16 fontes. Porte da V4, Método V4 (pilares em duas nomenclaturas), Steps V1–V4 (V4 = "Setorização"), PPA/vacinas/CREP sem fonte pública, Four Fits de Balfour, ausência de autodiagnóstico V4, marcas no INPI.
- `researchs/growth-frameworks-diagnostico/summary.md`, 29 fontes. Four Fits (Balfour), teste de Sean Ellis, retenção (Lenny), LTV:CAC e payback (Skok, Shopify), níveis de consciência (Schwartz), BCG/Google, Sebrae IMD, Radar da Inovação, Churchill & Lewis, World Management Survey, matrizes de risco (NIST SP 800-30, Cox 2008), desenho de questionário (Pew, Krosnick).
- `researchs/ferramentas-diagnostico-mercado/summary.md`, 47 fontes. Análogos (Sebrae, RD Station, CIGAM, ScoreApp, Pointerpro, Pedowitz, DESelect), padrões de wizard e linguagem simples (NN/g), números Martech 2025/2026 (chiefmartec), LGPD (Lei 13.709, guias ANPD, Res. CD/ANPD 2/2022), fact-check de Prisma 7 + SQLite, Express 5, Ajv e Zod 4.
- Docs do Play no repositório: `.aioson/docs/integrations/app-database-choice.md`, `software-update-compatibility.md`, `port-management.md`, `app-cloud-auth.md`, `ai-app-integration.md`; `.aioson/docs/play/manifest-and-runtime.md`.

## Open questions

1. **[decision-required]** **Resolvido (F1: calculadas a partir de perguntas descritivas).** Pergunta original: Os scores dos Fits e Pilares serão **calculados a partir de itens com âncoras descritivas** (recomendado pela pesquisa, porque autonotas são otimistas e não predizem desempenho) ou continuam **digitados de 0 a 100** como no PRD?
2. **[decision-required]** **Resolvido (F2 e F3: nomes próprios e nome FitPulse; a validação jurídica continua pendente antes de publicar).** Pergunta original: Nomenclatura própria dos estágios (ex.: "Estágio 1–4" com nomes como Descoberta, Ajuste, Escala, Estruturação) e confirmação do nome do produto (V-Stage, FitPulse ou outro), dado o risco de marca R-01. A validação jurídica antes de publicar é **[research-able]**.
3. **[decision-required]** Manter os nomes dos 4 Fits do PRD na interface, mas defini-los como **encaixes entre pares** (Balfour: Mercado–Produto, Produto–Canal, Canal–Modelo, Modelo–Mercado)? Ou manter a definição isolada do PRD?
4. **[decision-required]** **Resolvido (F4: trava pelas dimensões críticas, com sinais relativos ao porte).** Pergunta original: Regra de estágio:
   - **trava por dimensões críticas** (recomendado) × regras do PRD;
   - limiares de investimento em mídia **fixos em R$** (R$10k/R$50k, sem fonte pública) × **relativos** (mídia/faturamento, LTV:CAC, payback).
5. **[decision-required]** **Resolvido (F6: matriz 5×5 com alerta ≥ 16, riscos gerados por sinais).** Pergunta original: Matriz de risco: **5×5 com alerta ≥ 16** (convenção mais comum; recomendado) × 10×10 com corte ≥ 50 do PRD (pelo NIST, 50 = "Moderate"). Os riscos passam a ser **gerados por sinais**?
6. **[decision-required]** Quem diz que conhece CAC/LTV mas não informa o valor fica no estágio inicial ou recebe erro de validação (M-06)? Com a calculadora, a recomendação é: estágio inicial com confiança baixa e a ação "medir".
7. **[decision-required]** **Resolvido (F7: a calculadora entra no V1).** Pergunta original: A **calculadora de CAC/LTV** entra no MVP? Recomendado: sim, ela ataca a dor central.
8. **[decision-required]** **Resolvido (F7: fica fora do V1).** Pergunta original: A **ponte entre Plays por arquivo** (cliente responde no Play dele, consultor importa) entra no V1?
9. **[decision-required]** **Resolvido (F7: ficam fora do V1).** Pergunta original: Ações do plano com status "feito" e lembrete de reavaliação entram no V1?
10. **[decision-required]** **Resolvido (F7: o PDF entra no V1, sem marca do consultor).** Pergunta original: O **relatório PDF** entra no MVP? Recomendado: sim, é table stake. A marca do consultor no PDF seria Optional V1.
11. **[research-able]** Qual versão do Node o Play usa para apps instalados pela loja, e há binário pré-compilado de `better-sqlite3 ^12.6` para Windows x64/arm64 e macOS x64/arm64 nessa ABI?
12. **[research-able]** O Play exige login no aioson.com para abrir apps? O dono afirma que sim; a doc `app-cloud-auth.md` ainda trata o token como opcional. A resposta não muda a decisão sem auth, só o texto de segurança.
13. **[research-able]** Desinstalar o app no Play apaga a pasta do app, e com ela o SQLite? Isso define se o "exportar dados" precisa ser oferecido antes de desinstalar.
14. **[testable]** Um dono de PME conclui o primeiro diagnóstico em ≤ 15 minutos sem ajuda? Teste: 5 entrevistas cognitivas com o questionário rascunhado.
15. **[testable]** O motor coloca 5 a 10 casos reais de PME no estágio que um consultor experiente atribuiria? Teste: calibração antes de congelar a versão 1 das regras.
16. **[decision-required]** **Resolvido (F14: protótipo pelo @refiner; a direção aprovada vira o sistema de design).** Pergunta original: Direção visual (G-10): rodar protótipo com o @refiner, ou originar a partir da intenção com anti-objetivos declarados? Exemplos de anti-objetivo: "não parecer planilha", "não parecer funil de venda".
17. **[decision-required]** **Resolvido (F11: gratuito no V1).** Pergunta original: Modelo comercial na loja (gratuito, pago ou freemium). Afeta R-08 e o que entra como diferencial pago (PDF, modo consultoria).
18. **[decision-required]** **Resolvido (F12: classificação MEDIUM aceita).** Pergunta original: Reclassificar o projeto de MICRO para **SMALL** em `project.context.md`, dado o escopo recomendado (R-11)? Cabe ao @product confirmar.
19. **[decision-required]** **Resolvido (F13: orientação com aviso curto no resultado e no PDF).** Pergunta original: Tom e limites das recomendações (R-10): o app se posiciona como "orientação" e exibe um aviso de que não substitui consultoria financeira?
20. **[testable]** Donos de PME reconhecem a dor central e usariam o app?
    - A dor ("decido mídia sem saber CAC/LTV") vem da tese do PRD, não de usuários observados.
    - Teste: nas mesmas 5 entrevistas da Q-14, perguntar como decidiram o último gasto com marketing e se refariam o diagnóstico em 3 meses.
21. **[decision-required]** **Resolvido (F10: recalcular o anterior com as regras atuais e preservar a nota original).** Pergunta original: Comparar diagnósticos feitos com **versões diferentes das regras**: só exibir com aviso "regras diferentes", ou **recalcular o anterior com as regras novas** (as respostas ficam guardadas), mantendo também a nota original? Recomendado: recalcular para comparar e preservar a original como registro.
22. **[decision-required]** **Resolvido (F5: o @product rascunha a partir da pesquisa e o dono aprova).** Pergunta original: Quem **escreve e aprova o conteúdo metodológico**: as 25–35 perguntas com âncoras, os limiares, o catálogo de sinais → riscos e o catálogo de ações do plano? É conteúdo de domínio, não código: @product estrutura e @dev implementa, mas alguém com autoridade no método precisa assinar a versão 1. O dono ou um especialista convidado?
23. **[out-of-scope]** Benchmark entre empresas de instalações diferentes (exige nuvem e tratamento de privacidade): V2.
24. **[out-of-scope]** Plano gerado por IA (PROM-010): V2, depois que as regras determinísticas estiverem calibradas.
25. **[out-of-scope]** Check-in mensal de números e workspace de execução das etapas de pesquisa (PPA): V2.

## Additional files

- `.aioson/briefings/diagnostico-maturidade/motor-de-diagnostico.md`: 30 achados de consistência do PRD (M-01 a M-30), com linha de origem.
- `.aioson/briefings/diagnostico-maturidade/solution-options.md`: opções A–D, comparação e recomendação.
- `.aioson/briefings/diagnostico-maturidade/expansion-scout.md`: mapa de possibilidades, mapa de experiência, superfície operacional e forma provável do MVP.
