# phase-7-frontend-backup — dev notes
## Checklist
- [x] Read src/api/backupApi.ts — BackupCounts: companies, diagnoses, actions, diaryEntries, questionnaireSends, brand(0/1), reevaluationInterval(0/1)
- [x] Read src/features/settings/BackupSection.tsx
- [x] Show new counts: extraParts/joinParts/exportExtras/keptSettings added; importSummary counts all skipped record kinds; existing e2e strings kept verbatim
- [x] pnpm typecheck exit=0 (log: runtime/execution-temp/.../phase-7-frontend-backup-dev/typecheck.log)
- [x] eslint: no eslint.config in project (exit 2, not a gate)
- [x] Write report JSON
## Next action
Done; integration runs tests/e2e/backup.spec.ts with v2 data.
