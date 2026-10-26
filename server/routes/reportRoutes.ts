import { Router } from "express";
import type { ReportService } from "../services/reportService.ts";
import { reportSelectionQuerySchema, reportSelectionSchema } from "../validation/reportSchemas.ts";

export interface ReportRoutesDeps {
  report: ReportService;
}

/**
 * `GET /api/reports/preview` answers the pages of the report as data; `POST /api/reports/export`
 * saves the same pages as a PDF in the Downloads folder and answers `{ fileId, fileName, directory }`
 * (IF-001). `POST /api/diagnoses/:id/report` (IF-006) is the diagnosis report with the default
 * options, from the result screen. Handlers only validate and delegate; failures reach the shared
 * error handler.
 */
export function createReportRoutes({ report }: ReportRoutesDeps): Router {
  const router = Router();

  router.get("/api/reports/preview", async (req, res) => {
    res.json(await report.preview(reportSelectionQuerySchema.parse(req.query)));
  });

  router.post("/api/reports/export", async (req, res) => {
    res.json(await report.export(reportSelectionSchema.parse(req.body)));
  });

  router.post("/api/diagnoses/:id/report", async (req, res) => {
    res.json(await report.export({ kind: "diagnosis", diagnosisId: req.params.id, includeAnswers: false }));
  });

  return router;
}
