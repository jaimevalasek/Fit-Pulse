import { describe, expect, it } from "vitest";
import {
  NEVER_PAYS_BACK_LABEL,
  NOT_CALCULATED_LABEL,
  NO_NEW_CUSTOMERS_EXPLANATION,
  formatInteger,
  formatPayback,
  formatRatio,
  formatRatioWithBand,
  getRatioBand,
} from "../../shared/format/displayNumbers";
import {
  MONEY_MAX_CENTS,
  formatMoney,
  maskMoneyInput,
  parseMoney,
} from "../../shared/format/money";

// AC-dm-15 / AC-dm-51: money in whole cents with the R$ 1.234,56 mask, and numbers that are
// never shown as NaN, Infinity or an empty value.
const FORBIDDEN_OUTPUT = /NaN|Infinity|undefined|null/;

describe("formatMoney (AC-dm-15, RULE-dm-12)", () => {
  it.each([
    [0, "R$ 0,00"],
    [1, "R$ 0,01"],
    [9, "R$ 0,09"],
    [10, "R$ 0,10"],
    [99, "R$ 0,99"],
    [100, "R$ 1,00"],
    [4500, "R$ 45,00"],
    [123456, "R$ 1.234,56"],
    [100000, "R$ 1.000,00"],
    [354000, "R$ 3.540,00"],
    [2400000, "R$ 24.000,00"],
    [100000000, "R$ 1.000.000,00"],
    [MONEY_MAX_CENTS, "R$ 99.999.999.999,99"],
    [-123456, "-R$ 1.234,56"],
  ])("formats %d cents as %s", (cents, expected) => {
    expect(formatMoney(cents)).toBe(expected);
  });

  it("uses a plain space after R$ so text matches are stable", () => {
    expect(formatMoney(123456)).not.toContain(" ");
  });

  it("shows -0 as zero", () => {
    expect(formatMoney(-0)).toBe("R$ 0,00");
  });

  it("answers 'não calculado' for anything that is not whole cents, never NaN or blank", () => {
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 12.5, 2 ** 60]) {
      expect(formatMoney(bad)).toBe(NOT_CALCULATED_LABEL);
    }
  });
});

describe("parseMoney", () => {
  it.each([
    ["R$ 1.234,56", 123456],
    ["R$ 0,00", 0],
    ["R$ 0,05", 5],
    ["1234,56", 123456],
    ["12,5", 1250],
    ["12,05", 1205],
    ["1234", 123400],
    ["1.234", 123400],
    ["  R$ 45,00 ", 4500],
    ["-R$ 1.234,56", -123456],
    ["R$ 99.999.999.999,99", MONEY_MAX_CENTS],
  ])("reads %j as %d cents", (text, expected) => {
    expect(parseMoney(text)).toBe(expected);
  });

  it.each([[""], ["R$"], ["abc"], ["1,234"], ["1.23"], ["12,345"], ["1,2,3"], ["R$ -1,00"], ["1e5"]])(
    "refuses %j",
    (text) => {
      expect(parseMoney(text)).toBeNull();
    },
  );

  it("refuses null, undefined and amounts past the limit", () => {
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
    expect(parseMoney("R$ 100.000.000.000,00")).toBeNull();
    expect(parseMoney("9".repeat(400))).toBeNull();
  });

  it("round-trips whatever formatMoney prints", () => {
    for (const cents of [0, 1, 99, 100, 123456, 354000, MONEY_MAX_CENTS, -4500]) {
      expect(parseMoney(formatMoney(cents))).toBe(cents);
    }
  });
});

describe("maskMoneyInput (AC-dm-15)", () => {
  it("fills the cents from the right while typing at the end", () => {
    expect(maskMoneyInput("1")).toEqual({ value: "R$ 0,01", cents: 1, caret: 7 });
    expect(maskMoneyInput("R$ 0,012")).toEqual({ value: "R$ 0,12", cents: 12, caret: 7 });
    expect(maskMoneyInput("R$ 0,123")).toEqual({ value: "R$ 1,23", cents: 123, caret: 7 });
    expect(maskMoneyInput("R$ 1,234")).toEqual({ value: "R$ 12,34", cents: 1234, caret: 8 });
    expect(maskMoneyInput("R$ 12.345,67")).toEqual({ value: "R$ 12.345,67", cents: 1234567, caret: 12 });
  });

  it("reads a pasted amount as its digits", () => {
    expect(maskMoneyInput("1234567")).toMatchObject({ value: "R$ 12.345,67", cents: 1234567 });
  });

  it("empties the field when there is nothing left to read", () => {
    expect(maskMoneyInput("")).toEqual({ value: "", cents: null, caret: 0 });
    expect(maskMoneyInput("R$ ")).toEqual({ value: "", cents: null, caret: 0 });
    expect(maskMoneyInput("abc")).toEqual({ value: "", cents: null, caret: 0 });
  });

  it("keeps a typed zero as R$ 0,00 (BR-dm-15: a margin of zero is a value)", () => {
    expect(maskMoneyInput("0")).toEqual({ value: "R$ 0,00", cents: 0, caret: 7 });
    expect(maskMoneyInput("R$ 0,005", undefined, "R$ 0,00")).toMatchObject({ value: "R$ 0,05", cents: 5 });
  });

  it("keeps the caret next to the typed digit when editing in the middle", () => {
    // "R$ 1|2,34" and the owner types 5 -> "R$ 15|2,34"
    expect(maskMoneyInput("R$ 152,34", 5, "R$ 12,34")).toEqual({ value: "R$ 152,34", cents: 15234, caret: 5 });
    // "R$ 0,1|2" and the owner types 5 -> leading zero disappears, caret stays before the last digit
    expect(maskMoneyInput("R$ 0,152", 7, "R$ 0,12")).toEqual({ value: "R$ 1,52", cents: 152, caret: 6 });
  });

  it("keeps the caret in place when a digit is removed in the middle", () => {
    // "R$ 1.23|4,56" Backspace removes "3"
    expect(maskMoneyInput("R$ 1.24,56", 6, "R$ 1.234,56")).toEqual({ value: "R$ 124,56", cents: 12456, caret: 5 });
  });

  it("deleting a separator removes the digit before it instead of freezing the field", () => {
    // "R$ 1.234,|56" Backspace removes "," and the "4" before it goes instead
    expect(maskMoneyInput("R$ 1.23456", 8, "R$ 1.234,56")).toEqual({ value: "R$ 123,56", cents: 12356, caret: 7 });
    // "R$ 1.|234,56" Backspace removes "." and the "1" before it goes instead
    expect(maskMoneyInput("R$ 1234,56", 4, "R$ 1.234,56")).toEqual({ value: "R$ 234,56", cents: 23456, caret: 3 });
  });

  it("lets an optional value be cleared: backspace on R$ 0,05 -> R$ 0,00 -> empty", () => {
    expect(maskMoneyInput("R$ 0,0", 6, "R$ 0,05")).toMatchObject({ value: "R$ 0,00", cents: 0 });
    expect(maskMoneyInput("R$ 0,0", 6, "R$ 0,00")).toEqual({ value: "", cents: null, caret: 0 });
  });

  it("rejects the 14th digit when there is a previous value, and truncates when there is none", () => {
    const full = formatMoney(MONEY_MAX_CENTS);
    expect(maskMoneyInput(`${full}0`, full.length + 1, full)).toEqual({
      value: full,
      cents: MONEY_MAX_CENTS,
      caret: full.length,
    });
    expect(maskMoneyInput("12345678901234")).toMatchObject({ cents: 1234567890123 });
  });

  it("clamps an out of range caret", () => {
    expect(maskMoneyInput("12", 99)).toEqual({ value: "R$ 0,12", cents: 12, caret: 7 });
    expect(maskMoneyInput("12", -4)).toMatchObject({ value: "R$ 0,12", caret: 5 });
  });
});

describe("formatInteger", () => {
  it("groups thousands with dots and keeps the sign", () => {
    expect(formatInteger(0)).toBe("0");
    expect(formatInteger(999)).toBe("999");
    expect(formatInteger(1000)).toBe("1.000");
    expect(formatInteger(1234567)).toBe("1.234.567");
    expect(formatInteger(-1234567)).toBe("-1.234.567");
  });

  it("does not print NaN or exponent notation", () => {
    expect(formatInteger(Number.NaN)).toBe(NOT_CALCULATED_LABEL);
    expect(formatInteger(1.5)).toBe(NOT_CALCULATED_LABEL);
    expect(formatInteger(1e300)).toBe(NOT_CALCULATED_LABEL);
  });
});

describe("formatRatio (RULE-dm-03)", () => {
  it.each([
    [4.56, "4,6×"],
    [6.1875, "6,2×"],
    [5, "5,0×"],
    [0, "0,0×"],
    [0.04, "0,0×"],
    [0.05, "0,1×"],
    [3, "3,0×"],
    [12.25, "12,3×"],
    [1234.56, "1.234,6×"],
  ])("shows %d as %s", (ratio, expected) => {
    expect(formatRatio(ratio)).toBe(expected);
  });

  it("answers 'não calculado' instead of NaN or Infinity", () => {
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, 1e300]) {
      expect(formatRatio(bad)).toBe(NOT_CALCULATED_LABEL);
    }
  });
});

describe("getRatioBand (BR-dm-03)", () => {
  it.each([
    [0, "critical", "Crítico"],
    [0.99, "critical", "Crítico"],
    [1, "attention", "Atenção"],
    [2.99, "attention", "Atenção"],
    [3, "healthy", "Saudável"],
    [4.56, "healthy", "Saudável"],
    [5, "healthy", "Saudável"],
    [5.01, "invest_more", "Pode investir mais"],
    [6.1875, "invest_more", "Pode investir mais"],
  ])("puts %d in %s (%s)", (ratio, key, label) => {
    expect(getRatioBand(ratio)).toMatchObject({ key, label });
  });

  it("has a phrase for every band", () => {
    for (const ratio of [0, 1, 3, 6]) {
      expect(getRatioBand(ratio)?.phrase.length).toBeGreaterThan(10);
    }
  });

  it("has no band when the ratio is unknown", () => {
    for (const bad of [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -0.5]) {
      expect(getRatioBand(bad)).toBeNull();
    }
  });

  it("judges the exact ratio, not the rounded one on screen (RULE-dm-03)", () => {
    expect(formatRatio(5.04)).toBe("5,0×");
    expect(getRatioBand(5.04)?.key).toBe("invest_more");
    expect(formatRatio(2.96)).toBe("3,0×");
    expect(getRatioBand(2.96)?.key).toBe("attention");
  });
});

describe("formatRatioWithBand (AC-dm-51)", () => {
  it("reads '0,0× Crítico' when the margin is zero", () => {
    expect(formatRatioWithBand(0)).toBe("0,0× Crítico");
  });

  it("joins the ratio and its label", () => {
    expect(formatRatioWithBand(4.56)).toBe("4,6× Saudável");
    expect(formatRatioWithBand(6.1875)).toBe("6,2× Pode investir mais");
    expect(formatRatioWithBand(2)).toBe("2,0× Atenção");
  });

  it("answers 'não calculado' without a ratio", () => {
    expect(formatRatioWithBand(null)).toBe(NOT_CALCULATED_LABEL);
    expect(formatRatioWithBand(Number.NaN)).toBe(NOT_CALCULATED_LABEL);
  });
});

describe("formatPayback (RULE-dm-03, BR-dm-15)", () => {
  it.each([
    [3.9, "4 meses"],
    [7.2, "8 meses"],
    [5.8, "6 meses"],
    [12, "12 meses"],
    [12.01, "13 meses"],
    [0.2, "1 mês"],
    [1, "1 mês"],
    [0, "0 meses"],
    [1200.4, "1.201 meses"],
  ])("shows %d months as %s", (months, expected) => {
    expect(formatPayback(months)).toBe(expected);
  });

  it("says 'não se paga' when the customer never pays back", () => {
    expect(formatPayback("never")).toBe(NEVER_PAYS_BACK_LABEL);
    expect(formatPayback(Number.POSITIVE_INFINITY)).toBe("não se paga");
  });

  it("says 'não calculado' when there is nothing to calculate", () => {
    for (const bad of [null, undefined, Number.NaN, Number.NEGATIVE_INFINITY, -3, 1e300]) {
      expect(formatPayback(bad)).toBe(NOT_CALCULATED_LABEL);
    }
  });
});

describe("BR-dm-14 wording", () => {
  it("keeps the approved explanation", () => {
    expect(NO_NEW_CUSTOMERS_EXPLANATION).toBe(
      "Sem clientes novos no período, não dá para calcular o custo de um cliente",
    );
  });
});

describe("no formatter ever prints NaN, Infinity or a blank (AC-dm-51)", () => {
  const hostile = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0.5, 1e300];

  it("holds for every display helper and hostile input", () => {
    for (const input of hostile) {
      for (const output of [
        formatMoney(input),
        formatRatio(input),
        formatRatioWithBand(input),
        formatPayback(input),
      ]) {
        expect(output.trim()).not.toBe("");
        expect(output).not.toMatch(FORBIDDEN_OUTPUT);
      }
    }
  });
});
