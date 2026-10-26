import { describe, expect, it } from "vitest";
import { ACTION_CATALOG } from "../../shared/content/actionCatalog";
import { buildActionPlan, isInvestEligible } from "../../shared/domain/actionPlan";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis";
import {
  DIMENSION_KEYS,
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type ActionKey,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type ConfidenceLevel,
  type DiagnosisInput,
  type DimensionKey,
  type LockKey,
  type QuestionId,
  type SignalId,
  type StageNumber,
} from "../../shared/domain/types";
import { rulesV1 } from "../../shared/rules/rulesV1";
import { rulesV2 } from "../fixtures/rulesV2";

// The engine end to end: the reference cases G1 to G4 of the PRD (AC-dm-18, AC-dm-20,
// AC-dm-25, AC-dm-49) and the rules about which actions may enter the plan (AC-dm-26).

// ---------------------------------------------------------------- builders

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

function withUnknown(answers: Answers, ids: readonly QuestionId[]): Answers {
  const result: Answers = { ...answers };
  for (const id of ids) result[id] = null;
  return result;
}

const G1_CALCULATOR: CalculatorInput = {
  ...EMPTY_CALCULATOR,
  spendMode: "unknown",
  newCustomersMode: "range",
  newCustomersRange: "from11To30",
  averagePurchaseCents: 4_500,
  purchasesPerYear: "twoToThree",
  relationshipLength: "oneToTwoYears",
  marginPercent: 40,
};

const G2_CALCULATOR: CalculatorInput = {
  ...EMPTY_CALCULATOR,
  spendMode: "exact",
  spendParts: { ads: 200_000, agency: 100_000, commission: 54_000 },
  newCustomersMode: "exact",
  newCustomers: 59,
  averagePurchaseCents: 4_800,
  purchasesPerYear: "sevenToTwelve",
  relationshipLength: "oneToTwoYears",
  marginPercent: 40,
};

const G3_CALCULATOR: CalculatorInput = {
  ...EMPTY_CALCULATOR,
  spendMode: "exact",
  spendParts: { ads: 2_000_000, agency: 400_000 },
  newCustomersMode: "exact",
  newCustomers: 80,
  averagePurchaseCents: 45_000,
  purchasesPerYear: "twoToThree",
  relationshipLength: "twoToFourYears",
  marginPercent: 55,
};

const G4_CALCULATOR: CalculatorInput = {
  ...EMPTY_CALCULATOR,
  spendMode: "exact",
  spendParts: { ads: 3_000_000 },
  newCustomersMode: "exact",
  newCustomers: 100,
  averagePurchaseCents: 20_000,
  purchasesPerYear: "fourToSix",
  relationshipLength: "twoToFourYears",
  marginPercent: 50,
};

const G1_ANSWERS = answersOf(1, { mp1: null, mp3: null, cm1: null, mm1: null, co1: null });

const G2_ANSWERS: Answers = {
  mp1: 2, mp2: 2, mp3: 2, mp4: 2,
  pc1: 3, pc2: 2, pc3: 2,
  cm1: 2, cm2: 2,
  mm1: 2, mm2: 2,
  es1: 1,
  aq1: 3, aq2: 2, aq3: 2,
  en1: 2, en2: 2, en3: 2,
  co1: 2, co2: 2, co3: 2,
  re1: 2, re2: 0, re3: 1,
};

const G3_ANSWERS: Answers = {
  mp1: 3, mp2: 3, mp3: 2, mp4: 3,
  pc1: 2, pc2: 3, pc3: 2,
  cm1: 3, cm2: 3,
  mm1: 2, mm2: 3,
  es1: 2,
  aq1: 3, aq2: 3, aq3: 2,
  en1: 3, en2: 2, en3: 3,
  co1: 2, co2: 2, co3: 2,
  re1: 3, re2: 2, re3: 3,
};

const G4_ANSWERS = answersOf(3, { pc1: 2 });

// ------------------------------------------------- reference cases G1 to G4

interface ReferenceCase {
  name: string;
  input: DiagnosisInput;
  scores: number[]; // mp, pc, cm, mm, aq, en, co, re
  stage: StageNumber;
  lock: LockKey | null;
  weakest: DimensionKey;
  risks: Array<[SignalId, number, "high" | "medium" | "low"]>;
  plan: ActionKey[];
  confidence: ConfidenceLevel;
  unknownCount: number;
  cacCents: number | null;
  ltvCents: number;
  ratio: number | null;
  paybackMonths: number | null;
}

const REFERENCE_CASES: ReferenceCase[] = [
  {
    name: "G1 (sem números)",
    input: { answers: G1_ANSWERS, calculator: G1_CALCULATOR },
    scores: [17, 33, 11, 17, 33, 33, 22, 33],
    stage: 1,
    lock: "cac",
    weakest: "cm",
    risks: [
      ["SIG-01", 16, "high"],
      ["SIG-05", 12, "medium"],
    ],
    plan: ["cac", "mp", "mm"],
    confidence: "medium",
    unknownCount: 6,
    cacCents: null,
    ltvCents: 6_750,
    ratio: null,
    paybackMonths: null,
  },
  {
    name: "G2 (ajuste)",
    input: { answers: G2_ANSWERS, calculator: G2_CALCULATOR },
    scores: [67, 78, 78, 67, 78, 67, 67, 33],
    stage: 2,
    lock: "re",
    weakest: "re",
    risks: [
      ["SIG-04", 12, "medium"],
      ["SIG-05", 12, "medium"],
    ],
    plan: ["re", "dep", "mp"],
    confidence: "high",
    unknownCount: 0,
    cacCents: 6_000,
    ltvCents: 27_360,
    ratio: 27_360 / 6_000,
    paybackMonths: 6_000 / 1_520,
  },
  {
    name: "G3 (escala)",
    input: { answers: G3_ANSWERS, calculator: G3_CALCULATOR },
    scores: [92, 78, 89, 83, 89, 89, 67, 89],
    stage: 3,
    lock: "co",
    weakest: "co",
    risks: [],
    plan: ["co", "invest", "pc"],
    confidence: "high",
    unknownCount: 0,
    cacCents: 30_000,
    ltvCents: 185_625,
    ratio: 185_625 / 30_000,
    paybackMonths: 30_000 / 5_156.25,
  },
  {
    name: "G4 (estruturação)",
    input: { answers: G4_ANSWERS, calculator: G4_CALCULATOR },
    scores: [100, 89, 100, 100, 100, 100, 100, 100],
    stage: 4,
    lock: null,
    weakest: "pc",
    risks: [],
    plan: ["invest", "pc", "mp"],
    confidence: "high",
    unknownCount: 0,
    cacCents: 30_000,
    ltvCents: 150_000,
    ratio: 5,
    paybackMonths: 7.2,
  },
];

describe("evaluateDiagnosis: reference cases G1 to G4 (AC-dm-18, AC-dm-20, AC-dm-25, AC-dm-49)", () => {
  describe.each(REFERENCE_CASES)("$name", (c) => {
    const result = evaluateDiagnosis(c.input, rulesV1);

    it("scores the eight dimensions with whole numbers from 0 to 100 (AC-dm-18)", () => {
      expect(DIMENSION_KEYS.map((key) => result.dimensions[key].score)).toEqual(c.scores);
      for (const key of DIMENSION_KEYS) {
        expect(Number.isInteger(result.dimensions[key].score)).toBe(true);
      }
      expect(result.weakestDimension).toBe(c.weakest);
    });

    it("gives the stage and the lock (AC-dm-20)", () => {
      expect(result.stage).toBe(c.stage);
      expect(result.lock).toBe(c.lock);
    });

    it("lists the risks of the catalog, worst first", () => {
      expect(result.risks.map((r) => [r.signalId, r.score, r.level])).toEqual(c.risks);
    });

    it("builds the exact three-action plan (AC-dm-25)", () => {
      expect(result.plan).toEqual(c.plan);
    });

    it("reports the confidence in the data (AC-dm-49)", () => {
      expect(result.confidence.level).toBe(c.confidence);
      expect(result.confidence.unknownCount).toBe(c.unknownCount);
      expect(result.confidence.totalItems).toBe(26);
    });

    it("carries the unit economics and the version of the rules", () => {
      const { unitEconomics } = result;
      expect(unitEconomics.cacCents).toBe(c.cacCents);
      expect(unitEconomics.ltvCents).toBe(c.ltvCents);
      if (c.ratio === null) expect(unitEconomics.ratio).toBeNull();
      else expect(unitEconomics.ratio).toBeCloseTo(c.ratio, 9);
      if (c.paybackMonths === null) expect(unitEconomics.paybackMonths).toBeNull();
      else expect(unitEconomics.paybackMonths).toBeCloseTo(c.paybackMonths, 6);
      expect(result.rulesVersion).toBe(1);
    });

    it("gives each action of the plan a title, a reason and how to do it (AC-dm-25)", () => {
      for (const key of result.plan) {
        const action = ACTION_CATALOG[key];
        expect(action.key).toBe(key);
        expect(action.title.length).toBeGreaterThan(0);
        expect(action.reason.length).toBeGreaterThan(0);
        expect(action.howTo.length).toBeGreaterThan(0);
      }
    });
  });
});

// ------------------------------------------------------------- the plan

describe("the plan follows RULE-dm-09", () => {
  it("puts the lock first, then the one-channel action, then the invest action (G3 with SIG-04)", () => {
    const input: DiagnosisInput = {
      answers: { ...G3_ANSWERS, pc1: 3 },
      calculator: G3_CALCULATOR,
    };
    const result = evaluateDiagnosis(input, rulesV1);
    expect(result.risks.map((r) => r.signalId)).toEqual(["SIG-04"]);
    expect(result.lock).toBe("co");
    expect(result.plan).toEqual(["co", "dep", "invest"]);
  });

  it("does not repeat an action when the weakest dimension is the lock (G2: re)", () => {
    const result = evaluateDiagnosis(REFERENCE_CASES[1].input, rulesV1);
    expect(result.plan.filter((key) => key === "re")).toHaveLength(1);
  });

  it("never plans an action for 'Canal e receita' alone, even when it is the weakest", () => {
    const result = evaluateDiagnosis(
      { answers: answersOf(0), calculator: EMPTY_CALCULATOR },
      rulesV1,
    );
    expect(result.weakestDimension).toBe("mp");
    expect(result.dimensions.cm.score).toBe(0);
    expect(result.plan).toEqual(["cac", "mp", "pc"]);
  });

  it("breaks ties between equally weak dimensions in the order mp, pc, mm, aq, en, co, re", () => {
    const result = evaluateDiagnosis(
      { answers: answersOf(2), calculator: G1_CALCULATOR },
      rulesV1,
    );
    expect(result.plan).toEqual(["cac", "mp", "pc"]);
  });

  it("gives different plans to two companies at the same stage with different weak dimensions", () => {
    // Stage 2 with the lock on "pc" in both; only the second weakest dimension differs.
    const base = answersOf(2, { pc1: 1, pc2: 1, pc3: 1 });
    const weakEngagement = evaluateDiagnosis(
      { answers: { ...base, en1: 0, en2: 0, en3: 0 }, calculator: G2_CALCULATOR },
      rulesV1,
    );
    const weakMarket = evaluateDiagnosis(
      { answers: { ...base, mm1: 0, mm2: 0 }, calculator: G2_CALCULATOR },
      rulesV1,
    );
    expect([weakEngagement.stage, weakEngagement.lock]).toEqual([2, "pc"]);
    expect([weakMarket.stage, weakMarket.lock]).toEqual([2, "pc"]);
    expect(weakEngagement.plan).toEqual(["pc", "en", "mp"]);
    expect(weakMarket.plan).toEqual(["pc", "mm", "mp"]);
  });

  it("shortens nothing and repeats nothing: always three known actions", () => {
    for (const result of sweep().map((input) => evaluateDiagnosis(input, rulesV1))) {
      expect(result.plan).toHaveLength(3);
      expect(new Set(result.plan).size).toBe(3);
      for (const key of result.plan) expect(ACTION_CATALOG[key]).toBeDefined();
    }
  });
});

// ------------------------------------------------- invest only when earned

const SWEEP_FILLS: AnchorValue[] = [0, 1, 2, 3];
const SWEEP_UNKNOWN: QuestionId[][] = [
  [],
  ["es1", "aq1"],
  ["es1", "aq1", "aq3"],
  ["es1", "aq1", "aq3", "aq2", "en1", "en2"],
];
const SWEEP_CALCULATORS = [G1_CALCULATOR, G2_CALCULATOR, G3_CALCULATOR, G4_CALCULATOR];
const SWEEP_OVERRIDES: Answers[] = [{}, { pc1: 3 }, { pc1: 2, re1: 3, re2: 3, re3: 3 }];

// A grid of inputs that crosses every way the invest action can be allowed or blocked.
function sweep(): DiagnosisInput[] {
  const inputs: DiagnosisInput[] = [];
  for (const fill of SWEEP_FILLS) {
    for (const unknown of SWEEP_UNKNOWN) {
      for (const calculator of SWEEP_CALCULATORS) {
        for (const overrides of SWEEP_OVERRIDES) {
          const answers = withUnknown({ ...answersOf(fill), ...overrides }, unknown);
          inputs.push({ answers, calculator });
        }
      }
    }
  }
  return inputs;
}

describe("the invest action needs a measured cost and high confidence (AC-dm-26, RULE-dm-10)", () => {
  it("appears exactly when stage >= 3, the cost is measured and the confidence is high", () => {
    let withInvest = 0;
    let withoutInvest = 0;
    for (const input of sweep()) {
      const result = evaluateDiagnosis(input, rulesV1);
      const allowed =
        result.stage >= 3 &&
        result.unitEconomics.origin === "measured" &&
        result.confidence.level === "high";
      expect(result.plan.includes("invest")).toBe(allowed);
      if (allowed) withInvest += 1;
      else withoutInvest += 1;
    }
    // The grid must exercise both outcomes, or the check above proves nothing.
    expect(withInvest).toBeGreaterThan(0);
    expect(withoutInvest).toBeGreaterThan(0);
  });

  it("is left out when the cost came from ranges, however good the answers are", () => {
    const rangeCalculator: CalculatorInput = {
      ...G3_CALCULATOR,
      spendMode: "range",
      spendParts: {},
      spendRange: "from15000To50000",
      newCustomersMode: "range",
      newCustomers: null,
      newCustomersRange: "from31To100",
    };
    const result = evaluateDiagnosis({ answers: answersOf(3), calculator: rangeCalculator }, rulesV1);
    expect(result.unitEconomics.origin).toBe("estimated");
    expect(result.stage).toBe(2);
    expect(result.lock).toBe("measure");
    expect(result.confidence.level).toBe("medium");
    expect(result.plan).not.toContain("invest");
    expect(result.plan[0]).toBe("measure");
  });

  it("is left out below stage 3 even with a measured cost and high confidence (G2)", () => {
    const result = evaluateDiagnosis(REFERENCE_CASES[1].input, rulesV1);
    expect(result.unitEconomics.origin).toBe("measured");
    expect(result.confidence.level).toBe("high");
    expect(result.stage).toBe(2);
    expect(result.plan).not.toContain("invest");
  });

  it("is left out when the confidence is only medium: three unknown items of 26", () => {
    const answers = withUnknown(G4_ANSWERS, ["es1", "aq1", "aq3"]);
    const result = evaluateDiagnosis({ answers, calculator: G4_CALCULATOR }, rulesV1);
    expect(result.confidence.unknownCount).toBe(3);
    expect(result.confidence.level).toBe("medium");
    expect(result.stage).toBe(3);
    expect(result.lock).toBe("es");
    expect(result.plan).toEqual(["es", "aq", "pc"]);
  });

  it("is kept at the edge of high confidence: two unknown items of 26", () => {
    const answers = withUnknown(G4_ANSWERS, ["es1", "aq1"]);
    const result = evaluateDiagnosis({ answers, calculator: G4_CALCULATOR }, rulesV1);
    expect(result.confidence.unknownCount).toBe(2);
    expect(result.confidence.level).toBe("high");
    expect(result.stage).toBe(3);
    expect(result.plan).toEqual(["es", "invest", "aq"]);
  });

  it("isInvestEligible follows the same three conditions", () => {
    const g4 = evaluateDiagnosis(REFERENCE_CASES[3].input, rulesV1);
    const eligible = {
      stage: g4.stage,
      lock: g4.lock,
      dimensions: g4.dimensions,
      risks: g4.risks,
      unitEconomics: g4.unitEconomics,
      confidence: g4.confidence,
    };
    expect(isInvestEligible(eligible, rulesV1)).toBe(true);
    expect(isInvestEligible({ ...eligible, stage: 2 }, rulesV1)).toBe(false);
    expect(
      isInvestEligible({ ...eligible, unitEconomics: { ...g4.unitEconomics, origin: "estimated" } }, rulesV1),
    ).toBe(false);
    expect(
      isInvestEligible({ ...eligible, confidence: { ...g4.confidence, level: "medium" } }, rulesV1),
    ).toBe(false);
    expect(buildActionPlan(eligible, rulesV1)).toEqual(g4.plan);
  });
});

// ------------------------------------------- the engine is pure (RULE-dm-11)

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

describe("evaluateDiagnosis is a pure function of the input and the rules", () => {
  it("gives the same result twice and leaves its input untouched", () => {
    for (const c of REFERENCE_CASES) {
      const input = deepFreeze(structuredClone(c.input));
      const first = evaluateDiagnosis(input, rulesV1);
      const second = evaluateDiagnosis(input, rulesV1);
      expect(second).toEqual(first);
      expect(input).toEqual(c.input);
    }
  });

  it("returns plain data that survives a JSON round trip, as it is stored", () => {
    for (const c of REFERENCE_CASES) {
      const result = evaluateDiagnosis(c.input, rulesV1);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
    }
  });

  it("is total: an empty questionnaire and an empty calculator still give a valid result", () => {
    const result = evaluateDiagnosis({ answers: {}, calculator: EMPTY_CALCULATOR }, rulesV1);
    expect(result.stage).toBe(1);
    expect(result.lock).toBe("cac");
    expect(result.plan).toHaveLength(3);
    expect(DIMENSION_KEYS.every((key) => result.dimensions[key].score === 0)).toBe(true);
  });

  it("stamps the version of the rules it used, and another version can change the result", () => {
    // G3 with "Produto e canal" at 67: v1 asks 60 for stage 3, the test variant v2 asks 70.
    const input: DiagnosisInput = {
      answers: { ...G3_ANSWERS, pc1: 2, pc2: 2, pc3: 2 },
      calculator: G3_CALCULATOR,
    };
    const underV1 = evaluateDiagnosis(input, rulesV1);
    const underV2 = evaluateDiagnosis(input, rulesV2);

    expect(underV1.rulesVersion).toBe(1);
    expect(underV1.dimensions.pc.score).toBe(67);
    expect([underV1.stage, underV1.lock]).toEqual([3, "co"]);
    expect(underV1.plan).toEqual(["co", "invest", "pc"]);

    expect(underV2.rulesVersion).toBe(2);
    expect(underV2.dimensions).toEqual(underV1.dimensions);
    expect([underV2.stage, underV2.lock]).toEqual([2, "pc"]);
    expect(underV2.plan).toEqual(["pc", "co", "mm"]);
  });
});
