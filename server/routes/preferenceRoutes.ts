import { Router } from "express";
import type { PreferenceService } from "../services/preferenceService.ts";
import { preferencesUpdateSchema } from "../validation/preferenceSchemas.ts";

export interface PreferenceRoutesDeps {
  preferences: PreferenceService;
}

/**
 * `GET/PUT /api/preferences` (IF-008): usage mode, focus company, theme and the tour seen
 * per mode. Handlers only validate, delegate to the service and answer; failures reach
 * the shared error handler.
 */
export function createPreferenceRoutes({ preferences }: PreferenceRoutesDeps): Router {
  const router = Router();

  router.get("/api/preferences", async (_req, res) => {
    res.json(await preferences.get());
  });

  router.put("/api/preferences", async (req, res) => {
    const input = preferencesUpdateSchema.parse(req.body);
    res.json(await preferences.update(input));
  });

  return router;
}
