import { Router } from "express";
import { z } from "zod";
import type { HomeService } from "../services/homeService.ts";
import { USAGE_MODES } from "../validation/preferenceSchemas.ts";

export interface HomeRoutesDeps {
  home: HomeService;
}

/** Company ids are UUIDs; the cap only keeps an absurd value from reaching the database. */
const COMPANY_ID_MAX_LENGTH = 64;

/** `mode=owner&companyId=` and `mode=consultant` (IF-007). A blank `companyId` means "not sent". */
const homeQuerySchema = z.object(
  {
    mode: z.enum(USAGE_MODES, { error: "Escolha minha empresa ou consultoria." }),
    companyId: z
      .string({ error: "Escolha uma empresa da lista." })
      .trim()
      .max(COMPANY_ID_MAX_LENGTH, "Escolha uma empresa da lista.")
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
  },
  { error: "Informe o modo da tela inicial." },
);

/**
 * `GET /api/home` (IF-007): the indicators of the home screen for one usage mode. Handlers
 * only validate, delegate to the service and answer; failures reach the shared error handler.
 */
export function createHomeRoutes({ home }: HomeRoutesDeps): Router {
  const router = Router();

  router.get("/api/home", async (req, res) => {
    const query = homeQuerySchema.parse(req.query);
    res.json(await home.get(query));
  });

  return router;
}
