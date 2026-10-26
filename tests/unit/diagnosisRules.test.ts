import { describe, expect, it } from "vitest";
import { getRiskInfo } from "../../shared/content/riskCatalog";
import { LOCK_PHRASES } from "../../shared/content/stageContent";
import { pendingBlocks } from "../../shared/domain/completeness";
import { computeConfidence, countUnknownItems } from "../../shared/domain/confidence";
import {
  computeDimensionScores,
  findWeakestDimension,
  ratioPoints,
  supportedStage,
} from "../../shared/domain/dimensionScores";
import { detectRisks, riskLevelOf } from "../../shared/domain/riskSignals";
import { computeStageAndLock } from "../../shared/domain/stageGate";
import {
  DIMENSION_KEYS,
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type ConfidenceLevel,
  type DimensionKey,
  type DimensionResult,
  type LockKey,
  type Rules,
  type SignalId,
  type StageNumber,
  type UnitEconomics,
} from "../../shared/domain/types";
import { rulesV1 } from "../../shared/rules/rulesV1";

// The rule modules tested directly (the engine that composes them has its own test file):
// RULE-dm-01, 02, 04 to 08, AC-dm-18 to AC-dm-21, AC-dm-23, AC-dm-24 and AC-dm-49.

// ---------------------------------------------------------------- builders

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

const UNKNOWN_ECONOMICS: UnitEconomics = {
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
};

// The G2 numbers: a measured cost, ratio 4,56 and a payback of 3,95 months.
function measuredEconomics(overrides: Partial<UnitEconomics> = {}): UnitEconomics {
  return {
    spendCents: 354_000,
    newCustomers: 59,
    spendOrigin: "measured",
    newCustomersOrigin: "measured",
    origin: "measured",
    cacCents: 6_000,
    ltvCents: 27_360,
    ratio: 4.56,
    paybackMonths: 3.95,
    neverPaysBack: false,
    ...overrides,
  };
}

function estimatedEconomics(overrides: Partial<UnitEconomics> = {}): UnitEconomics {
  return measuredEconomics({
    spendOrigin: "estimated",
    newCustomersOrigin: "estimated",
    origin: "estimated",
    ...overrides,
  });
}

function dimensionsOf(scores: Partial<Record<DimensionKey, number>> = {}): Record<DimensionKey, DimensionResult> {
  const results = {} as Record<DimensionKey, DimensionResult>;
  for (const key of DIMENSION_KEYS) {
    const score = scores[key] ?? 100;
    results[key] = {
      score,
      supportsStage: supportedStage(score, rulesV1),
      belowWarning: score < rulesV1.dimensionSupport.warnBelow,
    };
  }
  return results;
}

function scoresOf(answers: Answers, economics: UnitEconomics, rules: Rules = rulesV1) {
  const dimensions = computeDimensionScores(answers, economics, rules);
  return DIMENSION_KEYS.map((key) => dimensions[key].score);
}

// ------------------------------------------------- reference cases G1 to G4

interface ReferenceCase {
  name: string;
  answers: Answers;
  economics: UnitEconomics;
  scores: number[]; // mp, pc, cm, mm, aq, en, co, re
  stage: StageNumber;
  lock: LockKey | null;
  risks: Array<[SignalId, number, "high" | "medium" | "low"]>;
  confidence: ConfidenceLevel;
  unknownCount: number;
}

const REFERENCE_CASES: ReferenceCase[] = [
  {
    name: "G1 (sem números)",
    answers: answersOf(1, { mp1: null, mp3: null, cm1: null, mm1: null, co1: null }),
    economics: {
      ...UNKNOWN_ECONOMICS,
      newCustomers: 20,
      newCustomersOrigin: "estimated",
      ltvCents: 6_750,
    },
    scores: [17, 33, 11, 17, 33, 33, 22, 33],
    stage: 1,
    lock: "cac",
    risks: [
      ["SIG-01", 16, "high"],
      ["SIG-05", 12, "medium"],
    ],
    confidence: "medium",
    unknownCount: 6,
  },
  {
    name: "G2 (ajuste)",
    answers: {
      mp1: 2, mp2: 2, mp3: 2, mp4: 2,
      pc1: 3, pc2: 2, pc3: 2,
      cm1: 2, cm2: 2,
      mm1: 2, mm2: 2,
      es1: 1,
      aq1: 3, aq2: 2, aq3: 2,
      en1: 2, en2: 2, en3: 2,
      co1: 2, co2: 2, co3: 2,
      re1: 2, re2: 0, re3: 1,
    },
    economics: measuredEconomics(),
    scores: [67, 78, 78, 67, 78, 67, 67, 33],
    stage: 2,
    lock: "re",
    risks: [
      ["SIG-04", 12, "medium"],
      ["SIG-05", 12, "medium"],
    ],
    confidence: "high",
    unknownCount: 0,
  },
  {
    name: "G3 (escala)",
    answers: {
      mp1: 3, mp2: 3, mp3: 2, mp4: 3,
      pc1: 2, pc2: 3, pc3: 2,
      cm1: 3, cm2: 3,
      mm1: 2, mm2: 3,
      es1: 2,
      aq1: 3, aq2: 3, aq3: 2,
      en1: 3, en2: 2, en3: 3,
      co1: 2, co2: 2, co3: 2,
      re1: 3, re2: 2, re3: 3,
    },
    economics: measuredEconomics({
      spendCents: 2_400_000,
      newCustomers: 80,
      cacCents: 30_000,
      ltvCents: 185_625,
      ratio: 6.1875,
      paybackMonths: 5.82,
    }),
    scores: [92, 78, 89, 83, 89, 89, 67, 89],
    stage: 3,
    lock: "co",
    risks: [],
    confidence: "high",
    unknownCount: 0,
  },
  {
    name: "G4 (estruturação)",
    answers: answersOf(3, { pc1: 2 }),
    economics: measuredEconomics({
      spendCents: 3_000_000,
      newCustomers: 100,
      cacCents: 30_000,
      ltvCents: 150_000,
      ratio: 5,
      paybackMonths: 7.2,
    }),
    scores: [100, 89, 100, 100, 100, 100, 100, 100],
    stage: 4,
    lock: null,
    risks: [],
    confidence: "high",
    unknownCount: 0,
  },
];

// ------------------------------------------------------------ dimensions

describe("computeDimensionScores (RULE-dm-01, RULE-dm-02, AC-dm-18)", () => {
  it.each(REFERENCE_CASES)("$name: the eight scores are the ones of the PRD", (c) => {
    expect(scoresOf(c.answers, c.economics)).toEqual(c.scores);
  });

  it("scores are whole numbers from 0 to 100 for any combination of answers and ratio", () => {
    for (const fill of [0, 1, 2, 3] as AnchorValue[]) {
      for (const ratio of [null, 0, 0.5, 1, 2.9, 3, 5, 5.5, 40]) {
        const dimensions = computeDimensionScores(answersOf(fill), measuredEconomics({ ratio }), rulesV1);
        for (const key of DIMENSION_KEYS) {
          const { score } = dimensions[key];
          expect(Number.isInteger(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
      }
    }
  });

  it("everything at 0 is 0, everything at 3 with a healthy ratio is 100", () => {
    expect(scoresOf(answersOf(0), UNKNOWN_ECONOMICS)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(scoresOf(answersOf(3), measuredEconomics({ ratio: 4 }))).toEqual([100, 100, 100, 100, 100, 100, 100, 100]);
  });

  it("only 'Canal e receita' reads the ratio: the other seven do not move", () => {
    const answers = answersOf(2);
    const withoutRatio = scoresOf(answers, measuredEconomics({ ratio: null }));
    const withRatio = scoresOf(answers, measuredEconomics({ ratio: 4 }));
    const cmIndex = DIMENSION_KEYS.indexOf("cm");
    expect(withoutRatio[cmIndex]).toBe(44); // (2 + 2 + 0) ÷ 9
    expect(withRatio[cmIndex]).toBe(78); // (2 + 2 + 3) ÷ 9
    withoutRatio.forEach((score, index) => {
      if (index !== cmIndex) expect(score).toBe(withRatio[index]);
    });
  });

  it.each([
    [null, 0], // not calculable
    [0, 0],
    [0.99, 0],
    [1, 1],
    [2.99, 1],
    [3, 3],
    [5, 3],
    [5.01, 2],
    [40, 2],
    [Number.NaN, 0],
    [-1, 0],
  ])("the ratio %s is worth %s point(s)", (ratio, points) => {
    expect(ratioPoints(ratio, rulesV1)).toBe(points);
  });

  it("'não sei', an unanswered question and an out-of-range value are worth 0", () => {
    const answers = answersOf(3, { mp1: null, mp2: undefined });
    delete answers.mp3;
    (answers as Record<string, unknown>).mp4 = 7;
    // All four mp questions are worth 0, so the dimension scores 0.
    expect(scoresOf(answers, UNKNOWN_ECONOMICS)[DIMENSION_KEYS.indexOf("mp")]).toBe(0);
    const partial = answersOf(3, { mp1: null });
    expect(scoresOf(partial, UNKNOWN_ECONOMICS)[DIMENSION_KEYS.indexOf("mp")]).toBe(75); // 9 ÷ 12
  });
});

describe("the stage a dimension would sustain (RULE-dm-06, AC-dm-19)", () => {
  it.each([
    [0, 1],
    [39, 1],
    [40, 2],
    [59, 2],
    [60, 3],
    [79, 3],
    [80, 4],
    [100, 4],
  ])("a score of %i sustains stage %i", (score, stage) => {
    expect(supportedStage(score, rulesV1)).toBe(stage);
  });

  it("reports the stage and 'Abaixo de 50' on each dimension of G2", () => {
    const g2 = REFERENCE_CASES[1];
    const dimensions = computeDimensionScores(g2.answers, g2.economics, rulesV1);
    expect(DIMENSION_KEYS.map((key) => dimensions[key].supportsStage)).toEqual([3, 3, 3, 3, 3, 3, 3, 1]);
    expect(DIMENSION_KEYS.filter((key) => dimensions[key].belowWarning)).toEqual(["re"]);
  });

  it("the warning starts below 50, not at 50", () => {
    const base = answersOf(2);
    // mp: 5 ÷ 12 = 42 (warns); 6 ÷ 12 = 50 (does not).
    const warns = computeDimensionScores({ ...base, mp1: 1, mp2: 1, mp3: 1, mp4: 2 }, UNKNOWN_ECONOMICS, rulesV1);
    const fine = computeDimensionScores({ ...base, mp1: 1, mp2: 1, mp3: 2, mp4: 2 }, UNKNOWN_ECONOMICS, rulesV1);
    expect(warns.mp).toMatchObject({ score: 42, belowWarning: true, supportsStage: 2 });
    expect(fine.mp).toMatchObject({ score: 50, belowWarning: false, supportsStage: 2 });
  });

  it("the weakest dimension is the lowest score, and a tie keeps the order of the dimensions", () => {
    expect(findWeakestDimension(dimensionsOf({ aq: 10, co: 10, mp: 90 }))).toBe("aq");
    expect(findWeakestDimension(dimensionsOf({ re: 5 }))).toBe("re");
    expect(findWeakestDimension(dimensionsOf())).toBe("mp");
  });
});

// ------------------------------------------------------------ stage gate

describe("computeStageAndLock: reference cases (AC-dm-20)", () => {
  it.each(REFERENCE_CASES)("$name", (c) => {
    const dimensions = computeDimensionScores(c.answers, c.economics, rulesV1);
    expect(computeStageAndLock({ answers: c.answers, dimensions, unitEconomics: c.economics }, rulesV1)).toEqual({
      stage: c.stage,
      lock: c.lock,
    });
  });
});

describe("computeStageAndLock: edge table (RULE-dm-04, RULE-dm-05, AC-dm-20)", () => {
  const strongAnswers = answersOf(3);
  type Row = [
    label: string,
    scores: Partial<Record<DimensionKey, number>>,
    economics: UnitEconomics,
    es1: Answers["es1"],
    stage: StageNumber,
    lock: LockKey | null,
  ];
  const rows: Row[] = [
    ["everything met", {}, measuredEconomics(), 3, 4, null],
    // Stage 2: a known cost and Mercado e produto >= 50.
    ["cost unknown, all else strong (BR-dm-01)", {}, { ...UNKNOWN_ECONOMICS, ltvCents: 27_360 }, 3, 1, "cac"],
    ["cost unknown comes before a weak mp", { mp: 10 }, UNKNOWN_ECONOMICS, 3, 1, "cac"],
    ["measured cost, mp 49", { mp: 49 }, measuredEconomics(), 3, 1, "mp"],
    ["estimated cost, mp 49", { mp: 49 }, estimatedEconomics(), 3, 1, "mp"],
    ["estimated cost, mp 50 reaches stage 2", { mp: 50 }, estimatedEconomics(), 3, 2, "measure"],
    // Stage 3: needs a MEASURED cost; an estimate by range blocks it.
    ["estimated cost blocks stage 3", {}, estimatedEconomics(), 3, 2, "measure"],
    ["estimated cost comes before a bad ratio", {}, estimatedEconomics({ ratio: 1 }), 3, 2, "measure"],
    ["ratio 2,99", {}, measuredEconomics({ ratio: 2.99 }), 3, 2, "ratio"],
    ["ratio exactly 3", {}, measuredEconomics({ ratio: 3 }), 3, 4, null],
    ["no ratio", {}, measuredEconomics({ ratio: null }), 3, 2, "ratio"],
    ["payback exactly 12", {}, measuredEconomics({ paybackMonths: 12 }), 3, 4, null],
    ["payback 12,01", {}, measuredEconomics({ paybackMonths: 12.01 }), 3, 2, "payback"],
    ["no payback", {}, measuredEconomics({ paybackMonths: null }), 3, 2, "payback"],
    ["never pays back", {}, measuredEconomics({ paybackMonths: null, neverPaysBack: true }), 3, 2, "payback"],
    ["pc 59", { pc: 59 }, measuredEconomics(), 3, 2, "pc"],
    ["pc 60", { pc: 60 }, measuredEconomics(), 3, 4, null],
    ["re 49", { re: 49 }, measuredEconomics(), 3, 2, "re"],
    ["re 50", { re: 50 }, measuredEconomics(), 3, 4, null],
    ["ratio comes before pc and re", { pc: 0, re: 0 }, measuredEconomics({ ratio: 2 }), 3, 2, "ratio"],
    ["payback comes before pc and re", { pc: 0, re: 0 }, measuredEconomics({ paybackMonths: 30 }), 3, 2, "payback"],
    ["pc comes before re", { pc: 0, re: 0 }, measuredEconomics(), 3, 2, "pc"],
    // Stage 4: Receita e mercado >= 60, Conversão >= 70 and the work split into areas.
    ["mm 59", { mm: 59 }, measuredEconomics(), 3, 3, "mm"],
    ["mm 60", { mm: 60 }, measuredEconomics(), 3, 4, null],
    ["co 69", { co: 69 }, measuredEconomics(), 3, 3, "co"],
    ["co 70", { co: 70 }, measuredEconomics(), 3, 4, null],
    ["work split only 'from time to time' (es1 = 2)", {}, measuredEconomics(), 2, 3, "es"],
    ["work split not answered", {}, measuredEconomics(), undefined, 3, "es"],
    ["work split 'não sei'", {}, measuredEconomics(), null, 3, "es"],
    ["mm comes before co and es", { mm: 0, co: 0 }, measuredEconomics(), 0, 3, "mm"],
    ["co comes before es", { co: 0 }, measuredEconomics(), 0, 3, "co"],
    // A stage is never skipped.
    ["strong stage 3 numbers with mp 10", { mp: 10 }, measuredEconomics(), 3, 1, "mp"],
    ["strong stage 4 numbers with a ratio of 1", { mm: 100, co: 100 }, measuredEconomics({ ratio: 1 }), 3, 2, "ratio"],
  ];

  it.each(rows)("%s", (_label, scores, economics, es1, stage, lock) => {
    const answers: Answers = { ...strongAnswers, es1 };
    const result = computeStageAndLock(
      { answers, dimensions: dimensionsOf(scores), unitEconomics: economics },
      rulesV1,
    );
    expect(result).toEqual({ stage, lock });
  });

  it("every lock has the phrase shown next to the padlock", () => {
    for (const [, , , , , lock] of rows) {
      if (lock !== null) expect(LOCK_PHRASES[lock].length).toBeGreaterThan(0);
    }
  });

  it("uses the thresholds of the rules it is given", () => {
    const stricter: Rules = {
      ...rulesV1,
      stageGates: { ...rulesV1.stageGates, stage2: { minMarketProduct: 70 } },
    };
    const input = { answers: strongAnswers, dimensions: dimensionsOf({ mp: 65 }), unitEconomics: measuredEconomics() };
    expect(computeStageAndLock(input, rulesV1).stage).toBe(4);
    expect(computeStageAndLock(input, stricter)).toEqual({ stage: 1, lock: "mp" });
  });
});

describe("unknown spend or new customers (AC-dm-21, BR-dm-01)", () => {
  // Strong answers everywhere, but the owner does not know what a customer costs.
  const answers = answersOf(3);
  const economics = { ...UNKNOWN_ECONOMICS, ltvCents: 27_360 };
  const dimensions = computeDimensionScores(answers, economics, rulesV1);

  it("stage 1 with the lock 'descobrir quanto custa cada cliente novo'", () => {
    const { stage, lock } = computeStageAndLock({ answers, dimensions, unitEconomics: economics }, rulesV1);
    expect(stage).toBe(1);
    expect(lock).toBe("cac");
    expect(LOCK_PHRASES.cac).toBe("descobrir quanto custa cada cliente novo");
  });

  it("and the high risk of score 16", () => {
    const risks = detectRisks({ answers, dimensions, unitEconomics: economics }, rulesV1);
    expect(risks[0]).toEqual({ signalId: "SIG-01", probability: 4, impact: 4, score: 16, level: "high" });
    expect(getRiskInfo("SIG-01").title).toBe("Investir em divulgação sem saber quanto custa um cliente");
  });
});

// ------------------------------------------------------------------ risks

describe("detectRisks (RULE-dm-07, AC-dm-23, AC-dm-24)", () => {
  // Nothing fires: a measured cost, a healthy ratio, a short payback and no weak spot.
  const calmAnswers = answersOf(2);
  const calmDimensions = dimensionsOf({ re: 70 });
  const calmEconomics = measuredEconomics({ ratio: 4, paybackMonths: 6 });

  function risksOf(
    changes: {
      answers?: Answers;
      dimensions?: Partial<Record<DimensionKey, number>>;
      economics?: UnitEconomics;
    } = {},
    rules: Rules = rulesV1,
  ) {
    return detectRisks(
      {
        answers: changes.answers ?? calmAnswers,
        dimensions: changes.dimensions ? dimensionsOf(changes.dimensions) : calmDimensions,
        unitEconomics: changes.economics ?? calmEconomics,
      },
      rules,
    );
  }

  const ids = (risks: Array<{ signalId: SignalId }>) => risks.map((risk) => risk.signalId);

  it("finds no risk when no signal fires: the block shows 'Nenhum risco encontrado nas suas respostas' (AC-dm-24)", () => {
    expect(risksOf()).toEqual([]);
  });

  it.each(REFERENCE_CASES)("$name: the risks of the PRD", (c) => {
    const dimensions = computeDimensionScores(c.answers, c.economics, rulesV1);
    const risks = detectRisks({ answers: c.answers, dimensions, unitEconomics: c.economics }, rulesV1);
    expect(risks.map((risk) => [risk.signalId, risk.score, risk.level])).toEqual(c.risks);
  });

  it.each<[SignalId, Parameters<typeof risksOf>[0], number, number, "high" | "medium" | "low"]>([
    ["SIG-01", { economics: { ...UNKNOWN_ECONOMICS, ltvCents: 100 } }, 4, 4, "high"],
    ["SIG-02", { economics: measuredEconomics({ ratio: 0.5 }) }, 4, 5, "high"],
    ["SIG-03", { economics: measuredEconomics({ ratio: 2 }) }, 3, 3, "medium"],
    ["SIG-04", { answers: answersOf(2, { pc1: 3 }) }, 3, 4, "medium"],
    ["SIG-05", { dimensions: { re: 30 } }, 3, 4, "medium"],
    ["SIG-06", { economics: measuredEconomics({ paybackMonths: 20 }) }, 3, 3, "medium"],
    ["SIG-07", { answers: answersOf(2, { mm1: 0 }) }, 2, 4, "medium"],
    ["SIG-08", { answers: answersOf(2, { co2: 0 }) }, 3, 3, "medium"],
  ])("%s fires alone with probability × impact", (signalId, changes, probability, impact, level) => {
    expect(risksOf(changes)).toEqual([
      { signalId, probability, impact, score: probability * impact, level },
    ]);
  });

  it.each<[string, Parameters<typeof risksOf>[0], SignalId[]]>([
    ["ratio 0,99", { economics: measuredEconomics({ ratio: 0.99 }) }, ["SIG-02"]],
    ["ratio 1", { economics: measuredEconomics({ ratio: 1 }) }, ["SIG-03"]],
    ["ratio 2,99", { economics: measuredEconomics({ ratio: 2.99 }) }, ["SIG-03"]],
    ["ratio 3", { economics: measuredEconomics({ ratio: 3 }) }, []],
    ["no ratio, cost measured", { economics: measuredEconomics({ ratio: null }) }, []],
    ["margin R$ 0 (BR-dm-15)", { economics: measuredEconomics({ ratio: 0, ltvCents: 0, paybackMonths: null, neverPaysBack: true }) }, ["SIG-02", "SIG-06"]],
    ["payback 12", { economics: measuredEconomics({ paybackMonths: 12 }) }, []],
    ["payback 12,01", { economics: measuredEconomics({ paybackMonths: 12.01 }) }, ["SIG-06"]],
    ["no payback", { economics: measuredEconomics({ paybackMonths: null }) }, []],
    ["retention 40", { dimensions: { re: 40 } }, []],
    ["retention 39", { dimensions: { re: 39 } }, ["SIG-05"]],
    ["pc1 = 2", { answers: answersOf(2, { pc1: 2 }) }, []],
    ["pc1 not answered", { answers: answersOf(2, { pc1: undefined }) }, []],
    ["mm1 'não sei'", { answers: answersOf(2, { mm1: null }) }, []],
    ["mm1 = 1", { answers: answersOf(2, { mm1: 1 }) }, []],
    ["co2 = 1", { answers: answersOf(2, { co2: 1 }) }, []],
  ])("boundary: %s", (_label, changes, expected) => {
    expect(ids(risksOf(changes))).toEqual(expected);
  });

  it("a cost estimated by range is a known cost: SIG-01 stays quiet", () => {
    expect(risksOf({ economics: estimatedEconomics({ ratio: 4, paybackMonths: 6 }) })).toEqual([]);
  });

  it("orders by score, then by the order of the catalog, and keeps at most five", () => {
    const risks = risksOf({
      answers: answersOf(2, { pc1: 3, mm1: 0, co2: 0 }),
      dimensions: { re: 30 },
      economics: measuredEconomics({ ratio: 0.5, paybackMonths: 20 }),
    });
    // 20 (SIG-02), 12 (SIG-04), 12 (SIG-05), 9 (SIG-06), 9 (SIG-08); SIG-07 (8) is cut.
    expect(ids(risks)).toEqual(["SIG-02", "SIG-04", "SIG-05", "SIG-06", "SIG-08"]);
    expect(risks.map((risk) => risk.score)).toEqual([20, 12, 12, 9, 9]);
  });

  it("uses the limit and the weights of the rules it is given", () => {
    const changes = {
      answers: answersOf(2, { pc1: 3, mm1: 0 }),
      economics: measuredEconomics({ ratio: 0.5 }),
    };
    expect(ids(risksOf(changes, { ...rulesV1, risk: { ...rulesV1.risk, maxRisks: 2 } }))).toEqual(["SIG-02", "SIG-04"]);
    const heavier: Rules = {
      ...rulesV1,
      risk: { ...rulesV1.risk, signals: { ...rulesV1.risk.signals, "SIG-07": { probability: 5, impact: 5 } } },
    };
    expect(risksOf(changes, heavier)[0]).toMatchObject({ signalId: "SIG-07", score: 25, level: "high" });
  });

  it.each([
    [25, "high"],
    [16, "high"],
    [15, "medium"],
    [6, "medium"],
    [5, "low"],
    [1, "low"],
  ])("a score of %i is %s", (score, level) => {
    expect(riskLevelOf(score, rulesV1)).toBe(level);
  });

  it("every risk found can be shown with title, cause and 'Como reduzir' (AC-dm-23)", () => {
    const risks = risksOf({
      answers: answersOf(2, { pc1: 3, mm1: 0, co2: 0 }),
      dimensions: { re: 30 },
      economics: measuredEconomics({ ratio: 0.5, paybackMonths: 20 }),
    });
    for (const risk of risks) {
      const info = getRiskInfo(risk.signalId);
      expect(info.title.length).toBeGreaterThan(0);
      expect(info.cause.length).toBeGreaterThan(0);
      expect(info.howToReduce.length).toBeGreaterThan(0);
      expect(risk.score).toBe(risk.probability * risk.impact);
      expect(risk.probability).toBeGreaterThanOrEqual(1);
      expect(risk.probability).toBeLessThanOrEqual(5);
      expect(risk.impact).toBeGreaterThanOrEqual(1);
      expect(risk.impact).toBeLessThanOrEqual(5);
    }
  });
});

// ------------------------------------------------------------ confidence

describe("computeConfidence (RULE-dm-08, AC-dm-49)", () => {
  const nullAnswers = (count: number): Answers => {
    const answers = answersOf(2);
    for (const id of QUESTION_IDS.slice(0, count)) answers[id] = null;
    return answers;
  };

  it.each(REFERENCE_CASES)("$name", (c) => {
    expect(computeConfidence(c.answers, c.economics, rulesV1)).toEqual({
      level: c.confidence,
      unknownCount: c.unknownCount,
      totalItems: 26,
    });
  });

  it.each([
    [0, "high"],
    [2, "high"], // 7,7%
    [3, "medium"], // 11,5%
    [6, "medium"], // 23,1%
    [7, "low"], // 26,9%
    [24, "low"],
  ])("with %i 'não sei' answers and a measured cost the confidence is %s", (unknown, level) => {
    const result = computeConfidence(nullAnswers(unknown), measuredEconomics(), rulesV1);
    expect(result.level).toBe(level);
    expect(result.unknownCount).toBe(unknown);
  });

  it("counts the two calculator origins that are unknown along with the answers", () => {
    const unknownSpend = { ...measuredEconomics(), spendOrigin: "unknown" as const, origin: "unknown" as const };
    const unknownBoth = { ...unknownSpend, newCustomersOrigin: "unknown" as const };
    expect(countUnknownItems(answersOf(2), unknownSpend)).toBe(1);
    expect(countUnknownItems(answersOf(2), unknownBoth)).toBe(2);
    expect(countUnknownItems(nullAnswers(5), unknownBoth)).toBe(7);
    expect(computeConfidence(answersOf(2), unknownBoth, rulesV1).level).toBe("high"); // 2 of 26
    expect(computeConfidence(nullAnswers(1), unknownBoth, rulesV1).level).toBe("medium"); // 3 of 26
    expect(computeConfidence(nullAnswers(5), unknownBoth, rulesV1).level).toBe("low"); // 7 of 26
  });

  it("an unanswered question is not counted as 'não sei'", () => {
    const answers = answersOf(2);
    delete answers.mp1;
    expect(countUnknownItems(answers, measuredEconomics())).toBe(0);
  });

  it("a cost estimated by range never gets more than medium, even with no unknown at all", () => {
    expect(computeConfidence(answersOf(3), estimatedEconomics(), rulesV1).level).toBe("medium");
    expect(
      computeConfidence(answersOf(3), measuredEconomics({ newCustomersOrigin: "estimated", origin: "estimated" }), rulesV1)
        .level,
    ).toBe("medium");
    expect(
      computeConfidence(answersOf(3), measuredEconomics({ spendOrigin: "estimated", origin: "estimated" }), rulesV1).level,
    ).toBe("medium");
  });

  it("the range cap lowers nothing that was already medium or low", () => {
    expect(computeConfidence(nullAnswers(4), estimatedEconomics(), rulesV1).level).toBe("medium");
    expect(computeConfidence(nullAnswers(10), estimatedEconomics(), rulesV1).level).toBe("low");
  });

  it("compares the share with the thresholds exactly at the edge (10% and 25%)", () => {
    const twenty: Rules = { ...rulesV1, confidence: { ...rulesV1.confidence, totalItems: 20 } };
    expect(computeConfidence(nullAnswers(2), measuredEconomics(), twenty).level).toBe("high"); // 10%
    expect(computeConfidence(nullAnswers(3), measuredEconomics(), twenty).level).toBe("medium"); // 15%
    expect(computeConfidence(nullAnswers(5), measuredEconomics(), twenty).level).toBe("medium"); // 25%
    expect(computeConfidence(nullAnswers(6), measuredEconomics(), twenty).level).toBe("low"); // 30%
  });
});

// ---------------------------------------------------------- completeness

describe("pendingBlocks (AC-dm-10, AC-dm-14)", () => {
  const completeCalculator: CalculatorInput = {
    ...EMPTY_CALCULATOR,
    spendParts: { ads: 100_000 },
    spendMode: "exact",
    newCustomersMode: "exact",
    newCustomers: 20,
    averagePurchaseCents: 4_500,
    purchasesPerYear: "twoToThree",
    relationshipLength: "oneToTwoYears",
    marginPercent: 40,
  };
  const withCalculator = (changes: Partial<CalculatorInput>): CalculatorInput => ({
    ...completeCalculator,
    ...changes,
  });
  // block 2 holds mp1..mp4, block 3 pc1..cm2, block 4 mm1..es1, then 5 aq, 6 en, 7 co, 8 re.
  const BLOCK_OF = { mp1: 2, mp2: 2, pc1: 3, cm2: 3, es1: 4, aq1: 5, en3: 6, co1: 7, re3: 8 } as const;

  it("everything is pending when nothing was answered", () => {
    expect(pendingBlocks({}, EMPTY_CALCULATOR)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("nothing is pending when all 24 questions and the six calculator fields are answered", () => {
    expect(pendingBlocks(answersOf(1), completeCalculator)).toEqual([]);
  });

  it.each(Object.entries(BLOCK_OF))("an unanswered %s leaves only block %i pending", (id, block) => {
    const answers = answersOf(1);
    delete answers[id as keyof Answers];
    expect(pendingBlocks(answers, completeCalculator)).toEqual([block]);
  });

  it("lists several pending blocks in ascending order", () => {
    const answers = answersOf(1);
    delete answers.re1;
    delete answers.pc2;
    expect(pendingBlocks(answers, EMPTY_CALCULATOR)).toEqual([1, 3, 8]);
  });

  it("'não sei' is an answer only where the catalog offers it", () => {
    for (const id of ["mp1", "mp3", "cm1", "mm1", "co1"] as const) {
      expect(pendingBlocks(answersOf(1, { [id]: null }), completeCalculator)).toEqual([]);
    }
    for (const id of ["mp2", "pc1", "es1", "re3"] as const) {
      expect(pendingBlocks(answersOf(1, { [id]: null }), completeCalculator)).toEqual([BLOCK_OF[id]]);
    }
  });

  it("an answer outside 0 to 3 does not count", () => {
    const answers = answersOf(1);
    (answers as Record<string, unknown>).aq2 = 4;
    expect(pendingBlocks(answers, completeCalculator)).toEqual([5]);
  });

  it.each<[string, Partial<CalculatorInput>, boolean]>([
    ["spend 'não sei'", { spendMode: "unknown" }, true],
    ["spend with no mode chosen", { spendMode: null }, false],
    ["spend 'sei os valores' with no part filled in", { spendMode: "exact", spendParts: {} }, false],
    ["spend 'sei os valores' with R$ 0,00 typed", { spendMode: "exact", spendParts: { ads: 0 } }, true],
    ["spend by range, range chosen", { spendMode: "range", spendRange: "upTo1000" }, true],
    ["spend by range, no range chosen", { spendMode: "range", spendRange: null }, false],
    ["new customers 'não sei'", { newCustomersMode: "unknown" }, true],
    ["new customers exact 0 (BR-dm-14)", { newCustomersMode: "exact", newCustomers: 0 }, true],
    ["new customers exact, not typed", { newCustomersMode: "exact", newCustomers: null }, false],
    ["new customers by range, range chosen", { newCustomersMode: "range", newCustomersRange: "over300" }, true],
    ["new customers by range, no range chosen", { newCustomersMode: "range", newCustomersRange: null }, false],
    ["no mode for new customers", { newCustomersMode: null }, false],
    ["average purchase not typed", { averagePurchaseCents: null }, false],
    ["average purchase negative", { averagePurchaseCents: -1 }, false],
    ["average purchase with a fraction of a cent", { averagePurchaseCents: 10.5 }, false],
    ["purchases per year not chosen", { purchasesPerYear: null }, false],
    ["relationship length not chosen", { relationshipLength: null }, false],
    ["margin not typed", { marginPercent: null }, false],
    ["margin R$ 0 of each R$ 100 (BR-dm-15)", { marginPercent: 0 }, true],
    ["margin R$ 100 of each R$ 100", { marginPercent: 100 }, true],
    ["margin above 100", { marginPercent: 101 }, false],
    ["margin with a decimal", { marginPercent: 40.5 }, false],
  ])("block 1: %s", (_label, changes, complete) => {
    expect(pendingBlocks(answersOf(1), withCalculator(changes))).toEqual(complete ? [] : [1]);
  });
});
