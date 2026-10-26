import { readdirSync } from "node:fs";
import { extractText } from "unpdf";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { formatDelta, recalculationNotice } from "../../shared/content/comparisonCopy.ts";
import { DIMENSIONS, LAST_STEP_PHRASE, LOCK_PHRASES } from "../../shared/content/stageContent.ts";
import {
  compareDiagnoses,
  compareWithResults,
  type ComparableDiagnosis,
} from "../../shared/domain/compareDiagnoses.ts";
import type { DiaryEntry } from "../../shared/domain/diary.ts";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis.ts";
import {
  DIMENSION_KEYS,
  EMPTY_CALCULATOR,
  type CalculatorInput,
  type DiagnosisInput,
  type Rules,
} from "../../shared/domain/types.ts";
import { formatMoney } from "../../shared/format/money.ts";
import type {
  ReportActionListBlock,
  ReportBlock,
  ReportDimensionBarsBlock,
  ReportDocument,
  ReportFactsBlock,
  ReportKeyNumbersBlock,
  ReportNoticeBlock,
  ReportPage,
  ReportTableBlock,
} from "../../shared/report/reportDocument.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { buildEvolutionDocument, buildPeriodDiary, type EvolutionDocumentInput } from "../../server/report/evolutionDocument.ts";
import { renderReportPdf } from "../../server/report/pdfRenderer.ts";
import { GUIDANCE_WARNING } from "../../server/report/reportCopy.ts";
import { createReportService } from "../../server/services/reportService.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";
import { rulesV2 } from "../fixtures/rulesV2.ts";

// AC-ra-12 (the pages of the evolution PDF), AC-ra-13 (the same numbers and the same recalculation
// notice as the "Comparar" screen, RULE-ra-02) and AC-ra-11 (no forbidden term, the warning twice).

const G1: DiagnosisInput = {
  answers: {
    mp1: null, mp2: 1, mp3: null, mp4: 1, pc1: 1, pc2: 1, pc3: 1, cm1: null, cm2: 1, mm1: null, mm2: 1,
    es1: 1, aq1: 1, aq2: 1, aq3: 1, en1: 1, en2: 1, en3: 1, co1: null, co2: 1, co3: 1, re1: 1, re2: 1, re3: 1,
  },
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

// "Produto e canal" at 67: stage 3 under rules v1, stage 2 under the test rules v2.
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
    mp1: 3, mp2: 3, mp3: 2, mp4: 3, pc1: 2, pc2: 2, pc3: 2, cm1: 3, cm2: 3, mm1: 2, mm2: 3,
    es1: 2, aq1: 3, aq2: 3, aq3: 2, en1: 3, en2: 2, en3: 3, co1: 2, co2: 2, co3: 2, re1: 3, re2: 2, re3: 3,
  },
  calculator: G3_CALCULATOR,
};

const BEFORE_AT = "2026-04-14T12:00:00.000Z";
const AFTER_AT = "2026-10-23T12:00:00.000Z";
const GENERATED_AT = new Date("2026-10-25T12:00:00.000Z");
const TIME_ZONE = "America/Sao_Paulo";

function diagnosed(id: string, completedAt: string, input: DiagnosisInput, rules: Rules): ComparableDiagnosis {
  return { id, completedAt, ...input, result: evaluateDiagnosis(input, rules) };
}

// Same rules in both: stage 1 → 3. Other rules in the second: the first is calculated again (stage 3 → 2 → 1).
const SAME_RULES = {
  previous: diagnosed("d1", BEFORE_AT, G1, rulesV1),
  current: diagnosed("d2", AFTER_AT, G3_PC_67, rulesV1),
  rules: rulesV1,
};
const RECALCULATED = {
  previous: diagnosed("d1", BEFORE_AT, G3_PC_67, rulesV1),
  current: diagnosed("d2", AFTER_AT, G1, rulesV2),
  rules: rulesV2,
};

type Pair = typeof SAME_RULES;

function documentOf(pair: Pair, extra: Partial<EvolutionDocumentInput> = {}) {
  const { comparison, previousResult } = compareWithResults(pair.previous, pair.current, pair.rules);
  const document = buildEvolutionDocument({
    companyName: "Academia Foco",
    comparison,
    previousResult,
    currentResult: pair.current.result,
    generatedAt: GENERATED_AT,
    timeZone: TIME_ZONE,
    ...extra,
  });
  return { comparison, previousResult, document };
}

function pageOf(document: ReportDocument, id: string): ReportPage {
  const page = document.pages.find((candidate) => candidate.id === id);
  if (page === undefined) throw new Error(`No page "${id}" in ${document.pages.map((item) => item.id).join(", ")}`);
  return page;
}

function blocksOf<Kind extends ReportBlock["kind"]>(page: ReportPage, kind: Kind) {
  return page.blocks.filter((block): block is Extract<ReportBlock, { kind: Kind }> => block.kind === kind);
}

function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, into));
  else if (value !== null && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, into));
  return into;
}

// RULE-dm-14: the terms the interface never shows.
const FORBIDDEN_TERMS = [/\bV[1-4]\b/i, /m[ée]todo\s+V4/i, /V4\s+Company/i, /\bPPA\b/i, /\bCREP\b/i, /vacina/i];

const BAR_PAGES = ["before-after-fit", "before-after-front"];

describe("buildEvolutionDocument", () => {
  describe("the pages (AC-ra-12)", () => {
    it("is the cover, 'Antes e depois' and 'Como ler', with no 'O que foi feito' before the tracking exists", () => {
      const { document } = documentOf(SAME_RULES);

      expect(document.kind).toBe("evolution");
      expect(document.title).toBe("Relatório de evolução");
      expect(document.subject).toBe("Academia Foco");
      expect(document.pages.map((page) => page.id)).toEqual([
        "cover",
        "before-after",
        ...BAR_PAGES,
        "how-to-read",
      ]);
      expect(pageOf(document, "before-after").title).toBe("Antes e depois");
      expect(document.pages.some((page) => page.title === "O que foi feito no período")).toBe(false);
    });

    it("puts the period, the days between the two and the brand on the cover", () => {
      const { document } = documentOf(SAME_RULES);

      const cover = pageOf(document, "cover").blocks[0];
      expect(cover).toMatchObject({
        kind: "cover",
        title: "Relatório de evolução",
        subject: "Academia Foco",
        facts: [
          { label: "Período", value: "14/04/2026 a 23/10/2026" },
          { label: "Tempo entre os dois", value: "192 dias" },
          { label: "Versão do cálculo", value: "1" },
        ],
        credit: "Gerado com o FitPulse em 25/10/2026",
      });
      expect(document.footer.text).toBe("FitPulse · Evolução");
    });

    it("signs with the brand of whoever delivers it", () => {
      const { document } = documentOf(SAME_RULES, { brand: { name: "Consultoria Norte", phone: "(11) 99999-0000" } });

      expect(pageOf(document, "cover").blocks[0]).toMatchObject({
        credit: "Preparado por Consultoria Norte com o FitPulse em 25/10/2026",
        contactLine: "(11) 99999-0000",
      });
      expect(document.footer.text).toBe("Consultoria Norte · Evolução");
    });

    it("tells the stage, the average, the cost per customer and the lock before and now", () => {
      const { document, comparison, previousResult } = documentOf(SAME_RULES);
      const page = pageOf(document, "before-after");

      const [stageAndAverage, cost] = blocksOf(page, "keyNumbers") as ReportKeyNumbersBlock[];
      expect(stageAndAverage.items[0].value).toBe("1 para 3");
      expect(stageAndAverage.items[0].label).toBe("Estágio: Descoberta para Escala. Subiu de degrau.");
      expect(stageAndAverage.items[1].value).toBe(`${comparison.average.before} para ${comparison.average.after}`);
      expect(stageAndAverage.items[1].label).toBe(`Média das 8 dimensões: ${formatDelta(comparison.average.delta)}`);
      const before = formatMoney(previousResult.unitEconomics.cacCents);
      const after = formatMoney(SAME_RULES.current.result.unitEconomics.cacCents);
      expect(cost.items[0].value).toBe(`${before} para ${after}`);
      expect(cost.items[0].label).toMatch(/^Custo por cliente · antes: .+; agora: .+$/);

      const [locks] = blocksOf(page, "facts") as ReportFactsBlock[];
      const lockPhrase = ({ lock }: typeof previousResult) =>
        lock === null ? LAST_STEP_PHRASE : `${LOCK_PHRASES[lock].charAt(0).toUpperCase()}${LOCK_PHRASES[lock].slice(1)}.`;
      expect(locks.items.map((item) => item.label)).toEqual(["Trava antes", "Trava agora"]);
      expect(locks.items[0].value).toBe(lockPhrase(previousResult));
      expect(locks.items[1].value).toBe(lockPhrase(SAME_RULES.current.result));
    });

    it("draws a bar before and a bar after for each of the 8 dimensions, with the difference written", () => {
      const { document, comparison } = documentOf(SAME_RULES);

      const bars = BAR_PAGES.flatMap((id) =>
        (blocksOf(pageOf(document, id), "dimensionBars") as ReportDimensionBarsBlock[]).flatMap((block) =>
          block.groups.flatMap((group) => group.bars),
        ),
      );
      const ordered = [
        ...comparison.dimensions.filter((change) => DIMENSIONS[change.key].group === "fit"),
        ...comparison.dimensions.filter((change) => DIMENSIONS[change.key].group === "front"),
      ];

      expect(bars).toHaveLength(16);
      ordered.forEach((change, index) => {
        const [before, after] = [bars[index * 2], bars[index * 2 + 1]];
        expect(before).toMatchObject({ name: `${DIMENSIONS[change.key].name}: antes`, score: change.before });
        expect(before.scoreText).toBe(`${change.before} de 100`);
        expect(after).toMatchObject({ name: `${DIMENSIONS[change.key].name}: depois`, score: change.after });
        expect(after.scoreText).toBe(`${change.after} de 100`);
        expect(after.supportsText.startsWith(formatDelta(change.delta))).toBe(true);
      });
      expect(ordered.map((change) => change.key).sort()).toEqual([...DIMENSION_KEYS].sort());
    });

    it("never prints an arrow the PDF fonts cannot draw", () => {
      for (const pair of [SAME_RULES, RECALCULATED]) {
        expect(collectStrings(documentOf(pair).document).filter((text) => text.includes("→"))).toEqual([]);
      }
    });
  });

  describe("O que foi feito no período (AC-ra-12)", () => {
    const [firstKey, secondKey, thirdKey] = SAME_RULES.previous.result.plan;
    const tracked = [
      { actionKey: firstKey, status: "done" as const, dueDate: "01/09/2026", owner: "Dono", note: "Já está no ar.", overdue: false },
      { actionKey: secondKey, status: "doing" as const, dueDate: "01/10/2026", owner: null, note: null, overdue: true },
      { actionKey: thirdKey, status: "todo" as const, dueDate: null, owner: null, note: null, overdue: false },
    ];
    const diary = Array.from({ length: 8 }, (_, index) => ({
      month: `2026-0${index + 1}`,
      cacCents: index === 2 ? null : 10_000 + index * 500,
    }));

    it("stays out without tracked actions and without diary months", () => {
      for (const period of [undefined, {}, { actions: [], diary: [] }]) {
        const { document } = documentOf(SAME_RULES, { period });
        expect(document.pages.map((page) => page.id)).not.toContain("period");
      }
    });

    it("lists the earlier plan's actions with state and whether they continue, before 'Como ler'", () => {
      const { document } = documentOf(SAME_RULES, { period: { actions: tracked } });

      expect(document.pages.map((page) => page.id).slice(-2)).toEqual(["period", "how-to-read"]);
      const page = pageOf(document, "period");
      expect(page.title).toBe("O que foi feito no período");
      const [list] = blocksOf(page, "actions") as ReportActionListBlock[];
      expect(list.items.map((item) => item.tag)).toEqual([
        { label: "Feita", tone: "ok" },
        { label: "Em andamento · vencida", tone: "bad" },
        { label: "A fazer", tone: "neutral" },
      ]);
      tracked.forEach((entry, index) => {
        const continues = SAME_RULES.current.result.plan.includes(entry.actionKey);
        expect(list.items[index].details[0]).toBe(
          continues ? "Continua no plano novo" : "Encerrada com o diagnóstico de 23/10/2026",
        );
      });
      expect(list.items[0].details).toContain("Prazo 01/09/2026 · Responsável: Dono");
      expect(list.items[0].details).toContain("Nota: Já está no ar.");
    });

    it("shows the cost per customer of the diary months, the 6 most recent", () => {
      const { document } = documentOf(SAME_RULES, { period: { diary } });

      const [table] = blocksOf(pageOf(document, "period"), "table") as ReportTableBlock[];
      expect(table.columns).toEqual(["Mês", "Custo por cliente"]);
      expect(table.rows).toEqual([
        ["03/2026", formatMoney(null)],
        ["04/2026", formatMoney(11_500)],
        ["05/2026", formatMoney(12_000)],
        ["06/2026", formatMoney(12_500)],
        ["07/2026", formatMoney(13_000)],
        ["08/2026", formatMoney(13_500)],
      ]);
      expect(pageOf(document, "period").blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "table"]);
    });
  });

  describe("the same pair as the 'Comparar' screen (AC-ra-13)", () => {
    it("reads the comparison the screen reads, with no notice when the rules are the same", () => {
      const { document, comparison } = documentOf(SAME_RULES);

      expect(comparison).toEqual(compareDiagnoses(SAME_RULES.previous, SAME_RULES.current, rulesV1));
      expect(comparison.recalculated).toBeUndefined();
      const notices = blocksOf(pageOf(document, "before-after"), "notice") as ReportNoticeBlock[];
      expect(notices.map((notice) => notice.text)).toEqual([GUIDANCE_WARNING]);
    });

    it("prints the recalculated numbers and the same notice when the rules versions differ", () => {
      const { document, comparison } = documentOf(RECALCULATED);
      const original = comparison.recalculated?.originalScore;

      expect(comparison).toEqual(compareDiagnoses(RECALCULATED.previous, RECALCULATED.current, rulesV2));
      // The earlier stage 3 of rules v1 no longer counts: it is measured by v2 (stage 2), then goes to stage 1.
      expect(comparison.stageChange).toEqual({ from: 2, to: 1, direction: "down" });
      const page = pageOf(document, "before-after");
      const [stageAndAverage] = blocksOf(page, "keyNumbers") as ReportKeyNumbersBlock[];
      expect(stageAndAverage.items[0].value).toBe("2 para 1");
      expect(stageAndAverage.items[0].label).toContain("Desceu de degrau.");
      expect(stageAndAverage.items[1].value).toBe(`${comparison.average.before} para ${comparison.average.after}`);

      const notices = (blocksOf(page, "notice") as ReportNoticeBlock[]).map((notice) => notice.text);
      expect(notices[0]).toBe(recalculationNotice(comparison, TIME_ZONE));
      expect(notices[0]).toBe(
        "O diagnóstico de abril foi feito com as regras 1. Para a comparação ser justa, recalculamos as respostas dele " +
          `com as regras 2: a média de abril fica em ${comparison.average.before} pontos, e é esse o número usado aqui. ` +
          `A nota registrada na época (estágio 3, média ${original?.average}) continua guardada no histórico.`,
      );
      expect(notices[1]).toBe(GUIDANCE_WARNING);
    });

    it("draws the dimension scores the comparison gives, recalculated ones included", () => {
      const { document, comparison } = documentOf(RECALCULATED);

      const scoreTexts = BAR_PAGES.flatMap((id) =>
        (blocksOf(pageOf(document, id), "dimensionBars") as ReportDimensionBarsBlock[]).flatMap((block) =>
          block.groups.flatMap((group) => group.bars.map((bar) => bar.scoreText)),
        ),
      );
      for (const change of comparison.dimensions) {
        expect(scoreTexts).toContain(`${change.before} de 100`);
        expect(scoreTexts).toContain(`${change.after} de 100`);
      }
    });
  });

  describe("the words (AC-ra-11)", () => {
    it.each([
      ["rules in common", SAME_RULES],
      ["a recalculation", RECALCULATED],
    ])("has no forbidden term and warns twice, with %s", (_label, pair) => {
      const { document } = documentOf(pair);

      const forbidden = collectStrings(document).filter((text) => FORBIDDEN_TERMS.some((term) => term.test(text)));
      expect(forbidden).toEqual([]);
      for (const id of ["before-after", "how-to-read"]) {
        const notices = blocksOf(pageOf(document, id), "notice") as ReportNoticeBlock[];
        expect(notices.map((notice) => notice.text)).toContain(GUIDANCE_WARNING);
      }
    });
  });

  describe("drawn on A4 sheets", () => {
    const longNote = "Conversei com o time comercial e combinamos revisar a oferta toda semana. ".repeat(6).slice(0, 500);
    const [firstKey, secondKey, thirdKey] = RECALCULATED.previous.result.plan;
    const fullPeriod = {
      actions: [firstKey, secondKey, thirdKey].map((actionKey) => ({
        actionKey,
        status: "doing" as const,
        dueDate: "01/10/2026",
        owner: "Equipe de marketing",
        note: longNote,
        overdue: true,
      })),
      diary: Array.from({ length: 8 }, (_, index) => ({ month: `2026-0${index + 1}`, cacCents: 123_456_789 + index })),
    };

    it.each([
      ["rules in common", SAME_RULES, undefined],
      ["a recalculation", RECALCULATED, undefined],
      ["a recalculation with the fullest 'O que foi feito'", RECALCULATED, fullPeriod],
    ])("fits every page, with %s", async (_label, pair, period) => {
      const { document } = documentOf(pair, { period, brand: { name: "Consultoria Norte e Associados" } });

      const pdf = await renderReportPdf(document);

      const { totalPages, text } = await extractText(new Uint8Array(pdf), { mergePages: false });
      expect(totalPages).toBe(document.pages.length);
      expect(text[1]).toContain("Antes e depois");
      expect(text.at(-1)).toContain(GUIDANCE_WARNING);
    });
  });
});

describe("buildPeriodDiary (AC-ra-12)", () => {
  const FROM = new Date(BEFORE_AT);
  const TO = new Date(AFTER_AT);
  const entry = (month: string, newCustomers: number, spend: Pick<DiaryEntry, "spendParts" | "spendTotalCents">): DiaryEntry => ({
    month,
    newCustomers,
    ...spend,
  });
  // The repository hands the months over newest first.
  const MONTHS: DiaryEntry[] = [
    entry("2026-11", 5, { spendParts: { ads: 50_000 }, spendTotalCents: null }),
    entry("2026-10", 8, { spendParts: { ads: 90_000, agency: 10_000 }, spendTotalCents: null }),
    entry("2026-08", 6, { spendParts: null, spendTotalCents: null }),
    entry("2026-07", 0, { spendParts: { ads: 70_000 }, spendTotalCents: null }),
    entry("2026-06", 12, { spendParts: null, spendTotalCents: 300_000 }),
    entry("2026-04", 10, { spendParts: { ads: 100_000 }, spendTotalCents: null }),
    entry("2026-03", 4, { spendParts: { ads: 40_000 }, spendTotalCents: null }),
  ];

  it("takes the months from the earlier diagnosis' month to the later one's, oldest first, with the cost per customer", () => {
    expect(buildPeriodDiary(MONTHS, FROM, TO)).toEqual([
      { month: "2026-04", cacCents: 10_000 },
      { month: "2026-06", cacCents: 25_000 },
      { month: "2026-07", cacCents: null },
      { month: "2026-10", cacCents: 12_500 },
    ]);
  });

  it("leaves out the months before the earlier diagnosis, after the later one and the ones that cannot be read", () => {
    const months = buildPeriodDiary(MONTHS, FROM, TO).map((point) => point.month);

    expect(months).not.toContain("2026-03");
    expect(months).not.toContain("2026-11");
    // 2026-08 has no spend at all.
    expect(months).not.toContain("2026-08");
  });

  it("has nothing to show without months or with a date that does not exist", () => {
    expect(buildPeriodDiary([], FROM, TO)).toEqual([]);
    expect(buildPeriodDiary(MONTHS, new Date("not a date"), TO)).toEqual([]);
    expect(buildPeriodDiary(MONTHS, FROM, new Date("not a date"))).toEqual([]);
  });

  it("counts a single month when both diagnoses are in it", () => {
    expect(buildPeriodDiary(MONTHS, new Date("2026-10-02T12:00:00.000Z"), new Date("2026-10-28T12:00:00.000Z"))).toEqual([
      { month: "2026-10", cacCents: 12_500 },
    ]);
  });
});

describe("the evolution through the report service", () => {
  let db: TestDatabase;
  const service = () => createReportService({ prisma: db.prisma, downloadsDir: db.downloadsDir, now: db.now, rules: rulesV2 });

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
  });

  async function createCompany(name = "Academia Foco"): Promise<string> {
    return (await db.prisma.company.create({ data: { name, segment: "health_wellness", salesChannel: "subscription" } })).id;
  }

  async function conclude(
    companyId: string,
    snapshot: ComparableDiagnosis,
    archivedAt: Date | null = null,
  ): Promise<string> {
    const created = await db.prisma.diagnosis.create({
      data: {
        companyId,
        status: "completed",
        answers: snapshot.answers as object,
        calculator: snapshot.calculator as object,
        rulesVersion: snapshot.result.rulesVersion,
        result: snapshot.result as unknown as object,
        stage: snapshot.result.stage,
        completedAt: new Date(snapshot.completedAt),
        archivedAt,
      },
    });
    return created.id;
  }

  it("builds the document from the recalculated pair and saves {company}-evolucao-{from}-a-{to}.pdf", async () => {
    const companyId = await createCompany();
    const fromId = await conclude(companyId, RECALCULATED.previous);
    const toId = await conclude(companyId, RECALCULATED.current);

    const document = await service().preview({ kind: "evolution", fromId, toId });
    expect(document.kind).toBe("evolution");
    const expected = documentOf(RECALCULATED).document;
    expect(pageOf(document, "before-after").blocks).toEqual(pageOf(expected, "before-after").blocks);
    expect(document.pages.map((page) => page.id)).not.toContain("period");

    const file = await service().export({ kind: "evolution", fromId, toId });
    expect(file.fileName).toBe("Academia Foco-evolucao-2026-04-14-a-2026-10-23.pdf");
    expect(readdirSync(db.downloadsDir)).toEqual([file.fileName]);
    const records = await db.prisma.generatedFile.findMany();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ id: file.fileId, companyId, kind: "evolution_pdf", fileName: file.fileName });
  });

  it("adds 'O que foi feito no período' when the owner tracked the earlier plan", async () => {
    const companyId = await createCompany();
    const fromId = await conclude(companyId, SAME_RULES.previous);
    const toId = await conclude(companyId, SAME_RULES.current);
    const [firstKey, secondKey] = SAME_RULES.previous.result.plan;
    await db.prisma.actionProgress.create({
      data: { diagnosisId: fromId, actionKey: firstKey, status: "in_progress", dueDate: "2026-09-01", ownerRole: "owner", note: "Em curso" },
    });
    await db.prisma.actionProgress.create({ data: { diagnosisId: fromId, actionKey: secondKey } });

    const document = await createReportService({ prisma: db.prisma, downloadsDir: db.downloadsDir, now: db.now }).preview({
      kind: "evolution",
      fromId,
      toId,
    });

    const [list] = blocksOf(pageOf(document, "period"), "actions") as ReportActionListBlock[];
    expect(list.items).toHaveLength(3);
    // The later diagnosis closed that plan: its deadline has passed, but nothing in it is overdue any more (RULE-ra-06).
    expect(list.items[0].tag).toEqual({ label: "Em andamento", tone: "warn" });
    expect(list.items[0].details).toContain("Prazo 01/09/2026 · Responsável: Dono");
    expect(list.items[1].tag).toEqual({ label: "A fazer", tone: "neutral" });
  });

  it("leaves the page out when nothing was recorded on the earlier plan", async () => {
    const companyId = await createCompany();
    const fromId = await conclude(companyId, SAME_RULES.previous);
    const toId = await conclude(companyId, SAME_RULES.current);
    await db.prisma.actionProgress.create({ data: { diagnosisId: fromId, actionKey: SAME_RULES.previous.result.plan[0] } });

    const document = await service().preview({ kind: "evolution", fromId, toId });

    expect(document.pages.map((page) => page.id)).not.toContain("period");
  });

  describe("the cost per customer of the diary in the period (AC-ra-12)", () => {
    async function note(companyId: string, month: string, newCustomers: number, spend: { ads?: number; total?: number }): Promise<void> {
      await db.prisma.diaryEntry.create({
        data: {
          companyId,
          month,
          newCustomers,
          ...(spend.ads === undefined ? {} : { spendParts: { ads: spend.ads } }),
          ...(spend.total === undefined ? {} : { spendTotalCents: BigInt(spend.total) }),
        },
      });
    }

    it("adds the page with the months noted between the two diagnoses, even when no action was tracked", async () => {
      const companyId = await createCompany();
      const fromId = await conclude(companyId, SAME_RULES.previous);
      const toId = await conclude(companyId, SAME_RULES.current);
      await note(companyId, "2026-03", 4, { ads: 40_000 });
      await note(companyId, "2026-05", 10, { ads: 150_000 });
      await note(companyId, "2026-09", 12, { total: 480_000 });
      await note(companyId, "2026-11", 5, { ads: 50_000 });

      const document = await service().preview({ kind: "evolution", fromId, toId });

      expect(document.pages.map((page) => page.id).slice(-2)).toEqual(["period", "how-to-read"]);
      const page = pageOf(document, "period");
      expect(page.blocks.map((block) => block.kind)).toEqual(["heading", "paragraph", "table"]);
      const [table] = blocksOf(page, "table") as ReportTableBlock[];
      expect(table.rows).toEqual([
        ["05/2026", formatMoney(15_000)],
        ["09/2026", formatMoney(40_000)],
      ]);
    });

    it("shows the tracked actions and the diary on the same page", async () => {
      const companyId = await createCompany();
      const fromId = await conclude(companyId, SAME_RULES.previous);
      const toId = await conclude(companyId, SAME_RULES.current);
      await db.prisma.actionProgress.create({
        data: { diagnosisId: fromId, actionKey: SAME_RULES.previous.result.plan[0], status: "done" },
      });
      await note(companyId, "2026-06", 10, { ads: 100_000 });

      const document = await service().preview({ kind: "evolution", fromId, toId });

      expect(pageOf(document, "period").blocks.map((block) => block.kind)).toEqual([
        "paragraph",
        "actions",
        "heading",
        "paragraph",
        "table",
      ]);
    });

    it("leaves the page out when no month falls in the period, and never reads another company's diary", async () => {
      const companyId = await createCompany("Academia Foco");
      const otherId = await createCompany("Studio Pulso");
      const fromId = await conclude(companyId, SAME_RULES.previous);
      const toId = await conclude(companyId, SAME_RULES.current);
      await note(companyId, "2026-02", 4, { ads: 40_000 });
      await note(companyId, "2026-12", 4, { ads: 40_000 });
      await note(otherId, "2026-06", 10, { ads: 100_000 });

      const document = await service().preview({ kind: "evolution", fromId, toId });

      expect(document.pages.map((page) => page.id)).not.toContain("period");
    });

    it("draws the diary months inside the sheets of the PDF", async () => {
      const companyId = await createCompany();
      const fromId = await conclude(companyId, SAME_RULES.previous);
      const toId = await conclude(companyId, SAME_RULES.current);
      for (const month of ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]) {
        await note(companyId, month, 10, { ads: 100_000 });
      }

      const document = await service().preview({ kind: "evolution", fromId, toId });
      const pdf = await renderReportPdf(document);
      const { totalPages, text } = await extractText(new Uint8Array(pdf), { mergePages: false });

      expect(totalPages).toBe(document.pages.length);
      const periodText = text[document.pages.findIndex((page) => page.id === "period")];
      expect(periodText).toContain("Custo por cliente no diário");
      // 7 months in the period: the 6 most recent are drawn.
      expect(periodText).toContain("10/2026");
      expect(periodText).not.toContain("04/2026");
    });
  });

  describe("refuses a pair that does not make an evolution", () => {
    async function refusal(fromId: string, toId: string) {
      return service()
        .preview({ kind: "evolution", fromId, toId })
        .then(
          () => null,
          (error: { status: number; code: string }) => ({ status: error.status, code: error.code }),
        );
    }

    it("when the order is inverted or both are the same diagnosis", async () => {
      const companyId = await createCompany();
      const fromId = await conclude(companyId, SAME_RULES.previous);
      const toId = await conclude(companyId, SAME_RULES.current);

      expect(await refusal(toId, fromId)).toEqual({ status: 409, code: "comparison_out_of_order" });
      expect(await refusal(fromId, fromId)).toEqual({ status: 409, code: "comparison_out_of_order" });
    });

    it("when the diagnoses are from two companies", async () => {
      const fromId = await conclude(await createCompany("Academia Foco"), SAME_RULES.previous);
      const toId = await conclude(await createCompany("Studio Norte"), SAME_RULES.current);

      expect(await refusal(fromId, toId)).toEqual({ status: 409, code: "different_companies" });
    });

    it("when one of them is archived", async () => {
      const companyId = await createCompany();
      const fromId = await conclude(companyId, SAME_RULES.previous, new Date("2026-10-24T12:00:00.000Z"));
      const toId = await conclude(companyId, SAME_RULES.current);

      expect(await refusal(fromId, toId)).toEqual({ status: 409, code: "diagnosis_archived" });
    });

    it("when one of them is a draft or does not exist", async () => {
      const companyId = await createCompany();
      const toId = await conclude(companyId, SAME_RULES.current);
      const draft = await db.prisma.diagnosis.create({ data: { companyId } });

      expect(await refusal(draft.id, toId)).toEqual({ status: 409, code: "diagnosis_not_completed" });
      expect(await refusal("not-a-diagnosis", toId)).toEqual({ status: 404, code: "diagnosis_not_found" });
    });
  });
});
