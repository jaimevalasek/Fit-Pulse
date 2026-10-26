// The monthly diary (CAP-ra-diary): one entry per company and month with the spend and the new
// customers, from which the cost per customer of each month is read. Pure functions only: bad
// or missing input becomes `null` or an empty list, never an exception, NaN or Infinity (IF-004).

import { formatMonthLong, formatMonthShort, isValidIsoMonth } from "../format/dates.ts";
import { formatMoney } from "../format/money.ts";
import type { SpendPartKey } from "./types.ts";
import { resolveSpendCents, roundHalfUp, sumSpendParts } from "./unitEconomics.ts";

/** Months the cost per customer needs to count as measured (RULE-ra-09). */
export const DIARY_MEASURED_MONTHS = 3;
/** Months the cost chart shows, the most recent ones noted (AC-ra-41). */
export const DIARY_CHART_MONTHS = 6;
/** New customers of one month: an integer from 0 up to this (RULE-ra-08). */
export const DIARY_MAX_NEW_CUSTOMERS = 99_999;
/** R$ 99.999.999,99 in cents: the largest value one spend field takes (AC-ra-43). */
export const DIARY_MAX_SPEND_CENTS = 9_999_999_999;

export const DIARY_CUSTOMERS_EMPTY_MESSAGE = "Informe quantos clientes novos vieram. Pode ser 0.";
export const DIARY_SPEND_EMPTY_MESSAGE =
  "Preencha pelo menos uma parte do gasto, ou marque 'Só sei o total'.";
export const DIARY_TOTAL_EMPTY_MESSAGE = "Informe o gasto total do mês. Pode ser 0,00.";

export type DiarySpendParts = Partial<Record<SpendPartKey, number>>;

/** One noted month. The spend is in the 6 parts of the calculator or in a single total, in whole cents. */
export interface DiaryEntry {
  /** `YYYY-MM`; it identifies the entry and never changes (RULE-ra-08). */
  month: string;
  newCustomers: number;
  spendParts: DiarySpendParts | null;
  spendTotalCents: number | null;
}

export interface DiaryChartPoint {
  month: string;
  /** `null` is "não calculado": the month had no new customers. */
  cacCents: number | null;
}

export interface DiaryProgress {
  /** Months noted. */
  count: number;
  /** The oldest and the newest of the 3 most recent months once there are 3 or more; `null` before. */
  measuredFrom: string | null;
  measuredTo: string | null;
}

export interface DiaryEntryView {
  month: string;
  newCustomers: number;
  spendParts: DiarySpendParts | null;
  spendTotalCents: number | null;
  totalCents: number;
  cacCents: number | null;
}

export interface DiaryView {
  entries: DiaryEntryView[];
  progress: DiaryProgress;
  chart: DiaryChartPoint[];
}

export interface DiaryRecentCost {
  months: number;
  spendCents: number;
  newCustomers: number;
  cacCents: number | null;
}

function isNewCustomers(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= DIARY_MAX_NEW_CUSTOMERS
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Spend of the month in cents: the sum of the parts filled in or, when none is, the single total.
 * `null` when the entry has no spend at all.
 */
export function diaryEntrySpendCents(
  entry: Pick<DiaryEntry, "spendParts" | "spendTotalCents">,
): number | null {
  return resolveSpendCents({ spendParts: entry.spendParts ?? {}, spendTotalCents: entry.spendTotalCents });
}

/** An entry with only the total ("Só sei o total"), so its spend has no division by part. */
export function isTotalOnlyEntry(entry: Pick<DiaryEntry, "spendParts" | "spendTotalCents">): boolean {
  return sumSpendParts(entry.spendParts ?? undefined) === null && diaryEntrySpendCents(entry) !== null;
}

/** A real month, a customer count in range and some spend: anything else is left out of every calculation. */
export function isUsableDiaryEntry(entry: DiaryEntry): boolean {
  return (
    isValidIsoMonth(entry.month) && isNewCustomers(entry.newCustomers) && diaryEntrySpendCents(entry) !== null
  );
}

/**
 * Cost per customer of the month, rounded to the cent like the first version (RULE-dm-03).
 * `null` ("não calculado") with 0 new customers or an entry that cannot be read (RULE-ra-08).
 */
export function computeMonthCostCents(entry: DiaryEntry): number | null {
  const spend = diaryEntrySpendCents(entry);
  if (spend === null || !isNewCustomers(entry.newCustomers) || entry.newCustomers === 0) return null;
  return roundHalfUp(spend / entry.newCustomers);
}

/** "R$ 60,00", or "não calculado" when the month has no cost per customer. */
export function formatMonthCost(entry: DiaryEntry): string {
  return formatMoney(computeMonthCostCents(entry));
}

/** The usable entries, one per month, the most recent month first. */
export function listDiaryEntries(entries: readonly DiaryEntry[]): DiaryEntry[] {
  const newestFirst = entries
    .filter(isUsableDiaryEntry)
    .sort((a, b) => (a.month < b.month ? 1 : a.month > b.month ? -1 : 0));
  const seen = new Set<string>();
  return newestFirst.filter((entry) => {
    if (seen.has(entry.month)) return false;
    seen.add(entry.month);
    return true;
  });
}

/** The `count` most recent months noted (not necessarily consecutive), the newest first (RULE-ra-09). */
export function mostRecentDiaryEntries(entries: readonly DiaryEntry[], count: number): DiaryEntry[] {
  return listDiaryEntries(entries).slice(0, Math.max(0, count));
}

/** Cost per customer of the last 6 months noted, oldest first, ready to draw (AC-ra-41). */
export function buildDiaryChart(entries: readonly DiaryEntry[]): DiaryChartPoint[] {
  return mostRecentDiaryEntries(entries, DIARY_CHART_MONTHS)
    .reverse()
    .map((entry) => ({ month: entry.month, cacCents: computeMonthCostCents(entry) }));
}

/** The one-sentence reading of the chart: where the cost per customer went, in words. */
export function buildChartSummary(chart: readonly DiaryChartPoint[]): string {
  const calculated = chart.filter(
    (point): point is DiaryChartPoint & { cacCents: number } => point.cacCents !== null,
  );
  if (chart.length === 0) return "Nenhum mês anotado no diário.";
  if (calculated.length === 0) {
    return "Nenhum mês anotado tem clientes novos, então o custo por cliente ainda não foi calculado.";
  }
  const first = calculated[0];
  const last = calculated[calculated.length - 1];
  const firstMonth = formatMonthShort(first.month);
  const lastMonth = formatMonthShort(last.month);
  const lastCost = formatMoney(last.cacCents);
  if (calculated.length === 1) return `Custo por cliente em ${lastMonth}: ${lastCost}.`;
  const from = `${formatMoney(first.cacCents)} em ${firstMonth}`;
  const to = `${lastCost} em ${lastMonth}`;
  if (last.cacCents < first.cacCents) return `O custo por cliente caiu de ${from} para ${to}.`;
  if (last.cacCents > first.cacCents) return `O custo por cliente subiu de ${from} para ${to}.`;
  return `O custo por cliente ficou em ${lastCost} de ${firstMonth} a ${lastMonth}.`;
}

/** How many months are noted and, from 3 on, the span of the 3 most recent ones that count as measured. */
export function computeDiaryProgress(entries: readonly DiaryEntry[]): DiaryProgress {
  const listed = listDiaryEntries(entries);
  if (listed.length < DIARY_MEASURED_MONTHS) {
    return { count: listed.length, measuredFrom: null, measuredTo: null };
  }
  return {
    count: listed.length,
    measuredFrom: listed[DIARY_MEASURED_MONTHS - 1].month,
    measuredTo: listed[0].month,
  };
}

export function isDiaryMeasured(progress: DiaryProgress): boolean {
  return progress.measuredFrom !== null && progress.measuredTo !== null;
}

/** "2 de 3 meses anotados", or "Medido: de ago/2026 a out/2026" with 3 months or more (AC-ra-41). */
export function formatDiaryProgress(progress: DiaryProgress): string {
  if (progress.measuredFrom !== null && progress.measuredTo !== null) {
    return `Medido: de ${formatMonthShort(progress.measuredFrom)} a ${formatMonthShort(progress.measuredTo)}`;
  }
  return `${progress.count} de ${DIARY_MEASURED_MONTHS} meses anotados`;
}

/**
 * Spend, new customers and cost per customer over the (up to) 3 most recent months: the number the
 * diary tab and the home screen show. `null` when nothing is noted.
 */
export function computeRecentCost(entries: readonly DiaryEntry[]): DiaryRecentCost | null {
  const recent = mostRecentDiaryEntries(entries, DIARY_MEASURED_MONTHS);
  if (recent.length === 0) return null;
  const spendCents = recent.reduce((sum, entry) => sum + (diaryEntrySpendCents(entry) ?? 0), 0);
  const newCustomers = recent.reduce((sum, entry) => sum + entry.newCustomers, 0);
  return {
    months: recent.length,
    spendCents,
    newCustomers,
    cacCents: newCustomers === 0 ? null : roundHalfUp(spendCents / newCustomers),
  };
}

function toEntryView(entry: DiaryEntry): DiaryEntryView {
  const hasParts = sumSpendParts(entry.spendParts ?? undefined) !== null;
  return {
    month: entry.month,
    newCustomers: entry.newCustomers,
    spendParts: hasParts ? { ...entry.spendParts } : null,
    spendTotalCents: hasParts ? null : entry.spendTotalCents,
    totalCents: diaryEntrySpendCents(entry) ?? 0,
    cacCents: computeMonthCostCents(entry),
  };
}

/** Everything the diary tab draws, from the stored entries (IF-006). */
export function buildDiaryView(entries: readonly DiaryEntry[]): DiaryView {
  return {
    entries: listDiaryEntries(entries).map(toEntryView),
    progress: computeDiaryProgress(entries),
    chart: buildDiaryChart(entries),
  };
}

/** "Agosto de 2026 já está no diário. Edite o mês em vez de anotar de novo." (AC-ra-39). */
export function diaryMonthTakenMessage(month: string): string {
  return `${capitalize(formatMonthLong(month))} já está no diário. Edite o mês em vez de anotar de novo.`;
}
