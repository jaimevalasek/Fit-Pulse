import { describe, expect, it } from "vitest";
import {
  CALCULATOR_FIELDS,
  NEW_CUSTOMERS_RANGE_OPTIONS,
  PURCHASES_PER_YEAR_OPTIONS,
  RELATIONSHIP_LENGTH_OPTIONS,
  SPEND_PART_OPTIONS,
  SPEND_RANGE_OPTIONS,
} from "../../shared/content/calculatorOptions.ts";
import {
  BLOCKS,
  BLOCK_COUNT,
  QUESTION_BANK,
  allowsUnknown,
  getQuestion,
  isQuestionId,
  questionsOfBlock,
  questionsOfDimension,
} from "../../shared/content/questionBank.ts";
import {
  DIMENSION_KEYS,
  NEW_CUSTOMERS_RANGE_KEYS,
  PURCHASES_PER_YEAR_KEYS,
  QUESTION_IDS,
  RELATIONSHIP_LENGTH_KEYS,
  SPEND_PART_KEYS,
  SPEND_RANGE_KEYS,
} from "../../shared/domain/types.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";

const FACT_QUESTIONS_WITH_UNKNOWN = ["mp1", "mp3", "cm1", "mm1", "co1"];

describe("question bank structure (AC-dm-10)", () => {
  it("has 8 blocks numbered 1 to 8, in order", () => {
    expect(BLOCK_COUNT).toBe(8);
    expect(BLOCKS.map((block) => block.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(BLOCKS.map((block) => block.id)).size).toBe(8);
    for (const block of BLOCKS) {
      expect(block.title.length).toBeGreaterThan(0);
      expect(block.intro.length).toBeGreaterThan(0);
    }
  });

  it("has the 24 questions of the methodological content, each id once", () => {
    expect(QUESTION_BANK).toHaveLength(24);
    expect(QUESTION_BANK.map((question) => question.id)).toEqual([...QUESTION_IDS]);
    expect(new Set(QUESTION_BANK.map((question) => question.id)).size).toBe(24);
  });

  it("keeps block 1 for the calculator and spreads the questions over blocks 2 to 8", () => {
    expect(questionsOfBlock(1)).toHaveLength(0);
    const sizes = BLOCKS.slice(1).map((block) => questionsOfBlock(block.number).length);
    expect(sizes).toEqual([4, 5, 3, 3, 3, 3, 3]);
    expect(BLOCKS[0].title).toBe("Seus números");
  });

  it("assigns the questions to the dimensions of the catalog", () => {
    const sizes = Object.fromEntries(
      [...DIMENSION_KEYS, "structure" as const].map((dimension) => [
        dimension,
        questionsOfDimension(dimension).length,
      ]),
    );
    expect(sizes).toEqual({
      mp: 4,
      pc: 3,
      cm: 2,
      mm: 2,
      aq: 3,
      en: 3,
      co: 3,
      re: 3,
      structure: 1,
    });
    expect(getQuestion("es1").dimension).toBe("structure");
  });

  it("gives every question four anchors worth 0, 1, 2 and 3", () => {
    for (const question of QUESTION_BANK) {
      expect(question.options.map((option) => option.value)).toEqual([0, 1, 2, 3]);
      for (const option of question.options) {
        expect(option.label.trim().length).toBeGreaterThan(0);
      }
      expect(question.text.trim().length).toBeGreaterThan(0);
    }
  });

  it("resolves a question by id and recognizes only real ids", () => {
    expect(getQuestion("pc1").options[3].label).toBe("Mais de 70% de um canal só");
    expect(isQuestionId("mp1")).toBe(true);
    expect(isQuestionId("mp9")).toBe(false);
    expect(isQuestionId("__proto__")).toBe(false);
    expect(() => getQuestion("nope" as never)).toThrow();
  });

  it("has the six calculator fields with a label and help each", () => {
    expect(Object.keys(CALCULATOR_FIELDS)).toHaveLength(6);
    for (const field of Object.values(CALCULATOR_FIELDS)) {
      expect(field.label.trim().length).toBeGreaterThan(0);
      expect(field.help.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("question help and 'não sei' (AC-dm-11)", () => {
  it("has help text for every question, short and plain", () => {
    for (const question of QUESTION_BANK) {
      expect(question.help.trim().length, question.id).toBeGreaterThan(15);
      expect(question.help.length, question.id).toBeLessThanOrEqual(260);
    }
  });

  it("offers 'não sei' or 'não acompanho' only on mp1, mp3, cm1, mm1 and co1", () => {
    const withUnknown = QUESTION_BANK.filter((question) => question.unknownLabel !== null).map(
      (question) => question.id,
    );
    expect(withUnknown).toEqual(FACT_QUESTIONS_WITH_UNKNOWN);
    for (const question of QUESTION_BANK) {
      expect(allowsUnknown(question.id)).toBe(FACT_QUESTIONS_WITH_UNKNOWN.includes(question.id));
    }
  });

  it("words the unknown option per question", () => {
    expect(getQuestion("mp1").unknownLabel).toBe("Não acompanho");
    expect(getQuestion("mp3").unknownLabel).toBe("Não sei dizer");
    expect(getQuestion("cm1").unknownLabel).toBe("Não sei");
    expect(getQuestion("mm1").unknownLabel).toBe("Não sei calcular");
    expect(getQuestion("co1").unknownLabel).toBe("Não acompanho");
  });
});

describe("calculator options", () => {
  it("lists the six cost parts and five options for each range field", () => {
    expect(SPEND_PART_OPTIONS.map((option) => option.key)).toEqual([...SPEND_PART_KEYS]);
    expect(SPEND_RANGE_OPTIONS.map((option) => option.key)).toEqual([...SPEND_RANGE_KEYS]);
    expect(NEW_CUSTOMERS_RANGE_OPTIONS.map((option) => option.key)).toEqual([
      ...NEW_CUSTOMERS_RANGE_KEYS,
    ]);
    expect(PURCHASES_PER_YEAR_OPTIONS.map((option) => option.key)).toEqual([
      ...PURCHASES_PER_YEAR_KEYS,
    ]);
    expect(RELATIONSHIP_LENGTH_OPTIONS.map((option) => option.key)).toEqual([
      ...RELATIONSHIP_LENGTH_KEYS,
    ]);
    expect(SPEND_PART_OPTIONS).toHaveLength(6);
  });

  it("has a midpoint in the rules for every range option", () => {
    const { midpoints } = rulesV1;
    expect(Object.keys(midpoints.spendCentsByRange).sort()).toEqual([...SPEND_RANGE_KEYS].sort());
    expect(Object.keys(midpoints.newCustomersByRange).sort()).toEqual(
      [...NEW_CUSTOMERS_RANGE_KEYS].sort(),
    );
    expect(Object.keys(midpoints.purchasesPerYear).sort()).toEqual(
      [...PURCHASES_PER_YEAR_KEYS].sort(),
    );
    expect(Object.keys(midpoints.relationshipYears).sort()).toEqual(
      [...RELATIONSHIP_LENGTH_KEYS].sort(),
    );
  });

  it("keeps spend midpoints in whole cents and ranges in growing order", () => {
    const spend = SPEND_RANGE_KEYS.map((key) => rulesV1.midpoints.spendCentsByRange[key]);
    for (const value of spend) expect(Number.isInteger(value)).toBe(true);
    expect([...spend].sort((a, b) => a - b)).toEqual(spend);
  });
});
