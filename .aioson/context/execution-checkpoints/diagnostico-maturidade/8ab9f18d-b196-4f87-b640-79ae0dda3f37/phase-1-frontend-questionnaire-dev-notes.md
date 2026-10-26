# phase-1-frontend-questionnaire — dev notes
started: 2026-10-23
## Checklist
- [ ] read context brief + existing src (App.tsx, api, primitives) + shared modules (questionBank, calculatorOptions, unitEconomics, completeness, money, displayNumbers)
- [ ] find IF-003 contract (routes/fields) in plan/PRD
- [x] diagnosesApi.ts (start/get/update/discard/complete + readPendingBlocks)
- [x] useDraftAutosave.ts (useSaveQueue split, 600ms typed pause, pagehide flush)
- [x] AnchoredQuestion (+QuestionHeading export), BlockRail (+SaveStatus, blockHref ?bloco=1..8) — [x] CompletionGate (quiz-missing alert, gate confirm, calculating overlay, 422 pendingBlocks)
- [x] CalculatorBlock, UnitEconomicsPanel
- [x] QuestionnairePage + App.tsx route (CompanyPage onStartDiagnosis=startDiagnosis)
- [x] pnpm build exit 0 (log+exit in runtime temp dir)
- [x] report JSON written (PASS)
## Findings
## Next action
done
- IF-003 at plan line 442: Diagnosis {id, companyId, status, answers, calculator, currentBlock, updatedAt, rulesVersion?, result?, previous?{stage,completedAt}}; PATCH partial {answers?, calculator?, currentBlock?}; errors 400 validation_failed/404 diagnosis_not_found/409 diagnosis_not_draft/422 incomplete+pendingBlocks
- shared: pendingBlocks/isBlockComplete (shared/domain/completeness.ts), computeUnitEconomics(calc, rulesV1), formatRatioWithBand/formatPayback/NOT_CALCULATED_LABEL/NO_NEW_CUSTOMERS_EXPLANATION (displayNumbers), formatMoney (money), BLOCKS/questionsOfBlock (questionBank), CALCULATOR_FIELDS etc (calculatorOptions), EMPTY_CALCULATOR (types)
- src imports shared as "../../../shared/x" (no .ts). CompanyPage has prop onStartDiagnosis(companyId)=>Promise<{id}> -> wire in App.tsx
- primitives: MoneyField({id,label,cents,onCentsChange}), ConfirmDialog({open,onOpenChange,title,consequence,confirmLabel,tone,onConfirm,dataId}), StatusView({state,title,description,onRetry,dataId}), Button variants metal/gate
- running pnpm build -> .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-1-frontend-questionnaire-dev/build.log (+build.exit)
- RESULT: pnpm build exit 0 after final edit. Next: write report JSON.

## Rework round 1 (r1)
- [x] repro probe (FAIL before: probe-before.exit=1) (temp dir vitest config) for 422 incomplete -> readPendingBlocks null (httpClient.toApiError drops error.pendingBlocks; server/http/errorHandler.ts:77 spreads details into error)
- [x] fix in diagnosesApi.completeDiagnosis: on 422 incomplete w/o block list, GET diagnosis + shared pendingBlocks() (same fn server uses, diagnosisService.ts:204) -> rethrow ApiError with details.pendingBlocks
- [x] low: Diagnosis.createdAt (server sends it, diagnosisService.ts:141) -> DiscardDraftDialog date (QuestionnairePage.tsx:172)
- [x] probe-after exit 0 (3/3), pnpm build exit 0, typecheck exit 0 (logs in runtime temp dir)
- next: write r1 report

## r1 attempt1 (re-verify)
- httpClient now sends Content-Type on all JSON writes (JSON_WRITE_METHODS) and readErrorDetails folds extra error keys into details -> upstream 415 + lost pendingBlocks fixed upstream
- diagnosesApi.ts: comment updated only (fallback GET kept as defense)
- probe-r1a1 (dev probe 3/3 pass; QA probe 5/6: only the "extra GET" call-sequence assertion fails, readPendingBlocks result correct; obsolete after httpClient fix)
- build-r1a1.exit 0, typecheck-r1a1.exit 0
- next: report written -> done
