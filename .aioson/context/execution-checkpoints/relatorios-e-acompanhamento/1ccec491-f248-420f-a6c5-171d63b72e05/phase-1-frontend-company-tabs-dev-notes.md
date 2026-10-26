# phase-1-frontend-company-tabs — dev notes
started_at: 2026-10-25T22:49:27Z

## Checklist
- [ ] context:brief rules
- [ ] read App.tsx, CompanyPage.tsx; prototype company tabs section
- [ ] CompanyDiagnosesTab.tsx (v1 timeline content moved)
- [ ] CompanyTabs.tsx (route tabs, underline on active, Relatórios above the fold)
- [ ] CompanyPage.tsx -> layout (header, tabs, Outlet w/ company context)
- [ ] App.tsx nested routes empresa/:companyId (index) + relatorios (placeholder? ReportCenterPage belongs to other unit)
- [ ] pnpm typecheck (log under runtime/execution-temp/.../phase-1-frontend-company-tabs-dev/)
- [ ] report JSON

## Findings
- CompanyPage.tsx exports formatDate/formatDaysAgo/formatStage/CompanyStatusDialog used by CompaniesPage, ConsultantHome, OwnerHome, ScoreTrend — keep them.
- ReportCenterPage (wave 4, other unit) not present; App.tsx cannot import it yet -> integration wires route element.
- Prototype tabs: prototype.html:104-112 (.tabs css), :735 nav markup (aria-current=page, data-aioson-id=tab-<slug>); phase 1 = Diagnósticos + Relatórios only.
- global.css not mine -> tabs styled w/ Tailwind utilities; underline draw via WAAPI gated on reduced-motion.
## Edits (done)
- CompanyPage.tsx: layout (crumb, header, CompanyTabs, status notice, <Outlet context>), exports useCompanyOutlet/CompanyOutletContext/StartDiagnosisButton.
- CompanyDiagnosesTab.tsx: v1 timeline + empty state + archive/restore/delete links (via onStatusAction).
- CompanyTabs.tsx: NavLink tabs tab-diagnosticos / tab-relatorios, WAAPI underline (no-preference only).
- App.tsx: empresa/:companyId with index child CompanyDiagnosesTab. relatorios child NOT added (ReportCenterPage absent) -> integration.
## Verification
- pnpm typecheck -> exit 0 (log: runtime/execution-temp/.../typecheck.log)
- pnpm exec playwright test tests/e2e/companies.spec.ts tests/e2e/history.spec.ts -> exit 0, 15 passed (log e2e.log)
- next: write report JSON
