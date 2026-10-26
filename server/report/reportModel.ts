import { getActionInfo } from "../../shared/content/actionCatalog.ts";
import {
  CALCULATOR_FIELDS,
  NEW_CUSTOMERS_RANGE_OPTIONS,
  PURCHASES_PER_YEAR_OPTIONS,
  RELATIONSHIP_LENGTH_OPTIONS,
  SPEND_PART_OPTIONS,
  SPEND_RANGE_OPTIONS,
  type OptionLabel,
} from "../../shared/content/calculatorOptions.ts";
import { QUESTION_BANK, type Question } from "../../shared/content/questionBank.ts";
import { getRiskInfo } from "../../shared/content/riskCatalog.ts";
import {
  DIMENSIONS,
  DIMENSION_GROUP_LABELS,
  LAST_STEP_PHRASE,
  LOCK_PHRASES,
  STAGES,
  getStage,
} from "../../shared/content/stageContent.ts";
import { formatCostDiaryOrigin, formatDiaryMark } from "../../shared/domain/diaryPrefill.ts";
import {
  DIMENSION_KEYS,
  type ActionKey,
  type CalculatorInput,
  type CostOrigin,
  type DiagnosisInput,
  type DiagnosisResult,
  type DiaryFieldSource,
  type DiaryOrigin,
  type RiskLevel,
  type StageNumber,
} from "../../shared/domain/types.ts";
import { resolveSpendCents } from "../../shared/domain/unitEconomics.ts";
import {
  CONFIDENCE_LEVEL_EXPLANATIONS,
  CONFIDENCE_LEVEL_LABELS,
  formatConfidence,
} from "../../shared/format/confidenceText.ts";
import { formatInteger, formatPayback, formatRatio, getRatioBand } from "../../shared/format/displayNumbers.ts";
import { formatMoney } from "../../shared/format/money.ts";
import type {
  ReportActionItem,
  ReportBlock,
  ReportDimensionBarsBlock,
  ReportDocument,
  ReportFact,
  ReportPage,
  ReportRiskItem,
  ReportRiskMark,
  ReportTag,
} from "../../shared/report/reportDocument.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { buildCoverPage, buildFooter, buildHowToReadPage, resolveBrand, type ReportBrandInput } from "./documentParts.ts";
import {
  ACTION_PROGRESS_COPY,
  ACTION_STATUS_LABELS,
  ANSWERS_COPY,
  COST_ORIGIN_LABELS,
  DIAGNOSIS_FOOTER_LABEL,
  DIAGNOSIS_REPORT_TITLE,
  DIMENSIONS_INTRO,
  DIMENSION_COPY,
  DIMENSION_GROUP_HEADINGS,
  GUIDANCE_WARNING,
  NO_RISKS_FOUND,
  NUMBERS_COPY,
  PAGE_TITLES,
  PROVISIONAL_NOTE,
  RISKS_INTRO,
  RISK_COPY,
  SUMMARY_COPY,
} from "./reportCopy.ts";

// Everything a report says, as plain text ready to print. Pure: the same diagnosis always gives
// the same document, and no layout decision lives here (the renderer and the preview own those).

export type { ReportFact };

export const REPORT_TITLE = DIAGNOSIS_REPORT_TITLE;

/** Same wording as the result screen (`data-aioson-id="result-guidance"`). Only the v1 model prints it. */
export const GUIDANCE_NOTICE =
  "Orientação baseada nas suas respostas. Não substitui uma análise financeira. Ações que aumentam investimento só aparecem quando o custo de um cliente foi medido.";

export const NO_RISKS_TEXT = "Nenhum risco encontrado nas suas respostas.";

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = { high: "Alto", medium: "Médio", low: "Baixo" };

export interface ReportDimension {
  name: string;
  /** "Encaixe" or "Frente". */
  group: string;
  score: number;
  /** Stage this dimension would sustain on its own. */
  supportsStage: StageNumber;
  belowWarning: boolean;
}

export interface ReportRisk {
  level: RiskLevel;
  title: string;
  /** "Alto · 20", "Médio · 12" or "Baixo · 6". */
  levelLine: string;
  /** "Probabilidade 4 de 5 · Impacto 5 de 5". */
  weightLine: string;
  cause: string;
  howToReduce: string;
}

export interface ReportAction {
  position: number;
  title: string;
  reason: string;
  howTo: string;
}

/** The v1 model, still drawn by the current renderer until it draws a `ReportDocument`. */
export interface ReportModel {
  title: string;
  /** Company, date, calculation version and confidence, in the order they are printed. */
  facts: ReportFact[];
  stage: { number: StageNumber; name: string; phrase: string };
  /** What blocks the next stage, or the last-step sentence at the top stage. */
  lock: { label: string; text: string };
  /** Why the confidence is what it is, plus the provisional note when it is low. */
  confidenceNotes: string[];
  /** The eight dimensions in the fixed order of `DIMENSION_KEYS`. */
  dimensions: ReportDimension[];
  numbers: ReportFact[];
  /** At most five; empty means no risk was found. */
  risks: ReportRisk[];
  /** Exactly three. */
  actions: ReportAction[];
  guidance: string;
}

export interface ReportInput {
  companyName: string;
  completedAt: Date;
  result: DiagnosisResult;
  /** IANA time zone the date is read in; the machine's own when omitted. */
  timeZone?: string;
  /**
   * Where the cost per customer came from when the diary gave both of its numbers (AC-ra-46); `null` or
   * missing when it was typed in. Only this origin travels here, never the values the owner typed.
   */
  costDiaryOrigin?: DiaryOrigin | null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** `23/10/2026`, the way the result screen shows the date. */
export function formatReportDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone }).format(date);
}

/** `2026-10-23`: the date as it goes into the file name (no slashes). */
export function formatFileDate(date: Date, timeZone?: string): string {
  const [day, month, year] = formatReportDate(date, timeZone).split("/");
  return `${year}-${month}-${day}`;
}

function describeLock(result: DiagnosisResult): { label: string; text: string } {
  if (result.lock === null) {
    return { label: "Estágio mais alto", text: LAST_STEP_PHRASE };
  }
  const weakest = DIMENSIONS[result.weakestDimension];
  return {
    label: "Para subir de degrau",
    text: `${capitalize(LOCK_PHRASES[result.lock])}. O que mais trava agora: ${weakest.name}, ${result.dimensions[result.weakestDimension].score} de 100.`,
  };
}

/** "medido", "estimado por faixa"… or, when the diary gave the cost, "do diário, medido" / "do diário, estimado". */
function describeCostOrigin(origin: CostOrigin, diaryOrigin: DiaryOrigin | null | undefined): string {
  return diaryOrigin && diaryOrigin === origin ? formatCostDiaryOrigin(diaryOrigin) : COST_ORIGIN_LABELS[origin];
}

/** The four calculated numbers; none of them is a value the owner typed in. */
function buildCalculatedNumbers(result: DiagnosisResult, costDiaryOrigin?: DiaryOrigin | null) {
  const economics = result.unitEconomics;
  const payback = economics.neverPaysBack ? "never" : economics.paybackMonths;
  return {
    cac: {
      label: NUMBERS_COPY.cacLabel,
      value: `${formatMoney(economics.cacCents)} (${describeCostOrigin(economics.origin, costDiaryOrigin)})`,
    },
    ltv: { label: NUMBERS_COPY.ltvLabel, value: formatMoney(economics.ltvCents) },
    ratio: { label: NUMBERS_COPY.ratioLabel, value: formatRatio(economics.ratio) },
    payback: { label: NUMBERS_COPY.paybackLabel, value: formatPayback(payback) },
  };
}

function buildConfidenceNotes(result: DiagnosisResult): string[] {
  const { level } = result.confidence;
  const notes = [`Confiança nos dados: ${CONFIDENCE_LEVEL_LABELS[level]}, ${CONFIDENCE_LEVEL_EXPLANATIONS[level]}`];
  if (level === "low") {
    notes.push(PROVISIONAL_NOTE);
  }
  return notes;
}

export function buildReportModel({
  companyName,
  completedAt,
  result,
  timeZone,
  costDiaryOrigin,
}: ReportInput): ReportModel {
  const stage = getStage(result.stage);
  const numbers = buildCalculatedNumbers(result, costDiaryOrigin);

  return {
    title: REPORT_TITLE,
    facts: [
      { label: "Empresa", value: companyName },
      { label: "Data do diagnóstico", value: formatReportDate(completedAt, timeZone) },
      { label: "Versão do cálculo", value: String(result.rulesVersion) },
      { label: "Confiança nos dados", value: formatConfidence(result.confidence) },
    ],
    stage: { number: result.stage, name: stage.name, phrase: stage.phrase },
    lock: describeLock(result),
    confidenceNotes: buildConfidenceNotes(result),
    dimensions: DIMENSION_KEYS.map((key) => ({
      name: DIMENSIONS[key].name,
      group: DIMENSION_GROUP_LABELS[DIMENSIONS[key].group],
      score: result.dimensions[key].score,
      supportsStage: result.dimensions[key].supportsStage,
      belowWarning: result.dimensions[key].belowWarning,
    })),
    numbers: [numbers.cac, numbers.ltv, numbers.ratio, numbers.payback],
    risks: result.risks.map((risk) => {
      const info = getRiskInfo(risk.signalId);
      return {
        level: risk.level,
        title: info.title,
        levelLine: `${RISK_LEVEL_LABELS[risk.level]} · ${risk.score}`,
        weightLine: `Probabilidade ${risk.probability} de 5 · Impacto ${risk.impact} de 5`,
        cause: info.cause,
        howToReduce: info.howToReduce,
      };
    }),
    actions: result.plan.map((key, index) => {
      const info = getActionInfo(key);
      return { position: index + 1, title: info.title, reason: info.reason, howTo: info.howTo };
    }),
    guidance: GUIDANCE_NOTICE,
  };
}

// ---- Diagnosis document (AC-ra-05) ----

export type ReportActionStatus = keyof typeof ACTION_STATUS_LABELS;

/** How one action of the plan is going, as the action tracking stored it. */
export interface ReportActionProgress {
  actionKey: ActionKey;
  status: ReportActionStatus;
  /** `DD/MM/AAAA`, or null without a deadline. */
  dueDate: string | null;
  /** "Dono", "Consultor"…; null when nobody was chosen. */
  owner: string | null;
  note: string | null;
  /** RULE-ra-06 decided by the caller, who knows "today". */
  overdue: boolean;
}

export interface DiagnosisDocumentInput extends ReportInput {
  /** The day the file is made; it only goes into the credit line of the cover. */
  generatedAt: Date;
  /** Blank or missing is the FitPulse brand. */
  brand?: ReportBrandInput | null;
  /** Without entries there is no "Andamento das ações" page. */
  actionProgress?: readonly ReportActionProgress[];
  /** Adds the answers appendix. Off by default: the answers carry values in reais (BR-ra-08). */
  includeAnswers?: boolean;
  /** The typed answers and calculator. Read only when `includeAnswers` is on, never otherwise. */
  diagnosisInput?: DiagnosisInput | null;
}

const ANSWERS_PER_PAGE = 8;

/** The risk matrix is probability × impact, each from 1 to 5. */
const MATRIX_SIZE = 5;

const STATUS_TONES: Record<ReportActionStatus, ReportTag["tone"]> = {
  todo: "neutral",
  doing: "warn",
  done: "ok",
  notApplicable: "neutral",
};

function progressTag(progress: ReportActionProgress | undefined): ReportTag | null {
  if (progress === undefined) {
    return null;
  }
  const label = ACTION_STATUS_LABELS[progress.status];
  // RULE-ra-06: only an open action (A fazer, Em andamento) can be overdue, whatever the caller sent.
  const open = progress.status === "todo" || progress.status === "doing";
  return progress.overdue && open
    ? { label: `${label}${ACTION_PROGRESS_COPY.overdueSuffix}`, tone: "bad" }
    : { label, tone: STATUS_TONES[progress.status] };
}

function riskLevelRange(level: RiskLevel): string {
  const { highFrom, mediumFrom } = rulesV1.risk;
  if (level === "high") return `${highFrom} a ${MATRIX_SIZE ** 2}`;
  if (level === "medium") return `${mediumFrom} a ${highFrom - 1}`;
  return `1 a ${mediumFrom - 1}`;
}

function buildSummaryPage(result: DiagnosisResult, progress: Map<ActionKey, ReportActionProgress>): ReportPage {
  const stage = getStage(result.stage);
  const lock = describeLock(result);
  const economics = result.unitEconomics;
  const topRisk = result.risks[0];
  const blocks: ReportBlock[] = [
    { kind: "stage", number: result.stage, total: STAGES.length, name: stage.name, phrase: stage.phrase },
    { kind: "facts", items: [{ label: lock.label, value: lock.text }] },
    {
      kind: "keyNumbers",
      items: [
        { value: formatMoney(economics.cacCents), label: SUMMARY_COPY.costPerCustomer },
        { value: formatRatio(economics.ratio), label: SUMMARY_COPY.ratio },
        { value: formatPayback(economics.neverPaysBack ? "never" : economics.paybackMonths), label: SUMMARY_COPY.payback },
      ],
    },
    { kind: "heading", text: SUMMARY_COPY.actionsHeading },
    {
      kind: "actions",
      items: result.plan.map((key, index): ReportActionItem => {
        const info = getActionInfo(key);
        return {
          position: index + 1,
          title: info.title,
          details: [info.reason, ACTION_PROGRESS_COPY.howTo(info.howTo)],
          tag: progressTag(progress.get(key)),
        };
      }),
    },
  ];
  if (topRisk !== undefined) {
    const info = getRiskInfo(topRisk.signalId);
    blocks.push({
      kind: "paragraph",
      tone: "soft",
      text: `${SUMMARY_COPY.highestRisk}: ${info.title} (${RISK_LEVEL_LABELS[topRisk.level]} · ${topRisk.score})`,
    });
  }
  blocks.push({ kind: "notice", text: GUIDANCE_WARNING });
  return { id: "executive-summary", title: PAGE_TITLES.executiveSummary, blocks };
}

function buildDimensionBars(result: DiagnosisResult): ReportDimensionBarsBlock {
  const threshold = rulesV1.dimensionSupport.warnBelow;
  return {
    kind: "dimensionBars",
    threshold,
    groups: (["fit", "front"] as const).map((group) => ({
      label: DIMENSION_GROUP_HEADINGS[group],
      bars: DIMENSION_KEYS.filter((key) => DIMENSIONS[key].group === group).map((key) => {
        const { score, supportsStage, belowWarning } = result.dimensions[key];
        return {
          name: DIMENSIONS[key].name,
          score,
          scoreText: DIMENSION_COPY.scoreText(score),
          supportsText: DIMENSION_COPY.supportsText(supportsStage),
          alertText: belowWarning ? DIMENSION_COPY.belowWarning(threshold) : null,
        };
      }),
    })),
  };
}

function buildRiskBlocks(result: DiagnosisResult): ReportBlock[] {
  if (result.risks.length === 0) {
    return [{ kind: "paragraph", text: NO_RISKS_FOUND }];
  }
  const marks: ReportRiskMark[] = result.risks.map((risk, index) => ({
    number: index + 1,
    probability: risk.probability,
    impact: risk.impact,
    level: risk.level,
  }));
  const items = result.risks.map((risk, index): ReportRiskItem => {
    const info = getRiskInfo(risk.signalId);
    return {
      number: index + 1,
      level: risk.level,
      title: info.title,
      levelLabel: RISK_LEVEL_LABELS[risk.level],
      scoreLine: RISK_COPY.scoreLine(risk.probability, risk.impact, risk.score),
      cause: info.cause,
      howToReduce: RISK_COPY.howToReduce(info.howToReduce),
    };
  });
  return [
    { kind: "paragraph", tone: "soft", text: RISKS_INTRO },
    {
      kind: "riskMatrix",
      size: MATRIX_SIZE,
      marks,
      thresholds: { mediumFrom: rulesV1.risk.mediumFrom, highFrom: rulesV1.risk.highFrom },
      description: RISK_COPY.matrixDescription(
        marks.map((mark) => RISK_COPY.markDescription(mark.number, mark.probability, mark.impact, RISK_LEVEL_LABELS[mark.level])),
      ),
      axesLabel: RISK_COPY.axes,
      legend: (["high", "medium", "low"] as const).map((level) => ({
        level,
        label: RISK_LEVEL_LABELS[level],
        range: riskLevelRange(level),
      })),
    },
    { kind: "riskList", items },
  ];
}

/** "Média (6 de 26 itens sem o número). Parte das respostas é estimada por faixa." plus the provisional note. */
function buildConfidenceParagraphs(result: DiagnosisResult): string[] {
  const { confidence } = result;
  const paragraphs = [`${formatConfidence(confidence)}. ${capitalize(CONFIDENCE_LEVEL_EXPLANATIONS[confidence.level])}`];
  if (confidence.level === "low") {
    paragraphs.push(PROVISIONAL_NOTE);
  }
  return paragraphs;
}

function buildNumbersPage(result: DiagnosisResult, costDiaryOrigin?: DiaryOrigin | null): ReportPage {
  const economics = result.unitEconomics;
  const numbers = buildCalculatedNumbers(result, costDiaryOrigin);
  const band = getRatioBand(economics.ratio);
  const blocks: ReportBlock[] = [
    {
      kind: "explainedNumbers",
      items: [
        { ...numbers.cac, explanation: NUMBERS_COPY.cacExplanation },
        { ...numbers.ltv, explanation: NUMBERS_COPY.ltvExplanation },
        { ...numbers.ratio, explanation: band === null ? NUMBERS_COPY.ratioUnknown : `${band.label}. ${band.phrase}` },
        {
          ...numbers.payback,
          explanation: economics.neverPaysBack ? NUMBERS_COPY.paybackNeverPays : NUMBERS_COPY.paybackExplanation,
        },
      ],
    },
    { kind: "heading", text: NUMBERS_COPY.confidenceHeading },
    ...buildConfidenceParagraphs(result).map((text): ReportBlock => ({ kind: "paragraph", tone: "soft", text })),
  ];
  return { id: "numbers", title: PAGE_TITLES.numbers, blocks };
}

function buildProgressPage(plan: readonly ActionKey[], progress: Map<ActionKey, ReportActionProgress>): ReportPage {
  const items = plan.map((key, index): ReportActionItem => {
    const entry = progress.get(key);
    const dueAndOwner = [
      entry?.dueDate ? ACTION_PROGRESS_COPY.due(entry.dueDate) : null,
      entry?.owner ? ACTION_PROGRESS_COPY.owner(entry.owner) : null,
    ].filter((part): part is string => part !== null);
    const details = [dueAndOwner.join(" · "), entry?.note ? ACTION_PROGRESS_COPY.note(entry.note) : ""].filter(
      (line) => line !== "",
    );
    return {
      position: index + 1,
      title: getActionInfo(key).title,
      details,
      tag: progressTag(entry) ?? { label: ACTION_STATUS_LABELS.todo, tone: "neutral" },
    };
  });
  return {
    id: "action-progress",
    title: PAGE_TITLES.actionProgress,
    blocks: [
      { kind: "paragraph", tone: "soft", text: ACTION_PROGRESS_COPY.intro },
      { kind: "actions", items },
    ],
  };
}

// ---- Answers appendix (AC-ra-09) ----

function labelOf<Key extends string>(options: readonly OptionLabel<Key>[], key: Key | null): string {
  return options.find((option) => option.key === key)?.label ?? ANSWERS_COPY.notInformed;
}

// The parts, or the single total the diary can leave ("Só sei o total"); 0 when nothing was filled in.
function totalSpendCents(calculator: CalculatorInput): number {
  return resolveSpendCents(calculator) ?? 0;
}

function describeSpend(calculator: CalculatorInput): string {
  if (calculator.spendMode === "exact") return formatMoney(totalSpendCents(calculator));
  if (calculator.spendMode === "range") return labelOf(SPEND_RANGE_OPTIONS, calculator.spendRange);
  return calculator.spendMode === "unknown" ? ANSWERS_COPY.unknown : ANSWERS_COPY.notInformed;
}

function describeNewCustomers(calculator: CalculatorInput): string {
  if (calculator.newCustomersMode === "exact") {
    return calculator.newCustomers === null ? ANSWERS_COPY.notInformed : formatInteger(calculator.newCustomers);
  }
  if (calculator.newCustomersMode === "range") return labelOf(NEW_CUSTOMERS_RANGE_OPTIONS, calculator.newCustomersRange);
  return calculator.newCustomersMode === "unknown" ? ANSWERS_COPY.unknown : ANSWERS_COPY.notInformed;
}

/** The value with the mark of the diary beside it, when the number came from there and was not edited since. */
function withDiaryMark(value: string, source: DiaryFieldSource | undefined): string {
  return source ? `${value} (${formatDiaryMark(source)})` : value;
}

function buildCalculatorRows(calculator: CalculatorInput): string[][] {
  const rows = [[CALCULATOR_FIELDS.spend.label, withDiaryMark(describeSpend(calculator), calculator.diarySource?.spend)]];
  if (calculator.spendMode === "exact") {
    for (const part of SPEND_PART_OPTIONS) {
      const cents = calculator.spendParts[part.key];
      if (cents !== undefined && cents > 0) {
        rows.push([ANSWERS_COPY.spendPart(part.label), formatMoney(cents)]);
      }
    }
  }
  rows.push(
    [
      CALCULATOR_FIELDS.newCustomers.label,
      withDiaryMark(describeNewCustomers(calculator), calculator.diarySource?.newCustomers),
    ],
    [
      CALCULATOR_FIELDS.averagePurchase.label,
      calculator.averagePurchaseCents === null ? ANSWERS_COPY.notInformed : formatMoney(calculator.averagePurchaseCents),
    ],
    [CALCULATOR_FIELDS.purchasesPerYear.label, labelOf(PURCHASES_PER_YEAR_OPTIONS, calculator.purchasesPerYear)],
    [CALCULATOR_FIELDS.relationshipLength.label, labelOf(RELATIONSHIP_LENGTH_OPTIONS, calculator.relationshipLength)],
    [
      CALCULATOR_FIELDS.margin.label,
      calculator.marginPercent === null ? ANSWERS_COPY.notInformed : ANSWERS_COPY.marginText(calculator.marginPercent),
    ],
  );
  return rows;
}

function describeAnswer(question: Question, input: DiagnosisInput): string {
  const answer = input.answers[question.id];
  if (answer === undefined) return ANSWERS_COPY.unanswered;
  return answer === null ? (question.unknownLabel ?? ANSWERS_COPY.unknown) : question.options[answer].label;
}

function buildAnswerPages(input: DiagnosisInput): ReportPage[] {
  const pages: ReportPage[] = [
    {
      id: "answers-numbers",
      title: ANSWERS_COPY.numbersTitle,
      blocks: [
        { kind: "paragraph", tone: "soft", text: ANSWERS_COPY.intro },
        { kind: "table", columns: [...ANSWERS_COPY.numbersColumns], rows: buildCalculatorRows(input.calculator) },
      ],
    },
  ];
  for (let from = 0; from < QUESTION_BANK.length; from += ANSWERS_PER_PAGE) {
    const chunk = QUESTION_BANK.slice(from, from + ANSWERS_PER_PAGE);
    pages.push({
      id: `answers-${pages.length}`,
      title: ANSWERS_COPY.questionsTitle(from + 1, from + chunk.length),
      blocks: [
        {
          kind: "table",
          columns: [...ANSWERS_COPY.questionsColumns],
          rows: chunk.map((question, offset) => [`${from + offset + 1}. ${question.text}`, describeAnswer(question, input)]),
        },
      ],
    });
  }
  return pages;
}

/**
 * The diagnosis report, page by page in the order of AC-ra-05: cover, executive summary, the eight
 * dimensions, risks, the numbers, the action tracking (when there is any), "Como ler" and, only
 * when asked, the answers. Without `includeAnswers` the typed values are never read.
 */
export function buildDiagnosisDocument(input: DiagnosisDocumentInput): ReportDocument {
  const { companyName, completedAt, result, timeZone, generatedAt, includeAnswers = false } = input;
  const brand = resolveBrand(input.brand);
  const progress = new Map(
    (input.actionProgress ?? []).map((entry): [ActionKey, ReportActionProgress] => [entry.actionKey, entry]),
  );

  const pages: ReportPage[] = [
    buildCoverPage({
      brand,
      title: REPORT_TITLE,
      subject: companyName,
      facts: [
        { label: "Data do diagnóstico", value: formatReportDate(completedAt, timeZone) },
        { label: "Versão do cálculo", value: String(result.rulesVersion) },
        { label: "Confiança nos dados", value: formatConfidence(result.confidence) },
      ],
      generatedOn: formatReportDate(generatedAt, timeZone),
    }),
    buildSummaryPage(result, progress),
    {
      id: "dimensions",
      title: PAGE_TITLES.dimensions,
      blocks: [{ kind: "paragraph", tone: "soft", text: DIMENSIONS_INTRO }, buildDimensionBars(result)],
    },
    { id: "risks", title: PAGE_TITLES.risks, blocks: buildRiskBlocks(result) },
    buildNumbersPage(result, input.costDiaryOrigin),
  ];
  if (progress.size > 0) {
    pages.push(buildProgressPage(result.plan, progress));
  }
  pages.push(buildHowToReadPage());
  if (includeAnswers) {
    if (!input.diagnosisInput) {
      throw new Error("The answers appendix needs the diagnosis input.");
    }
    pages.push(...buildAnswerPages(input.diagnosisInput));
  }

  return {
    kind: "diagnosis",
    title: REPORT_TITLE,
    subject: companyName,
    footer: buildFooter(brand, DIAGNOSIS_FOOTER_LABEL),
    pages,
  };
}
