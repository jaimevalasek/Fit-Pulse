# phase-6-backend-questionnaire-api dev notes
Started: 2026-10-25
Checklist:
- [x] context:brief rules (must_load) - read, english identifiers, thin routes, repo for queries
- [x] read patterns
- [x] prisma QuestionnaireSend (draft_id no FK; idx company+answered, draft) + migration (via prisma migrate diff; prisma format ran)
- [x] questionnaireSchemas.ts
- [x] questionnaireRepository.ts
- [x] diagnosisRepository.ts create/replace draft tx
- [x] questionnaireService.ts
- [x] questionnaireRoutes.ts + app.ts
- [x] src/api/questionnaireApi.ts
- [x] tests/api/questionnaireRoutes.test.ts (written, NOT yet run)
- [x] verify: vitest questionnaireRoutes+diagnosisRoutes, smoke-migrate (logs in runtime/execution-temp/.../phase-6-backend-questionnaire-api-dev/)
- [x] report JSON (written, valid JSON)
Findings: (none yet)

## Findings (read phase)
- Patterns: routes in server/routes/*Routes.ts (createXRoutes({svc})), brandRoutes has own express.json parser before app's 1mb; app.ts mounts before `app.use(express.json({limit:"1mb"}))`.
- saveFile({directory, stem, extension, content}) in server/files/downloadsFolder.ts; generatedFileRepository.insert({companyId, kind:'questionnaire_html', fileName, directory, createdAt}) (kind already allowed).
- questionnaireFile.ts exports: ANSWERS_FILE_FORMAT, _FORMAT_VERSION(1), QUESTIONNAIRE_VERSION(1), buildQuestionnaireFile({company,brand:{name,phone,email,logoDataUrl},sentAt}) -> {html,fileName,answersFileName}, buildClientMessage(companyName, brandName).
- IF-011: send {} -> {fileId,fileName,directory,sentAt,message}; import {content:string<=1MB, replaceDraft?} -> {draftId, clientSavedAt}; 409 draft_exists(+draftCreatedAt); 422 answers_other_company (two names), answers_newer_version, answers_incompatible, answers_invalid; 413 big file; nothing changes on failure. Timeline: draft.clientAnswersSavedAt (other unit).
- diagnosisPatchSchema (server/validation/diagnosisSchemas.ts) validates {answers, calculator}; strict (no diarySource/diarySuggestion).

## Design decisions
- Server msgs exclude 'Nada foi alterado.' (UI adds it). 422 answers_other_company details: fileCompanyName/currentCompanyName. 413 payload_too_large with specific msg (route maps entity.too.large). 409 draft_exists {draftCreatedAt}.
- Order of refusal: size>1MB(413) -> invalid -> newer_version -> other_company -> incompatible(diagnosisPatchSchema / older questionnaireVersion) -> draft_exists.
- Import marks ALL unanswered sends of company answered (answeredAt=now, clientSavedAt=min(savedAt,now), draftId); none open -> inserts a row (fileName=answers file name). Same tx as draft create (diagnosisRepository.importDraft with afterCreate(tx, record)).
- send: saveFile .html in downloadsDir; recordSend = generated_files(kind questionnaire_html)+questionnaire_sends in one $transaction; rm file on db fail -> 500 write_failed.
- Files use LF (new), repo uses CRLF; fine.

## Progress
- All source files written (schemas, repo, diagnosisRepository.importDraft, service, routes, app.ts, api client). prisma generate done. NEXT: write tests/api/questionnaireRoutes.test.ts, then run tsc + vitest + smoke-migrate, logs in runtime/execution-temp/.../phase-6-backend-questionnaire-api-dev/
- tsc: my files clean (only OwnerHome/ScoreTrend errors from other unit). NEXT: run vitest questionnaireRoutes+diagnosisRoutes -> log vitest.log/vitest.exit; then smoke-migrate

## DONE
- vitest questionnaireRoutes+diagnosisRoutes: 137 pass (exit 0); smoke-migrate PASS; neighbors 236 pass; tsc only other-unit errors. Report written; unit finished.
