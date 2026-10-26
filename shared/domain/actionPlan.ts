import type {
  ActionKey,
  ConfidenceResult,
  DimensionKey,
  DimensionResult,
  LockKey,
  RiskResult,
  Rules,
  StageNumber,
  UnitEconomics,
} from "./types.ts";

export interface ActionPlanInput {
  stage: StageNumber;
  lock: LockKey | null;
  dimensions: Record<DimensionKey, DimensionResult>;
  risks: RiskResult[];
  unitEconomics: UnitEconomics;
  confidence: ConfidenceResult;
}

/** Dimensions with an action of their own; `cm` only enters the plan through the locks (RULE-dm-09). */
const DIMENSION_ACTIONS: ReadonlySet<DimensionKey> = new Set<DimensionKey>([
  "mp",
  "pc",
  "mm",
  "aq",
  "en",
  "co",
  "re",
]);

/** The signal that asks for the "depend on one channel" action. */
const ONE_CHANNEL_SIGNAL = "SIG-04";

/**
 * Whether the plan may suggest spending more (RULE-dm-10): the cost per
 * customer was measured, the data is reliable and the company is far enough along.
 */
export function isInvestEligible(input: ActionPlanInput, rules: Rules): boolean {
  return (
    input.stage >= rules.plan.invest.minStage &&
    input.unitEconomics.origin === "measured" &&
    input.confidence.level === "high"
  );
}

// Dimensions with an action, weakest first; equal scores follow the order of the rules (RULE-dm-09).
function weakestDimensionActions(
  dimensions: Record<DimensionKey, DimensionResult>,
  rules: Rules,
): ActionKey[] {
  return rules.plan.dimensionOrder
    .filter((dimension) => DIMENSION_ACTIONS.has(dimension))
    .map((dimension, position) => ({ dimension, position, score: dimensions[dimension].score }))
    .sort((a, b) => a.score - b.score || a.position - b.position)
    .map(({ dimension }) => dimension as ActionKey);
}

/**
 * The action plan (RULE-dm-09): the lock action, the one-channel action when
 * SIG-04 fired, the invest action when eligible, then the weakest dimensions.
 * No action repeats and the plan holds exactly `rules.plan.size` of them.
 */
export function buildActionPlan(input: ActionPlanInput, rules: Rules): ActionKey[] {
  const candidates: ActionKey[] = [];
  if (input.lock !== null) candidates.push(input.lock);
  if (input.risks.some((risk) => risk.signalId === ONE_CHANNEL_SIGNAL)) candidates.push("dep");
  if (isInvestEligible(input, rules)) candidates.push("invest");
  candidates.push(...weakestDimensionActions(input.dimensions, rules));

  return [...new Set(candidates)].slice(0, rules.plan.size);
}
