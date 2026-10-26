import type {
  ReportDimensionBar,
  ReportDimensionBarsBlock,
  ReportRiskListBlock,
  ReportRiskMark,
  ReportRiskMatrixBlock,
} from "../../shared/report/reportDocument.ts";
import { PAPER_PALETTE } from "../../shared/report/paperPalette.ts";
import type { RiskLevel } from "../../shared/domain/types.ts";
import { RISK_LEVEL_COLORS, RISK_LEVEL_WASHES, Sheet, drawPill, drawRiskList, pillWidth } from "./pdfBlocks.ts";

// The two charts of the diagnosis: the dimension bars and the risk matrix. They are made to be
// read on a gray-scale print: every bar says its score in words, the dashed line of 50 is labelled,
// a bar under it is hatched and carries the words "abaixo de 50", and every risk in the matrix
// wears its list number. No color is the only carrier of a fact.

const BAR_HEIGHT = 9;
const ALERT_TONE = { color: PAPER_PALETTE.danger, wash: PAPER_PALETTE.dangerWash };

function drawFill(sheet: Sheet, x: number, y: number, width: number, hatched: boolean): void {
  const { doc } = sheet;
  const color = hatched ? PAPER_PALETTE.copper : PAPER_PALETTE.accent;
  doc.save().roundedRect(x, y, width, BAR_HEIGHT, BAR_HEIGHT / 2).fill(color).restore();
  if (hatched) {
    // Diagonal paper-colored strokes over the fill: a pattern that survives a black-and-white print.
    doc.save().roundedRect(x, y, width, BAR_HEIGHT, BAR_HEIGHT / 2).clip();
    for (let start = x - BAR_HEIGHT; start < x + width; start += 4) {
      doc
        .moveTo(start, y + BAR_HEIGHT)
        .lineTo(start + BAR_HEIGHT, y)
        .lineWidth(1)
        .strokeColor(PAPER_PALETTE.paper)
        .stroke();
    }
    doc.restore();
  }
}

function drawBar(sheet: Sheet, bar: ReportDimensionBar, threshold: number): void {
  const nameWidth = sheet.width - 120;
  const supportsStyle = { size: 8.5, color: PAPER_PALETTE.muted };
  const supportsHeight = Math.max(sheet.measure(bar.supportsText, supportsStyle, nameWidth), 14);
  sheet.require(15 + 9 + BAR_HEIGHT + 6 + supportsHeight + 10);

  const top = sheet.y;
  sheet.place(bar.name, sheet.x, top, nameWidth, { font: "strong", size: 10.5 });
  sheet.place(bar.scoreText, sheet.x + sheet.width - 120, top, 120, { font: "monoStrong", size: 10.5, align: "right" });

  const barTop = top + 15 + 9;
  const thresholdX = sheet.x + (sheet.width * threshold) / 100;
  sheet.place(`${threshold}`, thresholdX - 10, barTop - 10, 20, { font: "mono", size: 7, color: PAPER_PALETTE.muted, align: "center" });

  sheet.doc.save().roundedRect(sheet.x, barTop, sheet.width, BAR_HEIGHT, BAR_HEIGHT / 2).fill(PAPER_PALETTE.track).restore();
  const fill = Math.min(Math.max(bar.score, 0), 100);
  if (fill > 0) {
    drawFill(sheet, sheet.x, barTop, Math.max((sheet.width * fill) / 100, BAR_HEIGHT), bar.alertText !== null);
  }
  sheet.doc
    .save()
    .moveTo(thresholdX, barTop - 3)
    .lineTo(thresholdX, barTop + BAR_HEIGHT + 3)
    .lineWidth(1)
    .dash(2.5, { space: 2 })
    .strokeColor(PAPER_PALETTE.ink)
    .stroke()
    .restore();

  const noteTop = barTop + BAR_HEIGHT + 6;
  sheet.place(bar.supportsText, sheet.x, noteTop + 1, nameWidth, supportsStyle);
  if (bar.alertText !== null) {
    drawPill(sheet, bar.alertText, ALERT_TONE, sheet.x + sheet.width - pillWidth(sheet, bar.alertText), noteTop - 1);
  }
  sheet.y = noteTop + supportsHeight + 10;
}

/** The eight dimensions as bars, in the groups the block names, each bar over the same 0–100 scale. */
export function drawDimensionBars(sheet: Sheet, block: ReportDimensionBarsBlock): void {
  for (const group of block.groups) {
    sheet.require(40 + (group.bars.length > 0 ? 70 : 0));
    sheet.y += 4;
    sheet.write(group.label, { font: "strong", size: 11.5 }, 4);
    sheet.rule(PAPER_PALETTE.line, 12);
    for (const bar of group.bars) {
      drawBar(sheet, bar, block.threshold);
    }
  }
}

function levelOfScore(score: number, thresholds: ReportRiskMatrixBlock["thresholds"]): RiskLevel {
  if (score >= thresholds.highFrom) return "high";
  if (score >= thresholds.mediumFrom) return "medium";
  return "low";
}

function drawMark(sheet: Sheet, mark: ReportRiskMark, cx: number, cy: number, diameter: number): void {
  sheet.doc.save().circle(cx, cy, diameter / 2).fill(RISK_LEVEL_COLORS[mark.level]).restore();
  const size = diameter * 0.58;
  sheet.place(`${mark.number}`, cx - diameter / 2, cy - size * 0.6, diameter, {
    font: "monoStrong",
    size,
    color: PAPER_PALETTE.paper,
    align: "center",
  });
}

/** The marks that share one cell, packed side by side so each keeps its number visible. */
function drawCellMarks(sheet: Sheet, marks: ReportRiskMark[], x: number, y: number, cell: number): void {
  const count = marks.length;
  const columns = count <= 3 ? count : count === 4 ? 2 : 3;
  const rows = Math.ceil(count / columns);
  const diameter = count === 1 ? 20 : count === 2 ? 14 : count === 3 ? 10 : count === 4 ? 11 : 10;
  const gap = 1.5;
  const blockWidth = columns * diameter + (columns - 1) * gap;
  const blockHeight = rows * diameter + (rows - 1) * gap;
  marks.forEach((mark, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cx = x + (cell - blockWidth) / 2 + column * (diameter + gap) + diameter / 2;
    const cy = y + (cell - blockHeight) / 2 + row * (diameter + gap) + diameter / 2;
    drawMark(sheet, mark, cx, cy, diameter);
  });
}

/** The 5×5 grid: probability to the right, impact up; each cell shows its P × I and each risk its number. */
export function drawRiskMatrix(sheet: Sheet, block: ReportRiskMatrixBlock): void {
  const { size } = block;
  const axisWidth = 16;
  const cell = Math.min(34, (sheet.width - axisWidth) / size);
  const gridX = sheet.x + axisWidth;
  const gridY = sheet.y;
  const legendHeight = block.legend.length * 15;
  const axesStyle = { size: 8.5, color: PAPER_PALETTE.muted };
  const axesHeight = sheet.measure(block.axesLabel, axesStyle);
  sheet.require(cell * size + 16 + axesHeight + 10 + legendHeight);

  const { doc } = sheet;
  for (let impact = size; impact >= 1; impact -= 1) {
    const rowY = gridY + (size - impact) * cell;
    sheet.place(`${impact}`, sheet.x, rowY + cell / 2 - 4, axisWidth - 5, { font: "mono", size: 8, color: PAPER_PALETTE.muted, align: "right" });
    for (let probability = 1; probability <= size; probability += 1) {
      const cellX = gridX + (probability - 1) * cell;
      const score = probability * impact;
      doc
        .save()
        .rect(cellX, rowY, cell, cell)
        .lineWidth(0.7)
        .fillAndStroke(RISK_LEVEL_WASHES[levelOfScore(score, block.thresholds)], PAPER_PALETTE.line)
        .restore();
      const marks = block.marks.filter((mark) => mark.probability === probability && mark.impact === impact);
      // The P × I of the cell helps a gray-scale reader; crowded cells keep the room for their marks.
      if (marks.length <= 3) {
        sheet.place(`${score}`, cellX + 3, rowY + 3, cell - 6, { font: "mono", size: 6.5, color: PAPER_PALETTE.muted });
      }
      if (marks.length > 0) {
        drawCellMarks(sheet, marks, cellX, rowY, cell);
      }
    }
  }
  for (let probability = 1; probability <= size; probability += 1) {
    sheet.place(`${probability}`, gridX + (probability - 1) * cell, gridY + size * cell + 3, cell, {
      font: "mono",
      size: 8,
      color: PAPER_PALETTE.muted,
      align: "center",
    });
  }

  sheet.y = gridY + size * cell + 16;
  sheet.write(block.axesLabel, axesStyle, 8);
  for (const item of block.legend) {
    doc
      .save()
      .rect(sheet.x, sheet.y + 1, 10, 10)
      .lineWidth(0.7)
      .fillAndStroke(RISK_LEVEL_WASHES[item.level], RISK_LEVEL_COLORS[item.level])
      .restore();
    sheet.place(`${item.label} · nota ${item.range}`, sheet.x + 16, sheet.y + 1.5, sheet.width - 16, { size: 8.5, color: PAPER_PALETTE.soft });
    sheet.y += 15;
  }
}

/** The matrix on the left and, beside it, the list that numbers the risks it marks (AC-ra-08). */
export function drawRiskSpread(sheet: Sheet, matrix: ReportRiskMatrixBlock, list: ReportRiskListBlock): void {
  const matrixWidth = 186;
  const gap = 24;
  const top = sheet.y;
  const left = sheet.column(sheet.x, matrixWidth, () => drawRiskMatrix(sheet, matrix));
  sheet.y = top;
  const right = sheet.column(sheet.x + matrixWidth + gap, sheet.width - matrixWidth - gap, () => drawRiskList(sheet, list));
  sheet.y = Math.max(left, right);
}
