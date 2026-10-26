# Notes — phase-1-backend-content (diagnostico-maturidade)

Run 8ab9f18d / attempt a924bdf6. Unverified work data.

## Checklist
- [x] 1. context:brief + read PRD rules (L215-258), content v1 (L315-430), prototype ITEMS/ACTIONS/LOCKS (L518-690)
- [x] 2. shared/domain/types.ts (written)
- [x] 3. shared/rules/rulesV1.ts (written)
- [x] 4. shared/content/stageContent.ts, riskCatalog.ts, actionCatalog.ts (written)
- [x] 5. shared/content/questionBank.ts, calculatorOptions.ts (written)
- [x] 6. tests/unit/questionBank.test.ts, forbiddenTerms.test.ts (written)
- [x] 7. verified: `pnpm test -- <2 files>` exit 0 (ran all 4 unit files, 146 tests: the `--` makes vitest ignore filters); `npx vitest run <2 files>` exit 0 (18 tests); `npx tsc --noEmit` exit 0. Logs: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-content-dev/test-final*.log, *.exit. PRD cross-check script compared 24 questions, 8 risks, 14 actions: 0 mismatches.
- [x] 8. report JSON written

## Design decisions (so far)
- No shared/ or tests/ dirs existed at start; imports in repo use plain TS (tsconfig bundler, allowImportingTsExtensions, verbatimModuleSyntax -> `import type`).
- Blocks: 1 = calculator ("Seus números"), 2..8 = clientes, canais, mercado, atrair, conversar, vender, manter (IF-003 currentBlock 1..8).
- Calculator shape follows prototype state (spendMode/spendParts/spendRange/newCustomers*/averagePurchaseCents/purchasesPerYear/relationshipLength/marginPercent); range keys are stable strings; midpoints live in Rules (rulesV1), labels in calculatorOptions.
- Rules = one nested object type in types.ts; rulesV1.ts exports RULES_VERSION=1 + rulesV1. Midpoints from prototype: spend cents 50000/300000/1000000/3250000/6000000; customers 5/20/65/200/400; purchases/yr 1/2.5/5/9.5/15; years 0.4/0.75/1.5/3/5 (verified vs G2-G4 LTV).
- Stage-4 structure criterion: es1 answer >= 3.
- Prototype engine differs from PRD in places (cm formula) -> PRD wins.

## Findings
- low: `pnpm test -- <files>` forwards a literal `--` so vitest runs every unit test, not just the named files (package.json owned by foundation).

## Next action
Write the report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-content.json, then stop.
