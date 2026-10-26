# QA r1 attempt1 notes — phase-1-frontend-questionnaire (lane frontend)

Status: new attempt. Previous-context notes were unverified; code re-read this attempt.
Temp dir: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-questionnaire-qa/
Report: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-questionnaire-qa.r1.attempt1.json

## Checklist
- [x] C1 Prior R1 (422 pendingBlocks lost in httpClient): read httpClient readErrorDetails (L66-70) + toApiError (L72-86); diagnosesApi completeDiagnosis (L61-67), withPendingBlocks (L80-91), readPendingBlocks (L94-98)
- [x] C2 Server 422 shape: server/services/diagnosisService.ts L85-91 code "incomplete", details {pendingBlocks}; server/http/errorHandler.ts L77 spreads details beside code -> client sees error.pendingBlocks -> folded into details. Real shape = handled.
- [ ] C2b Prior R2 (walkthrough not run): probe-level substitute only; rest verification_not_run
- [x] C3 Prior R3 (discard date): QuestionnairePage.tsx L172 uses diagnosis.createdAt else draft.savedAt (read)
- [x] C4 Prior LOW gate silent: CompletionGate.tsx runCompletion L101-120 -> readPendingBlocks null -> setError(COMPLETE_ERROR) (read)
- [x] C5 IF-003 routes: diagnosesApi.ts (verified earlier in r1; re-check URLs via probe)
- [ ] C6 AC-dm-12 autosave: useDraftAutosave.ts not yet read
- [x] C7 pnpm build -> EXIT=0 (build-attempt1.log/.exit in qa dir)
- [x] C9 QA probe (prev file, unchanged) -> EXIT=1: 5 passed, 1 failed. Only failing assertion = obsolete extra GET expectation in "R1 server shape" (blocks assertion passed). Log: probe-r1-attempt1-prev-probe.log/.exit
- [ ] C9b New attempt1 probe (corrected expectation + new cases: exact-call-count, invalid block filter, complete draft null, Content-Type on body-less POST, IF-003 URLs) -> run, log + exit
- [x] C10 report JSON written and parsed (verdict PASS)

## Findings (concrete, this attempt)
- F-A R1 transport: RESOLVED. Server-shaped 422 -> httpClient folds pendingBlocks into ApiError.details -> readPendingBlocks returns list with no extra GET.
- F-B Prev QA probe "R1 server shape" expects extra GET: OBSOLETE (not an app defect). Probe scratch file only.
- F-C httpClient.ts is outside the unit file list (lane write path src/** only). Changed by implementer (readErrorDetails, JSON content-type on POST/PUT/PATCH). Cannot be corrected by QA (outside unit). Report as finding for integration if it matters (medium, shared-client ownership).

## Edits made
- none (QA makes no source edits this attempt)

## Verification
- pnpm build EXIT=0
- prev probe EXIT=1 (1 obsolete assertion)

## Next small action
- Read src/features/diagnosis/useDraftAutosave.ts (bounded) for AC-dm-12; grep diagnosesApi exports for IF-003 signatures; then write attempt1 probe file in qa dir and run it.

## Slice 2 (verified)
- [x] C9b attempt1 probe questionnaire-r1-attempt1.probe.test.ts: 11/11 pass, EXIT=0 (probe-r1-attempt1.log/.exit). Covers R1 server shape (exact 1 request), details shape, invalid-entry filter [0,3,9,"2",8.5,8]->[3,8], all-invalid list fallback, draft GET fail null, 409 null, network null, body-less POST Content-Type+{} body, startDiagnosis POST path, updateDiagnosis PATCH, discardDiagnosis DELETE.
- [x] pnpm typecheck EXIT=0 (typecheck-attempt1.log/.exit)
- [x] C6 useDraftAutosave.ts read: drain keeps pending patch on failure, savedAt set only on success, state error. AC-dm-12 autosave logic consistent (UI walkthrough not run).
- [x] Screens: no direct fetch or /api literal in src/features/diagnosis; only diagnosesApi/httpClient/useDraftAutosave imports, plus companiesApi.getCompany in QuestionnairePage.tsx L7 (company name header) -> IF-002 route, outside the IF-003 literal in Done-when. Finding F-D (medium, scope note).
- F-C httpClient.ts is outside unit files; implementer changed it. Not a defect observed; message to integration.

## Verdict (planned)
- PASS. build 0, typecheck 0, probes 11/11 (attempt1) with prev probe obsolete assertion only. Prior R1 resolved, R2 partly (probe-level) + verification_not_run, R3 resolved, LOW gate resolved.
- Medium: verification_not_run browser walkthrough and e2e specs; medium scope note companiesApi.getCompany.

## Next small action
- Write report JSON at reports dir (attempt1 path), then final message.
