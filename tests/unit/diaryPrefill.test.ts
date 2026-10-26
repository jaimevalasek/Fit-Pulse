import { describe, expect, it } from "vitest";
import { computeConfidence } from "../../shared/domain/confidence";
import { isCalculatorComplete } from "../../shared/domain/completeness";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis";
import type { DiaryEntry } from "../../shared/domain/diary";
import {
  applyDiarySuggestion,
  applyDiaryToCalculator,
  carryDiaryMarks,
  computeDiaryPrefill,
  formatCostDiaryOrigin,
  formatDiaryMark,
  getCostDiaryOrigin,
  isDiarySuggestionOffered,
} from "../../shared/domain/diaryPrefill";
import {
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type Answers,
  type CalculatorInput,
  type DiarySuggestion,
} from "../../shared/domain/types";
import { computeUnitEconomics } from "../../shared/domain/unitEconomics";
import { rulesV1 } from "../../shared/rules/rulesV1";

// AC-ra-44 and AC-ra-45 (RULE-ra-09): what the diary gives block 1 of a new draft, with 3 months or
// more, with 1 or 2, and with none; AC-ra-46: a number edited by hand loses its mark.

function entryOf(month: string, overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return { month, newCustomers: 10, spendParts: { ads: 60_000 }, spendTotalCents: null, ...overrides };
}

function baseCalculator(overrides: Partial<CalculatorInput> = {}): CalculatorInput {
  return {
    ...EMPTY_CALCULATOR,
    spendParts: {},
    averagePurchaseCents: 4_800,
    purchasesPerYear: "sevenToTwelve",
    relationshipLength: "oneToTwoYears",
    marginPercent: 40,
    ...overrides,
  };
}

const ANSWERED: Answers = Object.fromEntries(QUESTION_IDS.map((id) => [id, 2]));

// Three months of R$ 600,00 ads + R$ 100,00 tools / 10 customers: a cost of R$ 70,00 per customer.
const THREE_MONTHS: DiaryEntry[] = [
  entryOf("2026-08", { spendParts: { ads: 60_000, tools: 10_000 }, newCustomers: 10 }),
  entryOf("2026-09", { spendParts: { ads: 60_000, tools: 10_000 }, newCustomers: 10 }),
  entryOf("2026-10", { spendParts: { ads: 60_000, tools: 10_000 }, newCustomers: 10 }),
];

describe("no month in the diary", () => {
  it("gives nothing, and the calculator of the draft is exactly the first version's", () => {
    expect(computeDiaryPrefill([])).toEqual({ kind: "none" });
    const calculator = baseCalculator();
    expect(applyDiaryToCalculator(calculator, [])).toBe(calculator);
    expect(isDiarySuggestionOffered(calculator)).toBe(false);
  });

  it("ignores entries that cannot be read", () => {
    const unreadable = [entryOf("2026-13"), entryOf("2026-10", { spendParts: null, spendTotalCents: null })];
    expect(computeDiaryPrefill(unreadable)).toEqual({ kind: "none" });
  });
});

describe("3 months or more: measured (AC-ra-44)", () => {
  it("sums the 3 months part by part and marks both numbers with the months they came from", () => {
    const prefill = computeDiaryPrefill(THREE_MONTHS);
    expect(prefill.kind).toBe("measured");
    if (prefill.kind !== "measured") return;
    expect(prefill.numbers).toEqual({
      spendMode: "exact",
      spendParts: { ads: 180_000, tools: 30_000 },
      spendTotalCents: null,
      spendRange: null,
      newCustomersMode: "exact",
      newCustomers: 30,
      newCustomersRange: null,
    });
    const source = { origin: "measured", fromMonth: "2026-08", toMonth: "2026-10", monthCount: 3 };
    expect(prefill.source).toEqual({ spend: source, newCustomers: source });
  });

  it("uses only the 3 most recent months noted, even when they are not consecutive", () => {
    const entries = [
      entryOf("2026-01", { spendParts: { ads: 900_000 }, newCustomers: 1 }),
      entryOf("2026-04", { spendParts: { ads: 50_000 }, newCustomers: 5 }),
      entryOf("2026-07", { spendParts: { ads: 70_000 }, newCustomers: 7 }),
      entryOf("2026-10", { spendParts: { ads: 90_000 }, newCustomers: 9 }),
    ];
    const prefill = computeDiaryPrefill(entries);
    if (prefill.kind !== "measured") throw new Error("expected measured");
    expect(prefill.numbers.spendParts).toEqual({ ads: 210_000 });
    expect(prefill.numbers.newCustomers).toBe(21);
    expect(prefill.source.spend).toMatchObject({ fromMonth: "2026-04", toMonth: "2026-10" });
  });

  it("only sums the parts some month filled in", () => {
    const entries = [
      entryOf("2026-08", { spendParts: { ads: 10_000 } }),
      entryOf("2026-09", { spendParts: { tools: 5_000, ads: 0 } }),
      entryOf("2026-10", { spendParts: { ads: 20_000 } }),
    ];
    const prefill = computeDiaryPrefill(entries);
    if (prefill.kind !== "measured") throw new Error("expected measured");
    expect(prefill.numbers.spendParts).toEqual({ ads: 30_000, tools: 5_000 });
  });

  it("puts the diary numbers in the calculator and marks them, keeping the rest of the block", () => {
    const calculator = applyDiaryToCalculator(baseCalculator(), THREE_MONTHS);
    expect(calculator).toMatchObject({
      spendMode: "exact",
      spendParts: { ads: 180_000, tools: 30_000 },
      newCustomersMode: "exact",
      newCustomers: 30,
      averagePurchaseCents: 4_800,
      marginPercent: 40,
      diarySuggestion: null,
    });
    expect(calculator.diarySource?.spend?.origin).toBe("measured");
    expect(calculator.diarySource?.newCustomers?.origin).toBe("measured");
    expect(isDiarySuggestionOffered(calculator)).toBe(false);
  });

  it("counts the cost per customer as measured for the engine, the stage and the confidence (RULE-dm-04)", () => {
    const calculator = applyDiaryToCalculator(baseCalculator(), THREE_MONTHS);
    const economics = computeUnitEconomics(calculator, rulesV1);
    expect(economics.origin).toBe("measured");
    expect(economics.spendOrigin).toBe("measured");
    expect(economics.newCustomersOrigin).toBe("measured");
    expect(economics.spendCents).toBe(210_000);
    expect(economics.newCustomers).toBe(30);
    expect(economics.cacCents).toBe(7_000);
    const result = evaluateDiagnosis({ answers: ANSWERED, calculator }, rulesV1);
    expect(result.unitEconomics.origin).toBe("measured");
    expect(result.confidence.level).toBe("high");
  });

  it("makes block 1 complete as soon as the other fields are there", () => {
    expect(isCalculatorComplete(applyDiaryToCalculator(baseCalculator(), THREE_MONTHS))).toBe(true);
  });
});

describe("a month with only the total (AC-ra-44)", () => {
  const withTotalOnly: DiaryEntry[] = [
    entryOf("2026-08", { spendParts: { ads: 60_000, tools: 10_000 }, newCustomers: 10 }),
    entryOf("2026-09", { spendParts: null, spendTotalCents: 80_000, newCustomers: 10 }),
    entryOf("2026-10", { spendParts: { ads: 50_000 }, newCustomers: 10 }),
  ];

  it("shows the spend as one total, with no division by part", () => {
    const prefill = computeDiaryPrefill(withTotalOnly);
    if (prefill.kind !== "measured") throw new Error("expected measured");
    expect(prefill.numbers.spendParts).toEqual({});
    expect(prefill.numbers.spendTotalCents).toBe(200_000);
    expect(prefill.numbers.newCustomers).toBe(30);
  });

  it("recalculates the panel the same as with the parts", () => {
    const calculator = applyDiaryToCalculator(baseCalculator(), withTotalOnly);
    const economics = computeUnitEconomics(calculator, rulesV1);
    expect(economics.origin).toBe("measured");
    expect(economics.spendCents).toBe(200_000);
    expect(economics.cacCents).toBe(6_667);
    expect(isCalculatorComplete(calculator)).toBe(true);
  });
});

describe("1 or 2 months: a suggestion, estimated once accepted (AC-ra-45)", () => {
  it("projects the average of one month to 3 and keeps it aside, leaving the numbers empty", () => {
    const entries = [entryOf("2026-10", { spendParts: { ads: 60_000, tools: 10_000 }, newCustomers: 10 })];
    const prefill = computeDiaryPrefill(entries);
    expect(prefill).toEqual({
      kind: "suggestion",
      suggestion: {
        monthCount: 1,
        fromMonth: "2026-10",
        toMonth: "2026-10",
        spendParts: { ads: 180_000, tools: 30_000 },
        spendTotalCents: null,
        newCustomers: 30,
      },
    });
    const calculator = applyDiaryToCalculator(baseCalculator(), entries);
    expect(calculator.spendMode).toBeNull();
    expect(calculator.newCustomers).toBeNull();
    expect(calculator.diarySource).toBeUndefined();
    expect(calculator.diarySuggestion?.monthCount).toBe(1);
    expect(isDiarySuggestionOffered(calculator)).toBe(true);
    expect(computeUnitEconomics(calculator, rulesV1).origin).toBe("unknown");
  });

  it("projects the average of two months to 3, rounding half up to whole cents and customers", () => {
    const entries = [
      entryOf("2026-09", { spendParts: { ads: 100 }, newCustomers: 3 }),
      entryOf("2026-10", { spendParts: { ads: 101 }, newCustomers: 4 }),
    ];
    const prefill = computeDiaryPrefill(entries);
    if (prefill.kind !== "suggestion") throw new Error("expected suggestion");
    // (100 + 101) / 2 x 3 = 301,5 cents; (3 + 4) / 2 x 3 = 10,5 customers.
    expect(prefill.suggestion.spendParts).toEqual({ ads: 302 });
    expect(prefill.suggestion.newCustomers).toBe(11);
    expect(prefill.suggestion).toMatchObject({ monthCount: 2, fromMonth: "2026-09", toMonth: "2026-10" });
  });

  it("projects a single total when any of the months only has the total", () => {
    const entries = [
      entryOf("2026-09", { spendParts: null, spendTotalCents: 90_000, newCustomers: 5 }),
      entryOf("2026-10", { spendParts: { ads: 60_000 }, newCustomers: 5 }),
    ];
    const prefill = computeDiaryPrefill(entries);
    if (prefill.kind !== "suggestion") throw new Error("expected suggestion");
    expect(prefill.suggestion.spendParts).toEqual({});
    expect(prefill.suggestion.spendTotalCents).toBe(225_000);
    expect(prefill.suggestion.newCustomers).toBe(15);
  });

  it("does not change the draft until the owner accepts, and then counts it as estimated", () => {
    const entries = [entryOf("2026-09"), entryOf("2026-10")];
    const draft = applyDiaryToCalculator(baseCalculator(), entries);
    const suggestion = draft.diarySuggestion as DiarySuggestion;
    const accepted = applyDiarySuggestion(draft, suggestion);
    expect(accepted).toMatchObject({
      spendMode: "exact",
      spendParts: { ads: 180_000 },
      newCustomersMode: "exact",
      newCustomers: 30,
    });
    expect(accepted.diarySource?.spend).toEqual({
      origin: "estimated",
      fromMonth: "2026-09",
      toMonth: "2026-10",
      monthCount: 2,
    });
    expect(accepted.diarySuggestion).toEqual(suggestion);
    expect(isDiarySuggestionOffered(accepted)).toBe(false);

    const economics = computeUnitEconomics(accepted, rulesV1);
    expect(economics.origin).toBe("estimated");
    expect(economics.spendOrigin).toBe("estimated");
    expect(economics.newCustomersOrigin).toBe("estimated");
    // The cost per customer is the monthly one: the projection multiplies both numbers by 3.
    expect(economics.cacCents).toBe(6_000);
  });

  it("keeps the accepted suggestion from counting as measured, while the cost is still known", () => {
    const entries = [entryOf("2026-10")];
    const accepted = applyDiarySuggestion(
      applyDiaryToCalculator(baseCalculator(), entries),
      computeDiaryPrefillSuggestion(entries),
    );
    const result = evaluateDiagnosis({ answers: ANSWERED, calculator: accepted }, rulesV1);
    expect(result.unitEconomics.origin).toBe("estimated");
    expect(result.unitEconomics.cacCents).toBe(6_000);
  });

  it("holds the confidence at medium even when every other answer is known (AC-dm-49)", () => {
    const answers = ANSWERED;
    const entries = [entryOf("2026-10")];
    const accepted = applyDiarySuggestion(
      applyDiaryToCalculator(baseCalculator(), entries),
      computeDiaryPrefillSuggestion(entries),
    );
    const estimated = computeUnitEconomics(accepted, rulesV1);
    expect(computeConfidence(answers, estimated, rulesV1).level).toBe("medium");

    const measured = computeUnitEconomics(applyDiaryToCalculator(baseCalculator(), THREE_MONTHS), rulesV1);
    expect(computeConfidence(answers, measured, rulesV1).level).toBe("high");
  });

  it("makes block 1 complete once accepted", () => {
    const entries = [entryOf("2026-10")];
    const draft = applyDiaryToCalculator(baseCalculator(), entries);
    expect(isCalculatorComplete(draft)).toBe(false);
    expect(isCalculatorComplete(applyDiarySuggestion(draft, computeDiaryPrefillSuggestion(entries)))).toBe(true);
  });
});

function computeDiaryPrefillSuggestion(entries: DiaryEntry[]): DiarySuggestion {
  const prefill = computeDiaryPrefill(entries);
  if (prefill.kind !== "suggestion") throw new Error("expected suggestion");
  return prefill.suggestion;
}

describe("the draft keeps what it was given (AC-ra-46)", () => {
  it("does not touch the entries or the calculator it was handed, so a later change of the diary cannot reach it", () => {
    const entries = THREE_MONTHS.map((entry) => ({ ...entry, spendParts: { ...entry.spendParts } }));
    const before = baseCalculator();
    const snapshot = JSON.stringify([entries, before]);
    const draft = applyDiaryToCalculator(before, entries);
    expect(JSON.stringify([entries, before])).toBe(snapshot);

    // Changing the diary afterwards builds a different calculator and leaves the draft as it was.
    const draftSnapshot = JSON.stringify(draft);
    applyDiaryToCalculator(before, [...entries, entryOf("2026-11", { spendParts: { ads: 1 } })]);
    expect(JSON.stringify(draft)).toBe(draftSnapshot);
  });
});

describe("a number edited by hand loses its mark (AC-ra-46)", () => {
  const measured = applyDiaryToCalculator(baseCalculator(), THREE_MONTHS);

  it("keeps both marks when nothing about the numbers changed", () => {
    const after = carryDiaryMarks(measured, { ...measured, marginPercent: 55 });
    expect(after.diarySource).toEqual(measured.diarySource);
    expect(after.marginPercent).toBe(55);
  });

  it("drops the spend mark when a part is corrected and keeps the customers mark", () => {
    const after = carryDiaryMarks(measured, { ...measured, spendParts: { ...measured.spendParts, ads: 170_000 } });
    expect(after.diarySource?.spend).toBeUndefined();
    expect(after.diarySource?.newCustomers?.origin).toBe("measured");
  });

  it("drops the customers mark when the customers are corrected and keeps the spend mark", () => {
    const after = carryDiaryMarks(measured, { ...measured, newCustomers: 29 });
    expect(after.diarySource?.newCustomers).toBeUndefined();
    expect(after.diarySource?.spend?.origin).toBe("measured");
  });

  it("drops the spend mark when the spend changes from exact to a range", () => {
    const after = carryDiaryMarks(measured, { ...measured, spendMode: "range", spendRange: "from1000To5000" });
    expect(after.diarySource?.spend).toBeUndefined();
  });

  it("leaves no diary state at all once both numbers are corrected", () => {
    const edited = { ...measured, newCustomers: 29, spendParts: { ads: 1 } };
    const after = carryDiaryMarks(measured, edited);
    expect("diarySource" in after).toBe(false);
    expect(computeUnitEconomics(after, rulesV1).origin).toBe("measured");
  });

  it("follows the first version's rule after the correction: a typed number is measured, a range is estimated", () => {
    const estimated = applyDiarySuggestion(
      applyDiaryToCalculator(baseCalculator(), [entryOf("2026-10")]),
      computeDiaryPrefillSuggestion([entryOf("2026-10")]),
    );
    expect(computeUnitEconomics(estimated, rulesV1).origin).toBe("estimated");
    // Only the spend is corrected: the customers still come from the projection.
    const spendFixed = carryDiaryMarks(estimated, { ...estimated, spendParts: { ads: 200_000 } });
    expect(computeUnitEconomics(spendFixed, rulesV1)).toMatchObject({
      spendOrigin: "measured",
      newCustomersOrigin: "estimated",
      origin: "estimated",
    });
    // Both corrected by hand: the cost is the owner's typed value, measured like the first version.
    const bothFixed = carryDiaryMarks(spendFixed, { ...spendFixed, newCustomers: 25 });
    expect(computeUnitEconomics(bothFixed, rulesV1).origin).toBe("measured");
  });

  it("never takes marks from the client: forged marks are dropped and the stored suggestion stays", () => {
    const draft = applyDiaryToCalculator(baseCalculator(), [entryOf("2026-10")]);
    const forged: CalculatorInput = {
      ...draft,
      spendMode: "exact",
      spendParts: { ads: 1 },
      diarySource: { spend: { origin: "measured", fromMonth: "2026-01", toMonth: "2026-03", monthCount: 3 } },
      diarySuggestion: null,
    };
    const after = carryDiaryMarks(draft, forged);
    expect(after.diarySource).toBeUndefined();
    expect(after.diarySuggestion).toEqual(draft.diarySuggestion);
  });

  it("leaves a calculator without any diary state exactly as it was (the first version)", () => {
    const plain = baseCalculator();
    const after = carryDiaryMarks(plain, { ...plain, marginPercent: 10 });
    expect("diarySource" in after).toBe(false);
    expect("diarySuggestion" in after).toBe(false);
  });

  it("offers 'Usar o diário' again after a corrected number lost the mark", () => {
    const entries = [entryOf("2026-10")];
    const accepted = applyDiarySuggestion(
      applyDiaryToCalculator(baseCalculator(), entries),
      computeDiaryPrefillSuggestion(entries),
    );
    expect(isDiarySuggestionOffered(accepted)).toBe(false);
    const corrected = carryDiaryMarks(accepted, { ...accepted, newCustomers: 25 });
    expect(isDiarySuggestionOffered(corrected)).toBe(true);
  });
});

describe("how the origin is written (AC-ra-44, AC-ra-45, AC-ra-46)", () => {
  it("writes the mark beside a number", () => {
    const measured = { origin: "measured", fromMonth: "2026-08", toMonth: "2026-10", monthCount: 3 } as const;
    expect(formatDiaryMark(measured)).toBe("do diário: ago/2026 a out/2026");
    const one = { origin: "estimated", fromMonth: "2026-10", toMonth: "2026-10", monthCount: 1 } as const;
    expect(formatDiaryMark(one)).toBe("do diário: 1 mês, estimado");
    const two = { origin: "estimated", fromMonth: "2026-09", toMonth: "2026-10", monthCount: 2 } as const;
    expect(formatDiaryMark(two)).toBe("do diário: 2 meses, estimado");
  });

  it("tells the result where the cost per customer came from", () => {
    const measured = applyDiaryToCalculator(baseCalculator(), THREE_MONTHS);
    expect(getCostDiaryOrigin(measured)).toBe("measured");
    expect(formatCostDiaryOrigin("measured")).toBe("do diário, medido");

    const entries = [entryOf("2026-10")];
    const estimated = applyDiarySuggestion(
      applyDiaryToCalculator(baseCalculator(), entries),
      computeDiaryPrefillSuggestion(entries),
    );
    expect(getCostDiaryOrigin(estimated)).toBe("estimated");
    expect(formatCostDiaryOrigin("estimated")).toBe("do diário, estimado");
  });

  it("says nothing about the diary when the cost was typed or only half of it came from the diary", () => {
    expect(getCostDiaryOrigin(baseCalculator())).toBeNull();
    const measured = applyDiaryToCalculator(baseCalculator(), THREE_MONTHS);
    const halfFixed = carryDiaryMarks(measured, { ...measured, newCustomers: 29 });
    expect(getCostDiaryOrigin(halfFixed)).toBeNull();
  });
});
