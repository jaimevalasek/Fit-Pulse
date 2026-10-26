import { z } from "zod";
import { allowsUnknown, ANCHOR_MAX, BLOCK_COUNT, isQuestionId } from "../../shared/content/questionBank.ts";
import { DIARY_MEASURED_MONTHS } from "../../shared/domain/diary.ts";
import { isValidIsoMonth } from "../../shared/format/dates.ts";
import { MONEY_MAX_CENTS } from "../../shared/format/money.ts";
import {
  NEW_CUSTOMERS_RANGE_KEYS,
  PURCHASES_PER_YEAR_KEYS,
  RELATIONSHIP_LENGTH_KEYS,
  SPEND_PART_KEYS,
  SPEND_RANGE_KEYS,
  type AnswerValue,
  type Answers,
  type BlockNumber,
  type QuestionId,
} from "../../shared/domain/types.ts";

export const NEW_CUSTOMERS_MAX = 1_000_000;
export const MARGIN_PERCENT_MAX = 100;

const OBJECT_MESSAGE = "Envie os dados como um objeto.";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAnchorValue(value: unknown): value is 0 | 1 | 2 | 3 {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= ANCHOR_MAX;
}

// The value an answer may hold, or `undefined` when the question or the value is not
// valid. A question without "não sei" never takes null.
function readAnswer(key: string, value: unknown): AnswerValue | undefined {
  if (!isQuestionId(key)) {
    return undefined;
  }
  if (value === null) {
    return allowsUnknown(key) ? null : undefined;
  }
  return isAnchorValue(value) ? value : undefined;
}

// Answers are checked key by key so each refusal points at its own question
// (`fields["answers.mp1"]`).
const answersSchema = z
  .custom<Record<string, unknown>>(isPlainObject, OBJECT_MESSAGE)
  .transform((raw, ctx): Answers => {
    const answers: Answers = {};
    for (const [key, value] of Object.entries(raw)) {
      const answer = readAnswer(key, value);
      if (answer !== undefined) {
        answers[key as QuestionId] = answer;
      } else {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: !isQuestionId(key)
            ? "Pergunta desconhecida."
            : allowsUnknown(key)
              ? "Escolha uma das opções ou \"Não sei\"."
              : "Escolha uma das opções.",
        });
      }
    }
    return answers;
  });

const cents = z
  .number({ error: "Informe um valor em reais." })
  .int("Informe o valor em centavos inteiros.")
  .min(0, "O valor não pode ser negativo.")
  .max(MONEY_MAX_CENTS, "O valor é grande demais.");

const entryMode = z.enum(["exact", "range", "unknown"], { error: "Escolha como informar." });

const spendPartsSchema = z.partialRecord(z.enum(SPEND_PART_KEYS, { error: "Custo desconhecido." }), cents, {
  error: "Informe cada custo em reais, usando só os campos da tela.",
});

const newCustomersCount = z
  .number({ error: "Informe quantos clientes novos." })
  .int("Informe um número inteiro de clientes.")
  .min(0, "O número de clientes não pode ser negativo.")
  .max(NEW_CUSTOMERS_MAX, "O número de clientes é grande demais.");

const calculatorPatchShape = {
  spendMode: entryMode.nullable().optional(),
  spendParts: spendPartsSchema.optional(),
  // "Só sei o total" of the diary: one spend total instead of the parts.
  spendTotalCents: cents.nullable().optional(),
  spendRange: z.enum(SPEND_RANGE_KEYS, { error: "Escolha uma das faixas." }).nullable().optional(),
  newCustomersMode: entryMode.nullable().optional(),
  newCustomers: newCustomersCount.nullable().optional(),
  newCustomersRange: z.enum(NEW_CUSTOMERS_RANGE_KEYS, { error: "Escolha uma das faixas." }).nullable().optional(),
  averagePurchaseCents: cents.nullable().optional(),
  purchasesPerYear: z.enum(PURCHASES_PER_YEAR_KEYS, { error: "Escolha uma das opções." }).nullable().optional(),
  relationshipLength: z.enum(RELATIONSHIP_LENGTH_KEYS, { error: "Escolha uma das opções." }).nullable().optional(),
  marginPercent: z
    .number({ error: "Informe a margem em porcentagem." })
    .int("Informe a margem como número inteiro.")
    .min(0, "A margem não pode ser negativa.")
    .max(MARGIN_PERCENT_MAX, "A margem vai de 0 a 100.")
    .nullable()
    .optional(),
};

const diaryMonth = z.string().refine(isValidIsoMonth, "Mês inválido.");

const diaryFieldSourceSchema = z.strictObject({
  origin: z.enum(["measured", "estimated"]),
  fromMonth: diaryMonth,
  toMonth: diaryMonth,
  monthCount: z.number().int().min(1).max(DIARY_MEASURED_MONTHS),
});

const diarySourceSchema = z.strictObject({
  spend: diaryFieldSourceSchema.optional(),
  newCustomers: diaryFieldSourceSchema.optional(),
});

const diarySuggestionSchema = z.strictObject({
  monthCount: z.number().int().min(1).max(DIARY_MEASURED_MONTHS),
  fromMonth: diaryMonth,
  toMonth: diaryMonth,
  spendParts: spendPartsSchema,
  spendTotalCents: cents.nullable(),
  newCustomers: newCustomersCount,
});

// The diary state of a calculator: only the server writes it (RULE-ra-09).
const DIARY_STATE_KEYS = ["diarySource", "diarySuggestion"] as const;

// What a calculator may hold: the fields of the screen plus the diary marks and the suggestion.
const storedCalculatorShape = {
  ...calculatorPatchShape,
  diarySource: diarySourceSchema.optional(),
  diarySuggestion: diarySuggestionSchema.nullable().optional(),
};

/**
 * The calculator of a diagnosis row, and what a backup restores. Every key is optional and `null` clears
 * a field. Money is integer cents with a ceiling, new customers 0 to 1,000,000, margin 0 to 100.
 */
const calculatorSchema = z.strictObject(storedCalculatorShape, { error: OBJECT_MESSAGE });

export type StoredCalculator = z.infer<typeof calculatorSchema>;
export type CalculatorPatch = StoredCalculator;

const currentBlockSchema = z
  .number({ error: "Escolha um bloco de 1 a 8." })
  .int("Escolha um bloco de 1 a 8.")
  .min(1, "Escolha um bloco de 1 a 8.")
  .max(BLOCK_COUNT, "Escolha um bloco de 1 a 8.")
  .transform((value) => value as BlockNumber);

/**
 * `PATCH /api/diagnoses/:id` (IF-003): only the keys sent change. Answers merge per
 * question; an unknown key anywhere is refused instead of being stored.
 *
 * The `calculator` shape is the stored one, because a backup restores through it and has to bring the
 * diary marks back. A request is stricter: the marks are decided by the server, so a client that sends
 * `diarySource` or `diarySuggestion` is refused (RULE-ra-09).
 */
export const diagnosisPatchSchema = z
  .strictObject(
    {
      answers: answersSchema.optional(),
      calculator: calculatorSchema.optional(),
      currentBlock: currentBlockSchema.optional(),
    },
    { error: "Envie o que mudou no diagnóstico." },
  )
  .superRefine((patch, ctx) => {
    for (const key of DIARY_STATE_KEYS) {
      if (patch.calculator !== undefined && Object.hasOwn(patch.calculator, key)) {
        ctx.addIssue({ code: "custom", path: ["calculator", key], message: "Os números do diário são marcados pelo sistema." });
      }
    }
  });

export type DiagnosisPatch = z.infer<typeof diagnosisPatchSchema>;

/**
 * Reads the JSON stored in a diagnosis row back into typed data. Rows are only written
 * through the schemas above, so a key that no longer validates (a question removed from
 * the bank, a value out of range) is a leftover: it is left out and every other key is
 * kept, so the next autosave never writes the readable answers away. Only a row that is
 * not an object at all reads as empty, rather than breaking the screen that shows it.
 */
export function readStoredAnswers(stored: unknown): Answers {
  const answers: Answers = {};
  if (!isPlainObject(stored)) {
    return answers;
  }
  for (const [key, value] of Object.entries(stored)) {
    const answer = readAnswer(key, value);
    if (answer !== undefined) {
      answers[key as QuestionId] = answer;
    }
  }
  return answers;
}

export function readStoredCalculator(stored: unknown): StoredCalculator {
  const calculator: Record<string, unknown> = {};
  if (!isPlainObject(stored)) {
    return calculator;
  }
  for (const [key, schema] of Object.entries(storedCalculatorShape)) {
    if (!Object.hasOwn(stored, key)) {
      continue;
    }
    const parsed = schema.safeParse(stored[key]);
    if (parsed.success && parsed.data !== undefined) {
      calculator[key] = parsed.data;
    }
  }
  return calculator as StoredCalculator;
}
