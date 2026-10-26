---
slug: diagnostico-maturidade
theme: motor-de-diagnostico
created_at: 2026-10-22
source: plans/plano-de-desenvolvimento-inicial.md (SRC-001)
---

# Tema — Consistência do motor de diagnóstico (PRD técnico × schema × código × wireframe)

> Análise de evidência do PRD técnico do dono. Cada item cita a linha de `SRC-001`. Nada aqui é decisão: são contradições e lacunas que @product precisa resolver (ou delegar com default explícito) antes de o motor virar requisito.

## 1. Runtime e arquitetura

| # | Achado | Locator | Tipo | Impacto |
|---|---|---|---|---|
| M-01 | O PRD assume runtime **serverless** `export async function handler(context)` com `context.payload`/`context.env` e **timeout de 3000 ms**. Os docs do Play neste repositório não descrevem esse runtime: apps são processos Node iniciados pelo Play (`PORT`/`BACKEND_PORT`), e o contexto confirmado é Express + React (Vite) split-stack + Postgres gerenciado. | L16, L151–158, L431–439, L775–800 | Contradição com o projeto | Alto: o handler vira uma **função pura de domínio** chamada por uma rota Express; os 3000 ms passam de limite de runtime a meta de desempenho. |
| M-02 | "Sem estado (stateless)" contra o caso de uso "Auditoria de Carteira Ativa… análise contínua… transição de fase" e contra a decisão do dono de guardar histórico por empresa. | L16, L24 | Contradição | Alto: entram persistência, entidades e versionamento do cálculo. |
| M-03 | "Motores de IA (Claude)… inferências sobre insumos qualitativos" e "First-Party Data Graph… 1,7 milhão de perfis… benchmarks por segmento". O schema de entrada não tem nenhum campo qualitativo, e o dono decidiu que o app é **independente** (sem dados proprietários da V4). | L17–18 | Promessa sem base | Alto: os benchmarks por segmento precisam de outra fonte, ou saem do escopo. |
| M-04 | RF-01 pede **HTTP 400** para JSON malformado, mas um handler que recebe `context.payload` já parseado não tem como observar JSON malformado. Isso só faz sentido na camada HTTP (Express). | L88, L442 | Camada errada | Baixo: fica para @planner. |
| M-05 | RF-07 exige Ajv/Draft-07. A stack confirmada lista `zod` no backend. A escolha do validador é de implementação; o requisito de produto é "rejeitar entrada inválida com erro por campo". | L143–149 | Detalhe técnico | Baixo. |

## 2. Classificação V1–V4 (RF-01, RF-04)

| # | Achado | Locator | Tipo |
|---|---|---|---|
| M-06 | A regra de negócio do RF-01 diz: `knows_cac_and_ltv=true` com CAC/LTV `null` → **classificar como V1**. O critério de aceite do mesmo RF diz: aceitar `null` **somente** quando `knows=false`, ou seja, rejeitar com 422. As duas regras se excluem. | L85 × L90 | Contradição interna |
| M-07 | A regra V2 é "investimento ≤ 10.000 **ou** time generalista". A V3 é "10.000 < investimento ≤ 50.000". Uma empresa generalista com R$ 30.000/mês cai em V2 pela regra e em V3 pelo código (L482). | L118–119 × L482 | Sobreposição |
| M-08 | Investimento > 50.000 **sem** divisão totalmente especializada não está coberto por nenhuma regra. O código manda para V3, e o RF-04 não diz isso. | L119–120 × L479–484 | Lacuna |
| M-09 | `partially_specialized` não é usado em nenhum lugar. `monthly_revenue` é coletado e nunca entra no cálculo. A relação **LTV > 3×CAC**, citada como critério do Model Fit, nunca é calculada, embora os valores de CAC e LTV estejam no payload. | L55, L191–216 | Insumo ocioso |
| M-10 | Os limiares de mídia (R$ 10.000 e R$ 50.000) são valores nominais fixos em BRL, sem relação com o faturamento (mídia/receita), o segmento ou o ticket. A descrição de V3 também exige "processo de vendas validado e previsível" e "capacidade financeira", e nada disso é medido. | L35, L118–120 | Critério raso |

## 3. 4 Fits (RF-02)

| # | Achado | Locator | Tipo |
|---|---|---|---|
| M-11 | O RF-02 diz "**calcular** uma pontuação… para cada Fit", mas o input já recebe `*_fit_score` de 0 a 100. A saída é **eco da autoavaliação**, sem nenhum cálculo. Não há perguntas, evidências nem pesos por Fit. | L94 × L219–249 × L492–498 | Lacuna central |
| M-12 | "Média geral **ponderada**" e "média aritmética **simples**" aparecem no mesmo RF. | L94 × L100 | Contradição |
| M-13 | O RF-02 exige `critical_alert: true` por Fit < 50, mas o schema de saída `fits_scores` tem `additionalProperties: false` e não tem campo de alerta. O wireframe exibe "(ALERTA CRÍTICO)" no Fit. | L97 × L349–365 × L705 | Schema impede o requisito |
| M-14 | A nomenclatura dos Fits (PMF, Monetization/Model, Channel, Market) diverge do framework público de origem (Four Fits de Brian Balfour, que avalia **pares**: Market-Product, Product-Channel, Channel-Model e Model-Market). Ver `researchs/growth-frameworks-diagnostico/summary.md`. | L50–57 | Divergência de método |

## 4. 4 Pilares (RF-03)

| # | Achado | Locator | Tipo |
|---|---|---|---|
| M-15 | **Engajamento:** a regra só define a base com landing page (50). A base sem LP fica indefinida no RF, e o código usa 20. O máximo possível é 80: o pilar nunca chega a 100. | L107 × L516 | Lacuna + teto implícito |
| M-16 | **Conversão:** o RF dá 50/30/10 + 25 (sem atrito), com máximo de 75. O código soma **+25 por `has_crm`**, regra ausente no RF. | L108 × L528 | Código ≠ requisito |
| M-17 | **Retenção:** o RF só define o teto de 30 quando ambos são falsos, mas, pelo código, ambos falsos dão **0**, então o teto nunca atua. Os casos positivos (50/100) não estão no RF. | L109 × L532–541 | Regra inócua + lacuna |
| M-18 | **Tráfego:** só múltiplos de 20. `active_channels_count` é declarado sem lista de canais e sem qualidade de cada canal. | L106 | Granularidade |
| M-19 | O wireframe mostra valores **impossíveis** pelas fórmulas: Tráfego 50 (só múltiplos de 20), Retenção 15 (só 0/50/100) e Conversão 35 rotulada "Atrito em checkout" (35 só ocorre **sem** atrito). | L715–718 | Exemplo inconsistente |
| M-20 | Cada pilar tem 2 perguntas binárias ou de enum. É pouco sinal para um índice de 0 a 100 apresentado como diagnóstico, e falta separar "não sei" de "não tenho". | L251–316 | Profundidade |

## 5. Matriz CREP (RF-05)

| # | Achado | Locator | Tipo |
|---|---|---|---|
| M-21 | O RF-05 exige **1 a 5 riscos** (`minItems: 1`), mas o código só tem 3 regras de risco e pode devolver **0** (V2+ com Fits ≥ 50 e Retenção > 30), violando o próprio schema de saída. | L131, L385–386 × L551–596 | Bug de contrato |
| M-22 | Risco ≥ 50 deve gerar "recomendação de mitigação prioritária", mas não há campo para isso no schema nem no código. | L129 × L387–399 | Schema impede o requisito |
| M-23 | O wireframe mostra score 81 para o risco de Model Fit, e o código calcula 8×10 = 80. | L724 × L569–571 | Exemplo inconsistente |
| M-24 | Probabilidade e impacto são constantes fixas no código (9/9, 8/10, 7/8). Não vêm de evidência da empresa, então todo risco disparado é sempre "crítico". | L554–587 | Score sem variação |
| M-25 | "Fit < 50 → alerta crítico" e "risk_score ≥ 50 → alerta crítico" usam o mesmo número 50 com semânticas diferentes. Há risco de confusão na interface. | L97, L75 | Terminologia |

## 6. Plano de ação (RF-06)

| # | Achado | Locator | Tipo |
|---|---|---|---|
| M-26 | O RF-06 pede planos distintos para V2 (otimização de canais), V3 (expansão de escala) e V4 (DRE/margem). O código devolve **o mesmo plano genérico** para V2, V3 e V4. | L139 × L615–627 | Código ≠ requisito |
| M-27 | O plano ignora os Fits e Pilares fracos e os riscos críticos detectados: só depende do estágio. Um V2 com Retenção 0 recebe o mesmo plano de um V2 com Retenção 100. | L598–627 | Lacuna de valor |
| M-28 | Os 7 componentes do PPA são só citados no plano V1. O app não captura nem acompanha a execução do PPA. | L40–48, L138 | Oportunidade (V2) |

## 7. Saída e histórico

| # | Achado | Locator | Tipo |
|---|---|---|---|
| M-29 | A saída não tem identificador, data do diagnóstico, autor, **versão da metodologia ou das regras de pontuação**, nem nível de confiança dos dados. Sem a versão, comparar diagnósticos ao longo do tempo fica inválido quando as regras mudarem. | L324–419 | Lacuna (histórico) |
| M-30 | Não existe o conceito de **empresa** separado do diagnóstico (`company_info.name` é uma string solta). O histórico por empresa exige entidade própria e deduplicação (mesmo nome, CNPJ). | L187–190 | Lacuna (modelo) |

## Síntese para @product

- **Decidir antes de qualquer regra:** fonte dos scores de Fit (autoavaliação direta × perguntas ancoradas em evidência × derivação de dados); regra de fronteira V2/V3/V4 (M-06 a M-08); e o tratamento de "conhece CAC/LTV, mas não informou" (M-06).
- **Corrigir no contrato de saída:** alerta por Fit (M-13), mitigação por risco (M-22), lista de riscos possivelmente vazia (M-21) e versão das regras (M-29).
- **Não herdar:** o runtime serverless (M-01), os números do wireframe (M-19, M-23) e as constantes fixas de probabilidade e impacto (M-24).
