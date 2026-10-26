import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import net, { type AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import express, { type Express } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DIMENSIONS, getStage } from "../../shared/content/stageContent.ts";
import {
  DIMENSION_KEYS,
  type DiagnosisResult,
  type DimensionKey,
  type DimensionResult,
  type StageNumber,
} from "../../shared/domain/types.ts";
import { createApp } from "../../server/app.ts";
import { resolveAppRoot } from "../../server/db/databaseUrl.ts";
import { createPrismaClient } from "../../server/db/prismaClient.ts";
import type { Prisma } from "../../server/generated/prisma/client.ts";
import { errorHandler } from "../../server/http/errorHandler.ts";
import { DomainError } from "../../server/services/domainError.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

interface TestResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}

interface RequestOptions {
  method?: string;
  path: string;
  /** Overrides the Host header, which `fetch` does not let a test set. */
  host?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface RunningServer {
  port: number;
  request(options: RequestOptions): Promise<TestResponse>;
  close(): Promise<void>;
}

async function startServer(app: Express): Promise<RunningServer> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    port,
    request: (options) =>
      new Promise((resolve, reject) => {
        const headers = { ...(options.host === undefined ? {} : { host: options.host }), ...options.headers };
        const req = http.request(
          { host: "127.0.0.1", port, method: options.method ?? "GET", path: options.path, headers },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => {
              const text = Buffer.concat(chunks).toString("utf8");
              const isJson = String(res.headers["content-type"]).includes("application/json");
              resolve({ status: res.statusCode ?? 0, headers: res.headers, body: isJson ? JSON.parse(text) : text });
            });
          },
        );
        req.on("error", reject);
        req.end(options.body);
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

// Sends bytes as they are, for requests the Node HTTP client would not build (no Host).
function sendRawRequest(port: number, raw: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1", () => socket.write(raw));
    let received = "";
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      received += chunk;
    });
    socket.on("end", () => resolve(received));
    socket.on("error", reject);
  });
}

const BACKEND_PORT = 4321;

// Values that must never appear in what the assistant reads (RULE-dm-17).
const SPEND_CENTS = 987_654_321;
const CAC_CENTS = 424_242_424;
const LTV_CENTS = 135_791_357;
const AVERAGE_PURCHASE_CENTS = 246_813_579;

// The domain types are interfaces, which Prisma's JSON input type does not accept as is.
function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectKeys);
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [key, ...collectKeys(child)]);
  }
  return [];
}

// On Windows the SQLite handle of a file that failed to open stays held until the
// process exits, so the folder cannot always be removed. It lives in the OS temp dir.
function removeBestEffort(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // left for the OS temp cleanup
  }
}

// Each one makes the summary query fail in a different way Prisma reports it.
const BROKEN_DATABASES: [label: string, prepare: (workDir: string) => string][] = [
  ["a folder that does not exist", (workDir) => path.join(workDir, "missing", "fitpulse.db")],
  [
    "a file that is not a database",
    (workDir) => {
      const file = path.join(workDir, "garbage.db");
      writeFileSync(file, "this is not a sqlite database ".repeat(50));
      return file;
    },
  ],
  [
    "a database without the schema",
    (workDir) => {
      const file = path.join(workDir, "empty.db");
      writeFileSync(file, "");
      return file;
    },
  ],
];

function buildResult(stage: StageNumber, weakestDimension: DimensionKey): DiagnosisResult {
  const dimensions = Object.fromEntries(
    DIMENSION_KEYS.map((key): [DimensionKey, DimensionResult] => [
      key,
      { score: key === weakestDimension ? 10 : 70, supportsStage: stage, belowWarning: key === weakestDimension },
    ]),
  ) as Record<DimensionKey, DimensionResult>;

  return {
    rulesVersion: 1,
    stage,
    lock: stage === 4 ? null : "cac",
    dimensions,
    weakestDimension,
    unitEconomics: {
      spendCents: SPEND_CENTS,
      newCustomers: 12,
      spendOrigin: "measured",
      newCustomersOrigin: "measured",
      origin: "measured",
      cacCents: CAC_CENTS,
      ltvCents: LTV_CENTS,
      ratio: 3.2,
      paybackMonths: 5,
      neverPaysBack: false,
    },
    risks: [],
    confidence: { level: "high", unknownCount: 0, totalItems: 26 },
    plan: ["cac", "pc", "re"],
  };
}

interface SeedDiagnosis {
  status?: "draft" | "completed";
  stage?: StageNumber;
  weakest?: DimensionKey;
  completedAt?: string;
  archived?: boolean;
}

describe("play routes", () => {
  let db: TestDatabase;
  let server: RunningServer;

  async function seedCompany(name: string, options: { archived?: boolean } = {}): Promise<string> {
    const company = await db.prisma.company.create({
      data: {
        name,
        segment: "health_wellness",
        salesChannel: "storefront",
        archivedAt: options.archived ? new Date("2026-08-01T00:00:00.000Z") : null,
      },
    });
    return company.id;
  }

  async function seedDiagnosis(companyId: string, options: SeedDiagnosis = {}): Promise<void> {
    const { status = "completed", stage = 2, weakest = "pc", completedAt, archived = false } = options;
    const completed = status === "completed";
    await db.prisma.diagnosis.create({
      data: {
        companyId,
        status,
        archivedAt: archived ? new Date("2026-10-01T00:00:00.000Z") : null,
        answers: toJson({ mp1: 3, mp2: 1, pc1: null, re1: 2 }),
        calculator: toJson({ spendMode: "exact", spendParts: { ads: SPEND_CENTS }, averagePurchaseCents: AVERAGE_PURCHASE_CENTS }),
        currentBlock: completed ? 8 : 3,
        rulesVersion: completed ? 1 : null,
        result: completed ? toJson(buildResult(stage, weakest)) : undefined,
        stage: completed ? stage : null,
        completedAt: completed ? new Date(completedAt ?? "2026-09-01T12:00:00.000Z") : null,
      },
    });
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    server = await startServer(createApp({ ...db, backendPort: BACKEND_PORT }));
  });

  afterAll(async () => {
    await server.close();
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/health", () => {
    it("answers ok", async () => {
      const response = await server.request({ path: "/api/health" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
    });
  });

  describe("AC-dm-41 GET /api/aioson-play", () => {
    it("describes the app from manifest.json and the backend port", async () => {
      const manifest = JSON.parse(readFileSync(path.join(resolveAppRoot(), "manifest.json"), "utf8"));

      const response = await server.request({ path: "/api/aioson-play" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: manifest.name,
        slug: manifest.slug,
        version: manifest.version,
        api_base_url: `http://127.0.0.1:${BACKEND_PORT}`,
        events: [],
      });
      expect(manifest.name).toBe("FitPulse");
    });

    it("lists exactly the health and summary routes", async () => {
      const response = await server.request({ path: "/api/aioson-play" });
      const { endpoints } = response.body as { endpoints: { method: string; path: string; description: string }[] };

      expect(endpoints.map(({ method, path: routePath }) => `${method} ${routePath}`)).toEqual([
        "GET /api/health",
        "GET /api/assistant/summary",
      ]);
      for (const endpoint of endpoints) {
        expect(endpoint.description).not.toBe("");
      }
    });

    it("lists only routes that exist", async () => {
      const response = await server.request({ path: "/api/aioson-play" });
      const { endpoints } = response.body as { endpoints: { method: string; path: string }[] };

      for (const endpoint of endpoints) {
        const answer = await server.request({ method: endpoint.method, path: endpoint.path });
        expect(answer.status, `${endpoint.method} ${endpoint.path}`).toBe(200);
      }
    });

    it("takes the reported port from BACKEND_PORT when none is injected", async () => {
      vi.stubEnv("BACKEND_PORT", "5599");
      const envServer = await startServer(createApp(db));
      try {
        const response = await envServer.request({ path: "/api/aioson-play" });
        expect(response.body).toMatchObject({ api_base_url: "http://127.0.0.1:5599" });
      } finally {
        vi.unstubAllEnvs();
        await envServer.close();
      }
    });
  });

  describe("AC-dm-42 GET /api/assistant/summary", () => {
    it("is empty before any diagnosis exists", async () => {
      await seedCompany("Sem diagnóstico");

      const response = await server.request({ path: "/api/assistant/summary" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ companies: [] });
    });

    it("reports the latest completed, non-archived diagnosis of each active company", async () => {
      const ana = await seedCompany("Ana Fitness");
      await seedDiagnosis(ana, { stage: 1, weakest: "mp", completedAt: "2026-03-01T10:00:00.000Z" });
      await seedDiagnosis(ana, { stage: 3, weakest: "re", completedAt: "2026-09-10T15:30:00.000Z" });

      const bruno = await seedCompany("Bruno Studio");
      await seedDiagnosis(bruno, { stage: 2, weakest: "aq", completedAt: "2026-06-15T09:00:00.000Z" });
      await seedDiagnosis(bruno, { stage: 4, weakest: "co", completedAt: "2026-10-05T09:00:00.000Z", archived: true });
      await seedDiagnosis(bruno, { status: "draft" });

      const draftOnly = await seedCompany("Casa Zen");
      await seedDiagnosis(draftOnly, { status: "draft" });

      const archivedCompany = await seedCompany("Dona Lia", { archived: true });
      await seedDiagnosis(archivedCompany, { stage: 2, weakest: "pc" });

      await seedCompany("Sem diagnóstico");

      const response = await server.request({ path: "/api/assistant/summary" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        companies: [
          {
            name: "Ana Fitness",
            stage: 3,
            stageName: getStage(3).name,
            lockingDimension: DIMENSIONS.re.name,
            lastDiagnosisAt: "2026-09-10T15:30:00.000Z",
          },
          {
            name: "Bruno Studio",
            stage: 2,
            stageName: getStage(2).name,
            lockingDimension: DIMENSIONS.aq.name,
            lastDiagnosisAt: "2026-06-15T09:00:00.000Z",
          },
        ],
      });
    });

    it("never returns a value in reais or a questionnaire answer (RULE-dm-17)", async () => {
      const company = await seedCompany("Ana Fitness");
      await seedDiagnosis(company, { stage: 3, weakest: "re" });

      const response = await server.request({ path: "/api/assistant/summary" });
      const serialized = JSON.stringify(response.body);

      expect(new Set(collectKeys(response.body))).toEqual(
        new Set(["companies", "name", "stage", "stageName", "lockingDimension", "lastDiagnosisAt"]),
      );

      for (const secret of [SPEND_CENTS, CAC_CENTS, LTV_CENTS, AVERAGE_PURCHASE_CENTS]) {
        expect(serialized).not.toContain(String(secret));
      }
      expect(serialized).not.toContain("R$");
    });

    it.each(BROKEN_DATABASES)("answers 503 database_unavailable for %s, while health stays up", async (_label, prepare) => {
      const workDir = mkdtempSync(path.join(os.tmpdir(), "fitpulse-broken-db-"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      const brokenPrisma = createPrismaClient(`file:${prepare(workDir).replaceAll("\\", "/")}`);
      const brokenServer = await startServer(createApp({ ...db, prisma: brokenPrisma }));
      try {
        const response = await brokenServer.request({ path: "/api/assistant/summary" });
        const health = await brokenServer.request({ path: "/api/health" });

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: { code: "database_unavailable", message: expect.any(String) } });
        expect(consoleError).toHaveBeenCalled();
        expect(health.status).toBe(200);
      } finally {
        await brokenServer.close();
        await brokenPrisma.$disconnect();
        removeBestEffort(workDir);
      }
    });
  });

  // The follow-up data of part 2 (progress notes, the diary, the brand, the interval) belongs to the owner's
  // screens and reports; the assistant of the Play never sees it.
  describe("AC-ra-56 the follow-up data stays out of the Play", () => {
    const NOTE = "Ligar para o fornecedor da Rua das Flores";
    const BRAND_NAME = "Marina Costa Consultoria";
    const BRAND_PHONE = "(11) 91234-5678";
    const BRAND_EMAIL = "marina@costaconsultoria.com.br";
    const BRAND_WEBSITE = "https://costaconsultoria.com.br";
    const LOGO_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const DIARY_CUSTOMERS = 31337;
    const DIARY_SPEND_CENTS = 98765432;
    const QUESTIONNAIRE_FILE = "ana-fitness-questionario-2026-10-23.html";

    async function seedFollowUp(companyId: string): Promise<void> {
      const diagnosis = await db.prisma.diagnosis.findFirstOrThrow({ where: { companyId, status: "completed" } });
      await db.prisma.actionProgress.create({
        data: { diagnosisId: diagnosis.id, actionKey: "re", status: "in_progress", dueDate: "2026-11-30", ownerRole: "owner", note: NOTE },
      });
      await db.prisma.diaryEntry.create({
        data: { companyId, month: "2026-09", newCustomers: DIARY_CUSTOMERS, spendTotalCents: BigInt(DIARY_SPEND_CENTS) },
      });
      await db.prisma.questionnaireSend.create({ data: { companyId, fileName: QUESTIONNAIRE_FILE, sentAt: new Date("2026-10-23T12:00:00.000Z") } });
      await db.prisma.preference.createMany({
        data: [
          { key: "brand.name", value: BRAND_NAME },
          { key: "brand.phone", value: BRAND_PHONE },
          { key: "brand.email", value: BRAND_EMAIL },
          { key: "brand.website", value: BRAND_WEBSITE },
          { key: "brand.logo_mime", value: "image/png" },
          { key: "brand.logo_data", value: LOGO_BASE64 },
          { key: "brand.logo_updated_at", value: "2026-10-23T12:00:00.000Z" },
          { key: "reevaluation_interval_days", value: "120" },
        ],
      });
    }

    it("lists the same two routes, and none of the new areas (AC-ra-56)", async () => {
      const response = await server.request({ path: "/api/aioson-play" });
      const { endpoints } = response.body as { endpoints: { method: string; path: string }[] };

      expect(endpoints.map(({ method, path: routePath }) => `${method} ${routePath}`)).toEqual([
        "GET /api/health",
        "GET /api/assistant/summary",
      ]);
      expect(endpoints.map((endpoint) => endpoint.path).join(" ")).not.toMatch(/brand|diary|action|backup|questionnaire|report|preference/);
    });

    it("answers the summary exactly as before the notes, the diary, the brand and the interval existed", async () => {
      const company = await seedCompany("Ana Fitness");
      await seedDiagnosis(company, { stage: 3, weakest: "re", completedAt: "2026-09-10T15:30:00.000Z" });
      const before = await server.request({ path: "/api/assistant/summary" });
      expect((before.body as { companies: unknown[] }).companies).toHaveLength(1);

      await seedFollowUp(company);
      const after = await server.request({ path: "/api/assistant/summary" });

      expect(after.status).toBe(200);
      expect(after.body).toEqual(before.body);
      expect(new Set(collectKeys(after.body))).toEqual(
        new Set(["companies", "name", "stage", "stageName", "lockingDimension", "lastDiagnosisAt"]),
      );
    });

    it("carries no note, no diary value, no questionnaire file and nothing of the brand", async () => {
      const company = await seedCompany("Ana Fitness");
      // Another month than the diary's, so the month text below can only come from the diary.
      await seedDiagnosis(company, { stage: 3, weakest: "re", completedAt: "2026-08-15T10:00:00.000Z" });
      await seedFollowUp(company);

      const serialized = JSON.stringify((await server.request({ path: "/api/assistant/summary" })).body);

      for (const secret of [
        NOTE,
        BRAND_NAME,
        BRAND_PHONE,
        BRAND_EMAIL,
        BRAND_WEBSITE,
        LOGO_BASE64,
        QUESTIONNAIRE_FILE,
        String(DIARY_CUSTOMERS),
        String(DIARY_SPEND_CENTS),
        "2026-09",
        "2026-11-30",
      ]) {
        expect(serialized).not.toContain(secret);
      }
      expect(serialized).not.toContain("R$");
    });
  });

  describe("IF-010 request guards", () => {
    const readRoutes =["/api/health", "/api/aioson-play", "/api/assistant/summary"];

    it.each([
      "evil.example.com",
      "evil.example.com:3301",
      "127.0.0.1.evil.example.com",
      "localhost.evil.example.com:3301",
      "127.0.0.1@evil.example.com",
      "192.168.0.10:3301",
      "0.0.0.0:3301",
      "[::1]:3301",
    ])("answers 403 host_not_allowed for Host %j on every route", async (host) => {
      for (const routePath of readRoutes) {
        const response = await server.request({ path: routePath, host });

        expect(response.status, `${routePath} with Host ${host}`).toBe(403);
        expect(response.body).toEqual({ error: { code: "host_not_allowed", message: expect.any(String) } });
      }
    });

    it.each(["127.0.0.1", "127.0.0.1:3301", "localhost", "localhost:5173", "LOCALHOST:5173"])(
      "accepts Host %s",
      async (host) => {
        const response = await server.request({ path: "/api/health", host });

        expect(response.status).toBe(200);
      },
    );

    it.each([
      ["no Host header", "GET /api/health HTTP/1.0\r\n\r\n"],
      ["an empty Host header", "GET /api/health HTTP/1.1\r\nHost:\r\nConnection: close\r\n\r\n"],
    ])("answers 403 host_not_allowed for %s", async (_label, raw) => {
      const answer = await sendRawRequest(server.port, raw);

      expect(answer.startsWith("HTTP/1.1 403")).toBe(true);
      expect(answer).toContain("host_not_allowed");
    });

    it("checks the Host before the content type", async () => {
      const response = await server.request({
        method: "POST",
        path: "/api/anything",
        host: "evil.example.com",
        headers: { "content-type": "text/plain" },
        body: "x",
      });

      expect(response.status).toBe(403);
    });

    it.each([
      ["POST", "text/plain", "x"],
      ["POST", "application/x-www-form-urlencoded", "a=1"],
      ["POST", "multipart/form-data; boundary=x", "--x--"],
      ["PUT", "text/plain", "x"],
      ["PATCH", "text/plain", "x"],
      ["POST", undefined, undefined],
      ["PATCH", undefined, undefined],
    ])("answers 415 json_required for %s with content type %s", async (method, contentType, body) => {
      const response = await server.request({
        method,
        path: "/api/anything",
        headers: contentType === undefined ? {} : { "content-type": contentType },
        body,
      });

      expect(response.status).toBe(415);
      expect(response.body).toEqual({ error: { code: "json_required", message: expect.any(String) } });
    });

    it.each(["application/json", "application/json; charset=utf-8", "Application/JSON"])(
      "lets a write with content type %s through to routing",
      async (contentType) => {
        const response = await server.request({
          method: "POST",
          path: "/api/anything",
          headers: { "content-type": contentType },
          body: "{}",
        });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: { code: "not_found", message: expect.any(String) } });
      },
    );

    it("does not ask a read or a delete for a content type", async () => {
      const read = await server.request({ path: "/api/health", headers: { "content-type": "text/plain" } });
      const remove = await server.request({ method: "DELETE", path: "/api/anything" });

      expect(read.status).toBe(200);
      expect(remove.status).toBe(404);
    });

    it("sends no CORS headers, not even to a preflight from another origin", async () => {
      const plain = await server.request({ path: "/api/health", headers: { origin: "http://evil.example.com" } });
      const preflight = await server.request({
        method: "OPTIONS",
        path: "/api/health",
        headers: { origin: "http://evil.example.com", "access-control-request-method": "POST" },
      });

      for (const response of [plain, preflight]) {
        expect(Object.keys(response.headers).filter((name) => name.startsWith("access-control-"))).toEqual([]);
      }
    });

    it("answers 404 not_found for an unknown route", async () => {
      const response = await server.request({ path: "/api/does-not-exist" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: { code: "not_found", message: expect.any(String) } });
    });

    it("answers 400 invalid_json for a body that is not JSON", async () => {
      const response = await server.request({
        method: "POST",
        path: "/api/anything",
        headers: { "content-type": "application/json" },
        body: "{not json",
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: { code: "invalid_json", message: expect.any(String) } });
    });

    it("answers 413 payload_too_large above 1 MB", async () => {
      const response = await server.request({
        method: "POST",
        path: "/api/anything",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(1_100_000) }),
      });

      expect(response.status).toBe(413);
      expect(response.body).toEqual({ error: { code: "payload_too_large", message: expect.any(String) } });
    });
  });

  describe("IF-010 error format", () => {
    let errorServer: RunningServer;

    beforeAll(async () => {
      const app = express();
      app.use(express.json());
      app.get("/domain", () => {
        throw new DomainError(422, "incomplete", "Faltam blocos.", { pendingBlocks: [2, 3] });
      });
      app.get("/domain-override", () => {
        throw new DomainError(409, "real_code", "Mensagem real.", { code: "hacked", message: "hacked" });
      });
      app.get("/zod", () => {
        z.object({
          name: z.string().min(2, "Informe ao menos 2 letras."),
          nested: z.object({ count: z.number() }),
        }).parse({ name: "A", nested: {} });
      });
      app.get("/zod-root", () => {
        z.string().parse(42);
      });
      app.get("/boom", () => {
        throw new Error("secret internal detail");
      });
      app.get("/boom-async", async () => {
        throw new Error("secret async detail");
      });
      app.use(errorHandler);
      errorServer = await startServer(app);
    });

    afterAll(async () => {
      await errorServer.close();
    });

    it("gives a DomainError its own status, code and extra keys", async () => {
      const response = await errorServer.request({ path: "/domain" });

      expect(response.status).toBe(422);
      expect(response.body).toEqual({ error: { code: "incomplete", message: "Faltam blocos.", pendingBlocks: [2, 3] } });
    });

    it("does not let extra keys replace the code or the message", async () => {
      const response = await errorServer.request({ path: "/domain-override" });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: { code: "real_code", message: "Mensagem real." } });
    });

    it("turns a ZodError into 400 validation_failed with one message per field", async () => {
      const response = await errorServer.request({ path: "/zod" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: "validation_failed",
          message: expect.any(String),
          fields: { name: "Informe ao menos 2 letras.", "nested.count": expect.any(String) },
        },
      });
    });

    it("files an issue that points at no field under _root", async () => {
      const response = await errorServer.request({ path: "/zod-root" });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ error: { code: "validation_failed", fields: { _root: expect.any(String) } } });
    });

    it.each(["/boom", "/boom-async"])("answers 500 internal_error for %s without leaking the cause", async (routePath) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await errorServer.request({ path: routePath });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: { code: "internal_error", message: expect.any(String) } });
      expect(JSON.stringify(response.body)).not.toContain("secret");
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(String(consoleError.mock.calls[0]?.[1])).toContain("secret");
    });
  });
});
