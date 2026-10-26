# phase-1-backend-rules dev notes
Checklist:
- [ ] read types.ts / rulesV1.ts / displayNumbers.ts contracts
- [ ] unitEconomics.ts + test
- [ ] dimensionScores.ts
- [ ] stageGate.ts
- [ ] confidence.ts
- [ ] riskSignals.ts
- [ ] completeness.ts
- [ ] diagnosisRules.test.ts
- [ ] run pnpm test (unitEconomics + diagnosisRules), save log+exit code
- [ ] write report JSON

## Progress (update 1)
- Read: types.ts (Rules/UnitEconomics/DiagnosisResult shapes), rulesV1.ts, displayNumbers.ts, PRD RULE-dm-01..10, G1-G4 table, IF-004 names (computeUnitEconomics, pendingBlocks).
- DONE shared/domain/unitEconomics.ts: computeUnitEconomics(calculator, rules), roundHalfUp. cac=0 => ratio null (product gap, report as note). SIG-06 fires on neverPaysBack (my choice).
- Decisions: ratio from rounded cents; payback from exact monthly profit; origin unknown when customers==0.
- NEXT: dimensionScores.ts (computeDimensionScores, ratioPoints, supportedStage, findWeakestDimension), stageGate.ts (computeStageAndLock), confidence.ts (computeConfidence), riskSignals.ts (detectRisks), completeness.ts (pendingBlocks, isBlockComplete), then tests.

## Progress (update 2)
- DONE (written, untested): dimensionScores.ts (computeDimensionScores, computeDimensionScore, ratioPoints, supportedStage, findWeakestDimension), stageGate.ts (computeStageAndLock), confidence.ts (computeConfidence, countUnknownItems), riskSignals.ts (detectRisks, riskLevelOf), completeness.ts (pendingBlocks, isBlockComplete, isCalculatorComplete). unitEconomics also exports isCents, sumSpendParts, roundHalfUp.
- NEXT: write tests/unit/unitEconomics.test.ts then tests/unit/diagnosisRules.test.ts (G1-G4 inputs inline), run pnpm test with log under .aioson/runtime/execution-temp/.../phase-1-backend-rules-dev/, write report JSON.

## Progress (update 3)
- tests/unit/unitEconomics.test.ts written; first run (pnpm test -- file) ran ALL 6 test files (the `--` filter is not applied by pnpm 11/vitest): only failure of mine was a too-tight roundHalfUp(2.4999999999) assertion (fixed to 2.4999). Other failures: tests/api/playRoutes.test.ts (2 tests: 503 database_unavailable, 403 host_not_allowed Host "") = unit phase-1-backend-http, NOT mine -> rerun before reporting.
- Logs: .aioson/runtime/execution-temp/.../phase-1-backend-rules-dev/unitEconomics.log (+ .exit)
- NEXT: write tests/unit/diagnosisRules.test.ts (hand-built UnitEconomics, G1-G4 tables for scores/stage/lock/risks/confidence, boundaries, completeness), run `pnpm exec vitest run <2 files>` and the official pnpm test command; typecheck shared+tests; write report.

## Progress (update 4)
- tests/unit/diagnosisRules.test.ts written. `pnpm exec vitest run <2 files>` => exit 0, 2 files / 201 tests pass (log: .../phase-1-backend-rules-dev/focused.log, focused.exit).
- NEXT: tsc typecheck of my files, mutation sanity, official `pnpm test -- <2 files>` (runs full suite; playRoutes failures are unit phase-1-backend-http), write report JSON.

## Final (update 5)
- Official `pnpm test -- <2 files>` exit 0 (7 files/395 tests), focused exit 0 (201), tsc exit 0, mutation sanity ok (12 fail, restored), rules:check 0 violations.
- Report written: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-rules.json (verdict PASS). Unit finished.
