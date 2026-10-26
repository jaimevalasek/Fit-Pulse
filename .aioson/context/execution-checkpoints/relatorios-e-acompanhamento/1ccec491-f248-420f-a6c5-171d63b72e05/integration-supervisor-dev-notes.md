# integration-supervisor DEV notes (run 1ccec491) — compacted at attempt 1376df5d

Log dir (L): .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/integration-supervisor-dev/

## Earlier rounds (summary)
- Env: data/fitpulse.db locked by live Play preview :3543; pnpm reinstall postinstall migrate fails -> one install was run with DATABASE_URL=file:<L>/install-check.db. Plain pnpm cmds ok now.
- Integration fixes (verified, unchanged since): G2 server/validation/reportSchemas.ts portfolioSelectionSchema in union; G3 src/api/reportApi.ts ReportSelection diagnosis|evolution|portfolio, PortfolioReportPage.tsx cast removed; G4 report-center/ReportCenterPage.tsx ReportWorkspace passes reportType/evolutionRange/evolutionSupported; G5 server/app.ts createReportService gets `rules`; tests/api/reportRoutes.test.ts +portfolio cases.
- src/features/reports/* live in src/features/report-center/* (aioson packager drops 'reports' dirs) -> scope_note.
- harness-contract.json hand-written: RG-build/RG-migrate/RG-boot/RG-smoke(pnpm test:e2e)/C-unit/C-package. harness:check default 300s/check -> use --timeout=1800000. Writes last-check-output.json (byproduct).
- Low findings: G9 homeApi type widening (awaitingQuestionnaires/'aguardando'), G10 OnboardingTour data-aioson-tour anchors absent (fallbacks ok), questionnaire file names slugified vs PDF names.
- e2e written/updated (all exit 0 individually): fixtures.ts (reset brand+tourSeenVersion 2+interval 90, backdateCompany v2 sections, helpers, stubSystemOpener, clearSavedPdfs), report(8+reduced-motion), result(+AC-ra-23/24/25), brand(5), portfolioReport(3), home(9), companies(.last()), actions(5), diary(4), calculator(+4 prefill), settings(+AC-ra-34), remoteQuestionnaire(4), backup(v2+v1 import), accessibility(+5 routes, 420s).
- Gotchas: bash heredoc garbles backslashes -> use Write/Edit; StrictMode double preview; POST /api/diagnoses/:id/report needs {} body.
- Rounds 0..r3(df2ff876): BLOCKED only by tests/e2e/firstRun.spec.ts (stale v1 tour spec, not in write paths, in no plan unit's files). Proposal patch at <L>/r1-proposal/firstRun.spec.ts.patch replayed via scratch config: exit 0, 5 passed (r1/r2/r3).
- r3(df2ff876) logs: build 0, test 0 (34/1601), smokes 0, e2e main --no-deps 0 (86), test:e2e 1 (firstRun:74), harness 1 (5/6 RG-smoke). r3.json was NOT written (attempt interrupted at 00:26).
- Engine: recoveryFingerprint = stage/target/kind/reason/host/model + findings[severity,kind,path]; identical no-progress twice -> 'recovery_no_progress' circuit.

# ATTEMPT 1376df5d (r3 report -> integration-supervisor.r3.json), start 00:32
- NEW FACT: tests/e2e/firstRun.spec.ts mtime 2026-10-26 00:27:21 (after r3 harness 00:26). Content == r1 proposal (diff only import path). Applied outside this unit (owner/babysitter); still NOT in my write paths -> do not edit, just verify.
- Only other change since r2 report: last-check-output.json (harness byproduct).
## Checklist
- [x] fresh-db exit 0, 5 passed (a3-e2e-freshdb.log)
- [x] pnpm test:e2e exit 0, 91 passed 4.9m (a3-e2e-full.log)
- [x] build 0, test 0 (34/1601), smokes migrate/boot/store-package 0 (a3-*)
- [x] harness:check exit 0, 6/6 (RG-smoke 350s) (a3-harness.log)
- [x] focused vitest 29 files/1395 exit 0 (a3-vitest-focused.log). Next: write r3 report verdict PASS
- [x] r3 report written via <L>/a3-write-report.cjs: verdict PASS, 13 findings (all low/medium), 11 evidence, 187 write_paths (matches contract). Done.
- a3: pnpm test:e2e full started 00:34 foreground, log a3-e2e-full.log
- a3: harness:check started 00:41 log a3-harness.log
