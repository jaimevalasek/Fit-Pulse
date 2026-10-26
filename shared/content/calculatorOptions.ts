import type {
  EntryMode,
  NewCustomersRangeKey,
  PurchasesPerYearKey,
  RelationshipLengthKey,
  SpendPartKey,
  SpendRangeKey,
} from "../domain/types.ts";

export interface OptionLabel<Key extends string> {
  key: Key;
  label: string;
}

/** The six cost parts of the "sei os valores" spend mode. */
export const SPEND_PART_OPTIONS: readonly OptionLabel<SpendPartKey>[] = [
  { key: "ads", label: "Anúncios (redes sociais, Google, iFood patrocinado)" },
  { key: "agency", label: "Agência ou freelancer de marketing" },
  { key: "commission", label: "Comissões de quem vende" },
  { key: "discount", label: "Descontos e brindes de primeira compra" },
  { key: "salary", label: "Parte do salário de quem vende ou divulga" },
  { key: "tools", label: "Ferramentas (CRM, WhatsApp Business pago, e-mail)" },
];

export const SPEND_RANGE_OPTIONS: readonly OptionLabel<SpendRangeKey>[] = [
  { key: "upTo1000", label: "Até R$ 1.000" },
  { key: "from1000To5000", label: "R$ 1.000 a R$ 5.000" },
  { key: "from5000To15000", label: "R$ 5.000 a R$ 15.000" },
  { key: "from15000To50000", label: "R$ 15.000 a R$ 50.000" },
  { key: "over50000", label: "Acima de R$ 50.000" },
];

export const NEW_CUSTOMERS_RANGE_OPTIONS: readonly OptionLabel<NewCustomersRangeKey>[] = [
  { key: "from1To10", label: "1 a 10" },
  { key: "from11To30", label: "11 a 30" },
  { key: "from31To100", label: "31 a 100" },
  { key: "from101To300", label: "101 a 300" },
  { key: "over300", label: "Mais de 300" },
];

export const PURCHASES_PER_YEAR_OPTIONS: readonly OptionLabel<PurchasesPerYearKey>[] = [
  { key: "once", label: "1 vez por ano" },
  { key: "twoToThree", label: "2 ou 3 vezes" },
  { key: "fourToSix", label: "4 a 6 vezes" },
  { key: "sevenToTwelve", label: "7 a 12 vezes" },
  { key: "overTwelve", label: "Mais de 12 vezes" },
];

export const RELATIONSHIP_LENGTH_OPTIONS: readonly OptionLabel<RelationshipLengthKey>[] = [
  { key: "underSixMonths", label: "Menos de 6 meses" },
  { key: "sixToTwelveMonths", label: "6 a 12 meses" },
  { key: "oneToTwoYears", label: "1 a 2 anos" },
  { key: "twoToFourYears", label: "2 a 4 anos" },
  { key: "overFourYears", label: "Mais de 4 anos" },
];

export const SPEND_MODE_OPTIONS: readonly OptionLabel<EntryMode>[] = [
  { key: "exact", label: "Sei os valores" },
  { key: "range", label: "Sei mais ou menos" },
  { key: "unknown", label: "Não sei" },
];

export const NEW_CUSTOMERS_MODE_OPTIONS: readonly OptionLabel<EntryMode>[] = [
  { key: "exact", label: "Sei o número" },
  { key: "range", label: "Sei mais ou menos" },
  { key: "unknown", label: "Não sei" },
];

export type CalculatorFieldKey =
  | "spend"
  | "newCustomers"
  | "averagePurchase"
  | "purchasesPerYear"
  | "relationshipLength"
  | "margin";

export interface CalculatorFieldCopy {
  label: string;
  /** Text behind the "?" button. */
  help: string;
}

/** The six fields of block 1 ("Seus números"). */
export const CALCULATOR_FIELDS: Record<CalculatorFieldKey, CalculatorFieldCopy> = {
  spend: {
    label: "Quanto você gastou para atrair clientes nos últimos 3 meses?",
    help: "Entra tudo o que você pagou para alguém novo comprar: anúncio, agência, comissão, desconto de primeira compra e a parte do salário de quem vende.",
  },
  newCustomers: {
    label: "Quantos clientes compraram de você pela primeira vez nesses 3 meses?",
    help: "Conte só quem comprou pela primeira vez. Quem já era cliente antes não entra na conta.",
  },
  averagePurchase: {
    label: "Valor médio de uma compra",
    help: "Some o que vendeu em um mês e divida pelo número de compras. O resultado é o valor médio.",
  },
  purchasesPerYear: {
    label: "Quantas vezes por ano um cliente compra",
    help: "Pense num cliente comum: em um ano, quantas vezes ele volta a comprar de você?",
  },
  relationshipLength: {
    label: "Por quanto tempo um cliente continua comprando",
    help: "Do dia da primeira compra até o dia em que ele para de voltar. Uma boa estimativa já ajuda.",
  },
  margin: {
    label: "De cada R$ 100 vendidos, quanto sobra depois de pagar produto, insumo e entrega?",
    help: "Se vende por R$ 100 e gasta R$ 60 com produto, insumo e entrega, sobram R$ 40.",
  },
};
