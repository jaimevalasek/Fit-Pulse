import type {
  Answers,
  DimensionKey,
  DimensionResult,
  LockKey,
  Rules,
  StageNumber,
  UnitEconomics,
} from "./types.ts";

export interface StageGateInput {
  answers: Answers;
  dimensions: Record<DimensionKey, DimensionResult>;
  unitEconomics: UnitEconomics;
}

export interface StageGateResult {
  stage: StageNumber;
  /** First unmet criterion of the next stage; `null` at stage 4 (RULE-dm-05). */
  lock: LockKey | null;
}

interface Criterion {
  key: LockKey;
  met: boolean;
}

function scoreAtLeast(input: StageGateInput, dimension: DimensionKey, minimum: number): boolean {
  return input.dimensions[dimension].score >= minimum;
}

// Criteria to reach stage 2 (Ajuste), in the order of RULE-dm-04.
function stage2Criteria(input: StageGateInput, rules: Rules): Criterion[] {
  const { unitEconomics } = input;
  return [
    { key: "cac", met: unitEconomics.origin !== "unknown" && unitEconomics.cacCents !== null },
    { key: "mp", met: scoreAtLeast(input, "mp", rules.stageGates.stage2.minMarketProduct) },
  ];
}

// Criteria to reach stage 3 (Escala). A cost estimated by range is not enough: it must be measured.
function stage3Criteria(input: StageGateInput, rules: Rules): Criterion[] {
  const { unitEconomics } = input;
  const gate = rules.stageGates.stage3;
  const paybackWithinLimit =
    !unitEconomics.neverPaysBack &&
    unitEconomics.paybackMonths !== null &&
    unitEconomics.paybackMonths <= gate.maxPaybackMonths;
  return [
    { key: "measure", met: unitEconomics.origin === "measured" },
    { key: "ratio", met: unitEconomics.ratio !== null && unitEconomics.ratio >= gate.minRatio },
    { key: "payback", met: paybackWithinLimit },
    { key: "pc", met: scoreAtLeast(input, "pc", gate.minProductChannel) },
    { key: "re", met: scoreAtLeast(input, "re", gate.minRetention) },
  ];
}

// Criteria to reach stage 4 (Estruturação). `es` is the answer about who does the work (es1).
function stage4Criteria(input: StageGateInput, rules: Rules): Criterion[] {
  const gate = rules.stageGates.stage4;
  const structure = input.answers.es1;
  return [
    { key: "mm", met: scoreAtLeast(input, "mm", gate.minRevenueMarket) },
    { key: "co", met: scoreAtLeast(input, "co", gate.minConversion) },
    { key: "es", met: typeof structure === "number" && structure >= gate.minStructureAnswer },
  ];
}

/**
 * Company stage and lock (RULE-dm-04, RULE-dm-05). Each stage needs the one
 * before it; the lock is the first criterion of the next stage not yet met.
 */
export function computeStageAndLock(input: StageGateInput, rules: Rules): StageGateResult {
  const gates = [stage2Criteria, stage3Criteria, stage4Criteria];
  let stage: StageNumber = 1;
  for (const buildCriteria of gates) {
    const unmet = buildCriteria(input, rules).find((criterion) => !criterion.met);
    if (unmet) return { stage, lock: unmet.key };
    stage = (stage + 1) as StageNumber;
  }
  return { stage, lock: null };
}
