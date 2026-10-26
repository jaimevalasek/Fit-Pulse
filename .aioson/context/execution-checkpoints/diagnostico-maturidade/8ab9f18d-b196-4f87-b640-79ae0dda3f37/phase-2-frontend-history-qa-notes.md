# phase-2-frontend-history QA notes (bounded)

Unit: diagnostico-maturidade / phase-2-frontend-history (lane frontend, wave 7)
Scope: CAP-dm-history, AC-dm-30, AC-dm-31, IF-005
Done when: `pnpm build` exits 0
Log dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-2-frontend-history-qa/

## Checklist
- [x] Run `pnpm build` (foreground), save full log + exit code
- [x] If build fails only on server/report/* (concurrent unit), re-run; attribute per contract (not needed: now clean)
- [x] Read historyApi.ts (62 lines) - OK, matches IF-005 paths/types
- [x] Read App.tsx (43 lines) - OK, routes /comparar/:diagnosisId, /resultado, /empresa/:companyId
- [x] Read CompanyTimeline.tsx 1-313 - OK (see notes)
- [x] Read CompanyPage.tsx (336 lines) - OK: company-diagnoses removed, company-empty + note + CompanyTimeline wired; useCompany.reload keeps company (no flash)
- [x] Read ComparePage.tsx (328 lines) - AC-dm-31 OK except 409 mapping (see findings)
- [ ] Read ResultPage.tsx (291 lines) - Exportar PDF slot, CompareWithLink
- [x] discardDiagnosis exported from diagnosesApi.ts:102 - OK
- [x] Fix ComparePage.tsx L83: 409 check -> error.code === "no_previous_diagnosis" (ApiError has .code, httpClient.ts:27). APPLIED (correction 1). Server historyService.ts:212-219 requireCompleted throws diagnosis_not_completed 409 for drafts; compare() L257-263 throws no_previous_diagnosis.
- [x] Re-run pnpm build after correction (build2.log): EXIT_CODE=0, no TS errors
- [x] Read ResultPage.tsx header (L144-158) - OK, CompareWithLink in header actions; Exportar PDF not due in this unit
- [x] Glob tests/e2e/history*.spec.ts -> not present (deferred integration evidence, medium verification_not_run)
- [x] Write report JSON (verdict PASS: build 0 after 1 correction; no critical/high) -> reports/.../phase-2-frontend-history-qa.json
- DONE. Next action for a fresh context: none; integration owns the deferred e2e/Play checks.
- [ ] Write report JSON to reports/.../phase-2-frontend-history-qa.json

## Findings so far
- Build: `pnpm build` = `tsc --noEmit && vite build`, exit 0, log build1.log (EXIT_CODE=0). No TS errors. The pdfRenderer.ts error the implementer saw is gone (concurrent unit fixed it).
- CompanyTimeline.tsx: hooks before early returns OK; archive/restore/discard via ConfirmDialog (closes only on success, shows own error on throw) OK. data-row-id/data-status/data-action/data-aioson-id selectors present as implementer documented.
- CompanyTimeline.tsx L181: Compare link only when entry.canCompare (BR-dm-08) OK.
- No defects found yet.

## Edits made
- none yet

## Verification results
- pnpm build -> exit 0 (log: phase-2-frontend-history-qa/build1.log)

## Next small action
- Read CompanyPage.tsx in <=120-line chunks; grep for company-diagnoses (should be gone) and company-empty.
