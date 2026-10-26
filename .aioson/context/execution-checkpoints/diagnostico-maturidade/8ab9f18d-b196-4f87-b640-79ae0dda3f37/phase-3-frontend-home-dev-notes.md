# phase-3-frontend-home — dev notes
Started 2026-10-23T04:55:04Z

## Checklist
- [x] Previous-attempt finding (httpClient Content-Type): already fixed in src/api/httpClient.ts request() — JSON_WRITE_METHODS always sets Content-Type. Nothing to edit.
- [x] Backend home absent; client contract defined (see Findings)
- [x] src/api/homeApi.ts written
- [ ] ScoreTrend.tsx, OwnerHome.tsx, ConsultantHome.tsx, HomePage.tsx
- [ ] App.tsx: inicio -> HomePage
- [ ] pnpm build exit 0 (log under runtime/execution-temp/.../phase-3-frontend-home-dev/)
- [ ] report JSON

## Findings
- No server/services/homeService.ts nor homeRoutes.ts yet (3-backend-home is wave 9, parallel). Client types must follow IF-007 (plan line 446): owner `{ company, latest?, draft?, trend[] }`; consultant `{ byStage[1..4], withoutDiagnosis[], staleDrafts[], overdue[], highRisk[] }` items with companyId+name. Report the exact shape as contract_change to backend.
- App.tsx: `inicio` = placeholder Navigate; CompaniesPage supports ?estagio=1..4 (only stage/busca/arquivadas filters).
- Prototype viewHomeOwner/viewHomeConsult/sparkline at prototype.html:811-890.
- Reuse: StageLadder/LockIcon (src/features/result/StageLadder.tsx), ActionPlanList, StatusView, CompanyFormDialog (create mode), startDiagnosis (diagnosesApi), formatDate/formatDaysAgo (CompanyPage), formatMonth (ComparePage), DIMENSIONS/LOCK_PHRASES/LAST_STEP_PHRASE/getStage (shared/content/stageContent).
- CompaniesPage only supports ?estagio=, ?busca=, ?arquivadas=1 — no ?filtro=; attention lists link straight to each company.
- Contract decided (client side): owner {mode,company{id,name},latest{id,completedAt,result:DiagnosisResult,previous{id,completedAt,stage}|null}|null,draft TimelineDraft|null,trend[{diagnosisId,completedAt,average}] oldest first}; consultant {mode,byStage Record<1..4,item[]>,withoutDiagnosis,staleDrafts(+draftId,idleDays,completedBlocks,totalBlocks),overdue(+lastCompletedAt,daysSince),highRisk(+riskScore,signalId)}; item {companyId,name,stage|null}.
- ScoreTrend.tsx written (split into TrendAxis/TrendDates/TrendChart/TrendTable for 60-line function limit). context:brief must_load includes rules/management-home-widgets.md (widgets drill down, real data).
- OwnerHome.tsx (exports StartDiagnosisButton) and ConsultantHome.tsx (exports NewCompanyButton, empty state AC-dm-35) written. Next: HomePage.tsx + App.tsx + pnpm build.
- HomePage.tsx written (tags data by requested mode; owner falls back to first active company on missing/404 focus; owner-empty state). App.tsx: inicio -> <HomePage/>.
- VERIFIED: `pnpm build` exit 0 — log/exit in runtime/execution-temp/.../phase-3-frontend-home-dev/build.log, build.exit.
- Next: write report JSON.
- Backend homeService.ts appeared mid-run (concurrent 3-backend-home). Client realigned to its real shape: latest{stage,lock,weakestDimension,plan,confidence,previous{stage,completedAt}}, trend[].averageScore, consultant companyCount + byStage StageGroup[] {stage,count,companies}. Owner call sends no companyId (server resolves saved focus -> first active; 404 = no company -> owner-empty state).
- VERIFIED again: pnpm build exit 0 (build.log/build.exit). aioson rules:check over 6 files: 0 violations.
- Remaining: report JSON only.
