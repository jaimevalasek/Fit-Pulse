import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DIARY_MAX_NEW_CUSTOMERS, DIARY_MAX_SPEND_CENTS } from "../../shared/domain/diary.ts";
import { MONTH_FUTURE_MESSAGE, MONTH_INVALID_MESSAGE, MONTH_REQUIRED_MESSAGE } from "../../shared/format/dates.ts";
import { createApp } from "../../server/app.ts";
import { createPrismaClient } from "../../server/db/prismaClient.ts";
import type { PrismaClient } from "../../server/generated/prisma/client.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-006: the diary routes. Covers the errors that show on their own field and write nothing (AC-ra-39),
// the same month refused for the same company even when asked in parallel (RULE-ra-08), the spend that
// travels in whole cents with its limits (AC-ra-43), the edit that never moves the month and the delete.

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

// Declares JSON on every write, as requireJsonWrites demands, even for the DELETEs without a body.
async function callApi(baseUrl: string, method: string, path: string, body?: unknown): Promise<ApiResponse> {
  const isWrite = method !== "GET" && method !== "DELETE";
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: isWrite ? { "content-type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? null : JSON.parse(text) };
}

interface EntryBody {
  month: string;
  newCustomers: number;
  spendParts: Record<string, number> | null;
  spendTotalCents: number | null;
  totalCents: number;
  cacCents: number | null;
}

interface DiaryBody {
  entries: EntryBody[];
  progress: { count: number; measuredFrom: string | null; measuredTo: string | null };
  chart: { month: string; cacCents: number | null }[];
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

const asDiary = (response: ApiResponse): DiaryBody => response.body as DiaryBody;
const asError = (response: ApiResponse): ErrorBody["error"] => (response.body as ErrorBody).error;
const monthsOf = (diary: DiaryBody): string[] => diary.entries.map((entry) => entry.month);

const EMPTY_DIARY: DiaryBody = { entries: [], progress: { count: 0, measuredFrom: null, measuredTo: null }, chart: [] };

// 2026-10-23 is "today" in these tests: October 2026 can be noted, November cannot.
const FIRST_DAY = new Date("2026-10-23T12:00:00.000Z");

const SEPTEMBER_PARTS = { month: "2026-09", newCustomers: 10, spendParts: { ads: 200_000, agency: 100_000 } };

describe("diary routes", () => {
  let db: TestDatabase;
  let server: RunningServer;

  const get = (path: string) => callApi(server.baseUrl, "GET", path);
  const send = (method: string, path: string, body?: unknown) => callApi(server.baseUrl, method, path, body);

  async function createCompany(name = "Academia Foco"): Promise<string> {
    const response = await send("POST", "/api/companies", { name, segment: "health_wellness", salesChannel: "subscription" });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  const diaryPath = (companyId: string, month?: string) =>
    `/api/companies/${companyId}/diary${month === undefined ? "" : `/${month}`}`;
  const readDiary = async (companyId: string) => asDiary(await get(diaryPath(companyId)));
  const addMonth = (companyId: string, body: unknown) => send("POST", diaryPath(companyId), body);
  const countRows = (companyId?: string) => db.prisma.diaryEntry.count({ where: companyId === undefined ? {} : { companyId } });

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
    server = await startServer(createApp({ ...db, backendPort: 4325 }));
  });

  afterAll(async () => {
    await server.close();
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
    db.setNow(FIRST_DAY);
  });

  describe("GET /api/companies/:id/diary", () => {
    it("answers 404 company_not_found for a company that does not exist", async () => {
      const response = await get("/api/companies/nobody/diary");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
    });

    it("answers an empty diary with no entries, no progress and no chart", async () => {
      const companyId = await createCompany();

      const response = await get(diaryPath(companyId));

      expect(response.status).toBe(200);
      expect(response.body).toEqual(EMPTY_DIARY);
    });
  });

  describe("POST /api/companies/:id/diary", () => {
    it("notes a month with the spend in parts and reads the cost per customer back (IF-006)", async () => {
      const companyId = await createCompany();

      const response = await addMonth(companyId, SEPTEMBER_PARTS);

      expect(response.status).toBe(201);
      expect(asDiary(response)).toEqual({
        entries: [
          { month: "2026-09", newCustomers: 10, spendParts: { ads: 200_000, agency: 100_000 }, spendTotalCents: null, totalCents: 300_000, cacCents: 30_000 },
        ],
        progress: { count: 1, measuredFrom: null, measuredTo: null },
        chart: [{ month: "2026-09", cacCents: 30_000 }],
      });
      expect(await readDiary(companyId)).toEqual(asDiary(response));
    });

    it("notes a month with only the total, with no division by part (AC-ra-38 on the API side)", async () => {
      const companyId = await createCompany();

      const response = await addMonth(companyId, { month: "2026-08", newCustomers: 9, spendTotalCents: 450_000 });

      expect(response.status).toBe(201);
      expect(asDiary(response).entries[0]).toEqual({
        month: "2026-08",
        newCustomers: 9,
        spendParts: null,
        spendTotalCents: 450_000,
        totalCents: 450_000,
        cacCents: 50_000,
      });
    });

    it("keeps an explicit 0 as a filled part and 0 as a valid total (R$ 0,00 spent is a real month)", async () => {
      const companyId = await createCompany();

      expect((await addMonth(companyId, { month: "2026-07", newCustomers: 4, spendParts: { ads: 0 } })).status).toBe(201);
      expect((await addMonth(companyId, { month: "2026-06", newCustomers: 4, spendTotalCents: 0 })).status).toBe(201);

      const byMonth = Object.fromEntries((await readDiary(companyId)).entries.map((entry) => [entry.month, entry]));
      expect(byMonth["2026-07"]).toMatchObject({ spendParts: { ads: 0 }, totalCents: 0, cacCents: 0 });
      expect(byMonth["2026-06"]).toMatchObject({ spendTotalCents: 0, totalCents: 0, cacCents: 0 });
    });

    it("answers 'não calculado' (null) for a month with 0 new customers, never NaN or Infinity (AC-ra-41)", async () => {
      const companyId = await createCompany();

      const response = await addMonth(companyId, { month: "2026-09", newCustomers: 0, spendTotalCents: 120_000 });

      expect(response.status).toBe(201);
      expect(asDiary(response).entries[0]).toMatchObject({ newCustomers: 0, totalCents: 120_000, cacCents: null });
      expect(asDiary(response).chart).toEqual([{ month: "2026-09", cacCents: null }]);
      expect(JSON.stringify(response.body)).not.toMatch(/NaN|Infinity/);
    });

    it("lists the most recent month first and measures the 3 most recent from the third month on (AC-ra-41)", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, { month: "2026-08", newCustomers: 10, spendTotalCents: 100_000 });
      await addMonth(companyId, { month: "2026-10", newCustomers: 10, spendTotalCents: 300_000 });
      const twoMonths = asDiary(await addMonth(companyId, { month: "2026-09", newCustomers: 10, spendTotalCents: 200_000 }));

      expect(monthsOf(twoMonths)).toEqual(["2026-10", "2026-09", "2026-08"]);
      expect(twoMonths.progress).toEqual({ count: 3, measuredFrom: "2026-08", measuredTo: "2026-10" });
      expect(twoMonths.chart.map((point) => point.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
      expect(twoMonths.chart.map((point) => point.cacCents)).toEqual([10_000, 20_000, 30_000]);
    });

    it("charts only the last 6 months noted but lists all of them", async () => {
      const companyId = await createCompany();
      for (const month of ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]) {
        await addMonth(companyId, { month, newCustomers: 5, spendTotalCents: 50_000 });
      }

      const diary = await readDiary(companyId);

      expect(diary.entries).toHaveLength(8);
      expect(diary.chart.map((point) => point.month)).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
    });

    it("keeps every company's diary apart, and lets two companies note the same month", async () => {
      const first = await createCompany("Academia Foco");
      const second = await createCompany("Estúdio Ritmo");

      expect((await addMonth(first, SEPTEMBER_PARTS)).status).toBe(201);
      expect((await readDiary(second)).entries).toEqual([]);
      expect((await addMonth(second, { month: "2026-09", newCustomers: 3, spendTotalCents: 90_000 })).status).toBe(201);

      expect((await readDiary(first)).entries[0].totalCents).toBe(300_000);
      expect((await readDiary(second)).entries[0].totalCents).toBe(90_000);
    });

    it("answers 404 company_not_found and writes nothing for a company that does not exist", async () => {
      const response = await addMonth("nobody", SEPTEMBER_PARTS);

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
      expect(await countRows()).toBe(0);
    });

    it("persists the month in the database file", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);

      const rows = await withFreshConnection((prisma) => prisma.diaryEntry.findMany({ where: { companyId } }));

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ month: "2026-09", newCustomers: 10, spendParts: { ads: 200_000, agency: 100_000 }, spendTotalCents: null });
    });
  });

  describe("errors on the field, with nothing written (AC-ra-39)", () => {
    it("refuses a month that has not come yet, but accepts the current month", async () => {
      const companyId = await createCompany();

      const future = await addMonth(companyId, { month: "2026-11", newCustomers: 5, spendTotalCents: 10_000 });

      expect(future.status).toBe(400);
      expect(asError(future).code).toBe("validation_failed");
      expect(asError(future).fields).toEqual({ month: MONTH_FUTURE_MESSAGE });
      expect(await countRows()).toBe(0);

      const current = await addMonth(companyId, { month: "2026-10", newCustomers: 5, spendTotalCents: 10_000 });
      expect(current.status).toBe(201);
    });

    it.each([
      ["a month that does not exist", "2026-13"],
      ["the screen's MM/AAAA text", "09/2026"],
      ["a day instead of a month", "2026-09-10"],
      ["text", "setembro"],
      ["a year out of range", "1800-01"],
    ])("refuses %s as an invalid month", async (_label, month) => {
      const companyId = await createCompany();

      const response = await addMonth(companyId, { month, newCustomers: 5, spendTotalCents: 10_000 });

      expect(response.status).toBe(400);
      expect(asError(response).fields).toEqual({ month: MONTH_INVALID_MESSAGE });
      expect(await countRows()).toBe(0);
    });

    it.each([
      ["missing", {}],
      ["null", { month: null }],
      ["blank", { month: "  " }],
    ])("asks for the month when it is %s", async (_label, monthField) => {
      const companyId = await createCompany();

      const response = await addMonth(companyId, { ...monthField, newCustomers: 5, spendTotalCents: 10_000 });

      expect(response.status).toBe(400);
      expect(asError(response).fields).toEqual({ month: MONTH_REQUIRED_MESSAGE });
    });

    it("asks for the new customers when they are empty (0 is a valid answer)", async () => {
      const companyId = await createCompany();

      const missing = await addMonth(companyId, { month: "2026-09", spendTotalCents: 10_000 });
      const empty = await addMonth(companyId, { month: "2026-09", newCustomers: null, spendTotalCents: 10_000 });

      for (const response of [missing, empty]) {
        expect(response.status).toBe(400);
        expect(asError(response).fields).toEqual({ newCustomers: "Informe quantos clientes novos vieram. Pode ser 0." });
      }
      expect(await countRows()).toBe(0);
    });

    it("asks for at least one part of the spend, or the total, when the spend is empty", async () => {
      const companyId = await createCompany();

      const noSpend = await addMonth(companyId, { month: "2026-09", newCustomers: 5 });
      const emptyParts = await addMonth(companyId, { month: "2026-09", newCustomers: 5, spendParts: {} });
      const emptyTotal = await addMonth(companyId, { month: "2026-09", newCustomers: 5, spendTotalCents: null });

      const expected = "Preencha pelo menos uma parte do gasto, ou marque 'Só sei o total'.";
      expect(asError(noSpend).fields).toEqual({ spendParts: expected });
      expect(asError(emptyParts).fields).toEqual({ spendParts: expected });
      expect(asError(emptyTotal).fields).toEqual({ spendTotalCents: "Informe o gasto total do mês. Pode ser 0,00." });
      expect(await countRows()).toBe(0);
    });

    it("reports every wrong field together", async () => {
      const companyId = await createCompany();

      const response = await addMonth(companyId, { month: "2026-11" });

      expect(response.status).toBe(400);
      expect(Object.keys(asError(response).fields ?? {}).sort()).toEqual(["month", "newCustomers", "spendParts"]);
    });

    it("refuses the parts and the total together, and any key the screen does not send", async () => {
      const companyId = await createCompany();

      const both = await addMonth(companyId, { ...SEPTEMBER_PARTS, spendTotalCents: 300_000 });
      const stranger = await addMonth(companyId, { ...SEPTEMBER_PARTS, companyId: "other" });
      const unknownPart = await addMonth(companyId, { month: "2026-09", newCustomers: 5, spendParts: { rent: 10_000 } });

      expect(both.status).toBe(400);
      expect(Object.keys(asError(both).fields ?? {})).toEqual(["spendTotalCents"]);
      expect(stranger.status).toBe(400);
      expect(unknownPart.status).toBe(400);
      expect(Object.keys(asError(unknownPart).fields ?? {}).every((key) => key.startsWith("spendParts"))).toBe(true);
      expect(await countRows()).toBe(0);
    });

    it("refuses a month already noted for the same company with 409 month_taken, on the month field", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);

      const again = await addMonth(companyId, { month: "2026-09", newCustomers: 99, spendTotalCents: 1 });

      expect(again.status).toBe(409);
      expect(asError(again)).toEqual({
        code: "month_taken",
        message: "Setembro de 2026 já está no diário. Edite o mês em vez de anotar de novo.",
        fields: { month: "Setembro de 2026 já está no diário. Edite o mês em vez de anotar de novo." },
      });
      expect(await countRows()).toBe(1);
      expect((await readDiary(companyId)).entries[0]).toMatchObject({ newCustomers: 10, totalCents: 300_000 });
    });

    it("lets only one of several parallel requests note the same month (RULE-ra-08)", async () => {
      const companyId = await createCompany();

      const responses = await Promise.all(
        Array.from({ length: 6 }, (_unused, index) =>
          addMonth(companyId, { month: "2026-09", newCustomers: index + 1, spendTotalCents: 10_000 * (index + 1) }),
        ),
      );

      expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
      expect(responses.filter((response) => response.status === 409).map((response) => asError(response).code)).toEqual(
        Array(5).fill("month_taken"),
      );
      expect(await countRows(companyId)).toBe(1);
    });
  });

  describe("money in whole cents, with limits (AC-ra-43)", () => {
    const addSpend = (companyId: string, spend: Record<string, unknown>) =>
      addMonth(companyId, { month: "2026-09", newCustomers: 5, ...spend });

    it("accepts R$ 99.999.999,99 in a part and in the total and reads the exact cents back (AC-ra-43)", async () => {
      const companyId = await createCompany();

      const part = await addSpend(companyId, { spendParts: { ads: DIARY_MAX_SPEND_CENTS } });
      expect(part.status).toBe(201);
      expect(asDiary(part).entries[0]).toMatchObject({ spendParts: { ads: 9_999_999_999 }, totalCents: 9_999_999_999 });

      const total = await addMonth(companyId, { month: "2026-08", newCustomers: 1, spendTotalCents: DIARY_MAX_SPEND_CENTS });
      expect(total.status).toBe(201);
      expect(asDiary(total).entries.find((entry) => entry.month === "2026-08")).toMatchObject({
        spendTotalCents: 9_999_999_999,
        cacCents: 9_999_999_999,
      });
      expect(await readDiary(companyId)).toEqual(asDiary(total));
    });

    it("stores the spend as an integer number of cents in the table", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, { month: "2026-09", newCustomers: 2, spendTotalCents: 123_456 });

      const [row] = await db.prisma.$queryRaw<{ kind: string; cents: bigint }[]>`
        SELECT typeof(spend_total_cents) AS kind, spend_total_cents AS cents FROM diary_entries`;

      expect(row.kind).toBe("integer");
      expect(Number(row.cents)).toBe(123_456);
    });

    it.each([
      ["a fraction of a cent in a part", { spendParts: { ads: 100.5 } }, "spendParts.ads", "Informe o valor em centavos inteiros."],
      ["a negative part", { spendParts: { ads: -1 } }, "spendParts.ads", "O valor não pode ser negativo."],
      ["a part above R$ 99.999.999,99", { spendParts: { ads: DIARY_MAX_SPEND_CENTS + 1 } }, "spendParts.ads", "O valor passa de R$ 99.999.999,99."],
      ["a part written as text", { spendParts: { ads: "1000" } }, "spendParts.ads", "Informe um valor em reais."],
      ["a fraction of a cent in the total", { spendTotalCents: 0.5 }, "spendTotalCents", "Informe o valor em centavos inteiros."],
      ["a negative total", { spendTotalCents: -100 }, "spendTotalCents", "O valor não pode ser negativo."],
      ["a total above R$ 99.999.999,99", { spendTotalCents: 10_000_000_000 }, "spendTotalCents", "O valor passa de R$ 99.999.999,99."],
    ])("refuses %s", async (_label, spend, field, message) => {
      const companyId = await createCompany();

      const response = await addSpend(companyId, spend);

      expect(response.status).toBe(400);
      expect(asError(response).code).toBe("validation_failed");
      expect(asError(response).fields?.[field]).toBe(message);
      expect(await countRows()).toBe(0);
    });

    it.each([
      ["a fraction", 2.5, "Informe um número inteiro de clientes."],
      ["a negative count", -1, "O número de clientes não pode ser negativo."],
      ["more than 99.999", DIARY_MAX_NEW_CUSTOMERS + 1, "O número de clientes novos aceita até 99.999."],
    ])("refuses %s of new customers", async (_label, newCustomers, message) => {
      const companyId = await createCompany();

      const response = await addMonth(companyId, { month: "2026-09", newCustomers, spendTotalCents: 10_000 });

      expect(response.status).toBe(400);
      expect(asError(response).fields).toEqual({ newCustomers: message });
      expect(await countRows()).toBe(0);
    });

    it("accepts 99.999 new customers", async () => {
      const companyId = await createCompany();

      const response = await addMonth(companyId, { month: "2026-09", newCustomers: DIARY_MAX_NEW_CUSTOMERS, spendTotalCents: 10_000 });

      expect(response.status).toBe(201);
      expect(asDiary(response).entries[0].newCustomers).toBe(99_999);
    });
  });

  describe("PUT /api/companies/:id/diary/:month", () => {
    it("replaces the values of the month and leaves the month and the other months alone", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);
      await addMonth(companyId, { month: "2026-08", newCustomers: 8, spendTotalCents: 80_000 });

      const response = await send("PUT", diaryPath(companyId, "2026-09"), {
        newCustomers: 20,
        spendParts: { ads: 500_000 },
      });

      expect(response.status).toBe(200);
      expect(asDiary(response).entries).toEqual([
        { month: "2026-09", newCustomers: 20, spendParts: { ads: 500_000 }, spendTotalCents: null, totalCents: 500_000, cacCents: 25_000 },
        { month: "2026-08", newCustomers: 8, spendParts: null, spendTotalCents: 80_000, totalCents: 80_000, cacCents: 10_000 },
      ]);
      expect(await countRows(companyId)).toBe(2);
    });

    it("switches a month from the parts to the total, and back, clearing what it leaves", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);

      const toTotal = await send("PUT", diaryPath(companyId, "2026-09"), { newCustomers: 10, spendTotalCents: 360_000 });
      expect(asDiary(toTotal).entries[0]).toMatchObject({ spendParts: null, spendTotalCents: 360_000, cacCents: 36_000 });
      const stored = await db.prisma.diaryEntry.findFirstOrThrow({ where: { companyId } });
      expect(stored.spendParts).toBeNull();

      const toParts = await send("PUT", diaryPath(companyId, "2026-09"), { newCustomers: 10, spendParts: { tools: 40_000 } });
      expect(asDiary(toParts).entries[0]).toMatchObject({ spendParts: { tools: 40_000 }, spendTotalCents: null });
      const back = await db.prisma.diaryEntry.findFirstOrThrow({ where: { companyId } });
      expect(back.spendTotalCents).toBeNull();
    });

    it("accepts the month in the body only when it is the month of the route (RULE-ra-08)", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);

      const same = await send("PUT", diaryPath(companyId, "2026-09"), { month: "2026-09", newCustomers: 11, spendTotalCents: 1_000 });
      const other = await send("PUT", diaryPath(companyId, "2026-09"), { month: "2026-08", newCustomers: 12, spendTotalCents: 2_000 });

      expect(same.status).toBe(200);
      expect(other.status).toBe(400);
      expect(asError(other).fields).toEqual({ month: "Para mudar o mês, exclua e anote de novo." });
      expect(monthsOf(await readDiary(companyId))).toEqual(["2026-09"]);
      expect((await readDiary(companyId)).entries[0].newCustomers).toBe(11);
    });

    it("applies the same limits and writes nothing when a field is wrong", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);
      const before = await readDiary(companyId);

      const fraction = await send("PUT", diaryPath(companyId, "2026-09"), { newCustomers: 10, spendParts: { ads: 10.5 } });
      const empty = await send("PUT", diaryPath(companyId, "2026-09"), { newCustomers: 10 });
      const noCustomers = await send("PUT", diaryPath(companyId, "2026-09"), { spendTotalCents: 10 });
      const tooMuch = await send("PUT", diaryPath(companyId, "2026-09"), { newCustomers: 10, spendTotalCents: DIARY_MAX_SPEND_CENTS + 1 });

      expect([fraction, empty, noCustomers, tooMuch].map((response) => response.status)).toEqual([400, 400, 400, 400]);
      expect(Object.keys(asError(empty).fields ?? {})).toEqual(["spendParts"]);
      expect(Object.keys(asError(noCustomers).fields ?? {})).toEqual(["newCustomers"]);
      expect(await readDiary(companyId)).toEqual(before);
    });

    it("answers 404 diary_month_not_found for a month that was never noted, and does not create it", async () => {
      const companyId = await createCompany();

      const response = await send("PUT", diaryPath(companyId, "2026-09"), { newCustomers: 5, spendTotalCents: 1_000 });
      const garbage = await send("PUT", diaryPath(companyId, "not-a-month"), { newCustomers: 5, spendTotalCents: 1_000 });

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diary_month_not_found");
      expect(garbage.status).toBe(404);
      expect(await countRows()).toBe(0);
    });

    it("answers 404 company_not_found for a company that does not exist", async () => {
      const response = await send("PUT", diaryPath("nobody", "2026-09"), { newCustomers: 5, spendTotalCents: 1_000 });

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
    });

    it("does not touch a month of another company", async () => {
      const first = await createCompany("Academia Foco");
      const second = await createCompany("Estúdio Ritmo");
      await addMonth(first, SEPTEMBER_PARTS);

      const response = await send("PUT", diaryPath(second, "2026-09"), { newCustomers: 1, spendTotalCents: 1 });

      expect(response.status).toBe(404);
      expect((await readDiary(first)).entries[0].newCustomers).toBe(10);
    });
  });

  describe("DELETE /api/companies/:id/diary/:month", () => {
    it("removes the month and answers the diary without it", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);
      await addMonth(companyId, { month: "2026-08", newCustomers: 8, spendTotalCents: 80_000 });

      const response = await send("DELETE", diaryPath(companyId, "2026-09"));

      expect(response.status).toBe(200);
      expect(monthsOf(asDiary(response))).toEqual(["2026-08"]);
      expect(asDiary(response).progress.count).toBe(1);
      expect(await countRows(companyId)).toBe(1);
    });

    it("lets the same month be noted again after it was deleted", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);
      await send("DELETE", diaryPath(companyId, "2026-09"));

      const again = await addMonth(companyId, { month: "2026-09", newCustomers: 3, spendTotalCents: 9_000 });

      expect(again.status).toBe(201);
      expect(asDiary(again).entries[0]).toMatchObject({ newCustomers: 3, totalCents: 9_000 });
    });

    it("answers 404 diary_month_not_found for a month that is not there, and 404 company_not_found for no company", async () => {
      const companyId = await createCompany();

      const missing = await send("DELETE", diaryPath(companyId, "2026-09"));
      const noCompany = await send("DELETE", diaryPath("nobody", "2026-09"));

      expect(missing.status).toBe(404);
      expect(asError(missing).code).toBe("diary_month_not_found");
      expect(noCompany.status).toBe(404);
      expect(asError(noCompany).code).toBe("company_not_found");
    });

    it("does not delete the month of another company", async () => {
      const first = await createCompany("Academia Foco");
      const second = await createCompany("Estúdio Ritmo");
      await addMonth(first, SEPTEMBER_PARTS);

      const response = await send("DELETE", diaryPath(second, "2026-09"));

      expect(response.status).toBe(404);
      expect(await countRows(first)).toBe(1);
    });
  });

  describe("when the company is deleted", () => {
    it("removes the diary with it", async () => {
      const companyId = await createCompany();
      await addMonth(companyId, SEPTEMBER_PARTS);
      expect((await send("POST", `/api/companies/${companyId}/archive`)).status).toBe(200);

      const response = await send("DELETE", `/api/companies/${companyId}`);

      expect(response.status).toBeLessThan(300);
      expect(await countRows()).toBe(0);
    });
  });
});
