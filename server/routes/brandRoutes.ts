import express, { Router, type RequestHandler } from "express";
import type { BrandService } from "../services/brandService.ts";
import { DomainError } from "../services/domainError.ts";
import {
  BRAND_FIELDS_BODY_LIMIT,
  BRAND_LOGO_BODY_LIMIT,
  BRAND_LOGO_REFUSED_MESSAGE,
  brandLogoSchema,
  brandUpdateSchema,
} from "../validation/brandSchemas.ts";

export interface BrandRoutesDeps {
  brand: BrandService;
}

function isBodyTooLarge(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { type?: unknown }).type === "entity.too.large";
}

const parseLogoBody = express.json({ limit: BRAND_LOGO_BODY_LIMIT });

// A file past the body limit gets the same refusal the screen shows for any other bad logo.
const readLogoBody: RequestHandler = (req, res, next) => {
  parseLogoBody(req, res, (error?: unknown) => {
    next(isBodyTooLarge(error) ? new DomainError(413, "payload_too_large", BRAND_LOGO_REFUSED_MESSAGE) : error);
  });
};

/**
 * IF-003. `GET/PUT/DELETE /api/brand` read, save and forget the name and contacts of who delivers the
 * reports (DELETE also drops the logo: back to the FitPulse brand). `PUT/DELETE /api/brand/logo` set and
 * remove the logo, and `GET /api/brand/logo` answers its bytes with their type. The router brings its own
 * body parsers and mounts before the app's 1 MB one, because the logo's body is larger. Handlers only
 * validate, delegate to the service and answer; failures reach the shared error handler.
 */
export function createBrandRoutes({ brand }: BrandRoutesDeps): Router {
  const router = Router();

  router.get("/api/brand", async (_req, res) => {
    res.json(await brand.get());
  });

  router.put("/api/brand", express.json({ limit: BRAND_FIELDS_BODY_LIMIT }), async (req, res) => {
    const input = brandUpdateSchema.parse(req.body);
    res.json(await brand.update(input));
  });

  router.delete("/api/brand", async (_req, res) => {
    res.json(await brand.reset());
  });

  router.get("/api/brand/logo", async (_req, res) => {
    const logo = await brand.readLogo();
    res
      .set({
        "Content-Type": logo.mimeType,
        // The logo changes under the same address, so every use asks again (a 304 when it did not).
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      })
      .send(logo.bytes);
  });

  router.put("/api/brand/logo", readLogoBody, async (req, res) => {
    const input = brandLogoSchema.parse(req.body);
    res.json(await brand.setLogo(input));
  });

  router.delete("/api/brand/logo", async (_req, res) => {
    res.json(await brand.removeLogo());
  });

  return router;
}
