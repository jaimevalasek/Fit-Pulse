import type { CSSProperties } from "react";
import type { RiskLevel } from "../../../shared/domain/types";
import type {
  ReportDimensionBar,
  ReportDimensionBarsBlock,
  ReportRiskMatrixBlock,
} from "../../../shared/report/reportDocument";

// Same cell colors as the PDF: the wash of each level, from the paper palette (CSS variables of the sheet)
const RISK_LEVEL_CLASSES: Record<RiskLevel, string> = {
  high: "is-high",
  medium: "is-medium",
  low: "is-low",
};

function levelOfScore(score: number, thresholds: ReportRiskMatrixBlock["thresholds"]): RiskLevel {
  if (score >= thresholds.highFrom) return "high";
  if (score >= thresholds.mediumFrom) return "medium";
  return "low";
}

function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function DimensionBar({ bar, threshold }: { bar: ReportDimensionBar; threshold: number }) {
  const below = bar.score < threshold;
  return (
    <li className="sheet-bar">
      <div className="sheet-bar-head">
        <span className="sheet-strong">{bar.name}</span>
        <span className="sheet-mono sheet-strong">{bar.scoreText}</span>
      </div>
      {/* The bar is drawing only: the score, the line of 50 and the alert are all written next to it */}
      <div className="sheet-track" aria-hidden="true">
        <span className={below ? "sheet-fill is-low" : "sheet-fill"} style={{ width: `${clampPercent(bar.score)}%` }} />
        <span className="sheet-threshold" style={{ left: `${clampPercent(threshold)}%` }} />
      </div>
      <div className="sheet-bar-note">
        <span className="sheet-muted">{bar.supportsText}</span>
        {bar.alertText ? <span className="sheet-alert">{bar.alertText}</span> : null}
      </div>
    </li>
  );
}

// Grouped bars of the 8 dimensions with the dashed line of 50 (same order and texts as the PDF)
function DimensionBars({ block }: { block: ReportDimensionBarsBlock }) {
  return (
    <div className="sheet-bars">
      {block.groups.map((group) => (
        <section key={group.label} className="sheet-bar-group">
          <h5 className="sheet-group-label">{group.label}</h5>
          <ul className="sheet-bar-list">
            {group.bars.map((bar) => (
              <DimensionBar key={bar.name} bar={bar} threshold={block.threshold} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// The probability × impact grid: probability to the right, impact up; the numbers of the risks
// sit in their cells. Its accessible name is the grid in words, written by the server.
function RiskMatrix({ block }: { block: ReportRiskMatrixBlock }) {
  const steps = Array.from({ length: block.size }, (_, index) => index + 1);
  return (
    <figure className="sheet-matrix-figure">
      <div className="sheet-matrix" role="img" aria-label={block.description} style={{ "--matrix-size": block.size } as CSSProperties}>
        {[...steps].reverse().map((impact) => (
          <div key={impact} className="sheet-matrix-row" aria-hidden="true">
            <span className="sheet-matrix-axis">{impact}</span>
            {steps.map((probability) => {
              const score = probability * impact;
              const marks = block.marks.filter((mark) => mark.probability === probability && mark.impact === impact);
              return (
                <span key={probability} className={`sheet-matrix-cell ${RISK_LEVEL_CLASSES[levelOfScore(score, block.thresholds)]}`}>
                  {marks.length <= 3 ? <small className="sheet-matrix-score">{score}</small> : null}
                  {marks.map((mark) => (
                    <b key={mark.number} className={`sheet-matrix-mark ${RISK_LEVEL_CLASSES[mark.level]}`}>
                      {mark.number}
                    </b>
                  ))}
                </span>
              );
            })}
          </div>
        ))}
        <div className="sheet-matrix-row" aria-hidden="true">
          <span className="sheet-matrix-axis" />
          {steps.map((probability) => (
            <span key={probability} className="sheet-matrix-axis">
              {probability}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sheet-muted sheet-small">{block.axesLabel}</figcaption>
      <ul className="sheet-legend">
        {block.legend.map((item) => (
          <li key={item.level}>
            <span className={`sheet-legend-swatch ${RISK_LEVEL_CLASSES[item.level]}`} aria-hidden="true" />
            {item.label} <span className="sheet-muted">{item.range}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export { DimensionBars, RiskMatrix, RISK_LEVEL_CLASSES };
