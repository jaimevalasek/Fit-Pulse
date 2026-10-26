import { extractText } from "unpdf";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ACTION_CATALOG } from "../../shared/content/actionCatalog.ts";
import { QUESTION_BANK } from "../../shared/content/questionBank.ts";
import { RISK_CATALOG } from "../../shared/content/riskCatalog.ts";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis.ts";
import {
  DIMENSION_KEYS,
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type DiagnosisInput,
} from "../../shared/domain/types.ts";
import { formatMoney } from "../../shared/format/money.ts";
import type { ReportBlock, ReportDocument, ReportPage } from "../../shared/report/reportDocument.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { DIMENSIONS_INTRO, GUIDANCE_WARNING, HOW_TO_READ_SECTIONS } from "../../server/report/reportCopy.ts";
import {
  GUIDANCE_NOTICE,
  buildDiagnosisDocument,
  buildReportModel,
  formatFileDate,
  formatReportDate,
  type DiagnosisDocumentInput,
  type ReportActionProgress,
  type ReportModel,
} from "../../server/report/reportModel.ts";
import { renderReportPdf } from "../../server/report/pdfRenderer.ts";
import { createReportService } from "../../server/services/reportService.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// AC-dm-36: the report carries company, date, calculation version, confidence, stage, lock,
// the eight dimension scores, the risks, the three actions and the guidance notice.
// AC-dm-29 (RULE-dm-14): none of the terms the interface never shows.
// AC-ra-05, 08, 09, 10, 11, 23: the diagnosis document (further down).

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// G1: stage 1, locked by the customer cost, two risks, medium confidence (6 of 26 items without the number).
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
const G1: DiagnosisInput = {
  answers: answersOf(1, { mp1: null, mp3: null, cm1: null, mm1: null, co1: null }),
  calculator: G1_CALCULATOR,
};

// G4: stage 4, no lock, no risk, high confidence.
const G4: DiagnosisInput = {
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
  },
};

// Same numbers, but more than half of the items answered "não sei": low confidence, a provisional result.
const LOW_CONFIDENCE: DiagnosisInput = {
  answers: answersOf(1, Object.fromEntries(QUESTION_IDS.slice(0, 14).map((id) => [id, null]))),
  calculator: G1_CALCULATOR,
};

// 12:00 UTC is the same calendar day in every time zone the owner can be in.
const COMPLETED_AT = new Date("2026-10-23T12:00:00.000Z");

function modelOf(input: DiagnosisInput, companyName = "Academia Foco"): ReportModel {
  return buildReportModel({
    companyName,
    completedAt: COMPLETED_AT,
    result: evaluateDiagnosis(input, rulesV1),
    timeZone: "UTC",
  });
}

function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") {
    into.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, into);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, into);
  }
  return into;
}

const FORBIDDEN_TERMS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "V1 to V4", pattern: /\bV[1-4]\b/i },
  { label: "Método V4", pattern: /m[ée]todo\s+V4/i },
  { label: "V4 Company", pattern: /V4\s+Company/i },
  { label: "PPA", pattern: /\bPPA\b/i },
  { label: "CREP", pattern: /\bCREP\b/i },
  { label: "vacinas", pattern: /vacina/i },
];

const factsOf = (model: ReportModel) => Object.fromEntries(model.facts.map((fact) => [fact.label, fact.value]));

describe("buildReportModel (AC-dm-36)", () => {
  it("carries company, date, calculation version and confidence", () => {
    const facts = factsOf(modelOf(G1));
    expect(facts["Empresa"]).toBe("Academia Foco");
    expect(facts["Data do diagnóstico"]).toBe("23/10/2026");
    expect(facts["Versão do cálculo"]).toBe(String(rulesV1.version));
    expect(facts["Confiança nos dados"]).toBe("Média (6 de 26 itens sem o número)");
    expect(factsOf(modelOf(LOW_CONFIDENCE))["Confiança nos dados"]).toMatch(/^Baixa \(\d+ de 26 itens sem o número\)$/);
    expect(factsOf(modelOf(G4))["Confiança nos dados"]).toBe("Alta");
  });

  it("names the stage and says what blocks the next one", () => {
    const g1 = modelOf(G1);
    expect(g1.stage).toMatchObject({ number: 1, name: "Descoberta" });
    expect(g1.stage.phrase).not.toBe("");
    expect(g1.lock.label).toBe("Para subir de degrau");
    expect(g1.lock.text).toMatch(/^Descobrir quanto custa cada cliente novo\. O que mais trava agora: /);

    const g4 = modelOf(G4);
    expect(g4.stage).toMatchObject({ number: 4, name: "Estruturação" });
    expect(g4.lock).toEqual({ label: "Estágio mais alto", text: "Último degrau. Manter margem, equipe e números em dia." });
  });

  it("lists the eight dimensions in the fixed order with the stored scores", () => {
    const result = evaluateDiagnosis(G1, rulesV1);
    const model = modelOf(G1);
    expect(model.dimensions.map((dimension) => dimension.name)).toEqual([
      "Mercado e produto",
      "Produto e canal",
      "Canal e receita",
      "Receita e mercado",
      "Aquisição",
      "Engajamento",
      "Conversão",
      "Retenção",
    ]);
    expect(model.dimensions.map((dimension) => dimension.score)).toEqual(DIMENSION_KEYS.map((key) => result.dimensions[key].score));
    expect(model.dimensions.map((dimension) => dimension.group)).toEqual([
      "Encaixe", "Encaixe", "Encaixe", "Encaixe", "Frente", "Frente", "Frente", "Frente",
    ]);
    expect(model.dimensions.every((dimension) => dimension.belowWarning === (dimension.score < 50))).toBe(true);
  });

  it("lists the risks with level and weight, or none when there is no risk", () => {
    const risks = modelOf(G1).risks;
    expect(risks).toHaveLength(2);
    expect(risks[0]).toMatchObject({ level: "high", title: expect.stringContaining("sem saber quanto custa um cliente") });
    expect(risks[0].levelLine).toMatch(/^Alto · \d+$/);
    expect(risks[0].weightLine).toMatch(/^Probabilidade \d de 5 · Impacto \d de 5$/);
    expect(risks[0].howToReduce).not.toBe("");

    expect(modelOf(G4).risks).toEqual([]);
  });

  it("lists exactly the three actions of the plan, in order", () => {
    const result = evaluateDiagnosis(G1, rulesV1);
    const actions = modelOf(G1).actions;
    expect(result.plan).toHaveLength(3);
    expect(actions.map((action) => action.position)).toEqual([1, 2, 3]);
    for (const action of actions) {
      expect(action.title).not.toBe("");
      expect(action.reason).not.toBe("");
      expect(action.howTo).not.toBe("");
    }
    expect(modelOf(G4).actions).toHaveLength(3);
  });

  it("ends with the guidance notice the result screen shows", () => {
    expect(modelOf(G1).guidance).toBe(GUIDANCE_NOTICE);
    expect(GUIDANCE_NOTICE).toMatch(/^Orientação baseada nas suas respostas\. Não substitui uma análise financeira\./);
  });

  it("marks a low confidence as provisional and a medium or high one as not", () => {
    expect(modelOf(LOW_CONFIDENCE).confidenceNotes.join(" ")).toContain("provisório");
    expect(modelOf(G1).confidenceNotes.join(" ")).not.toContain("provisório");
    expect(modelOf(G4).confidenceNotes.join(" ")).not.toContain("provisório");
  });

  it("shows the numbers behind the stage", () => {
    const numbers = Object.fromEntries(modelOf(G4).numbers.map((number) => [number.label, number.value]));
    expect(numbers["Custo de um cliente"]).toMatch(/^R\$\s?300,00 \(medido\)$/);
    expect(numbers["Relação lucro ÷ custo"]).toBe("5,0×");
    expect(numbers["Tempo para se pagar"]).toBe("8 meses");
  });

  it("is pure: the same diagnosis always gives the same model", () => {
    expect(modelOf(G1)).toEqual(modelOf(G1));
  });

  it("has none of the terms the interface never shows (AC-dm-29)", () => {
    const texts = [G1, G4, LOW_CONFIDENCE].flatMap((input) => collectStrings(modelOf(input)));
    expect(texts.length).toBeGreaterThan(40);
    const offenders = texts.flatMap((text) => FORBIDDEN_TERMS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => `${label}: ${text}`));
    expect(offenders).toEqual([]);
  });
});

describe("report dates", () => {
  it("formats the date for the page and for the file name", () => {
    expect(formatReportDate(COMPLETED_AT, "UTC")).toBe("23/10/2026");
    expect(formatFileDate(COMPLETED_AT, "UTC")).toBe("2026-10-23");
  });

  it("reads the day in the given time zone", () => {
    const lateNight = new Date("2026-01-01T01:30:00.000Z");
    expect(formatFileDate(lateNight, "UTC")).toBe("2026-01-01");
    expect(formatFileDate(lateNight, "America/Sao_Paulo")).toBe("2025-12-31");
  });
});

// ---- The diagnosis document ----

// Distinctive typed values, so a leak of any of them into the document cannot be a coincidence.
const TYPED: DiagnosisInput = {
  answers: answersOf(2, { mp1: null, pc1: 3, es1: 0 }),
  calculator: {
    ...EMPTY_CALCULATOR,
    spendMode: "exact",
    spendParts: { ads: 1_234_567, agency: 76_543 },
    newCustomersMode: "exact",
    newCustomers: 41,
    averagePurchaseCents: 8_765,
    purchasesPerYear: "fourToSix",
    relationshipLength: "twoToFourYears",
    marginPercent: 37,
  },
};

const GENERATED_AT = new Date("2026-10-25T12:00:00.000Z");

function documentOf(input: DiagnosisInput, options: Partial<DiagnosisDocumentInput> = {}): ReportDocument {
  return buildDiagnosisDocument({
    companyName: "Academia Foco",
    completedAt: COMPLETED_AT,
    generatedAt: GENERATED_AT,
    result: evaluateDiagnosis(input, rulesV1),
    timeZone: "UTC",
    ...options,
  });
}

const pageOf = (document: ReportDocument, id: string): ReportPage => {
  const page = document.pages.find((candidate) => candidate.id === id);
  if (page === undefined) throw new Error(`No page ${id}`);
  return page;
};

const blockOf = <Kind extends ReportBlock["kind"]>(page: ReportPage, kind: Kind) =>
  page.blocks.find((block): block is Extract<ReportBlock, { kind: Kind }> => block.kind === kind);

const textOf = (value: unknown): string => collectStrings(value).join("\n");

// The plan of the diagnosis, tracked: one running action, one overdue, one without an entry.
function progressOf(input: DiagnosisInput): ReportActionProgress[] {
  const [first, second] = evaluateDiagnosis(input, rulesV1).plan;
  return [
    { actionKey: first, status: "doing", dueDate: "30/11/2026", owner: "Dono", note: "Ligar para os clientes antigos", overdue: false },
    { actionKey: second, status: "todo", dueDate: "01/10/2026", owner: "Consultor", note: null, overdue: true },
  ];
}

// RULE-dm-04: the stage depends on the conditions of each step, never on the weakest dimension.
const WEAKEST_STAGE_CLAIM = /(est[áa]gio[^.]*dimens[ãa]o mais fraca|dimens[ãa]o mais fraca[^.]*est[áa]gio)/i;

const PAGE_IDS = ["cover", "executive-summary", "dimensions", "risks", "numbers", "how-to-read"];
const ANSWER_PAGE_IDS = ["answers-numbers", "answers-1", "answers-2", "answers-3"];

describe("buildDiagnosisDocument: the pages (AC-ra-05)", () => {
  it("opens with the cover, then summary, dimensions, risks, numbers and 'Como ler' (AC-ra-05)", () => {
    const document = documentOf(G1);
    expect(document.kind).toBe("diagnosis");
    expect(document.pages.map((page) => page.id)).toEqual(PAGE_IDS);
    expect(document.pages.map((page) => page.title)).toEqual([
      "Relatório do diagnóstico de maturidade",
      "Resumo executivo",
      "Notas das 8 dimensões",
      "Riscos",
      "Seus números",
      "Como ler este relatório",
    ]);
    expect(new Set(document.pages.map((page) => page.id)).size).toBe(document.pages.length);
  });

  it("puts the action tracking before 'Como ler' only when there is any", () => {
    const tracked = documentOf(G1, { actionProgress: progressOf(G1) });
    expect(tracked.pages.map((page) => page.id)).toEqual([...PAGE_IDS.slice(0, 5), "action-progress", "how-to-read"]);
    expect(documentOf(G1, { actionProgress: [] }).pages.map((page) => page.id)).toEqual(PAGE_IDS);
  });

  it("puts the answers last, only when asked", () => {
    const withAnswers = documentOf(G1, { includeAnswers: true, diagnosisInput: G1 });
    expect(withAnswers.pages.map((page) => page.id)).toEqual([...PAGE_IDS, ...ANSWER_PAGE_IDS]);
    expect(documentOf(G1, { diagnosisInput: G1 }).pages.map((page) => page.id)).toEqual(PAGE_IDS);
  });

  it("is pure and plain data: the same diagnosis always gives the same document", () => {
    expect(documentOf(G1)).toEqual(documentOf(G1));
    expect(JSON.parse(JSON.stringify(documentOf(G1)))).toEqual(documentOf(G1));
  });
});

describe("buildDiagnosisDocument: cover and footer", () => {
  it("prints the company, date, calculation version and confidence, under the FitPulse brand when it is blank", () => {
    const document = documentOf(G1);
    const cover = blockOf(pageOf(document, "cover"), "cover");
    expect(cover).toMatchObject({
      title: "Relatório do diagnóstico de maturidade",
      subject: "Academia Foco",
      credit: "Gerado com o FitPulse em 25/10/2026",
      contactLine: null,
      brand: { name: "FitPulse", custom: false, logoDataUrl: null },
    });
    expect(Object.fromEntries(cover!.facts.map((fact) => [fact.label, fact.value]))).toEqual({
      "Data do diagnóstico": "23/10/2026",
      "Versão do cálculo": String(rulesV1.version),
      "Confiança nos dados": "Média (6 de 26 itens sem o número)",
    });
    expect(document.footer.text).toBe("FitPulse · Diagnóstico de maturidade");
  });

  it("carries the brand of whoever delivers it", () => {
    const document = documentOf(G1, {
      brand: { name: " Consultoria Aurora ", phone: "(11) 91234-5678", email: "ola@aurora.com.br", site: "", logoDataUrl: "data:image/png;base64,AAAA" },
    });
    expect(blockOf(pageOf(document, "cover"), "cover")).toMatchObject({
      credit: "Preparado por Consultoria Aurora com o FitPulse em 25/10/2026",
      contactLine: "(11) 91234-5678 · ola@aurora.com.br",
      brand: { name: "Consultoria Aurora", custom: true, logoDataUrl: "data:image/png;base64,AAAA" },
    });
    expect(document.footer.text).toBe("Consultoria Aurora · Diagnóstico de maturidade");
  });

  it("falls back to FitPulse when every brand field is blank", () => {
    const blank = documentOf(G1, { brand: { name: "  ", phone: null, email: "", site: undefined, logoDataUrl: null } });
    expect(blank.pages[0]).toEqual(documentOf(G1).pages[0]);
  });
});

describe("buildDiagnosisDocument: the executive summary (AC-ra-05, AC-ra-06, AC-ra-11)", () => {
  it("holds the stage, the lock, the three actions and the key numbers on one page", () => {
    const summary = pageOf(documentOf(G1), "executive-summary");
    expect(blockOf(summary, "stage")).toMatchObject({ number: 1, total: 4, name: "Descoberta" });
    const lock = blockOf(summary, "facts")!.items[0];
    expect(lock.label).toBe("Para subir de degrau");
    expect(lock.value).toMatch(/^Descobrir quanto custa cada cliente novo\./);

    const actions = blockOf(summary, "actions")!.items;
    expect(actions.map((action) => action.position)).toEqual([1, 2, 3]);
    expect(actions.every((action) => action.title !== "" && action.details.length === 2)).toBe(true);
    expect(actions[0].details[1]).toMatch(/^Como fazer: /);

    const numbers = blockOf(summary, "keyNumbers")!.items;
    expect(numbers.map((number) => number.label)).toEqual([
      "Custo para conquistar um cliente",
      "Relação lucro ÷ custo",
      "Tempo para um cliente se pagar",
    ]);
    // G1 does not know its spend, so its cost is not calculated; G4 measured it.
    expect(numbers[0].value).toBe("não calculado");
    const measured = blockOf(pageOf(documentOf(G4), "executive-summary"), "keyNumbers")!.items;
    expect(measured[0].value).toMatch(/^R\$\s?300,00$/);
    expect(measured[1].value).toBe("5,0×");
  });

  it("shows the highest risk, or none when there is no risk", () => {
    expect(textOf(pageOf(documentOf(G1), "executive-summary"))).toContain(
      "Risco mais alto: Investir em divulgação sem saber quanto custa um cliente (Alto",
    );
    expect(textOf(pageOf(documentOf(G4), "executive-summary"))).not.toContain("Risco mais alto");
  });

  it("carries the guidance warning, in the summary and in 'Como ler'", () => {
    expect(GUIDANCE_WARNING).toBe("Orientação baseada nas respostas da empresa. Não substitui uma análise financeira.");
    for (const input of [G1, G4, LOW_CONFIDENCE]) {
      const document = documentOf(input);
      for (const id of ["executive-summary", "how-to-read"]) {
        expect(blockOf(pageOf(document, id), "notice")?.text, id).toBe(GUIDANCE_WARNING);
      }
    }
  });

  it("marks the tracked actions with their state, and an overdue one as overdue", () => {
    const summary = pageOf(documentOf(G1, { actionProgress: progressOf(G1) }), "executive-summary");
    expect(blockOf(summary, "actions")!.items.map((action) => action.tag)).toEqual([
      { label: "Em andamento", tone: "warn" },
      { label: "A fazer · vencida", tone: "bad" },
      null,
    ]);
    expect(blockOf(pageOf(documentOf(G1), "executive-summary"), "actions")!.items.every((action) => action.tag === null)).toBe(true);
  });

  // The renderer test (pdfRenderer.test.ts) judges "one A4 page"; this keeps the text of the
  // worst case, the three longest actions and the longest risk title, inside a budget.
  it("stays small enough for one page even with the longest catalog texts", () => {
    const summary = pageOf(documentOf(G4), "executive-summary");
    const longestActions = Object.values(ACTION_CATALOG)
      .map((action) => action.title.length + action.reason.length + action.howTo.length)
      .sort((a, b) => b - a)
      .slice(0, 3)
      .reduce((sum, length) => sum + length, 0);
    const longestRisk = Math.max(...RISK_CATALOG.map((risk) => risk.title.length));
    const fixed = textOf(summary).length - textOf(blockOf(summary, "actions")).length;
    expect(longestActions + longestRisk + fixed).toBeLessThan(1900);
  });
});

describe("buildDiagnosisDocument: dimensions (AC-ra-07)", () => {
  it("groups the eight bars into encaixes and frentes, each with its score in words and the line of 50", () => {
    const result = evaluateDiagnosis(G1, rulesV1);
    const bars = blockOf(pageOf(documentOf(G1), "dimensions"), "dimensionBars")!;
    expect(bars.threshold).toBe(50);
    expect(bars.groups.map((group) => group.label)).toEqual(["Encaixes do negócio", "Frentes de crescimento"]);
    expect(bars.groups.map((group) => group.bars.map((bar) => bar.name))).toEqual([
      ["Mercado e produto", "Produto e canal", "Canal e receita", "Receita e mercado"],
      ["Aquisição", "Engajamento", "Conversão", "Retenção"],
    ]);
    const all = bars.groups.flatMap((group) => group.bars);
    expect(all.map((bar) => bar.score)).toEqual(DIMENSION_KEYS.map((key) => result.dimensions[key].score));
    for (const bar of all) {
      expect(bar.scoreText).toBe(`${bar.score} de 100`);
      expect(bar.supportsText).toMatch(/^Sustentaria o estágio [1-4]$/);
      // Nothing depends on color alone: under 50 the bar says so in words.
      expect(bar.alertText).toBe(bar.score < 50 ? "abaixo de 50" : null);
    }
  });

  it("opens with the approved sentence, which sends the stage to 'Como ler'", () => {
    expect(DIMENSIONS_INTRO).toBe(
      "Cada nota vai de 0 a 100. A linha marca 50: abaixo dela, a dimensão pede atenção. O estágio depende das condições de cada degrau, explicadas em 'Como ler'.",
    );
    expect(blockOf(pageOf(documentOf(G1), "dimensions"), "paragraph")?.text).toBe(DIMENSIONS_INTRO);
  });
});

describe("buildDiagnosisDocument: risks (AC-ra-08)", () => {
  it("puts each risk in the matrix by its number and lists it with the score, the level and how to reduce it", () => {
    const risks = pageOf(documentOf(G1), "risks");
    const matrix = blockOf(risks, "riskMatrix")!;
    const list = blockOf(risks, "riskList")!;
    expect(matrix.size).toBe(5);
    expect(matrix.marks.map((mark) => mark.number)).toEqual([1, 2]);
    expect(list.items.map((item) => item.number)).toEqual([1, 2]);
    expect(matrix.thresholds).toEqual({ mediumFrom: rulesV1.risk.mediumFrom, highFrom: rulesV1.risk.highFrom });
    expect(matrix.legend.map((entry) => entry.label)).toEqual(["Alto", "Médio", "Baixo"]);
    expect(matrix.description).toMatch(/^Matriz de risco 5 por 5\. Risco 1: probabilidade \d, impacto \d, nível alto/);

    const [first] = list.items;
    expect(first.level).toBe("high");
    expect(first.levelLabel).toBe("Alto");
    expect(first.scoreLine).toMatch(/^Probabilidade \d de 5 · Impacto \d de 5 · Nota \d × \d = \d+$/);
    expect(first.howToReduce).toMatch(/^Como reduzir: .+/);
    const mark = matrix.marks[0];
    expect(first.scoreLine).toContain(`Nota ${mark.probability} × ${mark.impact} = ${mark.probability * mark.impact}`);
  });

  it("says no risk was found when there is none", () => {
    expect(pageOf(documentOf(G4), "risks").blocks).toEqual([
      { kind: "paragraph", text: "Nenhum risco encontrado nas respostas." },
    ]);
  });
});

describe("buildDiagnosisDocument: numbers and 'Como ler' (AC-ra-05, AC-ra-10, AC-ra-23)", () => {
  it("explains each of the four calculated numbers (AC-ra-10)", () => {
    const numbers = blockOf(pageOf(documentOf(G4), "numbers"), "explainedNumbers")!.items;
    expect(numbers.map((number) => number.label)).toEqual([
      "Custo de um cliente",
      "Lucro de um cliente no tempo",
      "Relação lucro ÷ custo",
      "Tempo para se pagar",
    ]);
    expect(numbers[0].value).toMatch(/^R\$\s?300,00 \(medido\)$/);
    expect(numbers[2].value).toBe("5,0×");
    expect(numbers[2].explanation).toBe("Saudável. Cada cliente deixa entre 3 e 5 vezes o que custou.");
    expect(numbers.every((number) => number.explanation.length > 20)).toBe(true);
  });

  it("states the confidence and marks a low one as provisional", () => {
    const text = (input: DiagnosisInput) => textOf(pageOf(documentOf(input), "numbers"));
    expect(text(G1)).toContain("Média (6 de 26 itens sem o número). Parte das respostas é estimada por faixa.");
    expect(text(G1)).not.toContain("provisório");
    expect(text(LOW_CONFIDENCE)).toContain("provisório");
    expect(text(G4)).toContain("Alta. Quase todas as respostas são medidas.");
  });

  it("says the cost per customer came from the diary, measured or estimated, only when the diary gave it (AC-ra-46)", () => {
    const costOf = (input: DiagnosisInput, options: Partial<DiagnosisDocumentInput> = {}) =>
      blockOf(pageOf(documentOf(input, options), "numbers"), "explainedNumbers")!.items[0].value;
    const fromDiary = (origin: "measured" | "estimated"): DiagnosisInput => {
      const source = { origin, fromMonth: "2026-08", toMonth: "2026-10", monthCount: origin === "measured" ? 3 : 2 };
      return { ...G4, calculator: { ...G4.calculator, diarySource: { spend: source, newCustomers: source } } };
    };

    expect(costOf(G4, { costDiaryOrigin: "measured" })).toMatch(/^R\$\s?300,00 \(do diário, medido\)$/);
    expect(costOf(fromDiary("estimated"), { costDiaryOrigin: "estimated" })).toMatch(/^R\$\s?300,00 \(do diário, estimado\)$/);
    // Typed in, or no diary at all: the first version's wording.
    expect(costOf(G4, { costDiaryOrigin: null })).toMatch(/^R\$\s?300,00 \(medido\)$/);
    expect(costOf(G4)).toMatch(/^R\$\s?300,00 \(medido\)$/);
  });

  it("never claims the diary for a cost that could not be calculated or that was calculated another way", () => {
    const costOf = (input: DiagnosisInput, costDiaryOrigin: "measured" | "estimated") =>
      blockOf(pageOf(documentOf(input, { costDiaryOrigin }), "numbers"), "explainedNumbers")!.items[0].value;

    expect(costOf(G1, "measured")).toContain("gasto ou clientes novos desconhecidos");
    expect(costOf(G1, "measured")).not.toContain("diário");
    // The diary says estimated, but the calculation counted the numbers as measured: the file does not contradict the result.
    expect(costOf(G4, "estimated")).toMatch(/\(medido\)$/);
  });

  it("carries the origin to the model of the first version too", () => {
    const model = buildReportModel({
      companyName: "Academia Foco",
      completedAt: COMPLETED_AT,
      result: evaluateDiagnosis(G4, rulesV1),
      timeZone: "UTC",
      costDiaryOrigin: "measured",
    });

    expect(model.numbers[0].value).toMatch(/\(do diário, medido\)$/);
  });

  it("explains the stage by the conditions of each step, with the approved text", () => {
    const text = textOf(pageOf(documentOf(G1), "how-to-read"));
    expect(HOW_TO_READ_SECTIONS.map((section) => section.heading)).toEqual([
      "Os 4 estágios",
      "Encaixes e frentes",
      "Custo e lucro por cliente",
      "Confiança nos dados",
    ]);
    expect(text).toContain("Cada degrau tem condições próprias, e a empresa só sobe quando cumpre todas as do degrau seguinte.");
    expect(text).toContain("A primeira condição que falta é a trava, e é ela que o plano ataca primeiro.");
    expect(text).toContain("Quando o lucro fica entre 3 e 5 vezes o custo, a conta é saudável; abaixo de 1, cada cliente novo dá prejuízo.");
    expect(text).toContain("Com 3 meses ou mais anotados no diário, o custo por cliente conta como medido.");
  });

  it("never says the stage is the one of the weakest dimension", () => {
    expect(WEAKEST_STAGE_CLAIM.test("O estágio da empresa fica limitado pela dimensão mais fraca.")).toBe(true);
    for (const input of [G1, G4, LOW_CONFIDENCE, TYPED]) {
      const document = documentOf(input, { actionProgress: progressOf(input), includeAnswers: true, diagnosisInput: input });
      expect(textOf(document)).not.toMatch(WEAKEST_STAGE_CLAIM);
    }
  });
});

describe("buildDiagnosisDocument: action tracking", () => {
  it("lists the three actions of the plan with state, deadline, owner and note", () => {
    const items = blockOf(pageOf(documentOf(G1, { actionProgress: progressOf(G1) }), "action-progress"), "actions")!.items;
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items[0]).toMatchObject({
      tag: { label: "Em andamento", tone: "warn" },
      details: ["Prazo 30/11/2026 · Responsável: Dono", "Nota: Ligar para os clientes antigos"],
    });
    expect(items[1]).toMatchObject({
      tag: { label: "A fazer · vencida", tone: "bad" },
      details: ["Prazo 01/10/2026 · Responsável: Consultor"],
    });
    // An action without an entry is still on the page, as a new one: "A fazer".
    expect(items[2]).toMatchObject({ tag: { label: "A fazer", tone: "neutral" }, details: [] });
  });

  it("never marks a done action as overdue (RULE-ra-06)", () => {
    const progress = progressOf(G1).map((entry) => ({ ...entry, status: "done" as const, overdue: true }));
    const items = blockOf(pageOf(documentOf(G1, { actionProgress: progress }), "action-progress"), "actions")!.items;
    expect(items.slice(0, 2).map((item) => item.tag)).toEqual([
      { label: "Feita", tone: "ok" },
      { label: "Feita", tone: "ok" },
    ]);
  });
});

describe("buildDiagnosisDocument: the answers (AC-ra-09)", () => {
  const typedValues = [1_234_567, 76_543, 1_234_567 + 76_543, 8_765].map(formatMoney);

  it("leaves out every answer and typed value when the option is off, even with the input at hand (AC-ra-09)", () => {
    const text = textOf(documentOf(TYPED, { includeAnswers: false, diagnosisInput: TYPED }));
    expect(typedValues).toEqual(["R$ 12.345,67", "R$ 765,43", "R$ 13.111,10", "R$ 87,65"]);
    for (const value of typedValues) expect(text).not.toContain(value);
    expect(text).not.toContain("de cada R$ 100");
    for (const question of QUESTION_BANK) expect(text).not.toContain(question.text);
    // The calculated numbers stay.
    expect(text).toContain("Custo de um cliente");
  });

  it("adds the 24 questions with the chosen answer and the 6 calculator numbers when it is on", () => {
    const document = documentOf(TYPED, { includeAnswers: true, diagnosisInput: TYPED });
    const questionRows = ANSWER_PAGE_IDS.slice(1).flatMap((id) => blockOf(pageOf(document, id), "table")!.rows);
    expect(questionRows).toHaveLength(24);
    expect(questionRows.map((row) => row[0])).toEqual(QUESTION_BANK.map((question, index) => `${index + 1}. ${question.text}`));
    const optionLabel = (id: string, value: 0 | 1 | 2 | 3) => QUESTION_BANK.find((question) => question.id === id)!.options[value].label;
    const answerOf = (id: string) => questionRows[QUESTION_BANK.findIndex((question) => question.id === id)][1];
    expect(answerOf("pc1")).toBe(optionLabel("pc1", 3));
    expect(answerOf("pc2")).toBe(optionLabel("pc2", 2));
    expect(answerOf("mp1")).toBe("Não acompanho");

    const calculator = Object.fromEntries(blockOf(pageOf(document, "answers-numbers"), "table")!.rows);
    expect(calculator["Quanto você gastou para atrair clientes nos últimos 3 meses?"]).toBe("R$ 13.111,10");
    expect(calculator["Gasto: Anúncios (redes sociais, Google, iFood patrocinado)"]).toBe("R$ 12.345,67");
    expect(calculator["Gasto: Agência ou freelancer de marketing"]).toBe("R$ 765,43");
    expect(calculator["Quantos clientes compraram de você pela primeira vez nesses 3 meses?"]).toBe("41");
    expect(calculator["Valor médio de uma compra"]).toBe("R$ 87,65");
    expect(calculator["Quantas vezes por ano um cliente compra"]).toBe("4 a 6 vezes");
    expect(calculator["Por quanto tempo um cliente continua comprando"]).toBe("2 a 4 anos");
    expect(Object.values(calculator)).toContain("R$ 37 de cada R$ 100");
  });

  it("writes a range answer as the range and an unknown one as 'Não sei'", () => {
    const document = documentOf(G1, { includeAnswers: true, diagnosisInput: G1 });
    const calculator = Object.fromEntries(blockOf(pageOf(document, "answers-numbers"), "table")!.rows);
    expect(calculator["Quanto você gastou para atrair clientes nos últimos 3 meses?"]).toBe("Não sei");
    expect(calculator["Quantos clientes compraram de você pela primeira vez nesses 3 meses?"]).toBe("11 a 30");
  });

  it("marks the numbers that came from the diary, and only those (AC-ra-46)", () => {
    const measured = { origin: "measured", fromMonth: "2026-08", toMonth: "2026-10", monthCount: 3 } as const;
    const estimated = { origin: "estimated", fromMonth: "2026-09", toMonth: "2026-10", monthCount: 2 } as const;
    const marked: DiagnosisInput = {
      ...TYPED,
      calculator: { ...TYPED.calculator, diarySource: { spend: measured, newCustomers: estimated } },
    };
    const rowsOf = (input: DiagnosisInput) =>
      Object.fromEntries(blockOf(pageOf(documentOf(input, { includeAnswers: true, diagnosisInput: input }), "answers-numbers"), "table")!.rows);

    const calculator = rowsOf(marked);
    expect(calculator["Quanto você gastou para atrair clientes nos últimos 3 meses?"]).toBe("R$ 13.111,10 (do diário: ago/2026 a out/2026)");
    expect(calculator["Quantos clientes compraram de você pela primeira vez nesses 3 meses?"]).toBe("41 (do diário: 2 meses, estimado)");
    expect(calculator["Valor médio de uma compra"]).toBe("R$ 87,65");
    // A number the owner typed over loses its mark, so the file does not claim the diary for it.
    const typedOver = rowsOf({ ...marked, calculator: { ...marked.calculator, diarySource: { spend: measured } } });
    expect(typedOver["Quantos clientes compraram de você pela primeira vez nesses 3 meses?"]).toBe("41");
  });

  it("writes the single spend total of the diary as the spend, with no division by part", () => {
    const totalOnly: DiagnosisInput = {
      ...TYPED,
      calculator: { ...TYPED.calculator, spendParts: {}, spendTotalCents: 900_000 },
    };
    const document = documentOf(totalOnly, { includeAnswers: true, diagnosisInput: totalOnly });
    const rows = blockOf(pageOf(document, "answers-numbers"), "table")!.rows;

    expect(Object.fromEntries(rows)["Quanto você gastou para atrair clientes nos últimos 3 meses?"]).toBe("R$ 9.000,00");
    expect(rows.some(([label]) => label.startsWith("Gasto:"))).toBe(false);
  });

  it("refuses to build the appendix without the answers to print", () => {
    expect(() => documentOf(G1, { includeAnswers: true })).toThrow("diagnosis input");
  });

  it("splits the appendix into fixed pages, so each one fits an A4", () => {
    const document = documentOf(TYPED, { includeAnswers: true, diagnosisInput: TYPED });
    const pages = ANSWER_PAGE_IDS.slice(1).map((id) => pageOf(document, id));
    expect(pages.map((page) => blockOf(page, "table")!.rows.length)).toEqual([8, 8, 8]);
    expect(pages.map((page) => page.title)).toEqual([
      "Respostas do questionário: perguntas 1 a 8",
      "Respostas do questionário: perguntas 9 a 16",
      "Respostas do questionário: perguntas 17 a 24",
    ]);
  });
});

describe("buildDiagnosisDocument: terms (AC-ra-11)", () => {
  it("has none of the terms the interface never shows, with the answers on and off", () => {
    const texts = [G1, G4, LOW_CONFIDENCE, TYPED].flatMap((input) =>
      [false, true].flatMap((includeAnswers) =>
        collectStrings(documentOf(input, { actionProgress: progressOf(input), includeAnswers, diagnosisInput: input })),
      ),
    );
    expect(texts.length).toBeGreaterThan(300);
    const offenders = texts.flatMap((text) =>
      FORBIDDEN_TERMS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => `${label}: ${text}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe("the diagnosis document through the report service: action tracking (AC-ra-05, RULE-ra-06)", () => {
  let db: TestDatabase;
  const service = () => createReportService({ prisma: db.prisma, downloadsDir: db.downloadsDir, now: db.now });

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
  });

  async function createCompany(): Promise<string> {
    return (await db.prisma.company.create({ data: { name: "Academia Foco", segment: "health_wellness", salesChannel: "subscription" } })).id;
  }

  async function conclude(companyId: string, completedAt: string, archivedAt: Date | null = null): Promise<string> {
    const result = evaluateDiagnosis(G1, rulesV1);
    const created = await db.prisma.diagnosis.create({
      data: {
        companyId,
        status: "completed",
        answers: G1.answers as object,
        calculator: G1.calculator as object,
        rulesVersion: result.rulesVersion,
        result: result as unknown as object,
        stage: result.stage,
        completedAt: new Date(completedAt),
        archivedAt,
      },
    });
    return created.id;
  }

  const PLAN = evaluateDiagnosis(G1, rulesV1).plan;

  // One running action past its deadline and one with a deadline ahead.
  async function trackPlan(diagnosisId: string): Promise<void> {
    await db.prisma.actionProgress.create({
      data: { diagnosisId, actionKey: PLAN[0], status: "in_progress", dueDate: "2026-09-01", ownerRole: "owner", note: "Em curso" },
    });
    await db.prisma.actionProgress.create({ data: { diagnosisId, actionKey: PLAN[1], status: "todo", dueDate: "2026-12-01" } });
  }

  const itemsOf = (document: ReportDocument) => blockOf(pageOf(document, "action-progress"), "actions")!.items;

  it("adds 'Andamento das ações' with what the owner recorded on the current plan, the overdue ones marked", async () => {
    const companyId = await createCompany();
    const diagnosisId = await conclude(companyId, "2026-09-10T12:00:00.000Z");
    await trackPlan(diagnosisId);

    const document = await service().preview({ kind: "diagnosis", diagnosisId, includeAnswers: false });

    expect(document.pages.map((page) => page.id)).toEqual([...PAGE_IDS.slice(0, 5), "action-progress", "how-to-read"]);
    const items = itemsOf(document);
    expect(items[0].tag).toEqual({ label: "Em andamento · vencida", tone: "bad" });
    expect(items[0].details).toEqual(["Prazo 01/09/2026 · Responsável: Dono", "Nota: Em curso"]);
    expect(items[1].tag).toEqual({ label: "A fazer", tone: "neutral" });
    expect(items[2].tag).toEqual({ label: "A fazer", tone: "neutral" });
  });

  it("draws the tracking inside the sheets, with the longest note on every action", async () => {
    const companyId = await createCompany();
    const diagnosisId = await conclude(companyId, "2026-09-10T12:00:00.000Z");
    const note = "Ligar para os clientes antigos e oferecer a volta. ".repeat(10).slice(0, 500);
    for (const actionKey of PLAN) {
      await db.prisma.actionProgress.create({
        data: { diagnosisId, actionKey, status: "in_progress", dueDate: "2026-09-01", ownerRole: "sales_team", note },
      });
    }

    const document = await service().preview({ kind: "diagnosis", diagnosisId, includeAnswers: false });
    const pdf = await renderReportPdf(document);

    const { totalPages, text } = await extractText(new Uint8Array(pdf), { mergePages: false });
    expect(totalPages).toBe(document.pages.length);
    expect(text[document.pages.findIndex((page) => page.id === "action-progress")]).toContain("Andamento das ações");
  });

  it("tells a plan that a newer diagnosis replaced as it ended, with nothing overdue", async () => {
    const companyId = await createCompany();
    const replaced = await conclude(companyId, "2026-05-10T12:00:00.000Z");
    await trackPlan(replaced);
    const current = await conclude(companyId, "2026-09-10T12:00:00.000Z");

    const old = await service().preview({ kind: "diagnosis", diagnosisId: replaced, includeAnswers: false });
    const newer = await service().preview({ kind: "diagnosis", diagnosisId: current, includeAnswers: false });

    expect(itemsOf(old)[0].tag).toEqual({ label: "Em andamento", tone: "warn" });
    expect(textOf(old)).not.toContain("vencida");
    // The newer plan has rows, none of them recorded yet: nothing to tell.
    expect(newer.pages.map((page) => page.id)).toEqual(PAGE_IDS);
  });

  it("does not mark an archived diagnosis as overdue either", async () => {
    const companyId = await createCompany();
    const diagnosisId = await conclude(companyId, "2026-09-10T12:00:00.000Z", new Date("2026-10-01T12:00:00.000Z"));
    await trackPlan(diagnosisId);

    const document = await service().preview({ kind: "diagnosis", diagnosisId, includeAnswers: false });

    expect(itemsOf(document)[0].tag).toEqual({ label: "Em andamento", tone: "warn" });
  });

  it("leaves the page out when nothing was recorded, rows born with the diagnosis or none at all", async () => {
    const companyId = await createCompany();
    const withRows = await conclude(companyId, "2026-05-10T12:00:00.000Z");
    for (const actionKey of PLAN) await db.prisma.actionProgress.create({ data: { diagnosisId: withRows, actionKey } });
    const withoutRows = await conclude(companyId, "2026-09-10T12:00:00.000Z");

    for (const diagnosisId of [withRows, withoutRows]) {
      const document = await service().preview({ kind: "diagnosis", diagnosisId, includeAnswers: false });
      expect(document.pages.map((page) => page.id)).toEqual(PAGE_IDS);
    }
  });

  it("says in 'Seus números' where the cost came from, without printing a single typed value (AC-ra-46, BR-ra-08)", async () => {
    const companyId = await createCompany();
    const source = { origin: "measured", fromMonth: "2026-08", toMonth: "2026-10", monthCount: 3 };
    const calculator = {
      spendMode: "exact",
      spendParts: { ads: 3_333_333 },
      newCustomersMode: "exact",
      newCustomers: 100,
      averagePurchaseCents: 20_000,
      purchasesPerYear: "fourToSix",
      relationshipLength: "twoToFourYears",
      marginPercent: 50,
      diarySource: { spend: source, newCustomers: source },
      diarySuggestion: null,
    };
    const result = evaluateDiagnosis({ answers: G4.answers, calculator: { ...EMPTY_CALCULATOR, ...calculator } as CalculatorInput }, rulesV1);
    const created = await db.prisma.diagnosis.create({
      data: {
        companyId,
        status: "completed",
        answers: G4.answers as object,
        calculator: calculator as object,
        rulesVersion: result.rulesVersion,
        result: result as unknown as object,
        stage: result.stage,
        completedAt: new Date("2026-09-10T12:00:00.000Z"),
      },
    });

    const document = await service().preview({ kind: "diagnosis", diagnosisId: created.id, includeAnswers: false });

    const cost = blockOf(pageOf(document, "numbers"), "explainedNumbers")!.items[0].value;
    expect(cost).toMatch(/^R\$\s?333,33 \(do diário, medido\)$/);
    expect(textOf(document)).not.toContain("33.333,33");
    expect(textOf(document)).not.toContain("do diário: ago");
    expect(document.pages.map((page) => page.id)).toEqual(PAGE_IDS);
  });
});
