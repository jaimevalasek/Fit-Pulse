import { describe, expect, it } from "vitest";
import {
  DIARY_CHART_MONTHS,
  DIARY_CUSTOMERS_EMPTY_MESSAGE,
  DIARY_MAX_NEW_CUSTOMERS,
  DIARY_SPEND_EMPTY_MESSAGE,
  buildChartSummary,
  buildDiaryChart,
  buildDiaryView,
  computeDiaryProgress,
  computeMonthCostCents,
  computeRecentCost,
  diaryEntrySpendCents,
  diaryMonthTakenMessage,
  formatDiaryProgress,
  formatMonthCost,
  isDiaryMeasured,
  isTotalOnlyEntry,
  isUsableDiaryEntry,
  listDiaryEntries,
  mostRecentDiaryEntries,
  type DiaryEntry,
} from "../../shared/domain/diary";
import { EMPTY_CALCULATOR } from "../../shared/domain/types";
import { computeUnitEconomics } from "../../shared/domain/unitEconomics";
import { rulesV1 } from "../../shared/rules/rulesV1";

// AC-ra-41 (the cost of a month, "não calculado" with 0 customers, the 6-month chart, the progress,
// no NaN or Infinity anywhere) and the arithmetic behind AC-ra-38/39/43 (RULE-ra-08).

function entryOf(month: string, overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return { month, newCustomers: 10, spendParts: { ads: 60_000 }, spendTotalCents: null, ...overrides };
}

// One month per entry, 10 customers each; the spend grows by R$ 100,00 a month so every cost differs.
function monthsOf(months: string[]): DiaryEntry[] {
  return months.map((month, index) =>
    entryOf(month, { spendParts: { ads: 100_000 + index * 10_000 } }),
  );
}

describe("spend of a month", () => {
  it("adds the parts the owner filled in", () => {
    const entry = entryOf("2026-10", { spendParts: { ads: 120_000, tools: 30_000, salary: 250_000 } });
    expect(diaryEntrySpendCents(entry)).toBe(400_000);
  });

  it("counts a part written as zero as filled", () => {
    expect(diaryEntrySpendCents(entryOf("2026-10", { spendParts: { ads: 0 } }))).toBe(0);
  });

  it("uses the single total when no part is filled (Só sei o total)", () => {
    const entry = entryOf("2026-10", { spendParts: null, spendTotalCents: 345_600 });
    expect(diaryEntrySpendCents(entry)).toBe(345_600);
    expect(isTotalOnlyEntry(entry)).toBe(true);
    expect(isTotalOnlyEntry(entryOf("2026-10"))).toBe(false);
  });

  it("reads an empty parts object as no parts", () => {
    const entry = entryOf("2026-10", { spendParts: {}, spendTotalCents: 90_000 });
    expect(diaryEntrySpendCents(entry)).toBe(90_000);
  });

  it("gives null when there is no spend at all, instead of 0", () => {
    expect(diaryEntrySpendCents(entryOf("2026-10", { spendParts: null, spendTotalCents: null }))).toBeNull();
    expect(diaryEntrySpendCents(entryOf("2026-10", { spendParts: {}, spendTotalCents: null }))).toBeNull();
  });
});

describe("entries the diary can read", () => {
  it("accepts a real month, a whole customer count from 0 and some spend", () => {
    expect(isUsableDiaryEntry(entryOf("2026-10"))).toBe(true);
    expect(isUsableDiaryEntry(entryOf("2026-10", { newCustomers: 0 }))).toBe(true);
    expect(isUsableDiaryEntry(entryOf("2026-10", { newCustomers: DIARY_MAX_NEW_CUSTOMERS }))).toBe(true);
  });

  it("refuses an impossible month, a bad customer count or a missing spend", () => {
    expect(isUsableDiaryEntry(entryOf("2026-13"))).toBe(false);
    expect(isUsableDiaryEntry(entryOf("10/2026"))).toBe(false);
    expect(isUsableDiaryEntry(entryOf("2026-10", { newCustomers: -1 }))).toBe(false);
    expect(isUsableDiaryEntry(entryOf("2026-10", { newCustomers: 1.5 }))).toBe(false);
    expect(isUsableDiaryEntry(entryOf("2026-10", { newCustomers: DIARY_MAX_NEW_CUSTOMERS + 1 }))).toBe(false);
    expect(isUsableDiaryEntry(entryOf("2026-10", { newCustomers: Number.NaN }))).toBe(false);
    expect(isUsableDiaryEntry(entryOf("2026-10", { spendParts: null, spendTotalCents: null }))).toBe(false);
  });
});

describe("cost per customer of a month (RULE-ra-08)", () => {
  it("divides the spend by the new customers and rounds to the cent, half up", () => {
    expect(computeMonthCostCents(entryOf("2026-10", { spendParts: { ads: 354_000 }, newCustomers: 59 }))).toBe(6_000);
    // 10_000 / 3 = 3333,33 cents; 5 / 2 = 2,5 cents rounds up like the first version.
    expect(computeMonthCostCents(entryOf("2026-10", { spendParts: { ads: 10_000 }, newCustomers: 3 }))).toBe(3_333);
    expect(computeMonthCostCents(entryOf("2026-10", { spendParts: { ads: 5 }, newCustomers: 2 }))).toBe(3);
  });

  it("gives the same cost as the engine of the first version for the same numbers", () => {
    const entry = entryOf("2026-10", { spendParts: { ads: 123_457 }, newCustomers: 7 });
    const economics = computeUnitEconomics(
      {
        ...EMPTY_CALCULATOR,
        spendMode: "exact",
        spendParts: { ads: 123_457 },
        newCustomersMode: "exact",
        newCustomers: 7,
      },
      rulesV1,
    );
    expect(computeMonthCostCents(entry)).toBe(economics.cacCents);
  });

  it("is not calculated with 0 new customers, and says so in words", () => {
    const entry = entryOf("2026-10", { newCustomers: 0 });
    expect(computeMonthCostCents(entry)).toBeNull();
    expect(formatMonthCost(entry)).toBe("não calculado");
  });

  it("works from the single total", () => {
    const entry = entryOf("2026-10", { spendParts: null, spendTotalCents: 90_000, newCustomers: 12 });
    expect(computeMonthCostCents(entry)).toBe(7_500);
    expect(formatMonthCost(entry)).toBe("R$ 75,00");
  });

  it("is zero, not empty, when the month cost nothing", () => {
    const entry = entryOf("2026-10", { spendParts: { ads: 0 }, newCustomers: 4 });
    expect(computeMonthCostCents(entry)).toBe(0);
    expect(formatMonthCost(entry)).toBe("R$ 0,00");
  });

  it("is not calculated for an entry that cannot be read, never an exception", () => {
    expect(computeMonthCostCents(entryOf("2026-10", { spendParts: null, spendTotalCents: null }))).toBeNull();
    expect(computeMonthCostCents(entryOf("2026-10", { newCustomers: Number.NaN }))).toBeNull();
  });
});

describe("the list of noted months", () => {
  it("puts the most recent month first, whatever the order they were noted in", () => {
    const listed = listDiaryEntries(monthsOf(["2026-08", "2026-10", "2026-09"]));
    expect(listed.map((entry) => entry.month)).toEqual(["2026-10", "2026-09", "2026-08"]);
  });

  it("keeps one entry per month and leaves out what cannot be read", () => {
    const listed = listDiaryEntries([
      entryOf("2026-10"),
      entryOf("2026-10", { newCustomers: 99 }),
      entryOf("2026-13"),
      entryOf("2026-09", { spendParts: null, spendTotalCents: null }),
      entryOf("2026-08"),
    ]);
    expect(listed.map((entry) => entry.month)).toEqual(["2026-10", "2026-08"]);
    expect(listed[0].newCustomers).toBe(10);
  });

  it("does not reorder the array it was given", () => {
    const original = monthsOf(["2026-08", "2026-10", "2026-09"]);
    listDiaryEntries(original);
    expect(original.map((entry) => entry.month)).toEqual(["2026-08", "2026-10", "2026-09"]);
  });

  it("takes the most recent months noted, even when they are not consecutive", () => {
    const recent = mostRecentDiaryEntries(monthsOf(["2026-03", "2026-10", "2026-05", "2026-08"]), 3);
    expect(recent.map((entry) => entry.month)).toEqual(["2026-10", "2026-08", "2026-05"]);
    expect(mostRecentDiaryEntries(monthsOf(["2026-03"]), 3)).toHaveLength(1);
    expect(mostRecentDiaryEntries(monthsOf(["2026-03"]), 0)).toEqual([]);
  });
});

describe("cost chart of the last 6 months noted (AC-ra-41)", () => {
  it("shows the 6 most recent months, the oldest on the left", () => {
    const entries = monthsOf(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    const chart = buildDiaryChart(entries);
    expect(chart).toHaveLength(DIARY_CHART_MONTHS);
    expect(chart.map((point) => point.month)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(chart[0].cacCents).toBe(12_000);
    expect(chart[5].cacCents).toBe(17_000);
  });

  it("shows fewer months when fewer are noted, and nothing when none is", () => {
    expect(buildDiaryChart(monthsOf(["2026-09", "2026-10"]))).toHaveLength(2);
    expect(buildDiaryChart([])).toEqual([]);
  });

  it("keeps a month without new customers in the chart as not calculated", () => {
    const chart = buildDiaryChart([entryOf("2026-09"), entryOf("2026-10", { newCustomers: 0 })]);
    expect(chart).toEqual([
      { month: "2026-09", cacCents: 6_000 },
      { month: "2026-10", cacCents: null },
    ]);
  });
});

describe("chart summary sentence", () => {
  it("says the cost fell, rose or held between the first and the last calculated month", () => {
    const fell = buildChartSummary([
      { month: "2026-08", cacCents: 9_000 },
      { month: "2026-09", cacCents: 7_000 },
      { month: "2026-10", cacCents: 6_000 },
    ]);
    expect(fell).toBe("O custo por cliente caiu de R$ 90,00 em ago/2026 para R$ 60,00 em out/2026.");
    const rose = buildChartSummary([
      { month: "2026-09", cacCents: 6_000 },
      { month: "2026-10", cacCents: 7_550 },
    ]);
    expect(rose).toBe("O custo por cliente subiu de R$ 60,00 em set/2026 para R$ 75,50 em out/2026.");
    const held = buildChartSummary([
      { month: "2026-09", cacCents: 6_000 },
      { month: "2026-10", cacCents: 6_000 },
    ]);
    expect(held).toBe("O custo por cliente ficou em R$ 60,00 de set/2026 a out/2026.");
  });

  it("skips months that are not calculated and still reads the rest", () => {
    const summary = buildChartSummary([
      { month: "2026-08", cacCents: 9_000 },
      { month: "2026-09", cacCents: null },
      { month: "2026-10", cacCents: 6_000 },
    ]);
    expect(summary).toBe("O custo por cliente caiu de R$ 90,00 em ago/2026 para R$ 60,00 em out/2026.");
  });

  it("has a sentence for one calculated month, for none, and for an empty diary", () => {
    expect(buildChartSummary([{ month: "2026-10", cacCents: 6_000 }])).toBe(
      "Custo por cliente em out/2026: R$ 60,00.",
    );
    expect(buildChartSummary([{ month: "2026-10", cacCents: null }])).toContain("ainda não foi calculado");
    expect(buildChartSummary([])).toBe("Nenhum mês anotado no diário.");
  });
});

describe("progress toward a measured number (AC-ra-41)", () => {
  it("counts the months noted until there are 3", () => {
    expect(formatDiaryProgress(computeDiaryProgress([]))).toBe("0 de 3 meses anotados");
    expect(formatDiaryProgress(computeDiaryProgress(monthsOf(["2026-10"])))).toBe("1 de 3 meses anotados");
    const two = computeDiaryProgress(monthsOf(["2026-09", "2026-10"]));
    expect(two).toEqual({ count: 2, measuredFrom: null, measuredTo: null });
    expect(formatDiaryProgress(two)).toBe("2 de 3 meses anotados");
    expect(isDiaryMeasured(two)).toBe(false);
  });

  it("says which months are measured once there are 3", () => {
    const three = computeDiaryProgress(monthsOf(["2026-08", "2026-09", "2026-10"]));
    expect(three).toEqual({ count: 3, measuredFrom: "2026-08", measuredTo: "2026-10" });
    expect(formatDiaryProgress(three)).toBe("Medido: de ago/2026 a out/2026");
    expect(isDiaryMeasured(three)).toBe(true);
  });

  it("measures the 3 most recent months when more are noted", () => {
    const progress = computeDiaryProgress(monthsOf(["2026-01", "2026-04", "2026-07", "2026-09", "2026-10"]));
    expect(progress).toEqual({ count: 5, measuredFrom: "2026-07", measuredTo: "2026-10" });
    expect(formatDiaryProgress(progress)).toBe("Medido: de jul/2026 a out/2026");
  });

  it("does not count an entry that cannot be read", () => {
    const progress = computeDiaryProgress([
      entryOf("2026-08"),
      entryOf("2026-09"),
      entryOf("2026-10", { spendParts: null, spendTotalCents: null }),
    ]);
    expect(progress.count).toBe(2);
  });
});

describe("cost over the 3 most recent months", () => {
  it("is null with an empty diary", () => {
    expect(computeRecentCost([])).toBeNull();
  });

  it("adds spend and customers before dividing, not the average of the monthly costs", () => {
    const recent = computeRecentCost([
      entryOf("2026-08", { spendParts: { ads: 100_000 }, newCustomers: 10 }),
      entryOf("2026-09", { spendParts: { ads: 100_000 }, newCustomers: 40 }),
      entryOf("2026-10", { spendParts: { ads: 100_000 }, newCustomers: 50 }),
      entryOf("2026-07", { spendParts: { ads: 900_000 }, newCustomers: 1 }),
    ]);
    expect(recent).toEqual({ months: 3, spendCents: 300_000, newCustomers: 100, cacCents: 3_000 });
  });

  it("is not calculated when the months had no new customers", () => {
    const recent = computeRecentCost([entryOf("2026-10", { newCustomers: 0 })]);
    expect(recent).toEqual({ months: 1, spendCents: 60_000, newCustomers: 0, cacCents: null });
  });
});

describe("what the diary tab receives (IF-006)", () => {
  it("lists the months with their totals and cost, the chart and the progress", () => {
    const view = buildDiaryView([
      entryOf("2026-09", { spendParts: null, spendTotalCents: 90_000, newCustomers: 0 }),
      entryOf("2026-10", { spendParts: { ads: 100_000, tools: 20_000 }, newCustomers: 10 }),
    ]);
    expect(view.entries).toEqual([
      {
        month: "2026-10",
        newCustomers: 10,
        spendParts: { ads: 100_000, tools: 20_000 },
        spendTotalCents: null,
        totalCents: 120_000,
        cacCents: 12_000,
      },
      {
        month: "2026-09",
        newCustomers: 0,
        spendParts: null,
        spendTotalCents: 90_000,
        totalCents: 90_000,
        cacCents: null,
      },
    ]);
    expect(view.progress).toEqual({ count: 2, measuredFrom: null, measuredTo: null });
    expect(view.chart).toEqual([
      { month: "2026-09", cacCents: null },
      { month: "2026-10", cacCents: 12_000 },
    ]);
  });

  it("is empty for an empty diary", () => {
    expect(buildDiaryView([])).toEqual({
      entries: [],
      progress: { count: 0, measuredFrom: null, measuredTo: null },
      chart: [],
    });
  });

  it("never carries NaN, Infinity, undefined or an empty value into anything a screen shows (AC-ra-41)", () => {
    const entries: DiaryEntry[] = [
      entryOf("2026-05", { newCustomers: 0 }),
      entryOf("2026-06", { spendParts: { ads: 0 }, newCustomers: 0 }),
      entryOf("2026-07", { spendParts: null, spendTotalCents: 0, newCustomers: 3 }),
      entryOf("2026-08", { newCustomers: Number.NaN }),
      entryOf("2026-09", { spendParts: null, spendTotalCents: null }),
      entryOf("2026-10", { spendParts: { ads: 9_999_999_999 }, newCustomers: 1 }),
    ];
    const view = buildDiaryView(entries);
    const texts = [
      JSON.stringify(view),
      buildChartSummary(view.chart),
      formatDiaryProgress(view.progress),
      ...entries.map((entry) => formatMonthCost(entry)),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/NaN|Infinity|undefined/);
      expect(text.trim()).not.toBe("");
    }
  });
});

describe("messages of the month form (AC-ra-39)", () => {
  it("names the month that is already noted", () => {
    expect(diaryMonthTakenMessage("2026-08")).toBe(
      "Agosto de 2026 já está no diário. Edite o mês em vez de anotar de novo.",
    );
    expect(diaryMonthTakenMessage("2026-03")).toBe(
      "Março de 2026 já está no diário. Edite o mês em vez de anotar de novo.",
    );
  });

  it("keeps the approved texts of the empty spend and the empty customers", () => {
    expect(DIARY_SPEND_EMPTY_MESSAGE).toBe(
      "Preencha pelo menos uma parte do gasto, ou marque 'Só sei o total'.",
    );
    expect(DIARY_CUSTOMERS_EMPTY_MESSAGE).toContain("clientes novos");
  });
});
