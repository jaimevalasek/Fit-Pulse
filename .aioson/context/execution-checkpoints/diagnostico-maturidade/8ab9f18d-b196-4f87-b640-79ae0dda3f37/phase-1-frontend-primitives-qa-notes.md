# phase-1-frontend-primitives QA notes (attempt 78b3e9be, review r1)

Temp dir (run-scoped): .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-primitives-qa/
Report target: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-primitives-qa.r1.json

## Checklist
- [x] Read notes + src/api/httpClient.ts: body `{}` + Content-Type on POST/PUT/PATCH; buildUrl before try; readErrorDetails fallback present
- [x] Create temp dir; run `pnpm build` foreground: exit 0 (build.log, build.exit=0; tsc && vite build ok)
- [x] Re-run dev repro.mjs against current code: 12/12 PASS exit 0 (repro-after-rerun.log/.exit in QA temp dir). Before-fix log in dev dir: exit 1 (7 FAIL)
- [x] server requireJsonWrites (server/http/requestGuards.ts:34-37) 415 only for write without JSON content-type; app.ts:38 mounts globally; repro uses the real guard
- [x] ApiError.details consumers: CompanyFormDialog.tsx:97-101 reads details.fields; diagnosesApi.ts:73-98 reads details.pendingBlocks (+ draft fallback). Shapes match readErrorDetails
- [x] Exact call sites: diagnosesApi.ts:43 start, :63 complete; companiesApi.ts:68,72 archive/restore (POST no body). Repro covers same httpClient path, not the api functions
- [ ] Write r1 JSON report (verdict PASS; real createApp e2e + ConfirmDialog browser = verification_not_run medium)

## Findings (concrete)
- Round-1 finding (src/api/httpClient.ts request()): Content-Type only set when body passed -> 415 on body-less writes. Now FIXED: httpClient.ts:93 sets header on every POST/PUT/PATCH, :102 sends `{}`. Observed: repro PASS for start/complete/archive/restore/put.
- Round-1 details shape: now fixed (readErrorDetails, httpClient.ts:66-70); fields and pendingBlocks reach consumers.
- Deferred to integration (not local): real createApp e2e (tests/api or tests/e2e/companies.spec.ts, questionnaire.spec.ts); calculator e2e; ConfirmDialog Esc/focus-trap in browser.
- Concurrent unit phase-2-backend-history files: not reviewed; build passed with them present.

## Edits made (this attempt)
- none (0 of 3 correction budget used)

## Verification
- pnpm build (this attempt): exit 0, build.log / build.exit=0
- repro (this attempt, real httpClient + real requireJsonWrites + fetch stub): exit 0, repro-after-rerun.log / repro-after-rerun.exit=0

## Next small action
- Write r1 JSON report (verdict PASS).
