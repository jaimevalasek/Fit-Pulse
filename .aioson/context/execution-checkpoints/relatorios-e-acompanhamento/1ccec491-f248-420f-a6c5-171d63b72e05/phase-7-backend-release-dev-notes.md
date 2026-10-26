# phase-7-backend-release notes
Findings: no v1 package archive and no VCS (git false) -> v1 for smokes is rebuilt: v1 migrations = [20261023000000_init]; v2 = generated_files, action_progress, diary_entries, questionnaire_sends. questionnaire assets read lazily in server/questionnaire/questionnaireFile.ts (v1 sim can omit them and still boot).
Checklist:
- [x] manifest.json 0.2.0 / schema_version 2 / requires_migration true
- [x] system.json 0.2.0
- [x] package.json 0.2.0 (deps untouched)
- [x] (DONE, PASS exit 0, log in execution-temp/.../phase-7-backend-release-dev/smoke-migrate.log) scripts/smoke-migrate.mjs: deploy only v1 migrations -> seed v1 -> prepare-app --migrate (4 new) -> data identical, new tables empty -> repeat no-op -> v2 cascade -> keep synthetic rebuild step
- [x] (EDITED; node --check exit 0; full run pending) scripts/smoke-store-package.mjs: package current, require questionnaire assets + manifest v2, rebuild v1 pkg (drop v2 migrations/assets, stamp 0.1.0), install, seed, overlay current, pnpm install, boot, compare data, assert assets
- [ ] verify: node scripts/smoke-migrate.mjs ; node --check scripts/smoke-store-package.mjs ; (optional full run of store smoke)
- [ ] report JSON at .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-.../phase-7-backend-release.json
Note: leftover .aioson/system-packages/fitpulse/fitpulse-0.2.0.json from my inspection run (rm denied by user; do not retry) - report it.
FINDING (real, high): aioson system:package drops every dir named `reports` (store-system.js DEV_ONLY_DIRS, name-only match) -> src/features/reports/* (8 files) missing from package -> vite build fails on install (BrandSection.tsx imports @/features/reports/ReportSheet). Not fixable from my files (build_output_dirs only in --build mode). Frontend lane must rename folder (+imports). Smoke now asserts package completeness (assertPackageContents/projectSourceFiles) and fails clearly (exit 1, log smoke-store-2.log).
Next: validate rest of store smoke flow with a SCRATCH copy in execution-temp that restores the 8 files into `files` (scratch only), then write report.
DONE: smoke-migrate PASS (exit 0), node --check store smoke PASS (exit 0), scratch store smoke PASS; real store smoke FAILS on packager dropping src/features/reports (reported). Report written (verdict PASS).

## REWORK r1 (report -> phase-7-backend-release.r1.json)
Checklist:
- [ ] state check: src/features/reports/ STILL exists (8 files) at r1 start, no report-center dir -> frontend rename not done; fitpulse-0.2.0.json still there (rm denied earlier; do NOT retry)
- [ ] look in packager (store-system.js) for a config override usable from manifest/system/package.json (DEV_ONLY_DIRS)
- [ ] rerun smoke-migrate + node --check store smoke (exit codes in execution-temp/.../phase-7-backend-release-dev/)
- [ ] reproduce packager defect with focused run of store smoke (expect exit 1 on assertPackageContents)
- [ ] write r1 report
r1 progress: packager (store-system.js walk/skipDirs) has NO override in manifest/system/package.json outside --build (build_output_dirs and .aioson/build-options.json do not cover src/**) -> defect not fixable in my files; src/features/reports still has 8 files.
r1 verified: smoke-migrate exit 0 (r1-smoke-migrate.log); node --check store smoke exit 0 (r1-check*.exit); full store smoke exit 1 reproduces the packager drop (r1-smoke-store.log, lists the 8 files).
r1 edit: smoke-store-package.mjs cleanup now also removes the descriptor file it created (descriptorFile in packageProject cleanup + removePackageDescriptor). Stray fitpulse-0.2.0.json pre-existed so it is left (rm denied earlier).
Next: write r1 report (verdict PASS for local Done-when; findings: integration_defect reports dir, verification_not_run store smoke full pass + Play update, note stray file).

## REWORK r2 (report -> phase-7-backend-release.r2.json)
Checklist:
- [x] state check at r2 start: src/features/reports/ STILL 8 files, report-center absent, importers src/App.tsx, result/ResultPage.tsx, settings/BrandSection.tsx unchanged (frontend rename still not done); fitpulse-0.2.0.json still present
- [ ] re-check packager for any override reachable from my files (bounded grep store-system.js)
- [ ] check smoke cleanup on failure path (descriptor left behind after exit 1?) - fix if inside smoke-store-package.mjs; do NOT rm the pre-existing stray file by hand (denied earlier)
- [ ] rerun smoke-migrate + node --check store smoke + full store smoke (expect exit 1 at 1/8) -> logs in execution-temp/.../phase-7-backend-release-dev/r2-*.log/.exit
- [ ] write r2 report (contract_change message to integration/lane:frontend with exact paths)
r2 verified: packager (aioson 1.75.0 store-system.js:579 skipDirs.has(entry.name)) has no override reachable from my files; smoke cleanup (try/finally, removePackageDescriptor) only removes what the run created, so the pre-existing fitpulse-0.2.0.json stays (owner's; not touched).
r2 results (logs r2-*.log/.exit in execution-temp/.../phase-7-backend-release-dev/): node --check both smokes exit 0; smoke-migrate exit 0 (6/6 PASS); full store smoke exit 1 at 1/8 (8 files of src/features/reports dropped). manifest/system/package 0.2.0, schema_version 2, requires_migration true.
Decision: no edit to my files needed; verdict BLOCKED (local Done-when passes, AC-ra-54 store-smoke needs frontend rename). Next: write r2 report with contract_change messages.

## REWORK r2 attempt1 (report -> phase-7-backend-release.r2.attempt1.json)
State at start: frontend rename DONE (src/features/report-center has 8 files, src/features/reports gone; importers App.tsx/ResultPage/BrandSection point to report-center). fitpulse-0.2.0.json still present (pre-existing, do not rm).
Checklist (logs a1-*.log/.exit in execution-temp/.../phase-7-backend-release-dev/):
- [ ] node scripts/smoke-migrate.mjs (a1-smoke-migrate)
- [ ] node --check both smokes (a1-check)
- [ ] full node scripts/smoke-store-package.mjs foreground, long timeout (a1-smoke-store) -> expect 8/8
- [ ] write r2.attempt1 report
a1 results: smoke-migrate exit 0 (6/6 PASS); node --check both smokes exit 0; FULL store smoke exit 0 (8/8 PASS, 216 files, schema v2, assets present) after the frontend rename. No edits to my files this round. fitpulse-0.2.0.json (pre-existing) rewritten by packager (1304139 B), left.
Next: write r2.attempt1 report (PASS; findings: verification_not_run Play update; note stray descriptor).
