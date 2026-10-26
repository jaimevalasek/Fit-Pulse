import { Router } from "express";
import { localIsoMonth } from "../../shared/format/dates.ts";
import type { DiaryService } from "../services/diaryService.ts";
import { createDiaryCreateSchema, createDiaryUpdateSchema } from "../validation/diarySchemas.ts";

export interface DiaryRoutesDeps {
  diary: DiaryService;
  /** Clock behind "this month": a month after it cannot be noted yet. */
  now: () => Date;
}

/**
 * `GET`/`POST /api/companies/:id/diary` and `PUT`/`DELETE /api/companies/:id/diary/:month` (IF-006).
 * Handlers only validate, delegate to the service and answer; failures reach the shared error handler.
 */
export function createDiaryRoutes({ diary, now }: DiaryRoutesDeps): Router {
  const router = Router();

  router.get("/api/companies/:id/diary", async (req, res) => {
    res.json(await diary.list(req.params.id));
  });

  router.post("/api/companies/:id/diary", async (req, res) => {
    const input = createDiaryCreateSchema(localIsoMonth(now()) ?? "").parse(req.body);
    res.status(201).json(await diary.create(req.params.id, input));
  });

  router.put("/api/companies/:id/diary/:month", async (req, res) => {
    const input = createDiaryUpdateSchema(req.params.month).parse(req.body);
    res.json(await diary.update(req.params.id, req.params.month, input));
  });

  router.delete("/api/companies/:id/diary/:month", async (req, res) => {
    res.json(await diary.remove(req.params.id, req.params.month));
  });

  return router;
}
