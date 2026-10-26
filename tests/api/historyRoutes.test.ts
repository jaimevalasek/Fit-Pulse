import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { questionsOfBlock } from "../../shared/content/questionBank.ts";
import type { DiagnosisComparison } from "../../shared/domain/compareDiagnoses.ts";
import {
  DIMENSION_KEYS,
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type DiagnosisInput,
  type DiagnosisResult,
  type Rules,
  type StageNumber,
} from "../../shared/domain/types.ts";
import { createApp } from "../../server/app.ts";
import { createPrismaClient } from "../../server/db/prismaClient.ts";
import type { TimelineEntry, TimelineView } from "../../server/services/historyService.ts";
import { rulesV2 } from "../fixtures/rulesV2.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-005: the history routes. Covers the timeline of a company (AC-dm-30), archiving and
// restoring a completed diagnosis, the first diagnosis that offers no comparison (BR-dm-08) and
// the comparison with the previous one, recalculated when the rules version changed
// (AC-dm-31, RULE-dm-11, BR-dm-07).

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

// Declares JSON on every write, as requireJsonWrites demands, even for the POSTs without a body.
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
  status: "draft" | "completed";
  rulesVersion: number | null;
  result: DiagnosisResult | null;
  previous: { stage: StageNumber; completedAt: string } | null;
}

interface ErrorBody {
  error: { code: string; message: string };
}

const asTimeline = (response: ApiResponse): TimelineView => response.body as TimelineView;
const asEntry = (response: ApiResponse): TimelineEntry => response.body as TimelineEntry;
const asComparison = (response: ApiResponse): DiagnosisComparison => response.body as DiagnosisComparison;
const asDiagnosis = (response: ApiResponse): DiagnosisBody => response.body as DiagnosisBody;
const asError = (response: ApiResponse): ErrorBody["error"] => (response.body as ErrorBody).error;

// -------------------------------------------------- answers (PRD reference cases)

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// G1: stage 1, scores 17 / 33 / 11 / 17 / 33 / 33 / 22 / 33, risks SIG-01 and SIG-05.
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
const G1_SCORES = [17, 33, 11, 17, 33, 33, 22, 33];

// G3 with "Produto e canal" at 67: stage 3 under rules v1 (needs 60), stage 2 under the test rules v2 (needs 70).
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
const G3_PC_67: DiagnosisInput = {
  answers: {
    mp1: 3, mp2: 3, mp3: 2, mp4: 3,
    pc1: 2, pc2: 2, pc3: 2,
    cm1: 3, cm2: 3,
    mm1: 2, mm2: 3,
    es1: 2,
    aq1: 3, aq2: 3, aq3: 2,
    en1: 3, en2: 2, en3: 3,
    co1: 2, co2: 2, co3: 2,
    re1: 3, re2: 2, re3: 3,
  },
  calculator: G3_CALCULATOR,
};

// Answers in between, with the numbers of G1: a third, different diagnosis.
const MID: DiagnosisInput = { answers: answersOf(2), calculator: G1.calculator };

const APRIL = new Date("2026-04-14T12:00:00.000Z");
const JULY = new Date("2026-07-08T12:00:00.000Z");
const OCTOBER = new Date("2026-10-23T12:00:00.000Z");

describe("history routes", () => {
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

  // The path the owner takes, on the day `at`: start, answer everything, conclude.
  async function conclude(companyId: string, input: DiagnosisInput, at: Date): Promise<DiagnosisBody> {
    db.setNow(at);
    const draft = await startDraft(companyId);
    expect((await send("PATCH", `/api/diagnoses/${draft.id}`, input)).status).toBe(200);
    const response = await send("POST", `/api/diagnoses/${draft.id}/complete`);
    expect(response.status).toBe(200);
    return asDiagnosis(response);
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
    server = await startServer(createApp({ ...db, backendPort: 4324 }));
  });

  afterAll(async () => {
    await server.close();
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
    db.setNow(OCTOBER);
  });

  describe("GET /api/companies/:id/timeline", () => {
    it("is empty for a company that never started a diagnosis", async () => {
      const companyId = await createCompany();
      const response = await get(`/api/companies/${companyId}/timeline`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ draft: null, completed: [], archived: [] });
    });

    it("answers 404 company_not_found for a company that does not exist", async () => {
      const response = await get("/api/companies/not-a-company/timeline");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
    });

    it("shows the open draft with how many blocks are done", async () => {
      const companyId = await createCompany();
      const draft = await startDraft(companyId);
      const blockTwo = Object.fromEntries(questionsOfBlock(2).map((question) => [question.id, 2]));
      await send("PATCH", `/api/diagnoses/${draft.id}`, {
        calculator: G1.calculator,
        answers: blockTwo,
        currentBlock: 3,
      });

      const { body } = await get(`/api/companies/${companyId}/timeline`);

      expect(body).toEqual({
        draft: {
          id: draft.id,
          currentBlock: 3,
          completedBlocks: 2,
          totalBlocks: 8,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        completed: [],
        archived: [],
      });
    });

    it("lists the concluded diagnoses newest first with stage, rules version and confidence", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1, APRIL);
      const second = await conclude(companyId, G3_PC_67, OCTOBER);

      const timeline = asTimeline(await get(`/api/companies/${companyId}/timeline`));

      expect(timeline.draft).toBeNull();
      expect(timeline.archived).toEqual([]);
      expect(timeline.completed).toEqual([
        {
          id: second.id,
          companyId,
          completedAt: OCTOBER.toISOString(),
          archivedAt: null,
          stage: 3,
          rulesVersion: 1,
          confidence: second.result?.confidence.level,
          canCompare: true,
        },
        {
          id: first.id,
          companyId,
          completedAt: APRIL.toISOString(),
          archivedAt: null,
          stage: 1,
          rulesVersion: 1,
          confidence: first.result?.confidence.level,
          canCompare: false,
        },
      ]);
    });

    it("keeps a draft and the concluded diagnoses side by side", async () => {
      const companyId = await createCompany();
      const concluded = await conclude(companyId, G1, APRIL);
      db.setNow(OCTOBER);
      const draft = await startDraft(companyId);

      const timeline = asTimeline(await get(`/api/companies/${companyId}/timeline`));

      expect(timeline.draft?.id).toBe(draft.id);
      expect(timeline.completed.map((entry) => entry.id)).toEqual([concluded.id]);
    });

    it("only shows the diagnoses of the company asked for", async () => {
      const mine = await createCompany("Academia Foco");
      const other = await createCompany("Padaria Sol");
      await conclude(mine, G1, APRIL);
      await conclude(other, G3_PC_67, JULY);

      const timeline = asTimeline(await get(`/api/companies/${mine}/timeline`));

      expect(timeline.completed).toHaveLength(1);
      expect(timeline.completed[0]?.stage).toBe(1);
    });
  });

  describe("POST /api/diagnoses/:id/archive and /restore", () => {
    it("moves a concluded diagnosis to the archived list and back, keeping everything it holds", async () => {
      const companyId = await createCompany();
      const diagnosis = await conclude(companyId, G1, APRIL);
      // Archiving is a save, so `updatedAt` moves; everything the owner answered and the result must not.
      const stored = async () => {
        const { updatedAt: _updatedAt, ...content } = (await get(`/api/diagnoses/${diagnosis.id}`)).body as DiagnosisBody & {
          updatedAt: string;
        };
        return content;
      };
      const before = await stored();

      db.setNow(OCTOBER);
      const archived = await send("POST", `/api/diagnoses/${diagnosis.id}/archive`);
      expect(archived.status).toBe(200);
      expect(asEntry(archived)).toMatchObject({ id: diagnosis.id, archivedAt: OCTOBER.toISOString(), stage: 1 });

      const whileArchived = asTimeline(await get(`/api/companies/${companyId}/timeline`));
      expect(whileArchived.completed).toEqual([]);
      expect(whileArchived.archived.map((entry) => entry.id)).toEqual([diagnosis.id]);

      const restored = await send("POST", `/api/diagnoses/${diagnosis.id}/restore`);
      expect(restored.status).toBe(200);
      expect(asEntry(restored)).toMatchObject({ id: diagnosis.id, archivedAt: null });

      const afterRestore = asTimeline(await get(`/api/companies/${companyId}/timeline`));
      expect(afterRestore.completed.map((entry) => entry.id)).toEqual([diagnosis.id]);
      expect(afterRestore.archived).toEqual([]);
      // Nothing was deleted or recalculated along the way (RULE-dm-15, RULE-dm-11).
      expect(await stored()).toEqual(before);
    });

    it("is idempotent: archiving twice or restoring one that is not archived changes nothing", async () => {
      const companyId = await createCompany();
      const diagnosis = await conclude(companyId, G1, APRIL);

      db.setNow(JULY);
      const first = await send("POST", `/api/diagnoses/${diagnosis.id}/archive`);
      db.setNow(OCTOBER);
      const second = await send("POST", `/api/diagnoses/${diagnosis.id}/archive`);
      expect(second.status).toBe(200);
      expect(asEntry(second).archivedAt).toBe(asEntry(first).archivedAt);

      await send("POST", `/api/diagnoses/${diagnosis.id}/restore`);
      const again = await send("POST", `/api/diagnoses/${diagnosis.id}/restore`);
      expect(again.status).toBe(200);
      expect(asEntry(again).archivedAt).toBeNull();
    });

    it("refuses to archive or restore a draft with 409 diagnosis_not_completed", async () => {
      const companyId = await createCompany();
      const draft = await startDraft(companyId);

      for (const action of ["archive", "restore"]) {
        const response = await send("POST", `/api/diagnoses/${draft.id}/${action}`);
        expect(response.status).toBe(409);
        expect(asError(response).code).toBe("diagnosis_not_completed");
      }
      expect(asTimeline(await get(`/api/companies/${companyId}/timeline`)).draft?.id).toBe(draft.id);
    });

    it("answers 404 diagnosis_not_found for a diagnosis that does not exist", async () => {
      for (const action of ["archive", "restore"]) {
        const response = await send("POST", `/api/diagnoses/not-a-diagnosis/${action}`);
        expect(response.status).toBe(404);
        expect(asError(response).code).toBe("diagnosis_not_found");
      }
    });

    it("keeps the archived state after the app is closed and opened again", async () => {
      const companyId = await createCompany();
      const diagnosis = await conclude(companyId, G1, APRIL);
      await send("POST", `/api/diagnoses/${diagnosis.id}/archive`);

      const reopened = await startNewAppSession();
      try {
        const timeline = asTimeline(await callApi(reopened.baseUrl, "GET", `/api/companies/${companyId}/timeline`));
        expect(timeline.archived.map((entry) => entry.id)).toEqual([diagnosis.id]);
      } finally {
        await reopened.close();
      }
    });

    it("takes an archived diagnosis out of the company's latest stage and puts it back on restore", async () => {
      const companyId = await createCompany();
      await conclude(companyId, G1, APRIL);
      const newest = await conclude(companyId, G3_PC_67, OCTOBER);
      const latestStage = async () =>
        ((await get(`/api/companies/${companyId}`)).body as { latestStage: StageNumber | null }).latestStage;

      expect(await latestStage()).toBe(3);
      await send("POST", `/api/diagnoses/${newest.id}/archive`);
      expect(await latestStage()).toBe(1);
      await send("POST", `/api/diagnoses/${newest.id}/restore`);
      expect(await latestStage()).toBe(3);
    });
  });

  describe("GET /api/diagnoses/:id/comparison", () => {
    it("offers no comparison for the first diagnosis: 409 no_previous_diagnosis", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1, APRIL);

      const response = await get(`/api/diagnoses/${first.id}/comparison`);

      expect(response.status).toBe(409);
      expect(asError(response).code).toBe("no_previous_diagnosis");
    });

    it("answers 409 diagnosis_not_completed for a draft and 404 for an unknown diagnosis", async () => {
      const companyId = await createCompany();
      const draft = await startDraft(companyId);

      const forDraft = await get(`/api/diagnoses/${draft.id}/comparison`);
      expect(forDraft.status).toBe(409);
      expect(asError(forDraft).code).toBe("diagnosis_not_completed");

      const unknown = await get("/api/diagnoses/not-a-diagnosis/comparison");
      expect(unknown.status).toBe(404);
      expect(asError(unknown).code).toBe("diagnosis_not_found");
    });

    it("compares the stage, each dimension and the risks with the previous diagnosis", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1, APRIL);
      const second = await conclude(companyId, G3_PC_67, OCTOBER);

      const response = await get(`/api/diagnoses/${second.id}/comparison`);
      expect(response.status).toBe(200);
      const comparison = asComparison(response);

      expect(comparison.previous).toEqual({
        id: first.id,
        completedAt: APRIL.toISOString(),
        stage: 1,
        rulesVersion: 1,
      });
      expect(comparison.current).toEqual({
        id: second.id,
        completedAt: OCTOBER.toISOString(),
        stage: 3,
        rulesVersion: 1,
      });
      expect(comparison.stageChange).toEqual({ from: 1, to: 3, direction: "up" });
      expect(comparison.dimensions.map((dimension) => dimension.key)).toEqual([...DIMENSION_KEYS]);
      expect(comparison.dimensions.map((dimension) => dimension.before)).toEqual(G1_SCORES);
      for (const dimension of comparison.dimensions) {
        expect(dimension.after).toBe(second.result?.dimensions[dimension.key].score);
        expect(dimension.delta).toBe(dimension.after - dimension.before);
      }
      expect(comparison.risksResolved.map((risk) => risk.signalId)).toContain("SIG-01");
      expect(comparison.recalculated).toBeUndefined();
    });

    it("compares each diagnosis with the one right before it, not always with the first", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1, APRIL);
      const second = await conclude(companyId, MID, JULY);
      const third = await conclude(companyId, G3_PC_67, OCTOBER);

      const secondVsFirst = asComparison(await get(`/api/diagnoses/${second.id}/comparison`));
      const thirdVsSecond = asComparison(await get(`/api/diagnoses/${third.id}/comparison`));

      expect(secondVsFirst.previous.id).toBe(first.id);
      expect(thirdVsSecond.previous.id).toBe(second.id);
      expect(thirdVsSecond.dimensions.map((dimension) => dimension.before)).toEqual(
        DIMENSION_KEYS.map((key) => second.result?.dimensions[key].score),
      );
    });

    it("skips an archived diagnosis and compares with the one before it", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1, APRIL);
      const second = await conclude(companyId, MID, JULY);
      const third = await conclude(companyId, G3_PC_67, OCTOBER);

      await send("POST", `/api/diagnoses/${second.id}/archive`);

      expect(asComparison(await get(`/api/diagnoses/${third.id}/comparison`)).previous.id).toBe(first.id);
      const timeline = asTimeline(await get(`/api/companies/${companyId}/timeline`));
      expect(timeline.completed.map((entry) => [entry.id, entry.canCompare])).toEqual([
        [third.id, true],
        [first.id, false],
      ]);
    });

    it("loses the comparison when the earlier diagnosis is archived and gets it back on restore", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1, APRIL);
      const second = await conclude(companyId, G3_PC_67, OCTOBER);

      await send("POST", `/api/diagnoses/${first.id}/archive`);
      const refused = await get(`/api/diagnoses/${second.id}/comparison`);
      expect(refused.status).toBe(409);
      expect(asError(refused).code).toBe("no_previous_diagnosis");
      expect(asTimeline(await get(`/api/companies/${companyId}/timeline`)).completed[0]?.canCompare).toBe(false);

      await send("POST", `/api/diagnoses/${first.id}/restore`);
      expect((await get(`/api/diagnoses/${second.id}/comparison`)).status).toBe(200);
      expect(asTimeline(await get(`/api/companies/${companyId}/timeline`)).completed[0]?.canCompare).toBe(true);
    });

    it("calculates the previous again when the rules changed and keeps its original score (RULE-dm-11)", async () => {
      const companyId = await createCompany();
      // Concluded while the app calculated with rules v1: stage 3.
      const first = await conclude(companyId, G3_PC_67, APRIL);
      expect(first.result?.stage).toBe(3);

      // The app was updated: the same answers now reach stage 2 under rules v2.
      const updated = await startNewAppSession({ rules: rulesV2 });
      try {
        const get2 = (path: string) => callApi(updated.baseUrl, "GET", path);
        db.setNow(OCTOBER);
        const draft = asDiagnosis(await callApi(updated.baseUrl, "POST", `/api/companies/${companyId}/diagnoses`));
        const second = asDiagnosis(await callApi(updated.baseUrl, "POST", `/api/diagnoses/${draft.id}/complete`));
        expect(second.rulesVersion).toBe(2);
        expect(second.result?.stage).toBe(2);

        const comparison = asComparison(await get2(`/api/diagnoses/${second.id}/comparison`));

        expect(comparison.previous).toEqual({
          id: first.id,
          completedAt: APRIL.toISOString(),
          stage: 2,
          rulesVersion: 2,
        });
        expect(comparison.stageChange).toEqual({ from: 2, to: 2, direction: "same" });
        expect(comparison.dimensions.every((dimension) => dimension.delta === 0)).toBe(true);
        expect(comparison.recalculated).toEqual({
          fromVersion: 1,
          toVersion: 2,
          originalScore: { stage: 3, average: expect.any(Number) },
        });

        // The recalculation is only for the comparison: the stored diagnosis is untouched.
        const stored = asDiagnosis(await get2(`/api/diagnoses/${first.id}`));
        expect(stored.rulesVersion).toBe(1);
        expect(stored.result?.stage).toBe(3);
        expect(stored.result?.rulesVersion).toBe(1);
      } finally {
        await updated.close();
      }
    });

    it("does not recalculate when both diagnoses were calculated with the same rules", async () => {
      const companyId = await createCompany();
      await conclude(companyId, G3_PC_67, APRIL);
      const second = await conclude(companyId, G3_PC_67, OCTOBER);

      // The app now has other rules, but both diagnoses were frozen with v1: they compare as stored.
      const updated = await startNewAppSession({ rules: rulesV2 });
      try {
        const comparison = asComparison(
          await callApi(updated.baseUrl, "GET", `/api/diagnoses/${second.id}/comparison`),
        );
        expect(comparison.recalculated).toBeUndefined();
        expect(comparison.previous.stage).toBe(3);
        expect(comparison.previous.rulesVersion).toBe(1);
      } finally {
        await updated.close();
      }
    });
  });
});
