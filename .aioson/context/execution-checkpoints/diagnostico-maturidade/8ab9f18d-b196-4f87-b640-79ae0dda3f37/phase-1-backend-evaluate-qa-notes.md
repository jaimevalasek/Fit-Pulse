# phase-1-backend-evaluate QA notes (unverified work data)

Unit: phase-1-backend-evaluate (lane backend). Scope CAP-dm-engine; AC-dm-18, 20, 25, 26, 49; IF-004.
Unit files: shared/domain/actionPlan.ts, shared/domain/evaluateDiagnosis.ts, tests/fixtures/rulesV2.ts, tests/unit/evaluateDiagnosis.test.ts
Done when: `pnpm test -- tests/unit/evaluateDiagnosis.test.ts` passes with G1-G4 exact.
Report: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-evaluate-qa.json
Temp logs: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-evaluate-qa/

## Checklist
- [x] Read notes of dev unit; read the 3 small unit files (actionPlan.ts, evaluateDiagnosis.ts, rulesV2.ts)
- [x] Read test file (495 lines; titles via grep, bounded reads of G-cases, plan, invest, purity sections)
- [x] Check PRD RULE-dm-09/10/11 (.aioson/context/prd-diagnostico-maturidade.md lines 227-229) and AC-dm-25/26 vs code: consistent. G1 (cac,mp,mm) G2 (re,dep,mp) G3 (co,invest,pc) G4 (invest,pc,mp) match exactly.
- [x] Literal Done-when: `pnpm test -- tests/unit/evaluateDiagnosis.test.ts` EXIT 0, log test-literal.log, 8 files/439 tests (literal `--` ignores file filter; low finding, package.json not a unit file)
- [x] Focused: `pnpm exec vitest run tests/unit/evaluateDiagnosis.test.ts` EXIT 0, test-focused.log, 44 passed
- [x] tsc --noEmit EXIT 0, tsc.log empty
- [x] Low finding: dep decided from risks capped at maxRisks=5 (riskSignals.ts:76). Under rulesV1 SIG-04 (score 12) is always in top 5 (only SIG-01 16 and SIG-02 20 score higher; wins 12-tie vs SIG-05 by catalog order), so no divergence now; only with other weights.
- [x] Decide verdict: PASS, corrections none (no file edited). Next: write report JSON.

## Deferred (integration, not this unit): tests/api/diagnosisRoutes.test.ts, AC-dm-22 persistence swap, e2e AC-dm-19/21/23/24/49, AC-dm-27 timing on Play Windows.

## Findings so far (concrete)
- actionPlan.ts buildActionPlan: candidates = lock, dep (if SIG-04 in risks), invest (if eligible), weakest dims; dedupe; slice(0, plan.size). Looks consistent with dev's description.
- actionPlan.ts isInvestEligible: stage>=plan.invest.minStage && origin==="measured" && confidence.level==="high". Verify vs PRD RULE-dm-10.
- evaluateDiagnosis.ts: pure composition; rulesVersion = rules.version. Verify no clock/IO.
- rulesV2.ts: spreads rulesV1, stage3.minProductChannel 70. Fine.

## Next small action
Read test file in bounded chunks (<=120 lines) and grep test names.
