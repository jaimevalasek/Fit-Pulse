import type { RiskLevel, StageNumber } from "../domain/types.ts";

// A report as plain data. The server draws this document into the PDF and the screen draws the
// very same document as the preview, so both show the same pages, titles and numbers (AC-ra-02).
// Everything here is JSON: it crosses the API as is, and every text is already worded.

export type ReportKind = "diagnosis" | "evolution" | "portfolio";

export interface ReportFact {
  label: string;
  value: string;
}

/** `neutral` is plain ink; the other tones add color, never meaning: the label always says it too. */
export type ReportTone = "neutral" | "ok" | "warn" | "bad";

export interface ReportTag {
  label: string;
  tone: ReportTone;
}

/** Who delivers the report. Every report carries one; a blank brand is FitPulse (BR-ra-04). */
export interface ReportBrand {
  /** Printed on the cover and in the footer. */
  name: string;
  /** True when the name is the user's own: the cover then says "Preparado por …". */
  custom: boolean;
  phone: string | null;
  email: string | null;
  site: string | null;
  /** PNG or JPEG as a data URL, small enough to travel inside the document; null without a logo. */
  logoDataUrl: string | null;
}

export interface ReportCoverBlock {
  kind: "cover";
  brand: ReportBrand;
  title: string;
  /** The company (or the portfolio) the report is about. */
  subject: string;
  facts: ReportFact[];
  /** Phone, e-mail and site of the brand in one line; null when none was given. */
  contactLine: string | null;
  /** "Preparado por … com o FitPulse em 25/10/2026". */
  credit: string;
}

export interface ReportHeadingBlock {
  kind: "heading";
  text: string;
}

export interface ReportParagraphBlock {
  kind: "paragraph";
  text: string;
  tone?: "soft" | "muted";
}

export interface ReportFactsBlock {
  kind: "facts";
  items: ReportFact[];
}

/** The big numbers of a page: a value with what it measures under it. */
export interface ReportKeyNumbersBlock {
  kind: "keyNumbers";
  items: Array<{ value: string; label: string }>;
}

export interface ReportStageBlock {
  kind: "stage";
  number: StageNumber;
  /** How many stages there are, for "Estágio 2 de 4". */
  total: number;
  name: string;
  phrase: string;
}

export interface ReportActionItem {
  position: number;
  title: string;
  /** One printed line each: why, how, deadline, owner, note. */
  details: string[];
  /** The state of the action, when it is tracked. */
  tag: ReportTag | null;
}

export interface ReportActionListBlock {
  kind: "actions";
  items: ReportActionItem[];
}

export interface ReportDimensionBar {
  name: string;
  score: number;
  /** "32 de 100": the score in words, so the bar never depends on its color. */
  scoreText: string;
  /** "Sustentaria o estágio 2". */
  supportsText: string;
  /** "abaixo de 50" under the warning line; null otherwise. */
  alertText: string | null;
}

export interface ReportDimensionGroup {
  label: string;
  bars: ReportDimensionBar[];
}

export interface ReportDimensionBarsBlock {
  kind: "dimensionBars";
  /** Where the dashed warning line is drawn (50). */
  threshold: number;
  groups: ReportDimensionGroup[];
}

export interface ReportRiskMark {
  /** The number printed inside the cell and next to the risk in the list. */
  number: number;
  probability: number;
  impact: number;
  level: RiskLevel;
}

/** The 5×5 probability × impact grid; each risk sits in its cell with its list number. */
export interface ReportRiskMatrixBlock {
  kind: "riskMatrix";
  size: number;
  marks: ReportRiskMark[];
  /** First score of the medium and high levels, to color the cells. */
  thresholds: { mediumFrom: number; highFrom: number };
  /** The grid in words, for the preview's accessible name. */
  description: string;
  /** What the two axes are, printed under the grid. */
  axesLabel: string;
  legend: Array<{ level: RiskLevel; label: string; range: string }>;
}

export interface ReportRiskItem {
  number: number;
  level: RiskLevel;
  title: string;
  /** "Alto" next to the score, so the level is never only a color. */
  levelLabel: string;
  /** "Probabilidade 4 de 5 · Impacto 5 de 5 · Nota 4 × 5 = 20". */
  scoreLine: string;
  cause: string;
  /** "Como reduzir: …". */
  howToReduce: string;
}

export interface ReportRiskListBlock {
  kind: "riskList";
  items: ReportRiskItem[];
}

/** A number with what it means, as in "Seus números". */
export interface ReportExplainedNumbersBlock {
  kind: "explainedNumbers";
  items: Array<{ label: string; value: string; explanation: string }>;
}

export interface ReportListBlock {
  kind: "list";
  items: string[];
}

export interface ReportTableBlock {
  kind: "table";
  columns: string[];
  rows: string[][];
}

/** A boxed notice, such as the guidance warning. */
export interface ReportNoticeBlock {
  kind: "notice";
  text: string;
}

export type ReportBlock =
  | ReportCoverBlock
  | ReportHeadingBlock
  | ReportParagraphBlock
  | ReportFactsBlock
  | ReportKeyNumbersBlock
  | ReportStageBlock
  | ReportActionListBlock
  | ReportDimensionBarsBlock
  | ReportRiskMatrixBlock
  | ReportRiskListBlock
  | ReportExplainedNumbersBlock
  | ReportListBlock
  | ReportTableBlock
  | ReportNoticeBlock;

export interface ReportPage {
  /** Stable across changes of options, so the preview can tell which page changed. */
  id: string;
  /** Printed at the top of the page; the cover prints the report title. */
  title: string;
  /** One A4 page: the renderer rejects a page that does not fit. */
  blocks: ReportBlock[];
}

export interface ReportFooter {
  /** Left side of the footer; the renderer adds "Página N de M" on the right. */
  text: string;
}

export interface ReportDocument {
  kind: ReportKind;
  title: string;
  /** The company (or the portfolio) the report is about. */
  subject: string;
  footer: ReportFooter;
  pages: ReportPage[];
}
