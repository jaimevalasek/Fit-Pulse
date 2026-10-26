import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DIMENSIONS, getStage } from "../../shared/content/stageContent.ts";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis.ts";
import {
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type ActionKey,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type DiagnosisInput,
  type DiagnosisResult,
  type DimensionKey,
  type LockKey,
  type Rules,
  type StageNumber,
} from "../../shared/domain/types.ts";
import { MONEY_MAX_CENTS } from "../../shared/format/money.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { createApp } from "../../server/app.ts";
import { createPrismaClient } from "../../server/db/prismaClient.ts";
import type { PrismaClient } from "../../server/generated/prisma/client.ts";
import { rulesV2 } from "../fixtures/rulesV2.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-003: the diagnosis routes. Covers the draft per company and the pre-fill (AC-dm-13,
// RULE-dm-13), the discard that keeps completed ones (AC-dm-16), the pending blocks
// (AC-dm-14), the result frozen with its rules version (AC-dm-22, RULE-dm-11) and the
// assistant summary after a real completion (RULE-dm-17) and the action tracking a new
// conclusion inherits from the previous plan (AC-ra-31, RULE-ra-05).

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

// Declares JSON on every write, as requireJsonWrites demands (415 otherwise), even for the
// POSTs without a body (start, complete). It does not check that the browser client sends the
// same header on those: src/api/httpClient.ts has to.
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

interface DiagnosisBody {
  id: string;
  companyId: string;
  status: "draft" | "completed";
  answers: Answers;
  calculator: CalculatorInput;
  currentBlock: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  rulesVersion: number | null;
  result: DiagnosisResult | null;
  previous: { stage: StageNumber; completedAt: string } | null;
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string>; pendingBlocks?: number[] };
}

const asDiagnosis = (response: ApiResponse): DiagnosisBody => response.body as DiagnosisBody;
const asError = (response: ApiResponse): ErrorBody["error"] => (response.body as ErrorBody).error;

// -------------------------------------------------- reference cases (PRD G1 to G4)

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

const G1: DiagnosisInput = {
  answers: answersOf(1, { mp1: null, mp3: null, cm1: null, mm1: null, co1: null }),
  calculator: {
    ...EMPTY_CALCULATOR,
    spendMode: "unknown",
    newCustomersMode: "range",
    newCustomersRange: "from11To30",
    averagePurchaseCents: 4_500,
    purchasesPerYear: "twoToThree",
    relationshipLength: "oneToTwoYears",
    marginPercent: 40,
  },
};

const G2_ANSWERS: Answers = {
  mp1: 2, mp2: 2, mp3: 2, mp4: 2,
  pc1: 3, pc2: 2, pc3: 2,
  cm1: 2, cm2: 2,
  mm1: 2, mm2: 2,
  es1: 1,
  aq1: 3, aq2: 2, aq3: 2,
  en1: 2, en2: 2, en3: 2,
  co1: 2, co2: 2, co3: 2,
  re1: 2, re2: 0, re3: 1,
};

const G2: DiagnosisInput = {
  answers: G2_ANSWERS,
  calculator: {
    ...EMPTY_CALCULATOR,
    spendMode: "exact",
    spendParts: { ads: 200_000, agency: 100_000, commission: 54_000 },
    newCustomersMode: "exact",
    newCustomers: 59,
    averagePurchaseCents: 4_800,
    purchasesPerYear: "sevenToTwelve",
    relationshipLength: "oneToTwoYears",
    marginPercent: 40,
  },
};

const G3_ANSWERS: Answers = {
  mp1: 3, mp2: 3, mp3: 2, mp4: 3,
  pc1: 2, pc2: 3, pc3: 2,
  cm1: 3, cm2: 3,
  mm1: 2, mm2: 3,
  es1: 2,
  aq1: 3, aq2: 3, aq3: 2,
  en1: 3, en2: 2, en3: 3,
  co1: 2, co2: 2, co3: 2,
  re1: 3, re2: 2, re3: 3,
};

const G3_CALCULATOR: CalculatorInput = {
  ...EMPTY_CALCULATOR,
  spendMode: "exact",
  spendParts: { ads: 2_000_000, agency: 400_000 },
  newCustomersMode: "exact",
  newCustomers: 80,
  averagePurchaseCents: 45_000,
  purchasesPerYear: "twoToThree",
  relationshipLength: "twoToFourYears",
  marginPercent: 55,
};

const G3: DiagnosisInput = { answers: G3_ANSWERS, calculator: G3_CALCULATOR };

const G4: DiagnosisInput = {
  answers: answersOf(3, { pc1: 2 }),
  calculator: {
    ...EMPTY_CALCULATOR,
    spendMode: "exact",
    spendParts: { ads: 3_000_000 },
    newCustomersMode: "exact",
    newCustomers: 100,
    averagePurchaseCents: 20_000,
    purchasesPerYear: "fourToSix",
    relationshipLength: "twoToFourYears",
    marginPercent: 50,
  },
};

// "Produto e canal" at 67: stage 3 under rules v1 (needs 60) and stage 2 under the test rules v2 (needs 70).
const G3_PC_67: DiagnosisInput = { answers: { ...G3_ANSWERS, pc1: 2, pc2: 2, pc3: 2 }, calculator: G3_CALCULATOR };

interface ReferenceCase {
  name: string;
  input: DiagnosisInput;
  stage: StageNumber;
  lock: LockKey | null;
  weakest: DimensionKey;
  plan: ActionKey[];
}

const REFERENCE_CASES: ReferenceCase[] = [
  { name: "G1", input: G1, stage: 1, lock: "cac", weakest: "cm", plan: ["cac", "mp", "mm"] },
  { name: "G2", input: G2, stage: 2, lock: "re", weakest: "re", plan: ["re", "dep", "mp"] },
  { name: "G3", input: G3, stage: 3, lock: "co", weakest: "co", plan: ["co", "invest", "pc"] },
  { name: "G4", input: G4, stage: 4, lock: null, weakest: "pc", plan: ["invest", "pc", "mp"] },
];

// The engine result as the API returns it: plain data that went through JSON.
function viaJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("diagnosis routes", () => {
  let db: TestDatabase;
  let server: RunningServer;

  const get = (path: string) => callApi(server.baseUrl, "GET", path);
  const send = (method: string, path: string, body?: unknown) => callApi(server.baseUrl, method, path, body);

  async function createCompany(name = "Academia Foco"): Promise<string> {
    const response = await send("POST", "/api/companies", {
      name,
      segment: "health_wellness",
      salesChannel: "subscription",
    });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function startDraft(companyId: string): Promise<DiagnosisBody> {
    const response = await send("POST", `/api/companies/${companyId}/diagnoses`);
    expect([200, 201]).toContain(response.status);
    return asDiagnosis(response);
  }

  async function fill(diagnosisId: string, input: DiagnosisInput): Promise<DiagnosisBody> {
    const response = await send("PATCH", `/api/diagnoses/${diagnosisId}`, input);
    expect(response.status).toBe(200);
    return asDiagnosis(response);
  }

  // The path the owner takes: start, answer everything, conclude.
  async function conclude(companyId: string, input: DiagnosisInput): Promise<DiagnosisBody> {
    const draft = await startDraft(companyId);
    await fill(draft.id, input);
    const response = await send("POST", `/api/diagnoses/${draft.id}/complete`);
    expect(response.status).toBe(200);
    return asDiagnosis(response);
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

  // A second app on the same database file, as after closing and opening the app again:
  // it has its own connection and, if given, its own rules version.
  async function startNewAppSession(options: { rules?: Rules } = {}): Promise<RunningServer> {
    const prisma = createPrismaClient(db.databaseUrl);
    const session = await startServer(createApp({ prisma, now: db.now, downloadsDir: db.downloadsDir, ...options }));
    return {
      baseUrl: session.baseUrl,
      close: async () => {
        await session.close();
        await prisma.$disconnect();
      },
    };
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
    db.setNow(new Date("2026-10-23T12:00:00.000Z"));
  });

  describe("POST /api/companies/:id/diagnoses", () => {
    it("creates an empty draft with the whole IF-003 shape for a company without history", async () => {
      const companyId = await createCompany();
      const response = await send("POST", `/api/companies/${companyId}/diagnoses`);

      expect(response.status).toBe(201);
      expect(asDiagnosis(response)).toEqual({
        id: expect.any(String),
        companyId,
        status: "draft",
        answers: {},
        calculator: EMPTY_CALCULATOR,
        currentBlock: 1,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        completedAt: null,
        rulesVersion: null,
        result: null,
        previous: null,
      });
    });

    it("answers 404 company_not_found for a company that does not exist", async () => {
      const response = await send("POST", "/api/companies/nao-existe/diagnoses");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
      expect(await db.prisma.diagnosis.count()).toBe(0);
    });

    it("returns the open draft instead of creating another one (AC-dm-13, RULE-dm-13)", async () => {
      const companyId = await createCompany();
      const first = await send("POST", `/api/companies/${companyId}/diagnoses`);
      await fill(asDiagnosis(first).id, { answers: { mp2: 2 }, calculator: EMPTY_CALCULATOR });

      const second = await send("POST", `/api/companies/${companyId}/diagnoses`);

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect(asDiagnosis(second).id).toBe(asDiagnosis(first).id);
      expect(asDiagnosis(second).answers).toEqual({ mp2: 2 });
      expect(await db.prisma.diagnosis.count({ where: { companyId } })).toBe(1);
    });

    it("ends with a single draft when several starts arrive at the same time (RULE-dm-13)", async () => {
      const companyId = await createCompany();

      const responses = await Promise.all(
        Array.from({ length: 6 }, () => send("POST", `/api/companies/${companyId}/diagnoses`)),
      );

      expect(new Set(responses.map((response) => asDiagnosis(response).id)).size).toBe(1);
      expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
      expect(await db.prisma.diagnosis.count({ where: { companyId, status: "draft" } })).toBe(1);
    });

    it("pre-fills the new draft with the answers and the calculator of the last completed one (AC-dm-13)", async () => {
      const companyId = await createCompany();
      const completed = await conclude(companyId, G2);

      const response = await send("POST", `/api/companies/${companyId}/diagnoses`);
      const draft = asDiagnosis(response);

      expect(response.status).toBe(201);
      expect(draft.id).not.toBe(completed.id);
      expect(draft.status).toBe("draft");
      expect(draft.answers).toEqual(G2.answers);
      expect(draft.calculator).toEqual(G2.calculator);
      expect(draft.currentBlock).toBe(1);
      expect(draft.result).toBeNull();
      expect(draft.rulesVersion).toBeNull();
      expect(draft.previous).toEqual({ stage: 2, completedAt: completed.completedAt });
    });

    it("pre-fills from the newest completed diagnosis, not an older one", async () => {
      const companyId = await createCompany();
      await conclude(companyId, G2);
      db.setNow(new Date("2026-11-23T12:00:00.000Z"));
      await conclude(companyId, G4);

      const draft = asDiagnosis(await send("POST", `/api/companies/${companyId}/diagnoses`));

      expect(draft.answers).toEqual(G4.answers);
      expect(draft.calculator).toEqual(G4.calculator);
      expect(draft.previous?.stage).toBe(4);
    });

    it("ignores an archived diagnosis when it pre-fills", async () => {
      const companyId = await createCompany();
      const completed = await conclude(companyId, G2);
      await db.prisma.diagnosis.update({ where: { id: completed.id }, data: { archivedAt: new Date() } });

      const draft = asDiagnosis(await send("POST", `/api/companies/${companyId}/diagnoses`));

      expect(draft.answers).toEqual({});
      expect(draft.calculator).toEqual(EMPTY_CALCULATOR);
      expect(draft.previous).toBeNull();
    });

    it("keeps one company's data out of another company's draft", async () => {
      const first = await createCompany("Academia Foco");
      const second = await createCompany("Studio Pulso");
      await conclude(first, G2);

      const draft = asDiagnosis(await send("POST", `/api/companies/${second}/diagnoses`));

      expect(draft.answers).toEqual({});
      expect(draft.previous).toBeNull();
    });
  });

  describe("the diary in block 1 of a new draft (AC-ra-44, AC-ra-45, AC-ra-46, AC-ra-47)", () => {
    interface DiaryMonth {
      month: string;
      newCustomers: number;
      spendParts?: Record<string, number>;
      spendTotalCents?: number;
    }

    const JULY: DiaryMonth = { month: "2026-07", newCustomers: 99, spendParts: { ads: 9_900_000 } };
    const AUGUST: DiaryMonth = { month: "2026-08", newCustomers: 10, spendParts: { ads: 200_000, agency: 100_000 } };
    const SEPTEMBER: DiaryMonth = { month: "2026-09", newCustomers: 12, spendParts: { ads: 250_000, tools: 50_000 } };
    const OCTOBER: DiaryMonth = { month: "2026-10", newCustomers: 18, spendParts: { ads: 300_000, agency: 150_000 } };

    async function note(companyId: string, ...months: DiaryMonth[]): Promise<void> {
      for (const month of months) {
        const response = await send("POST", `/api/companies/${companyId}/diary`, month);
        expect(response.status, `diary ${month.month}`).toBe(201);
      }
    }

    const draftOf = async (companyId: string) => asDiagnosis(await send("POST", `/api/companies/${companyId}/diagnoses`));
    const storedCalculator = async (diagnosisId: string) =>
      (await db.prisma.diagnosis.findUniqueOrThrow({ where: { id: diagnosisId } })).calculator as Record<string, unknown>;

    // What the owner still has to fill when the diary gave the cost: the answers all in the middle and the rest of block 1.
    const REST_OF_THE_DIAGNOSIS = {
      answers: answersOf(2),
      calculator: { averagePurchaseCents: 20_000, purchasesPerYear: "fourToSix", relationshipLength: "twoToFourYears", marginPercent: 50 },
    };

    async function finish(diagnosisId: string): Promise<DiagnosisBody> {
      expect((await send("PATCH", `/api/diagnoses/${diagnosisId}`, REST_OF_THE_DIAGNOSIS)).status).toBe(200);
      const response = await send("POST", `/api/diagnoses/${diagnosisId}/complete`);
      expect(response.status).toBe(200);
      return asDiagnosis(response);
    }

    describe("3 months or more", () => {
      it("fills spend and new customers with the sum of the 3 most recent months, marked as measured (AC-ra-44)", async () => {
        const companyId = await createCompany();
        await note(companyId, JULY, AUGUST, SEPTEMBER, OCTOBER);

        const response = await send("POST", `/api/companies/${companyId}/diagnoses`);
        const draft = asDiagnosis(response);
        const measured = { origin: "measured", fromMonth: "2026-08", toMonth: "2026-10", monthCount: 3 };

        expect(response.status).toBe(201);
        expect(draft.calculator).toEqual({
          ...EMPTY_CALCULATOR,
          spendMode: "exact",
          spendParts: { ads: 750_000, agency: 250_000, tools: 50_000 },
          spendTotalCents: null,
          newCustomersMode: "exact",
          newCustomers: 40,
          diarySource: { spend: measured, newCustomers: measured },
          diarySuggestion: null,
        });
      });

      it("shows the spend as a single total when one of the 3 months only has the total, and the panel adds up the same (AC-ra-44)", async () => {
        const companyId = await createCompany();
        await note(companyId, { month: "2026-08", newCustomers: 10, spendTotalCents: 450_000 }, SEPTEMBER, OCTOBER);

        const draft = await draftOf(companyId);

        expect(draft.calculator).toMatchObject({
          spendMode: "exact",
          spendParts: {},
          spendTotalCents: 450_000 + 300_000 + 450_000,
          newCustomers: 40,
        });
        const completed = await finish(draft.id);
        // R$ 12.000,00 over 40 new customers, counted as measured for the cost and the confidence.
        expect(completed.result?.unitEconomics).toMatchObject({ cacCents: 30_000, origin: "measured" });
        expect(completed.result?.confidence.level).toBe("high");
      });

      it("keeps the answers and the rest of block 1 from the last completed diagnosis; only the numbers change origin (AC-ra-47)", async () => {
        const companyId = await createCompany();
        const completed = await conclude(companyId, G2);
        await note(companyId, AUGUST, SEPTEMBER, OCTOBER);

        const draft = await draftOf(companyId);

        expect(draft.answers).toEqual(G2.answers);
        expect(draft.calculator).toMatchObject({
          spendParts: { ads: 750_000, agency: 250_000, tools: 50_000 },
          newCustomers: 40,
          averagePurchaseCents: G2.calculator.averagePurchaseCents,
          purchasesPerYear: G2.calculator.purchasesPerYear,
          relationshipLength: G2.calculator.relationshipLength,
          marginPercent: G2.calculator.marginPercent,
        });
        expect(draft.previous).toEqual({ stage: 2, completedAt: completed.completedAt });
      });

      it("does not carry the diary marks of the last diagnosis into a draft whose numbers no longer come from the diary", async () => {
        const companyId = await createCompany();
        await note(companyId, AUGUST, SEPTEMBER, OCTOBER);
        const first = await finish((await draftOf(companyId)).id);
        expect(first.calculator.diarySource).toBeDefined();
        await db.prisma.diaryEntry.deleteMany({ where: { companyId } });
        db.setNow(new Date("2026-11-23T12:00:00.000Z"));

        const draft = await draftOf(companyId);

        expect(draft.calculator.spendParts).toEqual(first.calculator.spendParts);
        expect(draft.calculator.newCustomers).toBe(40);
        expect(draft.calculator.diarySource).toBeUndefined();
        expect(draft.calculator.diarySuggestion).toBeUndefined();
      });

      it("says where the cost per customer came from once concluded (AC-ra-46)", async () => {
        const companyId = await createCompany();
        await note(companyId, AUGUST, SEPTEMBER, OCTOBER);

        const completed = await finish((await draftOf(companyId)).id);
        const reread = asDiagnosis(await get(`/api/diagnoses/${completed.id}`));

        expect(reread.calculator.diarySource?.spend).toMatchObject({ origin: "measured", fromMonth: "2026-08", toMonth: "2026-10" });
        expect(reread.calculator.diarySource?.newCustomers?.origin).toBe("measured");
        // R$ 10.500,00 over 40 new customers.
        expect(reread.result?.unitEconomics).toMatchObject({ cacCents: 26_250, origin: "measured" });
      });
    });

    describe("1 or 2 months", () => {
      it("leaves block 1 as in the first version and keeps the average times 3 aside as a suggestion (AC-ra-45)", async () => {
        const companyId = await createCompany();
        await note(companyId, SEPTEMBER, OCTOBER);

        const response = await send("POST", `/api/companies/${companyId}/diagnoses`);
        const draft = asDiagnosis(response);

        expect(response.status).toBe(201);
        expect(draft.calculator).toEqual({
          ...EMPTY_CALCULATOR,
          diarySuggestion: {
            monthCount: 2,
            fromMonth: "2026-09",
            toMonth: "2026-10",
            // (250.000 + 300.000) x 3 / 2, 150.000 x 3 / 2, 50.000 x 3 / 2 and (12 + 18) x 3 / 2
            spendParts: { ads: 825_000, agency: 225_000, tools: 75_000 },
            spendTotalCents: null,
            newCustomers: 45,
          },
        });
      });

      it("projects a single month to 3", async () => {
        const companyId = await createCompany();
        await note(companyId, OCTOBER);

        const draft = await draftOf(companyId);

        expect(draft.calculator.diarySuggestion).toMatchObject({
          monthCount: 1,
          spendParts: { ads: 900_000, agency: 450_000 },
          newCustomers: 54,
        });
      });

      it("projects the total as a single value when one of the months only has the total", async () => {
        const companyId = await createCompany();
        await note(companyId, { month: "2026-09", newCustomers: 10, spendTotalCents: 300_000 }, OCTOBER);

        const draft = await draftOf(companyId);

        // (300.000 + 450.000) x 3 / 2
        expect(draft.calculator.diarySuggestion).toMatchObject({ spendParts: {}, spendTotalCents: 1_125_000, newCustomers: 42 });
      });

      it("'Usar o diário' fills the numbers and marks them as estimated, so the cost and the confidence count as estimated (AC-ra-45)", async () => {
        const companyId = await createCompany();
        await note(companyId, SEPTEMBER, OCTOBER);
        const draft = await draftOf(companyId);

        const response = await send("POST", `/api/diagnoses/${draft.id}/diary-suggestion`);
        const applied = asDiagnosis(response);
        const estimated = { origin: "estimated", fromMonth: "2026-09", toMonth: "2026-10", monthCount: 2 };

        expect(response.status).toBe(200);
        expect(applied.id).toBe(draft.id);
        expect(applied.calculator).toMatchObject({
          spendMode: "exact",
          spendParts: { ads: 825_000, agency: 225_000, tools: 75_000 },
          newCustomersMode: "exact",
          newCustomers: 45,
          diarySource: { spend: estimated, newCustomers: estimated },
        });
        const completed = await finish(draft.id);
        // R$ 11.250,00 over 45 customers; with every answer known the confidence would be high, but an estimate caps it.
        expect(completed.result?.unitEconomics).toMatchObject({ cacCents: 25_000, origin: "estimated" });
        expect(completed.result?.confidence.level).toBe("medium");
      });

      it("applies the suggestion's single total when a month only had the total", async () => {
        const companyId = await createCompany();
        await note(companyId, { month: "2026-09", newCustomers: 10, spendTotalCents: 300_000 }, OCTOBER);
        const draft = await draftOf(companyId);

        const applied = asDiagnosis(await send("POST", `/api/diagnoses/${draft.id}/diary-suggestion`));

        expect(applied.calculator).toMatchObject({ spendMode: "exact", spendParts: {}, spendTotalCents: 1_125_000, newCustomers: 42 });
      });

      it("changes only the diary numbers: the answers and the rest of block 1 stay", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G2);
        await note(companyId, OCTOBER);
        const draft = await draftOf(companyId);

        const applied = asDiagnosis(await send("POST", `/api/diagnoses/${draft.id}/diary-suggestion`));

        expect(applied.answers).toEqual(G2.answers);
        expect(applied.calculator).toMatchObject({
          spendParts: { ads: 900_000, agency: 450_000 },
          newCustomers: 54,
          averagePurchaseCents: G2.calculator.averagePurchaseCents,
          marginPercent: G2.calculator.marginPercent,
        });
      });

      it("can be applied again after the numbers were typed over, which brings the suggestion back", async () => {
        const companyId = await createCompany();
        await note(companyId, OCTOBER);
        const draft = await draftOf(companyId);
        await send("POST", `/api/diagnoses/${draft.id}/diary-suggestion`);
        const typed = asDiagnosis(await send("PATCH", `/api/diagnoses/${draft.id}`, { calculator: { newCustomers: 7 } }));
        expect(typed.calculator.diarySource?.newCustomers).toBeUndefined();

        const again = asDiagnosis(await send("POST", `/api/diagnoses/${draft.id}/diary-suggestion`));

        expect(again.calculator.newCustomers).toBe(54);
        expect(again.calculator.diarySource?.newCustomers?.origin).toBe("estimated");
      });
    });

    describe("without months", () => {
      it("is the draft of the first version: no marks and no suggestion", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G2);

        const draft = await draftOf(companyId);

        expect(draft.calculator).toEqual(G2.calculator);
        expect(draft.calculator.diarySource).toBeUndefined();
        expect(draft.calculator.diarySuggestion).toBeUndefined();
      });

      it("only counts the months of its own company", async () => {
        const mine = await createCompany("Academia Foco");
        const other = await createCompany("Studio Pulso");
        await note(other, AUGUST, SEPTEMBER, OCTOBER);

        const draft = await draftOf(mine);

        expect(draft.calculator).toEqual(EMPTY_CALCULATOR);
      });
    });

    describe("the owner corrects a number from the diary (AC-ra-46)", () => {
      async function measuredDraft(): Promise<DiagnosisBody> {
        const companyId = await createCompany();
        await note(companyId, AUGUST, SEPTEMBER, OCTOBER);
        return draftOf(companyId);
      }

      it("loses the mark of the number typed over and keeps the mark of the other", async () => {
        const draft = await measuredDraft();

        const typed = asDiagnosis(await send("PATCH", `/api/diagnoses/${draft.id}`, { calculator: { newCustomers: 33 } }));

        expect(typed.calculator.newCustomers).toBe(33);
        expect(typed.calculator.diarySource?.newCustomers).toBeUndefined();
        expect(typed.calculator.diarySource?.spend).toMatchObject({ origin: "measured", monthCount: 3 });
      });

      it("loses the mark of the spend when a part is changed, and then follows the first version's rule", async () => {
        const draft = await measuredDraft();

        const typed = asDiagnosis(await send("PATCH", `/api/diagnoses/${draft.id}`, { calculator: { spendParts: { ads: 1_000_000 } } }));
        const marks = typed.calculator.diarySource;
        const completed = await finish(draft.id);

        expect(typed.calculator.spendParts).toEqual({ ads: 1_000_000 });
        expect(marks?.spend).toBeUndefined();
        expect(marks?.newCustomers?.origin).toBe("measured");
        // A typed spend is measured too; the mark only says where each number came from.
        expect(completed.result?.unitEconomics.origin).toBe("measured");
        expect(completed.calculator.diarySource?.spend).toBeUndefined();
      });

      it("keeps the marks when the same numbers are sent again, like an autosave of the whole block", async () => {
        const draft = await measuredDraft();

        const saved = asDiagnosis(
          await send("PATCH", `/api/diagnoses/${draft.id}`, {
            calculator: { spendMode: "exact", spendParts: draft.calculator.spendParts, newCustomers: 40, marginPercent: 45 },
          }),
        );

        expect(saved.calculator.marginPercent).toBe(45);
        expect(saved.calculator.diarySource?.spend?.origin).toBe("measured");
        expect(saved.calculator.diarySource?.newCustomers?.origin).toBe("measured");
      });

      it("loses both marks when the owner chooses another way to inform the numbers", async () => {
        const draft = await measuredDraft();

        const typed = asDiagnosis(
          await send("PATCH", `/api/diagnoses/${draft.id}`, { calculator: { spendMode: "unknown", newCustomersMode: "unknown" } }),
        );

        expect(typed.calculator.diarySource).toBeUndefined();
      });

      it("refuses the marks and the suggestion when they come from the client", async () => {
        const draft = await measuredDraft();
        const mark = { origin: "measured", fromMonth: "2026-08", toMonth: "2026-10", monthCount: 3 };
        const before = await storedCalculator(draft.id);

        for (const calculator of [
          { diarySource: { spend: mark } },
          { diarySuggestion: null },
          { diarySuggestion: { monthCount: 1, fromMonth: "2026-10", toMonth: "2026-10", spendParts: {}, spendTotalCents: null, newCustomers: 1 } },
        ]) {
          const response = await send("PATCH", `/api/diagnoses/${draft.id}`, { calculator });
          expect(response.status).toBe(400);
        }
        expect(await storedCalculator(draft.id)).toEqual(before);
      });

      it("accepts the single spend total from the client and keeps it in the draft", async () => {
        const draft = await measuredDraft();

        const response = await send("PATCH", `/api/diagnoses/${draft.id}`, {
          calculator: { spendParts: {}, spendTotalCents: 900_000 },
        });

        expect(response.status).toBe(200);
        expect(asDiagnosis(response).calculator).toMatchObject({ spendParts: {}, spendTotalCents: 900_000 });
        expect(asDiagnosis(response).calculator.diarySource?.spend).toBeUndefined();
        expect((await send("PATCH", `/api/diagnoses/${draft.id}`, { calculator: { spendTotalCents: -1 } })).status).toBe(400);
      });
    });

    describe("changing the diary later (AC-ra-46)", () => {
      it("does not change a draft that already exists, nor its marks", async () => {
        const companyId = await createCompany();
        await note(companyId, AUGUST, SEPTEMBER, OCTOBER);
        const draft = await draftOf(companyId);

        await send("PUT", `/api/companies/${companyId}/diary/2026-10`, { newCustomers: 500, spendParts: { ads: 1 } });
        await send("DELETE", `/api/companies/${companyId}/diary/2026-08`);
        await note(companyId, JULY);

        const reread = asDiagnosis(await get(`/api/diagnoses/${draft.id}`));
        expect(reread.calculator).toEqual(draft.calculator);
        // Asking for the draft again returns the same one: the diary is not applied a second time.
        expect(asDiagnosis(await send("POST", `/api/companies/${companyId}/diagnoses`)).calculator).toEqual(draft.calculator);
      });

      it("does not change a suggestion already kept in the draft", async () => {
        const companyId = await createCompany();
        await note(companyId, OCTOBER);
        const draft = await draftOf(companyId);

        await send("PUT", `/api/companies/${companyId}/diary/2026-10`, { newCustomers: 500, spendParts: { ads: 1 } });
        const applied = asDiagnosis(await send("POST", `/api/diagnoses/${draft.id}/diary-suggestion`));

        expect(applied.calculator).toMatchObject({ spendParts: { ads: 900_000, agency: 450_000 }, newCustomers: 54 });
      });

      it("does not change a completed diagnosis, nor its result", async () => {
        const companyId = await createCompany();
        await note(companyId, AUGUST, SEPTEMBER, OCTOBER);
        const completed = await finish((await draftOf(companyId)).id);

        await send("PUT", `/api/companies/${companyId}/diary/2026-10`, { newCustomers: 500, spendParts: { ads: 1 } });
        await send("DELETE", `/api/companies/${companyId}/diary/2026-09`);

        const reread = asDiagnosis(await get(`/api/diagnoses/${completed.id}`));
        expect(reread.calculator).toEqual(completed.calculator);
        expect(reread.result).toEqual(completed.result);
      });
    });

    describe("a backup (IF-009)", () => {
      it("restores the diary marks and the suggestion of the diagnoses it saved (AC-ra-46)", async () => {
        const measuredCompany = await createCompany("Academia Foco");
        await note(measuredCompany, AUGUST, SEPTEMBER, OCTOBER);
        const completed = await finish((await draftOf(measuredCompany)).id);
        const suggestedCompany = await createCompany("Studio Pulso");
        await note(suggestedCompany, SEPTEMBER, OCTOBER);
        const draft = await draftOf(suggestedCompany);
        expect(completed.calculator.diarySource).toBeDefined();
        expect(draft.calculator.diarySuggestion).toBeTruthy();
        const saved = await send("POST", "/api/backup/export");
        expect(saved.status).toBe(200);
        const file = JSON.parse(readFileSync(path.join(db.downloadsDir, (saved.body as { fileName: string }).fileName), "utf8"));
        await db.resetData();

        const restored = await send("POST", "/api/backup/import", file);

        expect(restored.status, JSON.stringify(restored.body)).toBe(200);
        expect(asDiagnosis(await get(`/api/diagnoses/${completed.id}`)).calculator).toEqual(completed.calculator);
        expect(asDiagnosis(await get(`/api/diagnoses/${draft.id}`)).calculator).toEqual(draft.calculator);
      });
    });

    describe("POST /api/diagnoses/:id/diary-suggestion: refusals (IF-007)", () => {
      it("answers 409 no_diary_suggestion when the draft was filled with 3 months, and changes nothing", async () => {
        const companyId = await createCompany();
        await note(companyId, AUGUST, SEPTEMBER, OCTOBER);
        const draft = await draftOf(companyId);

        const response = await send("POST", `/api/diagnoses/${draft.id}/diary-suggestion`);

        expect(response.status).toBe(409);
        expect(asError(response).code).toBe("no_diary_suggestion");
        expect(asDiagnosis(await get(`/api/diagnoses/${draft.id}`)).calculator).toEqual(draft.calculator);
      });

      it("answers 409 no_diary_suggestion when the company has no month", async () => {
        const draft = await startDraft(await createCompany());

        const response = await send("POST", `/api/diagnoses/${draft.id}/diary-suggestion`);

        expect(response.status).toBe(409);
        expect(asError(response).code).toBe("no_diary_suggestion");
      });

      it("answers 409 diagnosis_not_draft for a completed diagnosis", async () => {
        const completed = await conclude(await createCompany(), G2);

        const response = await send("POST", `/api/diagnoses/${completed.id}/diary-suggestion`);

        expect(response.status).toBe(409);
        expect(asError(response).code).toBe("diagnosis_not_draft");
      });

      it("answers 404 diagnosis_not_found for an unknown diagnosis", async () => {
        const response = await send("POST", "/api/diagnoses/nao-existe/diary-suggestion");

        expect(response.status).toBe(404);
        expect(asError(response).code).toBe("diagnosis_not_found");
      });
    });
  });

  describe("GET /api/diagnoses/:id", () => {
    it("reads the draft back and answers 404 diagnosis_not_found for an unknown id", async () => {
      const draft = await startDraft(await createCompany());

      const found = await get(`/api/diagnoses/${draft.id}`);
      const missing = await get("/api/diagnoses/nao-existe");

      expect(found.status).toBe(200);
      expect(asDiagnosis(found)).toEqual(draft);
      expect(missing.status).toBe(404);
      expect(asError(missing).code).toBe("diagnosis_not_found");
    });
  });

  describe("PATCH /api/diagnoses/:id", () => {
    it("saves answers and calculator values and gives them back after a restart (AC-dm-12)", async () => {
      const draft = await startDraft(await createCompany());
      db.setNow(new Date("2026-10-23T12:05:00.000Z"));

      const response = await send("PATCH", `/api/diagnoses/${draft.id}`, {
        answers: { mp1: 2, mp3: null },
        calculator: {
          spendMode: "exact",
          spendParts: { ads: 150_000, tools: 9_990 },
          newCustomersMode: "range",
          newCustomersRange: "from11To30",
          averagePurchaseCents: 12_345,
          marginPercent: 35,
        },
        currentBlock: 3,
      });

      expect(response.status).toBe(200);
      const saved = asDiagnosis(response);
      expect(saved.answers).toEqual({ mp1: 2, mp3: null });
      expect(saved.calculator).toEqual({
        ...EMPTY_CALCULATOR,
        spendMode: "exact",
        spendParts: { ads: 150_000, tools: 9_990 },
        newCustomersMode: "range",
        newCustomersRange: "from11To30",
        averagePurchaseCents: 12_345,
        marginPercent: 35,
      });
      expect(saved.currentBlock).toBe(3);
      expect(saved.updatedAt).not.toBe(draft.updatedAt);

      const restartedServer = await startNewAppSession();
      try {
        const reopened = await callApi(restartedServer.baseUrl, "GET", `/api/diagnoses/${draft.id}`);
        expect(asDiagnosis(reopened)).toEqual(saved);
      } finally {
        await restartedServer.close();
      }
    });

    it("changes only the keys it carries", async () => {
      const draft = await startDraft(await createCompany());
      await send("PATCH", `/api/diagnoses/${draft.id}`, {
        answers: { mp1: 1, pc1: 3 },
        calculator: { marginPercent: 40, averagePurchaseCents: 5_000 },
        currentBlock: 4,
      });

      const response = await send("PATCH", `/api/diagnoses/${draft.id}`, {
        answers: { pc1: 0, pc2: 2 },
        calculator: { marginPercent: 45 },
      });

      const saved = asDiagnosis(response);
      expect(saved.answers).toEqual({ mp1: 1, pc1: 0, pc2: 2 });
      expect(saved.calculator.marginPercent).toBe(45);
      expect(saved.calculator.averagePurchaseCents).toBe(5_000);
      expect(saved.currentBlock).toBe(4);
    });

    it("replaces the cost parts as a whole and clears a field sent as null", async () => {
      const draft = await startDraft(await createCompany());
      await fill(draft.id, {
        answers: {},
        calculator: { ...EMPTY_CALCULATOR, spendMode: "exact", spendParts: { ads: 100_000, agency: 50_000 }, marginPercent: 30 },
      });

      const response = await send("PATCH", `/api/diagnoses/${draft.id}`, {
        calculator: { spendParts: { ads: 0 }, marginPercent: null },
      });

      const saved = asDiagnosis(response);
      expect(saved.calculator.spendParts).toEqual({ ads: 0 });
      expect(saved.calculator.marginPercent).toBeNull();
      expect(saved.calculator.spendMode).toBe("exact");
    });

    it("does not lose answers when autosaves arrive at the same time", async () => {
      const draft = await startDraft(await createCompany());
      const ids = QUESTION_IDS.filter((id) => id !== "mp1");

      const responses = await Promise.all(
        ids.map((id) => send("PATCH", `/api/diagnoses/${draft.id}`, { answers: { [id]: 2 } })),
      );

      expect(responses.every((response) => response.status === 200)).toBe(true);
      const stored = asDiagnosis(await get(`/api/diagnoses/${draft.id}`));
      expect(Object.keys(stored.answers).sort()).toEqual([...ids].sort());
    });

    it("accepts an empty patch without changing the content", async () => {
      const draft = await startDraft(await createCompany());
      await send("PATCH", `/api/diagnoses/${draft.id}`, { answers: { mp2: 1 } });

      const response = await send("PATCH", `/api/diagnoses/${draft.id}`, {});

      expect(response.status).toBe(200);
      expect(asDiagnosis(response).answers).toEqual({ mp2: 1 });
    });

    const REFUSED_PATCHES: Array<[string, unknown, string]> = [
      ["an answer above 3", { answers: { mp2: 4 } }, "answers.mp2"],
      ["a negative answer", { answers: { mp2: -1 } }, "answers.mp2"],
      ["a fractional answer", { answers: { mp2: 1.5 } }, "answers.mp2"],
      ["a text answer", { answers: { mp2: "2" } }, "answers.mp2"],
      ["null where the catalog has no \"não sei\"", { answers: { pc1: null } }, "answers.pc1"],
      ["a question that is not in the bank", { answers: { zz9: 1 } }, "answers.zz9"],
      ["answers that are not an object", { answers: [1, 2] }, "answers"],
      ["a negative amount", { calculator: { averagePurchaseCents: -1 } }, "calculator.averagePurchaseCents"],
      ["a fractional amount of cents", { calculator: { averagePurchaseCents: 10.5 } }, "calculator.averagePurchaseCents"],
      ["an amount above the ceiling", { calculator: { averagePurchaseCents: MONEY_MAX_CENTS + 1 } }, "calculator.averagePurchaseCents"],
      ["an amount sent as text", { calculator: { averagePurchaseCents: "12,50" } }, "calculator.averagePurchaseCents"],
      ["a negative cost part", { calculator: { spendParts: { ads: -5 } } }, "calculator.spendParts.ads"],
      ["an unknown cost part", { calculator: { spendParts: { rent: 5 } } }, "calculator.spendParts"],
      ["negative new customers", { calculator: { newCustomers: -1 } }, "calculator.newCustomers"],
      ["fractional new customers", { calculator: { newCustomers: 2.5 } }, "calculator.newCustomers"],
      ["new customers above one million", { calculator: { newCustomers: 1_000_001 } }, "calculator.newCustomers"],
      ["a margin above 100", { calculator: { marginPercent: 101 } }, "calculator.marginPercent"],
      ["a negative margin", { calculator: { marginPercent: -1 } }, "calculator.marginPercent"],
      ["a fractional margin", { calculator: { marginPercent: 50.5 } }, "calculator.marginPercent"],
      ["an unknown spend range", { calculator: { spendRange: "enorme" } }, "calculator.spendRange"],
      ["an unknown entry mode", { calculator: { spendMode: "chute" } }, "calculator.spendMode"],
      ["an unknown purchases-per-year option", { calculator: { purchasesPerYear: "daily" } }, "calculator.purchasesPerYear"],
      ["an unknown relationship length", { calculator: { relationshipLength: "forever" } }, "calculator.relationshipLength"],
      ["block 0", { currentBlock: 0 }, "currentBlock"],
      ["block 9", { currentBlock: 9 }, "currentBlock"],
      ["a fractional block", { currentBlock: 2.5 }, "currentBlock"],
      ["a block sent as text", { currentBlock: "2" }, "currentBlock"],
    ];

    it.each(REFUSED_PATCHES)("refuses %s with 400 and saves nothing", async (_name, patch, field) => {
      const draft = await startDraft(await createCompany());
      await send("PATCH", `/api/diagnoses/${draft.id}`, { answers: { mp2: 1 } });

      const response = await send("PATCH", `/api/diagnoses/${draft.id}`, patch);

      expect(response.status).toBe(400);
      expect(asError(response).code).toBe("validation_failed");
      expect(Object.keys(asError(response).fields ?? {})).toContain(field);
      const stored = asDiagnosis(await get(`/api/diagnoses/${draft.id}`));
      expect(stored.answers).toEqual({ mp2: 1 });
      expect(stored.calculator).toEqual(EMPTY_CALCULATOR);
      expect(stored.currentBlock).toBe(1);
    });

    it("refuses a key that would complete or rewrite the diagnosis from outside", async () => {
      const draft = await startDraft(await createCompany());

      for (const patch of [
        { status: "completed" },
        { result: { stage: 4 } },
        { stage: 4 },
        { rulesVersion: 9 },
        { companyId: "outra" },
      ]) {
        const response = await send("PATCH", `/api/diagnoses/${draft.id}`, patch);
        expect(response.status).toBe(400);
      }
      const stored = asDiagnosis(await get(`/api/diagnoses/${draft.id}`));
      expect(stored).toMatchObject({ status: "draft", result: null, rulesVersion: null });
    });

    it("accepts the edges of the allowed ranges", async () => {
      const draft = await startDraft(await createCompany());

      const response = await send("PATCH", `/api/diagnoses/${draft.id}`, {
        answers: { mp2: 0, pc1: 3 },
        calculator: {
          spendParts: { ads: 0, agency: MONEY_MAX_CENTS },
          newCustomers: 1_000_000,
          averagePurchaseCents: 0,
          marginPercent: 100,
        },
        currentBlock: 8,
      });

      expect(response.status).toBe(200);
      expect(asDiagnosis(response).calculator.newCustomers).toBe(1_000_000);
      expect(asDiagnosis(response).currentBlock).toBe(8);
    });

    it("answers 404 diagnosis_not_found for an unknown diagnosis", async () => {
      const response = await send("PATCH", "/api/diagnoses/nao-existe", { currentBlock: 2 });

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diagnosis_not_found");
    });

    it("keeps the readable answers when the stored row also holds keys that no longer validate", async () => {
      const draft = await startDraft(await createCompany());
      // What an older build or a removed question could have left in the row.
      await db.prisma.diagnosis.update({
        where: { id: draft.id },
        data: {
          answers: { mp1: null, mp2: 2, pc1: 9, mp3: "x", zz9: 1 },
          calculator: { marginPercent: 40, spendMode: "bogus", retired: 7, newCustomers: -3 },
        },
      });

      const shown = asDiagnosis(await get(`/api/diagnoses/${draft.id}`));
      expect(shown.answers).toEqual({ mp1: null, mp2: 2 });
      expect(shown.calculator).toEqual({ ...EMPTY_CALCULATOR, marginPercent: 40 });

      const saved = asDiagnosis(await send("PATCH", `/api/diagnoses/${draft.id}`, { answers: { pc2: 3 } }));
      expect(saved.answers).toEqual({ mp1: null, mp2: 2, pc2: 3 });
      expect(saved.calculator.marginPercent).toBe(40);
      const stored = await db.prisma.diagnosis.findUniqueOrThrow({ where: { id: draft.id } });
      expect(stored.answers).toEqual({ mp1: null, mp2: 2, pc2: 3 });
      expect(stored.calculator).toEqual({ marginPercent: 40 });
    });

    it("reads a row whose stored JSON is not an object as empty and lets the next save rebuild it", async () => {
      const draft = await startDraft(await createCompany());
      await db.prisma.diagnosis.update({
        where: { id: draft.id },
        data: { answers: ["mp1"], calculator: "broken" },
      });

      expect(asDiagnosis(await get(`/api/diagnoses/${draft.id}`)).answers).toEqual({});
      const saved = asDiagnosis(await send("PATCH", `/api/diagnoses/${draft.id}`, { answers: { mp2: 1 } }));
      expect(saved.answers).toEqual({ mp2: 1 });
      expect(saved.calculator).toEqual(EMPTY_CALCULATOR);
    });

    it("answers 409 diagnosis_not_draft for a completed diagnosis and leaves it as it was", async () => {
      const completed = await conclude(await createCompany(), G2);

      const response = await send("PATCH", `/api/diagnoses/${completed.id}`, { answers: { mp2: 0 } });

      expect(response.status).toBe(409);
      expect(asError(response).code).toBe("diagnosis_not_draft");
      expect(asDiagnosis(await get(`/api/diagnoses/${completed.id}`))).toEqual(completed);
    });
  });

  describe("DELETE /api/diagnoses/:id", () => {
    it("removes only the discarded draft and keeps the completed diagnoses (AC-dm-16)", async () => {
      const companyId = await createCompany();
      const completed = await conclude(companyId, G2);
      const draft = await startDraft(companyId);

      const response = await send("DELETE", `/api/diagnoses/${draft.id}`);

      expect(response.status).toBe(204);
      expect((await get(`/api/diagnoses/${draft.id}`)).status).toBe(404);
      expect(asDiagnosis(await get(`/api/diagnoses/${completed.id}`))).toEqual(completed);
      const company = (await get(`/api/companies/${companyId}`)).body as { draftId: string | null; completedCount: number };
      expect(company).toMatchObject({ draftId: null, completedCount: 1 });
      const stored = await withFreshConnection((prisma) => prisma.diagnosis.findMany({ select: { id: true } }));
      expect(stored.map((row) => row.id)).toEqual([completed.id]);
    });

    it("does not touch the drafts of other companies", async () => {
      const first = await startDraft(await createCompany("Academia Foco"));
      const second = await startDraft(await createCompany("Studio Pulso"));

      await send("DELETE", `/api/diagnoses/${first.id}`);

      expect((await get(`/api/diagnoses/${second.id}`)).status).toBe(200);
    });

    it("lets the company start again after a discard, pre-filled from the last completed one", async () => {
      const companyId = await createCompany();
      await conclude(companyId, G4);
      const draft = await startDraft(companyId);
      await send("PATCH", `/api/diagnoses/${draft.id}`, { answers: { mp2: 0 } });
      await send("DELETE", `/api/diagnoses/${draft.id}`);

      const restarted = await send("POST", `/api/companies/${companyId}/diagnoses`);

      expect(restarted.status).toBe(201);
      expect(asDiagnosis(restarted).id).not.toBe(draft.id);
      expect(asDiagnosis(restarted).answers).toEqual(G4.answers);
    });

    it("answers 409 diagnosis_not_draft for a completed diagnosis and removes nothing", async () => {
      const completed = await conclude(await createCompany(), G2);

      const response = await send("DELETE", `/api/diagnoses/${completed.id}`);

      expect(response.status).toBe(409);
      expect(asError(response).code).toBe("diagnosis_not_draft");
      expect(asDiagnosis(await get(`/api/diagnoses/${completed.id}`))).toEqual(completed);
    });

    it("answers 404 diagnosis_not_found for an unknown diagnosis", async () => {
      const response = await send("DELETE", "/api/diagnoses/nao-existe");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diagnosis_not_found");
    });
  });

  describe("POST /api/diagnoses/:id/complete: pending blocks (AC-dm-14)", () => {
    it("lists every block of an empty draft with 422 incomplete and concludes nothing", async () => {
      const draft = await startDraft(await createCompany());

      const response = await send("POST", `/api/diagnoses/${draft.id}/complete`);

      expect(response.status).toBe(422);
      expect(asError(response).code).toBe("incomplete");
      expect(asError(response).pendingBlocks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(asDiagnosis(await get(`/api/diagnoses/${draft.id}`))).toMatchObject({
        status: "draft",
        result: null,
        rulesVersion: null,
        completedAt: null,
      });
      expect(await db.prisma.diagnosis.count({ where: { status: "completed" } })).toBe(0);
    });

    const PENDING_CASES: Array<[string, DiagnosisInput, number[]]> = [
      ["one unanswered question", { ...G2, answers: { ...G2.answers, aq2: undefined } }, [5]],
      [
        "unanswered questions in two blocks",
        { ...G2, answers: { ...G2.answers, en1: undefined, re3: undefined } },
        [6, 8],
      ],
      ["a calculator without the margin", { ...G2, calculator: { ...G2.calculator, marginPercent: null } }, [1]],
      [
        "a calculator with exact spend but no cost typed",
        { ...G2, calculator: { ...G2.calculator, spendParts: {} } },
        [1],
      ],
      ["a questionnaire without the calculator", { answers: G2.answers, calculator: EMPTY_CALCULATOR }, [1]],
      ["a calculator without the questionnaire", { answers: {}, calculator: G2.calculator }, [2, 3, 4, 5, 6, 7, 8]],
    ];

    it.each(PENDING_CASES)("names the pending blocks for %s", async (_name, input, expected) => {
      const draft = await startDraft(await createCompany());
      await fill(draft.id, input);

      const response = await send("POST", `/api/diagnoses/${draft.id}/complete`);

      expect(response.status).toBe(422);
      expect(asError(response).pendingBlocks).toEqual(expected);
      expect(asDiagnosis(await get(`/api/diagnoses/${draft.id}`)).status).toBe("draft");
    });

    it("answers 404 diagnosis_not_found for an unknown diagnosis", async () => {
      const response = await send("POST", "/api/diagnoses/nao-existe/complete");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diagnosis_not_found");
    });
  });

  describe("POST /api/diagnoses/:id/complete: the frozen result (AC-dm-22, RULE-dm-11)", () => {
    it.each(REFERENCE_CASES)("$name: stores the engine result, the rules version, the stage and the date", async (c) => {
      const companyId = await createCompany();
      db.setNow(new Date("2026-10-23T15:30:00.000Z"));

      const completed = await conclude(companyId, c.input);

      const expected = viaJson(evaluateDiagnosis(c.input, rulesV1));
      expect(completed.status).toBe("completed");
      expect(completed.rulesVersion).toBe(1);
      expect(completed.completedAt).toBe("2026-10-23T15:30:00.000Z");
      expect(completed.result).toEqual(expected);
      expect(completed.result).toMatchObject({
        rulesVersion: 1,
        stage: c.stage,
        lock: c.lock,
        weakestDimension: c.weakest,
        plan: c.plan,
      });
      expect(completed.answers).toEqual(c.input.answers);
      expect(completed.calculator).toEqual(c.input.calculator);

      const row = await withFreshConnection((prisma) => prisma.diagnosis.findUnique({ where: { id: completed.id } }));
      expect(row).toMatchObject({
        status: "completed",
        rulesVersion: 1,
        stage: c.stage,
        completedAt: new Date("2026-10-23T15:30:00.000Z"),
      });
      expect(row?.result).toEqual(expected);
    });

    it("reads the same completed diagnosis back from a new request", async () => {
      const completed = await conclude(await createCompany(), G3);

      expect(asDiagnosis(await get(`/api/diagnoses/${completed.id}`))).toEqual(completed);
    });

    it("returns the stored result on a second call, without calculating again", async () => {
      const completed = await conclude(await createCompany(), G3);
      db.setNow(new Date("2026-12-01T09:00:00.000Z"));

      const again = await send("POST", `/api/diagnoses/${completed.id}/complete`);

      expect(again.status).toBe(200);
      expect(asDiagnosis(again)).toEqual(completed);
      expect(asDiagnosis(again).completedAt).toBe("2026-10-23T12:00:00.000Z");
    });

    it("concludes once when two requests conclude the same draft at the same time", async () => {
      const companyId = await createCompany();
      const draft = await startDraft(companyId);
      await fill(draft.id, G2);

      const responses = await Promise.all([
        send("POST", `/api/diagnoses/${draft.id}/complete`),
        send("POST", `/api/diagnoses/${draft.id}/complete`),
        send("POST", `/api/diagnoses/${draft.id}/complete`),
      ]);

      expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
      expect(new Set(responses.map((response) => JSON.stringify(response.body))).size).toBe(1);
      expect(await db.prisma.diagnosis.count({ where: { companyId, status: "completed" } })).toBe(1);
    });

    it("keeps the result when the app starts later with other rules", async () => {
      const companyId = await createCompany();
      const completed = await conclude(companyId, G3_PC_67);
      expect(completed.rulesVersion).toBe(1);
      expect(completed.result?.stage).toBe(3);

      // The app is updated: same database, a new rules version.
      const upgradedServer = await startNewAppSession({ rules: rulesV2 });
      try {
        const reopened = await callApi(upgradedServer.baseUrl, "GET", `/api/diagnoses/${completed.id}`);
        const concludedAgain = await callApi(upgradedServer.baseUrl, "POST", `/api/diagnoses/${completed.id}/complete`);

        expect(asDiagnosis(reopened)).toEqual(completed);
        expect(asDiagnosis(concludedAgain)).toEqual(completed);
        expect(asDiagnosis(reopened).result?.stage).toBe(3);
        expect(asDiagnosis(reopened).rulesVersion).toBe(1);

        // A new diagnosis from the same answers is calculated with the new rules and says so.
        db.setNow(new Date("2026-11-23T12:00:00.000Z"));
        const draft = asDiagnosis(await callApi(upgradedServer.baseUrl, "POST", `/api/companies/${companyId}/diagnoses`));
        expect(draft.answers).toEqual(G3_PC_67.answers);
        const next = asDiagnosis(await callApi(upgradedServer.baseUrl, "POST", `/api/diagnoses/${draft.id}/complete`));
        expect(next.rulesVersion).toBe(2);
        expect(next.result?.rulesVersion).toBe(2);
        expect(next.result?.stage).toBe(2);
        expect(next.previous).toEqual({ stage: 3, completedAt: completed.completedAt });
        expect(next.result).toEqual(viaJson(evaluateDiagnosis(G3_PC_67, rulesV2)));

        const first = await callApi(upgradedServer.baseUrl, "GET", `/api/diagnoses/${completed.id}`);
        expect(asDiagnosis(first)).toEqual(completed);
      } finally {
        await upgradedServer.close();
      }

      const rows = await withFreshConnection((prisma) =>
        prisma.diagnosis.findMany({ select: { id: true, rulesVersion: true, stage: true }, orderBy: { rulesVersion: "asc" } }),
      );
      expect(rows.map((row) => [row.rulesVersion, row.stage])).toEqual([
        [1, 3],
        [2, 2],
      ]);
    });

    it("links a completed diagnosis to the one before it, never to itself or to a later one", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      db.setNow(new Date("2026-11-23T12:00:00.000Z"));
      const second = await conclude(companyId, G2);
      db.setNow(new Date("2026-12-23T12:00:00.000Z"));
      const third = await conclude(companyId, G4);

      expect(first.previous).toBeNull();
      expect(second.previous).toEqual({ stage: 1, completedAt: first.completedAt });
      expect(third.previous).toEqual({ stage: 2, completedAt: second.completedAt });
      expect(asDiagnosis(await get(`/api/diagnoses/${second.id}`)).previous).toEqual(second.previous);
    });

    it("makes the concluded diagnosis read-only", async () => {
      const completed = await conclude(await createCompany(), G2);

      const response = await send("PATCH", `/api/diagnoses/${completed.id}`, { answers: { re1: 0 } });

      expect(response.status).toBe(409);
      expect(asDiagnosis(await get(`/api/diagnoses/${completed.id}`)).result).toEqual(completed.result);
    });
  });

  describe("POST /api/diagnoses/:id/complete: the action plan tracking (AC-ra-31, RULE-ra-05)", () => {
    interface TrackedAction {
      actionKey: string;
      status: string;
      dueDate: string | null;
      ownerRole: string | null;
      note: string | null;
      inheritedFrom: { diagnosisId: string; completedAt: string } | null;
    }

    const actionsOf = async (diagnosisId: string) =>
      (await get(`/api/diagnoses/${diagnosisId}/actions`)).body as { isCurrent: boolean; actions: TrackedAction[] };

    const track = (diagnosisId: string, actionKey: string, patch: Record<string, unknown>) =>
      send("PATCH", `/api/diagnoses/${diagnosisId}/actions/${actionKey}`, patch);

    const tracked = (actions: TrackedAction[], actionKey: string): TrackedAction => {
      const action = actions.find((candidate) => candidate.actionKey === actionKey);
      expect(action, `action ${actionKey}`).toBeDefined();
      return action as TrackedAction;
    };

    const rowsOf = (diagnosisId: string) =>
      db.prisma.actionProgress.findMany({ where: { diagnosisId }, orderBy: { actionKey: "asc" } });

    const NEXT_MONTH = new Date("2026-11-23T12:00:00.000Z");
    const IN_TWO_MONTHS = new Date("2026-12-23T12:00:00.000Z");

    it("creates the 3 rows of the first plan, 'A fazer' and continuing from nothing", async () => {
      const first = await conclude(await createCompany(), G1);

      const rows = await rowsOf(first.id);
      const view = await actionsOf(first.id);

      expect(rows).toHaveLength(3);
      expect(rows.every((row) => row.status === "todo" && row.dueDate === null && row.ownerRole === null && row.note === null)).toBe(true);
      expect(rows.every((row) => row.inheritedFromId === null)).toBe(true);
      expect(view.actions.map((action) => action.actionKey)).toEqual(first.result?.plan);
      expect(view.actions.every((action) => action.inheritedFrom === null)).toBe(true);
    });

    it("keeps the tracking of the action that repeats, starts the new ones at 'A fazer' and leaves the others closed in the earlier plan", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      expect(first.result?.plan).toEqual(["cac", "mp", "mm"]);
      await track(first.id, "cac", { status: "done" });
      await track(first.id, "mp", { status: "in_progress", dueDate: "2026-12-01", ownerRole: "sales_team", note: "Treinar a equipe" });
      db.setNow(NEXT_MONTH);

      const second = await conclude(companyId, G2);

      expect(second.result?.plan).toEqual(["re", "dep", "mp"]);
      const current = await actionsOf(second.id);
      expect(current.isCurrent).toBe(true);
      expect(current.actions.map((action) => action.actionKey)).toEqual(["re", "dep", "mp"]);
      expect(tracked(current.actions, "mp")).toMatchObject({
        status: "in_progress",
        dueDate: "2026-12-01",
        ownerRole: "sales_team",
        note: "Treinar a equipe",
        inheritedFrom: { diagnosisId: first.id, completedAt: first.completedAt },
      });
      for (const newAction of ["re", "dep"]) {
        expect(tracked(current.actions, newAction)).toMatchObject({
          status: "todo",
          dueDate: null,
          ownerRole: null,
          note: null,
          inheritedFrom: null,
        });
      }
      // The ones that do not repeat stay closed on the earlier diagnosis, as they ended.
      const closed = await actionsOf(first.id);
      expect(closed.isCurrent).toBe(false);
      expect(closed.actions.map((action) => [action.actionKey, action.status])).toEqual([
        ["cac", "done"],
        ["mp", "in_progress"],
        ["mm", "todo"],
      ]);
      // No action appears twice in the current plan.
      expect(new Set(current.actions.map((action) => action.actionKey)).size).toBe(3);
      expect(await rowsOf(second.id)).toHaveLength(3);
    });

    it("carries an action through several diagnoses, always from the one right before", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      await track(first.id, "mp", { status: "in_progress", note: "Primeira nota" });
      db.setNow(NEXT_MONTH);
      const second = await conclude(companyId, G2);
      await track(second.id, "mp", { status: "done", note: "Segunda nota" });
      db.setNow(IN_TWO_MONTHS);

      const third = await conclude(companyId, G4);

      expect(third.result?.plan).toEqual(["invest", "pc", "mp"]);
      const view = await actionsOf(third.id);
      expect(tracked(view.actions, "mp")).toMatchObject({
        status: "done",
        note: "Segunda nota",
        inheritedFrom: { diagnosisId: second.id, completedAt: second.completedAt },
      });
      expect(tracked(view.actions, "invest").inheritedFrom).toBeNull();
      expect(tracked(view.actions, "pc").inheritedFrom).toBeNull();
    });

    it("shows a repeated action as continuing, with 'A fazer', when the earlier diagnosis was concluded before the tracking existed", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      await db.prisma.actionProgress.deleteMany({ where: { diagnosisId: first.id } });
      db.setNow(NEXT_MONTH);

      const second = await conclude(companyId, G2);

      const view = await actionsOf(second.id);
      expect(tracked(view.actions, "mp")).toMatchObject({
        status: "todo",
        inheritedFrom: { diagnosisId: first.id, completedAt: first.completedAt },
      });
      expect(await rowsOf(first.id)).toHaveLength(0);
    });

    it("compares with the last diagnosis that is not archived", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      await track(first.id, "mp", { status: "in_progress", note: "Do primeiro" });
      db.setNow(NEXT_MONTH);
      const second = await conclude(companyId, G2);
      await track(second.id, "mp", { status: "done", note: "Do segundo" });
      expect((await send("POST", `/api/diagnoses/${second.id}/archive`)).status).toBe(200);
      db.setNow(IN_TWO_MONTHS);

      const third = await conclude(companyId, G4);

      const view = await actionsOf(third.id);
      expect(tracked(view.actions, "mp")).toMatchObject({
        status: "in_progress",
        note: "Do primeiro",
        inheritedFrom: { diagnosisId: first.id, completedAt: first.completedAt },
      });
    });

    it("keeps what the owner tracked when the same conclusion is asked again, and creates no row", async () => {
      const companyId = await createCompany();
      const draft = await startDraft(companyId);
      await fill(draft.id, G1);
      expect((await send("POST", `/api/diagnoses/${draft.id}/complete`)).status).toBe(200);
      await track(draft.id, "mp", { status: "done" });

      const again = await send("POST", `/api/diagnoses/${draft.id}/complete`);

      expect(again.status).toBe(200);
      expect(await rowsOf(draft.id)).toHaveLength(3);
      expect(tracked((await actionsOf(draft.id)).actions, "mp").status).toBe("done");
    });

    it("creates no row when the conclusion is refused for missing answers", async () => {
      const companyId = await createCompany();
      const draft = await startDraft(companyId);

      const response = await send("POST", `/api/diagnoses/${draft.id}/complete`);

      expect(response.status).toBe(422);
      expect(await rowsOf(draft.id)).toHaveLength(0);
    });

    it("applies the inheritance once when two requests conclude the same draft at the same time", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      await track(first.id, "mp", { status: "in_progress", ownerRole: "owner" });
      db.setNow(NEXT_MONTH);
      const draft = await startDraft(companyId);
      await fill(draft.id, G2);

      const responses = await Promise.all([
        send("POST", `/api/diagnoses/${draft.id}/complete`),
        send("POST", `/api/diagnoses/${draft.id}/complete`),
      ]);

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(await rowsOf(draft.id)).toHaveLength(3);
      expect(tracked((await actionsOf(draft.id)).actions, "mp")).toMatchObject({
        status: "in_progress",
        ownerRole: "owner",
        inheritedFrom: { diagnosisId: first.id },
      });
    });

    it("gives each company the tracking of its own earlier diagnosis when they conclude at the same time", async () => {
      const one = await createCompany("Academia Foco");
      const other = await createCompany("Studio Pulso");
      const oneFirst = await conclude(one, G1);
      const otherFirst = await conclude(other, G1);
      await track(oneFirst.id, "mp", { status: "done" });
      await track(otherFirst.id, "mp", { status: "in_progress" });
      db.setNow(NEXT_MONTH);
      const oneDraft = await startDraft(one);
      const otherDraft = await startDraft(other);
      await fill(oneDraft.id, G2);
      await fill(otherDraft.id, G2);

      await Promise.all([
        send("POST", `/api/diagnoses/${oneDraft.id}/complete`),
        send("POST", `/api/diagnoses/${otherDraft.id}/complete`),
      ]);

      expect(tracked((await actionsOf(oneDraft.id)).actions, "mp")).toMatchObject({
        status: "done",
        inheritedFrom: { diagnosisId: oneFirst.id },
      });
      expect(tracked((await actionsOf(otherDraft.id)).actions, "mp")).toMatchObject({
        status: "in_progress",
        inheritedFrom: { diagnosisId: otherFirst.id },
      });
    });
  });

  describe("GET /api/assistant/summary after a real conclusion (RULE-dm-17)", () => {
    it("lists the concluded company with its stage, the weakest dimension and the date, and nothing else", async () => {
      const companyId = await createCompany("Academia Foco");
      db.setNow(new Date("2026-10-23T16:45:00.000Z"));
      const completed = await conclude(companyId, G2);
      expect(completed.result?.weakestDimension).toBe("re");

      const response = await get("/api/assistant/summary");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        companies: [
          {
            name: "Academia Foco",
            stage: 2,
            stageName: getStage(2).name,
            lockingDimension: DIMENSIONS.re.name,
            lastDiagnosisAt: "2026-10-23T16:45:00.000Z",
          },
        ],
      });
      // No answer, no amount of money and no plan reaches the assistant.
      const text = JSON.stringify(response.body);
      for (const forbidden of ["answers", "calculator", "spend", "marginPercent", "54000", "plan", "risks"]) {
        expect(text).not.toContain(forbidden);
      }
    });

    it("leaves out a company that only has a draft and follows the newest conclusion", async () => {
      const concluded = await createCompany("Academia Foco");
      const drafting = await createCompany("Studio Pulso");
      await startDraft(drafting);
      await conclude(concluded, G1);
      db.setNow(new Date("2026-11-23T12:00:00.000Z"));
      await conclude(concluded, G4);

      const response = await get("/api/assistant/summary");

      expect((response.body as { companies: Array<{ name: string; stage: number; lockingDimension: string }> }).companies).toEqual([
        expect.objectContaining({ name: "Academia Foco", stage: 4, lockingDimension: DIMENSIONS.pc.name }),
      ]);
    });
  });
});
