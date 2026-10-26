import { z } from "zod";
import {
  ANNUAL_REVENUE_RANGE_KEYS,
  SALES_CHANNEL_KEYS,
  SEGMENT_KEYS,
} from "../../shared/content/companyOptions.ts";
import {
  CNPJ_DIGITS_LENGTH,
  CNPJ_INVALID_MESSAGE,
  extractCnpjDigits,
  isValidCnpj,
} from "../../shared/format/cnpj.ts";

export const COMPANY_NAME_MIN_LENGTH = 2;
export const COMPANY_NAME_MAX_LENGTH = 80;

// A missing key, null and blank text all mean "not informed". The conversion is explicit
// so that an edit can clear an optional field by sending null or an empty string.
function blankToNull(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  return value;
}

// The CNPJ is stored as 14 digits. A masked number is accepted, but any other character
// (or a count other than 14, which `extractCnpjDigits` would hide by cutting) is refused.
const MASKED_CNPJ_CHARACTERS = /^[\d./\-\s]+$/;

function isAcceptableCnpj(value: string): boolean {
  if (!MASKED_CNPJ_CHARACTERS.test(value)) {
    return false;
  }
  return value.replace(/\D/g, "").length === CNPJ_DIGITS_LENGTH && isValidCnpj(value);
}

const nameSchema = z
  .string({ error: "Informe o nome da empresa." })
  .trim()
  .min(1, "Informe o nome da empresa.")
  .min(COMPANY_NAME_MIN_LENGTH, "O nome precisa ter pelo menos 2 letras.")
  .max(COMPANY_NAME_MAX_LENGTH, "O nome pode ter até 80 caracteres.");

const cnpjSchema = z.preprocess(
  blankToNull,
  z
    .string({ error: CNPJ_INVALID_MESSAGE })
    .refine(isAcceptableCnpj, CNPJ_INVALID_MESSAGE)
    .transform(extractCnpjDigits)
    .nullable(),
);

/** Same field set for create and edit (an edit sends the whole company again). */
export const companyInputSchema = z.object(
  {
    name: nameSchema,
    segment: z.enum(SEGMENT_KEYS, { error: "Escolha o segmento mais próximo." }),
    salesChannel: z.enum(SALES_CHANNEL_KEYS, { error: "Escolha como você vende." }),
    annualRevenueRange: z.preprocess(
      blankToNull,
      z.enum(ANNUAL_REVENUE_RANGE_KEYS, { error: "Escolha uma das faixas de faturamento." }).nullable(),
    ),
    cnpj: cnpjSchema,
  },
  { error: "Envie os dados da empresa." },
);

export type CompanyInput = z.infer<typeof companyInputSchema>;

const STAGE_FILTER_MESSAGE = "Escolha um estágio de 1 a 4.";
const ARCHIVED_FILTER_MESSAGE = "Use archived=true ou archived=false.";
const ATTENTION_FILTER_MESSAGE = "Escolha um dos filtros de atenção da lista.";

/**
 * What the consultant home flags as "O que precisa de você" (IF-010): late reevaluation, overdue
 * actions, high risk, questionnaires waiting for the client's answers, stalled drafts and companies
 * without a diagnosis. Each one opens the company list filtered by exactly the companies the
 * indicator counted.
 */
export const ATTENTION_FILTERS = [
  "atrasada",
  "vencidas",
  "risco",
  "aguardando",
  "rascunhos",
  "sem-diagnostico",
] as const;

export type AttentionFilter = (typeof ATTENTION_FILTERS)[number];

/** Query string of `GET /api/companies`; `archived` defaults to the active list. */
export const companyListQuerySchema = z.object({
  q: z.preprocess(blankToNull, z.string().trim().nullable()).transform((value) => value || null),
  stage: z.preprocess(
    blankToNull,
    z
      .enum(["1", "2", "3", "4"], { error: STAGE_FILTER_MESSAGE })
      .transform((value) => Number(value) as 1 | 2 | 3 | 4)
      .nullable(),
  ),
  attention: z.preprocess(
    blankToNull,
    z.enum(ATTENTION_FILTERS, { error: ATTENTION_FILTER_MESSAGE }).nullable(),
  ),
  archived: z.preprocess(
    (value) => (blankToNull(value) === null ? "false" : value),
    z
      .enum(["true", "false", "1", "0"], { error: ARCHIVED_FILTER_MESSAGE })
      .transform((value) => value === "true" || value === "1"),
  ),
});

export type CompanyListFilters = z.infer<typeof companyListQuerySchema>;
