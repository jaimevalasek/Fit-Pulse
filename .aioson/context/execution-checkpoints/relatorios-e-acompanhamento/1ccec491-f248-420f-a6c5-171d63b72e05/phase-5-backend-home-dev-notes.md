# phase-5-backend-home dev notes (unverified work data)

## Findings from reading (done)
- portfolioService.ts ALREADY exists (phase 2): buildPortfolio(records, at) uses OVERDUE_DIAGNOSIS_DAYS(=90); keep 2-arg callers working (tests/unit/forbiddenTerms, portfolioDocument) -> add optional 3rd arg intervalDays.
- Reuse: preferenceService.get().reevaluationIntervalDays; actionService.forCompany(id).current.actions (ActionProgressView incl. overdue);
  diaryRepository.findByCompany + shared/domain/diary computeDiaryProgress/computeRecentCost; generatedFileRepository.findLatestByCompany(companyId) -> {id,fileName,createdAt}.
- IF-008 owner (plan l.705): { company, latest, draft, reevaluation{lastAt,dueAt,daysUntil,daysOverdue,intervalDays}, actions{counts,current[]}, diary{count,cacCents,measuredFrom,measuredTo}, latestReport{fileId,fileName,savedAt}|null }, NO trend.
  Consultant: v1 + overdueActions[] (+ reevaluationDays interval). awaitingQuestionnaires = phase 6 (NOT mine).
- IF-010: attention=atrasada|vencidas|risco|aguardando|rascunhos|sem-diagnostico. `aguardando` left to phase 6 (no data yet) -> tell integration.
- Plan: filter set derived from consultant view lists (same data the home showed). PortfolioService gets needingAttention(attention).
- Existing tests referencing trend: tests/api/homeRoutes.test.ts ~l.337-390 (+ 'follows the diagnoses' ~l.419) must be rewritten.

## Checklist
- [x] read code + brief
- [x] portfolioService: interval from prefs, overdueActions list, reevaluationDays in view, needingAttention
- [x] companySchemas attention + companyService + app.ts + companiesApi
- [x] homeService owner view + homeApi types (drop trend)
- [x] tests: homeRoutes, companyRoutes (written)
- [x] run vitest 3 files (+report/brand/file routes) -> run2.exit=0, 6 files 332 tests PASS -> log dir runtime/execution-temp/.../phase-5-backend-home-dev/
- [x] typecheck: only 3 expected errors (OwnerHome/ScoreTrend, frontend wave 10); full vitest 33 files/1495 PASS
- [x] report JSON written (verdict PASS)

## Edits made (source done, tests pending)
- server/validation/companySchemas.ts: ATTENTION_FILTERS (5, no `aguardando`), AttentionFilter, `attention` in companyListQuerySchema
- server/services/portfolioService.ts: buildPortfolio(records, at, intervalDays=90); view.reevaluationDays + view.overdueActions[{companyId,name,diagnosisId,overdueCount}]; companyIdsNeedingAttention(view, attention); service.needingAttention(); read() uses preferences interval
- server/services/companyService.ts: dep `portfolio`, list filters by attention; server/app.ts wires createPortfolioService into companies
- server/services/homeService.ts: owner = {company, latest, draft, reevaluation{lastAt,dueAt,today,daysUntil,daysOverdue,intervalDays}|null, actions{counts,current[]}, diary{count,cacCents,measuredFrom,measuredTo}, latestReport|null}; trend removed
- src/api/homeApi.ts + src/api/companiesApi.ts (CompanyAttention, attention filter) updated
- NOTE for integration: OwnerHome.tsx/ScoreTrend.tsx still import HomeTrendPoint/data.trend -> typecheck breaks there until frontend wave 10
- scratch scripts live in runtime/execution-temp/.../phase-5-backend-home-dev/*.py (edit_home*.py)
- server/app.ts: also passes now: deps.now to createReportService (saved-PDF createdAt followed the real clock; no prod change). Verified reportRoutes/brandRoutes/fileRoutes still pass.
- tests: homeRoutes.test.ts (trend tests replaced by reevaluation/actions/diary/latestReport + consultant interval/overdueActions), companyRoutes.test.ts (describe attention + 400 for attention=urgente)
- logs: runtime/execution-temp/.../phase-5-backend-home-dev/run1.log(fail, savedAt clock) run2.log(PASS, exit 0)
- NEXT: pnpm typecheck + full vitest for regressions (unit portfolioDocument/forbiddenTerms), then report JSON
- FINAL: final.exit=0 (3 files, 182 tests). Unit complete.
