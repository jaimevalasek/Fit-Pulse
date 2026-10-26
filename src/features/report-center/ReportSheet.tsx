import { forwardRef, type CSSProperties } from "react";
import type { RiskLevel } from "../../../shared/domain/types";
import type {
  ReportActionListBlock,
  ReportBlock,
  ReportCoverBlock,
  ReportExplainedNumbersBlock,
  ReportFact,
  ReportFooter,
  ReportKeyNumbersBlock,
  ReportPage,
  ReportRiskListBlock,
  ReportStageBlock,
  ReportTableBlock,
  ReportTone,
} from "../../../shared/report/reportDocument";
import { PAPER_PALETTE, PAPER_TONE_COLORS, PAPER_TONE_WASHES } from "../../../shared/report/paperPalette";
import { DimensionBars, RISK_LEVEL_CLASSES, RiskMatrix } from "./ReportSheetCharts";

// The sheet paints with the paper palette of the PDF, never with the app theme: the same colors in
// both themes. The palette goes in as CSS variables, so `global.css` only names them.
const PAPER_STYLE = {
  "--p-paper": PAPER_PALETTE.paper,
  "--p-ink": PAPER_PALETTE.ink,
  "--p-soft": PAPER_PALETTE.soft,
  "--p-muted": PAPER_PALETTE.muted,
  "--p-accent": PAPER_PALETTE.accent,
  "--p-accent-wash": PAPER_PALETTE.accentWash,
  "--p-copper": PAPER_PALETTE.copper,
  "--p-copper-wash": PAPER_PALETTE.copperWash,
  "--p-danger": PAPER_PALETTE.danger,
  "--p-danger-wash": PAPER_PALETTE.dangerWash,
  "--p-gold": PAPER_PALETTE.gold,
  "--p-line": PAPER_PALETTE.line,
  "--p-track": PAPER_PALETTE.track,
  "--p-panel": PAPER_PALETTE.panel,
} as CSSProperties;

function toneStyle(tone: ReportTone): CSSProperties {
  return { color: PAPER_TONE_COLORS[tone], borderColor: PAPER_TONE_COLORS[tone], background: PAPER_TONE_WASHES[tone] };
}

const RISK_TONES: Record<RiskLevel, ReportTone> = { high: "bad", medium: "warn", low: "neutral" };

function FactsList({ facts }: { facts: ReportFact[] }) {
  return (
    <dl className="sheet-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function KeyNumbersBlock({ block }: { block: ReportKeyNumbersBlock }) {
  return (
    <ul className="sheet-key-numbers">
      {block.items.map((item) => (
        <li key={item.label}>
          <b className="sheet-mono">{item.value}</b>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

function ExplainedNumbersBlock({ block }: { block: ReportExplainedNumbersBlock }) {
  return (
    <dl className="sheet-explained">
      {block.items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>
            <b className="sheet-mono">{item.value}</b>
            <span className="sheet-soft">{item.explanation}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TableBlock({ block }: { block: ReportTableBlock }) {
  return (
    <table className="sheet-table">
      <thead>
        <tr>
          {block.columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {block.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CoverBlock({ block }: { block: ReportCoverBlock }) {
  const { brand } = block;
  return (
    <div className="sheet-cover">
      <div className="sheet-cover-brand">
        {brand.logoDataUrl ? <img src={brand.logoDataUrl} alt="" /> : null}
        <span className="sheet-mono sheet-strong sheet-accent">{brand.name}</span>
      </div>
      <div className="sheet-cover-main">
        <h3 className="sheet-cover-title">{block.title}</h3>
        <span className="sheet-rule" aria-hidden="true" />
        <p className="sheet-cover-subject">{block.subject}</p>
        <FactsList facts={block.facts} />
      </div>
      <div className="sheet-cover-closing">
        {block.contactLine ? <p className="sheet-soft">{block.contactLine}</p> : null}
        <p className="sheet-muted sheet-small">{block.credit}</p>
      </div>
    </div>
  );
}

function StageBlock({ block }: { block: ReportStageBlock }) {
  const steps = Array.from({ length: block.total }, (_, index) => index + 1);
  return (
    <div className="sheet-stage">
      <div className="sheet-stage-steps" aria-hidden="true">
        {steps.map((step) => (
          <span key={step} className={step <= block.number ? "is-on" : undefined} />
        ))}
      </div>
      <p className="sheet-stage-title">
        Estágio {block.number} de {block.total} · {block.name}
      </p>
      <p className="sheet-soft">{block.phrase}</p>
    </div>
  );
}

function ActionsBlock({ block }: { block: ReportActionListBlock }) {
  return (
    <ol className="sheet-actions">
      {block.items.map((item) => (
        <li key={item.position}>
          <span className="sheet-action-number sheet-mono">{item.position}</span>
          <div>
            <strong>{item.title}</strong>
            {item.details.map((detail) => (
              <small key={detail}>{detail}</small>
            ))}
          </div>
          {item.tag ? (
            <span className="sheet-tag" style={toneStyle(item.tag.tone)}>
              {item.tag.label}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function RiskListBlock({ block }: { block: ReportRiskListBlock }) {
  return (
    <ol className="sheet-risks">
      {block.items.map((item) => (
        <li key={item.number}>
          <span className={`sheet-risk-number ${RISK_LEVEL_CLASSES[item.level]}`}>{item.number}</span>
          <div>
            <strong>{item.title}</strong>
            <p className="sheet-risk-score">
              <span className="sheet-tag" style={toneStyle(RISK_TONES[item.level])}>
                {item.levelLabel}
              </span>
              <span className="sheet-muted">{item.scoreLine}</span>
            </p>
            <p className="sheet-soft">{item.cause}</p>
            <p className="sheet-soft">{item.howToReduce}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SheetBlock({ block }: { block: ReportBlock }) {
  switch (block.kind) {
    case "cover":
      return <CoverBlock block={block} />;
    case "heading":
      return <h4 className="sheet-heading">{block.text}</h4>;
    case "paragraph":
      return <p className={block.tone === "muted" ? "sheet-muted" : block.tone === "soft" ? "sheet-soft" : undefined}>{block.text}</p>;
    case "facts":
      return <FactsList facts={block.items} />;
    case "keyNumbers":
      return <KeyNumbersBlock block={block} />;
    case "stage":
      return <StageBlock block={block} />;
    case "actions":
      return <ActionsBlock block={block} />;
    case "dimensionBars":
      return <DimensionBars block={block} />;
    case "riskMatrix":
      return <RiskMatrix block={block} />;
    case "riskList":
      return <RiskListBlock block={block} />;
    case "explainedNumbers":
      return <ExplainedNumbersBlock block={block} />;
    case "list":
      return (
        <ul className="sheet-list">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return <TableBlock block={block} />;
    case "notice":
      return <p className="sheet-notice">{block.text}</p>;
  }
}

// The risk matrix and the list that numbers its marks share the sheet side by side, as in the PDF
function groupBlocks(blocks: ReportBlock[]): ReportBlock[][] {
  const groups: ReportBlock[][] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const next = blocks[index + 1];
    if (block.kind === "riskMatrix" && next?.kind === "riskList") {
      groups.push([block, next]);
      index += 1;
    } else {
      groups.push([block]);
    }
  }
  return groups;
}

interface ReportSheetProps {
  page: ReportPage;
  number: number;
  total: number;
  footer: ReportFooter;
  // The page the last change touched: it gets the reprint band
  reprinted?: boolean;
}

// One A4 page of the document, drawn like the PDF: the page title on top (the cover prints the
// report title itself), its blocks in order and the footer with "Página N de M" (AC-ra-02)
const ReportSheet = forwardRef<HTMLElement, ReportSheetProps>(function ReportSheet({ page, number, total, footer, reprinted }, ref) {
  const isCover = page.blocks.some((block) => block.kind === "cover");
  return (
    <article
      ref={ref}
      className={reprinted ? "report-sheet is-reprinted" : "report-sheet"}
      style={PAPER_STYLE}
      aria-label={`Página ${number} de ${total}: ${page.title}`}
      data-page-id={page.id}
      data-aioson-id="report-sheet"
    >
      <div className="sheet-body">
        {isCover ? null : <h3 className="sheet-title">{page.title}</h3>}
        {groupBlocks(page.blocks).map((group, index) =>
          group.length > 1 ? (
            <div key={index} className="sheet-spread">
              {group.map((block, inner) => (
                <SheetBlock key={inner} block={block} />
              ))}
            </div>
          ) : (
            <SheetBlock key={index} block={group[0]} />
          ),
        )}
      </div>
      <footer className="sheet-footer">
        <span>{footer.text}</span>
        <span>
          Página {number} de {total}
        </span>
      </footer>
    </article>
  );
});

export { ReportSheet };
export type { ReportSheetProps };
