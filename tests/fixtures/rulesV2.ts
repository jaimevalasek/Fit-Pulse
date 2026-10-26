import type { Rules } from "../../shared/domain/types";
import { rulesV1 } from "../../shared/rules/rulesV1";

/**
 * Test-only rules, version 2: identical to v1 except that stage 3 asks for
 * "Produto e canal" ≥ 70 instead of 60. A case with that score between 60 and
 * 69 therefore reaches stage 3 under v1 and stops at stage 2 under v2 (AC-dm-22, AC-dm-31).
 */
export const rulesV2: Rules = {
  ...rulesV1,
  version: 2,
  stageGates: {
    ...rulesV1.stageGates,
    stage3: { ...rulesV1.stageGates.stage3, minProductChannel: 70 },
  },
};
