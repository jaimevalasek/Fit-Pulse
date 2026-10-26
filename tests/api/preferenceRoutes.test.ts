import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.ts";
import { createPrismaClient } from "../../server/db/prismaClient.ts";
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

interface PreferencesBody {
  usageMode: "owner" | "consultant" | null;
  focusCompanyId: string | null;
  theme: "dark" | "light";
  tourSeen: { owner: boolean; consultant: boolean };
  reevaluationIntervalDays: 60 | 90 | 120 | 180;
  tourSeenVersion: number;
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

const DEFAULTS: PreferencesBody = {
  usageMode: null,
  focusCompanyId: null,
  theme: "dark",
  tourSeen: { owner: false, consultant: false },
  reevaluationIntervalDays: 90,
  tourSeenVersion: 0,
};

const COMPANY_INPUT = { name: "Academia Foco", segment: "health_wellness", salesChannel: "subscription" };

function asPreferences(response: ApiResponse): PreferencesBody {
  return response.body as PreferencesBody;
}

function asError(response: ApiResponse): ErrorBody["error"] {
  return (response.body as ErrorBody).error;
}

describe("preference routes", () => {
  let db: TestDatabase;
  let server: RunningServer;

  const get = () => callApi(server.baseUrl, "GET", "/api/preferences");
  const put = (body?: unknown) => callApi(server.baseUrl, "PUT", "/api/preferences", body);

  async function createCompany(): Promise<string> {
    const response = await callApi(server.baseUrl, "POST", "/api/companies", COMPANY_INPUT);
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function storedEntries(): Promise<Record<string, string>> {
    const rows = await db.prisma.preference.findMany({ orderBy: { key: "asc" } });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async function expectRefusedWithoutSaving(body: unknown, field: string): Promise<void> {
    const response = await put(body);

    expect(response.status).toBe(400);
    expect(asError(response).code).toBe("validation_failed");
    expect(Object.keys(asError(response).fields ?? {})).toContain(field);
    expect(await storedEntries()).toEqual({});
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    server = await startServer(createApp({ ...db, backendPort: 4323 }));
  });

  afterAll(async () => {
    await server.close();
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
  });

  describe("GET /api/preferences", () => {
    it("answers the defaults before anything is saved: no mode yet, dark theme, tours not seen, 90 days, tour version 0 (AC-ra-34)", async () => {
      const response = await get();

      expect(response.status).toBe(200);
      expect(response.body).toEqual(DEFAULTS);
    });

    it("reads a stored value that is not valid as if it had never been saved", async () => {
      await db.prisma.preference.createMany({
        data: [
          { key: "usage_mode", value: "admin" },
          { key: "theme", value: "pink" },
          { key: "tour_seen_owner", value: "maybe" },
          { key: "reevaluation_interval_days", value: "75" },
          { key: "tour_seen_version", value: "two" },
        ],
      });

      expect((await get()).body).toEqual(DEFAULTS);
    });
  });

  describe("PUT /api/preferences", () => {
    it("saves the mode and the theme, answers with the whole preferences and reads them back (AC-dm-38)", async () => {
      const response = await put({ usageMode: "consultant", theme: "light" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...DEFAULTS, usageMode: "consultant", theme: "light" });
      expect((await get()).body).toEqual({ ...DEFAULTS, usageMode: "consultant", theme: "light" });
    });

    it("keeps the choices after the app is closed and opened again (AC-dm-38)", async () => {
      const companyId = await createCompany();
      await put({ usageMode: "owner", focusCompanyId: companyId, theme: "light", tourSeen: { owner: true } });

      // A new connection and a new app on the same file: what a restart reads back.
      const reopenedPrisma = createPrismaClient(db.databaseUrl);
      const reopened = await startServer(createApp({ ...db, prisma: reopenedPrisma, backendPort: 4324 }));
      try {
        const response = await callApi(reopened.baseUrl, "GET", "/api/preferences");

        expect(response.body).toEqual({
          usageMode: "owner",
          focusCompanyId: companyId,
          theme: "light",
          tourSeen: { owner: true, consultant: false },
          reevaluationIntervalDays: 90,
          tourSeenVersion: 0,
        });
      } finally {
        await reopened.close();
        await reopenedPrisma.$disconnect();
      }
    });

    it("changes only the keys that were sent", async () => {
      await put({ usageMode: "owner", theme: "light" });

      const response = await put({ theme: "dark" });

      expect(asPreferences(response)).toEqual({ ...DEFAULTS, usageMode: "owner", theme: "dark" });
    });

    it("keeps one row per preference when the same key is saved again", async () => {
      await put({ theme: "light" });
      await put({ theme: "dark" });
      await put({ theme: "light" });

      expect(await storedEntries()).toEqual({ theme: "light" });
    });

    it("answers the current preferences and saves nothing for an empty object", async () => {
      await put({ usageMode: "owner" });

      const response = await put({});

      expect(response.status).toBe(200);
      expect(asPreferences(response)).toEqual({ ...DEFAULTS, usageMode: "owner" });
      expect(await storedEntries()).toEqual({ usage_mode: "owner" });
    });

    it("drops keys it does not know instead of storing them", async () => {
      const response = await put({ theme: "light", language: "en", admin: true });

      expect(response.status).toBe(200);
      expect(await storedEntries()).toEqual({ theme: "light" });
    });

    it("keeps the tour seen of each mode apart and lets a tour be marked as not seen again", async () => {
      const first = await put({ tourSeen: { owner: true } });
      expect(asPreferences(first).tourSeen).toEqual({ owner: true, consultant: false });

      const second = await put({ tourSeen: { consultant: true } });
      expect(asPreferences(second).tourSeen).toEqual({ owner: true, consultant: true });

      const third = await put({ tourSeen: { owner: false } });
      expect(asPreferences(third).tourSeen).toEqual({ owner: false, consultant: true });
    });
  });

  describe("reevaluation interval (AC-ra-34)", () => {
    it.each([60, 90, 120, 180])("saves %i days and reads them back", async (days) => {
      const response = await put({ reevaluationIntervalDays: days });

      expect(response.status).toBe(200);
      expect(asPreferences(response)).toEqual({ ...DEFAULTS, reevaluationIntervalDays: days });
      expect((await get()).body).toEqual({ ...DEFAULTS, reevaluationIntervalDays: days });
      expect(await storedEntries()).toEqual({ reevaluation_interval_days: String(days) });
    });

    it("keeps the interval after the app is closed and opened again", async () => {
      await put({ reevaluationIntervalDays: 180 });

      // A new connection and a new app on the same file: what a restart reads back.
      const reopenedPrisma = createPrismaClient(db.databaseUrl);
      const reopened = await startServer(createApp({ ...db, prisma: reopenedPrisma, backendPort: 4325 }));
      try {
        const response = await callApi(reopened.baseUrl, "GET", "/api/preferences");

        expect((response.body as PreferencesBody).reevaluationIntervalDays).toBe(180);
      } finally {
        await reopened.close();
        await reopenedPrisma.$disconnect();
      }
    });

    it("changes the interval without touching the other preferences, and 90 can be chosen again", async () => {
      await put({ usageMode: "consultant", theme: "light", reevaluationIntervalDays: 60 });

      const second = await put({ reevaluationIntervalDays: 120 });
      expect(asPreferences(second)).toEqual({
        ...DEFAULTS,
        usageMode: "consultant",
        theme: "light",
        reevaluationIntervalDays: 120,
      });

      const third = await put({ reevaluationIntervalDays: 90 });
      expect(asPreferences(third).reevaluationIntervalDays).toBe(90);
      expect(await storedEntries()).toEqual({
        usage_mode: "consultant",
        theme: "light",
        reevaluation_interval_days: "90",
      });
    });

    it("keeps one row for the interval when it is saved again", async () => {
      await put({ reevaluationIntervalDays: 60 });
      await put({ reevaluationIntervalDays: 180 });

      expect(await storedEntries()).toEqual({ reevaluation_interval_days: "180" });
    });

    it("is left alone by a save that does not send it", async () => {
      await put({ reevaluationIntervalDays: 120 });

      const response = await put({ theme: "light" });

      expect(asPreferences(response)).toEqual({ ...DEFAULTS, theme: "light", reevaluationIntervalDays: 120 });
    });

    it("saves none of the keys when the interval is invalid and keeps the interval that was there", async () => {
      await put({ reevaluationIntervalDays: 120 });

      const response = await put({ theme: "light", tourSeenVersion: 2, reevaluationIntervalDays: 100 });

      expect(response.status).toBe(400);
      expect(Object.keys(asError(response).fields ?? {})).toContain("reevaluationIntervalDays");
      expect(await storedEntries()).toEqual({ reevaluation_interval_days: "120" });
      expect((await get()).body).toEqual({ ...DEFAULTS, reevaluationIntervalDays: 120 });
    });
  });

  describe("tour version", () => {
    it("saves the version of the tour seen and reads it back after a restart", async () => {
      const response = await put({ tourSeenVersion: 2 });

      expect(response.status).toBe(200);
      expect(asPreferences(response)).toEqual({ ...DEFAULTS, tourSeenVersion: 2 });
      expect(await storedEntries()).toEqual({ tour_seen_version: "2" });

      const reopenedPrisma = createPrismaClient(db.databaseUrl);
      const reopened = await startServer(createApp({ ...db, prisma: reopenedPrisma, backendPort: 4326 }));
      try {
        const reread = await callApi(reopened.baseUrl, "GET", "/api/preferences");

        expect((reread.body as PreferencesBody).tourSeenVersion).toBe(2);
      } finally {
        await reopened.close();
        await reopenedPrisma.$disconnect();
      }
    });

    it("keeps the version apart from the tour seen of each mode", async () => {
      await put({ tourSeen: { owner: true }, tourSeenVersion: 2 });

      const response = await put({ tourSeen: { consultant: true } });

      expect(asPreferences(response)).toEqual({
        ...DEFAULTS,
        tourSeen: { owner: true, consultant: true },
        tourSeenVersion: 2,
      });
    });

    it("lets the version be set back to zero", async () => {
      await put({ tourSeenVersion: 2 });

      const response = await put({ tourSeenVersion: 0 });

      expect(asPreferences(response).tourSeenVersion).toBe(0);
    });
  });

  describe("focus company", () => {
    it("saves an active company as the focus and clears it with null", async () => {
      const companyId = await createCompany();

      const saved = await put({ focusCompanyId: companyId });
      expect(asPreferences(saved).focusCompanyId).toBe(companyId);
      expect((await get()).body).toMatchObject({ focusCompanyId: companyId });

      const cleared = await put({ focusCompanyId: null });
      expect(asPreferences(cleared).focusCompanyId).toBeNull();
      expect(await storedEntries()).toEqual({});
    });

    it("answers 404 company_not_found for a company that does not exist and saves nothing, not even the other keys", async () => {
      const response = await put({ usageMode: "owner", theme: "light", focusCompanyId: "no-such-company" });

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
      expect(await storedEntries()).toEqual({});
    });

    it("answers 404 company_not_found for an archived company and keeps the focus that was there", async () => {
      const kept = await createCompany();
      const archived = await createCompany();
      await put({ focusCompanyId: kept });
      await callApi(server.baseUrl, "POST", `/api/companies/${archived}/archive`);

      const response = await put({ focusCompanyId: archived });

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
      expect((await get()).body).toMatchObject({ focusCompanyId: kept });
    });

    it("reports no focus while the company is archived and brings it back when the company is restored", async () => {
      const companyId = await createCompany();
      await put({ focusCompanyId: companyId });

      await callApi(server.baseUrl, "POST", `/api/companies/${companyId}/archive`);
      expect((await get()).body).toMatchObject({ focusCompanyId: null });

      await callApi(server.baseUrl, "POST", `/api/companies/${companyId}/restore`);
      expect((await get()).body).toMatchObject({ focusCompanyId: companyId });
    });

    it("reports no focus once the company is deleted", async () => {
      const companyId = await createCompany();
      await put({ focusCompanyId: companyId });
      await callApi(server.baseUrl, "POST", `/api/companies/${companyId}/archive`);
      await callApi(server.baseUrl, "DELETE", `/api/companies/${companyId}`);

      expect((await get()).body).toMatchObject({ focusCompanyId: null });
    });
  });

  describe("invalid values", () => {
    it.each([
      ["a mode that does not exist", { usageMode: "admin" }, "usageMode"],
      ["a null mode", { usageMode: null }, "usageMode"],
      ["a mode that is not text", { usageMode: 1 }, "usageMode"],
      ["a theme that does not exist", { theme: "blue" }, "theme"],
      ["a null theme", { theme: null }, "theme"],
      ["a tour that is not an object", { tourSeen: "yes" }, "tourSeen"],
      ["a null tour", { tourSeen: null }, "tourSeen"],
      ["a tour flag that is not a boolean", { tourSeen: { owner: "yes" } }, "tourSeen.owner"],
      ["an interval that is not offered", { reevaluationIntervalDays: 75 }, "reevaluationIntervalDays"],
      ["an interval of zero", { reevaluationIntervalDays: 0 }, "reevaluationIntervalDays"],
      ["a negative interval", { reevaluationIntervalDays: -90 }, "reevaluationIntervalDays"],
      ["an interval with a fraction", { reevaluationIntervalDays: 90.5 }, "reevaluationIntervalDays"],
      ["an interval written as text", { reevaluationIntervalDays: "90" }, "reevaluationIntervalDays"],
      ["a null interval", { reevaluationIntervalDays: null }, "reevaluationIntervalDays"],
      ["a tour version below zero", { tourSeenVersion: -1 }, "tourSeenVersion"],
      ["a tour version with a fraction", { tourSeenVersion: 1.5 }, "tourSeenVersion"],
      ["a tour version far too high", { tourSeenVersion: 100 }, "tourSeenVersion"],
      ["a tour version written as text", { tourSeenVersion: "2" }, "tourSeenVersion"],
      ["a null tour version", { tourSeenVersion: null }, "tourSeenVersion"],
      ["a focus that is blank", { focusCompanyId: "   " }, "focusCompanyId"],
      ["a focus that is not text", { focusCompanyId: 7 }, "focusCompanyId"],
      ["a focus that is far too long", { focusCompanyId: "x".repeat(65) }, "focusCompanyId"],
    ])("refuses %s with 400 validation_failed and saves nothing", async (_label, body, field) => {
      await expectRefusedWithoutSaving(body, field);
    });

    it("saves none of the keys when one of them is invalid", async () => {
      await expectRefusedWithoutSaving({ usageMode: "owner", theme: "blue" }, "theme");
    });

    it("refuses a list as the body with 400 validation_failed", async () => {
      const response = await put([]);

      expect(response.status).toBe(400);
      expect(asError(response).code).toBe("validation_failed");
      expect(await storedEntries()).toEqual({});
    });

    // The shared JSON parser only accepts an object or a list at the top level.
    it.each([
      ["text", "dark"],
      ["null", null],
    ])("refuses %s as the body with 400 invalid_json", async (_label, body) => {
      const response = await put(body);

      expect(response.status).toBe(400);
      expect(asError(response).code).toBe("invalid_json");
      expect(await storedEntries()).toEqual({});
    });

    it("reads a request without a body as an empty update and changes nothing", async () => {
      await put({ theme: "light" });

      const response = await put();

      expect(response.status).toBe(200);
      expect(asPreferences(response)).toEqual({ ...DEFAULTS, theme: "light" });
      expect(await storedEntries()).toEqual({ theme: "light" });
    });

    it("refuses a body that is not JSON with 400 invalid_json", async () => {
      const response = await fetch(`${server.baseUrl}/api/preferences`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: "{theme:",
      });

      expect(response.status).toBe(400);
      expect(((await response.json()) as ErrorBody).error.code).toBe("invalid_json");
    });

    it("refuses a write that does not declare JSON with 415 json_required", async () => {
      const response = await fetch(`${server.baseUrl}/api/preferences`, {
        method: "PUT",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ theme: "light" }),
      });

      expect(response.status).toBe(415);
      expect(((await response.json()) as ErrorBody).error.code).toBe("json_required");
      expect(await storedEntries()).toEqual({});
    });
  });
});
