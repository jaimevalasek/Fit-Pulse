import { extractText } from "unpdf";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { STAGES } from "../../shared/content/stageContent.ts";
import type { ActionKey, DiagnosisResult } from "../../shared/domain/types.ts";
import type {
  ReportDocument,
  ReportFactsBlock,
  ReportKeyNumbersBlock,
  ReportNoticeBlock,
  ReportPage,
  ReportTableBlock,
} from "../../shared/report/reportDocument.ts";
import { buildPortfolioDocument, PORTFOLIO_REPORT_TITLE } from "../../server/report/portfolioDocument.ts";
import { renderReportPdf } from "../../server/report/pdfRenderer.ts";
import { GUIDANCE_WARNING } from "../../server/report/reportCopy.ts";
import type { PortfolioRecord } from "../../server/repositories/portfolioRepository.ts";
import { buildPortfolio, createPortfolioService, type Portfolio } from "../../server/services/portfolioService.ts";
import { createReportService } from "../../server/services/reportService.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// AC-ra-15: the portfolio report has a cover, the companies by stage and the list of the active
// companies, with the numbers the consultant's home shows. Both come from `buildPortfolio`, so the
// tests below build one portfolio and read the PDF and the home view from it. Dates are built from
// local calendar parts, so the cases mean the same in any time zone.

const local = (year: number, month: number, day: number, hour = 12): Date => new Date(year, month - 1, day, hour);

const TODAY = local(2026, 10, 23);
const TIME_ZONE = "UTC";

type StoredDiagnosis = PortfolioRecord["diagnoses"][number];
type StoredProgress = StoredDiagnosis["actionProgress"][number];

interface Diagnosis {
  stage: 1 | 2 | 3 | 4;
  completedAt: Date;
  highRisk?: boolean;
  /** The plan stored in the result. */
  plan?: ActionKey[];
  /** The action tracking stored for this diagnosis; the owner and the note are blank unless given. */
  progress?: Array<Pick<StoredProgress, "actionKey" | "status" | "dueDate"> & Partial<StoredProgress>>;
}

let sequence = 0;

function storedResult(highRisk: boolean, plan: ActionKey[]): StoredDiagnosis["result"] {
  const result: Pick<DiagnosisResult, "dimensions" | "risks" | "plan"> = {
    dimensions: {} as DiagnosisResult["dimensions"],
    risks: highRisk ? [{ signalId: "SIG-01", level: "high", score: 16 } as DiagnosisResult["risks"][number]] : [],
    plan,
  };
  return result as unknown as StoredDiagnosis["result"];
}

function company(name: string, diagnoses: Diagnosis[] = [], draftTouchedAt?: Date): PortfolioRecord {
  sequence += 1;
  const completed = diagnoses.map(
    ({ stage, completedAt, highRisk = false, plan = [], progress = [] }): StoredDiagnosis => ({
      id: `diagnosis-${sequence}-${completedAt.getTime()}`,
      status: "completed",
      stage,
      completedAt,
      updatedAt: completedAt,
      result: storedResult(highRisk, plan),
      actionProgress: progress.map((row) => ({ ownerRole: null, note: null, ...row })),
    }),
  );
  const draft: StoredDiagnosis[] =
    draftTouchedAt === undefined
      ? []
      : [
          {
            id: `draft-${sequence}`,
            status: "draft",
            stage: null,
            completedAt: null,
            updatedAt: draftTouchedAt,
            result: null,
            actionProgress: [],
          },
        ];
  // The repository returns the newest completed diagnosis first.
  completed.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));
  return { id: `company-${sequence}`, name, diagnoses: [...draft, ...completed] };
}

const RECORDS: PortfolioRecord[] = [
  // Stage 1, high risk, diagnosed more than 90 days ago: late. Two actions past their deadline; the done one is not.
  company("Zé Burguer", [
    {
      stage: 1,
      completedAt: local(2026, 4, 14),
      highRisk: true,
      plan: ["aq", "en", "re"],
      progress: [
        { actionKey: "aq", status: "todo", dueDate: "2026-09-30" },
        { actionKey: "en", status: "in_progress", dueDate: "2026-10-01" },
        { actionKey: "re", status: "done", dueDate: "2026-08-01" },
      ],
    },
  ]),
  // Stage 3, recent, no risk: on time. The old plan is closed: its late deadline does not count.
  company("Academia Foco", [
    { stage: 1, completedAt: local(2026, 3, 2), plan: ["aq"], progress: [{ actionKey: "aq", status: "todo", dueDate: "2026-03-30" }] },
    { stage: 3, completedAt: local(2026, 10, 1), plan: ["en"] },
  ]),
  // Stage 1, recent, high risk: on time, but with a risk. One action past its deadline; today's is still on time.
  company("Ótica Lume", [
    {
      stage: 1,
      completedAt: local(2026, 9, 1),
      highRisk: true,
      plan: ["pc", "mm", "co"],
      progress: [
        { actionKey: "pc", status: "todo", dueDate: "2026-10-22" },
        { actionKey: "mm", status: "todo", dueDate: "2026-10-23" },
        { actionKey: "co", status: "not_applicable", dueDate: "2026-01-01" },
      ],
    },
  ]),
  // Never diagnosed, with a draft that stalled.
  company("Padaria Nova", [], local(2026, 9, 1)),
  // Stage 4 on the very day it is due: still on time.
  company("Clínica Vida", [{ stage: 4, completedAt: local(2026, 7, 25) }]),
];

const portfolioOf = (records: PortfolioRecord[]): Portfolio => buildPortfolio(records, TODAY);

function documentOf(portfolio: Portfolio, brand?: Parameters<typeof buildPortfolioDocument>[0]["brand"]): ReportDocument {
  return buildPortfolioDocument({ portfolio, generatedAt: TODAY, timeZone: TIME_ZONE, brand });
}

function pageById(document: ReportDocument, id: string): ReportPage {
  const page = document.pages.find((candidate) => candidate.id === id);
  if (page === undefined) {
    throw new Error(`No page "${id}" in ${document.pages.map((candidate) => candidate.id).join(", ")}`);
  }
  return page;
}

function blocksOf<K extends ReportPage["blocks"][number]["kind"]>(
  page: ReportPage,
  kind: K,
): Array<Extract<ReportPage["blocks"][number], { kind: K }>> {
  return page.blocks.filter((block): block is Extract<ReportPage["blocks"][number], { kind: K }> => block.kind === kind);
}

const listPagesOf = (document: ReportDocument): ReportPage[] => document.pages.filter((page) => page.id.startsWith("companies-"));

const tableRowsOf = (document: ReportDocument): string[][] =>
  listPagesOf(document).flatMap((page) => blocksOf(page, "table").flatMap((table: ReportTableBlock) => table.rows));

const factsOf = (page: ReportPage): Record<string, string> =>
  Object.fromEntries(blocksOf(page, "facts").flatMap((block: ReportFactsBlock) => block.items.map((item) => [item.label, item.value])));

describe("the counting the report and the home share", () => {
  const { view, rows } = portfolioOf(RECORDS);

  it("keeps the home view as IF-007 describes it", () => {
    expect(view.mode).toBe("consultant");
    expect(view.companyCount).toBe(5);
    expect(view.byStage.map((group) => [group.stage, group.count])).toEqual([[1, 2], [2, 0], [3, 1], [4, 1]]);
    expect(view.withoutDiagnosis.map((item) => item.name)).toEqual(["Padaria Nova"]);
    expect(view.overdue.map((item) => [item.name, item.daysSince])).toEqual([["Zé Burguer", 192]]);
    expect(view.highRisk.map((item) => item.name)).toEqual(["Ótica Lume", "Zé Burguer"]);
    expect(view.staleDrafts.map((item) => [item.name, item.idleDays])).toEqual([["Padaria Nova", 52]]);
  });

  it("lists every active company once, by stage and then by name, those without a diagnosis last", () => {
    expect(rows.map((row) => [row.name, row.stage])).toEqual([
      ["Ótica Lume", 1],
      ["Zé Burguer", 1],
      ["Academia Foco", 3],
      ["Clínica Vida", 4],
      ["Padaria Nova", null],
    ]);
  });

  it("counts the rows exactly as the lists of the home", () => {
    expect(rows.filter((row) => row.reevaluation?.late).map((row) => row.name)).toEqual(view.overdue.map((item) => item.name));
    expect(rows.filter((row) => row.highRisk).map((row) => row.name).sort()).toEqual(view.highRisk.map((item) => item.name).sort());
    expect(rows.filter((row) => row.stage === null).map((row) => row.name)).toEqual(view.withoutDiagnosis.map((item) => item.name));
    for (const group of view.byStage) {
      expect(rows.filter((row) => row.stage === group.stage).map((row) => row.name).sort()).toEqual(
        group.companies.map((item) => item.name).sort(),
      );
    }
  });

  it("sets the reevaluation at 90 days and is late only after the due day (RULE-ra-07)", () => {
    expect(portfolioOf(RECORDS).reevaluationDays).toBe(90);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row.reevaluation]));

    expect(byName["Clínica Vida"]).toMatchObject({ dueDate: "2026-10-23", daysUntil: 0, late: false });
    expect(byName["Zé Burguer"]).toMatchObject({ dueDate: "2026-07-13", late: true, daysLate: 102 });
    expect(byName["Padaria Nova"]).toBeNull();
  });
});

describe("the portfolio document (AC-ra-15)", () => {
  const portfolio = portfolioOf(RECORDS);
  const document = documentOf(portfolio);

  it("has the cover, the companies by stage, the list of active companies and 'Como ler'", () => {
    expect(document.kind).toBe("portfolio");
    expect(document.title).toBe(PORTFOLIO_REPORT_TITLE);
    expect(document.pages.map((page) => page.id)).toEqual(["cover", "by-stage", "companies-1", "how-to-read"]);
    expect(pageById(document, "by-stage").title).toBe("Empresas por estágio");
    expect(pageById(document, "companies-1").title).toBe("Empresas ativas");
    expect(pageById(document, "how-to-read").title).toBe("Como ler este relatório");
  });

  it("puts the portfolio and the day on the cover, with the FitPulse credit when there is no brand", () => {
    const [cover] = blocksOf(pageById(document, "cover"), "cover");

    expect(cover.title).toBe("Relatório da carteira");
    expect(cover.subject).toBe("Carteira de empresas");
    expect(cover.facts).toEqual([
      { label: "Empresas ativas", value: "5" },
      { label: "Situação em", value: "23/10/2026" },
      { label: "Reavaliação", value: "a cada 90 dias" },
    ]);
    expect(cover.credit).toBe("Gerado com o FitPulse em 23/10/2026");
    expect(document.footer.text).toBe("FitPulse · Carteira de empresas");
  });

  it("shows the same numbers as the home of the consultant", () => {
    const page = pageById(document, "by-stage");
    const [stages] = blocksOf(page, "keyNumbers") as ReportKeyNumbersBlock[];

    expect(stages.items.map((item) => item.value)).toEqual(portfolio.view.byStage.map((group) => String(group.count)));
    expect(stages.items.map((item) => item.label)).toEqual(
      STAGES.map((stage) => `Estágio ${stage.number} · ${stage.name}`),
    );
    expect(factsOf(page)).toEqual({
      "Sem diagnóstico concluído": "1 empresa",
      "Reavaliação atrasada": "1 empresa",
      "Risco alto": "2 empresas",
      "Ações vencidas": "3 ações em 2 empresas",
    });
  });

  it("lists the active companies with stage, last diagnosis, late reevaluation and high risk", () => {
    expect(tableRowsOf(document)).toEqual([
      ["Ótica Lume", "Estágio 1 · 01/09/2026", "Risco alto · 1 ação vencida"],
      ["Zé Burguer", "Estágio 1 · 14/04/2026", "Reavaliação atrasada há 102 dias · Risco alto · 2 ações vencidas"],
      ["Academia Foco", "Estágio 3 · 01/10/2026", "Em dia"],
      ["Clínica Vida", "Estágio 4 · 25/07/2026", "Em dia"],
      ["Padaria Nova", "Sem diagnóstico", "—"],
    ]);
    const [table] = blocksOf(pageById(document, "companies-1"), "table");
    expect(table.columns).toEqual(["Empresa", "Estágio e último diagnóstico", "Atenção"]);
  });

  it("counts the companies in the list like the ones in the stage page", () => {
    const rows = tableRowsOf(document);
    const [stages] = blocksOf(pageById(document, "by-stage"), "keyNumbers");
    const withStage = stages.items.reduce((sum, item) => sum + Number(item.value), 0);

    expect(rows).toHaveLength(portfolio.view.companyCount);
    expect(withStage + portfolio.view.withoutDiagnosis.length).toBe(rows.length);
    expect(rows.filter(([, , attention]) => attention.includes("Reavaliação atrasada"))).toHaveLength(portfolio.view.overdue.length);
    expect(rows.filter(([, , attention]) => attention.includes("Risco alto"))).toHaveLength(portfolio.view.highRisk.length);
  });

  it("prints the guidance warning in the summary and in 'Como ler' (AC-ra-11)", () => {
    for (const id of ["by-stage", "how-to-read"]) {
      const notices = blocksOf(pageById(document, id), "notice") as ReportNoticeBlock[];
      expect(notices.map((notice) => notice.text), id).toContain(GUIDANCE_WARNING);
    }
  });

  it("is the same document for the same portfolio", () => {
    expect(documentOf(portfolioOf(RECORDS))).toEqual(document);
  });

  it("names the deliverer on the cover and in the footer", () => {
    const branded = documentOf(portfolio, { name: "Consultoria Norte", phone: "(11) 91234-5678" });
    const [cover] = blocksOf(pageById(branded, "cover"), "cover");

    expect(branded.subject).toBe("Carteira de Consultoria Norte");
    expect(branded.footer.text).toBe("Consultoria Norte · Carteira de empresas");
    expect(cover.credit).toBe("Preparado por Consultoria Norte com o FitPulse em 23/10/2026");
    expect(cover.contactLine).toBe("(11) 91234-5678");
  });
});

describe("the overdue actions (RULE-ra-06) appear only once the actions are tracked", () => {
  const tracked = (counts: Array<number | null>): Portfolio => {
    const base = portfolioOf(RECORDS);
    return { ...base, rows: base.rows.map((row, index) => ({ ...row, overdueActions: counts[index] ?? null })) };
  };

  it("leaves them out while no company has the count: not in the summary, not in the list", () => {
    const base = portfolioOf(RECORDS);
    const untracked: Portfolio = { ...base, rows: base.rows.map((row) => ({ ...row, overdueActions: null })) };
    const document = documentOf(untracked);

    expect(Object.keys(factsOf(pageById(document, "by-stage")))).not.toContain("Ações vencidas");
    expect(tableRowsOf(document).map(([, , attention]) => attention).join("|")).not.toMatch(/vencida/);
  });

  it("adds them to the summary and to each company once the count exists", () => {
    // Rows: Ótica Lume, Zé Burguer, Academia Foco, Clínica Vida, Padaria Nova.
    const document = documentOf(tracked([1, 2, 0, 0, null]));

    expect(factsOf(pageById(document, "by-stage"))["Ações vencidas"]).toBe("3 ações em 2 empresas");
    expect(tableRowsOf(document).map(([name, , attention]) => [name, attention])).toEqual([
      ["Ótica Lume", "Risco alto · 1 ação vencida"],
      ["Zé Burguer", "Reavaliação atrasada há 102 dias · Risco alto · 2 ações vencidas"],
      ["Academia Foco", "Em dia"],
      ["Clínica Vida", "Em dia"],
      ["Padaria Nova", "—"],
    ]);
  });

  it("says none when the actions are tracked and no one is overdue", () => {
    const document = documentOf(tracked([0, 0, 0, 0, 0]));

    expect(factsOf(pageById(document, "by-stage"))["Ações vencidas"]).toBe("Nenhuma");
  });
});

describe("an empty portfolio", () => {
  it("has no list page and zeros on the summary", () => {
    const document = documentOf(portfolioOf([]));

    expect(document.pages.map((page) => page.id)).toEqual(["cover", "by-stage", "how-to-read"]);
    expect((blocksOf(pageById(document, "by-stage"), "keyNumbers")[0] as ReportKeyNumbersBlock).items.map((item) => item.value)).toEqual([
      "0",
      "0",
      "0",
      "0",
    ]);
  });
});

describe("pagination of the list", () => {
  // The widest case: the longest name in capitals and every note of attention at once.
  const wideName = (index: number): string => `${String(index).padStart(3, "0")} ${"MMMMMMMM ".repeat(8)}`.trim().slice(0, 80);
  // `flagged` companies are late and at high risk; the others are on time with nothing to say in "Atenção".
  const manyCompanies = (count: number, name: (index: number) => string, flagged = true): PortfolioRecord[] =>
    Array.from({ length: count }, (_, index) =>
      company(name(index), [
        {
          stage: ((index % 4) + 1) as 1 | 2 | 3 | 4,
          completedAt: flagged ? local(2025, 11, 1) : local(2026, 10, 1),
          highRisk: flagged,
        },
      ]),
    );

  it("keeps a short list on one page", () => {
    const document = documentOf(portfolioOf(manyCompanies(8, (index) => `Empresa ${index}`)));

    expect(listPagesOf(document).map((page) => page.title)).toEqual(["Empresas ativas"]);
  });

  it("cuts a long list into numbered pages that keep the order and lose no company", () => {
    const portfolio = portfolioOf(manyCompanies(120, (index) => `Empresa ${String(index).padStart(3, "0")}`));
    const document = documentOf(portfolio);
    const pages = listPagesOf(document);

    expect(pages.length).toBeGreaterThan(1);
    expect(pages.map((page) => page.title)).toEqual(pages.map((_, index) => `Empresas ativas (${index + 1} de ${pages.length})`));
    expect(pages.map((page) => page.id)).toEqual(pages.map((_, index) => `companies-${index + 1}`));
    expect(tableRowsOf(document).map(([name]) => name)).toEqual(portfolio.rows.map((row) => row.name));
    for (const page of pages) {
      expect((blocksOf(page, "table")[0] as ReportTableBlock).rows.length).toBeGreaterThan(0);
    }
  });

  it("keeps the summary at the same numbers however many pages the list takes", () => {
    const portfolio = portfolioOf(manyCompanies(120, (index) => `Empresa ${index}`));
    const [stages] = blocksOf(pageById(documentOf(portfolio), "by-stage"), "keyNumbers");

    expect(stages.items.map((item) => item.value)).toEqual(["30", "30", "30", "30"]);
  });

  it.each([
    ["a few companies", 3, (index: number) => `Empresa ${index}`, true],
    ["40 companies with ordinary names", 40, (index: number) => `Empresa Número ${index} Ltda`, true],
    ["120 companies with the widest names, every note of attention and the actions", 120, wideName, true],
    ["120 companies with the widest names and nothing to flag", 120, wideName, false],
    ["120 companies with the longest names in one unbroken word", 120, (index: number) => `${index}`.padEnd(80, "W"), false],
  ])("draws every page inside one A4 sheet, with %s", async (_label, count, name, flagged) => {
    const base = portfolioOf(manyCompanies(count, name, flagged));
    const portfolio: Portfolio = { ...base, rows: base.rows.map((row) => ({ ...row, overdueActions: flagged ? 12 : null })) };
    const document = documentOf(portfolio, { name: "Consultoria Norte e Associados", phone: "(11) 91234-5678" });

    const pdf = await renderReportPdf(document);

    const { totalPages, text } = await extractText(new Uint8Array(pdf), { mergePages: false });
    expect(totalPages).toBe(document.pages.length);
    expect(text[1]).toContain("Empresas por estágio");
    expect(text.at(-1)).toContain(GUIDANCE_WARNING);
  }, 60_000);

  it("prints the company names and the reevaluation words in the PDF", async () => {
    const pdf = await renderReportPdf(documentOf(portfolioOf(RECORDS)));

    const { text } = await extractText(new Uint8Array(pdf), { mergePages: false });
    // The cells wrap inside their columns, so the words are compared without the line breaks.
    const list = text[2].replace(/\s+/g, " ");
    expect(list).toContain("Zé Burguer");
    expect(list).toContain("Reavaliação atrasada há 102 dias · Risco alto");
    expect(list).toContain("Risco alto");
    expect(list).toContain("Padaria Nova");
  });
});

describe("the overdue actions are counted on the current plan only (RULE-ra-06, AC-ra-15)", () => {
  const overdueOf = (records: PortfolioRecord[], at: Date = TODAY): Array<number | null> =>
    buildPortfolio(records, at).rows.map((row) => row.overdueActions);

  const one = (diagnosis: Partial<Diagnosis>): PortfolioRecord =>
    company("Empresa", [{ stage: 2, completedAt: local(2026, 9, 1), plan: ["aq", "en", "re"], ...diagnosis }]);

  it("counts the actions open and past their deadline, once each", () => {
    const record = one({
      progress: [
        { actionKey: "aq", status: "todo", dueDate: "2026-10-01" },
        { actionKey: "en", status: "in_progress", dueDate: "2026-10-22" },
        { actionKey: "re", status: "todo", dueDate: "2026-09-01" },
      ],
    });

    expect(overdueOf([record])).toEqual([3]);
  });

  it("does not count an action done, not applicable, without a deadline, due today or later", () => {
    const record = one({
      progress: [
        { actionKey: "aq", status: "done", dueDate: "2026-09-01" },
        { actionKey: "en", status: "not_applicable", dueDate: "2026-09-01" },
        { actionKey: "re", status: "todo", dueDate: null },
      ],
    });
    const withDeadlines = one({
      progress: [
        { actionKey: "aq", status: "todo", dueDate: "2026-10-23" },
        { actionKey: "en", status: "in_progress", dueDate: "2026-12-31" },
      ],
    });

    expect(overdueOf([record, withDeadlines])).toEqual([0, 0]);
  });

  it("turns an action overdue at the change of the local day, not after 24 hours", () => {
    const record = one({ progress: [{ actionKey: "aq", status: "todo", dueDate: "2026-10-23" }] });

    expect(overdueOf([record], local(2026, 10, 23, 23))).toEqual([0]);
    expect(overdueOf([record], local(2026, 10, 24, 0))).toEqual([1]);
  });

  it("ignores the rows of an older plan and of an action outside the plan", () => {
    const older = company("Empresa", [
      { stage: 1, completedAt: local(2026, 3, 2), plan: ["aq", "en", "re"], progress: [{ actionKey: "aq", status: "todo", dueDate: "2026-03-30" }] },
      {
        stage: 2,
        completedAt: local(2026, 9, 1),
        plan: ["en", "re"],
        progress: [
          { actionKey: "aq", status: "todo", dueDate: "2026-09-10" },
          { actionKey: "en", status: "todo", dueDate: "2026-02-31" },
          { actionKey: "re", status: "done", dueDate: null },
        ],
      },
    ]);

    expect(overdueOf([older])).toEqual([0]);
  });

  it("has no count while nothing was recorded: the rows born with the diagnosis are not tracking yet", () => {
    const untouched = one({});
    const bornWithTheDiagnosis = one({
      progress: ["aq", "en", "re"].map((actionKey) => ({ actionKey: actionKey as ActionKey, status: "todo", dueDate: null })),
    });
    const recorded = (change: Partial<StoredProgress>) => one({ progress: [{ actionKey: "aq", status: "todo", dueDate: null, ...change }] });

    expect(overdueOf([untouched, bornWithTheDiagnosis])).toEqual([null, null]);
    // Any record makes it tracked: a state, a deadline, an owner or a note. Without a late deadline it is zero.
    expect(overdueOf([recorded({ status: "in_progress" }), recorded({ dueDate: "2026-12-01" })])).toEqual([0, 0]);
    expect(overdueOf([recorded({ ownerRole: "owner" }), recorded({ note: "Ligar para os clientes" })])).toEqual([0, 0]);
  });

  it("has no count without a diagnosis or without the tracking read", () => {
    const neverDiagnosed = company("Padaria Nova", [], local(2026, 9, 1));
    const withoutTracking = {
      ...one({}),
      diagnoses: one({}).diagnoses.map(({ actionProgress: _read, ...rest }) => rest),
    } as unknown as PortfolioRecord;

    expect(overdueOf([neverDiagnosed, withoutTracking])).toEqual([null, null]);
  });
});

describe("the portfolio read from the database", () => {
  let db: TestDatabase;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
  });

  async function diagnose(
    companyId: string,
    completedAt: string,
    plan: string[],
    options: { archivedAt?: Date } = {},
  ): Promise<string> {
    const created = await db.prisma.diagnosis.create({
      data: {
        companyId,
        status: "completed",
        answers: {},
        calculator: {},
        rulesVersion: 1,
        result: { dimensions: {}, risks: [], plan } as unknown as object,
        stage: 2,
        completedAt: new Date(completedAt),
        archivedAt: options.archivedAt ?? null,
      },
    });
    return created.id;
  }

  const track = (diagnosisId: string, actionKey: string, status: string, dueDate: string | null) =>
    db.prisma.actionProgress.create({ data: { diagnosisId, actionKey, status, dueDate } });

  const createCompany = async (name: string, archivedAt: Date | null = null) =>
    (await db.prisma.company.create({ data: { name, segment: "health_wellness", salesChannel: "subscription", archivedAt } })).id;

  it("counts the overdue actions of the current plan of each active company and of no other", async () => {
    const foco = await createCompany("Academia Foco");
    const oldPlan = await diagnose(foco, "2026-05-01T12:00:00.000Z", ["aq", "en", "re"]);
    await track(oldPlan, "aq", "todo", "2026-06-01");
    const currentPlan = await diagnose(foco, "2026-09-01T12:00:00.000Z", ["aq", "en", "re"]);
    await track(currentPlan, "aq", "in_progress", "2026-10-01");
    await track(currentPlan, "en", "done", "2026-09-15");
    await track(currentPlan, "re", "todo", "2027-01-15");
    const norte = await createCompany("Studio Norte");
    const norteCurrent = await diagnose(norte, "2026-09-10T12:00:00.000Z", ["pc", "mm", "co"]);
    await track(norteCurrent, "pc", "todo", "2026-10-02");
    await track(norteCurrent, "mm", "todo", "2026-10-03");
    // The newest diagnosis is archived: the plan before it is the current one again.
    const lume = await createCompany("Ótica Lume");
    const lumePlan = await diagnose(lume, "2026-08-01T12:00:00.000Z", ["aq"]);
    await track(lumePlan, "aq", "todo", "2026-09-20");
    const archived = await diagnose(lume, "2026-10-01T12:00:00.000Z", ["en"], { archivedAt: new Date("2026-10-02T12:00:00.000Z") });
    await track(archived, "en", "todo", "2026-09-20");
    // Rows born with the diagnosis, nothing recorded yet: no count.
    const nova = await createCompany("Clínica Nova");
    const novaPlan = await diagnose(nova, "2026-09-20T12:00:00.000Z", ["aq", "en", "re"]);
    for (const actionKey of ["aq", "en", "re"]) await track(novaPlan, actionKey, "todo", null);
    // An archived company appears nowhere.
    const closed = await createCompany("Clínica Antiga", new Date("2026-09-01T12:00:00.000Z"));
    const closedPlan = await diagnose(closed, "2026-08-01T12:00:00.000Z", ["aq"]);
    await track(closedPlan, "aq", "todo", "2026-09-01");

    const portfolio = await createPortfolioService({ prisma: db.prisma, now: db.now }).read();

    expect(Object.fromEntries(portfolio.rows.map((row) => [row.name, row.overdueActions]))).toEqual({
      "Academia Foco": 1,
      "Clínica Nova": null,
      "Studio Norte": 2,
      "Ótica Lume": 1,
    });
  });

  it("puts the same overdue actions in the PDF of the portfolio", async () => {
    const foco = await createCompany("Academia Foco");
    const plan = await diagnose(foco, "2026-09-01T12:00:00.000Z", ["aq", "en", "re"]);
    await track(plan, "aq", "todo", "2026-10-01");
    await track(plan, "en", "todo", "2026-10-02");
    await createCompany("Studio Norte");

    const document = await createReportService({ prisma: db.prisma, downloadsDir: db.downloadsDir, now: db.now }).preview({
      kind: "portfolio",
    });

    expect(factsOf(pageById(document, "by-stage"))["Ações vencidas"]).toBe("2 ações em 1 empresa");
    expect(tableRowsOf(document).map(([name, , attention]) => [name, attention])).toEqual([
      ["Academia Foco", "2 ações vencidas"],
      ["Studio Norte", "—"],
    ]);
  });
});
