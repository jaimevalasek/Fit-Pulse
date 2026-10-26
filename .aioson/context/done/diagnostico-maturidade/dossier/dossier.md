---
feature_slug: diagnostico-maturidade
schema_version: "1.2"
created_by: dossier-init
created_at: 2026-10-22T19:24:35.458Z
status: active
classification: MICRO
last_updated_by: dossier-init
last_updated_at: 2026-10-22T19:24:35.458Z
---
## Why


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

## What


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
   - Fits e Pilares **calculados** a partir de itens com âncoras, nunca digitados.
   - Os 4 Fits definidos como **encaixes entre pares**, como no framework de Brian Balfour de onde vêm: Mercado–Produto, Produto–Canal, Canal–Modelo e Modelo–Mercado.
   - Estágio geral com **trava pelas dimensões críticas** (não existe "escala" com LTV:CAC < 1) e estágio por dimensão.
   - Riscos **gerados por sinais** (LTV:CAC < 1, mais de 70% dos clientes de um canal, CAC desconhecido, fatia de mercado necessária acima de 30%), com estado explícito "nenhum risco crítico".
   - Confiança do resultado (alta, média ou baixa) conforme a proporção de dados medidos, estimados ou desconhecidos.
   - **Versão das regras** gravada em cada diagnóstico, para que atualizações do app não reescrevam notas antigas.
5. **Resultado que orienta.**
   - Estágio com nome simples e o porquê, Fits e Pilares, riscos e confiança.
   - Plano de 3 a 5 ações priorizado pelas **dimensões mais fracas e pelos riscos**, não só pelo estágio (corrige M-26/M-27).
6. **Histórico e comparação.** Linha do tempo por empresa. O novo diagnóstico parte das respostas anteriores e, ao concluir, mostra o delta de cada dimensão e a mudança de estágio. Esse é o diferencial que o mercado quase não entrega.
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

**Menor fatia coerente** (Core):
- wizard de primeiro uso;
- Empresa com gestão completa;
- Diagnóstico com rascunho, retomada e conclusão;
- motor versionado;
- resultado com estágio, scores, riscos (inclusive "nenhum"), plano e confiança;
- ajuda contextual.

Comparação com o anterior, calculadora de CAC/LTV, home de decisão, PDF e backup formam o **Recommended MVP**, a versão que de fato se diferencia do mercado.

**Optional V1** (alto valor por custo baixo, @product decide):
- exportar e importar respostas por arquivo entre Plays (o cliente responde no Play dele e o consultor importa e conclui);
- marcar ações do plano como feitas;
- lembrete de reavaliação (padrão 90 dias).

**Alternativas consideradas:**
- **A**, calculadora fiel ao PRD sem histórico: viola a decisão de histórico.
- **C**, painel contínuo com check-in mensal de números: melhor candidato a V2.
- **D**, consultor-first: só a ponte por arquivo e o PDF com marca do consultor sobem para Optional V1.

Detalhe em `solution-options.md` e `expansion-scout.md`.

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

<!-- sha256:8402971c89aabccb27dbf444f52674d47bd881ab3344dd5f3a8642bdf996fb72 -->
**2026-10-22T19:24:35.461Z** | @briefing | _Agent Trail_

Briefing criado: 9 temas, 12 riscos, 25 perguntas abertas (16 decision-required); 3 pesquisas em researchs/; revisão framing decision_required

<!-- sha256:e66eb7acaac02139e2294c2cf7ab6a91d046aeff11ba4e53eb4956af658485ea -->
**2026-10-23T00:53:29.585Z** | @product | _Agent Trail_

PRD: .aioson/context/prd-diagnostico-maturidade.md; resultado: autodiagnóstico guiado com histórico (Option B) com estágio por trava, calculadora CAC/LTV, plano de 3 ações, comparação versionada, PDF e cópia; conteúdo metodológico v1 aprovado pelo dono; deferidos: ponte entre Plays, ações com status, lembrete, benchmark, plano por IA (F7/nuvem/calibração); 12 CAPs required, 49 ACs, 18 regras, 13 ramificações; classificação MEDIUM

<!-- sha256:372aa06cfff1332f2dfa08a5b7544c04e9d39562800dd1918614ce970b673784 -->
**2026-10-23T01:08:27.055Z** | @sheldon | _Agent Trail_

PRD enriched in place; value delta: motor determinístico com casos de referência G1-G4 (conferidos por script), ordem do plano com invest e desempate, arredondamento/exibição, divisões por zero (BR-dm-14/15), sem requisição externa e fontes empacotadas (RULE-dm-19); opportunity disposition: reavaliação focada nas perguntas fracas deferida para validação; acceptance criteria closed: 51 ACs; prototype deviations: explícitas (5); remaining risks: pesquisas do @planner (OQ-2..6), calibração (OQ-7)

<!-- sha256:1aa34e5b04045960c86726a3e8e9d4e03eb2528db480230556ca4723a9af8787 -->
**2026-10-23T03:07:24.386Z** | @planner | _Code Map_

Plan: .aioson/context/implementation-plan-diagnostico-maturidade.md (Gate C approved, PRD sha d9946f2e). Production entry: Play runs pnpm run dev / pnpm start -> concurrently tsx server/main.ts (127.0.0.1:BACKEND_PORT) + vite/vite preview (127.0.0.1:PORT, /api proxy); postinstall scripts/prepare-app.mjs (prisma generate, migrate deploy, vite build). Single package server/ + src/ + shared/; source-mode store publish. Vertical phases: 1 first diagnosis end-to-end on Play; 2 history+compare+PDF; 3 home+first-run+settings; 4 backup+store release. Orchestrated: lanes backend/frontend, 29 units in 13 waves, integration rows own e2e + harness.

<!-- sha256:e37df27e59c9b2e251b84c1adea4b6c26c8304e0403f65dd1a49c1260b78805a -->
**2026-10-25T01:58:21.854Z** | @qa | _Agent Trail_

QA verdict: PASS (Gate D aprovado). CAP/AC evidence: 12/12 CAPs, 51/51 ACs; 4 roteiros no app real via pnpm start com banco descartável (308/308 passos: browser/qa-journey-owner, qa-journey-history-settings, qa-journey-companies, qa-mobile-390); 757 testes de unidade/API e 52 e2e verdes; smoke-migrate, smoke-boot e smoke-store-package PASS. Production smoke: primeiro uso → 24 respostas → conclusão → PDF real de 3 páginas em Downloads. Blockers: nenhum. Residual: OBS-9d1a49 (frase do PDF 'limitado pela dimensão mais fraca' contradiz RULE-dm-04/06; corrigir na página 'Como ler' de relatorios-e-acompanhamento); conselhos MED em backupService e ResultPage.

## Revision Requests

_(vazio — populado a partir da Phase 2)_
