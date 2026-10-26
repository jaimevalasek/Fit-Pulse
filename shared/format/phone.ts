/** `(11) 91234-5678`, the longest the mask grows. */
export const PHONE_MASK_MAX_LENGTH = 15;
export const PHONE_INVALID_MESSAGE = "Telefone inválido. Use (11) 91234-5678.";

const AREA_CODE_LENGTH = 2;
const LANDLINE_DIGITS_LENGTH = 10;
const MOBILE_DIGITS_LENGTH = 11;
const MOBILE_FIRST_DIGIT = "9";
// Mobile numbers group 5-4 and landlines 4-4, so the mask follows the first digit after the area code.
const MOBILE_HEAD_LENGTH = 5;
const LANDLINE_HEAD_LENGTH = 4;

const COUNTRY_CODE_PREFIX = /^\s*\+55/;
const TYPED_CHARACTERS = /^[\d\s()-]*$/;
// Area codes have two digits and none of them is 0; a landline subscriber never starts with 0 or 9.
const AREA_CODE_AND_LANDLINE_START = /^[1-9][1-9][1-8]/;
const AREA_CODE_AND_MOBILE_START = /^[1-9][1-9]9/;

export interface MaskedPhoneInput {
  value: string;
  caret: number;
}

function withoutCountryCode(value: string): string {
  return value.replace(COUNTRY_CODE_PREFIX, "");
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isMobileDigits(digits: string): boolean {
  return digits.charAt(AREA_CODE_LENGTH) === MOBILE_FIRST_DIGIT;
}

function maxDigitsFor(digits: string): number {
  return isMobileDigits(digits) ? MOBILE_DIGITS_LENGTH : LANDLINE_DIGITS_LENGTH;
}

/** The digits a phone field holds: a leading `+55` is dropped and a landline stops at 10 digits, a mobile at 11. */
export function extractPhoneDigits(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const digits = onlyDigits(withoutCountryCode(value)).slice(0, MOBILE_DIGITS_LENGTH);
  return digits.slice(0, maxDigitsFor(digits));
}

export function maskPhone(value: string | null | undefined): string {
  const digits = extractPhoneDigits(value);
  if (digits === "") return "";
  const areaCode = digits.slice(0, AREA_CODE_LENGTH);
  if (digits.length <= AREA_CODE_LENGTH) return `(${areaCode}`;

  const subscriber = digits.slice(AREA_CODE_LENGTH);
  const headLength = isMobileDigits(digits) ? MOBILE_HEAD_LENGTH : LANDLINE_HEAD_LENGTH;
  const tail = subscriber.slice(headLength);
  return `(${areaCode}) ${subscriber.slice(0, headLength)}${tail === "" ? "" : `-${tail}`}`;
}

/** True for a complete landline `(11) 1234-5678` or mobile `(11) 91234-5678`; extra or foreign characters are refused. */
export function isValidPhone(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const typed = withoutCountryCode(value);
  if (!TYPED_CHARACTERS.test(typed)) return false;

  const digits = onlyDigits(typed);
  if (digits.length === MOBILE_DIGITS_LENGTH) return AREA_CODE_AND_MOBILE_START.test(digits);
  if (digits.length === LANDLINE_DIGITS_LENGTH) return AREA_CODE_AND_LANDLINE_START.test(digits);
  return false;
}

// The phone is optional: an empty field is fine, anything else must be a complete number.
export function getPhoneError(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return isValidPhone(value) ? null : PHONE_INVALID_MESSAGE;
}

/** The masked number, or `null` when the value is not a valid phone. */
export function normalizePhone(value: string | null | undefined): string | null {
  return isValidPhone(value) ? maskPhone(value) : null;
}

// Same caret rule as the CNPJ field (cnpj.ts keeps its own copy of these two helpers).
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
// digit the user just touched. `previous` is the value before the keystroke: it lets a Backspace
// over `(`, `)`, a space or `-` remove the digit before it instead of leaving the field unchanged.
export function maskPhoneInput(rawValue: string, caret?: number, previous?: string): MaskedPhoneInput {
  let raw = rawValue;
  let position = Math.min(Math.max(caret ?? raw.length, 0), raw.length);

  const separatorWasDeleted =
    previous !== undefined && raw.length < previous.length && onlyDigits(raw) === onlyDigits(previous);
  if (separatorWasDeleted) {
    const before = raw.slice(0, position);
    const lastDigit = before.search(/\d(?!.*\d)/);
    if (lastDigit >= 0) {
      raw = raw.slice(0, lastDigit) + raw.slice(lastDigit + 1);
      position = lastDigit;
    }
  }

  const value = maskPhone(raw);
  const digitCount = Math.min(digitsBefore(raw, position), onlyDigits(value).length);
  return { value, caret: caretAfterDigitCount(value, digitCount) };
}
