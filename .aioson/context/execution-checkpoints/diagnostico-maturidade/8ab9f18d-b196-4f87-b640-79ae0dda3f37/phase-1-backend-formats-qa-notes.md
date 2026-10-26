# phase-1-backend-formats QA notes (attempt fab0c137)

## Checklist
- [x] C1 Done-when `pnpm test -- tests/unit/cnpj.test.ts tests/unit/money.test.ts` -> exit 0 (log: runtime/execution-temp/.../phase-1-backend-formats-qa/done-when.log, done-when.exit)
- [x] C2 Read unit files cnpj.ts, money.ts, displayNumbers.ts, companyOptions.ts
- [x] C3 Read test names of cnpj/money tests vs AC-dm-08, AC-dm-15, AC-dm-51, RULE-dm-03, BR-dm-03, BR-dm-14, BR-dm-15, IF-004
- [x] C4 Verified implementer message claims (signatures, exports, key tuples, labels vs prototype.html)
- [x] C5 No defect found -> no edits (corrections[] empty)
- [x] C6 Scoped run + tsc run pass -> write report JSON (in progress)

## Findings / edits
- No source edits made by QA.
- Low (verification note): Done-when `pnpm test -- <files>` ignores the file filter; vitest receives literal `--` and runs 4 files / 146 tests. Passes; scoped form `pnpm exec vitest run <files>` runs 2 files / 128 tests and passes.
- Deferred to integration (not this unit): e2e AC-dm-08 blur/aria-invalid/mask, AC-dm-15, AC-dm-51; unitEconomics.test.ts; CNPJ alphanumeric question for Product.

## Verification log
- done-when.log: exit 0, Test Files 4 passed, Tests 146 passed (runs whole suite via `--`).
- scoped-unit.log: `pnpm exec vitest run tests/unit/cnpj.test.ts tests/unit/money.test.ts` exit 0, 2 files, 128 tests passed.
- tsc.log: `pnpm exec tsc --noEmit` exit 0, no output.
- Ratio half-up probe (node): two-decimal ratios 0.00..1000.00, Math.round(r*10) vs exponent-shift rounding -> 0 mismatches. No change needed.

## Next action
Write report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-formats-qa.json, then final message.
