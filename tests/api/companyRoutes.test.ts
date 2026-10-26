import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.ts";
import { createPrismaClient } from "../../server/db/prismaClient.ts";
import type { PrismaClient } from "../../server/generated/prisma/client.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

interface ApiResponse {
  status: number;
  body: unknown;
}

interface RunningServer {
  baseUrl: string;
  close(): Promise<void>;
}

async function startServer(app: Express): Promise<RunningServer> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

// Mirrors the browser client: every write declares JSON, even the ones without a body.
async function callApi(baseUrl: string, method: string, path: string, body?: unknown): Promise<ApiResponse> {
  const isWrite = method !== "GET";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: isWrite ? { "content-type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? null : JSON.parse(text) };
}

interface CompanyBody {
  id: string;
  name: string;
  segment: string;
  salesChannel: string;
  annualRevenueRange: string | null;
  cnpj: string | null;
  archivedAt: string | null;
  latestStage: number | null;
  latestCompletedAt: string | null;
  draftId: string | null;
  completedCount: number;
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

const VALID_CNPJ = "11222333000181";
const VALID_CNPJ_MASKED = "11.222.333/0001-81";

const VALID_INPUT = {
  name: "Academia Foco",
  segment: "health_wellness",
  salesChannel: "subscription",
  annualRevenueRange: "up_to_360k",
  cnpj: VALID_CNPJ,
};

function asCompany(response: ApiResponse): CompanyBody {
  return response.body as CompanyBody;
}

function asCompanies(response: ApiResponse): CompanyBody[] {
  return response.body as CompanyBody[];
}

function asError(response: ApiResponse): ErrorBody["error"] {
  return (response.body as ErrorBody).error;
}

function namesOf(response: ApiResponse): string[] {
  return asCompanies(response).map((company) => company.name);
}

describe("company routes", () => {
  let db: TestDatabase;
  let server: RunningServer;

  const get = (path: string) => callApi(server.baseUrl, "GET", path);
  const send = (method: string, path: string, body?: unknown) => callApi(server.baseUrl, method, path, body);

  async function createCompany(overrides: Record<string, unknown> = {}): Promise<CompanyBody> {
    const response = await send("POST", "/api/companies", { ...VALID_INPUT, cnpj: null, ...overrides });
    expect(response.status).toBe(201);
    return asCompany(response);
  }

  interface SeedDiagnosis {
    status?: "draft" | "completed";
    stage?: number;
    completedAt?: string;
    archived?: boolean;
  }

  async function seedDiagnosis(companyId: string, options: SeedDiagnosis = {}): Promise<string> {
    const { status = "completed", stage = 2, completedAt = "2026-09-01T12:00:00.000Z", archived = false } = options;
    const completed = status === "completed";
    const diagnosis = await db.prisma.diagnosis.create({
      data: {
        companyId,
        status,
        archivedAt: archived ? new Date("2026-10-01T00:00:00.000Z") : null,
        currentBlock: completed ? 8 : 3,
        rulesVersion: completed ? 1 : null,
        stage: completed ? stage : null,
        completedAt: completed ? new Date(completedAt) : null,
        result: completed ? { rulesVersion: 1, stage, weakestDimension: "pc" } : undefined,
      },
    });
    return diagnosis.id;
  }

  // A second connection to the same file: what a restart of the app would read back.
  async function withFreshConnection<T>(read: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    const prisma = createPrismaClient(db.databaseUrl);
    try {
      return await read(prisma);
    } finally {
      await prisma.$disconnect();
    }
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    server = await startServer(createApp({ ...db, backendPort: 4322 }));
  });

  afterAll(async () => {
    await server.close();
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
  });

  describe("POST /api/companies", () => {
    it("creates a company with the whole IF-002 shape and persists it", async () => {
      const response = await send("POST", "/api/companies", VALID_INPUT);

      expect(response.status).toBe(201);
      expect(asCompany(response)).toEqual({
        id: expect.any(String),
        name: "Academia Foco",
        segment: "health_wellness",
        salesChannel: "subscription",
        annualRevenueRange: "up_to_360k",
        cnpj: VALID_CNPJ,
        archivedAt: null,
        latestStage: null,
        latestCompletedAt: null,
        draftId: null,
        completedCount: 0,
      });

      const stored = await withFreshConnection((prisma) =>
        prisma.company.findUnique({ where: { id: asCompany(response).id } }),
      );
      expect(stored).toMatchObject({ name: "Academia Foco", segment: "health_wellness", cnpj: VALID_CNPJ });
    });

    it("accepts a company with only the required fields", async () => {
      const response = await send("POST", "/api/companies", {
        name: "Padaria Central",
        segment: "food",
        salesChannel: "storefront",
      });

      expect(response.status).toBe(201);
      expect(asCompany(response)).toMatchObject({ annualRevenueRange: null, cnpj: null });
    });

    it("turns blank optional values into absent ones, explicitly", async () => {
      const response = await send("POST", "/api/companies", {
        ...VALID_INPUT,
        annualRevenueRange: "  ",
        cnpj: "",
      });

      expect(response.status).toBe(201);
      expect(asCompany(response)).toMatchObject({ annualRevenueRange: null, cnpj: null });
    });

    it("trims the name and stores the CNPJ as 14 digits when it arrives masked", async () => {
      const response = await send("POST", "/api/companies", {
        ...VALID_INPUT,
        name: "  Academia Foco  ",
        cnpj: VALID_CNPJ_MASKED,
      });

      expect(response.status).toBe(201);
      expect(asCompany(response)).toMatchObject({ name: "Academia Foco", cnpj: VALID_CNPJ });
    });

    it("accepts the name limits (2 and 80 characters)", async () => {
      expect((await send("POST", "/api/companies", { ...VALID_INPUT, cnpj: null, name: "Ab" })).status).toBe(201);
      expect(
        (await send("POST", "/api/companies", { ...VALID_INPUT, cnpj: null, name: "x".repeat(80) })).status,
      ).toBe(201);
    });

    it.each([
      ["missing", undefined, "Informe o nome da empresa."],
      ["empty", "", "Informe o nome da empresa."],
      ["only spaces", "    ", "Informe o nome da empresa."],
      ["not a string", 42, "Informe o nome da empresa."],
      ["one character", "A", "O nome precisa ter pelo menos 2 letras."],
      ["81 characters", "x".repeat(81), "O nome pode ter até 80 caracteres."],
    ])("rejects a name that is %s", async (_label, name, message) => {
      const response = await send("POST", "/api/companies", { ...VALID_INPUT, name });

      expect(response.status).toBe(400);
      expect(asError(response)).toMatchObject({ code: "validation_failed", fields: { name: message } });
      expect(await db.prisma.company.count()).toBe(0);
    });

    it("rejects choices outside the catalog and reports every wrong field at once", async () => {
      const response = await send("POST", "/api/companies", {
        name: "A",
        segment: "spaceships",
        salesChannel: "carrier_pigeon",
        annualRevenueRange: "a_lot",
        cnpj: "12.345.678/0001-00",
      });

      expect(response.status).toBe(400);
      expect(asError(response)).toMatchObject({ code: "validation_failed" });
      expect(Object.keys(asError(response).fields ?? {}).sort()).toEqual([
        "annualRevenueRange",
        "cnpj",
        "name",
        "salesChannel",
        "segment",
      ]);
      expect(await db.prisma.company.count()).toBe(0);
    });

    it("requires segment and how the company sells", async () => {
      const response = await send("POST", "/api/companies", { name: "Padaria Central" });

      expect(response.status).toBe(400);
      expect(asError(response).fields).toEqual({
        segment: "Escolha o segmento mais próximo.",
        salesChannel: "Escolha como você vende.",
      });
    });

    it.each([
      ["a wrong check digit", "11222333000182"],
      ["only repeated digits", "11111111111111"],
      ["13 digits", "1122233300018"],
      ["15 digits", "112223330001810"],
      ["letters", "11.222.333/0001-8A"],
      ["a number", 11222333000181],
    ])("rejects a CNPJ with %s", async (_label, cnpj) => {
      const response = await send("POST", "/api/companies", { ...VALID_INPUT, cnpj });

      expect(response.status).toBe(400);
      expect(asError(response).fields).toEqual({ cnpj: "CNPJ inválido. Formato: 00.000.000/0000-00." });
      expect(await db.prisma.company.count()).toBe(0);
    });

    it("rejects a body that is not an object", async () => {
      const response = await send("POST", "/api/companies", ["not", "a", "company"]);

      expect(response.status).toBe(400);
      expect(asError(response)).toMatchObject({ code: "validation_failed", fields: { _root: expect.any(String) } });
    });

    it("ignores fields a client must not set", async () => {
      const response = await send("POST", "/api/companies", {
        ...VALID_INPUT,
        id: "forced-id",
        archivedAt: "2026-01-01T00:00:00.000Z",
        completedCount: 99,
      });

      expect(response.status).toBe(201);
      expect(asCompany(response)).toMatchObject({ archivedAt: null, completedCount: 0 });
      expect(asCompany(response).id).not.toBe("forced-id");
    });
  });

  describe("GET /api/companies/:id", () => {
    it("returns the company with its diagnosis summary", async () => {
      const company = await createCompany();
      await seedDiagnosis(company.id, { stage: 3, completedAt: "2026-09-10T12:00:00.000Z" });
      const draftId = await seedDiagnosis(company.id, { status: "draft" });

      const response = await get(`/api/companies/${company.id}`);

      expect(response.status).toBe(200);
      expect(asCompany(response)).toMatchObject({
        id: company.id,
        latestStage: 3,
        latestCompletedAt: "2026-09-10T12:00:00.000Z",
        draftId,
        completedCount: 1,
      });
    });

    it("answers 404 company_not_found for an unknown id", async () => {
      const response = await get("/api/companies/does-not-exist");

      expect(response.status).toBe(404);
      expect(asError(response)).toMatchObject({ code: "company_not_found" });
    });
  });

  describe("PATCH /api/companies/:id", () => {
    it("changes only the company that was edited", async () => {
      const edited = await createCompany({ name: "Academia Foco" });
      const other = await createCompany({ name: "Academia Norte", segment: "retail" });

      const response = await send("PATCH", `/api/companies/${edited.id}`, {
        ...VALID_INPUT,
        name: "Academia Foco Total",
        segment: "education",
        salesChannel: "mixed",
        annualRevenueRange: "above_4_8m",
        cnpj: VALID_CNPJ_MASKED,
      });

      expect(response.status).toBe(200);
      expect(asCompany(response)).toMatchObject({
        id: edited.id,
        name: "Academia Foco Total",
        segment: "education",
        salesChannel: "mixed",
        annualRevenueRange: "above_4_8m",
        cnpj: VALID_CNPJ,
      });

      const list = await get("/api/companies");
      expect(namesOf(list)).toEqual(["Academia Foco Total", "Academia Norte"]);
      expect(asCompanies(list).find((company) => company.id === other.id)).toEqual(other);
    });

    it("clears the optional fields when they come back blank", async () => {
      const company = await createCompany({ cnpj: VALID_CNPJ });

      const response = await send("PATCH", `/api/companies/${company.id}`, {
        ...VALID_INPUT,
        annualRevenueRange: null,
        cnpj: "",
      });

      expect(response.status).toBe(200);
      expect(asCompany(response)).toMatchObject({ annualRevenueRange: null, cnpj: null });
    });

    it("validates with the same rules as the creation and changes nothing on failure", async () => {
      const company = await createCompany();

      const response = await send("PATCH", `/api/companies/${company.id}`, {
        ...VALID_INPUT,
        name: "X",
        cnpj: "11222333000182",
      });

      expect(response.status).toBe(400);
      expect(Object.keys(asError(response).fields ?? {}).sort()).toEqual(["cnpj", "name"]);
      expect(asCompany(await get(`/api/companies/${company.id}`))).toEqual(company);
    });

    it("keeps the archive state, the history and the id", async () => {
      const company = await createCompany();
      await seedDiagnosis(company.id);
      await send("POST", `/api/companies/${company.id}/archive`);

      const response = await send("PATCH", `/api/companies/${company.id}`, {
        ...VALID_INPUT,
        id: "other",
        archivedAt: null,
      });

      expect(response.status).toBe(200);
      expect(asCompany(response)).toMatchObject({ id: company.id, completedCount: 1 });
      expect(asCompany(response).archivedAt).not.toBeNull();
    });

    it("answers 404 company_not_found for an unknown id", async () => {
      const response = await send("PATCH", "/api/companies/does-not-exist", VALID_INPUT);

      expect(response.status).toBe(404);
      expect(asError(response)).toMatchObject({ code: "company_not_found" });
    });
  });

  describe("GET /api/companies (AC-dm-09)", () => {
    it("lists active companies by name and leaves archived ones out", async () => {
      await createCompany({ name: "Zeta Esportes" });
      await createCompany({ name: "alfa Fitness" });
      const archived = await createCompany({ name: "Beta Studio" });
      await send("POST", `/api/companies/${archived.id}/archive`);

      const response = await get("/api/companies");

      expect(response.status).toBe(200);
      expect(namesOf(response)).toEqual(["alfa Fitness", "Zeta Esportes"]);
    });

    it("answers an empty list when there is no company", async () => {
      const response = await get("/api/companies");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("searches the name ignoring case and accents", async () => {
      await createCompany({ name: "Padaria São João" });
      await createCompany({ name: "Academia Foco" });

      expect(namesOf(await get("/api/companies?q=sao"))).toEqual(["Padaria São João"]);
      expect(namesOf(await get("/api/companies?q=FOCO"))).toEqual(["Academia Foco"]);
      expect(namesOf(await get("/api/companies?q=%20jo%C3%A3o%20"))).toEqual(["Padaria São João"]);
      expect(namesOf(await get("/api/companies?q=a"))).toEqual(["Academia Foco", "Padaria São João"]);
    });

    it("answers an empty list when the search finds nothing", async () => {
      await createCompany({ name: "Academia Foco" });

      const response = await get("/api/companies?q=oficina");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("treats % and _ in the search as plain characters", async () => {
      await createCompany({ name: "Academia Foco" });
      await createCompany({ name: "Loja 100% Natural" });

      expect(namesOf(await get("/api/companies?q=%25"))).toEqual(["Loja 100% Natural"]);
      expect(namesOf(await get("/api/companies?q=_"))).toEqual([]);
    });

    it("treats a blank search as no search", async () => {
      await createCompany({ name: "Academia Foco" });

      expect(namesOf(await get("/api/companies?q=%20%20&stage="))).toEqual(["Academia Foco"]);
    });

    it("filters by the stage of the latest completed diagnosis", async () => {
      const discovery = await createCompany({ name: "Descoberta Ltda" });
      const scale = await createCompany({ name: "Escala Ltda" });
      const upgraded = await createCompany({ name: "Evoluiu Ltda" });
      await createCompany({ name: "Sem Diagnóstico Ltda" });
      await seedDiagnosis(discovery.id, { stage: 1 });
      await seedDiagnosis(scale.id, { stage: 3 });
      await seedDiagnosis(upgraded.id, { stage: 1, completedAt: "2026-03-01T12:00:00.000Z" });
      await seedDiagnosis(upgraded.id, { stage: 3, completedAt: "2026-09-01T12:00:00.000Z" });

      expect(namesOf(await get("/api/companies?stage=1"))).toEqual(["Descoberta Ltda"]);
      expect(namesOf(await get("/api/companies?stage=3"))).toEqual(["Escala Ltda", "Evoluiu Ltda"]);
      expect(namesOf(await get("/api/companies?stage=2"))).toEqual([]);
      expect(namesOf(await get("/api/companies?stage=4"))).toEqual([]);
      expect(await get("/api/companies")).toMatchObject({ status: 200 });
      expect(namesOf(await get("/api/companies"))).toHaveLength(4);
    });

    it("takes the stage from the latest completed diagnosis that is not archived", async () => {
      const company = await createCompany({ name: "Academia Foco" });
      await seedDiagnosis(company.id, { stage: 2, completedAt: "2026-05-01T12:00:00.000Z" });
      await seedDiagnosis(company.id, { stage: 4, completedAt: "2026-09-01T12:00:00.000Z", archived: true });
      await seedDiagnosis(company.id, { status: "draft" });

      expect(namesOf(await get("/api/companies?stage=2"))).toEqual(["Academia Foco"]);
      expect(namesOf(await get("/api/companies?stage=4"))).toEqual([]);
      expect(asCompany(await get(`/api/companies/${company.id}`))).toMatchObject({
        latestStage: 2,
        latestCompletedAt: "2026-05-01T12:00:00.000Z",
      });
    });

    it("switches between the active and the archived list", async () => {
      await createCompany({ name: "Ativa Ltda" });
      const archived = await createCompany({ name: "Arquivada Ltda" });
      await send("POST", `/api/companies/${archived.id}/archive`);

      expect(namesOf(await get("/api/companies?archived=false"))).toEqual(["Ativa Ltda"]);
      expect(namesOf(await get("/api/companies?archived=true"))).toEqual(["Arquivada Ltda"]);
      expect(namesOf(await get("/api/companies?archived=1"))).toEqual(["Arquivada Ltda"]);
    });

    it("combines search, stage and the archived switch", async () => {
      const foco = await createCompany({ name: "Academia Foco" });
      const norte = await createCompany({ name: "Academia Norte" });
      const oficina = await createCompany({ name: "Oficina Foco" });
      await seedDiagnosis(foco.id, { stage: 2 });
      await seedDiagnosis(norte.id, { stage: 2 });
      await seedDiagnosis(oficina.id, { stage: 2 });
      await send("POST", `/api/companies/${oficina.id}/archive`);

      expect(namesOf(await get("/api/companies?q=foco&stage=2"))).toEqual(["Academia Foco"]);
      expect(namesOf(await get("/api/companies?q=foco&stage=2&archived=true"))).toEqual(["Oficina Foco"]);
      expect(namesOf(await get("/api/companies?q=foco&stage=3"))).toEqual([]);
    });

    it.each([["stage=0"], ["stage=5"], ["stage=abc"], ["stage=1.5"], ["archived=maybe"], ["attention=urgente"]])(
      "rejects the filter %s with validation_failed",
      async (query) => {
        const response = await get(`/api/companies?${query}`);

        expect(response.status).toBe(400);
        expect(asError(response)).toMatchObject({ code: "validation_failed" });
        expect(Object.keys(asError(response).fields ?? {})).toEqual([query.split("=")[0]]);
      },
    );
  });

  // IF-010 / AC-ra-35: each indicator of "O que precisa de você" opens the list of exactly the companies
  // it counted, and the list follows the data and the chosen interval (AC-ra-36).
  describe("GET /api/companies?attention= (AC-ra-35)", () => {
    const NOW = new Date("2026-10-23T12:00:00.000Z");
    const DAY_MS = 24 * 60 * 60 * 1000;
    const daysAgo = (days: number): string => new Date(NOW.getTime() - days * DAY_MS).toISOString();

    // A result the portfolio can read: the frozen shape the diagnosis writes when it is concluded.
    async function seedReadableDiagnosis(
      companyId: string,
      { days, risks = [], plan = ["aq", "en", "dep"] }: { days: number; risks?: unknown[]; plan?: string[] },
    ): Promise<string> {
      const diagnosis = await db.prisma.diagnosis.create({
        data: {
          companyId,
          status: "completed",
          currentBlock: 8,
          rulesVersion: 1,
          stage: 2,
          completedAt: new Date(daysAgo(days)),
          result: { rulesVersion: 1, stage: 2, weakestDimension: "pc", dimensions: {}, risks, plan } as object,
        },
      });
      return diagnosis.id;
    }

    async function seedStalledDraft(companyId: string, idleDays: number): Promise<void> {
      const draft = await db.prisma.diagnosis.create({ data: { companyId, status: "draft", currentBlock: 3 } });
      await db.prisma.diagnosis.update({ where: { id: draft.id }, data: { updatedAt: new Date(daysAgo(idleDays)) } });
    }

    async function trackAction(diagnosisId: string, actionKey: string, status: string, dueDate: string | null) {
      await db.prisma.actionProgress.create({ data: { diagnosisId, actionKey, status, dueDate } });
    }

    const HIGH_RISK = [{ signalId: "SIG-01", score: 16, level: "high" }];
    const NAMES = {
      late: "Atrasada Ltda",
      overdueActions: "Vencida Ltda",
      highRisk: "Risco Ltda",
      stalledDraft: "Rascunho Ltda",
      noDiagnosis: "Sem Diagnóstico Ltda",
      onTime: "Em Dia Ltda",
    } as const;
    let overdueActionsDiagnosis = "";

    beforeEach(async () => {
      db.setNow(NOW);
      const late = await createCompany({ name: NAMES.late });
      const overdueActions = await createCompany({ name: NAMES.overdueActions });
      const highRisk = await createCompany({ name: NAMES.highRisk });
      const stalledDraft = await createCompany({ name: NAMES.stalledDraft });
      const onTime = await createCompany({ name: NAMES.onTime });
      await createCompany({ name: NAMES.noDiagnosis });
      await seedReadableDiagnosis(late.id, { days: 120 });
      overdueActionsDiagnosis = await seedReadableDiagnosis(overdueActions.id, { days: 10 });
      await trackAction(overdueActionsDiagnosis, "aq", "in_progress", "2026-10-01");
      await trackAction(overdueActionsDiagnosis, "en", "todo", null);
      await seedReadableDiagnosis(highRisk.id, { days: 10, risks: HIGH_RISK });
      await seedReadableDiagnosis(stalledDraft.id, { days: 10 });
      await seedStalledDraft(stalledDraft.id, 15);
      const onTimeDiagnosis = await seedReadableDiagnosis(onTime.id, { days: 10 });
      await trackAction(onTimeDiagnosis, "aq", "done", "2026-10-01");
      await trackAction(onTimeDiagnosis, "en", "todo", "2026-12-01");
    });

    it.each([
      ["atrasada", [NAMES.late]],
      ["vencidas", [NAMES.overdueActions]],
      ["risco", [NAMES.highRisk]],
      ["rascunhos", [NAMES.stalledDraft]],
      ["sem-diagnostico", [NAMES.noDiagnosis]],
    ])("keeps only the companies of the %s indicator", async (attention, expected) => {
      const response = await get(`/api/companies?attention=${attention}`);

      expect(response.status).toBe(200);
      expect(namesOf(response)).toEqual(expected);
    });

    it("opens, for each indicator, exactly the companies the consultant home counted", async () => {
      const home = (await get("/api/home?mode=consultant")).body as Record<string, Array<{ companyId: string }>>;
      const lists = {
        atrasada: home.overdue,
        vencidas: home.overdueActions,
        risco: home.highRisk,
        rascunhos: home.staleDrafts,
        "sem-diagnostico": home.withoutDiagnosis,
      };

      for (const [attention, counted] of Object.entries(lists)) {
        const filtered = asCompanies(await get(`/api/companies?attention=${attention}`)).map((company) => company.id);
        expect(counted.length).toBeGreaterThan(0);
        expect(filtered.sort()).toEqual(counted.map((item) => item.companyId).sort());
      }
    });

    it("treats a blank attention as no filter", async () => {
      expect(namesOf(await get("/api/companies?attention="))).toHaveLength(6);
      expect(namesOf(await get("/api/companies?attention=%20"))).toHaveLength(6);
    });

    it("combines with the search, the stage and keeps the alphabetical order", async () => {
      const late = await createCompany({ name: "Aurora Atrasada" });
      await seedReadableDiagnosis(late.id, { days: 200 });

      expect(namesOf(await get("/api/companies?attention=atrasada"))).toEqual(["Atrasada Ltda", "Aurora Atrasada"]);
      expect(namesOf(await get("/api/companies?attention=atrasada&q=aurora"))).toEqual(["Aurora Atrasada"]);
      expect(namesOf(await get("/api/companies?attention=atrasada&stage=2"))).toEqual(["Atrasada Ltda", "Aurora Atrasada"]);
      expect(namesOf(await get("/api/companies?attention=atrasada&stage=3"))).toEqual([]);
    });

    it("answers an empty list, not an error, when nobody is flagged", async () => {
      await db.resetData();

      const response = await get("/api/companies?attention=vencidas");

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it("follows the data: an action marked as done leaves the list of overdue actions", async () => {
      expect(namesOf(await get("/api/companies?attention=vencidas"))).toEqual([NAMES.overdueActions]);

      const done = await send("PATCH", `/api/diagnoses/${overdueActionsDiagnosis}/actions/aq`, { status: "done" });
      expect(done.status).toBe(200);

      expect(namesOf(await get("/api/companies?attention=vencidas"))).toEqual([]);
    });

    it("follows the chosen interval: 180 days takes the 120-day-old diagnosis out of the late list", async () => {
      expect(namesOf(await get("/api/companies?attention=atrasada"))).toEqual([NAMES.late]);

      expect((await send("PUT", "/api/preferences", { reevaluationIntervalDays: 180 })).status).toBe(200);
      expect(namesOf(await get("/api/companies?attention=atrasada"))).toEqual([]);

      expect((await send("PUT", "/api/preferences", { reevaluationIntervalDays: 60 })).status).toBe(200);
      expect(namesOf(await get("/api/companies?attention=atrasada"))).toEqual([NAMES.late]);
    });

    it("follows the clock: the same company is flagged late once the due day has passed", async () => {
      expect(namesOf(await get("/api/companies?attention=atrasada"))).not.toContain(NAMES.onTime);

      // Diagnosed 10 days ago and due in 80 days: 81 days from now it is 91 days old, one day past the due day.
      db.setNow(new Date(NOW.getTime() + 80 * DAY_MS));
      expect(namesOf(await get("/api/companies?attention=atrasada"))).not.toContain(NAMES.onTime);

      db.setNow(new Date(NOW.getTime() + 81 * DAY_MS));
      expect(namesOf(await get("/api/companies?attention=atrasada"))).toContain(NAMES.onTime);
    });

    it("leaves archived companies out: they carry no indicator", async () => {
      const late = asCompanies(await get("/api/companies?attention=atrasada"))[0];
      await send("POST", `/api/companies/${late.id}/archive`);

      expect(namesOf(await get("/api/companies?attention=atrasada"))).toEqual([]);
      expect(namesOf(await get("/api/companies?attention=atrasada&archived=true"))).toEqual([]);
      expect(namesOf(await get("/api/companies?archived=true"))).toEqual([NAMES.late]);
    });
  });

  describe("archive and restore (RULE-dm-15)", () => {
    it("archives with the app clock and keeps every diagnosis", async () => {
      const company = await createCompany();
      await seedDiagnosis(company.id, { stage: 3 });
      const draftId = await seedDiagnosis(company.id, { status: "draft" });

      const response = await send("POST", `/api/companies/${company.id}/archive`);

      expect(response.status).toBe(200);
      expect(asCompany(response)).toMatchObject({
        id: company.id,
        archivedAt: "2026-10-23T12:00:00.000Z",
        latestStage: 3,
        draftId,
        completedCount: 1,
      });
      expect(await db.prisma.diagnosis.count({ where: { companyId: company.id } })).toBe(2);
      expect(namesOf(await get("/api/companies"))).toEqual([]);
      expect(namesOf(await get("/api/companies?archived=true"))).toEqual(["Academia Foco"]);
    });

    it("leaves an archived company out of the assistant summary", async () => {
      const company = await createCompany();
      await seedDiagnosis(company.id, { stage: 2 });
      expect(((await get("/api/assistant/summary")).body as { companies: unknown[] }).companies).toHaveLength(1);

      await send("POST", `/api/companies/${company.id}/archive`);

      expect((await get("/api/assistant/summary")).body).toEqual({ companies: [] });
    });

    it("restores the company with its history intact", async () => {
      const company = await createCompany();
      await seedDiagnosis(company.id, { stage: 3, completedAt: "2026-09-10T12:00:00.000Z" });
      await seedDiagnosis(company.id, { stage: 2, completedAt: "2026-04-10T12:00:00.000Z" });
      await send("POST", `/api/companies/${company.id}/archive`);

      const response = await send("POST", `/api/companies/${company.id}/restore`);

      expect(response.status).toBe(200);
      expect(asCompany(response)).toMatchObject({
        id: company.id,
        archivedAt: null,
        latestStage: 3,
        latestCompletedAt: "2026-09-10T12:00:00.000Z",
        completedCount: 2,
      });
      expect(namesOf(await get("/api/companies"))).toEqual(["Academia Foco"]);
      expect(namesOf(await get("/api/companies?archived=true"))).toEqual([]);
    });

    it("answers the same state when archiving or restoring twice, without moving the date", async () => {
      const company = await createCompany();
      const first = await send("POST", `/api/companies/${company.id}/archive`);
      db.setNow(new Date("2026-11-01T09:00:00.000Z"));
      const second = await send("POST", `/api/companies/${company.id}/archive`);
      db.setNow(new Date("2026-10-23T12:00:00.000Z"));

      expect(second.status).toBe(200);
      expect(asCompany(second).archivedAt).toBe(asCompany(first).archivedAt);

      await send("POST", `/api/companies/${company.id}/restore`);
      const again = await send("POST", `/api/companies/${company.id}/restore`);
      expect(again.status).toBe(200);
      expect(asCompany(again).archivedAt).toBeNull();
    });

    it.each([["archive"], ["restore"]])("answers 404 company_not_found on %s of an unknown id", async (action) => {
      const response = await send("POST", `/api/companies/does-not-exist/${action}`);

      expect(response.status).toBe(404);
      expect(asError(response)).toMatchObject({ code: "company_not_found" });
    });
  });

  describe("DELETE /api/companies/:id (AC-dm-07)", () => {
    it("refuses to delete an active company and changes nothing", async () => {
      const company = await createCompany();
      await seedDiagnosis(company.id);

      const response = await send("DELETE", `/api/companies/${company.id}`);

      expect(response.status).toBe(409);
      expect(asError(response)).toMatchObject({ code: "company_not_archived" });
      expect(await db.prisma.company.count()).toBe(1);
      expect(await db.prisma.diagnosis.count()).toBe(1);
    });

    it("removes an archived company and all of its diagnoses, and the removal persists", async () => {
      const company = await createCompany();
      const bystander = await createCompany({ name: "Academia Norte" });
      await seedDiagnosis(company.id, { stage: 2 });
      await seedDiagnosis(company.id, { stage: 3, archived: true });
      await seedDiagnosis(company.id, { status: "draft" });
      await seedDiagnosis(bystander.id, { stage: 1 });
      await send("POST", `/api/companies/${company.id}/archive`);

      const response = await send("DELETE", `/api/companies/${company.id}`);

      expect(response.status).toBe(204);
      expect(response.body).toBeNull();
      const persisted = await withFreshConnection(async (prisma) => ({
        companies: await prisma.company.findMany({ select: { id: true } }),
        ownDiagnoses: await prisma.diagnosis.count({ where: { companyId: company.id } }),
        allDiagnoses: await prisma.diagnosis.count(),
      }));
      expect(persisted).toEqual({ companies: [{ id: bystander.id }], ownDiagnoses: 0, allDiagnoses: 1 });
      expect((await get(`/api/companies/${company.id}`)).status).toBe(404);
      expect(namesOf(await get("/api/companies?archived=true"))).toEqual([]);
    });

    it("gives the archived company's diagnosis count before the deletion, as the confirmation needs", async () => {
      const company = await createCompany();
      await seedDiagnosis(company.id, { stage: 2 });
      await seedDiagnosis(company.id, { stage: 3, archived: true });
      const draftId = await seedDiagnosis(company.id, { status: "draft" });
      await send("POST", `/api/companies/${company.id}/archive`);

      const view = asCompany(await get(`/api/companies/${company.id}`));

      expect(view.draftId).toBe(draftId);
      expect(view.completedCount + (view.draftId ? 1 : 0)).toBe(await db.prisma.diagnosis.count());
    });

    it("deletes an archived company that has no diagnosis", async () => {
      const company = await createCompany();
      await send("POST", `/api/companies/${company.id}/archive`);

      expect((await send("DELETE", `/api/companies/${company.id}`)).status).toBe(204);
      expect(await db.prisma.company.count()).toBe(0);
    });

    it("keeps the company and its history after archive, restore and a refused delete", async () => {
      const company = await createCompany();
      await seedDiagnosis(company.id);
      await send("POST", `/api/companies/${company.id}/archive`);
      await send("POST", `/api/companies/${company.id}/restore`);

      expect((await send("DELETE", `/api/companies/${company.id}`)).status).toBe(409);
      expect(asCompany(await get(`/api/companies/${company.id}`))).toMatchObject({ completedCount: 1 });
    });

    it("answers 404 company_not_found for an unknown id and a second delete", async () => {
      const company = await createCompany();
      await send("POST", `/api/companies/${company.id}/archive`);
      await send("DELETE", `/api/companies/${company.id}`);

      for (const id of [company.id, "does-not-exist"]) {
        const response = await send("DELETE", `/api/companies/${id}`);
        expect(response.status).toBe(404);
        expect(asError(response)).toMatchObject({ code: "company_not_found" });
      }
    });
  });
});
