import type { ConfidenceLevel, ConfidenceResult } from "../domain/types.ts";

// One wording of the confidence for the screen and the PDF (AC-ra-23): the count of items left
// without the number is always "itens", even for one ("1 de 26 itens sem o número").

export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = { high: "alta", medium: "média", low: "baixa" };

export const CONFIDENCE_LEVEL_EXPLANATIONS: Record<ConfidenceLevel, string> = {
  high: "quase todas as respostas são medidas.",
  medium: "parte das respostas é estimada por faixa.",
  low: "muitas respostas “não sei”.",
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "6 de 26 itens sem o número", or null when every item has its number. */
export function formatUnknownItems({ unknownCount, totalItems }: ConfidenceResult): string | null {
  return unknownCount === 0 ? null : `${unknownCount} de ${totalItems} itens sem o número`;
}

/** The level with the count in parentheses: "Média (6 de 26 itens sem o número)", or "Alta". */
export function formatConfidence(confidence: ConfidenceResult): string {
  const label = capitalize(CONFIDENCE_LEVEL_LABELS[confidence.level]);
  const unknownItems = formatUnknownItems(confidence);
  return unknownItems === null ? label : `${label} (${unknownItems})`;
}

/** The sentence on the result screen: "Confiança nos dados: média (6 de 26 itens sem o número)". */
export function formatConfidenceStatement(confidence: ConfidenceResult): string {
  const label = `Confiança nos dados: ${CONFIDENCE_LEVEL_LABELS[confidence.level]}`;
  const unknownItems = formatUnknownItems(confidence);
  return unknownItems === null ? label : `${label} (${unknownItems})`;
}
