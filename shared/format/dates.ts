// Calendar dates the owner types as DD/MM/AAAA and the app stores as YYYY-MM-DD (no time, no time zone).

export const DATE_DIGITS_LENGTH = 8;
export const DATE_MASK_LENGTH = 10;
export const DATE_INVALID_MESSAGE = "Data inválida. Use o formato DD/MM/AAAA.";

/** Years outside this range are typos, not deadlines. */
export const MIN_DATE_YEAR = 1900;
export const MAX_DATE_YEAR = 2999;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface MaskedDateInput {
  value: string;
  caret: number;
}

export function extractDateDigits(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").slice(0, DATE_DIGITS_LENGTH);
}

export function maskDate(value: string | null | undefined): string {
  const digits = extractDateDigits(value);
  let masked = digits.slice(0, 2);
  if (digits.length > 2) masked += `/${digits.slice(2, 4)}`;
  if (digits.length > 4) masked += `/${digits.slice(4, 8)}`;
  return masked;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return isLeapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** A day that exists on the calendar (29/02 only in leap years) within the accepted years. */
export function isRealDate(year: number, month: number, day: number): boolean {
  if (![year, month, day].every(Number.isInteger)) return false;
  if (year < MIN_DATE_YEAR || year > MAX_DATE_YEAR || month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

/** Whether the text is a real calendar date written as `YYYY-MM-DD`. */
export function isValidIsoDate(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const match = ISO_DATE_PATTERN.exec(value);
  return match !== null && isRealDate(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** `DD/MM/AAAA` (or just its digits) to `YYYY-MM-DD`; `null` unless it is a complete, real date. */
export function dateInputToIso(value: string | null | undefined): string | null {
  const digits = extractDateDigits(value);
  if (digits.length !== DATE_DIGITS_LENGTH) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (!isRealDate(year, month, day)) return null;
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

/** `YYYY-MM-DD` to `DD/MM/AAAA`; an empty text when the value is not a real date. */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!isValidIsoDate(iso)) return "";
  const [year, month, day] = (iso as string).split("-");
  return `${day}/${month}/${year}`;
}

// The date field is optional: an empty field is fine, anything else must be a complete real date.
export function getDateError(value: string | null | undefined): string | null {
  if (extractDateDigits(value) === "") return null;
  return dateInputToIso(value) === null ? DATE_INVALID_MESSAGE : null;
}

/** The local calendar day of a moment as `YYYY-MM-DD` ("today" is the computer's date); `null` for an invalid moment. */
export function localIsoDate(moment: Date): string | null {
  if (Number.isNaN(moment.getTime())) return null;
  const year = String(moment.getFullYear()).padStart(4, "0");
  const month = String(moment.getMonth() + 1).padStart(2, "0");
  const day = String(moment.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function caretAfterDigitCount(masked: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < masked.length; index += 1) {
    if (/\d/.test(masked.charAt(index))) {
      seen += 1;
      if (seen === digitCount) return index + 1;
    }
  }
  return masked.length;
}

function digitsBefore(text: string, caret: number): number {
  return (text.slice(0, caret).match(/\d/g) ?? []).length;
}

// Applies the mask to what the browser reports after a keystroke and keeps the caret next to the
// digit the user just touched, so editing in the middle of the date does not jump to the end.
// `previous` is the value before the keystroke: it lets a Backspace over a slash remove the
// digit before it instead of leaving the field unchanged.
function maskDigitsInput(
  applyMask: (value: string) => string,
  maxDigits: number,
  rawValue: string,
  caret?: number,
  previous?: string,
): MaskedDateInput {
  let raw = rawValue;
  let position = Math.min(Math.max(caret ?? raw.length, 0), raw.length);

  const separatorWasDeleted =
    previous !== undefined &&
    raw.length < previous.length &&
    raw.replace(/\D/g, "") === previous.replace(/\D/g, "");
  if (separatorWasDeleted) {
    const before = raw.slice(0, position);
    const lastDigit = before.search(/\d(?!.*\d)/);
    if (lastDigit >= 0) {
      raw = raw.slice(0, lastDigit) + raw.slice(lastDigit + 1);
      position = lastDigit;
    }
  }

  const value = applyMask(raw);
  const digitCount = Math.min(digitsBefore(raw, position), maxDigits);
  return { value, caret: caretAfterDigitCount(value, digitCount) };
}

export function maskDateInput(rawValue: string, caret?: number, previous?: string): MaskedDateInput {
  return maskDigitsInput(maskDate, DATE_DIGITS_LENGTH, rawValue, caret, previous);
}

// Calendar months (the diary): the owner types MM/AAAA and the app stores YYYY-MM.

export const MONTH_DIGITS_LENGTH = 6;
export const MONTH_MASK_LENGTH = 7;
export const MONTH_REQUIRED_MESSAGE = "Informe o mês. Use o formato MM/AAAA.";
export const MONTH_INVALID_MESSAGE = "Mês inválido. Use o formato MM/AAAA.";
export const MONTH_FUTURE_MESSAGE = "Esse mês ainda não chegou. Anote o mês quando ele fechar.";

const ISO_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;
const MONTH_SHORT_LENGTH = 3;

export function extractMonthDigits(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").slice(0, MONTH_DIGITS_LENGTH);
}

export function maskMonth(value: string | null | undefined): string {
  const digits = extractMonthDigits(value);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2, 6)}` : digits;
}

/** Same caret handling as `maskDateInput`, for the `MM/AAAA` field. */
export function maskMonthInput(rawValue: string, caret?: number, previous?: string): MaskedDateInput {
  return maskDigitsInput(maskMonth, MONTH_DIGITS_LENGTH, rawValue, caret, previous);
}

/** A month 1..12 of a year inside the accepted range. */
export function isRealMonth(year: number, month: number): boolean {
  if (![year, month].every(Number.isInteger)) return false;
  return year >= MIN_DATE_YEAR && year <= MAX_DATE_YEAR && month >= 1 && month <= 12;
}

/** Whether the text is a real month written as `YYYY-MM`. */
export function isValidIsoMonth(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const match = ISO_MONTH_PATTERN.exec(value);
  return match !== null && isRealMonth(Number(match[1]), Number(match[2]));
}

/** `MM/AAAA` (or just its digits) to `YYYY-MM`; `null` unless it is a complete, real month. */
export function monthInputToIso(value: string | null | undefined): string | null {
  const digits = extractMonthDigits(value);
  if (digits.length !== MONTH_DIGITS_LENGTH) return null;
  if (!isRealMonth(Number(digits.slice(2, 6)), Number(digits.slice(0, 2)))) return null;
  return `${digits.slice(2, 6)}-${digits.slice(0, 2)}`;
}

/** `YYYY-MM` to `MM/AAAA`; an empty text when the value is not a real month. */
export function isoToMonthInput(iso: string | null | undefined): string {
  if (!isValidIsoMonth(iso)) return "";
  const [year, month] = (iso as string).split("-");
  return `${month}/${year}`;
}

/** The local calendar month of a moment as `YYYY-MM`; `null` for an invalid moment. */
export function localIsoMonth(moment: Date): string | null {
  const day = localIsoDate(moment);
  return day === null ? null : day.slice(0, 7);
}

/** A month after `currentMonth` (both `YYYY-MM`): not happened yet, so it cannot be noted. */
export function isFutureMonth(month: string, currentMonth: string): boolean {
  return isValidIsoMonth(month) && isValidIsoMonth(currentMonth) && month > currentMonth;
}

/** The month field is required: empty, incomplete, impossible and future months each get a field message. */
export function getMonthError(value: string | null | undefined, currentMonth: string): string | null {
  if (extractMonthDigits(value) === "") return MONTH_REQUIRED_MESSAGE;
  const iso = monthInputToIso(value);
  if (iso === null) return MONTH_INVALID_MESSAGE;
  return isFutureMonth(iso, currentMonth) ? MONTH_FUTURE_MESSAGE : null;
}

/** "2026-08" to "agosto de 2026"; an empty text when the value is not a real month. */
export function formatMonthLong(iso: string | null | undefined): string {
  if (!isValidIsoMonth(iso)) return "";
  const [year, month] = (iso as string).split("-");
  return `${MONTH_NAMES[Number(month) - 1]} de ${year}`;
}

/** "2026-08" to "ago/2026"; an empty text when the value is not a real month. */
export function formatMonthShort(iso: string | null | undefined): string {
  if (!isValidIsoMonth(iso)) return "";
  const [year, month] = (iso as string).split("-");
  return `${MONTH_NAMES[Number(month) - 1].slice(0, MONTH_SHORT_LENGTH)}/${year}`;
}
