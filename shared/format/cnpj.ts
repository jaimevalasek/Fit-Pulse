export const CNPJ_DIGITS_LENGTH = 14;
export const CNPJ_MASK_LENGTH = 18;
export const CNPJ_INVALID_MESSAGE = "CNPJ inválido. Formato: 00.000.000/0000-00.";

const FIRST_CHECK_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_CHECK_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export interface MaskedCnpjInput {
  value: string;
  caret: number;
}

export function extractCnpjDigits(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  return value.replace(/\D/g, "").slice(0, CNPJ_DIGITS_LENGTH);
}

export function maskCnpj(value: string | null | undefined): string {
  const digits = extractCnpjDigits(value);
  let masked = digits.slice(0, 2);
  if (digits.length > 2) masked += `.${digits.slice(2, 5)}`;
  if (digits.length > 5) masked += `.${digits.slice(5, 8)}`;
  if (digits.length > 8) masked += `/${digits.slice(8, 12)}`;
  if (digits.length > 12) masked += `-${digits.slice(12, 14)}`;
  return masked;
}

function checkDigit(digits: string, weights: number[]): number {
  let sum = 0;
  for (let index = 0; index < weights.length; index += 1) {
    sum += Number(digits[index]) * (weights[index] ?? 0);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string | null | undefined): boolean {
  const digits = extractCnpjDigits(value);
  if (digits.length !== CNPJ_DIGITS_LENGTH) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return (
    checkDigit(digits, FIRST_CHECK_WEIGHTS) === Number(digits[12]) &&
    checkDigit(digits, SECOND_CHECK_WEIGHTS) === Number(digits[13])
  );
}

// The CNPJ is optional: an empty field is fine, anything else must be a complete valid number.
export function getCnpjError(value: string | null | undefined): string | null {
  if (extractCnpjDigits(value) === "") return null;
  return isValidCnpj(value) ? null : CNPJ_INVALID_MESSAGE;
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
// digit the user just touched, so editing in the middle of the number does not jump to the end.
// `previous` is the value before the keystroke: it lets a Backspace over a separator remove the
// digit before it instead of leaving the field unchanged.
export function maskCnpjInput(rawValue: string, caret?: number, previous?: string): MaskedCnpjInput {
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

  const value = maskCnpj(raw);
  const digitCount = Math.min(digitsBefore(raw, position), CNPJ_DIGITS_LENGTH);
  return { value, caret: caretAfterDigitCount(value, digitCount) };
}
