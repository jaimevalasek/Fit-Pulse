# QA notes — phase-1-backend-diagnoses (lane backend) — attempt1 (round r1 re-run)

Run: 8ab9f18d-b196-4f87-b640-79ae0dda3f37 · attempt 4ed49447-65d4-4943-8a33-ba87d2367af1
Temp dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-diagnoses-qa/
Report target: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-diagnoses-qa.r1.attempt1.json

## Checklist (attempt1)
- [ ] K1 `pnpm test -- tests/api/diagnosisRoutes.test.ts` foreground; r2-test.log + r2-test.exit
- [ ] K2 F1 re-check: src/api/httpClient.ts request() Content-Type + rerun client probe (r2-client-probe.log)
- [ ] K3 F2 re-check: diagnosisSchemas.ts readAnswer/readStoredAnswers/readStoredCalculator + tests near diagnosisRoutes.test.ts:600/:623
- [ ] K4 F3 re-check: diagnosisRepository.ts startDraft archivedAt (owner decision, low)
- [ ] K5 `pnpm typecheck` foreground; r2-typecheck.log + exit
- [ ] K6 `node scripts/smoke-boot.mjs` foreground; r2-smoke-boot.log + exit
- [ ] K7 Write report JSON attempt1 (verdict per F1 outcome)

## Findings (attempt1, running)
- F1 RESOLVED in current code: src/api/httpClient.ts:92-93 sets Content-Type for every POST/PUT/PATCH (isJsonWrite); body sent as '{}' when absent (:102). Guard server/http/requestGuards.ts:34 requireJsonWrites still present (not relaxed, server/app.ts:40).
- F2 RESOLVED: server/validation/diagnosisSchemas.ts readAnswer:31, readStoredAnswers:141, readStoredCalculator:155 keep valid keys; tests diagnosisRoutes.test.ts:600 (leftover keys) and :623 (non-object row) present.
- F3 (startDraft archived company): re-check pending (K4).

## Verification log
- K1 `pnpm test -- tests/api/diagnosisRoutes.test.ts` exit 0; 12 files / 600 tests passed; r2-test.log / r2-test.exit (0).
- K2 `pnpm exec tsx <r1-client-probe.mts>` exit 0; r2-client-probe.log: start OK, archive OK, restore OK, complete (unknown id) 404 diagnosis_not_found (no 415); all 5 POSTs sent content-type application/json.

- K4 F3 still open, owner decision (low): no company_archived code in server/ or src/; PRD AC-dm-13 silent on archived companies; not counted against unit.
- K5 `pnpm typecheck` exit 0 (r2-typecheck.log / .exit).
- K6 `node scripts/smoke-boot.mjs` exit 0 PASS (r2-smoke-boot.log / .exit).
- K7 Report written: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-backend-diagnoses-qa.r1.attempt1.json, verdict PASS. corrections: [] (no unit-file edits). verification_not_run (medium): e2e questionnaire spec, AC-dm-27 timing, harness:check.

## Next action
None in this unit. Verdict PASS recorded; integration owns the e2e/AC-dm-27/harness checks and the F3 owner decision.
