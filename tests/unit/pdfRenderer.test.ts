import { inflateSync } from "node:zlib";
import { extractText } from "unpdf";
import { describe, expect, it } from "vitest";
import { ACTION_CATALOG } from "../../shared/content/actionCatalog.ts";
import { QUESTION_BANK } from "../../shared/content/questionBank.ts";
import { RISK_CATALOG } from "../../shared/content/riskCatalog.ts";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis.ts";
import {
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type DiagnosisInput,
} from "../../shared/domain/types.ts";
import type {
  ReportBlock,
  ReportDocument,
  ReportKind,
  ReportPage,
  ReportRiskItem,
  ReportRiskListBlock,
  ReportRiskMatrixBlock,
} from "../../shared/report/reportDocument.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { GUIDANCE_WARNING, NO_RISKS_FOUND, RISK_COPY } from "../../server/report/reportCopy.ts";
import { buildCoverPage, buildFooter, buildHowToReadPage, resolveBrand, type ReportBrandInput } from "../../server/report/documentParts.ts";
import { PageOverflowError, renderReportPdf } from "../../server/report/pdfRenderer.ts";
import { buildDiagnosisDocument, type DiagnosisDocumentInput, type ReportActionProgress } from "../../server/report/reportModel.ts";

// AC-ra-06: the executive summary takes exactly one sheet and the next sheet opens on the dimensions.
// AC-ra-07: the eight bars, grouped, each with its score in words and the line of 50.
// AC-ra-08: the 5×5 matrix with the numbered risks and, beside it, the list; or the "no risk" line.
// Also: one A4 sheet per page of the document, the footer "Página N de M", and the overflow error.

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// Stage 1, locked by the customer cost, two risks.
const WITH_RISKS: DiagnosisInput = {
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
  } satisfies CalculatorInput,
};

// Stage 4, no lock, no risk.
const WITHOUT_RISKS: DiagnosisInput = {
  answers: answersOf(3, { pc1: 2 }),
  calculator: {
    ...EMPTY_CALCULATOR,
    spendMode: "exact",
    spendParts: { ads: 3_000_000 },
    newCustomersMode: "exact",
    newCustomers: 100,
    averagePurchaseCents: 20_000,
    purchasesPerYear: "fourToSix",
    relationshipLength: "twoToFourYears",
    marginPercent: 50,
  } satisfies CalculatorInput,
};

function documentOf(input: DiagnosisInput, options: Partial<DiagnosisDocumentInput> = {}): ReportDocument {
  return buildDiagnosisDocument({
    companyName: "Academia Foco",
    completedAt: new Date("2026-10-20T15:00:00.000Z"),
    generatedAt: new Date("2026-10-25T12:00:00.000Z"),
    result: evaluateDiagnosis(input, rulesV1),
    timeZone: "UTC",
    ...options,
  });
}

const squash = (text: string): string => text.replace(/\s+/g, " ").trim();

/** The text of each sheet of the PDF, in order, read back the way a reader would. */
async function sheetsOf(pdf: Buffer): Promise<string[]> {
  const { totalPages, text } = await extractText(new Uint8Array(pdf), { mergePages: false });
  expect(text).toHaveLength(totalPages);
  return text.map(squash);
}

function pageIndex(document: ReportDocument, id: string): number {
  const index = document.pages.findIndex((page) => page.id === id);
  if (index < 0) throw new Error(`No page ${id}`);
  return index;
}

function blockOf<Kind extends ReportBlock["kind"]>(page: ReportPage, kind: Kind): Extract<ReportBlock, { kind: Kind }> {
  const block = page.blocks.find((candidate): candidate is Extract<ReportBlock, { kind: Kind }> => candidate.kind === kind);
  if (block === undefined) throw new Error(`No ${kind} block in ${page.id}`);
  return block;
}

function progressOf(input: DiagnosisInput): ReportActionProgress[] {
  const [first, second] = evaluateDiagnosis(input, rulesV1).plan;
  return [
    { actionKey: first, status: "doing", dueDate: "30/11/2026", owner: "Dono", note: "Ligar para os clientes antigos", overdue: false },
    { actionKey: second, status: "todo", dueDate: "01/10/2026", owner: "Consultor", note: null, overdue: true },
  ];
}

// The longest answer option of each question: the worst case for a page of the appendix.
function longestAnswers(): DiagnosisInput {
  const answers: Answers = {};
  for (const question of QUESTION_BANK) {
    const longest = question.options.reduce((best, option, index) => (option.label.length > question.options[best].label.length ? index : best), 0);
    answers[question.id] = longest as AnchorValue;
  }
  return { answers, calculator: WITH_RISKS.calculator };
}

// The five longest risks of the catalog (rulesV1.risk.maxRisks): the worst case for the risks page.
function withLongestRisks(document: ReportDocument): ReportDocument {
  const longest = [...RISK_CATALOG]
    .sort((a, b) => b.title.length + b.cause.length + b.howToReduce.length - (a.title.length + a.cause.length + a.howToReduce.length))
    .slice(0, rulesV1.risk.maxRisks);
  const copy = structuredClone(document);
  const page = copy.pages[pageIndex(copy, "risks")];
  const matrix: ReportRiskMatrixBlock = blockOf(page, "riskMatrix");
  const list: ReportRiskListBlock = {
    kind: "riskList",
    items: longest.map(
      (info, index): ReportRiskItem => ({
        number: index + 1,
        level: "high",
        title: info.title,
        levelLabel: "Alto",
        scoreLine: RISK_COPY.scoreLine(5, 5, 25),
        cause: info.cause,
        howToReduce: RISK_COPY.howToReduce(info.howToReduce),
      }),
    ),
  };
  matrix.marks = longest.map((_, index) => ({ number: index + 1, probability: 5, impact: 5, level: "high" as const }));
  page.blocks = [page.blocks[0], matrix, list];
  return copy;
}

describe("renderReportPdf: one sheet per page of the document", () => {
  it("draws exactly the pages of the document, with 'Página N de M' in the footer", async () => {
    const document = documentOf(WITH_RISKS, { actionProgress: progressOf(WITH_RISKS) });
    const sheets = await sheetsOf(await renderReportPdf(document));
    expect(sheets).toHaveLength(document.pages.length);
    sheets.forEach((text, index) => {
      expect(text, `sheet ${index + 1}`).toContain(`Página ${index + 1} de ${document.pages.length}`);
      expect(text, `sheet ${index + 1}`).toContain(document.footer.text);
    });
  });

  it("opens with the cover: brand, title, company and the facts", async () => {
    const document = documentOf(WITH_RISKS, { brand: { name: "Consultoria Prumo", email: "oi@prumo.example" } });
    const [cover] = await sheetsOf(await renderReportPdf(document));
    expect(cover).toContain("Consultoria Prumo");
    expect(cover).toContain(document.title);
    expect(cover).toContain("Academia Foco");
    for (const fact of blockOf(document.pages[0], "cover").facts) {
      expect(cover).toContain(squash(fact.label));
      expect(cover).toContain(squash(fact.value));
    }
    expect(cover).toContain("oi@prumo.example");
    expect(cover).toContain("Preparado por Consultoria Prumo com o FitPulse em 25/10/2026");
  });

  it("keeps drawing when the logo cannot be read, and with a logo it still draws every page", async () => {
    const pixel =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    for (const logoDataUrl of [pixel, "data:image/png;base64,AAAA"]) {
      const document = documentOf(WITH_RISKS, { brand: { name: "Prumo", logoDataUrl } });
      const sheets = await sheetsOf(await renderReportPdf(document));
      expect(sheets).toHaveLength(document.pages.length);
      expect(sheets[0]).toContain("Prumo");
    }
  });

  it("embeds its fonts and never the default Helvetica", async () => {
    const pdf = (await renderReportPdf(documentOf(WITH_RISKS))).toString("latin1");
    expect(pdf).not.toContain("Helvetica");
    expect(pdf).toMatch(/\/FontName\s*\/[A-Z]{6}\+Inter/);
  });

  it("does not print the claim that the stage is capped by the weakest dimension", async () => {
    for (const input of [WITH_RISKS, WITHOUT_RISKS]) {
      const text = (await sheetsOf(await renderReportPdf(documentOf(input)))).join(" ");
      expect(text).not.toMatch(/limitado pela dimens[ãa]o mais fraca/i);
      expect(text).not.toMatch(/dimens[ãa]o mais fraca/i);
    }
  });
});

describe("renderReportPdf: the executive summary takes one sheet (AC-ra-06)", () => {
  it("holds the stage, the lock, the three actions and the key numbers on one sheet", async () => {
    const document = documentOf(WITH_RISKS);
    const sheets = await sheetsOf(await renderReportPdf(document));
    const index = pageIndex(document, "executive-summary");
    const summary = sheets[index];
    const page = document.pages[index];

    expect(summary).toContain("Resumo executivo");
    expect(summary).toContain("Estágio 1 de 4");
    const stage = blockOf(page, "stage");
    expect(summary).toContain(stage.name);
    expect(summary).toContain(squash(blockOf(page, "facts").items[0].label));
    expect(summary).toContain(squash(blockOf(page, "facts").items[0].value));
    for (const action of blockOf(page, "actions").items) {
      expect(summary).toContain(squash(action.title));
      expect(summary).toContain(squash(action.details[1]));
    }
    for (const number of blockOf(page, "keyNumbers").items) {
      expect(summary).toContain(number.label);
      expect(summary).toContain(squash(number.value));
    }
    expect(summary).toContain(GUIDANCE_WARNING);
  });

  it("starts the next sheet on the dimensions, and repeats nothing of the summary there", async () => {
    const document = documentOf(WITH_RISKS);
    const sheets = await sheetsOf(await renderReportPdf(document));
    const index = pageIndex(document, "executive-summary");
    expect(sheets[index + 1]).toMatch(/^Notas das 8 dimensões/);
    expect(sheets[index]).not.toContain("Notas das 8 dimensões");
    for (const action of blockOf(document.pages[index], "actions").items) {
      expect(sheets[index + 1]).not.toContain(squash(action.title));
    }
  });

  it("still fits one sheet with the three longest actions, all tracked, and the longest risk title", async () => {
    const document = structuredClone(documentOf(WITH_RISKS, { actionProgress: progressOf(WITH_RISKS) }));
    const index = pageIndex(document, "executive-summary");
    const page = document.pages[index];
    const longest = Object.values(ACTION_CATALOG)
      .sort((a, b) => b.title.length + b.reason.length + b.howTo.length - (a.title.length + a.reason.length + a.howTo.length))
      .slice(0, 3);
    blockOf(page, "actions").items = longest.map((info, position) => ({
      position: position + 1,
      title: info.title,
      details: [info.reason, `Como fazer: ${info.howTo}`],
      tag: { label: "A fazer · vencida", tone: "bad" as const },
    }));
    const longestRisk = [...RISK_CATALOG].sort((a, b) => b.title.length - a.title.length)[0];
    const riskLine = page.blocks.find((block) => block.kind === "paragraph" && block.text.startsWith("Risco mais alto"));
    if (riskLine?.kind === "paragraph") riskLine.text = `Risco mais alto: ${longestRisk.title} (Alto · 25)`;

    const sheets = await sheetsOf(await renderReportPdf(document));
    expect(sheets).toHaveLength(document.pages.length);
    expect(sheets[index]).toContain(squash(longest[0].title));
    expect(sheets[index]).toContain(GUIDANCE_WARNING);
    expect(sheets[index + 1]).toMatch(/^Notas das 8 dimensões/);
  });
});

describe("renderReportPdf: the dimension bars (AC-ra-07)", () => {
  it("prints both groups, and every bar with its score in words, what it would support and the line of 50", async () => {
    const document = documentOf(WITH_RISKS);
    const index = pageIndex(document, "dimensions");
    const sheet = (await sheetsOf(await renderReportPdf(document)))[index];
    const bars = blockOf(document.pages[index], "dimensionBars");

    expect(bars.threshold).toBe(50);
    expect(bars.groups.map((group) => group.label)).toEqual(["Encaixes do negócio", "Frentes de crescimento"]);
    for (const group of bars.groups) {
      expect(sheet).toContain(group.label);
      for (const bar of group.bars) {
        expect(sheet, bar.name).toContain(bar.name);
        expect(sheet, bar.name).toContain(bar.scoreText);
        expect(sheet, bar.name).toContain(bar.supportsText);
      }
    }
    expect(bars.groups.flatMap((group) => group.bars)).toHaveLength(8);
    // The dashed line is labelled on every bar: eight "50" plus the ones of the intro and the alerts.
    expect(sheet.split(/\b50\b/).length - 1).toBeGreaterThanOrEqual(8);
  });

  it("says 'abaixo de 50' in words on each bar under the line, so no bar depends on its color", async () => {
    const document = documentOf(WITH_RISKS);
    const index = pageIndex(document, "dimensions");
    const sheet = (await sheetsOf(await renderReportPdf(document)))[index];
    const bars = blockOf(document.pages[index], "dimensionBars").groups.flatMap((group) => group.bars);
    const alerts = bars.filter((bar) => bar.alertText !== null);
    expect(alerts.length).toBeGreaterThan(0);
    expect(sheet.split("abaixo de 50").length - 1).toBe(alerts.length);
    // The page does not say which dimension caps the stage (RULE-dm-04).
    expect(sheet).not.toMatch(/dimens[ãa]o mais fraca/i);
  });

  it("draws the bars of a company with every score under 50 on the same sheet", async () => {
    const document = structuredClone(documentOf(WITH_RISKS));
    const index = pageIndex(document, "dimensions");
    const bars = blockOf(document.pages[index], "dimensionBars");
    for (const bar of bars.groups.flatMap((group) => group.bars)) {
      bar.score = 0;
      bar.scoreText = "0 de 100";
      bar.alertText = "abaixo de 50";
    }
    const sheets = await sheetsOf(await renderReportPdf(document));
    expect(sheets).toHaveLength(document.pages.length);
    expect(sheets[index].split("abaixo de 50").length - 1).toBe(8);
  });
});

describe("renderReportPdf: the risks page (AC-ra-08)", () => {
  it("draws the matrix and, beside it, each risk with title, P × I, level and 'Como reduzir:'", async () => {
    const document = documentOf(WITH_RISKS);
    const index = pageIndex(document, "risks");
    const sheet = (await sheetsOf(await renderReportPdf(document)))[index];
    const page = document.pages[index];
    const matrix = blockOf(page, "riskMatrix");
    const list = blockOf(page, "riskList");

    expect(matrix.size).toBe(5);
    expect(list.items.length).toBeGreaterThan(0);
    expect(sheet).toContain(matrix.axesLabel);
    for (const entry of matrix.legend) {
      expect(sheet).toContain(`${entry.label} · nota ${entry.range}`);
    }
    for (const item of list.items) {
      expect(sheet, item.title).toContain(squash(item.title));
      expect(sheet, item.title).toContain(item.scoreLine);
      expect(sheet, item.title).toContain(item.levelLabel);
      expect(sheet, item.title).toContain(squash(item.howToReduce));
      expect(sheet, item.title).toContain("Como reduzir:");
    }
    expect(sheet).not.toContain(NO_RISKS_FOUND);
  });

  it("says 'Nenhum risco encontrado nas respostas' when there is no risk", async () => {
    const document = documentOf(WITHOUT_RISKS);
    const index = pageIndex(document, "risks");
    const sheet = (await sheetsOf(await renderReportPdf(document)))[index];
    expect(sheet).toContain("Nenhum risco encontrado nas respostas");
    expect(sheet).not.toContain("Como reduzir:");
  });

  it("fits the five longest risks of the catalog on one sheet, the matrix and the list side by side", async () => {
    const document = withLongestRisks(documentOf(WITH_RISKS));
    const index = pageIndex(document, "risks");
    const sheets = await sheetsOf(await renderReportPdf(document));
    expect(sheets).toHaveLength(document.pages.length);
    expect(sheets[index].split("Como reduzir:").length - 1).toBe(rulesV1.risk.maxRisks);
    expect(sheets[index + 1]).toMatch(/^Seus números/);
  });
});

describe("renderReportPdf: the other pages", () => {
  it("fits 'Como ler este relatório' and the numbers on one sheet each, with the guidance warning", async () => {
    const document = documentOf(WITH_RISKS);
    const sheets = await sheetsOf(await renderReportPdf(document));
    const howToRead = sheets[pageIndex(document, "how-to-read")];
    expect(howToRead).toMatch(/^Como ler este relatório/);
    expect(howToRead).toContain(GUIDANCE_WARNING);
    expect(sheets[pageIndex(document, "numbers")]).toMatch(/^Seus números/);
  });

  it("draws the action tracking and the answers appendix page by page, each on one sheet", async () => {
    const input = longestAnswers();
    const document = documentOf(input, { actionProgress: progressOf(input), includeAnswers: true, diagnosisInput: input });
    const sheets = await sheetsOf(await renderReportPdf(document));
    expect(sheets).toHaveLength(document.pages.length);
    const tracking = sheets[pageIndex(document, "action-progress")];
    expect(tracking).toContain("Em andamento");
    expect(tracking).toContain("Prazo 30/11/2026");
    expect(sheets[pageIndex(document, "answers-numbers")]).toContain("Respostas do questionário");
    expect(sheets.at(-1)).toContain(`Página ${sheets.length} de ${sheets.length}`);
  });

  it("leaves the answers and the typed values out of the file when the option is off", async () => {
    const withoutAnswers = (await sheetsOf(await renderReportPdf(documentOf(WITH_RISKS)))).join(" ");
    expect(withoutAnswers).not.toContain("Respostas do questionário");
    expect(withoutAnswers).not.toMatch(/Gasto: |Margem|R\$ 45,00/);
  });
});

describe("renderReportPdf: a page that does not fit", () => {
  it("rejects with a PageOverflowError naming the page, never spilling onto a second sheet", async () => {
    const document = structuredClone(documentOf(WITH_RISKS));
    const page = document.pages[pageIndex(document, "numbers")];
    page.blocks = Array.from({ length: 40 }, (_, index): ReportBlock => ({ kind: "paragraph", text: `Parágrafo longo ${index} `.repeat(30) }));
    await expect(renderReportPdf(document)).rejects.toThrow(PageOverflowError);
    await expect(renderReportPdf(document)).rejects.toThrow(/Page "numbers" does not fit one A4 sheet/);
  });
});

// AC-ra-22: with the brand filled in, the cover and the footer of the three reports show the name, the logo and
// the contact; with everything blank they show FitPulse; the colors of the PDF are always FitPulse's.

const ONE_PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function uint16(value: number): number[] {
  return [Math.floor(value / 0x100) % 0x100, value % 0x100];
}

// The segments pdfkit reads to place a JPEG: JFIF, the frame header with the size and a scan.
const JPEG_LOGO = `data:image/jpeg;base64,${Buffer.from([
  0xff, 0xd8,
  0xff, 0xe0, ...uint16(16), 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xc0, ...uint16(11), 0x08, ...uint16(40), ...uint16(120), 0x01, 0x01, 0x11, 0x00,
  0xff, 0xda, ...uint16(8), 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0xff, 0xd9,
]).toString("base64")}`;

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  // pdfkit does not check the checksum, so the chunks carry none.
  return Buffer.concat([length, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
}

// A PNG with RGBA pixels whose data is no zlib stream: pdfkit would throw out of its own callback and take the process down.
const CORRUPT_RGBA_LOGO = `data:image/png;base64,${Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk("IHDR", Buffer.from([0, 0, 0, 4, 0, 0, 0, 4, 8, 6, 0, 0, 0])),
  pngChunk("IDAT", Buffer.from("this is not a zlib stream")),
  pngChunk("IEND", Buffer.alloc(0)),
]).toString("base64")}`;

const PRUMO: ReportBrandInput = {
  name: "Consultoria Prumo",
  phone: "(11) 91234-5678",
  email: "ola@prumo.com.br",
  site: "prumo.com.br",
};
const PRUMO_CONTACT = "(11) 91234-5678 · ola@prumo.com.br · prumo.com.br";

const KIND_LABELS: Record<ReportKind, { title: string; footer: string }> = {
  diagnosis: { title: "Relatório do diagnóstico de maturidade", footer: "Diagnóstico de maturidade" },
  evolution: { title: "Relatório de evolução", footer: "Evolução" },
  portfolio: { title: "Relatório da carteira", footer: "Carteira" },
};

// The three reports share the cover, the footer and "Como ler" (documentParts). The diagnosis is the real
// one; the other two are the smallest documents built from those same parts.
function reportOf(kind: ReportKind, brandInput?: ReportBrandInput): ReportDocument {
  if (kind === "diagnosis") {
    return documentOf(WITH_RISKS, { brand: brandInput });
  }
  const brand = resolveBrand(brandInput);
  const { title, footer } = KIND_LABELS[kind];
  return {
    kind,
    title,
    subject: "Academia Foco",
    footer: buildFooter(brand, footer),
    pages: [
      buildCoverPage({
        brand,
        title,
        subject: "Academia Foco",
        facts: [{ label: "Data", value: "25/10/2026" }],
        generatedOn: "25/10/2026",
      }),
      buildHowToReadPage(),
    ],
  };
}

const imageCount = (pdf: Buffer): number => pdf.toString("latin1").split("/Subtype /Image").length - 1;

/** Every fill and stroke color the pages set, read from the compressed content streams. */
function colorsOf(pdf: Buffer): Set<string> {
  const colors = new Set<string>();
  for (const [, stream] of pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(stream, "latin1")).toString("latin1");
    } catch {
      continue;
    }
    // pdfkit sets the color of the text and of the shapes with scn / SCN after choosing /DeviceRGB.
    for (const [, color, operator] of content.matchAll(/(-?[\d.]+ -?[\d.]+ -?[\d.]+) (scn|SCN|sc|SC|rg|RG)\b/g)) {
      colors.add(`${color} ${operator}`);
    }
  }
  return colors;
}

describe.each<ReportKind>(["diagnosis", "evolution", "portfolio"])("renderReportPdf: the brand on the %s report (AC-ra-22)", (kind) => {
  it("shows the name, the logo and the contact on the cover, and the name and the contact in the footer of every sheet", async () => {
    for (const logoDataUrl of [ONE_PIXEL_PNG, JPEG_LOGO]) {
      const document = reportOf(kind, { ...PRUMO, logoDataUrl });
      const pdf = await renderReportPdf(document);
      const sheets = await sheetsOf(pdf);

      expect(sheets).toHaveLength(document.pages.length);
      expect(sheets[0]).toContain("Consultoria Prumo");
      expect(sheets[0]).toContain(PRUMO_CONTACT);
      expect(sheets[0]).toContain("Preparado por Consultoria Prumo com o FitPulse em 25/10/2026");
      // a PNG with transparency takes two image objects (the picture and its mask), a JPEG one
      expect(imageCount(pdf)).toBeGreaterThan(0);
      sheets.forEach((text, index) => {
        expect(text, `sheet ${index + 1}`).toContain(`Consultoria Prumo · ${KIND_LABELS[kind].footer}`);
        expect(text, `sheet ${index + 1}`).toContain(PRUMO_CONTACT);
        expect(text, `sheet ${index + 1}`).toContain(`Página ${index + 1} de ${sheets.length}`);
      });
    }
  });

  it("shows the FitPulse brand, with no logo and no contact, when everything is blank", async () => {
    for (const blank of [undefined, { name: "  ", phone: "", email: null, site: undefined, logoDataUrl: null }]) {
      const pdf = await renderReportPdf(reportOf(kind, blank));
      const sheets = await sheetsOf(pdf);

      expect(sheets[0]).toContain("FitPulse");
      expect(sheets[0]).toContain("Gerado com o FitPulse em 25/10/2026");
      expect(sheets[0]).not.toContain("Preparado por");
      expect(imageCount(pdf)).toBe(0);
      for (const text of sheets) {
        expect(text).toContain(`FitPulse · ${KIND_LABELS[kind].footer}`);
        expect(text).not.toContain("@");
      }
    }
  });

  it("prints only the contacts that were given, in the order phone, e-mail, site", async () => {
    const [cover] = await sheetsOf(await renderReportPdf(reportOf(kind, { name: "Prumo", site: "prumo.com.br", phone: "(11) 1234-5678" })));

    expect(cover).toContain("(11) 1234-5678 · prumo.com.br");
    expect(cover).not.toContain("@");
  });

  it("uses the colors of FitPulse whatever the brand is", async () => {
    const withoutBrand = colorsOf(await renderReportPdf(reportOf(kind)));
    const withBrand = colorsOf(await renderReportPdf(reportOf(kind, PRUMO)));

    expect(withoutBrand.size).toBeGreaterThan(0);
    expect(withBrand).toEqual(withoutBrand);
  });

  it("keeps a long name and a long contact on their footer lines, cut with an ellipsis, never under the page number", async () => {
    const name = "Consultoria de Gestão e Crescimento para Pequenas Empresas do Brasil Ltda".padEnd(80, "a");
    const document = reportOf(kind, { ...PRUMO, name, site: `prumo.com.br/${"a".repeat(120)}` });

    const sheets = await sheetsOf(await renderReportPdf(document));

    expect(sheets).toHaveLength(document.pages.length);
    const footer = sheets[1];
    expect(footer).toContain("…");
    expect(footer).toContain(`Página 2 de ${sheets.length}`);
    expect(footer).not.toContain("a".repeat(120));
  });
});

describe("renderReportPdf: a logo that cannot be drawn", () => {
  it.each([
    ["a PNG cut short", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAf"],
    ["bytes that are no image at all", "data:image/png;base64,AAAA"],
    ["a PNG whose pixels are corrupt", CORRUPT_RGBA_LOGO],
    ["an address that is not an image", "data:text/html;base64,PGh0bWw+"],
  ])("still draws every page with the name of the brand when the logo is %s", async (_name, logoDataUrl) => {
    const document = documentOf(WITH_RISKS, { brand: { ...PRUMO, logoDataUrl } });

    const pdf = await renderReportPdf(document);
    const sheets = await sheetsOf(pdf);

    expect(sheets).toHaveLength(document.pages.length);
    expect(sheets[0]).toContain("Consultoria Prumo");
    expect(sheets[0]).toContain(PRUMO_CONTACT);
    expect(imageCount(pdf)).toBe(0);
  });
});
