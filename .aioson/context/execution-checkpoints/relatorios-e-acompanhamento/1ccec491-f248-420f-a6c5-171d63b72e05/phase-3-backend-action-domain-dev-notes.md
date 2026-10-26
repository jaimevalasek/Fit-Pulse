# phase-3-backend-action-domain notes
Temp dir: .aioson/runtime/execution-temp/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-3-backend-action-domain-dev/
Checklist (unit files only):
- [x] context:brief rules read (english identifiers, file-size, brevity)
- [x] shared/domain/actionProgress.ts (ACTION_STATUSES/ROLES, normalizeActionProgress, isActionOverdue(progress,today ISO), inheritActionProgress(plan, previous|null) -> {actions[], closed[]})
- [x] shared/content/actionProgressOptions.ts (labels + *_OPTIONS)
- [x] shared/format/dates.ts (maskDate/maskDateInput, dateInputToIso, isoToDateInput, getDateError, isValidIsoDate, localIsoDate)
- [x] tests/unit/actionProgress.test.ts + dates.test.ts PASS 32/32 (log vitest-unit.log, exit 0). Old schema copy saved in temp dir schema.before.prisma
- [x] prisma schema ActionProgress + back-relations + migration 20261026000100_action_progress (from migrate diff) + prisma generate DONE; validate exit 0. Pre-existing drift diagnoses redefine -> OBS-cf7225
- [x] actionProgressRepository.ts DONE; tsc --noEmit exit 0; throwaway repo-check.ts (temp dir) PASS on migrated sqlite
- [x] actionPlan.ts: reuse, no change
- [ ] verify: prisma validate, vitest (2 files), smoke-migrate -> logs in temp dir
- [ ] report JSON: .aioson/context/reports/relatorios-e-acompanhamento/1ccec491-f248-420f-a6c5-171d63b72e05/phase-3-backend-action-domain.json
Messages for integration: inheritActionProgress contract; toActionProgressCreateRows; status/ownerRole stored as text keys.

## Final
Report written (verdict PASS). validate/vitest(32)/smoke-migrate all exit 0; logs in temp dir. Nothing left.
