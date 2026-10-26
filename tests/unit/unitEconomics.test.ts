import { describe, expect, it } from "vitest";
import { computeUnitEconomics, roundHalfUp } from "../../shared/domain/unitEconomics";
import {
  EMPTY_CALCULATOR,
  type CalculatorInput,
  type UnitEconomics,
} from "../../shared/domain/types";
import {
  NEVER_PAYS_BACK_LABEL,
  NOT_CALCULATED_LABEL,
  formatPayback,
  formatRatio,
  formatRatioWithBand,
  getRatioBand,
} from "../../shared/format/displayNumbers";
import { rulesV1 } from "../../shared/rules/rulesV1";

// AC-dm-15 and AC-dm-51: CAC, LTV, ratio and payback in whole cents (RULE-dm-03, RULE-dm-12),
// with the edge cases of BR-dm-01, BR-dm-02, BR-dm-14 and BR-dm-15.

function calculatorOf(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return { ...EMPTY_CALCULATOR, spendParts: {}, ...overrides };
}

// Measured cost: R$ 3.540,00 spent for 59 new customers (CAC R$ 60,00), the G2 numbers.
function measuredCalculator(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return calculatorOf({
    spendMode: "exact",
    spendParts: { ads: 354_000 },
    newCustomersMode: "exact",
    newCustomers: 59,
    averagePurchaseCents: 4_800,
    purchasesPerYear: "sevenToTwelve",
    relationshipLength: "oneToTwoYears",
    marginPercent: 40,
    ...overrides,
  });
}

const REFERENCE_CALCULATORS = {
  // G1: spend "não sei", new customers by range.
  G1: calculatorOf({
    spendMode: "unknown",
    newCustomersMode: "range",
    newCustomersRange: "from11To30",
    averagePurchaseCents: 4_500,
    purchasesPerYear: "twoToThree",
    relationshipLength: "oneToTwoYears",
    marginPercent: 40,
  }),
  G2: measuredCalculator(),
  G3: measuredCalculator({
    spendParts: { ads: 2_400_000 },
    newCustomers: 80,
    averagePurchaseCents: 45_000,
    purchasesPerYear: "twoToThree",
    relationshipLength: "twoToFourYears",
    marginPercent: 55,
  }),
  G4: measuredCalculator({
    spendParts: { ads: 3_000_000 },
    newCustomers: 100,
    averagePurchaseCents: 20_000,
    purchasesPerYear: "fourToSix",
    relationshipLength: "twoToFourYears",
    marginPercent: 50,
  }),
};

function numericFieldsOf(economics: UnitEconomics): Array<number | null> {
  return [
    economics.spendCents,
    economics.newCustomers,
    economics.cacCents,
    economics.ltvCents,
    economics.ratio,
    economics.paybackMonths,
  ];
}

describe("computeUnitEconomics: reference cases G1 to G4 (AC-dm-15)", () => {
  it("G1 has no cost per customer: spend is unknown, new customers are estimated by range", () => {
    const economics = computeUnitEconomics(REFERENCE_CALCULATORS.G1, rulesV1);
    expect(economics).toEqual({
      spendCents: null,
      newCustomers: 20,
      spendOrigin: "unknown",
      newCustomersOrigin: "estimated",
      origin: "unknown",
      cacCents: null,
      ltvCents: 6_750,
      ratio: null,
      paybackMonths: null,
      neverPaysBack: false,
    });
    expect(formatRatio(economics.ratio)).toBe(NOT_CALCULATED_LABEL);
    expect(formatPayback(economics.paybackMonths)).toBe(NOT_CALCULATED_LABEL);
  });

  it("G2: CAC R$ 60,00, LTV R$ 273,60, ratio 4,6×, payback shown as 4 meses", () => {
    const economics = computeUnitEconomics(REFERENCE_CALCULATORS.G2, rulesV1);
    expect(economics.origin).toBe("measured");
    expect(economics.cacCents).toBe(6_000);
    expect(economics.ltvCents).toBe(27_360);
    expect(economics.ratio).toBeCloseTo(4.56, 9);
    expect(economics.paybackMonths).toBeCloseTo(3.947, 3);
    expect(formatRatio(economics.ratio)).toBe("4,6×");
    expect(formatPayback(economics.paybackMonths)).toBe("4 meses");
    expect(getRatioBand(economics.ratio)?.key).toBe("healthy");
  });

  it("G3: CAC R$ 300,00, LTV R$ 1.856,25, ratio 6,2×, payback shown as 6 meses", () => {
    const economics = computeUnitEconomics(REFERENCE_CALCULATORS.G3, rulesV1);
    expect(economics.origin).toBe("measured");
    expect(economics.cacCents).toBe(30_000);
    expect(economics.ltvCents).toBe(185_625);
    expect(economics.ratio).toBeCloseTo(6.1875, 9);
    expect(economics.paybackMonths).toBeCloseTo(5.818, 3);
    expect(formatRatio(economics.ratio)).toBe("6,2×");
    expect(formatPayback(economics.paybackMonths)).toBe("6 meses");
    expect(getRatioBand(economics.ratio)?.key).toBe("invest_more");
  });

  it("G4: CAC R$ 300,00, LTV R$ 1.500,00, ratio exactly 5,0× (still 'Saudável'), payback 8 meses", () => {
    const economics = computeUnitEconomics(REFERENCE_CALCULATORS.G4, rulesV1);
    expect(economics.cacCents).toBe(30_000);
    expect(economics.ltvCents).toBe(150_000);
    expect(economics.ratio).toBe(5);
    expect(economics.paybackMonths).toBeCloseTo(7.2, 9);
    expect(formatRatio(economics.ratio)).toBe("5,0×");
    expect(formatPayback(economics.paybackMonths)).toBe("8 meses");
    expect(getRatioBand(economics.ratio)?.key).toBe("healthy");
  });
});

describe("computeUnitEconomics: cents and rounding (RULE-dm-03, RULE-dm-12)", () => {
  it.each([
    [100, 8, 13], // 12,5 rounds up
    [100, 3, 33], // 33,33
    [200, 3, 67], // 66,67
    [101, 2, 51], // 50,5 rounds up
    [100, 4, 25],
    [1, 3, 0], // 0,33 of a cent
    [1, 2, 1], // 0,5 of a cent rounds up
  ])("CAC of %i cents over %i new customers is %i cents", (spend, customers, expected) => {
    const economics = computeUnitEconomics(
      measuredCalculator({ spendParts: { ads: spend }, newCustomers: customers }),
      rulesV1,
    );
    expect(economics.cacCents).toBe(expected);
    expect(Number.isInteger(economics.cacCents)).toBe(true);
  });

  it("adds the six cost parts and ignores the parts that were not filled in", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({
        spendParts: { ads: 100_000, agency: 50_000, commission: 25_000, discount: 10_000, salary: 5_000, tools: 1_000 },
        newCustomers: 10,
      }),
      rulesV1,
    );
    expect(economics.spendCents).toBe(191_000);
    expect(economics.cacCents).toBe(19_100);
  });

  it("keeps LTV in whole cents, rounding half up", () => {
    // 1 purchase of 1,01 per year, 0,4 year, margin 50%: 101 × 1 × 0,4 × 0,5 = 20,2 cents.
    const rounded = computeUnitEconomics(
      measuredCalculator({
        averagePurchaseCents: 101,
        purchasesPerYear: "once",
        relationshipLength: "underSixMonths",
        marginPercent: 50,
      }),
      rulesV1,
    );
    expect(rounded.ltvCents).toBe(20);
    // 5 × 1 × 0,75 year × 0,5 = 1,875 cents rounds up to 2.
    const upward = computeUnitEconomics(
      measuredCalculator({
        averagePurchaseCents: 5,
        purchasesPerYear: "once",
        relationshipLength: "sixToTwelveMonths",
        marginPercent: 50,
      }),
      rulesV1,
    );
    expect(upward.ltvCents).toBe(2);
  });

  it("rounds half up without being fooled by float noise", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4999)).toBe(2);
    expect(roundHalfUp(27_360.000000000004)).toBe(27_360);
    expect(roundHalfUp(0)).toBe(0);
  });

  it("does not move the ratio or the payback across a threshold by float noise", () => {
    // LTV 15.000 over CAC 5.000 is exactly 3: the 'Saudável' edge.
    const ratioEdge = computeUnitEconomics(
      measuredCalculator({
        spendParts: { ads: 50_000 },
        newCustomers: 10,
        averagePurchaseCents: 10_000,
        purchasesPerYear: "once",
        relationshipLength: "oneToTwoYears",
        marginPercent: 100,
      }),
      rulesV1,
    );
    expect(ratioEdge.cacCents).toBe(5_000);
    expect(ratioEdge.ltvCents).toBe(15_000);
    expect(ratioEdge.ratio).toBe(3);
    // Monthly profit 5.000 and CAC 60.000: exactly 12 months.
    const paybackEdge = computeUnitEconomics(
      measuredCalculator({
        spendParts: { ads: 600_000 },
        newCustomers: 10,
        averagePurchaseCents: 10_000,
        purchasesPerYear: "overTwelve",
        marginPercent: 40,
      }),
      rulesV1,
    );
    expect(paybackEdge.paybackMonths).toBe(12);
  });
});

describe("computeUnitEconomics: where the cost comes from (BR-dm-01, BR-dm-02)", () => {
  it("is measured only when spend and new customers are both typed in", () => {
    const economics = computeUnitEconomics(measuredCalculator(), rulesV1);
    expect(economics.spendOrigin).toBe("measured");
    expect(economics.newCustomersOrigin).toBe("measured");
    expect(economics.origin).toBe("measured");
  });

  it("uses the midpoint of a range and marks the cost as estimated", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({
        spendMode: "range",
        spendRange: "from1000To5000",
        newCustomersMode: "range",
        newCustomersRange: "from11To30",
      }),
      rulesV1,
    );
    expect(economics.spendCents).toBe(rulesV1.midpoints.spendCentsByRange.from1000To5000);
    expect(economics.newCustomers).toBe(rulesV1.midpoints.newCustomersByRange.from11To30);
    expect(economics.spendOrigin).toBe("estimated");
    expect(economics.newCustomersOrigin).toBe("estimated");
    expect(economics.origin).toBe("estimated");
    expect(economics.cacCents).toBe(15_000);
  });

  it("a typed value mixed with a range is still estimated", () => {
    const spendByRange = computeUnitEconomics(
      measuredCalculator({ spendMode: "range", spendRange: "upTo1000" }),
      rulesV1,
    );
    expect(spendByRange.origin).toBe("estimated");
    expect(spendByRange.spendOrigin).toBe("estimated");
    expect(spendByRange.newCustomersOrigin).toBe("measured");
    const customersByRange = computeUnitEconomics(
      measuredCalculator({ newCustomersMode: "range", newCustomersRange: "over300" }),
      rulesV1,
    );
    expect(customersByRange.origin).toBe("estimated");
    expect(customersByRange.cacCents).toBe(Math.round(354_000 / 400));
  });

  it.each([
    ["spend 'não sei'", { spendMode: "unknown" as const }],
    ["new customers 'não sei'", { newCustomersMode: "unknown" as const }],
    ["no spend mode yet", { spendMode: null }],
    ["exact spend with no part filled in", { spendParts: {} }],
    ["range mode without a range", { spendMode: "range" as const, spendRange: null }],
  ])("has no cost per customer when %s", (_label, overrides) => {
    const economics = computeUnitEconomics(measuredCalculator(overrides), rulesV1);
    expect(economics.origin).toBe("unknown");
    expect(economics.cacCents).toBeNull();
    expect(economics.ratio).toBeNull();
    expect(economics.paybackMonths).toBeNull();
    expect(economics.neverPaysBack).toBe(false);
    // The profit per customer does not depend on the cost.
    expect(economics.ltvCents).toBe(27_360);
  });
});

describe("computeUnitEconomics: no new customers (BR-dm-14, AC-dm-51)", () => {
  const economics = computeUnitEconomics(measuredCalculator({ newCustomers: 0 }), rulesV1);

  it("accepts 0 and leaves the cost per customer 'não calculado'", () => {
    expect(economics.newCustomers).toBe(0);
    expect(economics.newCustomersOrigin).toBe("measured");
    expect(economics.origin).toBe("unknown");
    expect(economics.cacCents).toBeNull();
    expect(formatRatio(economics.ratio)).toBe(NOT_CALCULATED_LABEL);
    expect(formatPayback(economics.paybackMonths)).toBe(NOT_CALCULATED_LABEL);
  });

  it("does not divide by zero anywhere", () => {
    for (const value of numericFieldsOf(economics)) {
      expect(value === null || Number.isFinite(value)).toBe(true);
    }
  });
});

describe("computeUnitEconomics: zero margin (BR-dm-15, AC-dm-51)", () => {
  const economics = computeUnitEconomics(measuredCalculator({ marginPercent: 0 }), rulesV1);

  it("profit per customer is R$ 0,00 and the ratio is 0,0× Crítico", () => {
    expect(economics.ltvCents).toBe(0);
    expect(economics.ratio).toBe(0);
    expect(formatRatioWithBand(economics.ratio)).toBe("0,0× Crítico");
  });

  it("the cost never comes back: 'não se paga'", () => {
    expect(economics.neverPaysBack).toBe(true);
    expect(economics.paybackMonths).toBeNull();
    expect(formatPayback(economics.neverPaysBack ? "never" : economics.paybackMonths)).toBe(
      NEVER_PAYS_BACK_LABEL,
    );
  });

  it("without a known cost there is nothing to pay back", () => {
    const unknownCost = computeUnitEconomics(
      measuredCalculator({ marginPercent: 0, spendMode: "unknown" }),
      rulesV1,
    );
    expect(unknownCost.ltvCents).toBe(0);
    expect(unknownCost.neverPaysBack).toBe(false);
    expect(unknownCost.paybackMonths).toBeNull();
  });
});

describe("computeUnitEconomics: a cost of zero", () => {
  it("a customer that cost R$ 0,00 has CAC 0, no ratio and an immediate payback", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({ spendParts: { ads: 0 }, newCustomers: 25 }),
      rulesV1,
    );
    expect(economics.origin).toBe("measured");
    expect(economics.cacCents).toBe(0);
    expect(economics.ratio).toBeNull();
    expect(economics.paybackMonths).toBe(0);
    expect(economics.neverPaysBack).toBe(false);
  });
});

describe("computeUnitEconomics: unfinished and invalid input (IF-004)", () => {
  it("an empty calculator is entirely unknown", () => {
    const economics = computeUnitEconomics(EMPTY_CALCULATOR, rulesV1);
    expect(economics).toEqual({
      spendCents: null,
      newCustomers: null,
      spendOrigin: "unknown",
      newCustomersOrigin: "unknown",
      origin: "unknown",
      cacCents: null,
      ltvCents: null,
      ratio: null,
      paybackMonths: null,
      neverPaysBack: false,
    });
  });

  it("has no LTV while any of the four profit fields is missing", () => {
    for (const missing of [
      { averagePurchaseCents: null },
      { purchasesPerYear: null },
      { relationshipLength: null },
      { marginPercent: null },
    ] as Array<Partial<CalculatorInput>>) {
      const economics = computeUnitEconomics(measuredCalculator(missing), rulesV1);
      expect(economics.ltvCents).toBeNull();
      expect(economics.ratio).toBeNull();
      expect(economics.paybackMonths).toBeNull();
      expect(economics.cacCents).toBe(6_000);
    }
  });

  it("never throws, and never returns NaN, Infinity or a missing value, for hostile input", () => {
    const hostile: unknown[] = [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      1.5,
      "10",
      Number.MAX_SAFE_INTEGER,
      Number.MAX_VALUE,
      {},
      [],
      "constructor",
      "__proto__",
    ];
    for (const value of hostile) {
      for (const mode of ["exact", "range"] as const) {
        const candidate = {
          ...measuredCalculator(),
          spendParts: { ads: value, agency: value },
          newCustomers: value,
          averagePurchaseCents: value,
          marginPercent: value,
          purchasesPerYear: value,
          relationshipLength: value,
          spendRange: value,
          newCustomersRange: value,
          spendMode: mode,
          newCustomersMode: mode,
        } as unknown as CalculatorInput;
        const economics = computeUnitEconomics(candidate, rulesV1);
        for (const field of numericFieldsOf(economics)) {
          expect(field === null || Number.isFinite(field)).toBe(true);
        }
        expect(JSON.parse(JSON.stringify(economics))).toEqual(economics);
      }
    }
  });

  it("is not changed by the input it receives", () => {
    const calculator = measuredCalculator();
    const snapshot = JSON.stringify(calculator);
    computeUnitEconomics(calculator, rulesV1);
    expect(JSON.stringify(calculator)).toBe(snapshot);
  });
});

describe("ratio bands and what the owner reads (AC-dm-15, BR-dm-03)", () => {
  it.each([
    [0.99, "critical", "Crítico"],
    [1, "attention", "Atenção"],
    [2.99, "attention", "Atenção"],
    [3, "healthy", "Saudável"],
    [5, "healthy", "Saudável"],
    [5.01, "invest_more", "Pode investir mais"],
  ])("a ratio of %s is %s", (ratio, key, label) => {
    expect(getRatioBand(ratio)).toMatchObject({ key, label });
  });

  it("shows no 'NaN', 'Infinity' or empty text for any state of the calculator", () => {
    const states = [
      EMPTY_CALCULATOR,
      ...Object.values(REFERENCE_CALCULATORS),
      measuredCalculator({ newCustomers: 0 }),
      measuredCalculator({ marginPercent: 0 }),
      measuredCalculator({ spendParts: { ads: 0 } }),
    ];
    for (const calculator of states) {
      const economics = computeUnitEconomics(calculator, rulesV1);
      const shown = [
        formatRatio(economics.ratio),
        formatRatioWithBand(economics.ratio),
        formatPayback(economics.neverPaysBack ? "never" : economics.paybackMonths),
      ];
      for (const text of shown) {
        expect(text.length).toBeGreaterThan(0);
        expect(text).not.toMatch(/NaN|Infinity|undefined|null/);
      }
    }
  });
});

// AC-ra-44 and AC-ra-45 (RULE-ra-09): the diary can give the spend as one total, and a number it
// projected from fewer than 3 months stays estimated. Inputs of the first version are unchanged.
describe("computeUnitEconomics: the diary's total and estimated numbers (AC-ra-44, AC-ra-45)", () => {
  it("reads a single spend total when no part is filled", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({ spendParts: {}, spendTotalCents: 354_000 }),
      rulesV1,
    );
    expect(economics.spendCents).toBe(354_000);
    expect(economics.spendOrigin).toBe("measured");
    expect(economics.cacCents).toBe(6_000);
    expect(economics.origin).toBe("measured");
  });

  it("gives the same numbers for the total as for the same amount in parts", () => {
    const fromTotal = computeUnitEconomics(measuredCalculator({ spendParts: {}, spendTotalCents: 354_000 }), rulesV1);
    const fromParts = computeUnitEconomics(measuredCalculator({ spendParts: { ads: 300_000, tools: 54_000 } }), rulesV1);
    expect(fromTotal).toEqual(fromParts);
  });

  it("lets the parts win when both a part and a total are there", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({ spendParts: { ads: 100_000 }, spendTotalCents: 999_999 }),
      rulesV1,
    );
    expect(economics.spendCents).toBe(100_000);
  });

  it("counts a total of zero as filled, with a cost of zero", () => {
    const economics = computeUnitEconomics(measuredCalculator({ spendParts: {}, spendTotalCents: 0 }), rulesV1);
    expect(economics.spendCents).toBe(0);
    expect(economics.cacCents).toBe(0);
    expect(economics.origin).toBe("measured");
  });

  it("ignores a total that is not whole cents", () => {
    for (const bad of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "100", null, undefined]) {
      const economics = computeUnitEconomics(
        measuredCalculator({ spendParts: {}, spendTotalCents: bad as unknown as number }),
        rulesV1,
      );
      expect(economics.spendCents).toBeNull();
      expect(economics.origin).toBe("unknown");
      expect(economics.cacCents).toBeNull();
    }
  });

  it("ignores the total unless the spend was typed as an exact value", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({ spendMode: "unknown", spendParts: {}, spendTotalCents: 354_000 }),
      rulesV1,
    );
    expect(economics.spendCents).toBeNull();
    expect(economics.spendOrigin).toBe("unknown");
  });

  const source = (origin: "measured" | "estimated") => ({
    origin,
    fromMonth: "2026-09",
    toMonth: "2026-10",
    monthCount: 2,
  });

  it("keeps the spend estimated when it comes from a diary of less than 3 months", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({ diarySource: { spend: source("estimated") } }),
      rulesV1,
    );
    expect(economics.spendOrigin).toBe("estimated");
    expect(economics.newCustomersOrigin).toBe("measured");
    expect(economics.origin).toBe("estimated");
    expect(economics.cacCents).toBe(6_000);
  });

  it("keeps the new customers estimated when they come from a diary of less than 3 months", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({ diarySource: { newCustomers: source("estimated") } }),
      rulesV1,
    );
    expect(economics.spendOrigin).toBe("measured");
    expect(economics.newCustomersOrigin).toBe("estimated");
    expect(economics.origin).toBe("estimated");
  });

  it("counts both numbers of an accepted suggestion as estimated, with the same cost per customer", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({
        diarySource: { spend: source("estimated"), newCustomers: source("estimated") },
      }),
      rulesV1,
    );
    expect(economics).toMatchObject({ spendOrigin: "estimated", newCustomersOrigin: "estimated", origin: "estimated" });
  });

  it("counts the numbers of a diary of 3 months or more as measured", () => {
    const economics = computeUnitEconomics(
      measuredCalculator({ diarySource: { spend: source("measured"), newCustomers: source("measured") } }),
      rulesV1,
    );
    expect(economics.origin).toBe("measured");
  });

  it("gives the same result with or without the new optional fields on a first-version input", () => {
    const base = measuredCalculator();
    const withEmptyFields = measuredCalculator({ spendTotalCents: null, diarySource: {}, diarySuggestion: null });
    expect(computeUnitEconomics(withEmptyFields, rulesV1)).toEqual(computeUnitEconomics(base, rulesV1));
    for (const calculator of Object.values(REFERENCE_CALCULATORS)) {
      expect(computeUnitEconomics({ ...calculator, spendTotalCents: null }, rulesV1)).toEqual(
        computeUnitEconomics(calculator, rulesV1),
      );
    }
  });

  it("does not let a diary mark change a cost that is not typed in as exact", () => {
    // A range is estimated whatever the mark says; "não sei" stays unknown.
    const range = computeUnitEconomics(
      measuredCalculator({
        spendMode: "range",
        spendRange: "from1000To5000",
        diarySource: { spend: source("measured") },
      }),
      rulesV1,
    );
    expect(range.spendOrigin).toBe("estimated");
    const unknown = computeUnitEconomics(
      measuredCalculator({ spendMode: "unknown", diarySource: { spend: source("estimated") } }),
      rulesV1,
    );
    expect(unknown.spendOrigin).toBe("unknown");
  });
});
