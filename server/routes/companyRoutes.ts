import { Router } from "express";
import type { CompanyService } from "../services/companyService.ts";
import { companyInputSchema, companyListQuerySchema } from "../validation/companySchemas.ts";

export interface CompanyRoutesDeps {
  companies: CompanyService;
}

/**
 * `GET/POST /api/companies`, `GET/PATCH/DELETE /api/companies/:id` and
 * `POST /api/companies/:id/archive|restore` (IF-002). Handlers only validate,
 * delegate to the service and answer; failures reach the shared error handler.
 */
export function createCompanyRoutes({ companies }: CompanyRoutesDeps): Router {
  const router = Router();

  router.get("/api/companies", async (req, res) => {
    const filters = companyListQuerySchema.parse(req.query);
    res.json(await companies.list(filters));
  });

  router.post("/api/companies", async (req, res) => {
    const input = companyInputSchema.parse(req.body);
    res.status(201).json(await companies.create(input));
  });

  router.get("/api/companies/:id", async (req, res) => {
    res.json(await companies.get(req.params.id));
  });

  router.patch("/api/companies/:id", async (req, res) => {
    const input = companyInputSchema.parse(req.body);
    res.json(await companies.update(req.params.id, input));
  });

  router.post("/api/companies/:id/archive", async (req, res) => {
    res.json(await companies.archive(req.params.id));
  });

  router.post("/api/companies/:id/restore", async (req, res) => {
    res.json(await companies.restore(req.params.id));
  });

  router.delete("/api/companies/:id", async (req, res) => {
    await companies.remove(req.params.id);
    res.status(204).end();
  });

  return router;
}
