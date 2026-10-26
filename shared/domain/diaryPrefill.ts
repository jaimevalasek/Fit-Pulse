// Numbers of the diary in block 1 "Seus números" of a new draft (CAP-ra-diary-prefill, RULE-ra-09).
// Pure functions: the service stores the result, nothing here reads or writes the database.
//
// - 3 months or more: spend and new customers are the sum of the 3 most recent months noted and
//   count as measured.
// - 1 or 2 months: the monthly average times 3 is offered as a suggestion; once the owner accepts
//   it, it counts as estimated.
// - no month: the draft is exactly the one of the first version.

import { formatMonthShort } from "../format/dates.ts";
import {
  DIARY_MEASURED_MONTHS,
  diaryEntrySpendCents,
  isTotalOnlyEntry,
  mostRecentDiaryEntries,
  type DiaryEntry,
  type DiarySpendParts,
} from "./diary.ts";
import {
  SPEND_PART_KEYS,
  type CalculatorInput,
  type DiaryFieldSource,
  type DiaryOrigin,
  type DiarySource,
  type DiarySuggestion,
} from "./types.ts";
import { roundHalfUp } from "./unitEconomics.ts";

/** The calculator fields the diary fills in, always as exact values (never a range). */
export type DiaryNumbers = Pick<
  CalculatorInput,
  | "spendMode"
  | "spendParts"
  | "spendTotalCents"
  | "spendRange"
  | "newCustomersMode"
  | "newCustomers"
  | "newCustomersRange"
>;

export type DiaryPrefill =
  | { kind: "none" }
  | { kind: "measured"; numbers: DiaryNumbers; source: DiarySource }
  | { kind: "suggestion"; suggestion: DiarySuggestion };

interface RecentTotals {
  monthCount: number;
  fromMonth: string;
  toMonth: string;
  spendParts: DiarySpendParts;
  /** Set instead of `spendParts` when any of the months only has the total. */
  spendTotalCents: number | null;
  newCustomers: number;
}

// Sums the months part by part. When a month only has the total there is no division by part:
// the spend of every month is added as one total, and the panel recalculates the same (AC-ra-44).
function sumMonths(recent: readonly DiaryEntry[]): RecentTotals {
  const newCustomers = recent.reduce((sum, entry) => sum + entry.newCustomers, 0);
  const base = {
    monthCount: recent.length,
    fromMonth: recent[recent.length - 1].month,
    toMonth: recent[0].month,
    newCustomers,
  };
  if (recent.some(isTotalOnlyEntry)) {
    const total = recent.reduce((sum, entry) => sum + (diaryEntrySpendCents(entry) ?? 0), 0);
    return { ...base, spendParts: {}, spendTotalCents: total };
  }
  const spendParts: DiarySpendParts = {};
  for (const key of SPEND_PART_KEYS) {
    const filled = recent.map((entry) => entry.spendParts?.[key]).filter((v): v is number => v !== undefined);
    if (filled.length > 0) spendParts[key] = filled.reduce((sum, value) => sum + value, 0);
  }
  return { ...base, spendParts, spendTotalCents: null };
}

function projectToThreeMonths(sum: number, monthCount: number): number {
  return roundHalfUp((sum * DIARY_MEASURED_MONTHS) / monthCount);
}

function projectTotals(totals: RecentTotals): DiarySuggestion {
  const spendParts: DiarySpendParts = {};
  for (const key of SPEND_PART_KEYS) {
    const sum = totals.spendParts[key];
    if (sum !== undefined) spendParts[key] = projectToThreeMonths(sum, totals.monthCount);
  }
  return {
    monthCount: totals.monthCount,
    fromMonth: totals.fromMonth,
    toMonth: totals.toMonth,
    spendParts,
    spendTotalCents:
      totals.spendTotalCents === null ? null : projectToThreeMonths(totals.spendTotalCents, totals.monthCount),
    newCustomers: projectToThreeMonths(totals.newCustomers, totals.monthCount),
  };
}

function fieldSource(
  origin: DiaryOrigin,
  range: Pick<RecentTotals, "monthCount" | "fromMonth" | "toMonth">,
): DiaryFieldSource {
  return { origin, fromMonth: range.fromMonth, toMonth: range.toMonth, monthCount: range.monthCount };
}

/** What the diary gives a new draft: measured numbers, a suggestion, or nothing (RULE-ra-09). */
export function computeDiaryPrefill(entries: readonly DiaryEntry[]): DiaryPrefill {
  const recent = mostRecentDiaryEntries(entries, DIARY_MEASURED_MONTHS);
  if (recent.length === 0) return { kind: "none" };
  const totals = sumMonths(recent);
  if (recent.length < DIARY_MEASURED_MONTHS) return { kind: "suggestion", suggestion: projectTotals(totals) };
  const source = fieldSource("measured", totals);
  return {
    kind: "measured",
    numbers: {
      spendMode: "exact",
      spendParts: totals.spendParts,
      spendTotalCents: totals.spendTotalCents,
      spendRange: null,
      newCustomersMode: "exact",
      newCustomers: totals.newCustomers,
      newCustomersRange: null,
    },
    source: { spend: source, newCustomers: source },
  };
}

/**
 * The calculator of a new draft with the diary applied: measured numbers and their mark, or the
 * suggestion kept aside. With no month the calculator comes back untouched (the first version).
 */
export function applyDiaryToCalculator(
  calculator: CalculatorInput,
  entries: readonly DiaryEntry[],
): CalculatorInput {
  const prefill = computeDiaryPrefill(entries);
  if (prefill.kind === "none") return calculator;
  if (prefill.kind === "suggestion") return { ...calculator, diarySuggestion: prefill.suggestion };
  return { ...calculator, ...prefill.numbers, diarySource: prefill.source, diarySuggestion: null };
}

/**
 * "Usar o diário": the suggestion becomes the numbers of the calculator, marked as estimated so the
 * cost per customer stays estimated and the confidence stays at medium or below (AC-ra-45).
 * The suggestion itself stays in the calculator.
 */
export function applyDiarySuggestion(
  calculator: CalculatorInput,
  suggestion: DiarySuggestion,
): CalculatorInput {
  const source = fieldSource("estimated", suggestion);
  return {
    ...calculator,
    spendMode: "exact",
    spendParts: { ...suggestion.spendParts },
    spendTotalCents: suggestion.spendTotalCents,
    spendRange: null,
    newCustomersMode: "exact",
    newCustomers: suggestion.newCustomers,
    newCustomersRange: null,
    diarySource: { spend: source, newCustomers: source },
  };
}

/** Whether "Usar o diário" is offered: there is a suggestion and the numbers do not carry its mark yet. */
export function isDiarySuggestionOffered(calculator: CalculatorInput): boolean {
  if (!calculator.diarySuggestion) return false;
  return !(calculator.diarySource?.spend && calculator.diarySource?.newCustomers);
}

function sameSpendInput(before: CalculatorInput, after: CalculatorInput): boolean {
  return (
    before.spendMode === after.spendMode &&
    before.spendRange === after.spendRange &&
    (before.spendTotalCents ?? null) === (after.spendTotalCents ?? null) &&
    SPEND_PART_KEYS.every((key) => before.spendParts?.[key] === after.spendParts?.[key])
  );
}

function sameNewCustomersInput(before: CalculatorInput, after: CalculatorInput): boolean {
  return (
    before.newCustomersMode === after.newCustomersMode &&
    before.newCustomers === after.newCustomers &&
    before.newCustomersRange === after.newCustomersRange
  );
}

/**
 * The calculator after an edit, with the diary state decided here and never by the client: a number
 * edited by hand loses its "do diário" mark and then follows the first version's rule (AC-ra-46);
 * the others keep it, and the stored suggestion stays as it was. `before` is the stored calculator.
 */
export function carryDiaryMarks(before: CalculatorInput, after: CalculatorInput): CalculatorInput {
  const { diarySource: _clientSource, diarySuggestion: _clientSuggestion, ...rest } = after;
  const kept: DiarySource = {};
  if (before.diarySource?.spend && sameSpendInput(before, after)) kept.spend = before.diarySource.spend;
  if (before.diarySource?.newCustomers && sameNewCustomersInput(before, after)) {
    kept.newCustomers = before.diarySource.newCustomers;
  }
  const next: CalculatorInput = { ...rest };
  if (kept.spend || kept.newCustomers) next.diarySource = kept;
  if (before.diarySuggestion !== undefined) next.diarySuggestion = before.diarySuggestion;
  return next;
}

/** "do diário: ago/2026 a out/2026" or "do diário: 2 meses, estimado": the mark beside a number (AC-ra-44, AC-ra-45). */
export function formatDiaryMark(source: DiaryFieldSource): string {
  if (source.origin === "measured") {
    return `do diário: ${formatMonthShort(source.fromMonth)} a ${formatMonthShort(source.toMonth)}`;
  }
  return `do diário: ${source.monthCount} ${source.monthCount === 1 ? "mês" : "meses"}, estimado`;
}

/**
 * Where the cost per customer came from when the diary gave both of its numbers: `estimated` as soon
 * as one of them is a projection. `null` when it was typed in, or only half of it came from the diary.
 */
export function getCostDiaryOrigin(calculator: CalculatorInput): DiaryOrigin | null {
  const spend = calculator.diarySource?.spend;
  const newCustomers = calculator.diarySource?.newCustomers;
  if (!spend || !newCustomers) return null;
  return spend.origin === "estimated" || newCustomers.origin === "estimated" ? "estimated" : "measured";
}

/** "do diário, medido" or "do diário, estimado" (AC-ra-46). */
export function formatCostDiaryOrigin(origin: DiaryOrigin): string {
  return origin === "measured" ? "do diário, medido" : "do diário, estimado";
}
