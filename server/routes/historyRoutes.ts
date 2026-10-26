import { Router } from "express";
import type { HistoryService } from "../services/historyService.ts";

export interface HistoryRoutesDeps {
  history: HistoryService;
}

/**
 * `GET /api/companies/:id/timeline`, `POST /api/diagnoses/:id/archive|restore` and
 * `GET /api/diagnoses/:id/comparison` (IF-005). Handlers only delegate to the service
 * and answer; failures reach the shared error handler.
 */
export function createHistoryRoutes({ history }: HistoryRoutesDeps): Router {
  const router = Router();

  router.get("/api/companies/:id/timeline", async (req, res) => {
    res.json(await history.timeline(req.params.id));
  });

  router.post("/api/diagnoses/:id/archive", async (req, res) => {
    res.json(await history.archive(req.params.id));
  });

  router.post("/api/diagnoses/:id/restore", async (req, res) => {
    res.json(await history.restore(req.params.id));
  });

  router.get("/api/diagnoses/:id/comparison", async (req, res) => {
    res.json(await history.compare(req.params.id));
  });

  return router;
}
