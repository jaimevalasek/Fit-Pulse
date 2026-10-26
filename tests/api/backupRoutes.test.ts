import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { Express } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type DiagnosisInput,
} from "../../shared/domain/types.ts";
import { createApp } from "../../server/app.ts";
import { BACKUP_FORMAT, BACKUP_FORMAT_VERSION, BACKUP_SCHEMA_VERSION } from "../../server/validation/backupSchemas.ts";
import { rulesV2 } from "../fixtures/rulesV2.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-009: `POST /api/backup/export` and `POST /api/backup/import` (AC-dm-37, RULE-dm-18).
// A history built through the real routes is exported, imported into another, empty database
// and compared record by record; importing never deletes or overwrites; a file that is invalid
// or from a newer app is refused with a message and nothing changes.

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
async function callApi(baseUrl: string, method: string, requestPath: string, body?: unknown): Promise<ApiResponse> {
  const isWrite = method !== "GET";
  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers: isWrite ? { "content-type": "application/json" } : undefined,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? null : JSON.parse(text) };
}

interface Environment {
  db: TestDatabase;
  server: RunningServer;
  send(method: string, requestPath: string, body?: unknown): Promise<ApiResponse>;
}

interface Counts {
  companies: number;
  diagnoses: number;
}

// What export and import report: every kind of record the file carries.
interface FullCounts extends Counts {
  actions: number;
  diaryEntries: number;
  questionnaireSends: number;
  brand: number;
  reevaluationInterval: number;
}

const NO_RECORDS: FullCounts = { companies: 0, diagnoses: 0, actions: 0, diaryEntries: 0, questionnaireSends: 0, brand: 0, reevaluationInterval: 0 };
const counts = (some: Partial<FullCounts>): FullCounts => ({ ...NO_RECORDS, ...some });

// The backup file, loosely typed: the tests tamper with it on purpose.
type BackupBody = {
  format: string;
  formatVersion: number;
  schemaVersion: number;
  rulesVersion: number;
  exportedAt: string;
  companies: Array<Record<string, unknown> & { id: string; name: string }>;
  diagnoses: Array<Record<string, unknown> & { id: string; companyId: string; status: string }>;
  actionProgress: Array<Record<string, unknown> & { id: string; diagnosisId: string; actionKey: string }>;
  diaryEntries: Array<Record<string, unknown> & { id: string; companyId: string; month: string }>;
  questionnaireSends: Array<Record<string, unknown> & { id: string; companyId: string }>;
  brand: (Record<string, unknown> & { logo: Record<string, unknown> | null }) | null;
  reevaluationIntervalDays: number | null;
} & Record<string, unknown>;

interface ExportBody extends FullCounts {
  fileName: string;
  directory: string;
}

interface ImportBody {
  imported: FullCounts;
  skipped: FullCounts;
}

const asError = (response: ApiResponse): { code: string; message: string; rulesVersion?: number } =>
  (response.body as { error: { code: string; message: string; rulesVersion?: number } }).error;

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// Stage 1, locked by the customer cost, two risks.
const LOW_SCORE: DiagnosisInput = {
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

// Stage 4, no lock and no risk.
const HIGH_SCORE: DiagnosisInput = {
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

// 12:00 UTC is the same calendar day in every time zone the owner can be in.
const OCTOBER_20 = new Date("2026-10-20T12:00:00.000Z");
const OCTOBER_23 = new Date("2026-10-23T12:00:00.000Z");
const BACKUP_FILE_NAME = "fitpulse-copia-2026-10-23.json";

async function createEnvironment(rules?: typeof rulesV2): Promise<Environment> {
  const db = await createTestDatabase({ now: OCTOBER_23 });
  const server = await startServer(createApp({ ...db, rules, backendPort: 4330 }));
  return { db, server, send: (method, requestPath, body) => callApi(server.baseUrl, method, requestPath, body) };
}

async function disposeEnvironment(environment: Environment): Promise<void> {
  await environment.server.close();
  await environment.db.dispose();
}

async function createCompany(env: Environment, name: string, extra: Record<string, unknown> = {}): Promise<string> {
  const response = await env.send("POST", "/api/companies", {
    name,
    segment: "health_wellness",
    salesChannel: "subscription",
    ...extra,
  });
  expect(response.status).toBe(201);
  return (response.body as { id: string }).id;
}

async function startDraft(env: Environment, companyId: string): Promise<string> {
  const response = await env.send("POST", `/api/companies/${companyId}/diagnoses`);
  expect([200, 201]).toContain(response.status);
  return (response.body as { id: string }).id;
}

// The path the owner takes: start, answer everything, conclude.
async function conclude(env: Environment, companyId: string, input: DiagnosisInput, on: Date): Promise<string> {
  env.db.setNow(on);
  const id = await startDraft(env, companyId);
  expect((await env.send("PATCH", `/api/diagnoses/${id}`, input)).status).toBe(200);
  expect((await env.send("POST", `/api/diagnoses/${id}/complete`)).status).toBe(200);
  env.db.setNow(OCTOBER_23);
  return id;
}

interface SeededHistory {
  activeCompanyId: string;
  archivedCompanyId: string;
  archivedDiagnosisId: string;
  concludedDiagnosisId: string;
  draftId: string;
}

// An active company with two completed diagnoses (one of them archived), and an archived
// company with an open, half-answered draft: every state a backup has to carry.
async function seedHistory(env: Environment): Promise<SeededHistory> {
  const activeCompanyId = await createCompany(env, "Academia Foco", { cnpj: "11.444.777/0001-61", annualRevenueRange: "up_to_4_8m" });
  const archivedDiagnosisId = await conclude(env, activeCompanyId, LOW_SCORE, OCTOBER_20);
  const concludedDiagnosisId = await conclude(env, activeCompanyId, HIGH_SCORE, OCTOBER_23);
  expect((await env.send("POST", `/api/diagnoses/${archivedDiagnosisId}/archive`)).status).toBe(200);

  const archivedCompanyId = await createCompany(env, "Loja Aurora");
  const draftId = await startDraft(env, archivedCompanyId);
  expect((await env.send("PATCH", `/api/diagnoses/${draftId}`, { answers: { aq1: 2 }, currentBlock: 3 })).status).toBe(200);
  expect((await env.send("POST", `/api/companies/${archivedCompanyId}/archive`)).status).toBe(200);
  return { activeCompanyId, archivedCompanyId, archivedDiagnosisId, concludedDiagnosisId, draftId };
}

// A 1x1 PNG: a real image for the brand logo, small enough to read in the file.
const BRAND_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const ZERO_ID = "00000000-0000-4000-8000-000000000000";

interface SeededFollowUp {
  repeatCompanyId: string;
  firstPlanId: string;
  secondPlanId: string;
  plan: string[];
}

// What part 2 adds on top of `seedHistory`, through the real routes: the interval, the brand with its logo, a
// company concluded twice with the same answers (the second plan inherits the progress of the first), two diary
// months of the active company (one by parts, one by total) and a questionnaire file sent to it.
async function seedFollowUp(env: Environment, history: SeededHistory): Promise<SeededFollowUp> {
  expect((await env.send("PUT", "/api/preferences", { reevaluationIntervalDays: 120 })).status).toBe(200);
  const brand = { name: "Marina Costa Consultoria", phone: "(11) 91234-5678", email: "marina@costaconsultoria.com.br", website: "https://costaconsultoria.com.br" };
  expect((await env.send("PUT", "/api/brand", brand)).status).toBe(200);
  expect((await env.send("PUT", "/api/brand/logo", { mimeType: "image/png", dataBase64: BRAND_PNG })).status).toBe(200);

  const repeatCompanyId = await createCompany(env, "Clínica Vida");
  const firstPlanId = await conclude(env, repeatCompanyId, LOW_SCORE, OCTOBER_20);
  const plan = ((await env.send("GET", `/api/diagnoses/${firstPlanId}`)).body as { result: { plan: string[] } }).result.plan;
  const tracked = { status: "in_progress", dueDate: "2026-11-30", ownerRole: "sales_team", note: "Falar com o time" };
  expect((await env.send("PATCH", `/api/diagnoses/${firstPlanId}/actions/${plan[0]}`, tracked)).status).toBe(200);
  const secondPlanId = await conclude(env, repeatCompanyId, LOW_SCORE, OCTOBER_23);

  const diary = `/api/companies/${history.activeCompanyId}/diary`;
  expect((await env.send("POST", diary, { month: "2026-09", newCustomers: 12, spendParts: { ads: 500_000, tools: 20_000 } })).status).toBe(201);
  expect((await env.send("POST", diary, { month: "2026-08", newCustomers: 7, spendTotalCents: 1_234_500 })).status).toBe(201);
  expect((await env.send("POST", `/api/companies/${history.activeCompanyId}/questionnaire`, {})).status).toBe(200);
  return { repeatCompanyId, firstPlanId, secondPlanId, plan };
}

async function countsOf(env: Environment): Promise<Counts> {
  return { companies: await env.db.prisma.company.count(), diagnoses: await env.db.prisma.diagnosis.count() };
}

// Every stored column, in a fixed order, to compare two databases (or one with itself over time).
async function snapshotOf(env: Environment) {
  return {
    companies: await env.db.prisma.company.findMany({ orderBy: { id: "asc" } }),
    diagnoses: await env.db.prisma.diagnosis.findMany({ orderBy: { id: "asc" } }),
    actionProgress: await env.db.prisma.actionProgress.findMany({ orderBy: { id: "asc" } }),
    diaryEntries: await env.db.prisma.diaryEntry.findMany({ orderBy: { id: "asc" } }),
    questionnaireSends: await env.db.prisma.questionnaireSend.findMany({ orderBy: { id: "asc" } }),
    preferences: await env.db.prisma.preference.findMany({ orderBy: { key: "asc" } }),
  };
}

// The action rows a completed diagnosis is born with: the seeded history holds this many.
const actionCount = (env: Environment) => env.db.prisma.actionProgress.count();

async function exportBackup(env: Environment): Promise<{ response: ApiResponse; file: BackupBody }> {
  const response = await env.send("POST", "/api/backup/export");
  expect(response.status).toBe(200);
  const { fileName } = response.body as ExportBody;
  const file = JSON.parse(readFileSync(path.join(env.db.downloadsDir, fileName), "utf8")) as BackupBody;
  return { response, file };
}

const importBackup = (env: Environment, body: unknown) => env.send("POST", "/api/backup/import", body);

const clone = <T>(value: T): T => structuredClone(value);

describe("backup routes", () => {
  let source: Environment;
  let target: Environment;
  const environments = (): Environment[] => [source, target];

  beforeAll(async () => {
    source = await createEnvironment();
    target = await createEnvironment();
  });

  afterAll(async () => {
    await disposeEnvironment(source);
    await disposeEnvironment(target);
  });

  beforeEach(async () => {
    for (const env of environments()) {
      await env.db.resetData();
      env.db.setNow(OCTOBER_23);
      // Each test starts with an empty Downloads folder.
      rmSync(env.db.downloadsDir, { recursive: true, force: true });
      mkdirSync(env.db.downloadsDir);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/backup/export", () => {
    it("saves fitpulse-copia-{date}.json with the marks, every company and every diagnosis", async () => {
      const seeded = await seedHistory(source);
      const before = await snapshotOf(source);

      const { response, file } = await exportBackup(source);

      expect(response.body).toEqual({
        fileName: BACKUP_FILE_NAME,
        directory: source.db.downloadsDir,
        ...counts({ companies: 2, diagnoses: 3, actions: await actionCount(source) }),
      });
      expect(file).toMatchObject({
        format: BACKUP_FORMAT,
        formatVersion: BACKUP_FORMAT_VERSION,
        schemaVersion: BACKUP_SCHEMA_VERSION,
        rulesVersion: 1,
        exportedAt: OCTOBER_23.toISOString(),
      });
      expect(file.companies.map((company) => company.name).sort()).toEqual(["Academia Foco", "Loja Aurora"]);
      expect(file.diagnoses.map((diagnosis) => diagnosis.id).sort()).toEqual(
        [seeded.archivedDiagnosisId, seeded.concludedDiagnosisId, seeded.draftId].sort(),
      );
      // Reading everything changes nothing.
      expect(await snapshotOf(source)).toEqual(before);
    });

    it("exports an empty database as a valid file with no records", async () => {
      const { response, file } = await exportBackup(source);

      expect(response.body).toMatchObject({ fileName: BACKUP_FILE_NAME, companies: 0, diagnoses: 0 });
      expect(file.companies).toEqual([]);
      expect(file.diagnoses).toEqual([]);
      // ...and that file is accepted again.
      expect((await importBackup(target, file)).body).toEqual({ imported: NO_RECORDS, skipped: NO_RECORDS });
    });

    it("keeps the file of an earlier export: the second one gets a numbered name", async () => {
      await createCompany(source, "Academia Foco");
      await exportBackup(source);
      const firstContent = readFileSync(path.join(source.db.downloadsDir, BACKUP_FILE_NAME), "utf8");
      await createCompany(source, "Loja Aurora");

      const second = await source.send("POST", "/api/backup/export");

      expect(second.body).toMatchObject({ fileName: "fitpulse-copia-2026-10-23 (2).json", companies: 2 });
      expect(readFileSync(path.join(source.db.downloadsDir, BACKUP_FILE_NAME), "utf8")).toBe(firstContent);
      expect(readdirSync(source.db.downloadsDir).sort()).toEqual([BACKUP_FILE_NAME, "fitpulse-copia-2026-10-23 (2).json"].sort());
    });

    it("answers 500 write_failed with a message and leaves no file when the folder cannot be written", async () => {
      await seedHistory(source);
      const before = await snapshotOf(source);
      // A regular file where the folder should be: the folder can be neither found nor created.
      const blocker = path.join(source.db.downloadsDir, "ocupado");
      writeFileSync(blocker, "não sou uma pasta");
      const session = await startServer(createApp({ ...source.db, downloadsDir: blocker, backendPort: 4331 }));
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        const response = await callApi(session.baseUrl, "POST", "/api/backup/export");

        expect(response.status).toBe(500);
        expect(asError(response).code).toBe("write_failed");
        expect(asError(response).message).toMatch(/Downloads/);
        expect(readFileSync(blocker, "utf8")).toBe("não sou uma pasta");
        expect(readdirSync(source.db.downloadsDir)).toEqual(["ocupado"]);
        expect(await snapshotOf(source)).toEqual(before);
      } finally {
        await session.close();
      }
    });
  });

  describe("round trip: export, then import in another installation (AC-dm-37)", () => {
    it("reproduces the same companies, diagnoses and results in an empty database", async () => {
      const seeded = await seedHistory(source);
      const { file } = await exportBackup(source);

      const response = await importBackup(target, file);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        imported: counts({ companies: 2, diagnoses: 3, actions: await actionCount(source) }),
        skipped: NO_RECORDS,
      });
      // Every column, timestamps and frozen results included, is the one that was exported.
      expect(await snapshotOf(target)).toEqual(await snapshotOf(source));
      // And the app answers from it as it did before: timelines and a stored result.
      for (const companyId of [seeded.activeCompanyId, seeded.archivedCompanyId]) {
        const timeline = await target.send("GET", `/api/companies/${companyId}/timeline`);
        expect(timeline.status).toBe(200);
        expect(timeline.body).toEqual((await source.send("GET", `/api/companies/${companyId}/timeline`)).body);
      }
      const result = await target.send("GET", `/api/diagnoses/${seeded.concludedDiagnosisId}`);
      expect(result.body).toEqual((await source.send("GET", `/api/diagnoses/${seeded.concludedDiagnosisId}`)).body);
      expect(result.body).toMatchObject({ status: "completed", result: { stage: 4 } });
      // The imported draft is still the company's open draft, with its answers.
      const draft = await target.send("GET", `/api/diagnoses/${seeded.draftId}`);
      expect(draft.body).toMatchObject({ status: "draft", currentBlock: 3, answers: { aq1: 2 } });
    });

    it("accepts a history far above 1 MB: only this route takes up to 10 MB", async () => {
      await createCompany(source, "Academia Foco");
      const { file } = await exportBackup(source);
      const [template] = file.companies;
      file.companies = Array.from({ length: 5_000 }, (_, index) => ({
        ...template,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      }));
      const body = JSON.stringify(file);
      expect(body.length).toBeGreaterThan(1_100_000);

      const response = await importBackup(target, body);

      expect(response.status).toBe(200);
      expect((response.body as ImportBody).imported).toEqual(counts({ companies: 5_000 }));
      expect(await countsOf(target)).toEqual({ companies: 5_000, diagnoses: 0 });
      // The 1 MB limit of the rest of the API is untouched.
      const tooLarge = await target.send("POST", "/api/companies", JSON.stringify({ name: "x".repeat(1_100_000) }));
      expect(tooLarge.status).toBe(413);
    });

    it("answers 413 above 10 MB and changes nothing", async () => {
      const response = await importBackup(target, JSON.stringify({ format: BACKUP_FORMAT, filler: "x".repeat(10 * 1024 * 1024 + 1024) }));

      expect(response.status).toBe(413);
      expect(asError(response).code).toBe("payload_too_large");
      expect(await countsOf(target)).toEqual({ companies: 0, diagnoses: 0 });
    });
  });

  describe("importing never deletes or overwrites (RULE-dm-18)", () => {
    it("importing the same file twice adds nothing the second time", async () => {
      await seedHistory(source);
      const { file } = await exportBackup(source);
      expect((await importBackup(target, file)).status).toBe(200);
      const afterFirst = await snapshotOf(target);

      const second = await importBackup(target, file);

      expect(second.status).toBe(200);
      expect(second.body).toEqual({
        imported: NO_RECORDS,
        skipped: counts({ companies: 2, diagnoses: 3, actions: await actionCount(source) }),
      });
      expect(await snapshotOf(target)).toEqual(afterFirst);
    });

    it("adds to what the installation already has: other companies stay, same ids keep their current data", async () => {
      const seeded = await seedHistory(source);
      const { file } = await exportBackup(source);
      const ownCompanyId = await createCompany(target, "Estúdio Próprio");
      const ownDiagnosisId = await conclude(target, ownCompanyId, HIGH_SCORE, OCTOBER_23);
      // The same company already exists here, edited after the backup was made.
      await target.db.prisma.company.create({
        data: { id: seeded.activeCompanyId, name: "Academia Foco (editada)", segment: "health_wellness", salesChannel: "subscription" },
      });
      const ownSnapshot = await snapshotOf(target);

      const response = await importBackup(target, file);

      expect(response.body).toEqual({
        imported: counts({ companies: 1, diagnoses: 3, actions: await actionCount(source) }),
        skipped: counts({ companies: 1 }),
      });
      const after = await snapshotOf(target);
      // Nothing that was here changed...
      for (const row of ownSnapshot.companies) {
        expect(after.companies).toContainEqual(row);
      }
      for (const row of ownSnapshot.diagnoses) {
        expect(after.diagnoses).toContainEqual(row);
      }
      expect(after.companies.find((company) => company.id === seeded.activeCompanyId)?.name).toBe("Academia Foco (editada)");
      expect(after.diagnoses.some((diagnosis) => diagnosis.id === ownDiagnosisId)).toBe(true);
      // ...and what was missing arrived, the diagnoses of the existing company included.
      expect(after.companies).toHaveLength(3);
      expect(after.diagnoses).toHaveLength(4);
    });

    it("brings back only the records that were removed since the backup", async () => {
      const seeded = await seedHistory(source);
      const { file } = await exportBackup(source);
      await source.db.prisma.diagnosis.delete({ where: { id: seeded.draftId } });
      const before = await snapshotOf(source);

      const response = await importBackup(source, file);

      // The draft has no action rows: every action the file holds is still here.
      expect(response.body).toEqual({
        imported: counts({ diagnoses: 1 }),
        skipped: counts({ companies: 2, diagnoses: 2, actions: await actionCount(source) }),
      });
      const after = await snapshotOf(source);
      expect(after.companies).toEqual(before.companies);
      expect(after.diagnoses.map((diagnosis) => diagnosis.id).sort()).toEqual(
        [seeded.archivedDiagnosisId, seeded.concludedDiagnosisId, seeded.draftId].sort(),
      );
    });

    it("keeps a single open draft per company (RULE-dm-13): the draft of the file yields to the one already here", async () => {
      const seeded = await seedHistory(source);
      const { file } = await exportBackup(source);
      await source.db.prisma.diagnosis.delete({ where: { id: seeded.draftId } });
      await source.send("POST", `/api/companies/${seeded.archivedCompanyId}/restore`);
      const ownDraftId = await startDraft(source, seeded.archivedCompanyId);

      const response = await importBackup(source, file);

      expect((response.body as ImportBody).imported).toEqual(NO_RECORDS);
      expect((response.body as ImportBody).skipped).toEqual(counts({ companies: 2, diagnoses: 3, actions: await actionCount(source) }));
      const drafts = await source.db.prisma.diagnosis.findMany({ where: { status: "draft" } });
      expect(drafts.map((draft) => draft.id)).toEqual([ownDraftId]);
    });

    it("undoes the whole import when writing fails halfway", async () => {
      await seedHistory(source);
      const { file } = await exportBackup(source);
      const own = await createCompany(target, "Estúdio Próprio");
      const before = await snapshotOf(target);
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      // The diagnoses fail after the companies were already written inside the transaction.
      const prisma = target.db.prisma;
      const original = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
      vi.spyOn(prisma, "$transaction").mockImplementation(((operation: unknown, options?: unknown) => {
        if (typeof operation !== "function") {
          return original(operation, options);
        }
        return original(async (tx: object) => {
          const brokenDiagnosis = new Proxy((tx as { diagnosis: object }).diagnosis, {
            get: (delegate, property) =>
              property === "createMany"
                ? async () => {
                    throw new Error("disk full");
                  }
                : Reflect.get(delegate, property),
          });
          return (operation as (client: object) => Promise<unknown>)(
            new Proxy(tx, { get: (client, property) => (property === "diagnosis" ? brokenDiagnosis : Reflect.get(client, property)) }),
          );
        }, options);
      }) as never);

      const response = await importBackup(target, file);

      expect(response.status).toBe(500);
      expect(asError(response).code).toBe("internal_error");
      vi.restoreAllMocks();
      expect(await snapshotOf(target)).toEqual(before);
      expect((await target.db.prisma.company.findMany()).map((company) => company.id)).toEqual([own]);
    });
  });

  describe("version 2: brand, interval, action progress, diary and questionnaires (AC-ra-55)", () => {
    // Every kind of record the follow-up seed leaves, next to the history of `seedHistory`.
    async function seededCounts(env: Environment): Promise<FullCounts> {
      return counts({
        companies: 3,
        diagnoses: 5,
        actions: await actionCount(env),
        diaryEntries: 2,
        questionnaireSends: 1,
        brand: 1,
        reevaluationInterval: 1,
      });
    }

    // The file of the first release: only the companies and the diagnoses, marked version 1.
    function asVersion1(file: BackupBody): Record<string, unknown> {
      return {
        format: file.format,
        formatVersion: 1,
        schemaVersion: 1,
        rulesVersion: file.rulesVersion,
        exportedAt: file.exportedAt,
        companies: file.companies,
        diagnoses: file.diagnoses,
      };
    }

    async function seedSource(): Promise<{ history: SeededHistory; followUp: SeededFollowUp; file: BackupBody }> {
      const history = await seedHistory(source);
      const followUp = await seedFollowUp(source, history);
      return { history, followUp, file: (await exportBackup(source)).file };
    }

    it("exports the file as version 2 with the brand, the logo, the interval, the progress, the diary and the questionnaires", async () => {
      const history = await seedHistory(source);
      const followUp = await seedFollowUp(source, history);
      const before = await snapshotOf(source);
      const brand = (await source.send("GET", "/api/brand")).body as Record<string, unknown>;

      const { response, file } = await exportBackup(source);

      expect(BACKUP_FORMAT_VERSION).toBe(2);
      expect(BACKUP_SCHEMA_VERSION).toBe(2);
      expect(file).toMatchObject({ format: BACKUP_FORMAT, formatVersion: 2, schemaVersion: 2 });
      expect(response.body).toEqual({
        fileName: BACKUP_FILE_NAME,
        directory: source.db.downloadsDir,
        ...(await seededCounts(source)),
      });
      expect(file.brand).toEqual({
        name: brand.name,
        phone: brand.phone,
        email: brand.email,
        website: brand.website,
        logo: { mimeType: "image/png", dataBase64: BRAND_PNG, updatedAt: OCTOBER_23.toISOString() },
      });
      expect(file.reevaluationIntervalDays).toBe(120);
      // The progress the owner tracked, and what the second plan inherited from it.
      expect(file.actionProgress).toHaveLength(await actionCount(source));
      expect(file.actionProgress.find((action) => action.diagnosisId === followUp.firstPlanId && action.actionKey === followUp.plan[0])).toMatchObject({
        status: "in_progress",
        dueDate: "2026-11-30",
        ownerRole: "sales_team",
        note: "Falar com o time",
        inheritedFromId: null,
      });
      expect(file.actionProgress.find((action) => action.diagnosisId === followUp.secondPlanId && action.actionKey === followUp.plan[0])).toMatchObject({
        status: "in_progress",
        note: "Falar com o time",
        inheritedFromId: followUp.firstPlanId,
      });
      expect(
        file.diaryEntries
          .map(({ month, newCustomers, spendParts, spendTotalCents }) => ({ month, newCustomers, spendParts, spendTotalCents }))
          .sort((a, b) => a.month.localeCompare(b.month)),
      ).toEqual([
        { month: "2026-08", newCustomers: 7, spendParts: null, spendTotalCents: 1_234_500 },
        { month: "2026-09", newCustomers: 12, spendParts: { ads: 500_000, tools: 20_000 }, spendTotalCents: null },
      ]);
      expect(file.questionnaireSends).toEqual([
        expect.objectContaining({
          companyId: history.activeCompanyId,
          fileName: "academia-foco-questionario-2026-10-23.html",
          sentAt: OCTOBER_23.toISOString(),
          answeredAt: null,
          clientSavedAt: null,
          draftId: null,
        }),
      ]);
      // The list of files the app generated holds a local path; it stays on this computer.
      expect(await source.db.prisma.generatedFile.count()).toBeGreaterThan(0);
      expect(Object.keys(file).sort()).toEqual(
        [
          "actionProgress",
          "brand",
          "companies",
          "diagnoses",
          "diaryEntries",
          "exportedAt",
          "format",
          "formatVersion",
          "questionnaireSends",
          "reevaluationIntervalDays",
          "rulesVersion",
          "schemaVersion",
        ].sort(),
      );
      expect(JSON.stringify(file)).not.toContain(JSON.stringify(source.db.downloadsDir).slice(1, -1));
      // Reading everything changes nothing.
      expect(await snapshotOf(source)).toEqual(before);
    });

    it("exports an installation that never used them with empty lists and no brand", async () => {
      await seedHistory(source);

      const { file } = await exportBackup(source);

      expect(file).toMatchObject({ diaryEntries: [], questionnaireSends: [], brand: null, reevaluationIntervalDays: null });
      expect(file.actionProgress.length).toBeGreaterThan(0);
    });

    it("reproduces everything in another installation, and exporting it again gives the same file", async () => {
      const { history, followUp, file } = await seedSource();

      const response = await importBackup(target, file);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ imported: await seededCounts(source), skipped: NO_RECORDS });
      // Every column of every table, timestamps, ids and the logo included, is the one that was exported.
      expect(await snapshotOf(target)).toEqual(await snapshotOf(source));
      // The screens answer from it as they did before.
      for (const requestPath of [
        "/api/brand",
        "/api/preferences",
        `/api/companies/${history.activeCompanyId}/diary`,
        `/api/companies/${followUp.repeatCompanyId}/actions`,
        `/api/diagnoses/${followUp.secondPlanId}/actions`,
        `/api/companies/${history.activeCompanyId}/timeline`,
      ]) {
        const imported = await target.send("GET", requestPath);
        expect(imported.status, requestPath).toBe(200);
        expect(imported.body, requestPath).toEqual((await source.send("GET", requestPath)).body);
      }
      expect((await target.send("GET", "/api/preferences")).body).toMatchObject({ reevaluationIntervalDays: 120 });
      const logo = await fetch(`${target.server.baseUrl}/api/brand/logo`);
      expect(logo.status).toBe(200);
      expect(Buffer.from(await logo.arrayBuffer()).equals(Buffer.from(BRAND_PNG, "base64"))).toBe(true);
      // Nothing was lost on the way: the copy of the copy is the copy.
      expect((await exportBackup(target)).file).toEqual(file);
    });

    it.each([
      ["its own brand and its own interval", true, true],
      ["its own brand only", true, false],
      ["its own interval only", false, true],
    ])("brings the brand and the interval of the file only where this installation has none: %s", async (_label, ownBrand, ownInterval) => {
      const { file } = await seedSource();
      if (ownBrand) {
        expect((await target.send("PUT", "/api/brand", { name: "Minha Marca" })).status).toBe(200);
      }
      if (ownInterval) {
        expect((await target.send("PUT", "/api/preferences", { reevaluationIntervalDays: 60 })).status).toBe(200);
      }
      const ownPreferences = await target.db.prisma.preference.findMany({ orderBy: { key: "asc" } });

      const response = await importBackup(target, file);

      expect(response.status).toBe(200);
      expect((response.body as ImportBody).imported).toMatchObject({ brand: ownBrand ? 0 : 1, reevaluationInterval: ownInterval ? 0 : 1 });
      expect((response.body as ImportBody).skipped).toMatchObject({ brand: ownBrand ? 1 : 0, reevaluationInterval: ownInterval ? 1 : 0 });
      const brand = (await target.send("GET", "/api/brand")).body;
      expect(brand).toMatchObject(ownBrand ? { name: "Minha Marca", phone: null, hasLogo: false } : { name: "Marina Costa Consultoria", hasLogo: true });
      expect((await target.send("GET", "/api/preferences")).body).toMatchObject({ reevaluationIntervalDays: ownInterval ? 60 : 120 });
      // What was here stays exactly as it was.
      const after = await target.db.prisma.preference.findMany({ orderBy: { key: "asc" } });
      for (const row of ownPreferences) {
        expect(after).toContainEqual(row);
      }
    });

    it("never deletes or overwrites what the installation already has, in any of the new records", async () => {
      const { file } = await seedSource();
      // The other installation has its own companies, plans, progress, diary months, questionnaire, brand and interval.
      const own = await seedHistory(target);
      await seedFollowUp(target, own);
      const ownAction = await target.db.prisma.actionProgress.findFirstOrThrow({ where: { diagnosisId: own.concludedDiagnosisId } });
      expect((await target.send("PATCH", `/api/diagnoses/${own.concludedDiagnosisId}/actions/${ownAction.actionKey}`, { note: "Anotado aqui" })).status).toBe(200);
      const edited = await snapshotOf(target);

      const response = await importBackup(target, file);

      expect(response.status).toBe(200);
      const after = await snapshotOf(target);
      for (const table of Object.keys(edited) as Array<keyof typeof edited>) {
        for (const row of edited[table]) {
          expect(after[table], table).toContainEqual(row);
        }
      }
      expect(after.actionProgress.some((action) => action.note === "Anotado aqui")).toBe(true);
      // The brand and the interval here are its own.
      expect(after.preferences).toEqual(edited.preferences);
      expect(response.body).toMatchObject({ skipped: { brand: 1, reevaluationInterval: 1 } });
    });

    it("importing the same file twice adds nothing the second time", async () => {
      const { file } = await seedSource();
      expect((await importBackup(target, file)).status).toBe(200);
      const afterFirst = await snapshotOf(target);

      const second = await importBackup(target, file);

      expect(second.body).toEqual({ imported: NO_RECORDS, skipped: await seededCounts(source) });
      expect(await snapshotOf(target)).toEqual(afterFirst);
    });

    it("keeps a diary month that is already noted for the company, even under another id", async () => {
      const { history, file } = await seedSource();
      await target.db.prisma.company.create({
        data: { id: history.activeCompanyId, name: "Academia Foco (aqui)", segment: "health_wellness", salesChannel: "subscription" },
      });
      await target.db.prisma.diaryEntry.create({
        data: { companyId: history.activeCompanyId, month: "2026-09", newCustomers: 99, spendTotalCents: 1_000n },
      });

      const response = await importBackup(target, file);

      expect(response.status).toBe(200);
      expect((response.body as ImportBody).imported.diaryEntries).toBe(1);
      expect((response.body as ImportBody).skipped.diaryEntries).toBe(1);
      const months = await target.db.prisma.diaryEntry.findMany({ where: { companyId: history.activeCompanyId }, orderBy: { month: "asc" } });
      expect(months.map((entry) => [entry.month, entry.newCustomers])).toEqual([
        ["2026-08", 7],
        ["2026-09", 99],
      ]);
    });

    it("adds the progress of the actions to a diagnosis this installation already has without it", async () => {
      const { file } = await seedSource();
      // A copy of the first release brings the diagnoses, and no progress with them.
      expect((await importBackup(target, asVersion1(file))).status).toBe(200);
      expect(await target.db.prisma.actionProgress.count()).toBe(0);

      const response = await importBackup(target, file);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        imported: { ...(await seededCounts(source)), companies: 0, diagnoses: 0 },
        skipped: counts({ companies: 3, diagnoses: 5 }),
      });
      expect(await snapshotOf(target)).toEqual(await snapshotOf(source));
    });

    it("leaves out an action whose place is taken here, and keeps this installation's own", async () => {
      const { file } = await seedSource();
      expect((await importBackup(target, asVersion1(file))).status).toBe(200);
      // The same action of the same diagnosis, tracked here under another id.
      const taken = file.actionProgress[0];
      await target.db.prisma.actionProgress.create({
        data: { diagnosisId: taken.diagnosisId, actionKey: taken.actionKey, status: "done", note: "Já feito aqui" },
      });

      const response = await importBackup(target, file);

      expect(response.status).toBe(200);
      expect((response.body as ImportBody).imported.actions).toBe(file.actionProgress.length - 1);
      expect((response.body as ImportBody).skipped.actions).toBe(1);
      const own = await target.db.prisma.actionProgress.findMany({ where: { diagnosisId: taken.diagnosisId, actionKey: taken.actionKey } });
      expect(own).toHaveLength(1);
      expect(own[0]).toMatchObject({ status: "done", note: "Já feito aqui" });
    });

    it("continues to read a copy of version 1: companies and diagnoses come in, and nothing else is touched", async () => {
      const { history, file } = await seedSource();
      expect((await target.send("PUT", "/api/brand", { name: "Minha Marca" })).status).toBe(200);
      expect((await target.send("PUT", "/api/preferences", { reevaluationIntervalDays: 60 })).status).toBe(200);

      const response = await importBackup(target, asVersion1(file));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ imported: counts({ companies: 3, diagnoses: 5 }), skipped: NO_RECORDS });
      expect(await target.db.prisma.company.count()).toBe(3);
      expect(await target.db.prisma.diagnosis.count()).toBe(5);
      expect(await target.db.prisma.actionProgress.count()).toBe(0);
      expect(await target.db.prisma.diaryEntry.count()).toBe(0);
      expect(await target.db.prisma.questionnaireSend.count()).toBe(0);
      expect((await target.send("GET", "/api/brand")).body).toMatchObject({ name: "Minha Marca", hasLogo: false });
      expect((await target.send("GET", "/api/preferences")).body).toMatchObject({ reevaluationIntervalDays: 60 });
      // The imported diagnosis opens as it did.
      const result = await target.send("GET", `/api/diagnoses/${history.concludedDiagnosisId}`);
      expect(result.body).toEqual((await source.send("GET", `/api/diagnoses/${history.concludedDiagnosisId}`)).body);
    });

    it("reads a copy of version 1 by its own layout: a version 1 file with a new list is refused", async () => {
      const { file } = await seedSource();
      const own = await createCompany(target, "Estúdio Próprio");
      const before = await snapshotOf(target);

      const response = await importBackup(target, { ...asVersion1(file), diaryEntries: file.diaryEntries });

      expect(response.status).toBe(422);
      expect(asError(response).code).toBe("backup_invalid");
      expect(await snapshotOf(target)).toEqual(before);
      expect(before.companies.map((company) => company.id)).toEqual([own]);
    });

    it("undoes the whole import when the new records fail to write", async () => {
      const { file } = await seedSource();
      const own = await createCompany(target, "Estúdio Próprio");
      const before = await snapshotOf(target);
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const prisma = target.db.prisma;
      const original = prisma.$transaction.bind(prisma) as (...args: unknown[]) => Promise<unknown>;
      vi.spyOn(prisma, "$transaction").mockImplementation(((operation: unknown, options?: unknown) => {
        if (typeof operation !== "function") {
          return original(operation, options);
        }
        return original(async (tx: object) => {
          // The diary is written after the companies, the diagnoses and the actions: all of them must go too.
          const brokenDiary = new Proxy((tx as { diaryEntry: object }).diaryEntry, {
            get: (delegate, property) =>
              property === "createMany"
                ? async () => {
                    throw new Error("disk full");
                  }
                : Reflect.get(delegate, property),
          });
          return (operation as (client: object) => Promise<unknown>)(
            new Proxy(tx, { get: (client, property) => (property === "diaryEntry" ? brokenDiary : Reflect.get(client, property)) }),
          );
        }, options);
      }) as never);

      const response = await importBackup(target, file);

      expect(response.status).toBe(500);
      vi.restoreAllMocks();
      expect(await snapshotOf(target)).toEqual(before);
      expect(before.companies.map((company) => company.id)).toEqual([own]);
      expect(await target.db.prisma.actionProgress.count()).toBe(0);
    });
  });

  describe("a file from a newer app is refused whole (RULE-dm-18)", () => {
    const NEWER_MESSAGE =
      "O arquivo veio de uma versão mais nova do app (regras v2). Atualize o FitPulse pela loja do Play e tente de novo. Nenhum dado foi alterado.";

    async function expectRefusedAndUnchanged(body: unknown, rulesVersion: number, message?: string) {
      const own = await createCompany(target, "Estúdio Próprio");
      const before = await snapshotOf(target);

      const response = await importBackup(target, body);

      expect(response.status).toBe(422);
      expect(asError(response).code).toBe("backup_newer_version");
      expect(asError(response).rulesVersion).toBe(rulesVersion);
      if (message !== undefined) {
        expect(asError(response).message).toBe(message);
      }
      expect(await snapshotOf(target)).toEqual(before);
      expect(before.companies.map((company) => company.id)).toEqual([own]);
    }

    it("refuses a backup exported by an app running newer rules, with the message of F-06", async () => {
      const future = await createEnvironment(rulesV2);
      try {
        await conclude(future, await createCompany(future, "Academia Foco"), HIGH_SCORE, OCTOBER_23);
        const { file } = await exportBackup(future);
        expect(file.rulesVersion).toBe(2);

        await expectRefusedAndUnchanged(file, 2, NEWER_MESSAGE);
      } finally {
        await disposeEnvironment(future);
      }
    });

    it("accepts the opposite direction: a backup from older rules enters an app running newer ones", async () => {
      const seeded = await seedHistory(source);
      const { file } = await exportBackup(source);
      const future = await createEnvironment(rulesV2);
      try {
        const response = await importBackup(future, file);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ imported: { companies: 2, diagnoses: 3 } });
        const stored = await future.db.prisma.diagnosis.findUnique({ where: { id: seeded.concludedDiagnosisId } });
        expect(stored?.rulesVersion).toBe(1);
      } finally {
        await disposeEnvironment(future);
      }
    });

    it("refuses a file whose header says an older version but holds a diagnosis calculated with newer rules", async () => {
      await seedHistory(source);
      const { file } = await exportBackup(source);
      const completed = file.diagnoses.find((diagnosis) => diagnosis.status === "completed")!;
      completed.rulesVersion = 2;
      (completed.result as { rulesVersion: number }).rulesVersion = 2;

      await expectRefusedAndUnchanged(file, 2);
    });

    it("refuses a newer file layout as 'newer', not 'invalid', even when its records look unknown", async () => {
      await expectRefusedAndUnchanged(
        { format: BACKUP_FORMAT, formatVersion: BACKUP_FORMAT_VERSION + 1, schemaVersion: 1, rulesVersion: 1, people: [{ anything: true }] },
        1,
      );
    });

    it("refuses a newer database schema", async () => {
      const { file } = await exportBackup(source);
      file.schemaVersion = BACKUP_SCHEMA_VERSION + 1;

      await expectRefusedAndUnchanged(file, 1);
    });
  });

  describe("an invalid file is refused with a message and nothing changes (AC-dm-37)", () => {
    // The history of the first release plus every record of part 2, so each list can be tampered with.
    async function validBackup(): Promise<BackupBody> {
      await seedFollowUp(source, await seedHistory(source));
      return (await exportBackup(source)).file;
    }

    // `change` applied to the records `where` picks, the rest left as they are.
    function patch<T extends object>(records: T[], where: (record: T) => boolean, change: Record<string, unknown>): T[] {
      return records.map((record) => (where(record) ? { ...record, ...change } : record));
    }
    const first = () => true;

    const tamperings: Array<[string, (file: BackupBody) => unknown]> = [
      ["a list instead of an object", () => []],
      ["an empty object", () => ({})],
      ["a different format mark", (file) => ({ ...file, format: "outro-aplicativo" })],
      ["no format mark", ({ format: _format, ...rest }) => rest],
      ["a version that is not a number", (file) => ({ ...file, formatVersion: "1" })],
      ["no list of companies", ({ companies: _companies, ...rest }) => rest],
      ["a key this version does not know", (file) => ({ ...file, usuarios: [] })],
      ["a company with an unknown segment", (file) => ({ ...file, companies: file.companies.map((company, index) => (index === 0 ? { ...company, segment: "nope" } : company)) })],
      ["a company name above 80 characters", (file) => ({ ...file, companies: file.companies.map((company, index) => (index === 0 ? { ...company, name: "x".repeat(81) } : company)) })],
      ["a CNPJ that does not check out", (file) => ({ ...file, companies: file.companies.map((company) => ({ ...company, cnpj: "11444777000162" })) })],
      ["an id that is not an identifier", (file) => ({ ...file, companies: file.companies.map((company, index) => (index === 0 ? { ...company, id: "../etc" } : company)) })],
      ["a date that is not a date", (file) => ({ ...file, companies: file.companies.map((company, index) => (index === 0 ? { ...company, createdAt: "ontem" } : company)) })],
      ["two companies with the same id", (file) => ({ ...file, companies: [...file.companies, file.companies[0]] })],
      ["two diagnoses with the same id", (file) => ({ ...file, diagnoses: [...file.diagnoses, file.diagnoses[0]] })],
      ["a diagnosis of a company that is not in the file", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis, index) => (index === 0 ? { ...diagnosis, companyId: "00000000-0000-4000-8000-000000000000" } : diagnosis)) })],
      ["an answer to a question that does not exist", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => ({ ...diagnosis, answers: { zz9: 1 } })) })],
      ["an answer outside 0 to 3", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => ({ ...diagnosis, answers: { aq1: 7 } })) })],
      ["a block above 8", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => ({ ...diagnosis, currentBlock: 9 })) })],
      ["a calculator with a negative amount", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => ({ ...diagnosis, calculator: { averagePurchaseCents: -1 } })) })],
      ["a status that does not exist", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis, index) => (index === 0 ? { ...diagnosis, status: "archived" } : diagnosis)) })],
      ["a completed diagnosis without its result", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => (diagnosis.status === "completed" ? { ...diagnosis, result: null } : diagnosis)) })],
      ["a result that is not an object", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => (diagnosis.status === "completed" ? { ...diagnosis, result: "ok" } : diagnosis)) })],
      ["a result without the keys the screens read", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => (diagnosis.status === "completed" ? { ...diagnosis, result: { stage: 4, rulesVersion: 1 } } : diagnosis)) })],
      ["a result that disagrees with the stage", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => (diagnosis.status === "completed" ? { ...diagnosis, stage: 2 } : diagnosis)) })],
      ["a draft that already has a stage", (file) => ({ ...file, diagnoses: file.diagnoses.map((diagnosis) => (diagnosis.status === "draft" ? { ...diagnosis, stage: 1 } : diagnosis)) })],
      // Version 2: the lists of part 2.
      ["no list of diary months", ({ diaryEntries: _diaryEntries, ...rest }) => rest],
      ["no list of action progress", ({ actionProgress: _actionProgress, ...rest }) => rest],
      ["no list of questionnaires", ({ questionnaireSends: _questionnaireSends, ...rest }) => rest],
      ["no brand entry", ({ brand: _brand, ...rest }) => rest],
      ["no interval entry", ({ reevaluationIntervalDays: _interval, ...rest }) => rest],
      ["a list of the generated files, which stay on the computer that made them", (file) => ({ ...file, generatedFiles: [] })],
      ["an action of a diagnosis that is not in the file", (file) => ({ ...file, actionProgress: patch(file.actionProgress, first, { diagnosisId: ZERO_ID }) })],
      ["an action of a diagnosis that is still a draft", (file) => ({ ...file, actionProgress: patch(file.actionProgress, first, { diagnosisId: file.diagnoses.find((diagnosis) => diagnosis.status === "draft")!.id }) })],
      ["an action that is not in the plan of its diagnosis", (file) => ({ ...file, actionProgress: patch(file.actionProgress, first, { actionKey: "nao-existe" }) })],
      ["an action with a state that does not exist", (file) => ({ ...file, actionProgress: patch(file.actionProgress, first, { status: "paused" }) })],
      ["an action with a deadline that is not a real date", (file) => ({ ...file, actionProgress: patch(file.actionProgress, first, { dueDate: "2026-02-31" }) })],
      ["an action owned by a name instead of a role", (file) => ({ ...file, actionProgress: patch(file.actionProgress, first, { ownerRole: "Maria" }) })],
      ["an action note above 500 characters", (file) => ({ ...file, actionProgress: patch(file.actionProgress, first, { note: "x".repeat(501) }) })],
      ["an action that continues from a diagnosis that is not in the file", (file) => ({ ...file, actionProgress: patch(file.actionProgress, first, { inheritedFromId: ZERO_ID }) })],
      ["an action tracked twice for the same diagnosis", (file) => ({ ...file, actionProgress: [...file.actionProgress, { ...file.actionProgress[0], id: ZERO_ID }] })],
      ["a diary month that does not exist", (file) => ({ ...file, diaryEntries: patch(file.diaryEntries, first, { month: "2026-13" }) })],
      ["a diary month with negative customers", (file) => ({ ...file, diaryEntries: patch(file.diaryEntries, first, { newCustomers: -1 }) })],
      ["a diary month with a spend part that does not exist", (file) => ({ ...file, diaryEntries: patch(file.diaryEntries, (entry) => entry.spendParts !== null, { spendParts: { ferias: 100 } }) })],
      ["a diary month with the parts and the total", (file) => ({ ...file, diaryEntries: patch(file.diaryEntries, (entry) => entry.spendParts !== null, { spendTotalCents: 100 }) })],
      ["a diary month with no spend", (file) => ({ ...file, diaryEntries: patch(file.diaryEntries, (entry) => entry.spendParts !== null, { spendParts: null }) })],
      ["a diary month above R$ 99.999.999,99", (file) => ({ ...file, diaryEntries: patch(file.diaryEntries, (entry) => entry.spendParts === null, { spendTotalCents: 10_000_000_000 }) })],
      ["the same month twice for a company", (file) => ({ ...file, diaryEntries: [...file.diaryEntries, { ...file.diaryEntries[0], id: ZERO_ID }] })],
      ["a diary month of a company that is not in the file", (file) => ({ ...file, diaryEntries: patch(file.diaryEntries, first, { companyId: ZERO_ID }) })],
      ["a questionnaire file name that points to another folder", (file) => ({ ...file, questionnaireSends: patch(file.questionnaireSends, first, { fileName: "../../segredo.html" }) })],
      ["a questionnaire of a company that is not in the file", (file) => ({ ...file, questionnaireSends: patch(file.questionnaireSends, first, { companyId: ZERO_ID }) })],
      ["a questionnaire with a date that is not a date", (file) => ({ ...file, questionnaireSends: patch(file.questionnaireSends, first, { sentAt: "ontem" }) })],
      ["a brand name above 80 characters", (file) => ({ ...file, brand: { ...file.brand!, name: "x".repeat(81) } })],
      ["a brand e-mail that is not an e-mail", (file) => ({ ...file, brand: { ...file.brand!, email: "nao-e-um-email" } })],
      ["a key the brand does not know", (file) => ({ ...file, brand: { ...file.brand!, cor: "vermelho" } })],
      ["a logo that is not an image", (file) => ({ ...file, brand: { ...file.brand!, logo: { ...file.brand!.logo, dataBase64: Buffer.from("isto não é uma imagem").toString("base64") } } })],
      ["a logo declared with another type than its bytes", (file) => ({ ...file, brand: { ...file.brand!, logo: { ...file.brand!.logo, mimeType: "image/jpeg" } } })],
      ["a logo that is not base64 text", (file) => ({ ...file, brand: { ...file.brand!, logo: { ...file.brand!.logo, dataBase64: "@@@@" } } })],
      ["an interval that is not one of the four offered", (file) => ({ ...file, reevaluationIntervalDays: 45 })],
      ["an interval written as text", (file) => ({ ...file, reevaluationIntervalDays: "90" })],
    ];

    it.each(tamperings)("refuses %s with 422 backup_invalid", async (_label, tamper) => {
      const file = await validBackup();
      const own = await createCompany(target, "Estúdio Próprio");
      const before = await snapshotOf(target);

      const response = await importBackup(target, tamper(clone(file)));

      expect(response.status).toBe(422);
      expect(asError(response).code).toBe("backup_invalid");
      expect(asError(response).message).toMatch(/Nenhum dado foi alterado\.$/);
      expect(await snapshotOf(target)).toEqual(before);
      expect(before.companies.map((company) => company.id)).toEqual([own]);
    });

    it("the untouched file is accepted, so each case above fails for its own reason", async () => {
      const file = await validBackup();

      const response = await importBackup(target, clone(file));

      expect(response.status).toBe(200);
    });

    it("answers 400 invalid_json for text that is not JSON and 415 for another content type", async () => {
      const notJson = await importBackup(target, "{isto não é json");
      expect(notJson.status).toBe(400);
      expect(asError(notJson).code).toBe("invalid_json");

      const wrongType = await fetch(`${target.server.baseUrl}/api/backup/import`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      });
      expect(wrongType.status).toBe(415);
      expect(await countsOf(target)).toEqual({ companies: 0, diagnoses: 0 });
    });
  });
});
