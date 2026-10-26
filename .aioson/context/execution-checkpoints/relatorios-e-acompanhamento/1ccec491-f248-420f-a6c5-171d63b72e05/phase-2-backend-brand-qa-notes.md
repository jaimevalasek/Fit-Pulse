# phase-2-backend-brand QA notes (run 1ccec491-f248-420f-a6c5-171d63b72e05)

Unit: phase-2-backend-brand, lane backend, CAP-ra-brand / AC-ra-21, IF-003, IF-004.
Done when: pnpm exec vitest run tests/unit/contactFormat.test.ts tests/unit/imageSignature.test.ts tests/api/preferenceRoutes.test.ts

## Checklist
- [x] Run done-when command -> EXIT=0, 3 files, 166 tests passed (log in runtime temp dir done-when.log/.exit)
- [x] Read imageSignature.ts, brandSchemas.ts, preferenceRepository.ts, brandService.ts, brandRoutes.ts, preferenceService.ts, phone.ts, contact.ts
- [x] readAll: no remaining importers (grep server/shared/src/tests/scripts); readKeys used by brandService + preferenceService
- [x] pnpm exec tsc --noEmit -> EXIT=0 (tsc.log/tsc.exit in temp dir)
- [x] ZodError handled in server/http/errorHandler.ts
- [x] Sibling test files tests/api/brandRoutes.test.ts, tests/unit/pdfRenderer.test.ts, tests/e2e/brand.spec.ts do not exist (deferred to integration/sibling units)
- [x] Probe phone.ts forward-Delete (probe-phone-delete.mts in temp dir, EXIT 0): "(11) 912345678" caret 10 -> "(11) 91235-678" (same as Backspace over hyphen; intended per maskPhoneInput comment, Delete indistinguishable)
- [x] Write report JSON (verdict PASS, 0 corrections, medium verification_not_run for sibling/integration checks)

## Findings so far
- LOW phone.ts maskPhoneInput: separatorWasDeleted treats any deleted separator as Backspace and removes the digit before caret; a forward Delete over '-' or ')' also removes the digit before it. Helper cannot tell Backspace from Delete (no inputType arg). Not fixable locally without signature change -> finding, not corrected.
- LOW brandService/brandSchemas: only "image/png" and "image/jpeg" accepted as declared mimeType ("image/jpg" refused). Frontend must send file.type; not a defect for browsers (they report image/jpeg).
- Not wired: server/app.ts does not mount brand router yet (integration).

## Corrections made
- (none)

## Verification results
- done-when: EXIT 0, 166 passed
- tsc --noEmit: EXIT 0

## Next small action
- Probe forward-Delete behaviour once, then write report JSON at .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-backend-brand-qa.json
