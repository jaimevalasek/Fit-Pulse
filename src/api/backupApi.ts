// Calls of the backup routes (IF-009): the server writes the export file in the Downloads folder and
// imports a backup without deleting or overwriting anything (RULE-dm-18).
import { httpClient } from "./httpClient";

// Largest backup the import route accepts; bigger files answer 413
const BACKUP_MAX_BYTES = 10 * 1024 * 1024;

// What a backup carries (version 2). `brand` and `reevaluationInterval` are 0 or 1: whether the brand
// (logo included) and the days between diagnoses are in the file
interface BackupCounts {
  companies: number;
  diagnoses: number;
  actions: number;
  diaryEntries: number;
  questionnaireSends: number;
  brand: number;
  reevaluationInterval: number;
}

// Where the server saved `fitpulse-copia-{data}.json` and how much went into it
interface BackupExport extends BackupCounts {
  fileName: string;
  directory: string;
}

// `skipped` counts the records whose id already existed here: they are kept as they were. For `brand` and
// `reevaluationInterval`, 1 means the file had one but this installation already has its own
interface BackupImport {
  imported: BackupCounts;
  skipped: BackupCounts;
}

// 500 write_failed when nothing could be saved
function exportBackup(): Promise<BackupExport> {
  return httpClient.post<BackupExport>("/api/backup/export");
}

// `backup` is the parsed content of the chosen file. 422 backup_invalid, 422 backup_newer_version
// (with `rulesVersion`) and 413 for a file that is too large; on every failure nothing changes
function importBackup(backup: unknown): Promise<BackupImport> {
  return httpClient.post<BackupImport>("/api/backup/import", backup);
}

export { BACKUP_MAX_BYTES, exportBackup, importBackup };
export type { BackupCounts, BackupExport, BackupImport };
