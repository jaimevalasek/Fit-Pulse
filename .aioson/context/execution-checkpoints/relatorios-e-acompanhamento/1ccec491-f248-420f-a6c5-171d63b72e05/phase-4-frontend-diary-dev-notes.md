# phase-4-frontend-diary — dev notes
started_at: 2026-10-26T00:42:36Z
## Checklist
- [x] context:brief rules
- [x] read IF-006 (src/api/diaryApi.ts), shared/domain/diary.ts, shared/format/dates.ts, IF-007 diaryPrefill/diagnosesApi
- [x] MonthField.tsx (written) (inputmode numeric, maskMonthInput)
- [x] DiaryMonthForm.tsx (written; exports DiaryMonthDialog) (create/edit, total-only, field errors)
- [x] DiaryCostChart.tsx (6 months, value on bar, summary)
- [x] CompanyDiaryTab.tsx (list, progress, empty state, consultant notice, delete modal)
- [x] CompanyTabs.tsx tab "Diário" + App.tsx route empresa/:companyId/diario
- [x] CalculatorBlock.tsx diary mark / total / "Usar o diário"
- [x] NumbersSummary.tsx origin (optional calculator prop; ResultPage must pass it -> integration msg)
- [x] pnpm typecheck: exit 1, only 3 errors in OwnerHome.tsx/ScoreTrend.tsx (phase-5 home gap, wave 10), 0 in my files (typecheck.log)
- [x] report JSON written (PASS + findings)
## Findings
## Next
## Discoveries
- IF-006 src/api/diaryApi.ts: getDiary/addDiaryMonth/updateDiaryMonth/deleteDiaryMonth -> DiaryView {entries,progress,chart}
- shared/domain/diary.ts: formatDiaryProgress, buildChartSummary, DIARY_* msgs, diaryMonthTakenMessage; dates.ts maskMonthInput/getMonthError/monthInputToIso/isoToMonthInput/localIsoMonth/formatMonthShort/Long
- IF-007: diagnosesApi.applyDiarySuggestion(id)->Diagnosis; diaryPrefill: isDiarySuggestionOffered, carryDiaryMarks, formatDiaryMark, getCostDiaryOrigin, formatCostDiaryOrigin
- CalculatorBlock gets only {diagnosisId, calculator, onChange}; QuestionnairePage/useDraftAutosave NOT mine -> apply suggestion via onChange(result.calculator)
- NumbersSummary gets only economics; ResultPage NOT mine -> add optional `calculator` prop, message integration to pass diagnosis.calculator
- Prototype: diaryTab L782-810, openMonth dialog L1112-1130 (form in dialog), validation ~L1230-1250, delete confirm L1288
- Templates: DateField.tsx (mask), CompanyActionsTab.tsx (tab load), CompanyTabs buildTabs, App.tsx route nest under empresa/:companyId
- PRD approved copy (prd L355-358): empty title/text/button; consultant: "Você anota os números do cliente: peça a ele o gasto e os clientes novos de cada mês."
- mode: usePreferences().preferences.usageMode === "consultant"; server field errors: isApiError + details.fields (CompanyFormDialog L96)
- Delete confirm copy (prototype L1288): consequence "O custo por cliente desse mês sai da média e do próximo diagnóstico. Não dá para desfazer.", verb "Excluir mês"
- NOTE: bash heredocs with quotes fail in this harness; use Write/Edit tools
- e2e regression run: playwright calculator+companies -> .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-4-frontend-diary-dev/e2e.log (+e2e.exit)
- e2e main calculator+companies: 10 pass, 1 fail companies.spec:201 duplicate "Limpar filtros" in CompaniesPage (concurrent phase-5-frontend-consultant-settings). fresh-db firstRun tour fails on /inicio (OwnerHome trend gap).
## Next
- done
