# phase-5-frontend-consultant-settings — dev notes

started_at: 2026-10-26T00:38:15Z

## Checklist
- [x] context:brief rules
- [x] read homeApi / companiesApi / preferencesApi contracts (backend done)
- [x] ConsultantHome: overdueActions + reevaluationDays, links #/empresas?atencao=
- [x] CompaniesPage: ?atencao= filter, active filter text, empty + Limpar filtros
- [x] ReevaluationSection (60/90 recomendado/120/180) + SettingsPage wiring
- [x] pnpm typecheck (log in runtime/execution-temp/.../phase-5-frontend-consultant-settings-dev/)
- [x] report JSON

## Findings

## Next action
context:brief, then read api contracts.
- Baseline typecheck (log typecheck-baseline.log, exit 1): 3 errors only in OwnerHome.tsx (HomeTrendPoint, trend) + ScoreTrend.tsx — owned by phase-5-frontend-owner-home (wave 10), not this unit.
- API: ConsultantHomeData has reevaluationDays, overdueActions[{companyId,name,diagnosisId,overdueCount}]; CompanyAttention = atrasada|vencidas|risco|rascunhos|sem-diagnostico; listCompanies({attention}); Preferences.reevaluationIntervalDays 60|90|120|180.
- Prototype: consultant widgets link #/empresas?filtro=X (plan says ?atencao=); settings select "Refazer o diagnóstico a cada" with "N dias (recomendado)" for 90, section "Lembrete de reavaliação".
- Edits: ReevaluationSection.tsx (new, select 60/90 recomendado/120/180, savePreferences reevaluationIntervalDays); SettingsPage.tsx (section "Lembrete de reavaliação", mode hints); CompaniesPage.tsx (?atencao= parse/build, listCompanies attention, ActiveFilters "Filtro ativo" + Limpar filtros, empty state); ConsultantHome.tsx (AttentionWidgets "O que precisa de você": atrasada/vencidas/risco/rascunhos -> /empresas?atencao=X; consult-old hint uses reevaluationDays; summary link sem-diagnostico).
- Verify: typecheck.log exit 1 — same 3 OwnerHome/ScoreTrend errors only; zero errors in this unit's files. eslint not installed.
- Done: report written (PASS with sibling typecheck finding).

## Attempt (repair: upstream_contract_repair from phase-2-frontend-brand)
- Checked: src/features/reports/ gone; src/features/report-center/ holds the 8 files; App.tsx, ResultPage.tsx, BrandSection.tsx import @/features/report-center/*. Upstream rename landed; nothing to change in this unit.
- Next: rerun pnpm typecheck -> typecheck-repair.log
- typecheck-repair.log exit 1: plain `pnpm typecheck` triggered pnpm deps check -> `pnpm install` postinstall -> prisma migrate deploy "database is locked" (package.json being edited by phase-7-backend-release). Not a type error.
- typecheck-repair2.log exit 0: `pnpm --config.verify-deps-before-run=false typecheck` (tsc --noEmit) clean on the whole tree.
- Done: report attempt1 written PASS.
