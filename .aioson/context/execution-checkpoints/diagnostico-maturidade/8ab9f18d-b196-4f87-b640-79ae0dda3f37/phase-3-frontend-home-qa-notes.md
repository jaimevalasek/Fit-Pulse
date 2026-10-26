# phase-3-frontend-home QA notes (lane frontend, unit phase-3-frontend-home)

## Checklist
- [ ] Verify build: `pnpm build` exit 0 (log in runtime execution-temp/.../phase-3-frontend-home-qa/)
- [ ] Read unit files: src/api/homeApi.ts, src/features/home/{HomePage,OwnerHome,ConsultantHome,ScoreTrend}.tsx, src/App.tsx
- [ ] Check homeApi.ts vs server/services/homeService.ts shape (IF-007) — read-only
- [ ] Check AC-dm-32 (owner home: weakest dimension, escada, actions) and AC-dm-35 (consultant home) in code
- [ ] Fix at most 3 unit files if simple defects; re-run build
- [ ] Write report JSON to .aioson/context/reports/diagnostico-maturidade/8ab9f18d-.../phase-3-frontend-home-qa.json

## Findings so far
- Read homeApi.ts (105 lines): IF-007 types, getOwnerHome(companyId?) and getConsultantHome(); no defects seen.
- Read HomePage.tsx (87 lines): mode switch, owner 404 -> owner-empty state with home-first-company; error state with retry. OK.
- Read OwnerHome.tsx (230 lines): AC-dm-32 items present (home-last-date, StageLadder, home-trava + weakest dimension, ActionPlanList, DraftCard "Continuar de onde parei", Evolution + home-compare). OK.
- Note (AC-dm-35 literal wording): OwnerHome FirstDiagnosisState shows title "O primeiro diagnóstico está em andamento" + "Continuar" when a draft exists, so "Começar o primeiro diagnóstico" text is absent in that case. Deliberate per implementer; low, judgment call, not a build issue.
- Read ConsultantHome.tsx (215 lines): AC-dm-34 ladder links to /empresas?estagio=N, attention lists (stale drafts, without/overdue, high risk), AC-dm-35 empty state with home-first-company. OK.
- Read ScoreTrend.tsx (137 lines) and App.tsx (47 lines): inicio -> HomePage; no defects seen.
- Server shape check (read-only, server/services/homeService.ts ~L290-395): keys match homeApi.ts types; owner falls back focus -> first active; 404 only when no company. httpClient buildUrl drops null query values.
- Deferred to integration (not in unit files): tests/e2e/home.spec.ts does not exist (checked); AC-dm-32..35 e2e, 390px and reduced motion checks.
- Corrections: none. Unit code judged fine for local Done-when.

## Edits made
- (none yet)

## Verification
- `pnpm build` (foreground) exit 0. Log: .aioson/runtime/execution-temp/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-3-frontend-home-qa/build.log ; exit code file: .../build.exitcode (contains 0). Output ends "built in 746ms".

## Next action
- Read unit files in bounded slices (homeApi.ts first, then HomePage/OwnerHome/ConsultantHome/ScoreTrend, App.tsx) and check AC-dm-32 / AC-dm-35 locally.
- Report written: .aioson/context/reports/diagnostico-maturidade/8ab9f18d-b196-4f87-b640-79ae0dda3f37/phase-3-frontend-home-qa.json (verdict PASS, JSON parse ok). Task complete.
