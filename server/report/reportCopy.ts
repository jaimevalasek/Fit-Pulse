// The words of the reports: the texts the owner approved in the PRD ("Conteúdo v2") and the
// fixed labels around them. No layout and no data here, only strings, so the three reports say
// the same thing the same way (RULE-dm-14: none of the terms the interface never shows).

export const DIAGNOSIS_REPORT_TITLE = "Relatório do diagnóstico de maturidade";

export const DIAGNOSIS_FOOTER_LABEL = "Diagnóstico de maturidade";

/** Printed in the executive summary and in "Como ler" (AC-ra-11). */
export const GUIDANCE_WARNING = "Orientação baseada nas respostas da empresa. Não substitui uma análise financeira.";

export const NO_RISKS_FOUND = "Nenhum risco encontrado nas respostas.";

export const PAGE_TITLES = {
  executiveSummary: "Resumo executivo",
  dimensions: "Notas das 8 dimensões",
  risks: "Riscos",
  numbers: "Seus números",
  actionProgress: "Andamento das ações",
  howToRead: "Como ler este relatório",
  answers: "Respostas do questionário",
} as const;

export const COVER_CREDIT = {
  withBrand: (brandName: string, date: string) => `Preparado por ${brandName} com o FitPulse em ${date}`,
  withoutBrand: (date: string) => `Gerado com o FitPulse em ${date}`,
} as const;

export const SUMMARY_COPY = {
  actionsHeading: "As 3 ações para começar",
  highestRisk: "Risco mais alto",
  stageOf: (number: number, total: number) => `Estágio ${number} de ${total}`,
  costPerCustomer: "Custo para conquistar um cliente",
  ratio: "Relação lucro ÷ custo",
  payback: "Tempo para um cliente se pagar",
} as const;

/** Opening line of the dimensions page; the stage depends on the conditions of each step, never on the weakest score. */
export const DIMENSIONS_INTRO =
  "Cada nota vai de 0 a 100. A linha marca 50: abaixo dela, a dimensão pede atenção. O estágio depende das condições de cada degrau, explicadas em 'Como ler'.";

export const DIMENSION_GROUP_HEADINGS = { fit: "Encaixes do negócio", front: "Frentes de crescimento" } as const;

export const DIMENSION_COPY = {
  scoreText: (score: number) => `${score} de 100`,
  supportsText: (stage: number) => `Sustentaria o estágio ${stage}`,
  belowWarning: (threshold: number) => `abaixo de ${threshold}`,
} as const;

export const RISKS_INTRO =
  "Probabilidade e impacto vão de 1 a 5. A nota é um número vezes o outro, e cada risco aparece na matriz com o número que tem na lista.";

export const RISK_COPY = {
  scoreLine: (probability: number, impact: number, score: number) =>
    `Probabilidade ${probability} de 5 · Impacto ${impact} de 5 · Nota ${probability} × ${impact} = ${score}`,
  howToReduce: (text: string) => `Como reduzir: ${text}`,
  axes: "Probabilidade na horizontal, impacto na vertical",
  matrixDescription: (marks: string[]) => `Matriz de risco 5 por 5. ${marks.join("; ")}.`,
  markDescription: (number: number, probability: number, impact: number, levelLabel: string) =>
    `Risco ${number}: probabilidade ${probability}, impacto ${impact}, nível ${levelLabel.toLowerCase()}`,
} as const;

export const NUMBERS_COPY = {
  cacLabel: "Custo de um cliente",
  cacExplanation:
    "O gasto para atrair clientes dividido pelos clientes novos do mesmo período. A origem entre parênteses diz como os dois números foram obtidos.",
  ltvLabel: "Lucro de um cliente no tempo",
  ltvExplanation:
    "O que um cliente deixa enquanto continua comprando, já descontados o custo do produto e o da entrega.",
  ratioLabel: "Relação lucro ÷ custo",
  ratioUnknown: "Sem o custo de um cliente, não há comparação.",
  paybackLabel: "Tempo para se pagar",
  paybackExplanation: "Quantos meses o lucro de um cliente leva para cobrir o que custou conquistá-lo.",
  paybackNeverPays: "O lucro de um cliente não cobre o custo dele.",
  confidenceHeading: "Confiança nos dados",
} as const;

export const COST_ORIGIN_LABELS = {
  measured: "medido",
  estimated: "estimado por faixa",
  unknown: "gasto ou clientes novos desconhecidos",
} as const;

export const PROVISIONAL_NOTE = "O resultado é provisório até você medir esses números. Depois, faça um novo diagnóstico.";

export const ACTION_PROGRESS_COPY = {
  intro: "O resultado do diagnóstico não muda. O andamento das ações fica registrado à parte.",
  howTo: (text: string) => `Como fazer: ${text}`,
  due: (date: string) => `Prazo ${date}`,
  owner: (name: string) => `Responsável: ${name}`,
  note: (text: string) => `Nota: ${text}`,
  overdueSuffix: " · vencida",
} as const;

export const ACTION_STATUS_LABELS = {
  todo: "A fazer",
  doing: "Em andamento",
  done: "Feita",
  notApplicable: "Não se aplica",
} as const;

/** "Como ler este relatório": the text the owner approved, one entry per heading. */
export const HOW_TO_READ_SECTIONS: ReadonlyArray<{ heading: string; text: string }> = [
  {
    heading: "Os 4 estágios",
    text: "Descoberta, Ajuste, Escala e Estruturação. Cada degrau tem condições próprias, e a empresa só sobe quando cumpre todas as do degrau seguinte. Para chegar à Escala, por exemplo, é preciso saber, com números anotados, quanto custa conquistar cada cliente novo. A primeira condição que falta é a trava, e é ela que o plano ataca primeiro.",
  },
  {
    heading: "Encaixes e frentes",
    text: "Os encaixes mostram se as peças do negócio combinam: mercado e produto, produto e canal, canal e receita, receita e mercado. As frentes mostram o que a empresa faz no dia a dia: aquisição, engajamento, conversão e retenção. Cada nota vai de 0 a 100, e abaixo de 50 é sinal de alerta. “Sustentaria o estágio N” diz até onde aquela dimensão levaria a empresa sozinha. As dimensões mais fracas viram ações do plano.",
  },
  {
    heading: "Custo e lucro por cliente",
    text: "O custo por cliente é o gasto para atrair clientes dividido pelos clientes novos do mesmo período. O lucro por cliente é o que ele deixa enquanto continua comprando, já descontado o custo do produto e da entrega. Quando o lucro fica entre 3 e 5 vezes o custo, a conta é saudável; abaixo de 1, cada cliente novo dá prejuízo.",
  },
  {
    heading: "Confiança nos dados",
    text: "É alta quando quase tudo foi medido. É média quando parte veio por faixa ou de um diário com menos de 3 meses. É baixa quando há muitos “não sei”. Com 3 meses ou mais anotados no diário, o custo por cliente conta como medido.",
  },
];

export const ANSWERS_COPY = {
  numbersTitle: `${PAGE_TITLES.answers}: seus números`,
  questionsTitle: (from: number, to: number) => `${PAGE_TITLES.answers}: perguntas ${from} a ${to}`,
  numbersColumns: ["Número", "Resposta"],
  questionsColumns: ["Pergunta", "Resposta"],
  unanswered: "Sem resposta",
  notInformed: "Não informado",
  unknown: "Não sei",
  spendPart: (label: string) => `Gasto: ${label}`,
  marginText: (percent: number) => `R$ ${percent} de cada R$ 100`,
  intro: "Estas respostas trazem valores em reais e fazem parte do relatório só porque a opção foi ligada.",
} as const;
