# phase-6-frontend-questionnaire — dev notes

started_at: 2026-10-26T00:58:29Z

## Checklist
- [ ] context:brief rules
- [ ] read src/api/questionnaireApi.ts (IF-011), historyApi draft field, homeApi awaiting
- [ ] SendQuestionnaireDialog.tsx (create)
- [ ] ImportAnswersDialog.tsx (create; ConfirmDialog replace)
- [ ] CompanyPage.tsx buttons + "Questionário enviado em {data}"
- [ ] CompanyTimeline.tsx draft mark
- [ ] ConsultantHome.tsx awaiting list
- [ ] CompaniesPage.tsx filter aguardando
- [ ] pnpm typecheck (log under runtime/execution-temp/.../phase-6-frontend-questionnaire-dev/)
- [ ] report JSON

## Findings
- IF-011 in src/api/questionnaireApi.ts: sendQuestionnaire(id) -> {fileId,fileName,directory,sentAt,message}; importAnswers(id,{content,replaceDraft}) -> {draftId,clientSavedAt}; 409 draft_exists details.draftCreatedAt; 413/422 codes.
- revealSavedFile(fileId) in src/api/filesApi.ts = "Mostrar na pasta". ConfirmDialog at src/components/feedback/ConfirmDialog.tsx.
- Mode: usePreferences() from src/features/preferences/PreferencesProvider.tsx.
- GAPS (src/api not in lane): homeApi ConsultantHomeData lacks awaitingQuestionnaires; companiesApi CompanyAttention lacks "aguardando"; Company has no sent date -> widen locally + finding.
- Prototype: openSend/openImport lines 1130-1152, 1296-1306; company head-actions line 732; timeline draft row 738-743; widget line 704.
- DONE CompanyTimeline.tsx DraftRow: data-source=client-answers, "Respostas do cliente, salvas em {data}", button "Revisar e concluir" when clientAnswersSavedAt.
- Server messages (server/validation/questionnaireSchemas.ts) already carry the specific refusal text; dialog appends " Nada foi alterado.". 409 draft_exists details.draftCreatedAt.
- Plan: sent date on CompanyPage from getConsultantHome().awaitingQuestionnaires (no company field) + send response.
- DONE SendQuestionnaireDialog.tsx (idle/saving/saved/failed; useCopyMessage, useRevealFile) and ImportAnswersDialog.tsx (useAnswersImport, ReplaceDraftConfirm via ConfirmDialog). Not yet typechecked.
- NEXT: CompanyPage actions + sent notice; ConsultantHome awaiting widget/list; CompaniesPage filter.
- DONE CompanyPage (CompanyQuestionnaireActions, usePendingQuestionnaire via getConsultantHome, QuestionnaireSentNotice, Outlet key bump on import), ConsultantHome ("aguardando" indicator), CompaniesPage (ListAttention incl. aguardando).
- VERIFIED pnpm typecheck exit 0 (log typecheck.log/typecheck.exit in run temp dir).
- NEXT: lint my files, write report.
- Re-ran pnpm typecheck after chooseFile guard: exit 0.
- DONE report written: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-6-frontend-questionnaire.json (PASS).

## attempt1 (upstream_contract_repair, 2026-10-26)
- Upstream rename already landed: src/features/reports/ gone, src/features/report-center/ has the 8 files; App.tsx, ResultPage.tsx, BrandSection.tsx import @/features/report-center/*. No edit needed in this unit.
- `pnpm typecheck` exit 1 twice (typecheck-attempt1*.log): pnpm deps check runs install -> postinstall prisma migrate deploy -> "database is locked" (preview running on :3543 holds data/fitpulse.db; package.json changed by concurrent phase-7). Not a type error.
- `node node_modules/typescript/bin/tsc --noEmit` (= typecheck script) exit 0 (tsc-direct-attempt1.log/.exit).
- NEXT: write attempt1 report.
