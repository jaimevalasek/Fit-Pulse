import { Router } from "express";
import type { ActionService } from "../services/actionService.ts";
import { actionPatchSchema } from "../validation/actionSchemas.ts";

export interface ActionRoutesDeps {
  actions: ActionService;
}

/**
 * `GET /api/companies/:id/actions`, `GET /api/diagnoses/:id/actions` and
 * `PATCH /api/diagnoses/:id/actions/:actionKey` (IF-005). Handlers only validate, delegate to
 * the service and answer; failures reach the shared error handler.
 */
export function createActionRoutes({ actions }: ActionRoutesDeps): Router {
  const router = Router();

  router.get("/api/companies/:id/actions", async (req, res) => {
    res.json(await actions.forCompany(req.params.id));
  });

  router.get("/api/diagnoses/:id/actions", async (req, res) => {
    res.json(await actions.forDiagnosis(req.params.id));
  });

  router.patch("/api/diagnoses/:id/actions/:actionKey", async (req, res) => {
    const patch = actionPatchSchema.parse(req.body);
    res.json(await actions.update(req.params.id, req.params.actionKey, patch));
  });

  return router;
}
