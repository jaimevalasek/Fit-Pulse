import { STAGES } from "../../shared/content/stageContent.ts";
import type { ReportBlock, ReportDocument, ReportFact, ReportPage } from "../../shared/report/reportDocument.ts";
import type { Portfolio, PortfolioRow } from "../services/portfolioService.ts";
import { buildCoverPage, buildFooter, buildHowToReadPage, resolveBrand, type ReportBrandInput } from "./documentParts.ts";
import { GUIDANCE_WARNING } from "./reportCopy.ts";
import { formatReportDate } from "./reportModel.ts";

// The portfolio report (AC-ra-15): every active company on a few pages. Pure, like the other
// documents. Every number comes from the portfolio the consultant's home is counted from (the
// portfolio service), so the PDF and the home never disagree.

export const PORTFOLIO_REPORT_TITLE = "Relatório da carteira";

export const PORTFOLIO_FOOTER_LABEL = "Carteira de empresas";

const PORTFOLIO_COPY = {
  byStage: "Empresas por estágio",
  companies: "Empresas ativas",
  companiesPage: (page: number, total: number) => `Empresas ativas (${page} de ${total})`,
  subjectOf: (brandName: string) => `Carteira de ${brandName}`,
  subjectWithoutBrand: "Carteira de empresas",
  activeLabel: "Empresas ativas",
  asOfLabel: "Situação em",
  intervalLabel: "Reavaliação",
  interval: (days: number) => `a cada ${days} dias`,
  byStageIntro: "Cada empresa conta no estágio do diagnóstico mais recente dela.",
  stageLabel: (number: number, name: string) => `Estágio ${number} · ${name}`,
  withoutDiagnosisLabel: "Sem diagnóstico concluído",
  lateLabel: "Reavaliação atrasada",
  highRiskLabel: "Risco alto",
  overdueActionsLabel: "Ações vencidas",
  noOverdueActions: "Nenhuma",
  overdueActionsValue: (actions: number, companies: number) => `${actionCount(actions)} em ${companyCount(companies)}`,
  listIntro: (days: number) => `Reavaliação a cada ${days} dias. As empresas aparecem do estágio 1 ao 4, e as sem diagnóstico por último.`,
  columns: ["Empresa", "Estágio e último diagnóstico", "Atenção"],
  withoutDiagnosis: "Sem diagnóstico",
  stageAndDate: (stage: number, date: string) => `Estágio ${stage} · ${date}`,
  late: (days: number) => `Reavaliação atrasada há ${days === 1 ? "1 dia" : `${days} dias`}`,
  overdueActions: (count: number) => (count === 1 ? "1 ação vencida" : `${count} ações vencidas`),
  onTime: "Em dia",
  noAttention: "—",
} as const;

function companyCount(count: number): string {
  return count === 1 ? "1 empresa" : `${count} empresas`;
}

function actionCount(count: number): string {
  return count === 1 ? "1 ação" : `${count} ações`;
}

// ---------------------------------------------------------------- the list of active companies

// The table draws one A4 sheet per page and fails loudly when a page does not fit, so the list is
// cut into pages here. The cut counts lines per cell with a width narrower than the real one: a
// page is sometimes left with room to spare, never overfull.
const LIST_ROWS_BUDGET = 560;
const LINE_HEIGHT = 14;
const ROW_PADDING = 10;
// Characters that surely fit one line of each column (the first takes 60% of the width, the others share the rest).
const CHARS_PER_LINE = [30, 15, 15] as const;

function estimateLines(text: string, charsPerLine: number): number {
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/).filter((part) => part !== "")) {
    if (used === 0) {
      used = word.length;
    } else if (used + 1 + word.length <= charsPerLine) {
      used += 1 + word.length;
    } else {
      lines += 1;
      used = word.length;
    }
    // A word longer than a line is broken across lines.
    while (used > charsPerLine) {
      lines += 1;
      used -= charsPerLine;
    }
  }
  return lines;
}

function estimateRowHeight(cells: readonly string[]): number {
  const lines = Math.max(...cells.map((cell, index) => estimateLines(cell, CHARS_PER_LINE[index] ?? CHARS_PER_LINE[1])));
  return lines * LINE_HEIGHT + ROW_PADDING;
}

function paginate(rows: readonly string[][]): string[][][] {
  const pages: string[][][] = [];
  let current: string[][] = [];
  let height = 0;
  for (const row of rows) {
    const rowHeight = estimateRowHeight(row);
    if (current.length > 0 && height + rowHeight > LIST_ROWS_BUDGET) {
      pages.push(current);
      current = [];
      height = 0;
    }
    current.push(row);
    height += rowHeight;
  }
  if (current.length > 0) {
    pages.push(current);
  }
  return pages;
}

/** What needs the consultant's attention in one company, in words; "Em dia" when nothing does. */
function attentionOf(row: PortfolioRow): string {
  const notes: string[] = [];
  if (row.reevaluation?.late) {
    notes.push(PORTFOLIO_COPY.late(row.reevaluation.daysLate));
  }
  if (row.highRisk) {
    notes.push(PORTFOLIO_COPY.highRiskLabel);
  }
  if (row.overdueActions !== null && row.overdueActions > 0) {
    notes.push(PORTFOLIO_COPY.overdueActions(row.overdueActions));
  }
  if (notes.length > 0) {
    return notes.join(" · ");
  }
  return row.stage === null ? PORTFOLIO_COPY.noAttention : PORTFOLIO_COPY.onTime;
}

function toTableRow(row: PortfolioRow, timeZone: string | undefined): string[] {
  const stageAndDate =
    row.stage === null || row.lastDiagnosisAt === null
      ? PORTFOLIO_COPY.withoutDiagnosis
      : PORTFOLIO_COPY.stageAndDate(row.stage, formatReportDate(new Date(row.lastDiagnosisAt), timeZone));
  return [row.name, stageAndDate, attentionOf(row)];
}

function buildListPages(portfolio: Portfolio, timeZone: string | undefined): ReportPage[] {
  const pages = paginate(portfolio.rows.map((row) => toTableRow(row, timeZone)));
  return pages.map((rows, index): ReportPage => ({
    id: `companies-${index + 1}`,
    title: pages.length === 1 ? PORTFOLIO_COPY.companies : PORTFOLIO_COPY.companiesPage(index + 1, pages.length),
    blocks: [
      { kind: "paragraph", tone: "soft", text: PORTFOLIO_COPY.listIntro(portfolio.reevaluationDays) },
      { kind: "table", columns: [...PORTFOLIO_COPY.columns], rows },
    ],
  }));
}

// ---------------------------------------------------------------- the summary

/** Whether the actions of the plans are tracked at all: before that, the overdue actions have no column to fill. */
function tracksActions(rows: readonly PortfolioRow[]): boolean {
  return rows.some((row) => row.overdueActions !== null);
}

function buildByStagePage(portfolio: Portfolio): ReportPage {
  const { view, rows } = portfolio;
  const blocks: ReportBlock[] = [
    { kind: "paragraph", tone: "soft", text: PORTFOLIO_COPY.byStageIntro },
    {
      kind: "keyNumbers",
      items: view.byStage.map((group) => ({
        value: String(group.count),
        label: PORTFOLIO_COPY.stageLabel(group.stage, STAGES[group.stage - 1].name),
      })),
    },
  ];

  const attention: ReportFact[] = [
    { label: PORTFOLIO_COPY.withoutDiagnosisLabel, value: companyCount(view.withoutDiagnosis.length) },
    { label: PORTFOLIO_COPY.lateLabel, value: companyCount(view.overdue.length) },
    { label: PORTFOLIO_COPY.highRiskLabel, value: companyCount(view.highRisk.length) },
  ];
  if (tracksActions(rows)) {
    const withOverdue = rows.filter((row) => (row.overdueActions ?? 0) > 0);
    const total = withOverdue.reduce((sum, row) => sum + (row.overdueActions ?? 0), 0);
    attention.push({
      label: PORTFOLIO_COPY.overdueActionsLabel,
      value: total === 0 ? PORTFOLIO_COPY.noOverdueActions : PORTFOLIO_COPY.overdueActionsValue(total, withOverdue.length),
    });
  }
  blocks.push({ kind: "facts", items: attention }, { kind: "notice", text: GUIDANCE_WARNING });
  return { id: "by-stage", title: PORTFOLIO_COPY.byStage, blocks };
}

export interface PortfolioDocumentInput {
  /** The portfolio the home of the consultant is counted from. */
  portfolio: Portfolio;
  /** The day the file is made: the "situação em" of the cover and its credit line. */
  generatedAt: Date;
  /** IANA time zone the dates are read in; the machine's own when omitted. */
  timeZone?: string;
  /** Blank or missing is the FitPulse brand. */
  brand?: ReportBrandInput | null;
}

/**
 * The portfolio report: cover, "Empresas por estágio" (the counts and what needs attention), the
 * list of active companies (as many pages as it takes) and "Como ler". The column of overdue
 * actions exists only once the actions are tracked.
 */
export function buildPortfolioDocument({ portfolio, generatedAt, timeZone, brand: brandInput }: PortfolioDocumentInput): ReportDocument {
  const brand = resolveBrand(brandInput);
  const generatedOn = formatReportDate(generatedAt, timeZone);
  const subject = brand.custom ? PORTFOLIO_COPY.subjectOf(brand.name) : PORTFOLIO_COPY.subjectWithoutBrand;

  return {
    kind: "portfolio",
    title: PORTFOLIO_REPORT_TITLE,
    subject,
    footer: buildFooter(brand, PORTFOLIO_FOOTER_LABEL),
    pages: [
      buildCoverPage({
        brand,
        title: PORTFOLIO_REPORT_TITLE,
        subject,
        facts: [
          { label: PORTFOLIO_COPY.activeLabel, value: String(portfolio.view.companyCount) },
          { label: PORTFOLIO_COPY.asOfLabel, value: generatedOn },
          { label: PORTFOLIO_COPY.intervalLabel, value: PORTFOLIO_COPY.interval(portfolio.reevaluationDays) },
        ],
        generatedOn,
      }),
      buildByStagePage(portfolio),
      ...buildListPages(portfolio, timeZone),
      buildHowToReadPage(),
    ],
  };
}
