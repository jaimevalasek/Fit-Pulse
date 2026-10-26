import { describe, expect, it } from "vitest";
import {
  CNPJ_INVALID_MESSAGE,
  CNPJ_MASK_LENGTH,
  extractCnpjDigits,
  getCnpjError,
  isValidCnpj,
  maskCnpj,
  maskCnpjInput,
} from "../../shared/format/cnpj";
import {
  ANNUAL_REVENUE_RANGE_KEYS,
  ANNUAL_REVENUE_RANGE_OPTIONS,
  SALES_CHANNEL_KEYS,
  SALES_CHANNEL_OPTIONS,
  SEGMENT_KEYS,
  SEGMENT_OPTIONS,
  getAnnualRevenueRangeLabel,
  getSalesChannelLabel,
  getSegmentLabel,
} from "../../shared/content/companyOptions";

// AC-dm-08: mask 00.000.000/0000-00 while typing, check digits on blur.
const VALID_CNPJS = ["11.222.333/0001-81", "11.444.777/0001-61", "00.000.000/0001-91"];

describe("maskCnpj (AC-dm-08)", () => {
  it.each([
    ["", ""],
    ["1", "1"],
    ["12", "12"],
    ["123", "12.3"],
    ["12345", "12.345"],
    ["123456", "12.345.6"],
    ["12345678", "12.345.678"],
    ["123456789", "12.345.678/9"],
    ["123456789012", "12.345.678/9012"],
    ["1234567890123", "12.345.678/9012-3"],
    ["12345678901234", "12.345.678/9012-34"],
  ])("masks %s as %s", (typed, expected) => {
    expect(maskCnpj(typed)).toBe(expected);
  });

  it("never goes past 18 characters, even when more digits are pasted", () => {
    const masked = maskCnpj("123456789012345678");
    expect(masked).toBe("12.345.678/9012-34");
    expect(masked).toHaveLength(CNPJ_MASK_LENGTH);
  });

  it("drops letters and punctuation, and is idempotent", () => {
    expect(maskCnpj("ab12.345-678/9x")).toBe("12.345.678/9");
    expect(maskCnpj(maskCnpj("12345678901234"))).toBe("12.345.678/9012-34");
  });

  it("treats null and undefined as empty", () => {
    expect(maskCnpj(null)).toBe("");
    expect(maskCnpj(undefined)).toBe("");
    expect(extractCnpjDigits(undefined)).toBe("");
  });
});

describe("extractCnpjDigits", () => {
  it("keeps only the first 14 digits", () => {
    expect(extractCnpjDigits("11.222.333/0001-81")).toBe("11222333000181");
    expect(extractCnpjDigits("112223330001819999")).toBe("11222333000181");
  });
});

describe("isValidCnpj (AC-dm-08)", () => {
  it.each(VALID_CNPJS)("accepts %s, masked or not", (cnpj) => {
    expect(isValidCnpj(cnpj)).toBe(true);
    expect(isValidCnpj(extractCnpjDigits(cnpj))).toBe(true);
  });

  it("rejects a wrong first check digit", () => {
    expect(isValidCnpj("11.222.333/0001-91")).toBe(false);
  });

  it("rejects a wrong second check digit", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
  });

  it("rejects every check digit that is not the right one", () => {
    const base = "112223330001";
    const accepted: string[] = [];
    for (let first = 0; first <= 9; first += 1) {
      for (let second = 0; second <= 9; second += 1) {
        if (isValidCnpj(`${base}${first}${second}`)) accepted.push(`${first}${second}`);
      }
    }
    expect(accepted).toEqual(["81"]);
  });

  it("rejects repeated digits even though their check digits add up", () => {
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
  });

  it("rejects incomplete, empty and non numeric input", () => {
    expect(isValidCnpj("11.222.333/0001-8")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
    expect(isValidCnpj("abc")).toBe(false);
    expect(isValidCnpj(null)).toBe(false);
    expect(isValidCnpj(undefined)).toBe(false);
  });
});

describe("getCnpjError (AC-dm-08)", () => {
  it("has the exact copy from the acceptance criterion", () => {
    expect(CNPJ_INVALID_MESSAGE).toBe("CNPJ inválido. Formato: 00.000.000/0000-00.");
  });

  it("lets an empty optional field through", () => {
    expect(getCnpjError("")).toBeNull();
    expect(getCnpjError(null)).toBeNull();
    expect(getCnpjError(undefined)).toBeNull();
  });

  it("accepts a valid CNPJ", () => {
    expect(getCnpjError("11.222.333/0001-81")).toBeNull();
  });

  it("flags a wrong check digit with the inline message", () => {
    expect(getCnpjError("11.222.333/0001-82")).toBe(CNPJ_INVALID_MESSAGE);
  });

  it("flags a half typed number", () => {
    expect(getCnpjError("11.222")).toBe(CNPJ_INVALID_MESSAGE);
  });
});

describe("maskCnpjInput caret handling (deviation 5)", () => {
  it("keeps the caret at the end while typing at the end", () => {
    expect(maskCnpjInput("123", 3)).toEqual({ value: "12.3", caret: 4 });
    expect(maskCnpjInput("12.345.678/90123", 16)).toEqual({ value: "12.345.678/9012-3", caret: 17 });
  });

  it("defaults the caret to the end", () => {
    expect(maskCnpjInput("12345")).toEqual({ value: "12.345", caret: 6 });
  });

  it("keeps the caret beside the typed digit when editing in the middle", () => {
    // "12.3|45" and the owner types 9 -> "12.39|45"
    expect(maskCnpjInput("12.395", 5)).toEqual({ value: "12.395", caret: 5 });
    // "12|.345" and the owner types 9 -> digits 129345, caret after the 3rd digit
    expect(maskCnpjInput("129.345", 3)).toEqual({ value: "12.934.5", caret: 4 });
  });

  it("moves the caret past a separator that appears right after the typed digit", () => {
    expect(maskCnpjInput("12.3", 4)).toEqual({ value: "12.3", caret: 4 });
    expect(maskCnpjInput("1234", 4, "123")).toEqual({ value: "12.34", caret: 5 });
  });

  it("deleting a separator removes the digit before it instead of freezing the field", () => {
    // "12.|345" Backspace removes "." -> raw "12345" with the caret at 2; the "2" goes instead
    expect(maskCnpjInput("12345", 2, "12.345")).toEqual({ value: "13.45", caret: 1 });
  });

  it("deleting a digit keeps the caret where the digit was", () => {
    // "12.34|5" Backspace removes "4"
    expect(maskCnpjInput("12.35", 4, "12.345")).toEqual({ value: "12.35", caret: 4 });
  });

  it("clamps an out of range caret and handles an empty value", () => {
    expect(maskCnpjInput("12", 99)).toEqual({ value: "12", caret: 2 });
    expect(maskCnpjInput("", 0)).toEqual({ value: "", caret: 0 });
  });

  it("stays at 18 characters when a 15th digit is typed", () => {
    const result = maskCnpjInput("12.345.678/9012-345", 19, "12.345.678/9012-34");
    expect(result.value).toBe("12.345.678/9012-34");
    expect(result.caret).toBe(CNPJ_MASK_LENGTH);
  });
});

describe("companyOptions", () => {
  it("lists every key once, with a pt-BR label", () => {
    for (const [keys, options] of [
      [SEGMENT_KEYS, SEGMENT_OPTIONS],
      [SALES_CHANNEL_KEYS, SALES_CHANNEL_OPTIONS],
      [ANNUAL_REVENUE_RANGE_KEYS, ANNUAL_REVENUE_RANGE_OPTIONS],
    ] as const) {
      expect(new Set(keys).size).toBe(keys.length);
      expect(options.map((option) => option.key)).toEqual([...keys]);
      for (const option of options) {
        expect(option.label.trim().length).toBeGreaterThan(0);
        expect(option.key).toMatch(/^[a-z0-9_]+$/);
      }
    }
  });

  it("matches the labels approved in the prototype", () => {
    expect(getSegmentLabel("health_wellness")).toBe("Saúde e bem-estar");
    expect(getSalesChannelLabel("subscription")).toBe("Assinatura ou mensalidade");
    expect(getAnnualRevenueRangeLabel("up_to_4_8m")).toBe("Até R$ 4,8 milhões por ano (pequena empresa)");
  });

  it("shows an unknown key as itself instead of blank or inherited object members", () => {
    expect(getSegmentLabel("legacy_value")).toBe("legacy_value");
    expect(getSalesChannelLabel("constructor")).toBe("constructor");
    expect(getAnnualRevenueRangeLabel("toString")).toBe("toString");
  });
});
