# phase-1-backend-rules QA notes (unit: phase-1-backend-rules, lane backend)

Status: bookkeeping only. Not proof of PASS. Current code and verification output win.
Run dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-rules-qa/

## Checklist
- [x] Read unit files: shared/domain/{unitEconomics,dimensionScores,stageGate,confidence,riskSignals,completeness}.ts
- [x] Read tests/unit/unitEconomics.test.ts (G1-G4, rounding, zero cases) and test names of tests/unit/diagnosisRules.test.ts
- [x] Official verification: `pnpm test -- tests/unit/unitEconomics.test.ts tests/unit/diagnosisRules.test.ts` -> exit 0 (official.log / official.exit). Whole suite ran: 7 files, 395 tests passed.
- [x] Focused verification: `pnpm exec vitest run tests/unit/unitEconomics.test.ts tests/unit/diagnosisRules.test.ts` -> exit 0 (focused.log / focused.exit). 2 files, 201 tests passed.
- [x] Typecheck: `npx tsc --noEmit` -> exit 0, empty log (tsc.log / tsc.exit).
- [x] Checked rulesV1 constants vs PRD RULE-dm-02/03/04/06/07/08, SIG table (SIG-02 20, SIG-06 9), es1 >= 3 = "Áreas separadas, cada uma com responsável". All match.
- [x] Checked DIMENSION_KEYS tie order vs RULE-dm-09 (mp, pc, [cm], mm, aq, en, co, re): consistent.
- [x] Write report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-rules-qa.json (written, JSON parse ok, verdict PASS)

## Findings
- No critical/high defect found. No file edited (corrections[] empty).
- Low/decision (not fixed, product question): R$0 spend with new customers > 0 gives CAC 0, ratio null, stage 3 lock 'ratio'. Escalate to integration.
- Low/decision (not fixed, product question): SIG-06 also fires with neverPaysBack (BR-dm-15 names only SIG-02). Consistent with "não se paga" > 12 months; escalate to integration.
- Deferred: e2e halves of AC-dm-19/21/23/24/49/51 (UI+server) belong to integration.

## Next small action
- Write the report JSON, then final message.
