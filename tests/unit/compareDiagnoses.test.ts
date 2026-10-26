import { describe, expect, it } from "vitest";
import {
  compareDiagnoses,
  type ComparableDiagnosis,
} from "../../shared/domain/compareDiagnoses.ts";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis.ts";
import {
  DIMENSION_KEYS,
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type DiagnosisInput,
  type Rules,
} from "../../shared/domain/types.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { rulesV2 } from "../fixtures/rulesV2.ts";

// AC-dm-31 and RULE-dm-11: stage before → after, one score per dimension, the risks resolved and
// new, and the previous diagnosis calculated again when the rules version changed.

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// PRD reference case G1: stage 1, dimension scores 17 / 33 / 11 / 17 / 33 / 33 / 22 / 33.
const G1: DiagnosisInput = {
  answers: answersOf(1, { mp1: null, mp3: null, cm1: null, mm1: null, co1: null }),
  calculator: {
    ...EMPTY_CALCULATOR,
    spendMode: "unknown",
    newCustomersMode: "range",
    newCustomersRange: "from11To30",
    averagePurchaseCents: 4_500,
    purchasesPerYear: "twoToThree",
    relationshipLength: "oneToTwoYears",
    marginPercent: 40,
  },
};
const G1_SCORES = [17, 33, 11, 17, 33, 33, 22, 33];

// PRD reference case G3 with "Produto e canal" at 67: stage 3 under rules v1 (needs 60) and
// stage 2 under the test rules v2 (needs 70).
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
const G3_PC_67: DiagnosisInput = {
  answers: {
    mp1: 3, mp2: 3, mp3: 2, mp4: 3,
    pc1: 2, pc2: 2, pc3: 2,
    cm1: 3, cm2: 3,
    mm1: 2, mm2: 3,
    es1: 2,
    aq1: 3, aq2: 3, aq3: 2,
    en1: 3, en2: 2, en3: 3,
    co1: 2, co2: 2, co3: 2,
    re1: 3, re2: 2, re3: 3,
  },
  calculator: G3_CALCULATOR,
};

// A diagnosis as the service hands it over: answers, calculator and the result frozen with `rules`.
function diagnosed(id: string, completedAt: string, input: DiagnosisInput, rules: Rules): ComparableDiagnosis {
  return { id, completedAt, ...input, result: evaluateDiagnosis(input, rules) };
}

const signalIds = (risks: { signalId: string }[]) => risks.map((risk) => risk.signalId);

describe("compareDiagnoses", () => {
  describe("same rules version", () => {
    const first = diagnosed("d1", "2026-04-14T12:00:00.000Z", G1, rulesV1);
    const second = diagnosed("d2", "2026-10-23T12:00:00.000Z", G3_PC_67, rulesV1);
    const comparison = compareDiagnoses(first, second, rulesV1);

    it("compares the stored results as they are and reports no recalculation", () => {
      expect(comparison.recalculated).toBeUndefined();
      expect(comparison.previous).toEqual({
        id: "d1",
        completedAt: "2026-04-14T12:00:00.000Z",
        stage: 1,
        rulesVersion: 1,
      });
      expect(comparison.current).toEqual({
        id: "d2",
        completedAt: "2026-10-23T12:00:00.000Z",
        stage: 3,
        rulesVersion: 1,
      });
    });

    it("shows the stage going from the previous to the current one", () => {
      expect(comparison.stageChange).toEqual({ from: 1, to: 3, direction: "up" });
    });

    it("gives the score before, after and the difference of each dimension, in a fixed order", () => {
      expect(comparison.dimensions.map((dimension) => dimension.key)).toEqual([...DIMENSION_KEYS]);
      expect(comparison.dimensions.map((dimension) => dimension.before)).toEqual(G1_SCORES);
      for (const dimension of comparison.dimensions) {
        expect(dimension.after).toBe(second.result.dimensions[dimension.key].score);
        expect(dimension.delta).toBe(dimension.after - dimension.before);
      }
      expect(comparison.dimensions.some((dimension) => dimension.delta > 0)).toBe(true);
    });

    it("gives the average of the eight dimensions before and after", () => {
      const mean = (scores: number[]) => Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
      const afterScores = DIMENSION_KEYS.map((key) => second.result.dimensions[key].score);
      expect(comparison.average).toEqual({
        before: mean(G1_SCORES),
        after: mean(afterScores),
        delta: mean(afterScores) - mean(G1_SCORES),
      });
    });

    it("lists the risks that stopped existing and the ones that appeared, by signal", () => {
      const before = signalIds(first.result.risks);
      const after = signalIds(second.result.risks);
      expect(before).toContain("SIG-01");
      expect(signalIds(comparison.risksResolved)).toEqual(before.filter((id) => !after.includes(id)));
      expect(signalIds(comparison.risksNew)).toEqual(after.filter((id) => !before.includes(id)));
      expect(signalIds(comparison.risksResolved)).toContain("SIG-01");
    });

    it("carries the whole risk result, so the screen can show level and score", () => {
      const resolved = comparison.risksResolved.find((risk) => risk.signalId === "SIG-01");
      expect(resolved).toEqual(first.result.risks.find((risk) => risk.signalId === "SIG-01"));
    });
  });

  it("reports a stage that went down and negative differences", () => {
    const earlier = diagnosed("d1", "2026-04-14T12:00:00.000Z", G3_PC_67, rulesV1);
    const later = diagnosed("d2", "2026-10-23T12:00:00.000Z", G1, rulesV1);
    const comparison = compareDiagnoses(earlier, later, rulesV1);

    expect(comparison.stageChange).toEqual({ from: 3, to: 1, direction: "down" });
    expect(comparison.dimensions.map((dimension) => dimension.after)).toEqual(G1_SCORES);
    expect(comparison.dimensions.some((dimension) => dimension.delta < 0)).toBe(true);
    expect(comparison.average.delta).toBeLessThan(0);
    // What was a risk of the later diagnosis only is now "new", and the other way around.
    expect(signalIds(comparison.risksNew)).toContain("SIG-01");
  });

  it("reports no change when the two diagnoses are the same answers", () => {
    const first = diagnosed("d1", "2026-04-14T12:00:00.000Z", G1, rulesV1);
    const second = diagnosed("d2", "2026-10-23T12:00:00.000Z", G1, rulesV1);
    const comparison = compareDiagnoses(first, second, rulesV1);

    expect(comparison.stageChange).toEqual({ from: 1, to: 1, direction: "same" });
    expect(comparison.average.delta).toBe(0);
    expect(comparison.dimensions.every((dimension) => dimension.delta === 0)).toBe(true);
    expect(comparison.risksResolved).toEqual([]);
    expect(comparison.risksNew).toEqual([]);
    expect(comparison.recalculated).toBeUndefined();
  });

  describe("different rules versions (RULE-dm-11, BR-dm-07)", () => {
    // The same answers, concluded before and after the rules changed: stage 3 under v1, stage 2 under v2.
    const first = diagnosed("d1", "2026-04-14T12:00:00.000Z", G3_PC_67, rulesV1);
    const second = diagnosed("d2", "2026-10-23T12:00:00.000Z", G3_PC_67, rulesV2);

    it("starts from two results that really disagree because of the rules", () => {
      expect(first.result.stage).toBe(3);
      expect(second.result.stage).toBe(2);
    });

    it("calculates the previous again with the current rules from its stored answers", () => {
      const comparison = compareDiagnoses(first, second, rulesV2);

      expect(comparison.previous).toMatchObject({ id: "d1", stage: 2, rulesVersion: 2 });
      expect(comparison.current).toMatchObject({ id: "d2", stage: 2, rulesVersion: 2 });
      // The stage the previous diagnosis had under v1 no longer counts: both are measured by v2.
      expect(comparison.stageChange).toEqual({ from: 2, to: 2, direction: "same" });
      expect(comparison.dimensions.every((dimension) => dimension.delta === 0)).toBe(true);
    });

    it("keeps the original score and says which versions are involved", () => {
      const comparison = compareDiagnoses(first, second, rulesV2);

      expect(comparison.recalculated).toEqual({
        fromVersion: 1,
        toVersion: 2,
        originalScore: {
          stage: 3,
          average: Math.round(
            DIMENSION_KEYS.reduce((sum, key) => sum + first.result.dimensions[key].score, 0) / DIMENSION_KEYS.length,
          ),
        },
      });
    });

    it("recalculates from the stored answers, not from the stored result", () => {
      // A stored result that lies about the stage: only the answers can give the stage back.
      const tampered: ComparableDiagnosis = { ...first, result: { ...first.result, stage: 4 } };
      const comparison = compareDiagnoses(tampered, second, rulesV2);

      expect(comparison.previous.stage).toBe(2);
      expect(comparison.recalculated?.originalScore.stage).toBe(4);
    });

    it("never changes the results it receives", () => {
      const firstBefore = structuredClone(first);
      const secondBefore = structuredClone(second);

      compareDiagnoses(first, second, rulesV2);

      expect(first).toEqual(firstBefore);
      expect(second).toEqual(secondBefore);
    });

    it("compares the recalculated previous with a different current diagnosis", () => {
      const later = diagnosed("d3", "2026-10-23T12:00:00.000Z", G1, rulesV2);
      const comparison = compareDiagnoses(first, later, rulesV2);

      expect(comparison.recalculated?.originalScore.stage).toBe(3);
      expect(comparison.stageChange).toEqual({ from: 2, to: 1, direction: "down" });
      expect(comparison.dimensions.map((dimension) => dimension.after)).toEqual(G1_SCORES);
    });
  });
});
