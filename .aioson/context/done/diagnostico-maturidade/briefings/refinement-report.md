# Refinement Report — diagnostico-maturidade

- Source briefing: .aioson/briefings/diagnostico-maturidade/briefings.md
- Feedback: .aioson/briefings/diagnostico-maturidade/refinement-feedback.applied-round1.json
- Source hash: 8cc36ee31f62c546246d4a6ba02825950c3a643aa5505636a6e439a2bc38042a
- Applied hash: a360f4cd38b76f3da7e9afc3b9ce6075c1fac1b4deb981a6517a0b9043e36df7
- Status: applied
- Round: 1
- Next action: build_prototype
- Approved review authority: binding

## Approved Review Decisions

- F1 [structured_selection] proposed-solution: ancoras-calculadas — Calculadas de perguntas descritivas
- F2 [structured_selection] open-questions: nomes-proprios — Nomes próprios, explicáveis a leigo
- F3 [structured_selection] context: fitpulse — FitPulse
- F4 [structured_selection] proposed-solution: trava-dimensoes-criticas — Trava por dimensões críticas + sinais relativos
- F5 [structured_selection] identified-gaps: product-rascunha-dono-aprova — @product rascunha a partir da pesquisa; o dono aprova
- F6 [structured_selection] open-questions: 5x5-por-sinais — 5×5 gerada por sinais
- F7 [structured_selection] proposed-solution: calculadora-cac-ltv — Calculadora de CAC/LTV; relatorio-pdf — Relatório PDF | rationale: O dono declarou no chat (2026-10-22) que respondeu com as opções recomendadas; o relatório PDF também era recomendado e foi incluído. Confirmado no dry-run.
- F8 [structured_selection] proposed-solution: resultado-em-camadas — Em camadas: estágio, gargalo e 3 ações primeiro
- F9 [structured_selection] identified-gaps: leitura-resumo — Ler o resumo do último diagnóstico
- F10 [structured_selection] open-questions: recalcular-preservar — Recalcular o anterior e preservar o original
- F11 [structured_selection] risks: gratuito-validar — Gratuito na versão 1
- F12 [structured_selection] context: aceitar-medium — Aceitar MEDIUM
- F13 [legacy_recommendation] risks: legacy-recommendation — Posicionar o app como orientação. Mostrar um aviso curto no resultado e no PDF ('orientação baseada nas suas respostas; não substitui análise financeira'). Condicionar ações de aumento de investimento a dados medidos (CAC/LTV com confiança alta).
- F14 [structured_selection] proposed-solution: identity-intent — Criar a partir do protótipo aprovado

## Approved Source References

- researchs/growth-frameworks-diagnostico/summary.md
- .aioson/briefings/diagnostico-maturidade/motor-de-diagnostico.md
- researchs/v4-company-metodo/summary.md
- plans/detalhes-do-app.md
- .aioson/briefings/diagnostico-maturidade/briefings.md
- .aioson/briefings/diagnostico-maturidade/expansion-scout.md
- researchs/ferramentas-diagnostico-mercado/summary.md
- plans/plano-de-desenvolvimento-inicial.md
- CLAUDE.md
- .aioson/docs/integrations/ai-app-integration.md
- .aioson/context/project.context.md

## Findings

- F1 [pending-decision/high/blocking] (accepted) proposed-solution: O PRD recebe os 4 Fits como nota de 0 a 100 digitada (schema L219–249) e devolve o mesmo número como se fosse calculado (M-11). A pesquisa mostra que a autonota de gestores é otimista e não tem relação com o desempenho (World Management Survey). Também mostra que diagnósticos de PME no Brasil (Radar da Inovação Sebrae/ALI, Índice de Maturidade Digital) usam respostas descritivas com nota. Isso define o questionário inteiro: sem essa decisão, o @product não consegue escrever os requisitos do questionário nem do motor.
- F2 [pending-decision/high/blocking] (accepted) open-questions: Os rótulos 'V1–V4' vêm dos 'Steps' que a V4 Company divulga, e 'V4 COMPANY' é marca registrada no INPI na classe 35 (publicidade/assessoria). Os pilares têm duas nomenclaturas na própria V4 (Tráfego/Engajamento/Conversão/Retenção e Aquisição/Engajamento/Monetização/Retenção). Os termos PPA, 'vacinas' e 'Matriz CREP' não aparecem em nenhuma fonte pública, então provavelmente são jargão interno. Esses nomes aparecem em todas as telas, no relatório e no resultado do motor.
- F3 [pending-decision/medium] (accepted) context: O nome 'V-Stage' (SRC-002) evoca a V4 pelo 'V' e pelos estágios V1–V4. 'FitPulse' é a alternativa registrada pelo dono e remete aos Fits, termo do framework público de Brian Balfour. O nome não trava o PRD, mas trava a publicação na loja.
- F4 [pending-decision/high/blocking] (accepted) proposed-solution: A regra de estágio do PRD se contradiz e tem lacunas. Uma empresa generalista com R$30 mil/mês cai em V2 pela regra e em V3 pelo código (M-07). Investimento acima de R$50 mil sem time especializado não está coberto (M-08). Os limiares de R$10 mil e R$50 mil não têm fonte pública (M-10). A pesquisa (Churchill & Lewis) mostra empresas em estágios diferentes conforme a dimensão e sugere travar o estágio geral pelas dimensões críticas: não existe 'escala' com LTV:CAC < 1.
- F5 [pending-decision/high/blocking] (accepted) identified-gaps: O motor depende de conteúdo de domínio que não existe e não tem dono (G-14, Q-22): 25 a 35 perguntas com respostas âncora, critérios mínimos por estágio, catálogo de sinais → riscos → mitigação e catálogo de ações do plano por dimensão. Isso não é código. Sem um responsável, o PRD trava ou improvisa o conteúdo.
- F6 [pending-decision/medium] (accepted) open-questions: O PRD usa probabilidade e impacto de 1 a 10 com alerta em ≥ 50 e constantes fixas no código (M-24): todo risco disparado é sempre 'crítico'. A convenção mais comum é 5×5 com alerta em ≥ 16. Pelo NIST SP 800-30, 50 seria 'Moderado'. Cox (2008) mostra que a multiplicação comprime riscos diferentes na mesma nota.
- F7 [scope-suggestion/medium] (accepted) proposed-solution: Fora do Core, o briefing lista peças de alto valor por custo baixo (expansion-scout.md). A calculadora de CAC/LTV ataca a dor central: o dono cai no estágio inicial só por não conhecer a sigla. O PDF é item que o mercado já considera básico (ScoreApp, Pointerpro). As demais peças servem principalmente à consultoria ou ao hábito de reavaliar.
- F8 [gap/medium] (accepted) proposed-solution: O resultado do PRD (wireframe L686–741) mostra tudo no mesmo nível: estágio, 4 Fits, 4 Pilares, riscos e plano, ou seja, 11 blocos de conceitos técnicos. Para um dono leigo, a decisão que importa ('o que faço agora?') fica escondida. O briefing não define o que aparece primeiro, e isso guia o protótipo.
- F9 [gap/medium] (accepted) identified-gaps: O app terá backend HTTP. Pelo contrato do Play (CLAUDE.md, regra 7), ele precisa expor GET /api/aioson-play listando só rotas reais, para o assistente do Play enxergá-las. O PRD promete endpoints de avaliação, schema e saúde (PROM-008), mas o briefing não diz o que o assistente do Play pode ler ou executar. Os dados são sensíveis (faturamento, CAC/LTV).
- F10 [pending-decision/medium] (accepted) open-questions: Cada diagnóstico grava a versão das regras. Quando uma atualização do app mudar as regras, comparar um diagnóstico antigo com um novo compara escalas diferentes (Q-21). Como as respostas ficam guardadas, o anterior pode ser recalculado.
- F11 [pending-decision/medium] (accepted) risks: Já existem diagnósticos gratuitos (Sebrae IMD, RD Station, CIGAM), o que aumenta a fricção para cobrar (R-08). A demanda ainda é hipótese (Q-20). O modelo comercial na loja define o que vira diferencial pago.
- F12 [ambiguity/medium] (accepted) context: A classificação está inconsistente entre as fontes. O project.context.md diz MICRO, o briefing sugere SMALL e o `aioson classify . --feature=diagnostico-maturidade` retorna MEDIUM: a pontuação dá SMALL, mas há um piso de escopo de 5 fronteiras de runtime (persistência, contrato de serviço, orquestração, sistema de arquivos e cliente), e a CLI recomenda protótipo. A classificação define a profundidade do PRD, a revisão do @sheldon e o plano.
- F13 [risk/low] (accepted) risks: Uma recomendação como 'aumente o investimento em mídia' pode gerar prejuízo e ser lida como consultoria financeira (R-10, Q-19). O público é leigo e pode seguir a orientação ao pé da letra.
- F14 [pending-decision/low] (accepted) proposed-solution: O app tem várias telas (wizard, questionário, resultado, histórico, home) e ainda não existe identidade visual do projeto. Um sistema de design reutilizável guarda cores, tipografia, espaçamento e regras de componentes para que as próximas telas mantenham o mesmo padrão. O protótipo vem antes do PRD e é responsabilidade do @refiner.

## Applied Changes

- context: text changed
- proposed-solution: text changed
- risks: text changed
- identified-gaps: text changed
- open-questions: text changed

## Skipped Changes

- None

## Unresolved Comments

- None

## Blocking Items

- None
