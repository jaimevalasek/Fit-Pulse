import express, { Router } from "express";
import { BACKUP_MAX_BYTES } from "../validation/backupSchemas.ts";
import type { BackupService } from "../services/backupService.ts";

export interface BackupRoutesDeps {
  backup: BackupService;
}

/**
 * IF-009. `POST /api/backup/export` saves every company and diagnosis in the Downloads folder
 * and answers `{ fileName, directory, companies, diagnoses }`. `POST /api/backup/import` takes
 * the parsed file as the body (up to 10 MB, the only route above 1 MB) and answers
 * `{ imported, skipped }`. The handlers only delegate; refusals reach the shared error handler.
 */
export function createBackupRoutes({ backup }: BackupRoutesDeps): Router {
  const router = Router();

  router.post("/api/backup/export", async (_req, res) => {
    res.json(await backup.export());
  });

  router.post("/api/backup/import", express.json({ limit: BACKUP_MAX_BYTES }), async (req, res) => {
    res.json(await backup.import(req.body));
  });

  return router;
}
