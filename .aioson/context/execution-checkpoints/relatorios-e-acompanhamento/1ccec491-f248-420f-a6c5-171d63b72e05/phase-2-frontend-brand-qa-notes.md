# phase-2-frontend-brand QA notes (lane frontend, wave 5) — round 2 (r2)

Unit files (only correctable): PhoneField.tsx, brandLogoImage.ts, BrandSection.tsx, SettingsPage.tsx, ReportSheet.tsx (now src/features/report-center/), ConfirmDialog.tsx
Done when: `pnpm typecheck` passa e a seção usa só o IF-003 (brandApi.ts)
Report: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-frontend-brand-qa.r2.json
Exec temp: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-frontend-brand-qa/

## Checklist (r2)
- [ ] 1. Typecheck: `pnpm --config.verify-deps-before-run=false typecheck` (exit saved). Plain `pnpm typecheck` NOT rerun (verify-deps may run pnpm install + prisma migrate against locked DB) -> finding.
- [ ] 2. Prior r1/r2 blocker: src/features/reports gone, report-center has 8 files, importers repointed (App.tsx, ResultPage.tsx, BrandSection.tsx). Verify with grep. DONE (see below).
- [ ] 3. Prior r1/r2: `node scripts/smoke-store-package.mjs` 8/8 (foreground, log+exit saved).
- [ ] 4. Prior r2: brand e2e tests/e2e/brand.spec.ts — check exists; if not, verification_not_run.
- [ ] 5. Re-inspect BrandSection IF-003 imports, brandLogoImage (2MB, magic bytes, 600px), PhoneField/ConfirmDialog/SettingsPage briefly.
- [ ] 6. Write r2 JSON, verdict, stop.

## Findings / edits (r2)
- Rename: src/features/reports/ absent; src/features/report-center/ holds 8 files (PortfolioReportPage, ReportCenterPage, ReportDelivery, ReportOptions, ReportPreview, ReportSheet, ReportSheetCharts, useReportPreview). grep "features/reports" in src/scripts/tests/server/shared: no hits. Prior r1/r2 blocker RESOLVED on current tree (observed).
- BrandSection.tsx:5-7 imports brandApi (IF-003) + httpClient isApiError (shared error guard). :13 ReportSheet from report-center. OK.
- No edits made yet in r2.

## Verification log (r2)
- typecheck (flag variant): EXIT=0, `tsc --noEmit` clean. typecheck.log / typecheck.exit in exec-temp.
- smoke-store-package: EXIT=0, 8/8 PASS on real tree (prior r1/r2 blocker reproduced fixed). smoke.log / smoke.exit in exec-temp.
- tests/e2e/brand.spec.ts: does NOT exist -> capability-wide, verification_not_run (integration).
- Play dev-link walkthrough: not runnable here (medium verification_not_run).

- Scratch vitest (exec-temp, temp config vitest.qa.config.mjs; NOT project root): brandLogoImage.qa.test.ts 10/10 PASS, EXIT=0 (brandLogoImage.qa.log/.exit). Covers: magic-byte detection; >2MB and empty refusal with exact message; renamed non-image refusal; undecodable PNG refusal; 1200x600 PNG -> 600x300 same format, bitmap closed; tall JPEG -> 120x600, white ground, q=0.9; <=600px untouched.
- Note: `pnpm exec vitest` triggers pnpm deps check -> postinstall prisma migrate deploy "database is locked" (exit 1). Used `node node_modules/vitest/vitest.mjs` instead. The first failed pnpm log was overwritten (same filename).
- PhoneField.tsx, ConfirmDialog.tsx re-read: no defect (ConfirmDialog preventDefault blocks Radix auto-close; busy guards; error alert).
- SettingsPage.tsx: no direct fetch; brand-section dataId at :335. OK.
- No direct fetch in any unit file (grep). Only API import from brand is @/api/brandApi (IF-003).

## Next action
Write r2 JSON: verdict PASS; findings = verification_not_run (brand.spec.ts absent; Play walkthrough; plain `pnpm typecheck` not rerun, environmental). Then stop.
