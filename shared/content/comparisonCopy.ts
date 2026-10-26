import type { DiagnosisComparison, StageChange } from "../domain/compareDiagnoses.ts";

// The words of a comparison between two diagnoses. The "Comparar" screen and the evolution PDF
// print the same text from here, so the same pair is never told two ways (AC-ra-13, RULE-ra-02).

export type ChangeDirection = StageChange["direction"];

export const DELTA_WORDS: Record<ChangeDirection, string> = { up: "subiu", down: "caiu", same: "igual" };

export const STAGE_MOVES: Record<ChangeDirection, string> = {
  up: "Subiu de degrau.",
  down: "Desceu de degrau.",
  same: "Mesmo degrau.",
};

export function directionOf(delta: number): ChangeDirection {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "same";
}

/** "+12 subiu", "−5 caiu" or "0 igual": a difference of scores, always with the words and never only a sign. */
export function formatDelta(delta: number): string {
  const signed = delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0";
  return `${signed} ${DELTA_WORDS[directionOf(delta)]}`;
}

function toDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * "outubro". The year is added when it differs from the other date, so a comparison across years
 * reads "dezembro de 2025" → "março". `timeZone` defaults to the machine's own.
 */
export function formatComparisonMonth(iso: string, otherIso?: string | null, timeZone?: string): string {
  const date = toDate(iso);
  if (!date) return "";
  const other = otherIso ? toDate(otherIso) : null;
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone }).format(date);
  const yearOf = (value: Date) => Number(new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(value));
  return other && yearOf(other) !== yearOf(date) ? `${month} de ${yearOf(date)}` : month;
}

/**
 * The note that explains which number counts when the earlier diagnosis was calculated with other
 * rules (RULE-dm-11, RULE-ra-02); `null` when both used the same rules.
 */
export function recalculationNotice(comparison: DiagnosisComparison, timeZone?: string): string | null {
  const { recalculated, previous, current, average } = comparison;
  if (!recalculated) return null;
  const month = formatComparisonMonth(previous.completedAt, current.completedAt, timeZone);
  return (
    `O diagnóstico de ${month} foi feito com as regras ${recalculated.fromVersion}. ` +
    `Para a comparação ser justa, recalculamos as respostas dele com as regras ${recalculated.toVersion}: ` +
    `a média de ${month} fica em ${average.before} pontos, e é esse o número usado aqui. ` +
    `A nota registrada na época (estágio ${recalculated.originalScore.stage}, média ${recalculated.originalScore.average}) ` +
    `continua guardada no histórico.`
  );
}
