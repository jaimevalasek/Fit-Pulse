import { Router } from "express";
import type { FileService } from "../services/fileService.ts";

export interface FileRoutesDeps {
  files: FileService;
}

/**
 * `POST /api/files/:fileId/open` and `POST /api/files/:fileId/reveal` (IF-002): the computer opens
 * a file the app saved, or shows it in its folder. Only the id in the route counts: the body is
 * never read, so no path can come from the screen. Both answer 204.
 */
export function createFileRoutes({ files }: FileRoutesDeps): Router {
  const router = Router();

  router.post("/api/files/:fileId/open", async (req, res) => {
    await files.open(req.params.fileId);
    res.status(204).end();
  });

  router.post("/api/files/:fileId/reveal", async (req, res) => {
    await files.reveal(req.params.fileId);
    res.status(204).end();
  });

  return router;
}
