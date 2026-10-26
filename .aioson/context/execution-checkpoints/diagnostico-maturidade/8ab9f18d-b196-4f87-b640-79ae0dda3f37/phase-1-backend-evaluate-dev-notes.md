# phase-1-backend-evaluate dev notes (unverified work data)

## Checklist
- [x] Read rules/types/modules API (types.ts, rulesV1.ts, stageGate, dimensionScores, riskSignals, confidence, unitEconomics)
- [x] Read PRD RULE-dm-09 (action plan) + G1-G4 reference cases (PRD lines 215-260, 419-430)
- [x] shared/domain/actionPlan.ts (buildActionPlan, isInvestEligible; written, untested)
- [x] shared/domain/evaluateDiagnosis.ts (written, untested)
- [x] tests/fixtures/rulesV2.ts (v1 + stage3.minProductChannel 70; use a G3 variant with pc answers all 2 -> pc 67: v1 stage 3, v2 stage 2 lock pc)
- G1-G4 calculators: G1 spend unknown/new range from11To30/4500c/twoToThree/oneToTwoYears/40; G2 parts sum 354000, 59 new, 4800c, sevenToTwelve, oneToTwoYears, 40; G3 2.4M, 80, 45000c, twoToThree, twoToFourYears, 55; G4 3M, 100, 20000c, fourToSix, twoToFourYears, 50
- Test imports: no .ts extension (sibling style); source imports use .ts
- [x] tests/unit/evaluateDiagnosis.test.ts (44 tests)
- [x] Verified: `pnpm exec vitest run tests/unit/evaluateDiagnosis.test.ts` exit 0 (44 passed); `pnpm test -- <file>` runs whole suite (literal `--`), exit 0, 439 passed; tsc --noEmit exit 0; mutation check caught; logs in .aioson/runtime/execution-temp/.../phase-1-backend-evaluate-dev/
- [x] Report JSON written (verdict PASS). Nothing left to do.

## Findings
(none yet)
