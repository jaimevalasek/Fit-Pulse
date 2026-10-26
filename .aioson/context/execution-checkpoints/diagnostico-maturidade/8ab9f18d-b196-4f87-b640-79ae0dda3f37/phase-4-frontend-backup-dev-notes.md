# phase-4-frontend-backup — dev notes
## Checklist
- [x] httpClient upstream finding: already fixed (httpClient.ts JSON_WRITE_METHODS sends `{}` body + Content-Type) — no edit needed
- [x] IF-009 read (plan line 448); prototype settings-backup (prototype.html:1119-1124); F-06 message (PRD:204)
- [x] src/api/backupApi.ts — exportBackup(), importBackup(backup), BACKUP_MAX_BYTES; types BackupExport/BackupImport (skipped assumed {companies,diagnoses})
- [x] src/features/settings/BackupSection.tsx — buttons backup-export/backup-import, hidden input type=file, file.text()+JSON.parse locally, >10MB/invalid refused client-side, results role="alert" data-state success|error, OQ-3 uninstall warning
- [x] SettingsPage: SettingsSection(settings-backup) wrapping <BackupSection/> after ThemeSection
- [x] pnpm build -> exit 0 (log: runtime/execution-temp/.../phase-4-frontend-backup-dev/build.log, build.exit)
- [x] report JSON
