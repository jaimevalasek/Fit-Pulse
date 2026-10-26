export const NOT_CALCULATED_LABEL = "não calculado";
export const NEVER_PAYS_BACK_LABEL = "não se paga";
// BR-dm-14: shown next to "não calculado" when there are no new customers in the period.
export const NO_NEW_CUSTOMERS_EXPLANATION =
  "Sem clientes novos no período, não dá para calcular o custo de um cliente";

export type RatioBandKey = "critical" | "attention" | "healthy" | "invest_more";

export interface RatioBand {
  key: RatioBandKey;
  label: string;
  phrase: string;
}

const CRITICAL_BAND: RatioBand = {
  key: "critical",
  label: "Crítico",
  phrase: "Cada cliente deixa menos do que custou: crescer aumenta o prejuízo.",
};
const ATTENTION_BAND: RatioBand = {
  key: "attention",
  label: "Atenção",
  phrase: "Cada cliente deixa menos de 3 vezes o que custou.",
};
const HEALTHY_BAND: RatioBand = {
  key: "healthy",
  label: "Saudável",
  phrase: "Cada cliente deixa entre 3 e 5 vezes o que custou.",
};
const INVEST_MORE_BAND: RatioBand = {
  key: "invest_more",
  label: "Pode investir mais",
  phrase: "Retorno alto: talvez você esteja investindo pouco para atrair clientes.",
};

function isUsableNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// Whole numbers in pt-BR notation with "." between thousands: 1234567 -> "1.234.567".
export function formatInteger(value: number): string {
  if (!Number.isSafeInteger(value)) return NOT_CALCULATED_LABEL;
  const digits = String(Math.abs(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return value < 0 ? `-${digits}` : digits;
}

// The band uses the exact ratio, not the rounded one shown on screen (RULE-dm-03).
export function getRatioBand(ratio: number | null | undefined): RatioBand | null {
  if (!isUsableNumber(ratio) || ratio < 0) return null;
  if (ratio < 1) return CRITICAL_BAND;
  if (ratio < 3) return ATTENTION_BAND;
  if (ratio <= 5) return HEALTHY_BAND;
  return INVEST_MORE_BAND;
}

// LTV:CAC with one decimal, half rounded up: 4.56 -> "4,6×".
export function formatRatio(ratio: number | null | undefined): string {
  if (!isUsableNumber(ratio) || ratio < 0) return NOT_CALCULATED_LABEL;
  const tenths = Math.round(ratio * 10);
  if (!Number.isSafeInteger(tenths)) return NOT_CALCULATED_LABEL;
  return `${formatInteger(Math.floor(tenths / 10))},${tenths % 10}×`;
}

// "0,0× Crítico", the way AC-dm-51 reads the ratio when the margin is zero.
export function formatRatioWithBand(ratio: number | null | undefined): string {
  const band = getRatioBand(ratio);
  const formatted = formatRatio(ratio);
  return band === null || formatted === NOT_CALCULATED_LABEL
    ? NOT_CALCULATED_LABEL
    : `${formatted} ${band.label}`;
}

// Months to recover the cost of a customer, rounded up to whole months: 3.9 -> "4 meses".
// "never" (or Infinity) means the customer never pays back; null, undefined and NaN mean the
// number could not be calculated.
export function formatPayback(months: number | "never" | null | undefined): string {
  if (months === "never" || months === Number.POSITIVE_INFINITY) return NEVER_PAYS_BACK_LABEL;
  if (!isUsableNumber(months) || months < 0) return NOT_CALCULATED_LABEL;
  const whole = Math.ceil(months);
  if (!Number.isSafeInteger(whole)) return NOT_CALCULATED_LABEL;
  return `${formatInteger(whole)} ${whole === 1 ? "mês" : "meses"}`;
}
