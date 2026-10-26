import { evaluateDiagnosis } from "./evaluateDiagnosis.ts";
import {
  DIMENSION_KEYS,
  type Answers,
  type CalculatorInput,
  type DiagnosisResult,
  type DimensionKey,
  type RiskResult,
  type Rules,
  type StageNumber,
} from "./types.ts";

/** A completed diagnosis as the comparison reads it: its stored answers and its frozen result. */
export interface ComparableDiagnosis {
  id: string;
  /** ISO date of the conclusion. */
  completedAt: string;
  answers: Answers;
  calculator: CalculatorInput;
  result: DiagnosisResult;
}

/** One side of the comparison. For a recalculated `previous`, `stage` and `rulesVersion` are the recalculated ones. */
export interface ComparedSide {
  id: string;
  completedAt: string;
  stage: StageNumber;
  rulesVersion: number;
}

export interface StageChange {
  from: StageNumber;
  to: StageNumber;
  direction: "up" | "down" | "same";
}

export interface ScoreChange {
  before: number;
  after: number;
  /** `after - before`; the screen shows the arrow and the words ("subiu", "caiu", "igual") from its sign. */
  delta: number;
}

export interface DimensionChange extends ScoreChange {
  key: DimensionKey;
}

/** What the previous diagnosis said when it was concluded, before the recalculation (RULE-dm-11). */
export interface OriginalScore {
  stage: StageNumber;
  /** Mean of the eight dimension scores, rounded. */
  average: number;
}

export interface Recalculation {
  fromVersion: number;
  toVersion: number;
  originalScore: OriginalScore;
}

/** Shape of IF-005 for `GET /api/diagnoses/:id/comparison`. */
export interface DiagnosisComparison {
  previous: ComparedSide;
  current: ComparedSide;
  stageChange: StageChange;
  /** Mean of the eight dimension scores, rounded, before and after. */
  average: ScoreChange;
  /** One entry per dimension, in the fixed order of `DIMENSION_KEYS`. */
  dimensions: DimensionChange[];
  /** Risks the previous diagnosis had and the current one no longer has. */
  risksResolved: RiskResult[];
  /** Risks the current diagnosis has and the previous one did not. */
  risksNew: RiskResult[];
  /** Present only when the previous diagnosis was calculated with other rules than the current one. */
  recalculated?: Recalculation;
}

function averageScore(result: DiagnosisResult): number {
  const total = DIMENSION_KEYS.reduce((sum, key) => sum + result.dimensions[key].score, 0);
  return Math.round(total / DIMENSION_KEYS.length);
}

function changeOf(before: number, after: number): ScoreChange {
  return { before, after, delta: after - before };
}

function stageDirection(from: StageNumber, to: StageNumber): StageChange["direction"] {
  if (to > from) return "up";
  if (to < from) return "down";
  return "same";
}

function sideOf(diagnosis: ComparableDiagnosis, result: DiagnosisResult): ComparedSide {
  return {
    id: diagnosis.id,
    completedAt: diagnosis.completedAt,
    stage: result.stage,
    rulesVersion: result.rulesVersion,
  };
}

/** The comparison and the result of the earlier diagnosis that its numbers came from. */
export interface ComparisonWithResults {
  comparison: DiagnosisComparison;
  /** The stored result, or the one calculated again with the current rules when the versions differ. */
  previousResult: DiagnosisResult;
}

/**
 * Compares a completed diagnosis with the one before it (IF-005): stage before → after, the
 * score of each dimension, and the risks that were resolved or are new.
 *
 * When both were calculated with the same rules version their frozen results are compared as
 * stored. When the versions differ, the previous one is calculated again from its stored
 * answers with `rules` (the rules in force now), so the two numbers mean the same thing, and the
 * score it had at the time is returned in `recalculated.originalScore` (RULE-dm-11). Neither
 * stored result is changed: this is pure and only builds a new value.
 */
export function compareDiagnoses(
  previous: ComparableDiagnosis,
  current: ComparableDiagnosis,
  rules: Rules,
): DiagnosisComparison {
  return compareWithResults(previous, current, rules).comparison;
}

/**
 * The same comparison, plus the result of the earlier diagnosis it was built from. The evolution
 * report prints numbers the comparison does not carry (the cost per customer, the lock), and they
 * must come from that same, possibly recalculated, result.
 */
export function compareWithResults(
  previous: ComparableDiagnosis,
  current: ComparableDiagnosis,
  rules: Rules,
): ComparisonWithResults {
  const sameVersion = previous.result.rulesVersion === current.result.rulesVersion;
  const previousResult = sameVersion
    ? previous.result
    : evaluateDiagnosis({ answers: previous.answers, calculator: previous.calculator }, rules);
  const currentResult = current.result;

  const comparison: DiagnosisComparison = {
    previous: sideOf(previous, previousResult),
    current: sideOf(current, currentResult),
    stageChange: {
      from: previousResult.stage,
      to: currentResult.stage,
      direction: stageDirection(previousResult.stage, currentResult.stage),
    },
    average: changeOf(averageScore(previousResult), averageScore(currentResult)),
    dimensions: DIMENSION_KEYS.map((key) => ({
      key,
      ...changeOf(previousResult.dimensions[key].score, currentResult.dimensions[key].score),
    })),
    risksResolved: previousResult.risks.filter(
      (risk) => !currentResult.risks.some((other) => other.signalId === risk.signalId),
    ),
    risksNew: currentResult.risks.filter(
      (risk) => !previousResult.risks.some((other) => other.signalId === risk.signalId),
    ),
  };

  if (!sameVersion) {
    comparison.recalculated = {
      fromVersion: previous.result.rulesVersion,
      toVersion: previousResult.rulesVersion,
      originalScore: { stage: previous.result.stage, average: averageScore(previous.result) },
    };
  }
  return { comparison, previousResult };
}
