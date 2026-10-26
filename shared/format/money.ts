import { NOT_CALCULATED_LABEL, formatInteger } from "./displayNumbers";

// Money is always whole cents (RULE-dm-12). 13 digits of cents is R$ 99.999.999.999,99.
export const MONEY_MAX_DIGITS = 13;
export const MONEY_MAX_CENTS = 10 ** MONEY_MAX_DIGITS - 1;

export interface MaskedMoneyInput {
  value: string;
  caret: number;
  cents: number | null;
}

function isValidCents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

// 123456 -> "R$ 1.234,56". Anything that is not whole cents shows as "não calculado".
export function formatMoney(cents: number | null | undefined): string {
  if (!isValidCents(cents)) return NOT_CALCULATED_LABEL;
  const absolute = Math.abs(cents);
  const reais = formatInteger(Math.floor(absolute / 100));
  const remainder = String(absolute % 100).padStart(2, "0");
  return `${cents < 0 ? "-" : ""}R$ ${reais},${remainder}`;
}

// Reads the pt-BR notation back into cents: "R$ 1.234,56" -> 123456, "12,5" -> 1250,
// "1234" -> 123400 (reais). Returns null for anything else.
export function parseMoney(text: string | null | undefined): number | null {
  if (typeof text !== "string") return null;
  let rest = text.replace(/[\s ]/g, "");
  const negative = rest.startsWith("-");
  if (negative) rest = rest.slice(1);
  if (rest.startsWith("R$")) rest = rest.slice(2);
  const match = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(rest);
  if (match === null) return null;
  const reais = Number((match[1] ?? "").replace(/\./g, ""));
  const cents = reais * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (cents > MONEY_MAX_CENTS) return null;
  return negative && cents !== 0 ? -cents : cents;
}

function stripLeadingZeros(digits: string): string {
  return digits.replace(/^0+(?=\d)/, "");
}

function digitsAfter(text: string, caret: number): number {
  return (text.slice(caret).match(/\d/g) ?? []).length;
}

function caretWithDigitsAfter(masked: string, digitsToTheRight: number): number {
  if (digitsToTheRight <= 0) return masked.length;
  let seen = 0;
  for (let index = masked.length - 1; index >= 0; index -= 1) {
    if (/\d/.test(masked.charAt(index))) {
      seen += 1;
      if (seen === digitsToTheRight) return index;
    }
  }
  return 0;
}

function maskedFromDigits(digits: string): { value: string; cents: number | null } {
  if (digits === "") return { value: "", cents: null };
  const cents = Number(digits);
  return { value: formatMoney(cents), cents };
}

// Typed digits fill the cents from the right ("12" -> "R$ 0,12"). The caret is kept by counting
// the digits on its right, because those are the ones anchored to the cents. `previous` is the
// value before the keystroke: it lets a Backspace over "R$ ", "." or "," remove the digit before
// it instead of leaving the field unchanged, and it is what a rejected edit falls back to once
// the 13-digit limit is hit.
export function maskMoneyInput(rawValue: string, caret?: number, previous?: string): MaskedMoneyInput {
  let raw = rawValue;
  let position = Math.min(Math.max(caret ?? raw.length, 0), raw.length);

  const separatorWasDeleted =
    previous !== undefined &&
    raw.length < previous.length &&
    raw.replace(/\D/g, "") === previous.replace(/\D/g, "");
  if (separatorWasDeleted) {
    const lastDigit = raw.slice(0, position).search(/\d(?!.*\d)/);
    if (lastDigit >= 0) {
      raw = raw.slice(0, lastDigit) + raw.slice(lastDigit + 1);
      position = lastDigit;
    }
  }

  const previousDigits = stripLeadingZeros((previous ?? "").replace(/\D/g, ""));
  let digits = stripLeadingZeros(raw.replace(/\D/g, ""));
  if (digits.length > MONEY_MAX_DIGITS) {
    if (previous === undefined) {
      digits = digits.slice(0, MONEY_MAX_DIGITS);
    } else {
      const fallback = maskedFromDigits(previousDigits);
      return { ...fallback, caret: Math.max(Math.min(position - 1, fallback.value.length), 0) };
    }
  }
  // Backspacing a field that already reads R$ 0,00 empties it, so an optional value can be cleared.
  const wasDeleted = previous !== undefined && raw.length < previous.length;
  if (wasDeleted && digits === "0" && previousDigits === "0") digits = "";

  const masked = maskedFromDigits(digits);
  return { ...masked, caret: caretWithDigitsAfter(masked.value, digitsAfter(raw, position)) };
}
