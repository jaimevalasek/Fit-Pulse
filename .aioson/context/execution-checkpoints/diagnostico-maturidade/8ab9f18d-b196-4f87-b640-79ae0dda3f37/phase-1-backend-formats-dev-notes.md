# phase-1-backend-formats — dev notes (unverified work data)

## Checklist
- [x] read rules/PRD/prototype (options in prototype.html:569-571; masks 1158-1166; bands 623-629)
- [x] shared/format/cnpj.ts + tests/unit/cnpj.test.ts (written, unverified)
- [x] shared/format/displayNumbers.ts (written) (leaf module; money.ts imports label+formatInteger from it)
- [x] shared/format/money.ts + tests/unit/money.test.ts (written, unverified)
- [x] shared/content/companyOptions.ts (written) (z.enum-friendly KEYS tuples + LABELS records)
- [x] run `pnpm test -- tests/unit/cnpj.test.ts tests/unit/money.test.ts` -> log in .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-formats-dev/
- [x] write report JSON (.aioson/context/reports/diagnostico-maturidade/8ab9f18d-.../phase-1-backend-formats.json)

## Design decisions
- Caret-preserving mask API: maskCnpjInput(raw, caret, previous?) / maskMoneyInput(raw, caret, previous?) -> {value, caret}; CNPJ counts digits left of caret, money counts digits right of caret (cents anchored right). Deleting a separator removes the digit before caret (needs `previous`).
- formatMoney manual (no Intl) -> "R$ 1.234,56" with plain space; invalid -> "não calculado".
- formatPayback accepts number | "never" | Infinity (-> "não se paga") | null/NaN (-> "não calculado"); JSON-safe "never" recommended to rules unit.
- Bands: <1 Crítico, 1..<3 Atenção, 3..5 Saudável (5.0 inclusive), >5 Pode investir mais; phrases from prototype.
- Open note: PRD says CNPJ numeric 14 digits; Receita alphanumeric CNPJ (from 2026-07) not supported -> note to integration.

## Findings
- shared/ and tests/ did not exist at start (other units create them concurrently).

## Verification (done)
- `pnpm test tests/unit/cnpj.test.ts tests/unit/money.test.ts` exit 0, 2 files / 128 tests; `pnpm exec tsc --noEmit` exit 0. Logs + .exit files in execution-temp/.../phase-1-backend-formats-dev/.
- `pnpm test -- <files>` form ignores filter (runs whole suite, exit 0) -> reported as finding + note to integration.
- Report written; unit finished: PASS.
