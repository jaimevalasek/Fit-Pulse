PRD Técnico — App 1: Diagnóstico de Maturidade V1-V4 & 4 Fits (Runtime AIOSON Play)

1. Visão Geral e Caso de Uso no Ecossistema

Contexto e Propósito Principal

O ecossistema global de Martech atingiu a marca de 15.384 soluções catalogadas (crescimento de 9% YoY), caracterizado pela consolidação de plataformas legadas — com uma taxa de churn/descontinuação de 8,6% (1.211 soluções removidas, das quais dois terços pertenciam à década de 2010–2020) — e pela explosão da hypertail. Esta última é impulsionada pela proliferação de "softwares instantâneos" (instant software) e práticas de vibe coding emergentes do uso de assistentes de inteligência artificial generativa (Claude, ChatGPT, Gemini). Nesse cenário de hiperfragmentação, a V4 Company consolida sua atuação como Martech Enabler para Revenue Growth, suportada por uma rede de mais de 250 escritórios franqueados, 4.000 profissionais e mais de 7.000 clientes ativos.

O App 1: Diagnóstico de Maturidade V1-V4 & 4 Fits é uma aplicação analítica projetada para execução serverless na runtime Node.js do ecossistema AIOSON Play. O objetivo do aplicativo é mensurar o grau de maturidade digital, operacional e de tração financeira das empresas assessoradas. O motor de diagnósticos processa variáveis quantitativas e qualitativas para classificar a organização nos estágios metodológicos V1 (Descoberta), V2 (Maturação), V3 (Escala) e V4 (Profissionalização), quantificar a taxa de alinhamento sistêmico nos 4 Fits (Product-Market Fit, Monetization/Model Fit, Channel Fit e Market Fit) e avaliar a eficiência operacional nos 4 Pilares do Método (Tráfego, Engajamento, Conversão e Retenção).

Arquitetura de Integrantes do Ecossistema

A tabela abaixo detalha o papel do App 1 no ecossistema tecnológico do AIOSON Play, motores de IA e ativos de dados proprietários:

Componente de Ecossistema	Papel do App 1
Runtime AIOSON Play (Node.js 20+ LTS)	Executa a lógica do aplicativo em ambiente serverless isolado e sem estado (stateless). O ciclo de vida do módulo é gerenciado com limite estrito de memória e tempo de execução (timeout máximo de 3000ms), recebendo os objetos context.payload e context.env via ES Modules (export async function handler(context)).
Motores de IA (Claude Code Execution Environment)	Executam inferências metodológicas sobre insumos qualitativos não estruturados, processam algoritmos de classificação avançada e automatizam a geração dos planos de ação táticos e relatórios descritivos.
Ativos de Dados Proprietários (First-Party Data Graph)	Consomem e cruzam o grafo de dados proprietário da V4 Company — composto por mais de 1,7 milhão de perfis de consumidores brasileiros enriquecidos cross-client — para calibrar as pontuações dos 4 Fits e calcular as estimativas de benchmarks por segmento.

Casos de Uso Operacionais

* Diagnóstico Pré-Vendas e Lead Qualification: Avaliação analítica de leads no funil de vendas B2B/Enterprise para identificar previamente a existência ou ausência de métricas essenciais (CAC/LTV), impedindo a oferta de estratégias de escala (V3/V4) para clientes em fase de descoberta (V1) e readequando a proposta comercial.
* Onboarding e Kickoff de Clientes (Fase PPA): Alimentação direta do processo metodológico de PPA (Pesquisa, Planejamento e Apresentação) no kickoff do projeto. O aplicativo consolida a pesquisa de Personas, Níveis de Consciência, Sazonalidade, Matriz SWOT/FUFA, Benchmarks e Ofertas para determinar o Step metodológico e alinhar OKRs/metas SMART.
* Auditoria de Carteira Ativa e Retenção: Análise contínua das contas ativas na carteira das operações franqueadas, identificando momentos de transição de fase (ex: V1 para V2 ou V2 para V3) para embasar iniciativas de expansão de escopo (land and expand), revisão de fee comercial e prevenção de churn.

2. Fundamentação Teórica e Arquitetura do Motor de Diagnóstico

Framework V1-V4 (Estágios de Maturidade)

O motor de diagnóstico aplica a metodologia da V4 Company para categorizar a maturidade da empresa em quatro estágios sequenciais, correlacionando previsibilidade de dados, capacidade de alocação de mídia e divisão especializada do trabalho:

Estágio de Maturidade	Foco Metodológico	Critérios Primários de Identificação	Tratamento de Dados de Mídia e Operação
V1 (Sem Dados / Descoberta)	Validação de hipóteses, construção do PPA e testes de "vacinas"/ofertas.	Ausência de histórico confiável de dados; desconhecimento ou valor nulo para CAC (Customer Acquisition Cost) e LTV (Lifetime Value).	Alocação pulverizada de verba para testes de baixo orçamento (P&D); objetivo focado em encontrar indicadores e validar o teto de CAC.
V2 (Maturação)	Consolidação e perpetuação das hipóteses validadas em V1.	Métricas de CAC e LTV devidamente mapeadas; identificação comprovada dos primeiros canais e campanhas validados.	Concentração do orçamento de mídia nos canais vencedores; eliminação de testes sem tração e busca de consistência no fluxo de caixa.
V3 (Escala)	Produção em massa, tração acelerada e expansão de mercado.	Processo de vendas validado, previsível e escalável; capacidade financeira para absorver volumes crescentes de investimento.	Investimento maciço e contínuo em mídia paga (> R$ 10.000/mês); expansão do alcance de mercado e aceleração exponencial de receita.
V4 (Profissionalização)	Divisão do trabalho, governança analítica e otimização de margens.	Operação estruturada em alta escala; necessidade de refino de DRE, EBITDA e Margem de Contribuição.	Equipes totalmente especializadas (mídia, design, CRM e business intelligence isolados); governança contínua do DRE e otimização fina da eficiência financeira.

Integração Metodológica com a Fase PPA (Pesquisa, Planejamento e Apresentação)

A classificação em V1 (Descoberta) orienta a execução obrigatória do ciclo PPA, o qual exige a estruturação e análise sistemática dos seguintes componentes de pesquisa:

1. Persona: Mapeamento de dores, transformações, objeções e ganchos de comunicação de múltiplos perfis compradores.
2. Níveis de Consciência: Avaliação da distribuição do público nos 5 estágios (Inconsciente, Consciente do Problema, Consciente da Solução, Consciente do Produto, Totalmente Consciente).
3. Sazonalidade: Mapeamento de picos e vales de demanda e criação de mecânicas comerciais para estabilização de receita.
4. Análise SWOT/FUFA: Mapeamento de Forças, Oportunidades, Fraquezas e Ameaças (fatores internos e externos).
5. Benchmark & Proposta Única de Valor: Análise competitiva dos 5 principais concorrentes e definição da Proposta Única de Valor (PUV).
6. Step V1-V4 e Histórico: Mapeamento do histórico de campanhas passadas e enquadramento formal da maturidade.
7. Oferta e Escada de Valor: Estruturação das iscas (front-end), produtos intermediários e ofertas core (back-end).

Framework dos 4 Fits

O índice de alinhamento sistêmico é calculado através da avaliação dos quatro eixos do modelo de Growth:

* Product-Market Fit (PMF): Avalia a tração e a aceitação do produto ou serviço pelo mercado-alvo, mensurada via taxas de retenção, satisfação (NPS/CSAT) e demanda orgânica espontânea.
* Monetization/Model Fit: Valida a adequação entre o modelo de cobrança (ex: assinatura, transactional, VAS - Value Added Service, margem de contribuição) e o valor percebido pelo cliente, garantindo a sustentabilidade da relação LTV > 3 \times CAC.
* Channel Fit: Mensura a aderência do produto e modelo de monetização aos canais de aquisição (Google Search, Meta Ads, TikTok, Inside Sales, PDV Físico, Marketplaces).
* Market Fit: Determina se o Tamanho Total de Mercado Endereçável (Total Addressable Market - TAM) comporta os custos de distribuição, precificação e metas de crescimento da empresa.

Matriz dos 4 Pilares do Método

O aplicativo avalia os quatro pilares operacionais interdependentes do crescimento:

* Tráfego: Avalia a capacidade de atrair atenção qualificada, mensurando volume de impressões, CPC, CPM e diversificação das fontes de mídia paga e orgânica.
* Engajamento: Mede a retenção e a nutrição da atenção capturada por meio de landing pages dedicadas, frequência de conteúdo e pontos de contato diretos (ex: WhatsApp).
* Conversão: Mede a eficiência na transformação da atenção engajada em transações comerciais financeiras, avaliando a estrutura da equipe de vendas (Inside Sales, Self-Service, Híbrido) e a eliminação de atritos no checkout/pagamento.
* Retenção: Avalia a capacidade de reter e extrair Lifetime Value da base de clientes ativa por meio de estratégias de recompra, réguas de CRM e programas de fidelização.

Matriz CREP (Análise de Riscos Operacionais)

A Matriz CREP (Causa, Risco, Efeito, Probabilidade e Impacto) mapeia rigorosamente as vulnerabilidades metodológicas da empresa. Cada risco identificado é pontuado numericamente:

\text{Risk Score} = \text{Probabilidade } [1..10] \times \text{Impacto } [1..10]

* A pontuação resultante (\text{Risk Score}) varia em um intervalo inteiro de 1 a 100.
* Regra do Limiar Crítico: Qualquer risco computado com \text{Risk Score} \ge 50 aciona automaticamente uma flag de alerta de criticidade no payload de saída e na interface visual do usuário.

3. Requisitos Funcionais Detalhados (RFs)

Listagem de Requisitos Funcionais

RF-01: Coleta e Validação Estrita do Payload de Entrada

* Descrição Ativa: O sistema deve receber o objeto JSON contendo os dados da empresa, respostas dos 4 Fits e métricas dos 4 Pilares, validando a estrutura de dados antes do processamento.
* Regras de Negócio:
  * Se o atributo knows_cac_and_ltv for false OU se os atributos cac_value ou ltv_value forem null ou ausentes, o motor de cálculo deve obrigatoriamente classificar a empresa no estágio de maturidade "V1".
  * Os campos monthly_revenue e monthly_media_investment não podem conter valores negativos.
* Critérios de Aceite:
  * Rejeitar payloads com sintaxe JSON malformatada retornando HTTP 400 Bad Request.
  * Rejeitar payloads que não cumpram a estrutura estipulada no Schema de Entrada retornando HTTP 422 Unprocessable Entity.
  * Aceitar valores null nos campos cac_value e ltv_value unicamente quando knows_cac_and_ltv for false.

RF-02: Scoring dos 4 Fits com Sinalização de Criticidade

* Descrição Ativa: O sistema deve calcular uma pontuação individualizada de 0 a 100 para cada um dos 4 Fits (Product-Market, Monetization/Model, Channel, Market) e a média geral ponderada.
* Regras de Negócio:
  * Cada Fit é pontuado no intervalo fechado de [0, 100].
  * Caso qualquer Fit apresente pontuação inferior a 50 pontos (< 50), o sistema deve emitir um sinalizador de atrito crítico (critical_alert: true) associado ao respectivo Fit.
* Critérios de Aceite:
  * Todos os scores de Fits retornados no payload de saída devem ser obrigatoriamente números inteiros no intervalo [0, 100].
  * O campo overall_fits_average deve conter a média aritmética simples dos 4 Fits formatada em número flutuante com duas casas decimais.

RF-03: Pontuação Operacional Ponderada dos 4 Pilares

* Descrição Ativa: O aplicativo deve processar as métricas declaradas dos 4 Pilares (Tráfego, Engajamento, Conversão, Retenção) e gerar um score individualizado de 0 a 100 para cada pilar.
* Regras de Negócio:
  * Tráfego: Calculado pela regra Math.min(100, active_channels_count * 20) somado a 20 pontos de bônus caso utilize mídia de busca (uses_search_ads), garantindo limite máximo (cap) em 100 pontos: Math.min(100, (active_channels_count * 20) + (uses_search_ads ? 20 : 0)).
  * Engajamento: Se has_dedicated_landing_pages for true, base de 50 pontos; adicão de 30 pontos para content_frequency == "consistent" e 10 pontos para "occasional".
  * Conversão: Calculado estritamente com base nos dados de conversion_metrics: atribuição de 50 pontos para sales_team_type igual a "inside_sales" ou "hybrid", 30 para "checkout_self_service", 10 para "none"; somado a 25 pontos se friction_points_identified for false (ausência de atritos de pagamento/checkout).
  * Retenção: Se has_repurchase_strategy for false E active_crm_campaigns for false, o score do Pilar de Retenção é obrigatoriamente limitado ao teto máximo de 30 pontos.
* Critérios de Aceite:
  * Todos os scores de pilares devem retornar números inteiros no intervalo [0, 100], aplicando truncamento ou arredondamento e respeitando o limite de limite superior (100).

RF-04: Classificação Automática de Estágio Metodológico (V1-V4)

* Descrição Ativa: O algoritmo deve combinar os dados de CAC/LTV, volume de investimento em mídia e grau de especialização do time para determinar o estágio final de maturidade.
* Regras de Negócio:
  * V1: Atribuído obrigatoriamente se knows_cac_and_ltv == false ou se valores de CAC/LTV forem null.
  * V2: Atribuído se métricas de CAC/LTV forem válidas, monthly_media_investment <= 10000 ou nível de especialização do time for genérico.
  * V3: Atribuído se métricas de CAC/LTV forem válidas, monthly_media_investment > 10000 e monthly_media_investment <= 50000.
  * V4: Atribuído se métricas de CAC/LTV forem válidas, monthly_media_investment > 50000 e team_specialization_level == "fully_specialized_division".
* Critérios de Aceite:
  * O atributo maturity_stage no JSON de saída deve conter estritamente uma das strings: "V1", "V2", "V3" ou "V4".

RF-05: Avaliação de Riscos Operacionais pela Matriz CREP

* Descrição Ativa: O sistema deve avaliar as fragilidades apontadas nos inputs e gerar um array contendo os fatores de risco mapeados segundo o modelo CREP.
* Regras de Negócio:
  * O cálculo do risk_score de cada risco é dado por \text{probability} \times \text{impact}.
  * Para qualquer risco cujo risk_score seja \ge 50, o sistema deve gerar uma recomendação de mitigação prioritária.
* Critérios de Aceite:
  * Retornar entre 1 e 5 objetos de risco estruturados na propriedade risk_analysis do JSON de saída.
  * O risk_score retornado deve corresponder exatamente à multiplicação dos campos probability e impact.

RF-06: Emissão do Plano de Ação Recomendado (Foco PPA)

* Descrição Ativa: O aplicativo deve gerar o plano tático estruturado de próximos passos metodológicos com base na maturidade diagnosticada.
* Regras de Negócio:
  * Para estágio V1, o plano de ação deve instruir explicitamente a execução do kickoff do ciclo PPA (Pesquisa, Planejamento e Apresentação), especificando as etapas de pesquisa (Persona, Níveis de Consciência, Sazonalidade, SWOT/FUFA, Benchmark, Step e Oferta) e o teste de "vacinas"/ofertas de baixo orçamento.
  * Para estágios V2, V3 e V4, o plano deve focar na otimização de canais validados, expansão de escala e otimização de DRE/margem de contribuição, respectivamente.
* Critérios de Aceite:
  * O objeto recommended_action_plan deve conter as chaves immediate_phase, key_objectives (array de strings) e next_steps (array de strings).

RF-07: Validação de Schema em Runtime

* Descrição Ativa: O aplicativo deve validar a conformidade estrutural do payload de entrada contra a especificação Draft-07 do JSON Schema antes do processamento lógico.
* Regras de Negócio:
  * A validação deve utilizar um validador nativo compatível com Draft-07 (ex: Ajv).
* Critérios de Aceite:
  * Caso o payload falhe na validação de tipos, campos obrigatórios ausentes ou valores fora dos limites especificados, a função deve interromper a execução e retornar HTTP 422 Unprocessable Entity.

RF-08: Padronização do Módulo de Runtime Serverless

* Descrição Ativa: O aplicativo deve expor uma interface funcional idempotente e sem estado para execução nativa na runtime Node.js 20+ LTS do AIOSON Play.
* Regras de Negócio:
  * A assinatura exportada deve utilizar a sintaxe ES Modules: export async function handler(context).
  * O tempo total de execução não deve exceder 3000\text{ ms}.
* Critérios de Aceite:
  * Retornar um objeto de resposta contendo as propriedades statusCode (inteiro) e body (objeto JSON estruturado).

4. Estrutura de Dados e JSON Schemas (Payloads de Entrada e Saída)

JSON Schema 1 (Input Payload - DiagnosisInputPayload)

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DiagnosisInputPayload",
  "type": "object",
  "required": [
    "company_info",
    "fits_questionnaire",
    "pillars_questionnaire"
  ],
  "additionalProperties": false,
  "properties": {
    "company_info": {
      "type": "object",
      "required": [
        "name",
        "monthly_revenue",
        "monthly_media_investment",
        "has_crm",
        "knows_cac_and_ltv",
        "team_specialization_level"
      ],
      "additionalProperties": false,
      "properties": {
        "name": {
          "type": "string",
          "minLength": 1
        },
        "monthly_revenue": {
          "type": "number",
          "minimum": 0
        },
        "monthly_media_investment": {
          "type": "number",
          "minimum": 0
        },
        "has_crm": {
          "type": "boolean"
        },
        "knows_cac_and_ltv": {
          "type": "boolean"
        },
        "cac_value": {
          "type": ["number", "null"],
          "minimum": 0
        },
        "ltv_value": {
          "type": ["number", "null"],
          "minimum": 0
        },
        "team_specialization_level": {
          "type": "string",
          "enum": ["generalist", "partially_specialized", "fully_specialized_division"]
        }
      }
    },
    "fits_questionnaire": {
      "type": "object",
      "required": [
        "product_market_fit_score",
        "monetization_model_fit_score",
        "channel_fit_score",
        "market_fit_score"
      ],
      "additionalProperties": false,
      "properties": {
        "product_market_fit_score": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100
        },
        "monetization_model_fit_score": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100
        },
        "channel_fit_score": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100
        },
        "market_fit_score": {
          "type": "integer",
          "minimum": 0,
          "maximum": 100
        }
      }
    },
    "pillars_questionnaire": {
      "type": "object",
      "required": [
        "traffic_metrics",
        "engagement_metrics",
        "conversion_metrics",
        "retention_metrics"
      ],
      "additionalProperties": false,
      "properties": {
        "traffic_metrics": {
          "type": "object",
          "required": ["active_channels_count", "uses_search_ads"],
          "additionalProperties": false,
          "properties": {
            "active_channels_count": {
              "type": "integer",
              "minimum": 0
            },
            "uses_search_ads": {
              "type": "boolean"
            }
          }
        },
        "engagement_metrics": {
          "type": "object",
          "required": ["has_dedicated_landing_pages", "content_frequency"],
          "additionalProperties": false,
          "properties": {
            "has_dedicated_landing_pages": {
              "type": "boolean"
            },
            "content_frequency": {
              "type": "string",
              "enum": ["none", "occasional", "consistent"]
            }
          }
        },
        "conversion_metrics": {
          "type": "object",
          "required": ["sales_team_type", "friction_points_identified"],
          "additionalProperties": false,
          "properties": {
            "sales_team_type": {
              "type": "string",
              "enum": ["none", "inside_sales", "checkout_self_service", "hybrid"]
            },
            "friction_points_identified": {
              "type": "boolean"
            }
          }
        },
        "retention_metrics": {
          "type": "object",
          "required": ["has_repurchase_strategy", "active_crm_campaigns"],
          "additionalProperties": false,
          "properties": {
            "has_repurchase_strategy": {
              "type": "boolean"
            },
            "active_crm_campaigns": {
              "type": "boolean"
            }
          }
        }
      }
    }
  }
}


JSON Schema 2 (Output Payload - DiagnosisOutputPayload)

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DiagnosisOutputPayload",
  "type": "object",
  "required": [
    "company_name",
    "maturity_stage",
    "stage_description",
    "fits_scores",
    "pillars_scores",
    "risk_analysis",
    "recommended_action_plan"
  ],
  "additionalProperties": false,
  "properties": {
    "company_name": {
      "type": "string"
    },
    "maturity_stage": {
      "type": "string",
      "enum": ["V1", "V2", "V3", "V4"]
    },
    "stage_description": {
      "type": "string"
    },
    "fits_scores": {
      "type": "object",
      "required": [
        "product_market_fit",
        "monetization_model_fit",
        "channel_fit",
        "market_fit",
        "overall_fits_average"
      ],
      "additionalProperties": false,
      "properties": {
        "product_market_fit": { "type": "integer", "minimum": 0, "maximum": 100 },
        "monetization_model_fit": { "type": "integer", "minimum": 0, "maximum": 100 },
        "channel_fit": { "type": "integer", "minimum": 0, "maximum": 100 },
        "market_fit": { "type": "integer", "minimum": 0, "maximum": 100 },
        "overall_fits_average": { "type": "number", "minimum": 0, "maximum": 100 }
      }
    },
    "pillars_scores": {
      "type": "object",
      "required": [
        "traffic",
        "engagement",
        "conversion",
        "retention"
      ],
      "additionalProperties": false,
      "properties": {
        "traffic": { "type": "integer", "minimum": 0, "maximum": 100 },
        "engagement": { "type": "integer", "minimum": 0, "maximum": 100 },
        "conversion": { "type": "integer", "minimum": 0, "maximum": 100 },
        "retention": { "type": "integer", "minimum": 0, "maximum": 100 }
      }
    },
    "risk_analysis": {
      "type": "array",
      "minItems": 1,
      "maxItems": 5,
      "items": {
        "type": "object",
        "required": ["cause", "risk", "effect", "probability", "impact", "risk_score", "critical_alert"],
        "additionalProperties": false,
        "properties": {
          "cause": { "type": "string" },
          "risk": { "type": "string" },
          "effect": { "type": "string" },
          "probability": { "type": "integer", "minimum": 1, "maximum": 10 },
          "impact": { "type": "integer", "minimum": 1, "maximum": 10 },
          "risk_score": { "type": "integer", "minimum": 1, "maximum": 100 },
          "critical_alert": { "type": "boolean" }
        }
      }
    },
    "recommended_action_plan": {
      "type": "object",
      "required": ["immediate_phase", "key_objectives", "next_steps"],
      "additionalProperties": false,
      "properties": {
        "immediate_phase": { "type": "string" },
        "key_objectives": {
          "type": "array",
          "items": { "type": "string" }
        },
        "next_steps": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    }
  }
}


5. Endpoints API e Módulo Node.js (AIOSON Play Runtime)

Tabela de Endpoints API REST

Método HTTP	Rota API	Descrição Breve	Payload de Entrada	Status HTTP Sucesso	Status HTTP Erro
POST	/api/v1/diagnosis/assess	Executa o cálculo de maturidade V1-V4, pontuação dos 4 Fits, 4 Pilares e Matriz CREP.	DiagnosisInputPayload	200 OK	400 Bad Request, 422 Unprocessable Entity, 500 Internal Error
GET	/api/v1/diagnosis/schema/input	Expõe o contrato JSON Schema Draft-07 oficial aceito pelo payload de entrada.	Nenhum	200 OK	500 Internal Error
GET	/api/v1/diagnosis/health	Verifica a integridade operacional e a disponibilidade da runtime serverless.	Nenhum	200 OK	503 Service Unavailable

Implementação do Módulo Handler Node.js (Runtime Serverless AIOSON Play)

/**
 * App 1: Diagnóstico de Maturidade V1-V4 & 4 Fits
 * Target Runtime: Node.js 20+ LTS (AIOSON Play Serverless Environment)
 * Module Syntax: ES Module (ESM)
 */

export async function handler(context) {
  try {
    // 1. Desestruturação e Extração do Payload do Contexto
    const payload = context?.payload;

    // 2. Validação Rígida dos Nós de Primeiro Nível do Payload (Evita Unhandled TypeErrors)
    if (
      !payload ||
      typeof payload !== "object" ||
      !payload.company_info ||
      !payload.fits_questionnaire ||
      !payload.pillars_questionnaire
    ) {
      return {
        statusCode: 422,
        body: {
          error: "Unprocessable Entity",
          message: "Payload ausente ou estruturalmente inválido. Nós 'company_info', 'fits_questionnaire' e 'pillars_questionnaire' são obrigatórios."
        }
      };
    }

    const { company_info, fits_questionnaire, pillars_questionnaire } = payload;

    // 3. Validação do Critério Estrito de V1 (CAC/LTV)
    const knowsMetrics =
      Boolean(company_info.knows_cac_and_ltv) &&
      company_info.cac_value !== null &&
      company_info.cac_value !== undefined &&
      company_info.ltv_value !== null &&
      company_info.ltv_value !== undefined;

    // 4. Lógica de Algoritmo para Classificação de Maturidade (V1 - V4)
    let maturityStage = "V1";
    let stageDescription = "Descoberta: Ausência de histórico numérico de CAC/LTV. Necessidade imediata de validação da fase PPA e testes de oferta/vacinas.";

    const mediaInvestment = Number(company_info.monthly_media_investment || 0);
    const specialization = company_info.team_specialization_level;

    if (knowsMetrics) {
      if (mediaInvestment > 50000 && specialization === "fully_specialized_division") {
        maturityStage = "V4";
        stageDescription = "Profissionalização: Operação em alta escala com divisão especializada do trabalho e otimização contínua de DRE e Margem de Contribuição.";
      } else if (mediaInvestment > 10000) {
        maturityStage = "V3";
        stageDescription = "Escala: Processo de aquisição validado e previsível, focado em tração acelerada e expansão contínua de mídia paga.";
      } else {
        maturityStage = "V2";
        stageDescription = "Maturação: Métricas cruciais mapeadas (CAC/LTV) e verba alocada com consistência nos canais campeões.";
      }
    }

    // 5. Cálculo dos Scores dos 4 Fits e Média Geral Ponderada
    const fitsScores = {
      product_market_fit: Math.min(100, Math.max(0, fits_questionnaire.product_market_fit_score || 0)),
      monetization_model_fit: Math.min(100, Math.max(0, fits_questionnaire.monetization_model_fit_score || 0)),
      channel_fit: Math.min(100, Math.max(0, fits_questionnaire.channel_fit_score || 0)),
      market_fit: Math.min(100, Math.max(0, fits_questionnaire.market_fit_score || 0)),
      overall_fits_average: 0
    };

    fitsScores.overall_fits_average = Number(
      ((fitsScores.product_market_fit +
        fitsScores.monetization_model_fit +
        fitsScores.channel_fit +
        fitsScores.market_fit) / 4).toFixed(2)
    );

    // 6. Cálculo dos Scores dos 4 Pilares Operacionais (Limites 0-100)
    // Pilar Tráfego: Bounded math logic Math.min(100, active_channels_count * 20 + bonus)
    const activeChannels = pillars_questionnaire.traffic_metrics?.active_channels_count || 0;
    const usesSearch = Boolean(pillars_questionnaire.traffic_metrics?.uses_search_ads);
    const trafficScore = Math.min(100, (activeChannels * 20) + (usesSearch ? 20 : 0));

    // Pilar Engajamento
    const hasLP = Boolean(pillars_questionnaire.engagement_metrics?.has_dedicated_landing_pages);
    const contentFreq = pillars_questionnaire.engagement_metrics?.content_frequency;
    let engagementScore = hasLP ? 50 : 20;
    if (contentFreq === "consistent") engagementScore += 30;
    else if (contentFreq === "occasional") engagementScore += 10;
    engagementScore = Math.min(100, engagementScore);

    // Pilar Conversão: Alinhado estritamente às propriedades de conversion_metrics
    const salesType = pillars_questionnaire.conversion_metrics?.sales_team_type;
    const hasFriction = Boolean(pillars_questionnaire.conversion_metrics?.friction_points_identified);
    let conversionScore = 10;
    if (salesType === "inside_sales" || salesType === "hybrid") conversionScore = 50;
    else if (salesType === "checkout_self_service") conversionScore = 30;
    if (!hasFriction) conversionScore += 25;
    if (company_info.has_crm) conversionScore += 25;
    conversionScore = Math.min(100, conversionScore);

    // Pilar Retenção: Regra de trava em no máximo 30 pontos caso faltem estratégias
    const hasRepurchase = Boolean(pillars_questionnaire.retention_metrics?.has_repurchase_strategy);
    const activeCRM = Boolean(pillars_questionnaire.retention_metrics?.active_crm_campaigns);
    let retentionScore = 0;
    if (hasRepurchase) retentionScore += 50;
    if (activeCRM) retentionScore += 50;
    if (!hasRepurchase && !activeCRM) {
      retentionScore = Math.min(30, retentionScore);
    } else {
      retentionScore = Math.min(100, retentionScore);
    }

    const pillarsScores = {
      traffic: trafficScore,
      engagement: engagementScore,
      conversion: conversionScore,
      retention: retentionScore
    };

    // 7. Processamento da Matriz de Riscos Operacionais (Matriz CREP)
    const riskAnalysis = [];

    if (!knowsMetrics) {
      const prob = 9;
      const imp = 9;
      const score = prob * imp;
      riskAnalysis.push({
        cause: "Desconhecimento dos indicadores históricos de CAC e LTV",
        risk: "Incapacidade de prever o retorno financeiro sobre o investimento em mídia",
        effect: "Risco iminente de descapitalização na tentativa de acelerar vendas",
        probability: prob,
        impact: imp,
        risk_score: score,
        critical_alert: score >= 50
      });
    }

    if (fitsScores.monetization_model_fit < 50) {
      const prob = 8;
      const imp = 10;
      const score = prob * imp;
      riskAnalysis.push({
        cause: "Desalinhamento grave no Monetization/Model Fit (Score < 50)",
        risk: "Modelo de precificação ou margem de contribuição incapaz de cobrir o CAC",
        effect: "Operação gera prejuízo acumulado proporcional ao volume de vendas",
        probability: prob,
        impact: imp,
        risk_score: score,
        critical_alert: score >= 50
      });
    }

    if (retentionScore <= 30) {
      const prob = 7;
      const imp = 8;
      const score = prob * imp;
      riskAnalysis.push({
        cause: "Inexistência de régua de CRM ou canal ativo de recompra",
        risk: "Subaproveitamento do ciclo de vida do cliente e LTV reprimido",
        effect: "Dependência exclusiva de tráfego pago de aquisição para manter a receita",
        probability: prob,
        impact: imp,
        risk_score: score,
        critical_alert: score >= 50
      });
    }

    // 8. Construção do Plano de Ação Recomendado (Foco Metodológico PPA)
    let actionPlan = {};

    if (maturityStage === "V1") {
      actionPlan = {
        immediate_phase: "Kickoff e Execução da Fase PPA (Pesquisa, Planejamento e Apresentação)",
        key_objectives: [
          "Mapear Personas, Níveis de Consciência e Matriz SWOT/FUFA do negócio",
          "Executar o teste de vacinas/ofertas de baixo orçamento em tráfego pago",
          "Estabelecer os primeiros indicadores rastreáveis de CAC e LTV"
        ],
        next_steps: [
          "Realizar a pesquisa de profundidade dos 5 maiores concorrentes (Benchmark).",
          "Estruturar os parâmetros de rastreamento de mídia (Pixéis, UTMs e CRM).",
          "Construir a primeira oferta de validação com Landing Page dedicada."
        ]
      };
    } else {
      actionPlan = {
        immediate_phase: `Otimização e Expansão (Maturidade ${maturityStage})`,
        key_objectives: [
          "Concentrar o orçamento de mídia nos canais de maior ROI estipulados no PPA",
          "Aumentar o LTV através da estruturação de campanhas automatizadas de CRM"
        ],
        next_steps: [
          "Revisar a margem de contribuição de cada canal de aquisição ativo.",
          "Expandir a volumetria de investimento nos canais de busca e social media."
        ]
      };
    }

    // 9. Montagem do Payload Final de Saída
    const outputPayload = {
      company_name: String(company_info.name),
      maturity_stage: maturityStage,
      stage_description: stageDescription,
      fits_scores: fitsScores,
      pillars_scores: pillarsScores,
      risk_analysis: riskAnalysis,
      recommended_action_plan: actionPlan
    };

    return {
      statusCode: 200,
      body: outputPayload
    };

  } catch (error) {
    // 10. Tratameto de Erros Não Tratados na Runtime
    return {
      statusCode: 500,
      body: {
        error: "Internal Serverless Runtime Error",
        message: error.message || "Ocorreu uma falha inesperada durante o processamento do diagnóstico."
      }
    };
  }
}


6. Arquitetura de UI/UX e Fluxo de Interação

Jornada do Usuário em 4 Passos Sequenciais

+-----------------------------------------------------------------------------------+
|  PASSO 1: Coleta de Dados Quantitativos e Qualitativos                            |
|  - Entrada de dados corporativos (Faturamento, Mídia, CRM, presença de CAC/LTV).   |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|  PASSO 2: Avaliação Estruturada de Fits e Pilares                                 |
|  - Resposta ao questionário tático referente aos 4 Fits e aos 4 Pilares do Método.  |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|  PASSO 3: Processamento do Algoritmo de Diagnóstico                               |
|  - Validação do schema JSON Draft-07 e execução dos cálculos em runtime Node.js.  |
+-----------------------------------------------------------------------------------+
                                          │
                                          ▼
+-----------------------------------------------------------------------------------+
|  PASSO 4: Exibição do Dashboard Analítico e Plano PPA                             |
|  - Exibição visual de Badges, Barras dos Fits, CREP Riscos e Ações do PPA.        |
+-----------------------------------------------------------------------------------+


Wireframe ASCII do Dashboard de Resultado

====================================================================================
| DIAGNÓSTICO DE MATURIDADE E PERFORMANCE METODOLÓGICA (V4 COMPANY / AIOSON PLAY)  |
====================================================================================
| EMPRESA: ACME Growth Corp.                     DATA DO PROCESSAMENTO: 2026-10-22   |
====================================================================================

  ESTÁGIO DE MATURIDADE DETECTADO:
  +-------------------------------------------------------------------------------+
  |  [ BADGE: ESTÁGIO V1 - DESCOBERTA / KICKOFF PPA REQUERIDO ]                   |
  |  Descrição: Ausência de métricas confiáveis de CAC/LTV. Foco total em         |
  |  estruturação da fase PPA e validação de ofertas/vacinas de baixo custo.      |
  +-------------------------------------------------------------------------------+

------------------------------------------------------------------------------------
| PONTUAÇÃO DOS 4 FITS (ÍNDICE DE ALINHAMENTO SISTÊMICO)                           |
------------------------------------------------------------------------------------
| Product-Market Fit : [████████████████████░░░░░░░░░░] 65/100                     |
| Model / Monetization: [████████████░░░░░░░░░░░░░░░░░░] 40/100 (ALERTA CRÍTICO)    |
| Channel Fit        : [████████████████████████░░░░░░] 75/100                     |
| Market Fit         : [████████████████████████████░░] 85/100                     |
|----------------------------------------------------------------------------------|
| Média Geral Fits   : 66.25 / 100                                                 |
------------------------------------------------------------------------------------

------------------------------------------------------------------------------------
| AVALIAÇÃO DOS 4 PILARES OPERACIONAIS                                             |
------------------------------------------------------------------------------------
| Tráfego    : [████████████████░░░░░░░░░░] 50/100 (Uso de busca ativo)             |
| Engajamento: [████████░░░░░░░░░░░░░░░░░░] 30/100 (Sem Landing Pages dedicadas)     |
| Conversão  : [████████████░░░░░░░░░░░░░░] 35/100 (Atrito em checkout/vendas)      |
| Retenção   : [████░░░░░░░░░░░░░░░░░░░░░░] 15/100 (Sem réguas de CRM ativas)       |
------------------------------------------------------------------------------------

------------------------------------------------------------------------------------
| ANÁLISE DE RISCOS OPERACIONAIS (MATRIZ CREP)                                     |
------------------------------------------------------------------------------------
| [!] RISCO #1 (SCORE: 81 - ALERTA CRÍTICO: Model/Monetization Fit < 50)           |
|     - Causa: Desalinhamento no Monetization/Model Fit (Score: 40/100).            |
|     - Risco: Modelo de cobrança incapaz de cobrir o CAC estimado da operação.    |
|     - Efeito: Prejuízo financeiro acumulado diretamente proporcional às vendas.  |
|----------------------------------------------------------------------------------|
| [!] RISCO #2 (SCORE: 81 - ALERTA CRÍTICO: CAC/LTV Ausentes)                       |
|     - Causa: Falta de rastreabilidade e dados históricos de CAC e LTV.           |
|     - Risco: Alocação ineficiente ou prematura de investimento em mídia paga.    |
|     - Efeito: Descapitalização acelerada durante a tentativa de expansão.        |
------------------------------------------------------------------------------------

------------------------------------------------------------------------------------
| PLANO DE AÇÃO RECOMENDADO (DIRETRIZES DO KICKOFF PPA)                            |
------------------------------------------------------------------------------------
| 1. Iniciar etapa de Pesquisa no PPA: Mapear Personas e Níveis de Consciência.    |
| 2. Executar testes de validação de vacinas/ofertas com baixo orçamento de mídia.  |
| 3. Configurar infraestrutura de dados (Pixéis, UTMs e CRM) para capturar o CAC.  |
====================================================================================


7. Prompts e Diretrizes de Engenharia para Alimentar o Claude Code

Prompt 1: System Prompt de Geração da Lógica Core do Diagnóstico em Node.js

Você é o Chief Product Architect especialista em crescimento orientado a dados e arquitetura Node.js.
Sua missão é implementar a função core de processamento matemático e classificatório do "App 1: Diagnóstico de Maturidade V1-V4 & 4 Fits" para execução na runtime serverless AIOSON Play.

REGRAS ESTREITAS DE NEGÓCIO DA METHODOLOGIA V4 COMPANY:
1. CLASSIFICAÇÃO DE MATURIDADE V1-V4:
   - Se `company_info.knows_cac_and_ltv` for `false` OU se `cac_value` ou `ltv_value` forem `null`/`undefined`, OBRIGATORIAMENTE defina `maturity_stage = "V1"`.
   - Se os dados de CAC e LTV forem válidos e conhecidos:
     * Retorne "V4" se `monthly_media_investment > 50000` E `team_specialization_level === "fully_specialized_division"`.
     * Retorne "V3" se `monthly_media_investment > 10000` E `<= 50000`.
     * Retorne "V2" nos demais casos de métricas conhecidas.

2. CÁLCULO BOUNDED DOS PILARES OPERACIONAIS (INTERVALO FECHADO [0, 100]):
   - Pilar Tráfego: Aplique a fórmula estrita `Math.min(100, (active_channels_count * 20) + (uses_search_ads ? 20 : 0))`.
   - Pilar Conversão: Avalie diretamente o objeto `pillars_questionnaire.conversion_metrics`. Atribua 50 para `sales_team_type` "inside_sales" ou "hybrid", 30 para "checkout_self_service", e adicione 25 se `friction_points_identified === false`.
   - Pilar Retenção: Se `has_repurchase_strategy` e `active_crm_campaigns` forem `false`, aplique a trava limitadora de score máximo em 30 pontos (`Math.min(30, score)`).

3. ANÁLISE DE RISCOS DA MATRIZ CREP:
   - Para cada risco identificado, compute `risk_score = probability * impact` (intervalo de 1 a 100).
   - Defina a flag booleana `critical_alert = true` sempre que `risk_score >= 50`.
   - Se a empresa for classificada como "V1", obrigatoriamente inclua o risco de ausência de métricas de CAC/LTV.

4. DIRETRIZES DO PLANO DE AÇÃO PPA:
   - Se o estágio for "V1", o plano de ação retornado deve obrigatoriamente referenciar a execução da fase PPA (Pesquisa, Planejamento e Apresentação) e seus 7 componentes (Persona, Consciência, Sazonalidade, SWOT/FUFA, Benchmark, Step V1-V4 e Oferta).

Gere código JavaScript em formato ES Module (`export async function handler(context)`), sem dependências externas pesadas, totalmente resiliente e idempotente.


Prompt 2: System Prompt do Adaptador de Runtime AIOSON Play Serverless

Você é o Lead Integration Engineer do AIOSON Play Runtime.
Desenvolva o módulo adaptador de borda em Node.js 20+ LTS que encapsula o App 1 (Diagnóstico de Maturidade) e o expõe com resiliência na infraestrutura serverless da plataforma.

REQUISITOS TÉCNICOS E OPERACIONAIS DO ADAPTADOR:
1. TRATAMENTO DE CONTEXTO E PARSING:
   - Extraia o payload do evento através de `context.payload`.
   - Valide se os nós de primeiro nível (`company_info`, `fits_questionnaire`, `pillars_questionnaire`) existem.
   - Caso estejam ausentes, interrompa imediatamente a execução e retorne uma resposta HTTP estruturada com código `422 Unprocessable Entity`.

2. SANITIZAÇÃO DE ENTRADA E LIMITES DE MÍDIA:
   - Garanta que campos numéricos de faturamento e mídia não contenham valores negativos executando sanitização via `Math.max(0, valor)`.

3. EXECUÇÃO DA LÓGICA E CONTRATO DE SAÍDA:
   - Invoque a função interna de processamento do diagnóstico.
   - Garanta que o objeto retornado esteja estritamente compatível com o JSON Schema `DiagnosisOutputPayload` (Draft-07).

4. TRATAMENTO DE EXCEÇÕES E LOGS ESTRUTURADOS:
   - Encapsule todo o fluxo em um bloco `try/catch`.
   - Em caso de erros de runtime não tratados, registre o log estruturado em formato JSON (`console.error(JSON.stringify({ error: err.message, stack: err.stack }))`) e retorne o status HTTP `500 Internal Serverless Runtime Error`.

5. PADRÃO DE EXPORTAÇÃO:
   - Exportador primário em ES Module: `export async function handler(context)`.

Forneça o código JavaScript completo, limpo, documentado com JSDoc e pronto para implantação imediata em ambiente de produção.
