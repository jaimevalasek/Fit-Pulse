import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type DiagnosisInput,
} from "../../shared/domain/types.ts";
import { localIsoDate } from "../../shared/format/dates.ts";
import { createApp } from "../../server/app.ts";
import { createPrismaClient } from "../../server/db/prismaClient.ts";
import type { PrismaClient } from "../../server/generated/prisma/client.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-005: the action routes. Covers the tracking of the 3 actions of the current plan (AC-ra-26 to
// AC-ra-28 on the API side), the stored result that never changes (AC-ra-29, RULE-ra-01), the
// replaced plan that turns read-only (AC-ra-30), the empty company (AC-ra-63) and the plan that
// comes back when the latest diagnosis is archived or the company is deleted (AC-ra-32).

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

interface ActionBody {
  diagnosisId: string;
  actionKey: string;
  status: string;
  dueDate: string | null;
  ownerRole: string | null;
  note: string | null;
  overdue: boolean;
  inheritedFrom: { diagnosisId: string; completedAt: string } | null;
  updatedAt: string;
}

interface PlanBody {
  diagnosisId: string;
  completedAt: string;
  actions: ActionBody[];
}

interface CompanyActionsBody {
  current: PlanBody | null;
  closed: PlanBody[];
}

interface DiagnosisActionsBody {
  isCurrent: boolean;
  actions: ActionBody[];
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

const asError = (response: ApiResponse): ErrorBody["error"] => (response.body as ErrorBody).error;
const asAction = (response: ApiResponse): ActionBody => response.body as ActionBody;
const asCompanyActions = (response: ApiResponse): CompanyActionsBody => response.body as CompanyActionsBody;
const asDiagnosisActions = (response: ApiResponse): DiagnosisActionsBody => response.body as DiagnosisActionsBody;

// -------------------------------------------------- reference cases (PRD G1 and G2)

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// Plan under the rules of the app: cac, mp, mm.
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

// Plan under the rules of the app: re, dep, mp. "mp" repeats from G1.
const G2: DiagnosisInput = {
  answers: {
    mp1: 2, mp2: 2, mp3: 2, mp4: 2,
    pc1: 3, pc2: 2, pc3: 2,
    cm1: 2, cm2: 2,
    mm1: 2, mm2: 2,
    es1: 1,
    aq1: 3, aq2: 2, aq3: 2,
    en1: 2, en2: 2, en3: 2,
    co1: 2, co2: 2, co3: 2,
    re1: 2, re2: 0, re3: 1,
  },
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

const G1_PLAN = ["cac", "mp", "mm"];
const G2_PLAN = ["re", "dep", "mp"];

const FIRST_DAY = new Date("2026-10-23T12:00:00.000Z");
const SECOND_DAY = new Date("2026-11-23T12:00:00.000Z");

describe("action routes", () => {
  let db: TestDatabase;
  let server: RunningServer;

  const get = (path: string) => callApi(server.baseUrl, "GET", path);
  const send = (method: string, path: string, body?: unknown) => callApi(server.baseUrl, method, path, body);

  async function createCompany(name = "Academia Foco"): Promise<string> {
    const response = await send("POST", "/api/companies", { name, segment: "health_wellness", salesChannel: "subscription" });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function startDraft(companyId: string): Promise<string> {
    const response = await send("POST", `/api/companies/${companyId}/diagnoses`);
    expect([200, 201]).toContain(response.status);
    return (response.body as { id: string }).id;
  }

  // The path the owner takes: start, answer everything, conclude. Returns the diagnosis id.
  async function conclude(companyId: string, input: DiagnosisInput, at: Date = db.now()): Promise<string> {
    db.setNow(at);
    const id = await startDraft(companyId);
    expect((await send("PATCH", `/api/diagnoses/${id}`, input)).status).toBe(200);
    expect((await send("POST", `/api/diagnoses/${id}/complete`)).status).toBe(200);
    return id;
  }

  const patchAction = (diagnosisId: string, actionKey: string, body: unknown) =>
    send("PATCH", `/api/diagnoses/${diagnosisId}/actions/${actionKey}`, body);

  const actionsOf = async (diagnosisId: string) => asDiagnosisActions(await get(`/api/diagnoses/${diagnosisId}/actions`));

  const findAction = (actions: ActionBody[], actionKey: string): ActionBody => {
    const action = actions.find((candidate) => candidate.actionKey === actionKey);
    expect(action, `action ${actionKey}`).toBeDefined();
    return action as ActionBody;
  };

  // A second connection to the same file: what a restart of the app would read back.
  async function withFreshConnection<T>(read: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    const prisma = createPrismaClient(db.databaseUrl);
    try {
      return await read(prisma);
    } finally {
      await prisma.$disconnect();
    }
  }

  const countRows = (diagnosisId: string) => db.prisma.actionProgress.count({ where: { diagnosisId } });

  // A diagnosis completed before the tracking existed has no rows.
  const forgetTracking = (diagnosisId: string) => db.prisma.actionProgress.deleteMany({ where: { diagnosisId } });

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
    db.setNow(FIRST_DAY);
  });

  describe("GET /api/companies/:id/actions", () => {
    it("answers 404 company_not_found for a company that does not exist", async () => {
      const response = await get("/api/companies/nobody/actions");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
    });

    it("has no plan while the company has no completed diagnosis, and a draft has no actions (AC-ra-63)", async () => {
      const companyId = await createCompany();
      expect(asCompanyActions(await get(`/api/companies/${companyId}/actions`))).toEqual({ current: null, closed: [] });

      const draftId = await startDraft(companyId);

      expect(asCompanyActions(await get(`/api/companies/${companyId}/actions`))).toEqual({ current: null, closed: [] });
      expect(await countRows(draftId)).toBe(0);
    });

    it("lists the 3 actions of the new plan as 'A fazer', with no deadline, owner or note (AC-ra-26, RULE-ra-04)", async () => {
      const companyId = await createCompany();
      const diagnosisId = await conclude(companyId, G1);

      const view = asCompanyActions(await get(`/api/companies/${companyId}/actions`));

      expect(view.closed).toEqual([]);
      expect(view.current?.diagnosisId).toBe(diagnosisId);
      expect(view.current?.completedAt).toBe(FIRST_DAY.toISOString());
      expect(view.current?.actions.map((action) => action.actionKey)).toEqual(G1_PLAN);
      for (const action of view.current?.actions ?? []) {
        expect(action).toMatchObject({
          diagnosisId,
          status: "todo",
          dueDate: null,
          ownerRole: null,
          note: null,
          overdue: false,
          inheritedFrom: null,
        });
      }
    });

    it("splits the current plan from the closed ones, newest first, and leaves an archived diagnosis out of the closed", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      const second = await conclude(companyId, G2, SECOND_DAY);

      const view = asCompanyActions(await get(`/api/companies/${companyId}/actions`));
      expect(view.current?.diagnosisId).toBe(second);
      expect(view.current?.actions.map((action) => action.actionKey)).toEqual(G2_PLAN);
      expect(view.closed.map((plan) => plan.diagnosisId)).toEqual([first]);
      expect(view.closed[0]?.actions.map((action) => action.actionKey)).toEqual(G1_PLAN);

      await send("POST", `/api/diagnoses/${second}/archive`);
      const afterArchive = asCompanyActions(await get(`/api/companies/${companyId}/actions`));
      expect(afterArchive.current?.diagnosisId).toBe(first);
      expect(afterArchive.closed).toEqual([]);
    });

    it("keeps one company's actions out of another company's plan", async () => {
      const one = await createCompany("Academia Foco");
      const other = await createCompany("Studio Pulso");
      const oneDiagnosis = await conclude(one, G1);
      await conclude(other, G2);
      await patchAction(oneDiagnosis, "cac", { status: "done" });

      const view = asCompanyActions(await get(`/api/companies/${other}/actions`));

      expect(view.current?.actions.map((action) => action.actionKey)).toEqual(G2_PLAN);
      expect(view.current?.actions.every((action) => action.status === "todo")).toBe(true);
    });
  });

  describe("GET /api/diagnoses/:id/actions", () => {
    it("answers 404 diagnosis_not_found for an unknown diagnosis", async () => {
      const response = await get("/api/diagnoses/nobody/actions");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diagnosis_not_found");
    });

    it("answers 409 diagnosis_not_completed for a draft", async () => {
      const draftId = await startDraft(await createCompany());

      const response = await get(`/api/diagnoses/${draftId}/actions`);

      expect(response.status).toBe(409);
      expect(asError(response).code).toBe("diagnosis_not_completed");
    });

    it("marks the plan replaced by a newer diagnosis as closed, with the state the actions ended in (AC-ra-30)", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      await patchAction(first, "cac", { status: "done" });
      await patchAction(first, "mp", { status: "in_progress", dueDate: "2026-12-01", ownerRole: "sales_team", note: "Treinar a equipe" });
      const second = await conclude(companyId, G2, SECOND_DAY);

      const closed = await actionsOf(first);
      const current = await actionsOf(second);

      expect(current.isCurrent).toBe(true);
      expect(closed.isCurrent).toBe(false);
      expect(closed.actions.map((action) => [action.actionKey, action.status])).toEqual([
        ["cac", "done"],
        ["mp", "in_progress"],
        ["mm", "todo"],
      ]);
      expect(findAction(closed.actions, "mp")).toMatchObject({ dueDate: "2026-12-01", ownerRole: "sales_team", note: "Treinar a equipe" });
    });

    it("reads the actions of a diagnosis completed before the tracking existed as 'A fazer'", async () => {
      const first = await conclude(await createCompany(), G1);
      await forgetTracking(first);

      const view = await actionsOf(first);

      expect(view.isCurrent).toBe(true);
      expect(view.actions.map((action) => [action.actionKey, action.status, action.inheritedFrom])).toEqual([
        ["cac", "todo", null],
        ["mp", "todo", null],
        ["mm", "todo", null],
      ]);
      expect(view.actions.every((action) => action.updatedAt === FIRST_DAY.toISOString())).toBe(true);
      expect(await countRows(first)).toBe(0);
    });
  });

  describe("PATCH /api/diagnoses/:id/actions/:actionKey", () => {
    it("saves the state at once, keeps it after a reload and goes back when it is undone (AC-ra-27)", async () => {
      const diagnosisId = await conclude(await createCompany(), G1);

      const changed = await patchAction(diagnosisId, "mp", { status: "in_progress" });
      expect(changed.status).toBe(200);
      expect(asAction(changed)).toMatchObject({ diagnosisId, actionKey: "mp", status: "in_progress" });

      const reloaded = await withFreshConnection((prisma) =>
        prisma.actionProgress.findUniqueOrThrow({ where: { diagnosisId_actionKey: { diagnosisId, actionKey: "mp" } } }),
      );
      expect(reloaded.status).toBe("in_progress");
      expect(findAction((await actionsOf(diagnosisId)).actions, "mp").status).toBe("in_progress");

      const undone = await patchAction(diagnosisId, "mp", { status: "todo" });
      expect(asAction(undone).status).toBe("todo");
      expect(findAction((await actionsOf(diagnosisId)).actions, "mp").status).toBe("todo");
    });

    it("changes only the action and the fields it carries (AC-ra-28)", async () => {
      const diagnosisId = await conclude(await createCompany(), G1);
      await patchAction(diagnosisId, "mm", { status: "done" });

      const response = await patchAction(diagnosisId, "mp", { dueDate: "2026-12-15", ownerRole: "marketing_team", note: "Ligar para a agência" });

      expect(response.status).toBe(200);
      expect(asAction(response)).toMatchObject({
        status: "todo",
        dueDate: "2026-12-15",
        ownerRole: "marketing_team",
        note: "Ligar para a agência",
        inheritedFrom: null,
      });
      const { actions } = await actionsOf(diagnosisId);
      expect(findAction(actions, "cac")).toMatchObject({ status: "todo", dueDate: null, ownerRole: null, note: null });
      expect(findAction(actions, "mm")).toMatchObject({ status: "done", dueDate: null, ownerRole: null, note: null });

      // A later edit of one field leaves the others as they were.
      await patchAction(diagnosisId, "mp", { status: "in_progress" });
      expect(findAction((await actionsOf(diagnosisId)).actions, "mp")).toMatchObject({
        status: "in_progress",
        dueDate: "2026-12-15",
        ownerRole: "marketing_team",
        note: "Ligar para a agência",
      });
    });

    it("clears a deadline, an owner and a note sent as null, and an empty note reads as no note", async () => {
      const diagnosisId = await conclude(await createCompany(), G1);
      await patchAction(diagnosisId, "mp", { dueDate: "2026-12-15", ownerRole: "owner", note: "  Ligar hoje  " });
      expect(findAction((await actionsOf(diagnosisId)).actions, "mp").note).toBe("Ligar hoje");

      expect(asAction(await patchAction(diagnosisId, "mp", { note: "   " })).note).toBeNull();
      const cleared = asAction(await patchAction(diagnosisId, "mp", { dueDate: null, ownerRole: null }));

      expect(cleared).toMatchObject({ dueDate: null, ownerRole: null, note: null });
    });

    it("accepts a note of 500 characters and refuses 501 (AC-ra-28)", async () => {
      const diagnosisId = await conclude(await createCompany(), G1);

      expect((await patchAction(diagnosisId, "mp", { note: "a".repeat(500) })).status).toBe(200);
      const tooLong = await patchAction(diagnosisId, "mp", { note: "a".repeat(501) });

      expect(tooLong.status).toBe(400);
      expect(asError(tooLong).fields?.note).toBeDefined();
      expect(findAction((await actionsOf(diagnosisId)).actions, "mp").note).toBe("a".repeat(500));
    });

    it.each([
      ["a state that does not exist", { status: "paused" }, "status"],
      ["a date that does not exist", { dueDate: "2026-02-30" }, "dueDate"],
      ["a date in the screen format", { dueDate: "31/12/2026" }, "dueDate"],
      ["a date that is not text", { dueDate: 20261231 }, "dueDate"],
      ["a person's name as owner", { ownerRole: "João da Silva" }, "ownerRole"],
      ["a field for the owner's name", { ownerName: "João" }, "_root"],
      ["the result of the diagnosis", { result: {} }, "_root"],
      ["another diagnosis", { diagnosisId: "other" }, "_root"],
    ])("refuses %s with 400 validation_failed and stores nothing", async (_name, body, field) => {
      const diagnosisId = await conclude(await createCompany(), G1);

      const response = await patchAction(diagnosisId, "mp", body);

      expect(response.status).toBe(400);
      expect(asError(response).code).toBe("validation_failed");
      expect(asError(response).fields?.[field]).toBeDefined();
      expect(findAction((await actionsOf(diagnosisId)).actions, "mp")).toMatchObject({ status: "todo", dueDate: null, ownerRole: null });
    });

    it("answers 404 for an unknown diagnosis and for an action that is not in the plan", async () => {
      const diagnosisId = await conclude(await createCompany(), G1);

      const unknownDiagnosis = await patchAction("nobody", "mp", { status: "done" });
      const notInPlan = await patchAction(diagnosisId, "aq", { status: "done" });
      const notAnAction = await patchAction(diagnosisId, "nope", { status: "done" });

      expect([unknownDiagnosis.status, asError(unknownDiagnosis).code]).toEqual([404, "diagnosis_not_found"]);
      expect([notInPlan.status, asError(notInPlan).code]).toEqual([404, "action_not_found"]);
      expect([notAnAction.status, asError(notAnAction).code]).toEqual([404, "action_not_found"]);
      expect(await countRows(diagnosisId)).toBe(3);
    });

    it("answers 409 diagnosis_not_completed for a draft", async () => {
      const draftId = await startDraft(await createCompany());

      const response = await patchAction(draftId, "mp", { status: "done" });

      expect([response.status, asError(response).code]).toEqual([409, "diagnosis_not_completed"]);
    });

    it("answers 409 plan_closed for a plan replaced by a newer diagnosis and changes nothing (AC-ra-30)", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      await conclude(companyId, G2, SECOND_DAY);

      const response = await patchAction(first, "cac", { status: "done" });

      expect([response.status, asError(response).code]).toEqual([409, "plan_closed"]);
      expect(findAction((await actionsOf(first)).actions, "cac").status).toBe("todo");
    });

    it("counts an action as overdue only with a past deadline and 'A fazer' or 'Em andamento' (RULE-ra-06)", async () => {
      const diagnosisId = await conclude(await createCompany(), G1);
      const today = localIsoDate(db.now()) as string;

      const overdueOf = async (patch: Record<string, unknown>) => asAction(await patchAction(diagnosisId, "mp", patch)).overdue;

      expect(await overdueOf({ status: "todo", dueDate: "2020-01-01" })).toBe(true);
      expect(await overdueOf({ status: "in_progress" })).toBe(true);
      expect(await overdueOf({ status: "done" })).toBe(false);
      expect(await overdueOf({ status: "not_applicable" })).toBe(false);
      expect(await overdueOf({ status: "todo", dueDate: today })).toBe(false);
      expect(await overdueOf({ dueDate: "2999-12-31" })).toBe(false);
      expect(await overdueOf({ dueDate: null })).toBe(false);
    });

    it("never counts the actions of a closed plan as overdue", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      await patchAction(first, "mp", { dueDate: "2020-01-01" });
      const second = await conclude(companyId, G2, SECOND_DAY);

      expect(findAction((await actionsOf(first)).actions, "mp").overdue).toBe(false);
      expect(findAction((await actionsOf(second)).actions, "mp").overdue).toBe(true);
    });

    it("creates the row on the first edit of a diagnosis completed before the tracking existed", async () => {
      const first = await conclude(await createCompany(), G1);
      await forgetTracking(first);

      const response = await patchAction(first, "mp", { status: "done" });

      expect(response.status).toBe(200);
      expect(await countRows(first)).toBe(1);
      expect((await actionsOf(first)).actions.map((action) => [action.actionKey, action.status])).toEqual([
        ["cac", "todo"],
        ["mp", "done"],
        ["mm", "todo"],
      ]);
    });

    it("writes nothing for an empty patch", async () => {
      const first = await conclude(await createCompany(), G1);
      await forgetTracking(first);

      const response = await patchAction(first, "mp", {});

      expect(response.status).toBe(200);
      expect(asAction(response)).toMatchObject({ status: "todo", dueDate: null });
      expect(await countRows(first)).toBe(0);
    });

    it("keeps both changes when two first edits of the same action arrive at the same time", async () => {
      const first = await conclude(await createCompany(), G1);
      await forgetTracking(first);

      const responses = await Promise.all([
        patchAction(first, "mp", { status: "in_progress" }),
        patchAction(first, "mp", { note: "Combinado por telefone" }),
      ]);

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(await countRows(first)).toBe(1);
      expect(findAction((await actionsOf(first)).actions, "mp")).toMatchObject({ status: "in_progress", note: "Combinado por telefone" });
    });
  });

  describe("the stored result never changes (AC-ra-29, RULE-ra-01)", () => {
    const snapshotOf = async (id: string) => JSON.stringify(await db.prisma.diagnosis.findUniqueOrThrow({ where: { id } }));

    it("leaves the diagnosis and its comparison as they were after the tracking changes (AC-ra-29)", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      const second = await conclude(companyId, G2, SECOND_DAY);
      const rowBefore = await snapshotOf(first);
      const resultBefore = (await get(`/api/diagnoses/${first}`)).body;
      const comparisonBefore = (await get(`/api/diagnoses/${second}/comparison`)).body;
      const secondBefore = await snapshotOf(second);

      await patchAction(second, "mp", { status: "done", dueDate: "2026-12-31", ownerRole: "owner", note: "Feito" });
      await patchAction(second, "re", { status: "not_applicable" });

      expect(await snapshotOf(first)).toBe(rowBefore);
      expect(await snapshotOf(second)).toBe(secondBefore);
      expect((await get(`/api/diagnoses/${first}`)).body).toEqual(resultBefore);
      expect((await get(`/api/diagnoses/${second}/comparison`)).body).toEqual(comparisonBefore);
    });

    it("leaves the earlier diagnosis and its comparison as they were when a new diagnosis is concluded", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      const second = await conclude(companyId, G2, SECOND_DAY);
      await patchAction(second, "mp", { status: "in_progress" });
      const firstBefore = await snapshotOf(first);
      const secondBefore = await snapshotOf(second);
      const comparisonBefore = (await get(`/api/diagnoses/${second}/comparison`)).body;

      await conclude(companyId, G1, new Date("2026-12-23T12:00:00.000Z"));

      expect(await snapshotOf(first)).toBe(firstBefore);
      expect(await snapshotOf(second)).toBe(secondBefore);
      expect((await get(`/api/diagnoses/${second}/comparison`)).body).toEqual(comparisonBefore);
    });
  });

  describe("archive, restore and delete (AC-ra-32)", () => {
    it("brings the earlier plan back as the current one, with its tracking, and restores the situation", async () => {
      const companyId = await createCompany();
      const first = await conclude(companyId, G1);
      await patchAction(first, "mp", { status: "in_progress", dueDate: "2026-12-01", ownerRole: "consultant", note: "Revisar o funil" });
      const second = await conclude(companyId, G2, SECOND_DAY);
      await patchAction(second, "re", { status: "done" });

      await send("POST", `/api/diagnoses/${second}/archive`);

      const archivedView = await actionsOf(second);
      expect(archivedView.isCurrent).toBe(false);
      expect(asCompanyActions(await get(`/api/companies/${companyId}/actions`)).current?.diagnosisId).toBe(first);
      const back = await actionsOf(first);
      expect(back.isCurrent).toBe(true);
      expect(findAction(back.actions, "mp")).toMatchObject({
        status: "in_progress",
        dueDate: "2026-12-01",
        ownerRole: "consultant",
        note: "Revisar o funil",
      });
      expect((await patchAction(first, "cac", { status: "done" })).status).toBe(200);
      const archivedEdit = await patchAction(second, "re", { status: "todo" });
      expect([archivedEdit.status, asError(archivedEdit).code]).toEqual([409, "plan_closed"]);

      await send("POST", `/api/diagnoses/${second}/restore`);

      const restored = asCompanyActions(await get(`/api/companies/${companyId}/actions`));
      expect(restored.current?.diagnosisId).toBe(second);
      expect(findAction(restored.current?.actions ?? [], "re").status).toBe("done");
      expect(restored.closed.map((plan) => plan.diagnosisId)).toEqual([first]);
      expect(findAction(restored.closed[0]?.actions ?? [], "cac").status).toBe("done");
      expect((await actionsOf(first)).isCurrent).toBe(false);
    });

    it("deletes the tracking of the company's actions with the company and keeps the other company's", async () => {
      const doomed = await createCompany("Academia Foco");
      const kept = await createCompany("Studio Pulso");
      const doomedFirst = await conclude(doomed, G1);
      const doomedSecond = await conclude(doomed, G2, SECOND_DAY);
      const keptDiagnosis = await conclude(kept, G1, SECOND_DAY);
      await patchAction(doomedSecond, "mp", { status: "done" });
      expect((await countRows(doomedFirst)) + (await countRows(doomedSecond))).toBe(6);

      expect((await send("POST", `/api/companies/${doomed}/archive`)).status).toBe(200);
      expect((await send("DELETE", `/api/companies/${doomed}`)).status).toBe(204);

      expect((await countRows(doomedFirst)) + (await countRows(doomedSecond))).toBe(0);
      expect(await countRows(keptDiagnosis)).toBe(3);
      expect((await get(`/api/companies/${doomed}/actions`)).status).toBe(404);
    });
  });
});
