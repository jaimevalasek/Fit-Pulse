import type { Rules } from "../domain/types.ts";

export const RULES_VERSION = 1;

/**
 * Rules version 1. Thresholds are product hypotheses awaiting calibration.
 * Any change that alters a result needs a new rules file, not an edit here.
 */
export const rulesV1: Rules = {
  version: RULES_VERSION,
  ratio: {
    criticalBelow: 1,
    attentionBelow: 3,
    healthyUpTo: 5,
    points: { critical: 0, attention: 1, healthy: 3, aboveHealthy: 2, unknown: 0 },
  },
  midpoints: {
    spendCentsByRange: {
      upTo1000: 50_000,
      from1000To5000: 300_000,
      from5000To15000: 1_000_000,
      from15000To50000: 3_250_000,
      over50000: 6_000_000,
    },
    newCustomersByRange: {
      from1To10: 5,
      from11To30: 20,
      from31To100: 65,
      from101To300: 200,
      over300: 400,
    },
    purchasesPerYear: {
      once: 1,
      twoToThree: 2.5,
      fourToSix: 5,
      sevenToTwelve: 9.5,
      overTwelve: 15,
    },
    relationshipYears: {
      underSixMonths: 0.4,
      sixToTwelveMonths: 0.75,
      oneToTwoYears: 1.5,
      twoToFourYears: 3,
      overFourYears: 5,
    },
  },
  dimensionSupport: { stage2From: 40, stage3From: 60, stage4From: 80, warnBelow: 50 },
  stageGates: {
    stage2: { minMarketProduct: 50 },
    stage3: { minRatio: 3, maxPaybackMonths: 12, minProductChannel: 60, minRetention: 50 },
    stage4: { minRevenueMarket: 60, minConversion: 70, minStructureAnswer: 3 },
  },
  risk: {
    maxRisks: 5,
    highFrom: 16,
    mediumFrom: 6,
    retentionBelow: 40,
    paybackAboveMonths: 12,
    signals: {
      "SIG-01": { probability: 4, impact: 4 },
      "SIG-02": { probability: 4, impact: 5 },
      "SIG-03": { probability: 3, impact: 3 },
      "SIG-04": { probability: 3, impact: 4 },
      "SIG-05": { probability: 3, impact: 4 },
      "SIG-06": { probability: 3, impact: 3 },
      "SIG-07": { probability: 2, impact: 4 },
      "SIG-08": { probability: 3, impact: 3 },
    },
  },
  confidence: { totalItems: 26, highUpTo: 0.1, mediumUpTo: 0.25 },
  plan: {
    size: 3,
    dimensionOrder: ["mp", "pc", "mm", "aq", "en", "co", "re"],
    invest: { minStage: 3 },
  },
};
