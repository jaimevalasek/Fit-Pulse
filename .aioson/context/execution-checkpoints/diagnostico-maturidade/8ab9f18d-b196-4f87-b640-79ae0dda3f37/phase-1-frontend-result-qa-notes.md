# phase-1-frontend-result QA notes (attempt a35e2f10-969e-4605-85f0-92832e1044ed)

Unit: frontend / 1-frontend-result / CAP-dm-result / AC-dm-28, AC-dm-47 / IF-003
Done when: `pnpm build` exits 0.
Report: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-result-qa.attempt1.json
Prior attempt (383ebe8a) notes were superseded by this attempt; its findings were re-checked where cited below.

## Checklist
- [x] C1 Run `pnpm build` foreground; log + exit code in temp dir (this attempt): exit 0
- [x] C2 Run forbidden-terms unit test foreground: exit 0 (12 files, 600 tests passed; log + exit in temp dir)
- [x] C3 Confirm tests/e2e/result.spec.ts still absent (verification_not_run -> integration)
- [x] C4 Re-check motion evidence by grep (keyframes/reduced-motion/dash/transition in src)
- [x] C5 Decide corrections: none (no critical/high defect, no simple local fix)
- [x] C6 Write report JSON attempt1 (verdict PASS, parses)

## Findings (concrete)
- Medium: motion. StageLadder has no trace/dash animation (no strokeDash* in src/features/result). DimensionScores.tsx:61 has scale reveal with motion-reduce:transition-none and reduced-motion check at :14. AC-dm-47 reduced-motion path satisfied; prototype entrance/trace not implemented.
- Low: StageLadder.tsx:90 drops trail when previous === stage; caption ResultPage.tsx:167 still "Antes: estágio N". AC-dm-28 wants dashed previous step.
- Low: duplicate "Seus números" heading: NumbersAside (ResultPage.tsx:120) and NumbersSummary.
- Medium (verification_not_run): tests/e2e/result.spec.ts absent; cannot run AC-dm-28 e2e, AC-dm-46 390px/axe, AC-dm-47 reduced-motion e2e.
- ResultPage.tsx:143 previous = diagnosis.previous?.stage; backend previous = older completed diagnosis (prior attempt verified diagnosisService.ts:115-131).

## Verification log (attempt a35e2f10)
- pnpm build -> exit 0. Log: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-result-qa/build.log ; build.exit = 0
- pnpm test -- tests/unit/forbiddenTerms.test.ts -> exit 0. Log: .../phase-1-frontend-result-qa/forbidden-terms.log ; forbidden-terms.exit = 0 (filter not applied by vitest; whole suite ran, 600 passed)

## Next small action
- Write report attempt1 JSON with verdict PASS, then stop.
