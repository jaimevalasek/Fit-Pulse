import type { ConfidenceResult } from "../../../shared/domain/types";
import { CONFIDENCE_LEVEL_EXPLANATIONS, formatConfidenceStatement } from "../../../shared/format/confidenceText";

// How reliable the result is; a low confidence marks the result as provisional. The wording is the
// same as the PDF's, with "itens" even for one (AC-ra-23).
function ConfidenceNote({ confidence }: { confidence: ConfidenceResult }) {
  const isProvisional = confidence.level === "low";

  return (
    <section data-aioson-id="result-confidence" data-level={confidence.level} aria-labelledby="result-confidence-title" className="mt-8">
      <h3 id="result-confidence-title" className="sr-only">
        Confiança nos dados
      </h3>
      <p className="text-sm text-text-soft">
        <b className="font-semibold text-text">{formatConfidenceStatement(confidence)}.</b> {CONFIDENCE_LEVEL_EXPLANATIONS[confidence.level]}
      </p>
      {isProvisional ? (
        <p
          role="note"
          data-aioson-id="result-provisional"
          className="mt-3 rounded-md border border-warn/40 bg-warn-wash px-4 py-3 text-sm text-text"
        >
          O resultado é provisório até você medir esses números. Depois, faça um novo diagnóstico.
        </p>
      ) : null}
    </section>
  );
}

export { ConfidenceNote };
