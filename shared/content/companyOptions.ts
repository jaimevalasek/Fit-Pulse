// Keys are what gets stored and sent through the API; labels are what the owner reads.
// The key tuples are `as const` so the server can feed them straight into `z.enum(...)`.

export const SEGMENT_KEYS = [
  "food",
  "health_wellness",
  "beauty",
  "automotive_services",
  "retail",
  "education",
  "professional_services",
  "industry",
  "other",
] as const;

export type CompanySegment = (typeof SEGMENT_KEYS)[number];

export const SEGMENT_LABELS: Record<CompanySegment, string> = {
  food: "Alimentação",
  health_wellness: "Saúde e bem-estar",
  beauty: "Beleza",
  automotive_services: "Serviços automotivos",
  retail: "Varejo",
  education: "Educação",
  professional_services: "Serviços profissionais",
  industry: "Indústria",
  other: "Outro",
};

export const SALES_CHANNEL_KEYS = [
  "storefront",
  "quote_or_visit",
  "online_or_delivery",
  "subscription",
  "mixed",
] as const;

export type CompanySalesChannel = (typeof SALES_CHANNEL_KEYS)[number];

export const SALES_CHANNEL_LABELS: Record<CompanySalesChannel, string> = {
  storefront: "Loja física ou balcão",
  quote_or_visit: "Venda com orçamento ou visita",
  online_or_delivery: "E-commerce ou delivery",
  subscription: "Assinatura ou mensalidade",
  mixed: "Mais de um jeito de vender (ex.: loja e delivery)",
};

export const ANNUAL_REVENUE_RANGE_KEYS = [
  "up_to_81k",
  "up_to_360k",
  "up_to_4_8m",
  "above_4_8m",
] as const;

export type CompanyAnnualRevenueRange = (typeof ANNUAL_REVENUE_RANGE_KEYS)[number];

export const ANNUAL_REVENUE_RANGE_LABELS: Record<CompanyAnnualRevenueRange, string> = {
  up_to_81k: "Até R$ 81 mil por ano (microempreendedor)",
  up_to_360k: "Até R$ 360 mil por ano (microempresa)",
  up_to_4_8m: "Até R$ 4,8 milhões por ano (pequena empresa)",
  above_4_8m: "Acima de R$ 4,8 milhões por ano",
};

export interface CompanyOption<Key extends string> {
  key: Key;
  label: string;
}

function toOptions<Key extends string>(
  keys: readonly Key[],
  labels: Record<Key, string>,
): CompanyOption<Key>[] {
  return keys.map((key) => ({ key, label: labels[key] }));
}

// Ready for a <select>: same order as the key tuples.
export const SEGMENT_OPTIONS = toOptions(SEGMENT_KEYS, SEGMENT_LABELS);
export const SALES_CHANNEL_OPTIONS = toOptions(SALES_CHANNEL_KEYS, SALES_CHANNEL_LABELS);
export const ANNUAL_REVENUE_RANGE_OPTIONS = toOptions(
  ANNUAL_REVENUE_RANGE_KEYS,
  ANNUAL_REVENUE_RANGE_LABELS,
);

// Rows come from the database as plain strings; an unknown key shows as itself, never as blank.
function labelFor(labels: Record<string, string>, key: string): string {
  return Object.hasOwn(labels, key) ? (labels[key] ?? key) : key;
}

export function getSegmentLabel(key: string): string {
  return labelFor(SEGMENT_LABELS, key);
}

export function getSalesChannelLabel(key: string): string {
  return labelFor(SALES_CHANNEL_LABELS, key);
}

export function getAnnualRevenueRangeLabel(key: string): string {
  return labelFor(ANNUAL_REVENUE_RANGE_LABELS, key);
}
