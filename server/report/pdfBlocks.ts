import type {
  ReportActionItem,
  ReportActionListBlock,
  ReportCoverBlock,
  ReportExplainedNumbersBlock,
  ReportFactsBlock,
  ReportKeyNumbersBlock,
  ReportListBlock,
  ReportNoticeBlock,
  ReportParagraphBlock,
  ReportRiskListBlock,
  ReportStageBlock,
  ReportTableBlock,
  ReportTone,
} from "../../shared/report/reportDocument.ts";
import { PAPER_PALETTE, PAPER_TONE_COLORS, PAPER_TONE_WASHES } from "../../shared/report/paperPalette.ts";
import type { RiskLevel } from "../../shared/domain/types.ts";
import { SUMMARY_COPY } from "./reportCopy.ts";

// The text blocks of a report page, drawn with pdfkit. Every block measures itself before it
// draws, so a page that does not fit one A4 sheet fails loudly (PageOverflowError) instead of
// spilling onto a second sheet: the preview shows one sheet per page and the PDF must match it.

export type FontRole = "body" | "strong" | "mono" | "monoStrong";

export const PAGE_WIDTH = 595.28;
export const PAGE_HEIGHT = 841.89;
export const PAGE_MARGIN = 56;
/** Room kept under the content for the footer line. */
export const FOOTER_RESERVE = 64;
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
export const CONTENT_BOTTOM = PAGE_HEIGHT - FOOTER_RESERVE;

const LINE_GAP = 2;
const FACT_LABEL_WIDTH = 150;

export const RISK_LEVEL_COLORS: Record<RiskLevel, string> = {
  high: PAPER_PALETTE.danger,
  medium: PAPER_PALETTE.copper,
  low: PAPER_PALETTE.soft,
};

export const RISK_LEVEL_WASHES: Record<RiskLevel, string> = {
  high: PAPER_PALETTE.dangerWash,
  medium: PAPER_PALETTE.copperWash,
  low: PAPER_PALETTE.accentWash,
};

export class PageOverflowError extends Error {
  constructor(
    readonly pageId: string,
    readonly overflow: number,
  ) {
    super(`Page "${pageId}" does not fit one A4 sheet: ${Math.ceil(overflow)} pt too tall.`);
    this.name = "PageOverflowError";
  }
}

export interface TextStyle {
  font?: FontRole;
  size?: number;
  color?: string;
  align?: "left" | "right" | "center";
}

/** The cursor of one page. `x` and `width` are the column being drawn; blocks never leave it. */
export class Sheet {
  x = PAGE_MARGIN;
  y = PAGE_MARGIN;
  width = CONTENT_WIDTH;

  constructor(
    readonly doc: PDFKit.PDFDocument,
    readonly pageId: string,
  ) {}

  /** Throws unless `height` more points fit above the footer. */
  require(height: number): void {
    const overflow = this.y + height - CONTENT_BOTTOM;
    if (overflow > 0.5) {
      throw new PageOverflowError(this.pageId, overflow);
    }
  }

  /** Draws inside a narrower column and returns where the column ended; `y` is left for the caller. */
  column(x: number, width: number, draw: () => void): number {
    const saved = { x: this.x, width: this.width };
    this.x = x;
    this.width = width;
    draw();
    const end = this.y;
    this.x = saved.x;
    this.width = saved.width;
    return end;
  }

  apply({ font = "body", size = 10, color = PAPER_PALETTE.ink }: TextStyle): void {
    this.doc.font(font).fontSize(size).fillColor(color);
  }

  measure(text: string, style: TextStyle = {}, width: number = this.width): number {
    this.apply(style);
    return this.doc.heightOfString(text, { width, lineGap: LINE_GAP });
  }

  widthOf(text: string, style: TextStyle = {}): number {
    this.apply(style);
    return this.doc.widthOfString(text);
  }

  /** A wrapped paragraph at the cursor; `inset` pushes it in from the left. */
  write(text: string, style: TextStyle = {}, after = 4, inset = 0): void {
    const width = this.width - inset;
    const height = this.measure(text, style, width);
    this.require(height);
    this.apply(style);
    this.doc.text(text, this.x + inset, this.y, { width, lineGap: LINE_GAP, align: style.align });
    this.y += height + after;
  }

  /** One line of text at a fixed place; the cursor stays where it was. */
  place(text: string, x: number, y: number, width: number, style: TextStyle = {}): void {
    this.apply(style);
    this.doc.text(text, x, y, { width, align: style.align, lineBreak: false });
  }

  rule(color: string = PAPER_PALETTE.line, after = 8, lineWidth = 0.7): void {
    this.require(after);
    this.doc
      .save()
      .moveTo(this.x, this.y)
      .lineTo(this.x + this.width, this.y)
      .lineWidth(lineWidth)
      .strokeColor(color)
      .stroke()
      .restore();
    this.y += after;
  }
}

/** A small bordered label. The text says everything the color says. Returns its width. */
export function drawPill(sheet: Sheet, label: string, tone: ReportTone | { color: string; wash: string }, x: number, y: number): number {
  const { color, wash } =
    typeof tone === "string" ? { color: PAPER_TONE_COLORS[tone], wash: PAPER_TONE_WASHES[tone] } : tone;
  const style: TextStyle = { font: "strong", size: 8, color };
  const width = sheet.widthOf(label, style) + 12;
  sheet.doc.save().roundedRect(x, y, width, 14, 7).lineWidth(0.7).fillAndStroke(wash, color).restore();
  sheet.place(label, x + 6, y + 3.5, width - 6, style);
  return width;
}

export function pillWidth(sheet: Sheet, label: string): number {
  return sheet.widthOf(label, { font: "strong", size: 8 }) + 12;
}

export function drawPageTitle(sheet: Sheet, title: string): void {
  sheet.write(title, { font: "strong", size: 19 }, 6);
  sheet.rule(PAPER_PALETTE.accent, 16, 1.5);
}

export function drawHeading(sheet: Sheet, text: string): void {
  sheet.require(40);
  sheet.y += 8;
  sheet.write(text, { font: "strong", size: 12.5 }, 5);
  sheet.rule();
}

export function drawParagraph(sheet: Sheet, block: ReportParagraphBlock): void {
  if (block.tone === "muted") {
    sheet.write(block.text, { size: 9, color: PAPER_PALETTE.muted }, 10);
  } else if (block.tone === "soft") {
    sheet.write(block.text, { size: 10, color: PAPER_PALETTE.soft }, 10);
  } else {
    sheet.write(block.text, { size: 10.5 }, 10);
  }
}

export function drawFacts(sheet: Sheet, block: ReportFactsBlock): void {
  const valueStyle: TextStyle = { font: "strong", size: 10.5 };
  for (const fact of block.items) {
    const valueWidth = sheet.width - FACT_LABEL_WIDTH;
    const height = Math.max(sheet.measure(fact.value, valueStyle, valueWidth), 12);
    sheet.require(height + 6);
    sheet.place(fact.label, sheet.x, sheet.y + 1, FACT_LABEL_WIDTH - 10, { size: 9, color: PAPER_PALETTE.muted });
    sheet.write(fact.value, valueStyle, 6, FACT_LABEL_WIDTH);
  }
  sheet.y += 4;
}

/** The big numbers of the summary, side by side in one panel. */
export function drawKeyNumbers(sheet: Sheet, block: ReportKeyNumbersBlock): void {
  const count = block.items.length;
  if (count === 0) {
    return;
  }
  const padding = 10;
  const column = (sheet.width - padding * 2) / count;
  const labelWidth = column - 12;
  const labelStyle: TextStyle = { size: 8.5, color: PAPER_PALETTE.muted };
  const labelHeight = Math.max(...block.items.map((item) => sheet.measure(item.label, labelStyle, labelWidth)));
  const height = padding * 2 + 24 + labelHeight;
  sheet.require(height + 12);

  const top = sheet.y;
  sheet.doc.save().roundedRect(sheet.x, top, sheet.width, height, 4).lineWidth(0.7).fillAndStroke(PAPER_PALETTE.panel, PAPER_PALETTE.line).restore();
  block.items.forEach((item, index) => {
    const left = sheet.x + padding + column * index;
    if (index > 0) {
      sheet.doc
        .save()
        .moveTo(left - 6, top + padding)
        .lineTo(left - 6, top + height - padding)
        .lineWidth(0.7)
        .strokeColor(PAPER_PALETTE.line)
        .stroke()
        .restore();
    }
    // The value shrinks until it fits its column: "R$ 12.345,67" must never run into the next one.
    let size = 17;
    while (size > 10 && sheet.widthOf(item.value, { font: "monoStrong", size }) > labelWidth) {
      size -= 1;
    }
    sheet.place(item.value, left, top + padding, labelWidth, { font: "monoStrong", size });
    sheet.apply(labelStyle);
    sheet.doc.text(item.label, left, top + padding + 24, { width: labelWidth, lineGap: LINE_GAP });
  });
  sheet.y = top + height + 12;
}

export function drawStage(sheet: Sheet, block: ReportStageBlock): void {
  const title = `${SUMMARY_COPY.stageOf(block.number, block.total)} · ${block.name}`;
  const titleStyle: TextStyle = { font: "strong", size: 16 };
  const phraseStyle: TextStyle = { size: 11, color: PAPER_PALETTE.soft };
  sheet.require(14 + sheet.measure(title, titleStyle) + sheet.measure(block.phrase, phraseStyle) + 14);

  const gap = 6;
  const segment = (sheet.width - gap * (block.total - 1)) / block.total;
  for (let step = 1; step <= block.total; step += 1) {
    sheet.doc
      .save()
      .roundedRect(sheet.x + (step - 1) * (segment + gap), sheet.y, segment, 6, 3)
      .fill(step <= block.number ? PAPER_PALETTE.accent : PAPER_PALETTE.track)
      .restore();
  }
  sheet.y += 16;
  sheet.write(title, titleStyle, 4);
  sheet.write(block.phrase, phraseStyle, 12);
}

function drawActionItem(sheet: Sheet, item: ReportActionItem): void {
  const inset = 24;
  const tagWidth = item.tag === null ? 0 : pillWidth(sheet, item.tag.label);
  const titleWidth = sheet.width - inset - (tagWidth > 0 ? tagWidth + 10 : 0);
  const titleStyle: TextStyle = { font: "strong", size: 11 };
  const detailStyle: TextStyle = { size: 9.5, color: PAPER_PALETTE.soft };
  const titleHeight = sheet.measure(item.title, titleStyle, titleWidth);
  const detailsHeight = item.details.reduce((sum, line) => sum + sheet.measure(line, detailStyle, sheet.width - inset) + 3, 0);
  sheet.require(Math.max(titleHeight, 14) + 3 + detailsHeight + 12);

  const top = sheet.y;
  sheet.place(`${item.position}`, sheet.x, top, inset - 4, { font: "monoStrong", size: 13, color: PAPER_PALETTE.accent });
  if (item.tag !== null) {
    drawPill(sheet, item.tag.label, item.tag.tone, sheet.x + sheet.width - tagWidth, top);
  }
  sheet.apply(titleStyle);
  sheet.doc.text(item.title, sheet.x + inset, top, { width: titleWidth, lineGap: LINE_GAP });
  sheet.y = top + Math.max(titleHeight, 14) + 3;
  for (const line of item.details) {
    sheet.write(line, detailStyle, 3, inset);
  }
  sheet.y += 9;
}

export function drawActions(sheet: Sheet, block: ReportActionListBlock): void {
  for (const item of block.items) {
    drawActionItem(sheet, item);
  }
}

/** A number with its meaning: the label and the value on the left, the explanation beside them. */
export function drawExplainedNumbers(sheet: Sheet, block: ReportExplainedNumbersBlock): void {
  const leftWidth = 170;
  const gap = 16;
  const labelStyle: TextStyle = { size: 9, color: PAPER_PALETTE.muted };
  const valueStyle: TextStyle = { font: "monoStrong", size: 15 };
  const explanationStyle: TextStyle = { size: 10, color: PAPER_PALETTE.soft };
  for (const item of block.items) {
    const rightWidth = sheet.width - leftWidth - gap;
    const leftHeight = sheet.measure(item.label, labelStyle, leftWidth) + 4 + sheet.measure(item.value, valueStyle, leftWidth);
    const height = Math.max(leftHeight, sheet.measure(item.explanation, explanationStyle, rightWidth));
    sheet.require(height + 16);

    const top = sheet.y;
    sheet.apply(labelStyle);
    sheet.doc.text(item.label, sheet.x, top, { width: leftWidth, lineGap: LINE_GAP });
    sheet.apply(valueStyle);
    sheet.doc.text(item.value, sheet.x, top + sheet.measure(item.label, labelStyle, leftWidth) + 4, { width: leftWidth, lineGap: LINE_GAP });
    sheet.apply(explanationStyle);
    sheet.doc.text(item.explanation, sheet.x + leftWidth + gap, top, { width: rightWidth, lineGap: LINE_GAP });
    sheet.y = top + height + 8;
    sheet.rule(PAPER_PALETTE.line, 8);
  }
}

export function drawList(sheet: Sheet, block: ReportListBlock): void {
  const inset = 14;
  for (const item of block.items) {
    const height = sheet.measure(item, { size: 10, color: PAPER_PALETTE.soft }, sheet.width - inset);
    sheet.require(height + 4);
    sheet.doc.save().circle(sheet.x + 4, sheet.y + 5.5, 1.8).fill(PAPER_PALETTE.accent).restore();
    sheet.write(item, { size: 10, color: PAPER_PALETTE.soft }, 4, inset);
  }
  sheet.y += 6;
}

/** A header row and the rows under it; the first column takes 60% of the width, the others share the rest. */
export function drawTable(sheet: Sheet, block: ReportTableBlock): void {
  const count = block.columns.length;
  if (count === 0) {
    return;
  }
  const firstWidth = count === 1 ? sheet.width : sheet.width * 0.6;
  const widths = block.columns.map((_, index) => (index === 0 ? firstWidth : (sheet.width - firstWidth) / (count - 1)));
  const padding = 6;
  const headerStyle: TextStyle = { font: "strong", size: 9, color: PAPER_PALETTE.soft };
  const cellStyle: TextStyle = { size: 9.5 };
  const columnX = (index: number): number => sheet.x + widths.slice(0, index).reduce((sum, width) => sum + width, 0);

  const drawRow = (cells: string[], style: TextStyle, fill: string | null): void => {
    const height = Math.max(...cells.map((cell, index) => sheet.measure(cell, style, widths[index] - padding * 2))) + padding * 2 - 2;
    sheet.require(height);
    const top = sheet.y;
    if (fill !== null) {
      sheet.doc.save().rect(sheet.x, top, sheet.width, height).fill(fill).restore();
    }
    cells.forEach((cell, index) => {
      sheet.apply(style);
      sheet.doc.text(cell, columnX(index) + padding, top + padding - 1, { width: widths[index] - padding * 2, lineGap: LINE_GAP });
    });
    sheet.y = top + height;
    sheet.rule(PAPER_PALETTE.line, 0);
  };

  drawRow(block.columns, headerStyle, PAPER_PALETTE.panel);
  for (const row of block.rows) {
    drawRow(row, cellStyle, null);
  }
  sheet.y += 10;
}

/** A boxed notice with an accent edge: the guidance warning. */
export function drawNotice(sheet: Sheet, block: ReportNoticeBlock): void {
  const padding = 10;
  const style: TextStyle = { size: 9.5, color: PAPER_PALETTE.soft };
  const height = sheet.measure(block.text, style, sheet.width - padding * 2 - 4) + padding * 2;
  sheet.require(height + 10);
  const top = sheet.y;
  sheet.doc.save().roundedRect(sheet.x, top, sheet.width, height, 4).lineWidth(0.7).fillAndStroke(PAPER_PALETTE.panel, PAPER_PALETTE.line).restore();
  sheet.doc.save().rect(sheet.x, top, 3, height).fill(PAPER_PALETTE.accent).restore();
  sheet.apply(style);
  sheet.doc.text(block.text, sheet.x + padding + 4, top + padding, { width: sheet.width - padding * 2 - 4, lineGap: LINE_GAP });
  sheet.y = top + height + 10;
}

/** The risks, one after the other: number, title, level, P × I, the cause and how to reduce it. */
export function drawRiskList(sheet: Sheet, block: ReportRiskListBlock): void {
  const inset = 22;
  const textWidth = sheet.width - inset;
  const titleStyle: TextStyle = { font: "strong", size: 10 };
  const scoreStyle: TextStyle = { size: 8, color: PAPER_PALETTE.muted };
  const bodyStyle: TextStyle = { size: 8.5, color: PAPER_PALETTE.soft };
  for (const item of block.items) {
    const levelColor = RISK_LEVEL_COLORS[item.level];
    const levelWidth = pillWidth(sheet, item.levelLabel);
    const scoreWidth = textWidth - levelWidth - 6;
    const titleHeight = sheet.measure(item.title, titleStyle, textWidth);
    const scoreHeight = Math.max(sheet.measure(item.scoreLine, scoreStyle, scoreWidth), 14);
    const causeHeight = sheet.measure(item.cause, bodyStyle, textWidth);
    const reduceHeight = sheet.measure(item.howToReduce, bodyStyle, textWidth);
    sheet.require(titleHeight + 3 + scoreHeight + 4 + causeHeight + 3 + reduceHeight + 12);

    const top = sheet.y;
    sheet.doc.save().circle(sheet.x + 8, top + 8, 8).fill(levelColor).restore();
    sheet.place(`${item.number}`, sheet.x, top + 4.5, 16, { font: "monoStrong", size: 9, color: PAPER_PALETTE.paper, align: "center" });
    sheet.apply(titleStyle);
    sheet.doc.text(item.title, sheet.x + inset, top + 1, { width: textWidth, lineGap: LINE_GAP });
    let y = top + 1 + titleHeight + 3;
    drawPill(sheet, item.levelLabel, { color: levelColor, wash: RISK_LEVEL_WASHES[item.level] }, sheet.x + inset, y);
    sheet.apply(scoreStyle);
    sheet.doc.text(item.scoreLine, sheet.x + inset + levelWidth + 6, y + 1.5, { width: scoreWidth, lineGap: LINE_GAP });
    y += scoreHeight + 4;
    sheet.apply(bodyStyle);
    sheet.doc.text(item.cause, sheet.x + inset, y, { width: textWidth, lineGap: LINE_GAP });
    y += causeHeight + 3;
    sheet.doc.text(item.howToReduce, sheet.x + inset, y, { width: textWidth, lineGap: LINE_GAP });
    sheet.y = y + reduceHeight + 12;
  }
}

function dataUrlImage(sheet: Sheet, dataUrl: string): { data: Buffer; width: number; height: number } | null {
  const match = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (match === null) {
    return null;
  }
  try {
    const data = Buffer.from(match[1], "base64");
    const image = (sheet.doc as unknown as { openImage(source: Buffer): { width: number; height: number } }).openImage(data);
    return { data, width: image.width, height: image.height };
  } catch {
    // A logo pdfkit cannot read never stops the report: the brand name is printed anyway.
    return null;
  }
}

/** The first page: the brand, the report title, the company, the facts and the credit line. */
export function drawCover(sheet: Sheet, block: ReportCoverBlock): void {
  const { brand } = block;
  let top = sheet.y;
  const logo = brand.logoDataUrl === null ? null : dataUrlImage(sheet, brand.logoDataUrl);
  if (logo !== null) {
    const scale = Math.min(150 / logo.width, 64 / logo.height, 1);
    sheet.doc.image(logo.data, sheet.x, top, { width: logo.width * scale, height: logo.height * scale });
    top += logo.height * scale + 10;
  }
  sheet.y = top;
  sheet.write(brand.name, { font: "monoStrong", size: 11, color: PAPER_PALETTE.accent }, 0);

  sheet.y = Math.max(sheet.y + 90, 240);
  sheet.write(block.title, { font: "strong", size: 26 }, 12, 0);
  sheet.doc.save().rect(sheet.x, sheet.y, 48, 3).fill(PAPER_PALETTE.accent).restore();
  sheet.y += 18;
  sheet.write(block.subject, { font: "strong", size: 18, color: PAPER_PALETTE.soft }, 22);

  for (const fact of block.facts) {
    const valueStyle: TextStyle = { font: "strong", size: 11 };
    const height = sheet.measure(fact.value, valueStyle, sheet.width - FACT_LABEL_WIDTH);
    sheet.require(height + 10);
    sheet.place(fact.label, sheet.x, sheet.y + 1.5, FACT_LABEL_WIDTH - 10, { size: 9, color: PAPER_PALETTE.muted });
    sheet.write(fact.value, valueStyle, 10, FACT_LABEL_WIDTH);
  }

  // The closing lines sit at the foot of the sheet, above the footer.
  const contactStyle: TextStyle = { size: 9.5, color: PAPER_PALETTE.soft };
  const creditStyle: TextStyle = { size: 9, color: PAPER_PALETTE.muted };
  const closing =
    10 + sheet.measure(block.credit, creditStyle) + (block.contactLine === null ? 0 : sheet.measure(block.contactLine, contactStyle) + 6);
  sheet.y = Math.max(sheet.y + 20, CONTENT_BOTTOM - closing - 4);
  sheet.rule(PAPER_PALETTE.line, 10);
  if (block.contactLine !== null) {
    sheet.write(block.contactLine, contactStyle, 6);
  }
  sheet.write(block.credit, creditStyle, 0);
}
