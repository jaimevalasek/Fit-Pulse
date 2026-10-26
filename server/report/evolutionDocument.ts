import { getActionInfo } from "../../shared/content/actionCatalog.ts";
import { STAGE_MOVES, formatDelta, recalculationNotice } from "../../shared/content/comparisonCopy.ts";
import { DIMENSIONS, LAST_STEP_PHRASE, LOCK_PHRASES, getStage } from "../../shared/content/stageContent.ts";
import type { DiagnosisComparison, DimensionChange } from "../../shared/domain/compareDiagnoses.ts";
import {
  DIARY_CHART_MONTHS,
  computeMonthCostCents,
  listDiaryEntries,
  type DiaryChartPoint,
  type DiaryEntry,
} from "../../shared/domain/diary.ts";
import type { DiagnosisResult } from "../../shared/domain/types.ts";
import { localIsoMonth } from "../../shared/format/dates.ts";
import { formatMoney } from "../../shared/format/money.ts";
import type {
  ReportActionItem,
  ReportBlock,
  ReportDimensionBar,
  ReportDocument,
  ReportPage,
  ReportTag,
} from "../../shared/report/reportDocument.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { buildCoverPage, buildFooter, buildHowToReadPage, resolveBrand, type ReportBrandInput } from "./documentParts.ts";
import {
  ACTION_PROGRESS_COPY,
  ACTION_STATUS_LABELS,
  COST_ORIGIN_LABELS,
  DIMENSION_COPY,
  DIMENSION_GROUP_HEADINGS,
  GUIDANCE_WARNING,
} from "./reportCopy.ts";
import { formatReportDate, type ReportActionProgress, type ReportActionStatus } from "./reportModel.ts";

// The evolution report (AC-ra-12, AC-ra-13): two diagnoses of one company side by side. Pure, like
// the diagnosis document: the same pair always gives the same pages. The numbers all come from the
// comparison the "Comparar" screen shows, so the two never disagree (RULE-ra-02).

export const EVOLUTION_REPORT_TITLE = "Relatório de evolução";

export const EVOLUTION_FOOTER_LABEL = "Evolução";

const EVOLUTION_COPY = {
  beforeAfter: "Antes e depois",
  period: "O que foi feito no período",
  // Not an arrow: the PDF fonts have no "→", so a change reads "2 para 3" on the sheet and in the file.
  change: (before: string, after: string) => `${before} para ${after}`,
  stage: (from: string, to: string, move: string) => `Estágio: ${from} para ${to}. ${move}`,
  average: (change: string) => `Média das 8 dimensões: ${change}`,
  cost: (before: string, after: string) => `Custo por cliente · antes: ${before}; agora: ${after}`,
  lockBefore: "Trava antes",
  lockNow: "Trava agora",
  barsIntro: (from: string, to: string, threshold: number) =>
    `Cada dimensão tem duas barras: a de cima é o diagnóstico de ${from} (antes) e a de baixo, o de ${to} (depois). A linha marca ${threshold}: abaixo dela, a dimensão pede atenção.`,
  before: "antes",
  after: "depois",
  periodLabel: "Período",
  elapsed: "Tempo entre os dois",
  calculationVersion: "Versão do cálculo",
  days: (count: number) => (count === 1 ? "1 dia" : `${count} dias`),
  actionsIntro: (date: string) => `As ações do diagnóstico de ${date}, no estado em que estão agora.`,
  continues: "Continua no plano novo",
  closed: (date: string) => `Encerrada com o diagnóstico de ${date}`,
  diaryHeading: "Custo por cliente no diário",
  diaryIntro: (truncated: boolean) =>
    `Custo de um cliente em cada mês anotado no diário durante o período${truncated ? ` (os ${DIARY_CHART_MONTHS} mais recentes)` : ""}.`,
  diaryColumns: ["Mês", "Custo por cliente"],
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_TONES: Record<ReportActionStatus, ReportTag["tone"]> = {
  todo: "neutral",
  doing: "warn",
  done: "ok",
  notApplicable: "neutral",
};

/** What the report says about the period between the two diagnoses; without any of it the page is left out. */
export interface EvolutionPeriod {
  /** The actions of the earlier diagnosis' plan with what the owner tracked, in plan order. */
  actions?: readonly ReportActionProgress[];
  /** Months noted in the diary between the two diagnoses, oldest first. */
  diary?: readonly DiaryChartPoint[];
}

export interface EvolutionDocumentInput {
  companyName: string;
  comparison: DiagnosisComparison;
  /** The earlier result the comparison counted: calculated again when the rules versions differ. */
  previousResult: DiagnosisResult;
  currentResult: DiagnosisResult;
  /** The day the file is made; it only goes into the credit line of the cover. */
  generatedAt: Date;
  /** IANA time zone the dates are read in; the machine's own when omitted. */
  timeZone?: string;
  /** Blank or missing is the FitPulse brand. */
  brand?: ReportBrandInput | null;
  period?: EvolutionPeriod;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** What stops the next stage in the words of the result screen; the last step has nothing to unlock. */
function lockText(result: DiagnosisResult): string {
  return result.lock === null ? LAST_STEP_PHRASE : `${capitalize(LOCK_PHRASES[result.lock])}.`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS));
}

/** `03/2026`: the month of a diary entry, read as the owner typed it. */
function formatDiaryMonth(month: string): string {
  const [year, number] = month.split("-");
  return `${number}/${year}`;
}

/**
 * The cost per customer of each diary month inside the period of the two diagnoses, oldest first
 * (AC-ra-12). The diary is by month, so the month of each diagnosis counts, and every month between
 * them. A month that cannot be read is left out, like everywhere else the diary is used.
 */
export function buildPeriodDiary(entries: readonly DiaryEntry[], from: Date, to: Date): DiaryChartPoint[] {
  const fromMonth = localIsoMonth(from);
  const toMonth = localIsoMonth(to);
  if (fromMonth === null || toMonth === null) {
    return [];
  }
  return listDiaryEntries(entries)
    .filter((entry) => entry.month >= fromMonth && entry.month <= toMonth)
    .reverse()
    .map((entry) => ({ month: entry.month, cacCents: computeMonthCostCents(entry) }));
}

function buildBeforeAfterPage(input: EvolutionDocumentInput): ReportPage {
  const { comparison, previousResult, currentResult, timeZone } = input;
  const { stageChange, average } = comparison;
  const notice = recalculationNotice(comparison, timeZone);

  const blocks: ReportBlock[] = [
    {
      kind: "keyNumbers",
      items: [
        {
          value: EVOLUTION_COPY.change(String(stageChange.from), String(stageChange.to)),
          label: EVOLUTION_COPY.stage(
            getStage(stageChange.from).name,
            getStage(stageChange.to).name,
            STAGE_MOVES[stageChange.direction],
          ),
        },
        {
          value: EVOLUTION_COPY.change(String(average.before), String(average.after)),
          label: EVOLUTION_COPY.average(formatDelta(average.delta)),
        },
      ],
    },
    {
      kind: "keyNumbers",
      items: [
        {
          value: EVOLUTION_COPY.change(formatMoney(previousResult.unitEconomics.cacCents), formatMoney(currentResult.unitEconomics.cacCents)),
          label: EVOLUTION_COPY.cost(
            COST_ORIGIN_LABELS[previousResult.unitEconomics.origin],
            COST_ORIGIN_LABELS[currentResult.unitEconomics.origin],
          ),
        },
      ],
    },
    {
      kind: "facts",
      items: [
        { label: EVOLUTION_COPY.lockBefore, value: lockText(previousResult) },
        { label: EVOLUTION_COPY.lockNow, value: lockText(currentResult) },
      ],
    },
  ];
  if (notice !== null) {
    blocks.push({ kind: "notice", text: notice });
  }
  blocks.push({ kind: "notice", text: GUIDANCE_WARNING });
  return { id: "before-after", title: EVOLUTION_COPY.beforeAfter, blocks };
}

function buildBarPair(
  change: DimensionChange,
  previousResult: DiagnosisResult,
  currentResult: DiagnosisResult,
): ReportDimensionBar[] {
  const threshold = rulesV1.dimensionSupport.warnBelow;
  const name = DIMENSIONS[change.key].name;
  const before = previousResult.dimensions[change.key];
  const after = currentResult.dimensions[change.key];
  return [
    {
      name: `${name}: ${EVOLUTION_COPY.before}`,
      score: change.before,
      scoreText: DIMENSION_COPY.scoreText(change.before),
      supportsText: DIMENSION_COPY.supportsText(before.supportsStage),
      alertText: before.belowWarning ? DIMENSION_COPY.belowWarning(threshold) : null,
    },
    {
      name: `${name}: ${EVOLUTION_COPY.after}`,
      score: change.after,
      scoreText: DIMENSION_COPY.scoreText(change.after),
      supportsText: `${formatDelta(change.delta)} · ${DIMENSION_COPY.supportsText(after.supportsStage)}`,
      alertText: after.belowWarning ? DIMENSION_COPY.belowWarning(threshold) : null,
    },
  ];
}

/** One page per group of dimensions: with two bars each, the eight of them would not fit one A4 sheet. */
function buildBarsPage(group: "fit" | "front", input: EvolutionDocumentInput): ReportPage {
  const { comparison, previousResult, currentResult, timeZone } = input;
  const threshold = rulesV1.dimensionSupport.warnBelow;
  const heading = DIMENSION_GROUP_HEADINGS[group];
  const bars = comparison.dimensions
    .filter((change) => DIMENSIONS[change.key].group === group)
    .flatMap((change) => buildBarPair(change, previousResult, currentResult));
  return {
    id: `before-after-${group}`,
    title: `${EVOLUTION_COPY.beforeAfter}: ${heading.toLowerCase()}`,
    blocks: [
      {
        kind: "paragraph",
        tone: "soft",
        text: EVOLUTION_COPY.barsIntro(
          formatReportDate(new Date(comparison.previous.completedAt), timeZone),
          formatReportDate(new Date(comparison.current.completedAt), timeZone),
          threshold,
        ),
      },
      { kind: "dimensionBars", threshold, groups: [{ label: heading, bars }] },
    ],
  };
}

function periodTag({ status, overdue }: ReportActionProgress): ReportTag {
  const label = ACTION_STATUS_LABELS[status];
  // RULE-ra-06: only an open action (A fazer, Em andamento) can be overdue, whatever the caller sent.
  const open = status === "todo" || status === "doing";
  return overdue && open
    ? { label: `${label}${ACTION_PROGRESS_COPY.overdueSuffix}`, tone: "bad" }
    : { label, tone: STATUS_TONES[status] };
}

function buildPeriodAction(entry: ReportActionProgress, index: number, input: EvolutionDocumentInput): ReportActionItem {
  const { currentResult, comparison, timeZone } = input;
  const continues = currentResult.plan.includes(entry.actionKey);
  const dueAndOwner = [
    entry.dueDate ? ACTION_PROGRESS_COPY.due(entry.dueDate) : null,
    entry.owner ? ACTION_PROGRESS_COPY.owner(entry.owner) : null,
  ].filter((part): part is string => part !== null);
  const closedOn = formatReportDate(new Date(comparison.current.completedAt), timeZone);
  return {
    position: index + 1,
    title: getActionInfo(entry.actionKey).title,
    details: [
      continues ? EVOLUTION_COPY.continues : EVOLUTION_COPY.closed(closedOn),
      dueAndOwner.join(" · "),
      entry.note ? ACTION_PROGRESS_COPY.note(entry.note) : "",
    ].filter((line) => line !== ""),
    tag: periodTag(entry),
  };
}

/** "O que foi feito no período": what the owner did with the earlier plan and what the diary measured. */
function buildPeriodPage(input: EvolutionDocumentInput): ReportPage | null {
  const actions = input.period?.actions ?? [];
  const diary = input.period?.diary ?? [];
  if (actions.length === 0 && diary.length === 0) {
    return null;
  }

  const blocks: ReportBlock[] = [];
  if (actions.length > 0) {
    const fromDate = formatReportDate(new Date(input.comparison.previous.completedAt), input.timeZone);
    blocks.push(
      { kind: "paragraph", tone: "soft", text: EVOLUTION_COPY.actionsIntro(fromDate) },
      { kind: "actions", items: actions.map((entry, index) => buildPeriodAction(entry, index, input)) },
    );
  }
  if (diary.length > 0) {
    const shown = diary.slice(-DIARY_CHART_MONTHS);
    blocks.push(
      { kind: "heading", text: EVOLUTION_COPY.diaryHeading },
      { kind: "paragraph", tone: "soft", text: EVOLUTION_COPY.diaryIntro(shown.length < diary.length) },
      {
        kind: "table",
        columns: [...EVOLUTION_COPY.diaryColumns],
        rows: shown.map((point) => [formatDiaryMonth(point.month), formatMoney(point.cacCents)]),
      },
    );
  }
  return { id: "period", title: EVOLUTION_COPY.period, blocks };
}

/**
 * The evolution report: cover, "Antes e depois" (summary and the dimensions in two pages),
 * "O que foi feito no período" only when there is tracking or diary to show, and "Como ler".
 */
export function buildEvolutionDocument(input: EvolutionDocumentInput): ReportDocument {
  const { companyName, comparison, generatedAt, timeZone } = input;
  const brand = resolveBrand(input.brand);
  const fromDate = formatReportDate(new Date(comparison.previous.completedAt), timeZone);
  const toDate = formatReportDate(new Date(comparison.current.completedAt), timeZone);

  const pages: ReportPage[] = [
    buildCoverPage({
      brand,
      title: EVOLUTION_REPORT_TITLE,
      subject: companyName,
      facts: [
        { label: EVOLUTION_COPY.periodLabel, value: `${fromDate} a ${toDate}` },
        {
          label: EVOLUTION_COPY.elapsed,
          value: EVOLUTION_COPY.days(daysBetween(comparison.previous.completedAt, comparison.current.completedAt)),
        },
        { label: EVOLUTION_COPY.calculationVersion, value: String(comparison.current.rulesVersion) },
      ],
      generatedOn: formatReportDate(generatedAt, timeZone),
    }),
    buildBeforeAfterPage(input),
    buildBarsPage("fit", input),
    buildBarsPage("front", input),
  ];
  const periodPage = buildPeriodPage(input);
  if (periodPage !== null) {
    pages.push(periodPage);
  }
  pages.push(buildHowToReadPage());

  return {
    kind: "evolution",
    title: EVOLUTION_REPORT_TITLE,
    subject: companyName,
    footer: buildFooter(brand, EVOLUTION_FOOTER_LABEL),
    pages,
  };
}
