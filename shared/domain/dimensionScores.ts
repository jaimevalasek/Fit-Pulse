import { ANCHOR_MAX, questionsOfDimension } from "../content/questionBank.ts";
import {
  DIMENSION_KEYS,
  type Answers,
  type DimensionKey,
  type DimensionResult,
  type Rules,
  type StageNumber,
  type UnitEconomics,
} from "./types.ts";

const FULL_SCORE = 100;

// "Não sei" (null), an unanswered question and any value outside 0..3 are worth 0 (RULE-dm-01).
function answerPoints(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= ANCHOR_MAX
    ? value
    : 0;
}

/**
 * Points of the calculated LTV:CAC item that "Canal e receita" adds to its
 * answers (RULE-dm-02). Bands use the exact ratio; no ratio is worth 0.
 */
export function ratioPoints(ratio: number | null, rules: Rules): number {
  const { criticalBelow, attentionBelow, healthyUpTo, points } = rules.ratio;
  if (ratio === null || !Number.isFinite(ratio) || ratio < 0) return points.unknown;
  if (ratio < criticalBelow) return points.critical;
  if (ratio < attentionBelow) return points.attention;
  if (ratio <= healthyUpTo) return points.healthy;
  return points.aboveHealthy;
}

// round(points ÷ (items × 3) × 100), half up, in integer math so 66.5 never lands on 66.
function toScore(points: number, items: number): number {
  const maxPoints = items * ANCHOR_MAX;
  if (maxPoints === 0) return 0;
  const score = Math.floor((2 * FULL_SCORE * points + maxPoints) / (2 * maxPoints));
  return Math.min(FULL_SCORE, Math.max(0, score));
}

/** Stage a score would sustain on its own (RULE-dm-06). */
export function supportedStage(score: number, rules: Rules): StageNumber {
  const { stage2From, stage3From, stage4From } = rules.dimensionSupport;
  if (score >= stage4From) return 4;
  if (score >= stage3From) return 3;
  if (score >= stage2From) return 2;
  return 1;
}

/** Score of one dimension: its answers, plus the ratio item for "Canal e receita" (cm). */
export function computeDimensionScore(
  dimension: DimensionKey,
  answers: Answers,
  unitEconomics: UnitEconomics,
  rules: Rules,
): number {
  const questions = questionsOfDimension(dimension);
  let points = questions.reduce((sum, question) => sum + answerPoints(answers[question.id]), 0);
  let items = questions.length;
  if (dimension === "cm") {
    points += ratioPoints(unitEconomics.ratio, rules);
    items += 1;
  }
  return toScore(points, items);
}

/** The eight dimension scores (0 to 100, whole) and the stage each would sustain (RULE-dm-01, 02, 06). */
export function computeDimensionScores(
  answers: Answers,
  unitEconomics: UnitEconomics,
  rules: Rules,
): Record<DimensionKey, DimensionResult> {
  const results = {} as Record<DimensionKey, DimensionResult>;
  for (const dimension of DIMENSION_KEYS) {
    const score = computeDimensionScore(dimension, answers, unitEconomics, rules);
    results[dimension] = {
      score,
      supportsStage: supportedStage(score, rules),
      belowWarning: score < rules.dimensionSupport.warnBelow,
    };
  }
  return results;
}

/** Lowest score of the eight; ties follow the order of `DIMENSION_KEYS`. */
export function findWeakestDimension(dimensions: Record<DimensionKey, DimensionResult>): DimensionKey {
  let weakest: DimensionKey = DIMENSION_KEYS[0];
  for (const dimension of DIMENSION_KEYS) {
    if (dimensions[dimension].score < dimensions[weakest].score) weakest = dimension;
  }
  return weakest;
}
