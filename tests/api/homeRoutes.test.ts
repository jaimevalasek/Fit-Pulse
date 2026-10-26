import { existsSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { questionsOfBlock } from "../../shared/content/questionBank.ts";
import {
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
  type DiagnosisInput,
  type DiagnosisResult,
} from "../../shared/domain/types.ts";
import type { ReportBlock, ReportDocument } from "../../shared/report/reportDocument.ts";
import { createApp } from "../../server/app.ts";
import { createReportService } from "../../server/services/reportService.ts";
import {
  OVERDUE_DIAGNOSIS_DAYS,
  STALE_DRAFT_DAYS,
  type ConsultantHomeView,
  type OwnerHomeView,
} from "../../server/services/homeService.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-008: the home route. Covers the indicators of "minha empresa" (AC-dm-32 data, AC-ra-33) and
// "consultoria" (AC-dm-34, AC-ra-35), the way they follow the data (AC-dm-33, AC-ra-36) and the
// 7-day line and the chosen reevaluation interval against an injected clock.

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
  result: DiagnosisResult | null;
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

const asOwner = (response: ApiResponse): OwnerHomeView => response.body as OwnerHomeView;
const asConsultant = (response: ApiResponse): ConsultantHomeView => response.body as ConsultantHomeView;
const asDiagnosis = (response: ApiResponse): DiagnosisBody => response.body as DiagnosisBody;
const asError = (response: ApiResponse): ErrorBody["error"] => (response.body as ErrorBody).error;

// -------------------------------------------------- answers (PRD reference cases)

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// G1: stage 1, scores 17 / 33 / 11 / 17 / 33 / 33 / 22 / 33, risks SIG-01 (high, 16) and SIG-05.
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

// A stage 3 company with its cost per customer measured: no high risk.
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
const G3: DiagnosisInput = {
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

const DAY_MS = 24 * 60 * 60 * 1000;
const SECOND_MS = 1000;
const APRIL = new Date("2026-04-14T12:00:00.000Z");
const JULY = new Date("2026-07-08T12:00:00.000Z");
const NOW = new Date("2026-10-23T12:00:00.000Z");

const daysBefore = (date: Date, days: number, extraMs = 0): Date => new Date(date.getTime() - days * DAY_MS - extraMs);

describe("home route", () => {
  let db: TestDatabase;
  let server: RunningServer;

  const get = (path: string) => callApi(server.baseUrl, "GET", path);
  const send = (method: string, path: string, body?: unknown) => callApi(server.baseUrl, method, path, body);
  const ownerHome = (companyId?: string) =>
    get(`/api/home?mode=owner${companyId === undefined ? "" : `&companyId=${companyId}`}`);
  const consultantHome = () => get("/api/home?mode=consultant");

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

  // The path the owner takes, on the day `at`: start, answer everything, conclude. The clock
  // goes back to where it was, so the test keeps asking the home from its own "today".
  async function conclude(companyId: string, input: DiagnosisInput, at: Date = db.now()): Promise<DiagnosisBody> {
    const today = db.now();
    db.setNow(at);
    try {
      const draft = await startDraft(companyId);
      expect((await send("PATCH", `/api/diagnoses/${draft.id}`, input)).status).toBe(200);
      const response = await send("POST", `/api/diagnoses/${draft.id}/complete`);
      expect(response.status).toBe(200);
      return asDiagnosis(response);
    } finally {
      db.setNow(today);
    }
  }

  // The stored `updatedAt` follows the real clock, not the injected one, so a stalled draft is
  // made by writing the date it was last touched.
  async function startDraftLastTouchedAt(companyId: string, touchedAt: Date): Promise<string> {
    const draft = await startDraft(companyId);
    await db.prisma.diagnosis.update({ where: { id: draft.id }, data: { updatedAt: touchedAt } });
    return draft.id;
  }

  const planOf = (diagnosis: DiagnosisBody): string[] => (diagnosis.result as DiagnosisResult).plan;

  async function trackAction(diagnosisId: string, actionKey: string, patch: Record<string, unknown>): Promise<void> {
    expect((await send("PATCH", `/api/diagnoses/${diagnosisId}/actions/${actionKey}`, patch)).status).toBe(200);
  }

  async function chooseInterval(days: number): Promise<void> {
    expect((await send("PUT", "/api/preferences", { reevaluationIntervalDays: days })).status).toBe(200);
  }

  async function noteMonth(companyId: string, month: string, newCustomers: number, spendTotalCents: number) {
    const response = await send("POST", `/api/companies/${companyId}/diary`, { month, newCustomers, spendTotalCents });
    expect(response.status).toBe(201);
  }

  async function archiveDiagnosis(id: string): Promise<void> {
    expect((await send("POST", `/api/diagnoses/${id}/archive`)).status).toBe(200);
  }

  async function restoreDiagnosis(id: string): Promise<void> {
    expect((await send("POST", `/api/diagnoses/${id}/restore`)).status).toBe(200);
  }

  const names = (list: Array<{ name: string }>): string[] => list.map((item) => item.name);

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
    db.setNow(NOW);
  });

  describe("query validation", () => {
    it("answers 400 validation_failed without a mode", async () => {
      const response = await get("/api/home");

      expect(response.status).toBe(400);
      expect(asError(response).code).toBe("validation_failed");
      expect(asError(response).fields).toHaveProperty("mode");
    });

    it("answers 400 validation_failed for a mode that does not exist or is repeated", async () => {
      for (const query of ["mode=admin", "mode=", "mode=owner&mode=consultant"]) {
        const response = await get(`/api/home?${query}`);

        expect(response.status, query).toBe(400);
        expect(asError(response).code, query).toBe("validation_failed");
      }
    });

    it("answers 400 validation_failed for an absurdly long company id", async () => {
      const response = await get(`/api/home?mode=owner&companyId=${"a".repeat(65)}`);

      expect(response.status).toBe(400);
      expect(asError(response).fields).toHaveProperty("companyId");
    });

    it("reads a blank companyId as not sent", async () => {
      const companyId = await createCompany();

      const response = await get("/api/home?mode=owner&companyId=");

      expect(response.status).toBe(200);
      expect(asOwner(response).company.id).toBe(companyId);
    });
  });

  describe("minha empresa", () => {
    it("answers 404 company_not_found when there is no company at all", async () => {
      const response = await ownerHome();

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
    });

    it("answers 404 company_not_found for an unknown or an archived company", async () => {
      const companyId = await createCompany();

      expect((await ownerHome("not-a-company")).status).toBe(404);
      expect(asError(await ownerHome("not-a-company")).code).toBe("company_not_found");

      await send("POST", `/api/companies/${companyId}/archive`);
      const archived = await ownerHome(companyId);
      expect(archived.status).toBe(404);
      expect(asError(archived).code).toBe("company_not_found");
    });

    it("shows a company that never started a diagnosis with nothing to report", async () => {
      const companyId = await createCompany("Padaria Nova");

      const response = await ownerHome(companyId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        mode: "owner",
        company: { id: companyId, name: "Padaria Nova" },
        latest: null,
        draft: null,
        reevaluation: null,
        actions: { counts: { done: 0, inProgress: 0, todo: 0, notApplicable: 0, overdue: 0 }, current: [] },
        diary: { count: 0, cacCents: null, measuredFrom: null, measuredTo: null },
        latestReport: null,
      });
    });

    it("picks the company by the explicit id, then the saved focus, then the oldest active one", async () => {
      const first = await createCompany("Primeira");
      const second = await createCompany("Segunda");
      const third = await createCompany("Terceira");
      // Same millisecond on a fast machine: the registration order is made explicit.
      await db.prisma.company.update({ where: { id: first }, data: { createdAt: new Date("2026-01-10T12:00:00Z") } });
      await db.prisma.company.update({ where: { id: second }, data: { createdAt: new Date("2026-02-10T12:00:00Z") } });
      await db.prisma.company.update({ where: { id: third }, data: { createdAt: new Date("2026-03-10T12:00:00Z") } });

      expect(asOwner(await ownerHome()).company.id).toBe(first);

      expect((await send("PUT", "/api/preferences", { focusCompanyId: third })).status).toBe(200);
      expect(asOwner(await ownerHome()).company.id).toBe(third);
      expect(asOwner(await ownerHome(second)).company.id).toBe(second);

      await send("POST", `/api/companies/${third}/archive`);
      expect(asOwner(await ownerHome()).company.id).toBe(first);
    });

    it("describes the latest diagnosis with the stage before it and the data for the lock and the plan", async () => {
      const companyId = await createCompany();
      await conclude(companyId, G1, APRIL);
      const second = await conclude(companyId, G3, JULY);
      const result = second.result as DiagnosisResult;

      const home = asOwner(await ownerHome(companyId));

      expect(home.latest).toEqual({
        id: second.id,
        completedAt: JULY.toISOString(),
        stage: 3,
        previous: { stage: 1, completedAt: APRIL.toISOString() },
        lock: result.lock,
        weakestDimension: result.weakestDimension,
        plan: result.plan,
        confidence: result.confidence.level,
      });
      expect(result.plan).toHaveLength(3);
    });

    it("has no stage before the first diagnosis (BR-dm-08)", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1, APRIL);

      const home = asOwner(await ownerHome(companyId));

      expect(home.latest).toMatchObject({ id: first.id, stage: 1, previous: null });
    });

    it("no longer sends the trend of the score: the home counts days, not points", async () => {
      const companyId = await createCompany();
      await conclude(companyId, G1, APRIL);
      await conclude(companyId, G3, JULY);

      const response = await ownerHome(companyId);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("trend");
    });

    // AC-ra-33 / RULE-ra-07: the days to the next diagnosis follow the interval the user chose.
    describe("reevaluation (AC-ra-33, AC-ra-34)", () => {
      it("counts the days from the latest diagnosis to the due day with the default of 90 days", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G1, daysBefore(NOW, 10));

        const { reevaluation } = asOwner(await ownerHome(companyId));

        expect(reevaluation).toEqual({
          lastAt: daysBefore(NOW, 10).toISOString(),
          dueAt: "2027-01-11",
          today: "2026-10-23",
          daysUntil: 80,
          daysOverdue: 0,
          intervalDays: 90,
        });
      });

      it("changes the count at once when the interval changes, and keeps it", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G1, daysBefore(NOW, 10));

        await chooseInterval(60);
        expect(asOwner(await ownerHome(companyId)).reevaluation).toMatchObject({
          dueAt: "2026-12-12",
          daysUntil: 50,
          daysOverdue: 0,
          intervalDays: 60,
        });

        await chooseInterval(180);
        expect(asOwner(await ownerHome(companyId)).reevaluation).toMatchObject({
          dueAt: "2027-04-11",
          daysUntil: 170,
          intervalDays: 180,
        });
      });

      it("keeps the due day on time and turns late the day after", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G1, daysBefore(NOW, 90));

        expect(asOwner(await ownerHome(companyId)).reevaluation).toMatchObject({ daysUntil: 0, daysOverdue: 0 });

        db.setNow(new Date(NOW.getTime() + DAY_MS));
        expect(asOwner(await ownerHome(companyId)).reevaluation).toMatchObject({
          today: "2026-10-24",
          daysUntil: -1,
          daysOverdue: 1,
        });
      });

      it("turns late when a shorter interval is chosen, and on time again with a longer one", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G1, daysBefore(NOW, 70));

        await chooseInterval(60);
        expect(asOwner(await ownerHome(companyId)).reevaluation).toMatchObject({
          daysUntil: -10,
          daysOverdue: 10,
          intervalDays: 60,
        });

        await chooseInterval(120);
        expect(asOwner(await ownerHome(companyId)).reevaluation).toMatchObject({
          daysUntil: 50,
          daysOverdue: 0,
          intervalDays: 120,
        });
      });

      it("counts from the latest diagnosis that counts, and from none once every one is archived", async () => {
        const companyId = await createCompany();
        const older = await conclude(companyId, G1, daysBefore(NOW, 100));
        const recent = await conclude(companyId, G3, daysBefore(NOW, 10));
        expect(asOwner(await ownerHome(companyId)).reevaluation).toMatchObject({ daysUntil: 80, daysOverdue: 0 });

        await archiveDiagnosis(recent.id);
        expect(asOwner(await ownerHome(companyId)).reevaluation).toMatchObject({ daysUntil: -10, daysOverdue: 10 });

        await archiveDiagnosis(older.id);
        expect(asOwner(await ownerHome(companyId)).reevaluation).toBeNull();
      });
    });

    // AC-ra-33 ("Ações do plano", "Suas 3 ações") and AC-ra-36: the numbers come from the tracking.
    describe("actions of the plan (AC-ra-33, AC-ra-36)", () => {
      it("lists the three actions of the current plan, all still to do, with nothing overdue", async () => {
        const companyId = await createCompany();
        const diagnosis = await conclude(companyId, G1, daysBefore(NOW, 10));

        const { actions } = asOwner(await ownerHome(companyId));

        expect(actions.current.map((action) => action.actionKey)).toEqual(planOf(diagnosis));
        expect(actions.current).toHaveLength(3);
        expect(actions.current.every((action) => action.diagnosisId === diagnosis.id && action.status === "todo")).toBe(true);
        expect(actions.counts).toEqual({ done: 0, inProgress: 0, todo: 3, notApplicable: 0, overdue: 0 });
      });

      it("moves the counts when an action changes: overdue, then done", async () => {
        const companyId = await createCompany();
        const diagnosis = await conclude(companyId, G1, daysBefore(NOW, 10));
        const [first, second, third] = planOf(diagnosis);

        await trackAction(diagnosis.id, first, { status: "in_progress", dueDate: "2026-10-22" });
        await trackAction(diagnosis.id, second, { dueDate: "2026-10-23" });
        const overdue = asOwner(await ownerHome(companyId)).actions;
        expect(overdue.counts).toEqual({ done: 0, inProgress: 1, todo: 2, notApplicable: 0, overdue: 1 });
        expect(overdue.current.filter((action) => action.overdue).map((action) => action.actionKey)).toEqual([first]);

        await trackAction(diagnosis.id, first, { status: "done" });
        await trackAction(diagnosis.id, third, { status: "not_applicable" });
        const settled = asOwner(await ownerHome(companyId)).actions;
        expect(settled.counts).toEqual({ done: 1, inProgress: 0, todo: 1, notApplicable: 1, overdue: 0 });
        expect(settled.current.map((action) => action.status)).toEqual(["done", "todo", "not_applicable"]);
      });

      it("turns an action overdue when the day passes its deadline", async () => {
        const companyId = await createCompany();
        const diagnosis = await conclude(companyId, G1, daysBefore(NOW, 10));
        await trackAction(diagnosis.id, planOf(diagnosis)[0], { dueDate: "2026-10-23" });
        expect(asOwner(await ownerHome(companyId)).actions.counts.overdue).toBe(0);

        db.setNow(new Date(NOW.getTime() + DAY_MS));

        expect(asOwner(await ownerHome(companyId)).actions.counts.overdue).toBe(1);
      });

      it("shows only the plan of the latest diagnosis: the older plan is closed", async () => {
        const companyId = await createCompany();
        const first = await conclude(companyId, G1, APRIL);
        for (const actionKey of planOf(first)) {
          await trackAction(first.id, actionKey, { status: "done" });
        }
        const second = await conclude(companyId, G3, JULY);

        const { actions } = asOwner(await ownerHome(companyId));

        expect(actions.current.every((action) => action.diagnosisId === second.id)).toBe(true);
        expect(actions.current.map((action) => action.actionKey)).toEqual(planOf(second));
        expect(actions.counts.done).toBe(actions.current.filter((action) => action.status === "done").length);
      });
    });

    // AC-ra-33 "Diário de números": the cost from the diary and the months noted.
    describe("diary (AC-ra-33)", () => {
      it("starts empty and counts the months as they are noted", async () => {
        const companyId = await createCompany();
        expect(asOwner(await ownerHome(companyId)).diary).toEqual({
          count: 0,
          cacCents: null,
          measuredFrom: null,
          measuredTo: null,
        });

        await noteMonth(companyId, "2026-08", 10, 100_000);
        expect(asOwner(await ownerHome(companyId)).diary).toEqual({
          count: 1,
          cacCents: 10_000,
          measuredFrom: null,
          measuredTo: null,
        });
      });

      it("measures the cost over the 3 most recent months once there are 3 or more", async () => {
        const companyId = await createCompany();
        await noteMonth(companyId, "2026-07", 5, 1_000_000);
        await noteMonth(companyId, "2026-08", 10, 100_000);
        await noteMonth(companyId, "2026-09", 20, 200_000);
        await noteMonth(companyId, "2026-10", 10, 300_000);

        const { diary } = asOwner(await ownerHome(companyId));

        // (100.000 + 200.000 + 300.000) ÷ (10 + 20 + 10) = 15.000 cents; July is older than the 3 months.
        expect(diary).toEqual({ count: 4, cacCents: 15_000, measuredFrom: "2026-08", measuredTo: "2026-10" });

        expect((await send("DELETE", `/api/companies/${companyId}/diary/2026-10`)).status).toBe(200);
        expect(asOwner(await ownerHome(companyId)).diary).toMatchObject({
          count: 3,
          measuredFrom: "2026-07",
          measuredTo: "2026-09",
        });
      });

      it("keeps the diary of each company apart", async () => {
        const noted = await createCompany("Com diário");
        const blank = await createCompany("Sem diário");
        await noteMonth(noted, "2026-10", 4, 80_000);

        expect(asOwner(await ownerHome(noted)).diary.count).toBe(1);
        expect(asOwner(await ownerHome(blank)).diary.count).toBe(0);
      });
    });

    // AC-ra-33 "Relatórios": the last PDF saved, or null for the invitation.
    describe("latest report (AC-ra-33)", () => {
      const saveReport = async (diagnosisId: string) => {
        const response = await send("POST", `/api/diagnoses/${diagnosisId}/report`);
        expect(response.status).toBe(200);
        return response.body as { fileId: string; fileName: string };
      };

      it("is null until a PDF is saved, then points to it, and follows the newest one", async () => {
        const companyId = await createCompany();
        const diagnosis = await conclude(companyId, G1, daysBefore(NOW, 10));
        expect(asOwner(await ownerHome(companyId)).latestReport).toBeNull();

        const first = await saveReport(diagnosis.id);
        expect(asOwner(await ownerHome(companyId)).latestReport).toEqual({
          fileId: first.fileId,
          fileName: first.fileName,
          savedAt: NOW.toISOString(),
        });

        db.setNow(new Date(NOW.getTime() + DAY_MS));
        const second = await saveReport(diagnosis.id);
        expect(second.fileId).not.toBe(first.fileId);
        expect(asOwner(await ownerHome(companyId)).latestReport).toMatchObject({
          fileId: second.fileId,
          savedAt: new Date(NOW.getTime() + DAY_MS).toISOString(),
        });
      });

      it("does not show the PDF of another company", async () => {
        const mine = await createCompany("Minha");
        const other = await createCompany("Outra");
        await conclude(mine, G1, daysBefore(NOW, 10));
        const otherDiagnosis = await conclude(other, G3, daysBefore(NOW, 10));
        await saveReport(otherDiagnosis.id);

        expect(asOwner(await ownerHome(mine)).latestReport).toBeNull();
        expect(asOwner(await ownerHome(other)).latestReport).not.toBeNull();
      });
    });

    it("shows the open draft with how far the owner got, and drops it when it is concluded", async () => {
      const companyId = await createCompany();
      const draft = await startDraft(companyId);
      const blockTwo = Object.fromEntries(questionsOfBlock(2).map((question) => [question.id, 2]));
      await send("PATCH", `/api/diagnoses/${draft.id}`, { calculator: G1.calculator, answers: blockTwo, currentBlock: 3 });

      const during = asOwner(await ownerHome(companyId));

      expect(during.latest).toBeNull();
      expect(during.draft).toEqual({
        id: draft.id,
        currentBlock: 3,
        completedBlocks: 2,
        totalBlocks: 8,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      await send("PATCH", `/api/diagnoses/${draft.id}`, G1);
      await send("POST", `/api/diagnoses/${draft.id}/complete`);

      const after = asOwner(await ownerHome(companyId));
      expect(after.draft).toBeNull();
      expect(after.latest?.id).toBe(draft.id);
    });

    // AC-dm-33: the indicators come from the stored diagnoses and follow every change.
    it("follows the diagnoses: concluding, archiving and restoring move every indicator", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1, APRIL);
      const afterFirst = asOwner(await ownerHome(companyId));
      expect(afterFirst.latest).toMatchObject({ id: first.id, stage: 1, previous: null });
      expect(afterFirst.reevaluation?.lastAt).toBe(APRIL.toISOString());
      expect(afterFirst.actions.current.map((action) => action.diagnosisId)).toEqual([first.id, first.id, first.id]);

      const second = await conclude(companyId, G3, JULY);
      const afterSecond = asOwner(await ownerHome(companyId));
      expect(afterSecond.latest).toMatchObject({ id: second.id, stage: 3, previous: { stage: 1 } });
      expect(afterSecond.reevaluation?.lastAt).toBe(JULY.toISOString());
      expect(afterSecond.actions.current.map((action) => action.diagnosisId)).toEqual([second.id, second.id, second.id]);

      await archiveDiagnosis(second.id);
      const afterArchive = asOwner(await ownerHome(companyId));
      expect(afterArchive.latest).toMatchObject({ id: first.id, stage: 1, previous: null });
      expect(afterArchive.reevaluation?.lastAt).toBe(APRIL.toISOString());
      expect(afterArchive.actions.current.map((action) => action.diagnosisId)).toEqual([first.id, first.id, first.id]);

      await restoreDiagnosis(second.id);
      const afterRestore = asOwner(await ownerHome(companyId));
      expect(afterRestore.latest).toMatchObject({ id: second.id, stage: 3 });
      expect(afterRestore.reevaluation?.lastAt).toBe(JULY.toISOString());
    });
  });

  describe("consultoria", () => {
    it("is empty without companies: four stages with nobody and no lists", async () => {
      const response = await consultantHome();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        mode: "consultant",
        reevaluationDays: 90,
        companyCount: 0,
        byStage: [1, 2, 3, 4].map((stage) => ({ stage, count: 0, companies: [] })),
        withoutDiagnosis: [],
        staleDrafts: [],
        overdue: [],
        highRisk: [],
        overdueActions: [],
      });
    });

    it("ignores the company id and the focus: it is the whole portfolio", async () => {
      await createCompany("Ótica Lume");

      const response = await get("/api/home?mode=consultant&companyId=not-a-company");

      expect(response.status).toBe(200);
      expect(asConsultant(response).companyCount).toBe(1);
    });

    it("groups the companies by the stage of their latest diagnosis and lists those with none", async () => {
      const stageOne = await createCompany("Zé Burguer");
      const stageThree = await createCompany("Academia Foco");
      const none = await createCompany("Padaria Nova");
      const alsoStageOne = await createCompany("Ótica Lume");
      await conclude(stageOne, G1, APRIL);
      await conclude(stageThree, G3, JULY);
      await conclude(alsoStageOne, G1, JULY);

      const home = asConsultant(await consultantHome());

      expect(home.companyCount).toBe(4);
      expect(home.byStage.map((group) => [group.stage, group.count])).toEqual([[1, 2], [2, 0], [3, 1], [4, 0]]);
      // Sorted by name, accents and case ignored.
      expect(home.byStage[0].companies).toEqual([
        { companyId: alsoStageOne, name: "Ótica Lume", lastDiagnosisAt: JULY.toISOString() },
        { companyId: stageOne, name: "Zé Burguer", lastDiagnosisAt: APRIL.toISOString() },
      ]);
      expect(home.byStage[2].companies).toEqual([
        { companyId: stageThree, name: "Academia Foco", lastDiagnosisAt: JULY.toISOString() },
      ]);
      expect(home.withoutDiagnosis).toEqual([{ companyId: none, name: "Padaria Nova" }]);
    });

    // AC-dm-33 in the portfolio: archiving the latest diagnosis moves the company down a step.
    it("moves a company when its latest diagnosis is archived, and back when it is restored", async () => {
      const companyId = await createCompany();
      await conclude(companyId, G1, APRIL);
      const latest = await conclude(companyId, G3, JULY);
      expect(asConsultant(await consultantHome()).byStage[2].count).toBe(1);

      await archiveDiagnosis(latest.id);
      const archived = asConsultant(await consultantHome());
      expect(archived.byStage.map((group) => group.count)).toEqual([1, 0, 0, 0]);
      expect(archived.byStage[0].companies[0].lastDiagnosisAt).toBe(APRIL.toISOString());

      await restoreDiagnosis(latest.id);
      expect(asConsultant(await consultantHome()).byStage.map((group) => group.count)).toEqual([0, 0, 1, 0]);
    });

    it("lists a company that only has archived diagnoses as without a diagnosis", async () => {
      const companyId = await createCompany("Padaria Nova");
      const only = await conclude(companyId, G1, APRIL);
      await archiveDiagnosis(only.id);

      const home = asConsultant(await consultantHome());

      expect(home.byStage.map((group) => group.count)).toEqual([0, 0, 0, 0]);
      expect(home.withoutDiagnosis).toEqual([{ companyId, name: "Padaria Nova" }]);
    });

    it("drops an archived company from every indicator and brings it back when restored", async () => {
      const companyId = await createCompany("Zé Burguer");
      await conclude(companyId, G1, daysBefore(NOW, 120));
      await startDraftLastTouchedAt(companyId, daysBefore(NOW, 20));
      const before = asConsultant(await consultantHome());
      expect(before.companyCount).toBe(1);
      expect(before.byStage[0].count).toBe(1);
      expect([before.staleDrafts.length, before.overdue.length, before.highRisk.length]).toEqual([1, 1, 1]);

      await send("POST", `/api/companies/${companyId}/archive`);
      expect(await consultantHome()).toMatchObject({
        status: 200,
        body: { companyCount: 0, withoutDiagnosis: [], staleDrafts: [], overdue: [], highRisk: [] },
      });

      await send("POST", `/api/companies/${companyId}/restore`);
      expect(asConsultant(await consultantHome())).toEqual(before);
    });

    describe("drafts stalled for more than 7 days", () => {
      it("keeps the line at the seventh day, strictly", async () => {
        const onTheLine = await createCompany("Na linha");
        const pastTheLine = await createCompany("Passou da linha");
        const fresh = await createCompany("Recente");
        await startDraftLastTouchedAt(onTheLine, daysBefore(NOW, STALE_DRAFT_DAYS));
        const lateDraft = await startDraftLastTouchedAt(pastTheLine, daysBefore(NOW, STALE_DRAFT_DAYS, SECOND_MS));
        await startDraftLastTouchedAt(fresh, daysBefore(NOW, 2));

        const { staleDrafts } = asConsultant(await consultantHome());

        expect(staleDrafts.map((item) => item.companyId)).toEqual([pastTheLine]);
        expect(staleDrafts[0]).toMatchObject({ draftId: lateDraft, name: "Passou da linha", idleDays: 7 });
      });

      it("moves with the clock: the same draft crosses the line one second later", async () => {
        const companyId = await createCompany();
        await startDraftLastTouchedAt(companyId, daysBefore(NOW, STALE_DRAFT_DAYS));
        expect(asConsultant(await consultantHome()).staleDrafts).toEqual([]);

        db.setNow(new Date(NOW.getTime() + SECOND_MS));

        expect(asConsultant(await consultantHome()).staleDrafts.map((item) => item.companyId)).toEqual([companyId]);
      });

      it("lists the longest idle first and counts whole days", async () => {
        const recent = await createCompany("Beta");
        const oldest = await createCompany("Alfa");
        const tie = await createCompany("Gama");
        await startDraftLastTouchedAt(recent, daysBefore(NOW, 9, 5 * 60 * 60 * 1000));
        await startDraftLastTouchedAt(oldest, daysBefore(NOW, 30));
        await startDraftLastTouchedAt(tie, daysBefore(NOW, 9, 5 * 60 * 60 * 1000));

        const { staleDrafts } = asConsultant(await consultantHome());

        expect(staleDrafts.map((item) => [item.name, item.idleDays])).toEqual([["Alfa", 30], ["Beta", 9], ["Gama", 9]]);
      });

      it("does not list a company whose draft was concluded", async () => {
        const companyId = await createCompany();
        const draftId = await startDraftLastTouchedAt(companyId, daysBefore(NOW, 20));
        expect(asConsultant(await consultantHome()).staleDrafts).toHaveLength(1);

        await send("PATCH", `/api/diagnoses/${draftId}`, G1);
        await send("POST", `/api/diagnoses/${draftId}/complete`);

        expect(asConsultant(await consultantHome()).staleDrafts).toEqual([]);
      });
    });

    // RULE-ra-07: the reevaluation day is the local day of the latest diagnosis plus 90 days, and the
    // company is overdue once that day has passed. The line falls between two calendar days.
    describe("no diagnosis for more than 90 days", () => {
      it("keeps the line at the ninetieth day, strictly", async () => {
        const onTheLine = await createCompany("Na linha");
        const pastTheLine = await createCompany("Passou da linha");
        await conclude(onTheLine, G1, daysBefore(NOW, OVERDUE_DIAGNOSIS_DAYS));
        const late = await conclude(pastTheLine, G1, daysBefore(NOW, OVERDUE_DIAGNOSIS_DAYS + 1));

        const { overdue } = asConsultant(await consultantHome());

        expect(overdue).toEqual([
          {
            companyId: pastTheLine,
            name: "Passou da linha",
            diagnosisId: late.id,
            lastDiagnosisAt: daysBefore(NOW, OVERDUE_DIAGNOSIS_DAYS + 1).toISOString(),
            daysSince: OVERDUE_DIAGNOSIS_DAYS + 1,
          },
        ]);
      });

      it("moves with the clock: the same diagnosis becomes overdue one day later", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G1, NOW);
        db.setNow(new Date(NOW.getTime() + OVERDUE_DIAGNOSIS_DAYS * DAY_MS));
        expect(asConsultant(await consultantHome()).overdue).toEqual([]);

        db.setNow(new Date(NOW.getTime() + (OVERDUE_DIAGNOSIS_DAYS + 1) * DAY_MS));

        expect(asConsultant(await consultantHome()).overdue.map((item) => item.companyId)).toEqual([companyId]);
      });

      it("turns overdue at the local midnight, not 24 hours after the diagnosis", async () => {
        const companyId = await createCompany();
        // Local calendar parts, so the case means the same in any time zone.
        await conclude(companyId, G1, new Date(2026, 6, 25, 23, 59));

        db.setNow(new Date(2026, 9, 23, 23, 59, 59));
        expect(asConsultant(await consultantHome()).overdue).toEqual([]);

        db.setNow(new Date(2026, 9, 24, 0, 0, 0));
        expect(asConsultant(await consultantHome()).overdue.map((item) => [item.companyId, item.daysSince])).toEqual([
          [companyId, 91],
        ]);
      });

      it("measures from the latest diagnosis that counts and lists the oldest first", async () => {
        const renewed = await createCompany("Renovada");
        const ancient = await createCompany("Antiga");
        const stale = await createCompany("Parada");
        await conclude(renewed, G1, daysBefore(NOW, 200));
        await conclude(renewed, G3, daysBefore(NOW, 10));
        await conclude(ancient, G1, daysBefore(NOW, 300));
        await conclude(stale, G1, daysBefore(NOW, 100));

        const { overdue } = asConsultant(await consultantHome());

        expect(overdue.map((item) => [item.name, item.daysSince])).toEqual([["Antiga", 300], ["Parada", 100]]);
      });

      it("counts again from the earlier diagnosis when the recent one is archived", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G1, daysBefore(NOW, 200));
        const recent = await conclude(companyId, G3, daysBefore(NOW, 10));
        expect(asConsultant(await consultantHome()).overdue).toEqual([]);

        await archiveDiagnosis(recent.id);

        expect(asConsultant(await consultantHome()).overdue.map((item) => [item.companyId, item.daysSince])).toEqual([
          [companyId, 200],
        ]);
      });

      it("does not list a company that never had a diagnosis: it has its own list", async () => {
        const companyId = await createCompany();
        await db.prisma.company.update({ where: { id: companyId }, data: { createdAt: daysBefore(NOW, 400) } });

        const home = asConsultant(await consultantHome());

        expect(home.overdue).toEqual([]);
        expect(home.withoutDiagnosis.map((item) => item.companyId)).toEqual([companyId]);
      });
    });

    // AC-ra-34 / AC-ra-36: the line "overdue" is drawn at the interval the user chose, for every company.
    describe("reevaluation interval (RULE-ra-07)", () => {
      it("says which interval the home was counted with", async () => {
        expect(asConsultant(await consultantHome()).reevaluationDays).toBe(OVERDUE_DIAGNOSIS_DAYS);

        await chooseInterval(180);

        expect(asConsultant(await consultantHome()).reevaluationDays).toBe(180);
      });

      it("moves the overdue list with the interval: the same diagnosis is late with 60 days and on time with 120", async () => {
        const companyId = await createCompany();
        const diagnosis = await conclude(companyId, G1, daysBefore(NOW, 100));

        await chooseInterval(60);
        expect(asConsultant(await consultantHome()).overdue).toEqual([
          expect.objectContaining({ companyId, diagnosisId: diagnosis.id, daysSince: 100 }),
        ]);

        await chooseInterval(90);
        expect(asConsultant(await consultantHome()).overdue.map((item) => item.companyId)).toEqual([companyId]);

        await chooseInterval(120);
        expect(asConsultant(await consultantHome()).overdue).toEqual([]);
      });

      it("keeps the line strict at each interval: the due day is on time, the next one is late", async () => {
        const onTheLine = await createCompany("Na linha");
        const pastTheLine = await createCompany("Passou da linha");
        await conclude(onTheLine, G1, daysBefore(NOW, 120));
        await conclude(pastTheLine, G1, daysBefore(NOW, 121));
        await chooseInterval(120);

        expect(asConsultant(await consultantHome()).overdue.map((item) => item.companyId)).toEqual([pastTheLine]);
      });
    });

    // AC-ra-35 / RULE-ra-06: the actions of the current plan past their deadline, company by company.
    describe("actions past their deadline", () => {
      const overdueActions = async () => asConsultant(await consultantHome()).overdueActions;

      it("lists the companies with an open action past its deadline, the most overdue first", async () => {
        const few = await createCompany("Academia Foco");
        const many = await createCompany("Zé Burguer");
        await createCompany("Em dia");
        const fewDiagnosis = await conclude(few, G1, daysBefore(NOW, 10));
        const manyDiagnosis = await conclude(many, G1, daysBefore(NOW, 10));
        await trackAction(fewDiagnosis.id, planOf(fewDiagnosis)[0], { dueDate: "2026-10-01" });
        for (const actionKey of planOf(manyDiagnosis).slice(0, 2)) {
          await trackAction(manyDiagnosis.id, actionKey, { status: "in_progress", dueDate: "2026-10-22" });
        }

        expect(await overdueActions()).toEqual([
          { companyId: many, name: "Zé Burguer", diagnosisId: manyDiagnosis.id, overdueCount: 2 },
          { companyId: few, name: "Academia Foco", diagnosisId: fewDiagnosis.id, overdueCount: 1 },
        ]);
      });

      it("follows the data: marking the action as done, or the deadline day arriving, moves the list", async () => {
        const companyId = await createCompany();
        const diagnosis = await conclude(companyId, G1, daysBefore(NOW, 10));
        const [late, dueToday] = planOf(diagnosis);
        await trackAction(diagnosis.id, late, { dueDate: "2026-10-22" });
        await trackAction(diagnosis.id, dueToday, { dueDate: "2026-10-23" });
        expect((await overdueActions()).map((item) => item.overdueCount)).toEqual([1]);

        db.setNow(new Date(NOW.getTime() + DAY_MS));
        expect((await overdueActions()).map((item) => item.overdueCount)).toEqual([2]);

        await trackAction(diagnosis.id, late, { status: "done" });
        await trackAction(diagnosis.id, dueToday, { status: "not_applicable" });
        expect(await overdueActions()).toEqual([]);
      });

      it("counts only the current plan of an active company", async () => {
        const companyId = await createCompany();
        const older = await conclude(companyId, G1, APRIL);
        await trackAction(older.id, planOf(older)[0], { dueDate: "2026-05-01" });
        expect((await overdueActions()).map((item) => item.diagnosisId)).toEqual([older.id]);

        // A newer diagnosis closes the plan: what repeats is inherited by the new one, what does not repeat stays closed.
        const newer = await conclude(companyId, G3, JULY);
        expect((await overdueActions()).every((item) => item.diagnosisId === newer.id)).toBe(true);

        await send("POST", `/api/companies/${companyId}/archive`);
        expect(await overdueActions()).toEqual([]);
      });

      it("stays empty while nothing was tracked on the plan", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G1, daysBefore(NOW, 200));

        expect(await overdueActions()).toEqual([]);
      });
    });

    describe("high risk", () => {
      it("lists the companies whose latest diagnosis carries a high risk, highest first", async () => {
        const risky = await createCompany("Zé Burguer");
        const healthy = await createCompany("Academia Foco");
        const riskyDiagnosis = await conclude(risky, G1, JULY);
        const healthyDiagnosis = await conclude(healthy, G3, JULY);
        const riskyResult = riskyDiagnosis.result as DiagnosisResult;
        expect(riskyResult.risks[0]).toMatchObject({ signalId: "SIG-01", score: 16, level: "high" });
        expect((healthyDiagnosis.result as DiagnosisResult).risks.some((risk) => risk.level === "high")).toBe(false);

        const { highRisk } = asConsultant(await consultantHome());

        expect(highRisk).toEqual([
          { companyId: risky, name: "Zé Burguer", diagnosisId: riskyDiagnosis.id, signalId: "SIG-01", riskScore: 16 },
        ]);
      });

      it("follows the latest diagnosis: a risk that was solved leaves the list, and returns with the archive", async () => {
        const companyId = await createCompany();
        await conclude(companyId, G1, APRIL);
        const solved = await conclude(companyId, G3, JULY);
        expect(asConsultant(await consultantHome()).highRisk).toEqual([]);

        await archiveDiagnosis(solved.id);

        expect(asConsultant(await consultantHome()).highRisk.map((item) => item.companyId)).toEqual([companyId]);
      });
    });

    it("answers each list from the same data, so a company can be in several of them", async () => {
      const companyId = await createCompany("Zé Burguer");
      await conclude(companyId, G1, daysBefore(NOW, 120));
      await startDraftLastTouchedAt(companyId, daysBefore(NOW, 15));

      const home = asConsultant(await consultantHome());

      expect(names(home.staleDrafts)).toEqual(["Zé Burguer"]);
      expect(names(home.overdue)).toEqual(["Zé Burguer"]);
      expect(names(home.highRisk)).toEqual(["Zé Burguer"]);
      expect(names(home.byStage[0].companies)).toEqual(["Zé Burguer"]);
      expect(home.withoutDiagnosis).toEqual([]);
    });
  });

  // AC-ra-15: the portfolio report and the consultant's home are counted by the same service, so the
  // PDF carries the numbers of the screen, whatever the day and the data.
  describe("portfolio report (AC-ra-15)", () => {
    const reports = () => createReportService({ prisma: db.prisma, downloadsDir: db.downloadsDir, now: db.now });

    const blocksOf = <K extends ReportBlock["kind"]>(document: ReportDocument, pageId: string, kind: K) =>
      (document.pages.find((page) => page.id === pageId)?.blocks ?? []).filter(
        (block): block is Extract<ReportBlock, { kind: K }> => block.kind === kind,
      );

    const listRows = (document: ReportDocument): string[][] =>
      document.pages
        .filter((page) => page.id.startsWith("companies-"))
        .flatMap((page) => blocksOf(document, page.id, "table").flatMap((table) => table.rows));

    const factsOf = (document: ReportDocument): Record<string, string> =>
      Object.fromEntries(blocksOf(document, "by-stage", "facts").flatMap((block) => block.items.map((item) => [item.label, item.value])));

    async function seedPortfolio(): Promise<void> {
      const late = await createCompany("Zé Burguer");
      const recent = await createCompany("Academia Foco");
      const alsoRisky = await createCompany("Ótica Lume");
      await createCompany("Padaria Nova");
      const archived = await createCompany("Arquivada Ltda");
      await conclude(late, G1, daysBefore(NOW, 120));
      await conclude(recent, G3, daysBefore(NOW, 10));
      await conclude(alsoRisky, G1, daysBefore(NOW, 20));
      await conclude(archived, G1, daysBefore(NOW, 200));
      expect((await send("POST", `/api/companies/${archived}/archive`)).status).toBe(200);
    }

    it("carries the numbers of the consultant home: the stages, the late, the high risk and who has no diagnosis", async () => {
      await seedPortfolio();
      const home = asConsultant(await consultantHome());

      const document = await reports().preview({ kind: "portfolio" });

      expect(document.kind).toBe("portfolio");
      expect(blocksOf(document, "cover", "cover")[0].facts[0]).toEqual({ label: "Empresas ativas", value: String(home.companyCount) });
      expect(blocksOf(document, "by-stage", "keyNumbers")[0].items.map((item) => item.value)).toEqual(
        home.byStage.map((group) => String(group.count)),
      );
      const count = (total: number): string => (total === 1 ? "1 empresa" : `${total} empresas`);
      expect(factsOf(document)).toEqual({
        "Sem diagnóstico concluído": count(home.withoutDiagnosis.length),
        "Reavaliação atrasada": count(home.overdue.length),
        "Risco alto": count(home.highRisk.length),
      });
      expect([home.withoutDiagnosis.length, home.overdue.length, home.highRisk.length]).toEqual([1, 1, 2]);
    });

    it("lists the same companies as the home, each with the stage, the date and what needs attention", async () => {
      await seedPortfolio();
      const home = asConsultant(await consultantHome());

      const rows = listRows(await reports().preview({ kind: "portfolio" }));

      const inHome = [...home.byStage.flatMap((group) => group.companies), ...home.withoutDiagnosis].map((item) => item.name).sort();
      expect(rows.map(([name]) => name).sort()).toEqual(inHome);
      expect(rows.map(([name]) => name)).not.toContain("Arquivada Ltda");
      expect(rows.filter(([, , attention]) => attention.includes("Reavaliação atrasada")).map(([name]) => name)).toEqual(names(home.overdue));
      expect(rows.filter(([, , attention]) => attention.includes("Risco alto")).map(([name]) => name).sort()).toEqual(names(home.highRisk).sort());
      expect(rows.find(([name]) => name === "Zé Burguer")).toEqual([
        "Zé Burguer",
        expect.stringMatching(/^Estágio 1 · \d{2}\/\d{2}\/\d{4}$/),
        "Reavaliação atrasada há 30 dias · Risco alto",
      ]);
      expect(rows.find(([name]) => name === "Padaria Nova")).toEqual(["Padaria Nova", "Sem diagnóstico", "—"]);
      expect(rows.find(([name]) => name === "Academia Foco")?.[2]).toBe("Em dia");
    });

    it("follows the clock the home follows: the same company turns late in both on the same day", async () => {
      const companyId = await createCompany("Academia Foco");
      await conclude(companyId, G3, NOW);
      const lateAt = new Date(NOW.getTime() + (OVERDUE_DIAGNOSIS_DAYS + 1) * DAY_MS);

      expect(asConsultant(await consultantHome()).overdue).toEqual([]);
      expect(factsOf(await reports().preview({ kind: "portfolio" }))["Reavaliação atrasada"]).toBe("0 empresas");

      db.setNow(lateAt);

      expect(asConsultant(await consultantHome()).overdue.map((item) => item.companyId)).toEqual([companyId]);
      const document = await reports().preview({ kind: "portfolio" });
      expect(factsOf(document)["Reavaliação atrasada"]).toBe("1 empresa");
      expect(listRows(document)[0][2]).toBe("Reavaliação atrasada há 1 dia");
    });

    it("saves carteira-{date}.pdf in the Downloads folder and registers it without a company", async () => {
      await seedPortfolio();

      const saved = await reports().export({ kind: "portfolio" });

      expect(saved.fileName).toBe("carteira-2026-10-23.pdf");
      expect(existsSync(path.join(saved.directory, saved.fileName))).toBe(true);
      const record = await db.prisma.generatedFile.findUnique({ where: { id: saved.fileId } });
      expect(record).toMatchObject({ kind: "portfolio_pdf", companyId: null, fileName: "carteira-2026-10-23.pdf" });
    });

    it("refuses the report when there is no active company: nothing to list, nothing saved", async () => {
      // The saved-file records are not part of the reset between tests.
      const savedBefore = await db.prisma.generatedFile.count();
      await expect(reports().preview({ kind: "portfolio" })).rejects.toMatchObject({ status: 409, code: "portfolio_empty" });

      const archived = await createCompany("Arquivada Ltda");
      await conclude(archived, G1, daysBefore(NOW, 30));
      await send("POST", `/api/companies/${archived}/archive`);

      await expect(reports().export({ kind: "portfolio" })).rejects.toMatchObject({ status: 409, code: "portfolio_empty" });
      expect(await db.prisma.generatedFile.count()).toBe(savedBefore);
    });
  });
});
