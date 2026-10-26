import type { DimensionKey, LockKey, StageNumber } from "../domain/types.ts";

export interface StageInfo {
  number: StageNumber;
  name: string;
  /** Sentence shown under the stage name. */
  phrase: string;
}

export const STAGES: readonly StageInfo[] = [
  {
    number: 1,
    name: "Descoberta",
    phrase: "Você ainda está descobrindo quanto custa conquistar e manter um cliente.",
  },
  {
    number: 2,
    name: "Ajuste",
    phrase: "Os números básicos existem. Agora o foco é deixá-los saudáveis e mais baratos.",
  },
  {
    number: 3,
    name: "Escala",
    phrase: "Os números sustentam investir mais para crescer mais rápido.",
  },
  {
    number: 4,
    name: "Estruturação",
    phrase: "Crescer agora depende de dividir o trabalho e cuidar da margem.",
  },
];

export function getStage(number: StageNumber): StageInfo {
  return STAGES[number - 1];
}

/** Shown instead of the lock sentence at the top stage (BR-dm-13). */
export const LAST_STEP_PHRASE = "Último degrau. Manter margem, equipe e números em dia.";

export type DimensionGroup = "fit" | "front";

export const DIMENSION_GROUP_LABELS: Record<DimensionGroup, string> = {
  fit: "Encaixe",
  front: "Frente",
};

export interface DimensionInfo {
  key: DimensionKey;
  name: string;
  /** The question this dimension answers, in plain words. */
  question: string;
  group: DimensionGroup;
}

export const DIMENSIONS: Record<DimensionKey, DimensionInfo> = {
  mp: {
    key: "mp",
    name: "Mercado e produto",
    question: "As pessoas querem o que você vende, a ponto de voltar?",
    group: "fit",
  },
  pc: {
    key: "pc",
    name: "Produto e canal",
    question: "Você sabe por onde os clientes chegam e o que cada canal traz?",
    group: "fit",
  },
  cm: {
    key: "cm",
    name: "Canal e receita",
    question: "O que um cliente deixa paga o que ele custou?",
    group: "fit",
  },
  mm: {
    key: "mm",
    name: "Receita e mercado",
    question: "O seu mercado comporta a meta que você tem?",
    group: "fit",
  },
  aq: {
    key: "aq",
    name: "Aquisição",
    question: "Atrair as pessoas certas",
    group: "front",
  },
  en: {
    key: "en",
    name: "Engajamento",
    question: "Ganhar a confiança de quem chegou",
    group: "front",
  },
  co: {
    key: "co",
    name: "Conversão",
    question: "Transformar interesse em venda",
    group: "front",
  },
  re: {
    key: "re",
    name: "Retenção",
    question: "Vender de novo para quem já comprou",
    group: "front",
  },
};

/** Sentence after "Para subir de degrau:" for each lock. */
export const LOCK_PHRASES: Record<LockKey, string> = {
  cac: "descobrir quanto custa cada cliente novo",
  measure: "medir o custo de cada cliente, em vez de estimar por faixa",
  mp: "provar que os clientes voltam a comprar",
  ratio: "cada cliente precisa deixar pelo menos 3 vezes o que custou",
  payback: "recuperar o custo de cada cliente em até 12 meses",
  pc: "saber qual canal traz clientes e quanto ele custa",
  re: "voltar a vender para quem já comprou",
  mm: "confirmar que o mercado comporta a sua meta",
  co: "transformar mais orçamentos em venda",
  es: "dividir marketing e vendas em áreas com responsáveis",
};

/**
 * When the lock is the customer cost, the stage 1 description names the
 * research steps by what they do, never by method names (RULE-dm-14).
 */
export const DISCOVERY_RESEARCH_INTRO =
  "Antes de investir mais, vale fazer estas etapas de pesquisa:";

export const DISCOVERY_RESEARCH_STEPS: readonly string[] = [
  "Conhecer o seu cliente ideal.",
  "Descobrir o momento em que ele percebe o problema.",
  "Anotar a sazonalidade: quando as vendas sobem e quando caem.",
  "Listar os seus pontos fortes e fracos.",
  "Olhar os concorrentes e escrever a sua proposta de valor.",
  "Testar ofertas com um orçamento pequeno.",
];
