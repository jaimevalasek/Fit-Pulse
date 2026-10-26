import { riskCatalogIndex } from "../content/riskCatalog.ts";
import type {
  Answers,
  DimensionKey,
  DimensionResult,
  RiskLevel,
  RiskResult,
  Rules,
  SignalId,
  UnitEconomics,
} from "./types.ts";

export interface RiskSignalInput {
  answers: Answers;
  dimensions: Record<DimensionKey, DimensionResult>;
  unitEconomics: UnitEconomics;
}

/** Answer value (0 to 3) that fires an answer-based signal; "não sei" never does. */
const SIG_04_ONE_CHANNEL_ANSWER = 3;
const SIG_07_GOAL_TOO_BIG_ANSWER = 0;
const SIG_08_MANY_STEPS_ANSWER = 0;

type SignalCheck = (input: RiskSignalInput, rules: Rules) => boolean;

// One check per signal, in catalog order. The checks follow the table of signals in the PRD.
const SIGNAL_CHECKS: ReadonlyArray<readonly [SignalId, SignalCheck]> = [
  ["SIG-01", ({ unitEconomics }) => unitEconomics.origin === "unknown"],
  [
    "SIG-02",
    ({ unitEconomics }, rules) =>
      unitEconomics.ratio !== null && unitEconomics.ratio < rules.ratio.criticalBelow,
  ],
  [
    "SIG-03",
    ({ unitEconomics }, rules) =>
      unitEconomics.ratio !== null &&
      unitEconomics.ratio >= rules.ratio.criticalBelow &&
      unitEconomics.ratio < rules.ratio.attentionBelow,
  ],
  ["SIG-04", ({ answers }) => answers.pc1 === SIG_04_ONE_CHANNEL_ANSWER],
  ["SIG-05", ({ dimensions }, rules) => dimensions.re.score < rules.risk.retentionBelow],
  [
    "SIG-06",
    ({ unitEconomics }, rules) =>
      unitEconomics.neverPaysBack ||
      (unitEconomics.paybackMonths !== null &&
        unitEconomics.paybackMonths > rules.risk.paybackAboveMonths),
  ],
  ["SIG-07", ({ answers }) => answers.mm1 === SIG_07_GOAL_TOO_BIG_ANSWER],
  ["SIG-08", ({ answers }) => answers.co2 === SIG_08_MANY_STEPS_ANSWER],
];

/** High from 16, medium from 6, low below (RULE-dm-07). */
export function riskLevelOf(score: number, rules: Rules): RiskLevel {
  if (score >= rules.risk.highFrom) return "high";
  if (score >= rules.risk.mediumFrom) return "medium";
  return "low";
}

/**
 * Risks of the signal catalog that fired, worst first, at most five (RULE-dm-07).
 * Score = probability × impact; equal scores keep the catalog order. May be empty.
 */
export function detectRisks(input: RiskSignalInput, rules: Rules): RiskResult[] {
  const risks: RiskResult[] = [];
  for (const [signalId, fired] of SIGNAL_CHECKS) {
    if (!fired(input, rules)) continue;
    const { probability, impact } = rules.risk.signals[signalId];
    const score = probability * impact;
    risks.push({ signalId, probability, impact, score, level: riskLevelOf(score, rules) });
  }
  risks.sort(
    (a, b) => b.score - a.score || riskCatalogIndex(a.signalId) - riskCatalogIndex(b.signalId),
  );
  return risks.slice(0, rules.risk.maxRisks);
}
