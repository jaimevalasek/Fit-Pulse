import { Router } from "express";
import type { DiagnosisService } from "../services/diagnosisService.ts";
import { diagnosisPatchSchema } from "../validation/diagnosisSchemas.ts";

export interface DiagnosisRoutesDeps {
  diagnoses: DiagnosisService;
}

/**
 * `POST /api/companies/:id/diagnoses`, `GET/PATCH/DELETE /api/diagnoses/:id` and
 * `POST /api/diagnoses/:id/complete` (IF-003), plus `POST /api/diagnoses/:id/diary-suggestion` for
 * "Usar o diário" (IF-007). Handlers only validate, delegate to the
 * service and answer; failures reach the shared error handler.
 */
export function createDiagnosisRoutes({ diagnoses }: DiagnosisRoutesDeps): Router {
  const router = Router();

  // 201 when a draft was created, 200 when the company's open draft came back (RULE-dm-13).
  router.post("/api/companies/:id/diagnoses", async (req, res) => {
    const { diagnosis, created } = await diagnoses.start(req.params.id);
    res.status(created ? 201 : 200).json(diagnosis);
  });

  router.get("/api/diagnoses/:id", async (req, res) => {
    res.json(await diagnoses.get(req.params.id));
  });

  router.patch("/api/diagnoses/:id", async (req, res) => {
    const patch = diagnosisPatchSchema.parse(req.body);
    res.json(await diagnoses.update(req.params.id, patch));
  });

  router.delete("/api/diagnoses/:id", async (req, res) => {
    await diagnoses.discard(req.params.id);
    res.status(204).end();
  });

  router.post("/api/diagnoses/:id/complete", async (req, res) => {
    res.json(await diagnoses.complete(req.params.id));
  });

  // The client sends nothing: the suggestion is the one stored with the draft, so the server decides the numbers.
  router.post("/api/diagnoses/:id/diary-suggestion", async (req, res) => {
    res.json(await diagnoses.applyDiarySuggestion(req.params.id));
  });

  return router;
}
