import { buildActionPlan } from "./actionPlan.ts";
import { computeConfidence } from "./confidence.ts";
import { computeDimensionScores, findWeakestDimension } from "./dimensionScores.ts";
import { detectRisks } from "./riskSignals.ts";
import { computeStageAndLock } from "./stageGate.ts";
import type { DiagnosisInput, DiagnosisResult, Rules } from "./types.ts";
import { computeUnitEconomics } from "./unitEconomics.ts";

/**
 * The diagnosis engine (IF-004): answers and calculator in, the frozen result
 * out. Pure and deterministic: the same input and rules always give the same
 * result, nothing is read from the clock, the database or the network, and the
 * result is plain data that survives JSON (RULE-dm-11).
 */
export function evaluateDiagnosis(input: DiagnosisInput, rules: Rules): DiagnosisResult {
  const { answers, calculator } = input;

  const unitEconomics = computeUnitEconomics(calculator, rules);
  const dimensions = computeDimensionScores(answers, unitEconomics, rules);
  const { stage, lock } = computeStageAndLock({ answers, dimensions, unitEconomics }, rules);
  const risks = detectRisks({ answers, dimensions, unitEconomics }, rules);
  const confidence = computeConfidence(answers, unitEconomics, rules);
  const plan = buildActionPlan({ stage, lock, dimensions, risks, unitEconomics, confidence }, rules);

  return {
    rulesVersion: rules.version,
    stage,
    lock,
    dimensions,
    weakestDimension: findWeakestDimension(dimensions),
    unitEconomics,
    risks,
    confidence,
    plan,
  };
}
