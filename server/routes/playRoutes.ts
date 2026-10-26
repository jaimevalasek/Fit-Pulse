import { readFileSync } from "node:fs";
import path from "node:path";
import { Router } from "express";
import { resolveAppRoot } from "../db/databaseUrl.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { readAssistantSummary } from "../services/assistantSummaryService.ts";

export interface PlayRoutesDeps {
  prisma: PrismaClient;
  /** Port the backend listens on; the Play reads it back as `api_base_url`. */
  backendPort: number;
}

interface AppIdentity {
  name: string;
  slug: string;
  version: string;
}

function readAppIdentity(): AppIdentity {
  const manifestPath = path.join(resolveAppRoot(), "manifest.json");
  const { name, slug, version } = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<AppIdentity>;
  if (!name || !slug || !version) {
    throw new Error(`${manifestPath} must declare name, slug and version`);
  }
  return { name, slug, version };
}

// Only routes that exist and answer 200 are listed (RULE-dm-17); the assistant
// would try every one of them.
const CAPABILITY_ENDPOINTS = [
  {
    path: "/api/health",
    method: "GET",
    description: "Confere se o FitPulse está respondendo.",
    auth: false,
  },
  {
    path: "/api/assistant/summary",
    method: "GET",
    description:
      "Resumo do último diagnóstico concluído de cada empresa ativa: nome, estágio, dimensão que mais trava e data. Não traz valores em reais nem respostas do questionário.",
    auth: false,
  },
] as const;

/** `GET /api/health`, `GET /api/aioson-play` and `GET /api/assistant/summary` (IF-001). */
export function createPlayRoutes({ prisma, backendPort }: PlayRoutesDeps): Router {
  const identity = readAppIdentity();
  const router = Router();

  router.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  router.get("/api/aioson-play", (_req, res) => {
    res.json({
      ...identity,
      api_base_url: `http://127.0.0.1:${backendPort}`,
      endpoints: CAPABILITY_ENDPOINTS,
      events: [],
    });
  });

  router.get("/api/assistant/summary", async (_req, res) => {
    res.json(await readAssistantSummary(prisma));
  });

  return router;
}
