import { describe, expect, it } from "vitest";
import type { ConfidenceResult } from "../../shared/domain/types.ts";
import { formatConfidence, formatConfidenceStatement, formatUnknownItems } from "../../shared/format/confidenceText.ts";

// AC-ra-23: the confidence says "1 de 26 itens sem o número" (always "itens"), on screen and in the PDF.

const confidenceOf = (unknownCount: number, level: ConfidenceResult["level"] = "medium"): ConfidenceResult => ({
  level,
  unknownCount,
  totalItems: 26,
});

describe("confidence wording (AC-ra-23)", () => {
  it("says 'itens' even when a single item is missing the number", () => {
    expect(formatUnknownItems(confidenceOf(1))).toBe("1 de 26 itens sem o número");
    expect(formatConfidence(confidenceOf(1, "high"))).toBe("Alta (1 de 26 itens sem o número)");
    expect(formatConfidenceStatement(confidenceOf(1, "high"))).toBe("Confiança nos dados: alta (1 de 26 itens sem o número)");
  });

  it("counts several items the same way", () => {
    expect(formatUnknownItems(confidenceOf(6))).toBe("6 de 26 itens sem o número");
    expect(formatConfidence(confidenceOf(6))).toBe("Média (6 de 26 itens sem o número)");
    expect(formatConfidenceStatement(confidenceOf(14, "low"))).toBe("Confiança nos dados: baixa (14 de 26 itens sem o número)");
  });

  it("says only the level when every item has its number", () => {
    expect(formatUnknownItems(confidenceOf(0, "high"))).toBeNull();
    expect(formatConfidence(confidenceOf(0, "high"))).toBe("Alta");
    expect(formatConfidenceStatement(confidenceOf(0, "high"))).toBe("Confiança nos dados: alta");
  });

  it("never writes the singular 'item sem o número'", () => {
    for (let unknownCount = 0; unknownCount <= 26; unknownCount += 1) {
      expect(formatConfidence(confidenceOf(unknownCount))).not.toMatch(/\bitem sem\b/);
    }
  });
});
