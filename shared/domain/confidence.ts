import {
  QUESTION_IDS,
  type Answers,
  type ConfidenceLevel,
  type ConfidenceResult,
  type Rules,
  type UnitEconomics,
} from "./types.ts";

// Float noise guard for shares that land exactly on a threshold (10% of 20 items).
const SHARE_TOLERANCE = 1e-9;

/** "Não sei" / "não acompanho" answers plus the unknown spend and new-customers origins (RULE-dm-08). */
export function countUnknownItems(answers: Answers, unitEconomics: UnitEconomics): number {
  const unknownAnswers = QUESTION_IDS.filter((id) => answers[id] === null).length;
  const unknownOrigins = [unitEconomics.spendOrigin, unitEconomics.newCustomersOrigin].filter(
    (origin) => origin === "unknown",
  ).length;
  return unknownAnswers + unknownOrigins;
}

function levelOfShare(share: number, rules: Rules): ConfidenceLevel {
  if (share <= rules.confidence.highUpTo + SHARE_TOLERANCE) return "high";
  if (share <= rules.confidence.mediumUpTo + SHARE_TOLERANCE) return "medium";
  return "low";
}

/**
 * Confidence in the data: high up to 10% unknown items, medium up to 25%, low
 * above. A cost estimated by range caps it at medium (RULE-dm-08, AC-dm-49).
 */
export function computeConfidence(
  answers: Answers,
  unitEconomics: UnitEconomics,
  rules: Rules,
): ConfidenceResult {
  const totalItems = rules.confidence.totalItems;
  const unknownCount = countUnknownItems(answers, unitEconomics);
  let level = levelOfShare(unknownCount / totalItems, rules);

  const usedRanges =
    unitEconomics.spendOrigin === "estimated" || unitEconomics.newCustomersOrigin === "estimated";
  if (usedRanges && level === "high") level = "medium";

  return { level, unknownCount, totalItems };
}
