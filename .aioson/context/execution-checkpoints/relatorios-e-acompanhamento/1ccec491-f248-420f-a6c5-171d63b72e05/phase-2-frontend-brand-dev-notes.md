# phase-2-frontend-brand — dev notes
## Checklist
- [x] context:brief (rules: English code, small files)
- [x] read brandApi (getBrand/saveBrand/saveBrandLogo/removeBrandLogo/resetBrand/brandLogoUrl), shared/format/phone.ts (maskPhoneInput, getPhoneError, PHONE_MASK_MAX_LENGTH), contact.ts (getEmailError/getWebsiteError), ConfirmDialog (reuse as is), SettingsPage (SettingsSection local wrapper), ReportSheet (CoverBlock already draws logoDataUrl/name/contactLine/credit — phase-1)
- [x] prototype lines 977-1000 (brand section), 1253 (handleLogo), 1289-1290 (confirm copy)
- [x] PhoneField.tsx (pattern: CnpjField + useCaretRestore)
- [x] brandLogoImage.ts (magic bytes, 2 MB, canvas resize 600 same mime)
- [x] BrandSection.tsx (fields, pending logo uploaded on Save, preview = ReportSheet w/ local cover page from saved brand, credit copy mirrors server COVER_CREDIT)
- [x] SettingsPage wiring (SettingsSection "Seus relatórios" first, dataId brand-section)
- [x] pnpm typecheck exit 0 (log in runtime temp typecheck.log); aioson rules:check 4 files 0 violations; eslint not installed
- [ ] report JSON
## Decisions
- Name max 80 (AC) not 60 (prototype). Field errors from server: ApiError.details.fields.
- Preview built client-side (no server import) — only IF-003 calls.
- ReportSheet.tsx & ConfirmDialog.tsx unchanged (cover already draws logo/contact).
## Next: write report JSON

## Round r1 (downstream repair: rename src/features/reports)
- Root cause (phase-7-backend-release.r2.json root_cause): aioson packager DEV_ONLY_DIRS has 'reports' -> src/features/reports/ dropped from store package.
- Fix needs moving all 8 files to src/features/report-center/ + importers App.tsx:12, result/ResultPage.tsx:23, settings/BrandSection.tsx:13.
- Ownership: 7 files phase-1-frontend-report-center; ReportOptions/PortfolioReportPage/App.tsx phase-2-frontend-evolution-portfolio (App.tsx also company-tabs, actions, diary); ResultPage.tsx phase-1-frontend-result/phase-3-frontend-actions. Only ReportSheet.tsx + BrandSection.tsx are in this unit -> partial move would break ReportPreview import. No edits made.
- typecheck: `pnpm typecheck` failed in pnpm deps check (postinstall prisma migrate: database is locked) -> rerun `pnpm --config.verify-deps-before-run=false typecheck` exit 0 (typecheck-r1b.log/.exit).
- BrandSection uses only @/api/brandApi (IF-003).
- Next: report r1 BLOCKED with contract_change to integration.

## Round r2
- Re-checked: src/features/report-center/ still absent; importers unchanged (App.tsx:12, ResultPage.tsx:23, BrandSection.tsx:13). phase-7-backend-release.r2 root_cause unchanged (packager DEV_ONLY_DIRS 'reports', no override for src/**).
- typecheck: `pnpm --config.verify-deps-before-run=false typecheck` exit 0 (typecheck-r2.log/.exit).
- No edits (same ownership blocker). Next: report r2 BLOCKED + contract_change to integration.

## Round r3 (report r2)
- Rename LANDED (by another unit): src/features/reports/ gone, src/features/report-center/ holds 8 files; importers App.tsx:12-13, ResultPage.tsx:23, BrandSection.tsx:13 point to report-center. No source edits needed here.
- Next: typecheck, grep BrandSection API use, run smoke-store-package foreground.
- smoke: running foreground, log .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-2-frontend-brand-dev/smoke-r3.log
- r3 results: typecheck exit 0 (typecheck-r3), smoke 8/8 PASS exit 0 (smoke-r3). Next: write r2 report PASS.
