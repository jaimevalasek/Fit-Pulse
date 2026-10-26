import { z } from "zod";
import {
  DIARY_CUSTOMERS_EMPTY_MESSAGE,
  DIARY_MAX_NEW_CUSTOMERS,
  DIARY_MAX_SPEND_CENTS,
  DIARY_SPEND_EMPTY_MESSAGE,
  DIARY_TOTAL_EMPTY_MESSAGE,
  type DiarySpendParts,
} from "../../shared/domain/diary.ts";
import { SPEND_PART_KEYS } from "../../shared/domain/types.ts";
import {
  MONTH_FUTURE_MESSAGE,
  MONTH_INVALID_MESSAGE,
  MONTH_REQUIRED_MESSAGE,
  isFutureMonth,
  isValidIsoMonth,
} from "../../shared/format/dates.ts";
import type { DiaryEntryValues } from "../repositories/diaryRepository.ts";

export const DIARY_MONTH_LOCKED_MESSAGE = "Para mudar o mês, exclua e anote de novo.";
export const DIARY_SPEND_BOTH_MESSAGE = "Informe as partes do gasto ou só o total, não os dois.";

// Money travels as whole cents, from zero up to R$ 99.999.999,99 (AC-ra-43).
const centsSchema = z
  .number({ error: "Informe um valor em reais." })
  .int("Informe o valor em centavos inteiros.")
  .min(0, "O valor não pode ser negativo.")
  .max(DIARY_MAX_SPEND_CENTS, "O valor passa de R$ 99.999.999,99.");

const spendPartsSchema = z.partialRecord(z.enum(SPEND_PART_KEYS, { error: "Custo desconhecido." }), centsSchema, {
  error: "Informe cada parte do gasto em reais, usando só os campos da tela.",
});

const newCustomersSchema = z
  .number({ error: DIARY_CUSTOMERS_EMPTY_MESSAGE })
  .int("Informe um número inteiro de clientes.")
  .min(0, "O número de clientes não pode ser negativo.")
  .max(DIARY_MAX_NEW_CUSTOMERS, "O número de clientes novos aceita até 99.999.");

// A missing key and null both read as "not informed", so the cross-field check below can say which one is empty.
const valueShape = {
  newCustomers: newCustomersSchema.nullable().optional(),
  spendParts: spendPartsSchema.nullable().optional(),
  spendTotalCents: centsSchema.nullable().optional(),
};

interface RawValues {
  newCustomers?: number | null;
  spendParts?: DiarySpendParts | null;
  spendTotalCents?: number | null;
}

interface IssueSink {
  addIssue(issue: { code: "custom"; path: string[]; message: string }): void;
}

function hasSpendParts(value: RawValues): value is RawValues & { spendParts: DiarySpendParts } {
  return value.spendParts != null && Object.keys(value.spendParts).length > 0;
}

function hasSpendTotal(value: RawValues): value is RawValues & { spendTotalCents: number } {
  return typeof value.spendTotalCents === "number";
}

// The spend is the parts or the single total ("Só sei o total"). Neither is an empty spend (AC-ra-39); both is a
// payload the screen never sends. An empty total field reports itself, any other empty spend reports the parts.
function checkValues(value: RawValues, ctx: IssueSink): void {
  const fail = (field: string, message: string) => ctx.addIssue({ code: "custom", path: [field], message });
  if (value.newCustomers === undefined || value.newCustomers === null) {
    fail("newCustomers", DIARY_CUSTOMERS_EMPTY_MESSAGE);
  }
  if (hasSpendParts(value) && hasSpendTotal(value)) {
    fail("spendTotalCents", DIARY_SPEND_BOTH_MESSAGE);
  } else if (!hasSpendParts(value) && !hasSpendTotal(value)) {
    const onlyTotalSent = value.spendTotalCents === null && value.spendParts === undefined;
    fail(onlyTotalSent ? "spendTotalCents" : "spendParts", onlyTotalSent ? DIARY_TOTAL_EMPTY_MESSAGE : DIARY_SPEND_EMPTY_MESSAGE);
  }
}

// Only runs after `checkValues` found nothing wrong: exactly one of the two spends is there.
function toValues(value: RawValues): DiaryEntryValues {
  const parts = hasSpendParts(value) ? value.spendParts : null;
  return {
    newCustomers: value.newCustomers as number,
    spendParts: parts,
    spendTotalCents: parts === null ? (value.spendTotalCents ?? null) : null,
  };
}

function checkNewMonth(month: string | null | undefined, currentMonth: string, ctx: IssueSink): void {
  const fail = (message: string) => ctx.addIssue({ code: "custom", path: ["month"], message });
  if (month === undefined || month === null || month.trim() === "") {
    fail(MONTH_REQUIRED_MESSAGE);
  } else if (!isValidIsoMonth(month)) {
    fail(MONTH_INVALID_MESSAGE);
  } else if (isFutureMonth(month, currentMonth)) {
    fail(MONTH_FUTURE_MESSAGE);
  }
}

export interface DiaryCreateInput extends DiaryEntryValues {
  /** `YYYY-MM`. */
  month: string;
}

/**
 * `POST /api/companies/:id/diary` (IF-006): the month as `YYYY-MM` (real and not after `currentMonth`),
 * the new customers (0 to 99.999) and the spend in whole cents, as `spendParts` or `spendTotalCents`.
 * Every wrong field is reported together; an unknown key is refused.
 */
export function createDiaryCreateSchema(currentMonth: string) {
  return z
    .strictObject(
      { month: z.string({ error: MONTH_REQUIRED_MESSAGE }).nullable().optional(), ...valueShape },
      { error: "Envie o mês, os clientes novos e o gasto." },
    )
    .superRefine((value, ctx) => {
      checkNewMonth(value.month, currentMonth, ctx);
      checkValues(value, ctx);
    })
    .transform((value): DiaryCreateInput => ({ month: value.month as string, ...toValues(value) }));
}

export type DiaryUpdateInput = DiaryEntryValues;

/**
 * `PUT /api/companies/:id/diary/:month`: the same values as the create, which replace the stored ones. The
 * month comes only from the route and never changes (RULE-ra-08); a `month` in the body is accepted only when
 * it names that same month.
 */
export function createDiaryUpdateSchema(routeMonth: string) {
  return z
    .strictObject({ month: z.string().nullable().optional(), ...valueShape }, { error: "Envie os clientes novos e o gasto." })
    .superRefine((value, ctx) => {
      if (value.month !== undefined && value.month !== null && value.month !== routeMonth) {
        ctx.addIssue({ code: "custom", path: ["month"], message: DIARY_MONTH_LOCKED_MESSAGE });
      }
      checkValues(value, ctx);
    })
    .transform((value): DiaryUpdateInput => toValues(value));
}
