import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { inflateSync } from "node:zlib";
import PDFDocument from "pdfkit";
import type { ReportBlock, ReportCoverBlock, ReportDocument, ReportPage } from "../../shared/report/reportDocument.ts";
import { PAPER_PALETTE } from "../../shared/report/paperPalette.ts";
import {
  FOOTER_RESERVE,
  PAGE_HEIGHT,
  PAGE_MARGIN,
  PAGE_WIDTH,
  PageOverflowError,
  Sheet,
  drawActions,
  drawCover,
  drawExplainedNumbers,
  drawFacts,
  drawHeading,
  drawKeyNumbers,
  drawList,
  drawNotice,
  drawPageTitle,
  drawParagraph,
  drawRiskList,
  drawStage,
  drawTable,
  type FontRole,
} from "./pdfBlocks.ts";
import { drawDimensionBars, drawRiskMatrix, drawRiskSpread } from "./pdfCharts.ts";

export { PageOverflowError };

// A4 report drawn with pdfkit from a `ReportDocument`: one sheet per page of the document, the
// blocks of each page in order, "Página N de M" in the footer. The fonts are the same Inter and
// JetBrains Mono the app ships, read from the installed @fontsource files and embedded in the
// PDF: nothing is fetched. The preview on screen draws the same document, so titles match.

const FONT_FILES: Record<FontRole, string> = {
  body: "@fontsource/inter/files/inter-latin-400-normal.woff",
  strong: "@fontsource/inter/files/inter-latin-600-normal.woff",
  mono: "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
  monoStrong: "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff",
};

let cachedFonts: Record<FontRole, Buffer> | null = null;

function loadFonts(): Record<FontRole, Buffer> {
  if (cachedFonts === null) {
    const resolve = createRequire(import.meta.url).resolve;
    cachedFonts = Object.fromEntries(
      Object.entries(FONT_FILES).map(([role, file]) => [role, readFileSync(resolve(file))]),
    ) as Record<FontRole, Buffer>;
  }
  return cachedFonts;
}

function drawBlock(sheet: Sheet, block: ReportBlock): void {
  switch (block.kind) {
    case "cover":
      return drawCover(sheet, block);
    case "heading":
      return drawHeading(sheet, block.text);
    case "paragraph":
      return drawParagraph(sheet, block);
    case "facts":
      return drawFacts(sheet, block);
    case "keyNumbers":
      return drawKeyNumbers(sheet, block);
    case "stage":
      return drawStage(sheet, block);
    case "actions":
      return drawActions(sheet, block);
    case "dimensionBars":
      return drawDimensionBars(sheet, block);
    case "riskMatrix":
      return drawRiskMatrix(sheet, block);
    case "riskList":
      return drawRiskList(sheet, block);
    case "explainedNumbers":
      return drawExplainedNumbers(sheet, block);
    case "list":
      return drawList(sheet, block);
    case "table":
      return drawTable(sheet, block);
    case "notice":
      return drawNotice(sheet, block);
  }
}

function drawPage(doc: PDFKit.PDFDocument, page: ReportPage): void {
  const sheet = new Sheet(doc, page.id);
  const isCover = page.blocks.some((block) => block.kind === "cover");
  if (!isCover) {
    drawPageTitle(sheet, page.title);
  }
  for (let index = 0; index < page.blocks.length; index += 1) {
    const block = page.blocks[index];
    const next = page.blocks[index + 1];
    // The risk matrix and the list that numbers its marks share the sheet side by side (AC-ra-08).
    if (block.kind === "riskMatrix" && next?.kind === "riskList") {
      drawRiskSpread(sheet, block, next);
      index += 1;
    } else {
      drawBlock(sheet, block);
    }
  }
}

const FOOTER_FONT_SIZE = 8;
const FOOTER_LINE_STEP = 11;
// "Página 99 de 99" in the 8 pt mono face is 72 pt wide; the rest of the line belongs to the text on the left.
const FOOTER_PAGE_NUMBER_WIDTH = 96;
const ELLIPSIS = "…";

/** The text cut at the last character that fits `width`, closed with an ellipsis, so a long name never runs under the page number. */
function fitToWidth(doc: PDFKit.PDFDocument, text: string, width: number): string {
  if (doc.widthOfString(text) <= width) {
    return text;
  }
  let end = text.length;
  while (end > 0 && doc.widthOfString(`${text.slice(0, end).trimEnd()}${ELLIPSIS}`) > width) {
    end -= 1;
  }
  return `${text.slice(0, end).trimEnd()}${ELLIPSIS}`;
}

/**
 * First line: the footer of the document and "Página N de M". Second line, when the brand has any
 * contact: phone, e-mail and site, so the footer carries who delivers the report as the cover does.
 */
function drawFooters(doc: PDFKit.PDFDocument, footerText: string, contactLine: string | null): void {
  const { start, count } = doc.bufferedPageRange();
  const top = PAGE_HEIGHT - FOOTER_RESERVE + 26;
  const width = PAGE_WIDTH - PAGE_MARGIN * 2;
  const textWidth = width - FOOTER_PAGE_NUMBER_WIDTH;
  for (let index = 0; index < count; index += 1) {
    doc.switchToPage(start + index);
    doc.font("mono").fontSize(FOOTER_FONT_SIZE).fillColor(PAPER_PALETTE.muted);
    doc.text(fitToWidth(doc, footerText, textWidth), PAGE_MARGIN, top, { width: textWidth, lineBreak: false });
    doc.text(`Página ${index + 1} de ${count}`, PAGE_MARGIN + textWidth, top, { width: FOOTER_PAGE_NUMBER_WIDTH, align: "right", lineBreak: false });
    if (contactLine !== null) {
      doc.text(fitToWidth(doc, contactLine, width), PAGE_MARGIN, top + FOOTER_LINE_STEP, { width, lineBreak: false });
    }
  }
}

const LOGO_DATA_URL = /^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/;
const PNG_SIGNATURE_SIZE = 8;
// Around the data of every PNG chunk: its length, its type and its checksum.
const PNG_CHUNK_OVERHEAD = 12;

/** The IDAT data of a PNG, joined, or `null` when the chunks do not add up to a whole image. */
function readPngPixelData(bytes: Buffer): Buffer | null {
  const parts: Buffer[] = [];
  let offset = PNG_SIGNATURE_SIZE;
  while (offset + PNG_CHUNK_OVERHEAD <= bytes.length) {
    const end = offset + 8 + bytes.readUInt32BE(offset);
    if (end + 4 > bytes.length) {
      return null;
    }
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    if (type === "IDAT") {
      parts.push(bytes.subarray(offset + 8, end));
    } else if (type === "IEND") {
      return parts.length > 0 ? Buffer.concat(parts) : null;
    }
    offset = end + 4;
  }
  return null;
}

/**
 * True when pdfkit can put this logo on the cover. pdfkit unpacks a PNG with an alpha channel in a
 * callback of its own, where a corrupt one throws out of reach of any `try`, and the server goes down
 * with it. The upload only checks the signature and the size, so this decides at the last moment.
 */
function canDrawLogo(dataUrl: string): boolean {
  const encoded = LOGO_DATA_URL.exec(dataUrl)?.[1];
  if (encoded === undefined) {
    return false;
  }
  const bytes = Buffer.from(encoded, "base64");
  try {
    if (dataUrl.startsWith("data:image/png")) {
      const pixelData = readPngPixelData(bytes);
      if (pixelData === null) {
        return false;
      }
      inflateSync(pixelData);
    }
    // A dry run on a scratch document: whatever pdfkit refuses synchronously (an interlaced PNG, a broken JPEG) shows here.
    const scratch = new PDFDocument({ autoFirstPage: false, font: "" });
    scratch.addPage();
    scratch.image(bytes, 0, 0, { width: 1 });
    return true;
  } catch {
    return false;
  }
}

/** The same document with the cover printing the brand name alone: a logo that cannot be drawn never stops a report. */
function withoutCoverLogo(document: ReportDocument): ReportDocument {
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) =>
        block.kind === "cover" ? { ...block, brand: { ...block.brand, logoDataUrl: null } } : block,
      ),
    })),
  };
}

function coverOf(document: ReportDocument): ReportCoverBlock | null {
  for (const page of document.pages) {
    for (const block of page.blocks) {
      if (block.kind === "cover") {
        return block;
      }
    }
  }
  return null;
}

/**
 * Draws the document and returns the finished PDF: as many sheets as the document has pages.
 * Rejects with a `PageOverflowError` when a page is too tall for one A4 sheet, never by spilling.
 */
export function renderReportPdf(source: ReportDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const fonts = loadFonts();
      const logoDataUrl = coverOf(source)?.brand.logoDataUrl ?? null;
      const document = logoDataUrl === null || canDrawLogo(logoDataUrl) ? source : withoutCoverLogo(source);
      const cover = coverOf(document);
      const doc = new PDFDocument({
        size: "A4",
        // No bottom margin: the footer lives there, and the blocks keep themselves above it.
        margins: { top: PAGE_MARGIN, bottom: 0, left: PAGE_MARGIN, right: PAGE_MARGIN },
        // No default font: every text sets one of the registered fonts, so Helvetica never gets into the file.
        font: "",
        bufferPages: true,
        autoFirstPage: false,
        info: {
          Title: `${document.title} - ${document.subject}`,
          Author: cover?.brand.name ?? "FitPulse",
          Subject: document.title,
        },
      });
      for (const [role, data] of Object.entries(fonts)) {
        doc.registerFont(role, data);
      }
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      for (const page of document.pages) {
        doc.addPage();
        drawPage(doc, page);
      }
      if (doc.bufferedPageRange().count !== document.pages.length) {
        throw new Error("The PDF has a different number of pages than the document.");
      }
      drawFooters(doc, document.footer.text, cover?.contactLine ?? null);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
