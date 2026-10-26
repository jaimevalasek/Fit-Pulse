import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STAGES } from "../../shared/content/stageContent.ts";
import { compareWithResults, type ComparableDiagnosis } from "../../shared/domain/compareDiagnoses.ts";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis.ts";
import {
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type DiagnosisInput,
  type Rules,
} from "../../shared/domain/types.ts";
import type { ReportBlock, ReportDocument } from "../../shared/report/reportDocument.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { buildEvolutionDocument } from "../../server/report/evolutionDocument.ts";
import { buildPortfolioDocument } from "../../server/report/portfolioDocument.ts";
import * as reportCopy from "../../server/report/reportCopy.ts";
import { buildDiagnosisDocument, type ReportActionProgress } from "../../server/report/reportModel.ts";
import type { PortfolioRecord } from "../../server/repositories/portfolioRepository.ts";
import { buildPortfolio, type Portfolio } from "../../server/services/portfolioService.ts";
import { rulesV2 } from "../fixtures/rulesV2.ts";

// AC-dm-29, RULE-dm-14: the interface never shows these terms.
const FORBIDDEN_TERMS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "V1 to V4", pattern: /\bV[1-4]\b/i },
  { label: "Método V4", pattern: /m[ée]todo\s+V4/i },
  { label: "V4 Company", pattern: /V4\s+Company/i },
  { label: "PPA", pattern: /\bPPA\b/i },
  { label: "CREP", pattern: /\bCREP\b/i },
  { label: "vacinas", pattern: /vacina/i },
];

function findForbidden(text: string): string[] {
  return FORBIDDEN_TERMS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
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

const contentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../shared/content",
);

const contentModules = import.meta.glob<Record<string, unknown>>("../../shared/content/*.ts", {
  eager: true,
});

describe("forbidden terms in shared/content (AC-dm-29, RULE-dm-14)", () => {
  it("detects every forbidden term and spares the stage names", () => {
    for (const sample of ["V1", "v2", "V3", "V4", "Método V4", "metodo v4", "V4 Company", "PPA", "CREP", "vacinas", "Vacina"]) {
      expect(findForbidden(sample), sample).not.toEqual([]);
    }
    for (const sample of ["Descoberta", "Ajuste", "Escala", "Estruturação", "Estágio 2 de 4", "R$ 1.000 a R$ 5.000", "mp1", "rulesV1.ts"]) {
      expect(findForbidden(sample), sample).toEqual([]);
    }
  });

  it("names the four stages Descoberta, Ajuste, Escala and Estruturação", () => {
    expect(STAGES.map((stage) => stage.name)).toEqual([
      "Descoberta",
      "Ajuste",
      "Escala",
      "Estruturação",
    ]);
  });

  it("reaches the content texts it is meant to scan", () => {
    const modules = Object.keys(contentModules).map((file) => path.basename(file));
    for (const expected of [
      "actionCatalog.ts",
      "calculatorOptions.ts",
      "questionBank.ts",
      "riskCatalog.ts",
      "stageContent.ts",
    ]) {
      expect(modules).toContain(expected);
    }
    const texts = Object.values(contentModules).flatMap((moduleExports) =>
      collectStrings(moduleExports),
    );
    expect(texts.length).toBeGreaterThan(150);
    expect(texts).toContain("Descoberta");
    expect(texts).toContain("Nenhum constante");
  });

  it("has no forbidden term in any text exported by shared/content", () => {
    const offenders: string[] = [];
    for (const [file, moduleExports] of Object.entries(contentModules)) {
      for (const text of collectStrings(moduleExports)) {
        const found = findForbidden(text);
        if (found.length > 0) offenders.push(`${path.basename(file)}: ${found.join(", ")} in "${text}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("has no forbidden term anywhere in the shared/content source files", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(contentDir).filter((name) => name.endsWith(".ts"))) {
      const found = findForbidden(readFileSync(path.join(contentDir, file), "utf8"));
      if (found.length > 0) offenders.push(`${file}: ${found.join(", ")}`);
    }
    expect(offenders).toEqual([]);
  });
});

// AC-ra-11: the diagnosis report (what its PDF prints) has none of these terms either, with the
// answers appendix on and off. The words of the report live in server/report/reportCopy.ts.
const fillWith = (value: AnchorValue, overrides: Answers = {}): Answers => {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = value;
  return { ...answers, ...overrides };
};
const calculator: CalculatorInput = {
  ...EMPTY_CALCULATOR,
  spendMode: "exact",
  spendParts: { ads: 250_000, tools: 40_000 },
  newCustomersMode: "range",
  newCustomersRange: "from11To30",
  averagePurchaseCents: 6_000,
  purchasesPerYear: "twoToThree",
  relationshipLength: "oneToTwoYears",
  marginPercent: 45,
};
const inputs: DiagnosisInput[] = [
  { answers: fillWith(1, { mp1: null, co1: null }), calculator },
  { answers: fillWith(3), calculator },
  { answers: fillWith(0, { mp1: null, mp3: null, cm1: null, mm1: null, co1: null, re2: null }), calculator: EMPTY_CALCULATOR },
];

describe("forbidden terms in the diagnosis report (AC-ra-11, RULE-dm-14)", () => {
  it("has no forbidden term in any text of the document, with and without the answers", () => {
    const texts = inputs.flatMap((diagnosisInput) =>
      [false, true].flatMap((includeAnswers) =>
        collectStrings(
          buildDiagnosisDocument({
            companyName: "Academia Foco",
            completedAt: new Date("2026-10-23T12:00:00.000Z"),
            generatedAt: new Date("2026-10-25T12:00:00.000Z"),
            result: evaluateDiagnosis(diagnosisInput, rulesV1),
            timeZone: "UTC",
            includeAnswers,
            diagnosisInput,
          }),
        ),
      ),
    );
    expect(texts.length).toBeGreaterThan(400);
    expect(texts).toContain("Como ler este relatório");
    const offenders = texts.flatMap((text) => findForbidden(text).map((label) => `${label} in "${text}"`));
    expect(offenders).toEqual([]);
  });

  it("has no forbidden term in the fixed texts of the reports", () => {
    const texts = collectStrings(reportCopy);
    expect(texts.length).toBeGreaterThan(40);
    expect(texts.flatMap((text) => findForbidden(text).map((label) => `${label} in "${text}"`))).toEqual([]);
  });
});

// AC-ra-11 for the other two PDFs: the evolution and the portfolio say none of the terms either, and
// both print the guidance warning in the summary and in "Como ler". The evolution is checked with the
// recalculation notice (RULE-ra-02) and with "O que foi feito no período"; the portfolio, branded or not,
// with and without the overdue actions.
function pageNotices(document: ReportDocument, pageId: string): string[] {
  const page = document.pages.find((candidate) => candidate.id === pageId);
  return (page?.blocks ?? []).filter((block): block is Extract<ReportBlock, { kind: "notice" }> => block.kind === "notice").map((block) => block.text);
}

function offendersIn(documents: ReportDocument[]): { count: number; offenders: string[] } {
  const texts = documents.flatMap((document) => collectStrings(document));
  return { count: texts.length, offenders: texts.flatMap((text) => findForbidden(text).map((label) => `${label} in "${text}"`)) };
}

describe("forbidden terms in the evolution report (AC-ra-11, RULE-dm-14)", () => {
  const BEFORE_AT = "2026-04-14T12:00:00.000Z";
  const AFTER_AT = "2026-10-23T12:00:00.000Z";

  const diagnosed = (id: string, completedAt: string, input: DiagnosisInput, rules: Rules): ComparableDiagnosis => ({
    id,
    completedAt,
    ...input,
    result: evaluateDiagnosis(input, rules),
  });

  // Same rules in both, then the earlier one calculated again with the other rules.
  const pairs = [
    { previous: diagnosed("d1", BEFORE_AT, inputs[2], rulesV1), current: diagnosed("d2", AFTER_AT, inputs[0], rulesV1), rules: rulesV1 },
    { previous: diagnosed("d1", BEFORE_AT, inputs[1], rulesV1), current: diagnosed("d2", AFTER_AT, inputs[0], rulesV2), rules: rulesV2 },
  ];

  function evolutionOf(pair: (typeof pairs)[number], withPeriod: boolean): ReportDocument {
    const { comparison, previousResult } = compareWithResults(pair.previous, pair.current, pair.rules);
    const actions: ReportActionProgress[] = pair.previous.result.plan.map((actionKey, index) => ({
      actionKey,
      status: (["todo", "doing", "done"] as const)[index % 3],
      dueDate: "10/09/2026",
      owner: "Equipe de vendas",
      note: "Combinado na reunião",
      overdue: index === 1,
    }));
    return buildEvolutionDocument({
      companyName: "Academia Foco",
      comparison,
      previousResult,
      currentResult: pair.current.result,
      generatedAt: new Date("2026-10-25T12:00:00.000Z"),
      timeZone: "UTC",
      period: withPeriod ? { actions, diary: [{ month: "2026-06", cacCents: 12_345 }, { month: "2026-07", cacCents: 23_456 }] } : undefined,
      brand: withPeriod ? { name: "Consultoria Norte" } : undefined,
    });
  }

  const documents = pairs.flatMap((pair) => [false, true].map((withPeriod) => evolutionOf(pair, withPeriod)));

  it("has no forbidden term in any text of the document, with and without the period page", () => {
    expect(documents.some((document) => document.pages.some((page) => page.id === "period"))).toBe(true);
    expect(documents.some((document) => !document.pages.some((page) => page.id === "period"))).toBe(true);

    const { count, offenders } = offendersIn(documents);

    expect(count).toBeGreaterThan(150);
    expect(offenders).toEqual([]);
  });

  it("prints the guidance warning in the summary and in 'Como ler'", () => {
    for (const document of documents) {
      expect(pageNotices(document, "before-after")).toContain(reportCopy.GUIDANCE_WARNING);
      expect(pageNotices(document, "how-to-read")).toContain(reportCopy.GUIDANCE_WARNING);
    }
  });
});

describe("forbidden terms in the portfolio report (AC-ra-11, RULE-dm-14)", () => {
  const TODAY = new Date(2026, 9, 23, 12);

  const record = (id: string, name: string, stage: 1 | 2 | 3 | 4 | null): PortfolioRecord =>
    ({
      id,
      name,
      diagnoses:
        stage === null
          ? []
          : [
              {
                id: `diagnosis-${id}`,
                status: "completed",
                stage,
                completedAt: new Date(2026, 3, 14, 12),
                updatedAt: new Date(2026, 3, 14, 12),
                result: { dimensions: {}, risks: [{ signalId: "SIG-01", level: "high", score: 16 }], plan: [] },
              },
            ],
    }) as unknown as PortfolioRecord;

  const base = buildPortfolio(
    [record("a", "Zé Burguer", 1), record("b", "Academia Foco", 3), record("c", "Padaria Nova", null), record("d", "Clínica Vida", 4)],
    TODAY,
  );
  const tracked: Portfolio = { ...base, rows: base.rows.map((row, index) => ({ ...row, overdueActions: index })) };

  const documents = [base, tracked, buildPortfolio([], TODAY)].flatMap((portfolio) =>
    [undefined, { name: "Consultoria Norte", phone: "(11) 91234-5678", email: "contato@norte.example", site: "norte.example" }].map((brand) =>
      buildPortfolioDocument({ portfolio, generatedAt: TODAY, timeZone: "UTC", brand }),
    ),
  );

  it("has no forbidden term in any text of the document, with and without the overdue actions", () => {
    const { count, offenders } = offendersIn(documents);

    expect(count).toBeGreaterThan(100);
    expect(offenders).toEqual([]);
  });

  it("prints the guidance warning in the summary and in 'Como ler'", () => {
    for (const document of documents) {
      expect(pageNotices(document, "by-stage")).toContain(reportCopy.GUIDANCE_WARNING);
      expect(pageNotices(document, "how-to-read")).toContain(reportCopy.GUIDANCE_WARNING);
    }
  });
});
