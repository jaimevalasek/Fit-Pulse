import { isValidIsoDate, isoToDateInput, localIsoDate } from "../format/dates.ts";

// When a company is due for a new diagnosis (RULE-ra-07). Pure and dependency free: the clock comes
// in as an argument, so the home, the portfolio and the PDF count the very same days. "Today" and the
// day of a diagnosis are calendar days of the computer's own time zone, never blocks of 24 hours.

/** The interval until the next diagnosis when the user never chose one. */
export const DEFAULT_REEVALUATION_DAYS = 90;

/** The intervals the user can choose in "Configurações". */
export const REEVALUATION_INTERVAL_OPTIONS = [60, 90, 120, 180] as const;

export type ReevaluationIntervalDays = (typeof REEVALUATION_INTERVAL_OPTIONS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export function isReevaluationInterval(value: unknown): value is ReevaluationIntervalDays {
  return REEVALUATION_INTERVAL_OPTIONS.some((option) => option === value);
}

// A calendar day as a whole number of days since 1970-01-01. UTC arithmetic on the day alone, so
// a change of daylight saving time never shifts the count by one.
function isoDayNumber(isoDate: string): number | null {
  if (!isValidIsoDate(isoDate)) {
    return null;
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

/** Whole calendar days from `from` to `to` (`YYYY-MM-DD`), negative when `to` comes first; `null` unless both are real dates. */
export function daysBetweenIsoDates(from: string, to: string): number | null {
  const start = isoDayNumber(from);
  const end = isoDayNumber(to);
  return start === null || end === null ? null : end - start;
}

/** `YYYY-MM-DD` moved by whole days; `null` unless the date is real and the result stays on the accepted calendar. */
export function addDaysToIsoDate(isoDate: string, days: number): string | null {
  const day = isoDayNumber(isoDate);
  if (day === null || !Number.isInteger(days)) {
    return null;
  }
  const moved = new Date((day + days) * DAY_MS);
  if (Number.isNaN(moved.getTime())) {
    return null;
  }
  const result = moved.toISOString().slice(0, 10);
  return isValidIsoDate(result) ? result : null;
}

export interface Reevaluation {
  /** The day the next diagnosis is due, as `YYYY-MM-DD`. */
  dueDate: string;
  /** Calendar days from the last diagnosis until today. */
  daysSince: number;
  /** Calendar days from today until `dueDate`; negative once it has passed. */
  daysUntil: number;
  /** The due day has passed: on the due day itself the company is still on time. */
  late: boolean;
  /** Calendar days since `dueDate` has passed; 0 while on time. */
  daysLate: number;
}

/**
 * The reevaluation of a company: the local day of its last diagnosis plus the interval. `null` for
 * an invalid moment or an interval that is not a whole number of days of at least one.
 */
export function reevaluationOf(
  lastDiagnosisAt: Date,
  today: Date,
  intervalDays: number = DEFAULT_REEVALUATION_DAYS,
): Reevaluation | null {
  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    return null;
  }
  const lastDay = localIsoDate(lastDiagnosisAt);
  const todayDay = localIsoDate(today);
  if (lastDay === null || todayDay === null) {
    return null;
  }
  const dueDate = addDaysToIsoDate(lastDay, intervalDays);
  const daysSince = daysBetweenIsoDates(lastDay, todayDay);
  if (dueDate === null || daysSince === null) {
    return null;
  }
  const daysUntil = intervalDays - daysSince;
  return { dueDate, daysSince, daysUntil, late: daysUntil < 0, daysLate: Math.max(0, -daysUntil) };
}

/** "1 dia" or "N dias": the unit follows the number, zero is plural. */
export function formatDays(days: number): string | null {
  if (!Number.isInteger(days) || days < 0) {
    return null;
  }
  return days === 1 ? "1 dia" : `${days} dias`;
}

export interface ReevaluationCountdown {
  /** The size of the count: "90 dias", "1 dia". */
  amount: string;
  /** What the count is about: "até 23/10/2026" or "de atraso desde 23/10/2026". */
  relation: string;
  /** Both in one sentence: "90 dias até 23/10/2026" or "9 dias de atraso desde 23/10/2026". */
  text: string;
}

/**
 * The home's count to the next diagnosis: "N dias até {data}" while on time (the due day itself is
 * "0 dias até") and "N dias de atraso desde {data}" once the due day has passed. `null` for a
 * reevaluation that does not hold real days.
 */
export function reevaluationCountdown(
  reevaluation: Pick<Reevaluation, "dueDate" | "daysUntil" | "late" | "daysLate">,
): ReevaluationCountdown | null {
  const amount = formatDays(reevaluation.late ? reevaluation.daysLate : reevaluation.daysUntil);
  const due = isoToDateInput(reevaluation.dueDate);
  if (amount === null || due === "") {
    return null;
  }
  const relation = reevaluation.late ? `de atraso desde ${due}` : `até ${due}`;
  return { amount, relation, text: `${amount} ${relation}` };
}

export interface ReevaluationTimeline {
  /** The day of the last diagnosis as `DD/MM/AAAA`. */
  last: string;
  /** Today as `DD/MM/AAAA`. */
  today: string;
  /** The day the next diagnosis is due as `DD/MM/AAAA`. */
  next: string;
  /** The line under the count: "Último: 25/07/2026 · Hoje: 01/08/2026 · Próximo: 23/10/2026". */
  text: string;
}

/**
 * The Último / Hoje / Próximo line of the home, from three calendar days (`YYYY-MM-DD`). `null`
 * unless all three are real dates.
 */
export function reevaluationTimeline(lastDay: string, today: string, dueDate: string): ReevaluationTimeline | null {
  const last = isoToDateInput(lastDay);
  const now = isoToDateInput(today);
  const next = isoToDateInput(dueDate);
  if (last === "" || now === "" || next === "") {
    return null;
  }
  return { last, today: now, next, text: `Último: ${last} · Hoje: ${now} · Próximo: ${next}` };
}
