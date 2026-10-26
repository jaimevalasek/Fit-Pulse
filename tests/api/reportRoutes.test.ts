import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { Express } from "express";
import { extractText } from "unpdf";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_CATALOG } from "../../shared/content/actionCatalog.ts";
import { RISK_CATALOG } from "../../shared/content/riskCatalog.ts";
import { DIMENSIONS } from "../../shared/content/stageContent.ts";
import {
  DIMENSION_KEYS,
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type DiagnosisInput,
  type DiagnosisResult,
} from "../../shared/domain/types.ts";
import { createApp } from "../../server/app.ts";
import { sanitizeFileStem } from "../../server/files/downloadsFolder.ts";
import type { PrismaClient } from "../../server/generated/prisma/client.ts";
import { ANSWERS_COPY, GUIDANCE_WARNING, PAGE_TITLES } from "../../server/report/reportCopy.ts";
import { createReportService, type ReportFile } from "../../server/services/reportService.ts";
import type { ReportDocument } from "../../shared/report/reportDocument.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-006: `POST /api/diagnoses/:id/report` (AC-dm-36). The PDF is written to a temporary
// Downloads folder, its text is read back with unpdf, hostile company names stay inside the
// folder, a draft is refused and a failed write leaves no file and the result untouched.
// The text scan also covers AC-dm-29 (RULE-dm-14).
// IF-001: `GET /api/reports/preview` and `POST /api/reports/export` take a selection, the preview
// is the document without drawing, the export saves the same pages and registers the file
// (AC-ra-17), a failed write or a failed record leaves no file and no record (AC-ra-19).

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
}

const asDiagnosis = (response: ApiResponse): DiagnosisBody => response.body as DiagnosisBody;
const asReportFile = (response: ApiResponse): ReportFile => response.body as ReportFile;
const asError = (response: ApiResponse): { code: string; message: string } =>
  (response.body as { error: { code: string; message: string } }).error;

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// G1: stage 1, locked by the customer cost, two risks.
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

// G4: stage 4, no lock and no risk.
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

// 12:00 UTC is the same calendar day in every time zone the owner can be in.
const OCTOBER_23 = new Date("2026-10-23T12:00:00.000Z");
const FILE_DATE = "2026-10-23";

const FORBIDDEN_TERMS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "V1 to V4", pattern: /\bV[1-4]\b/i },
  { label: "Método V4", pattern: /m[ée]todo\s+V4/i },
  { label: "V4 Company", pattern: /V4\s+Company/i },
  { label: "PPA", pattern: /\bPPA\b/i },
  { label: "CREP", pattern: /\bCREP\b/i },
  { label: "vacinas", pattern: /vacina/i },
];

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

async function readPdfText(filePath: string): Promise<string> {
  const { text } = await extractText(new Uint8Array(readFileSync(filePath)), { mergePages: true });
  return squash(text);
}

// One entry per page of the PDF, in order.
async function readPdfPages(filePath: string): Promise<{ totalPages: number; pages: string[] }> {
  const { totalPages, text } = await extractText(new Uint8Array(readFileSync(filePath)));
  return { totalPages, pages: text.map(squash) };
}

// The pages every diagnosis report has, in the order of the PDF; the answers appendix comes after them.
const BASE_PAGE_IDS = ["cover", "executive-summary", "dimensions", "risks", "numbers", "how-to-read"];

const asDocument = (response: ApiResponse): ReportDocument => response.body as ReportDocument;

const selectionOf = (diagnosisId: string, includeAnswers = false) => ({ kind: "diagnosis", diagnosisId, includeAnswers });

// A database that cannot write the record of a saved file; everything else works as it does.
function withoutFileRecords(prisma: PrismaClient): PrismaClient {
  const bound = (target: object, property: string | symbol) => {
    const value = Reflect.get(target, property, target);
    return typeof value === "function" ? value.bind(target) : value;
  };
  const failing = new Proxy(prisma.generatedFile, {
    get: (target, property) => (property === "create" ? () => Promise.reject(new Error("disk full")) : bound(target, property)),
  });
  return new Proxy(prisma, {
    get: (target, property) => (property === "generatedFile" ? failing : bound(target, property)),
  });
}

describe("report routes", () => {
  let db: TestDatabase;
  let server: RunningServer;

  const send = (method: string, requestPath: string, body?: unknown) => callApi(server.baseUrl, method, requestPath, body);
  const exportReport = (diagnosisId: string) => send("POST", `/api/diagnoses/${diagnosisId}/report`);
  const exportSelection = (body: unknown) => send("POST", "/api/reports/export", body);
  const preview = (query: string) => send("GET", `/api/reports/preview?${query}`);
  const listDownloads = () => readdirSync(db.downloadsDir).sort();

  async function createCompany(name = "Academia Foco"): Promise<string> {
    const response = await send("POST", "/api/companies", { name, segment: "health_wellness", salesChannel: "subscription" });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  async function startDraft(companyId: string): Promise<DiagnosisBody> {
    const response = await send("POST", `/api/companies/${companyId}/diagnoses`);
    expect([200, 201]).toContain(response.status);
    return asDiagnosis(response);
  }

  // The path the owner takes: start, answer everything, conclude.
  async function conclude(companyId: string, input: DiagnosisInput = G1): Promise<DiagnosisBody> {
    db.setNow(OCTOBER_23);
    const draft = await startDraft(companyId);
    expect((await send("PATCH", `/api/diagnoses/${draft.id}`, input)).status).toBe(200);
    const response = await send("POST", `/api/diagnoses/${draft.id}/complete`);
    expect(response.status).toBe(200);
    return asDiagnosis(response);
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
    db.setNow(OCTOBER_23);
    // Each test starts with an empty folder.
    for (const name of listDownloads()) {
      rmSync(path.join(db.downloadsDir, name), { recursive: true, force: true });
    }
  });

  describe("POST /api/diagnoses/:id/report", () => {
    it("saves the PDF as {company}-{date}.pdf in the Downloads folder and says where", async () => {
      const diagnosis = await conclude(await createCompany());

      const response = await exportReport(diagnosis.id);

      expect(response.status).toBe(200);
      expect(asReportFile(response)).toEqual({
        fileId: expect.any(String),
        fileName: `Academia Foco-${FILE_DATE}.pdf`,
        directory: db.downloadsDir,
      });
      expect(listDownloads()).toEqual([`Academia Foco-${FILE_DATE}.pdf`]);
      const bytes = readFileSync(path.join(db.downloadsDir, `Academia Foco-${FILE_DATE}.pdf`));
      expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(bytes.length).toBeGreaterThan(5_000);
      // the file is registered, so it can be opened by its id
      const records = await db.prisma.generatedFile.findMany();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ id: asReportFile(response).fileId, kind: "diagnosis_pdf", fileName: asReportFile(response).fileName });
    });

    it("prints every field of the report (AC-dm-36)", async () => {
      const diagnosis = await conclude(await createCompany("Academia Foco"), G1);
      const result = diagnosis.result as DiagnosisResult;
      const { fileName } = asReportFile(await exportReport(diagnosis.id));

      const text = await readPdfText(path.join(db.downloadsDir, fileName));

      // company, date, calculation version and confidence
      expect(text).toContain("Relatório do diagnóstico de maturidade Academia Foco");
      expect(text).toContain("Data do diagnóstico 23/10/2026");
      expect(text).toContain(`Versão do cálculo ${result.rulesVersion}`);
      expect(text).toMatch(/Confiança nos dados Média \(6 de 26 itens sem o número\)/);
      // stage and lock
      expect(text).toContain("Estágio 1 de 4 · Descoberta");
      expect(text).toContain("Para subir de degrau");
      expect(text).toContain("Descobrir quanto custa cada cliente novo.");
      // the eight dimension scores, each next to its name
      expect(DIMENSION_KEYS).toHaveLength(8);
      for (const key of DIMENSION_KEYS) {
        expect(text, key).toContain(`${DIMENSIONS[key].name} ${result.dimensions[key].score}`);
      }
      // risks
      expect(result.risks.length).toBeGreaterThan(0);
      for (const risk of result.risks) {
        const info = RISK_CATALOG.find((entry) => entry.id === risk.signalId);
        expect(text, risk.signalId).toContain(squash(info?.title ?? "missing"));
        expect(text).toContain(`Probabilidade ${risk.probability} de 5 · Impacto ${risk.impact} de 5`);
      }
      // the three actions
      expect(result.plan).toHaveLength(3);
      result.plan.forEach((key, index) => {
        expect(text, key).toContain(`${index + 1} ${squash(ACTION_CATALOG[key].title)}`);
      });
      // guidance notice
      expect(text).toContain(squash(GUIDANCE_WARNING));
    });

    it("says there is no risk when the diagnosis has none, and shows the top-stage sentence", async () => {
      const diagnosis = await conclude(await createCompany("Rede Norte"), G4);
      const { fileName } = asReportFile(await exportReport(diagnosis.id));

      const text = await readPdfText(path.join(db.downloadsDir, fileName));

      expect(text).toContain("Estágio 4 de 4 · Estruturação");
      expect(text).toContain("Último degrau. Manter margem, equipe e números em dia.");
      expect(text).toContain("Nenhum risco encontrado nas respostas.");
      expect(text).toContain("Confiança nos dados Alta");
      // the numbers behind the stage, in the mono face
      expect(text).toContain("Relação lucro ÷ custo 5,0×");
      expect(text).toContain("Tempo para se pagar 8 meses");
    });

    it("has none of the terms the interface never shows (AC-dm-29)", async () => {
      const companyId = await createCompany();
      for (const input of [G1, G4]) {
        const { fileName } = asReportFile(await exportReport((await conclude(companyId, input)).id));
        const text = await readPdfText(path.join(db.downloadsDir, fileName));
        expect(text.length).toBeGreaterThan(500);
        expect(FORBIDDEN_TERMS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)).toEqual([]);
      }
    });

    it("embeds Inter and JetBrains Mono and needs no network", async () => {
      const diagnosis = await conclude(await createCompany());
      const { fileName } = asReportFile(await exportReport(diagnosis.id));

      const pdf = readFileSync(path.join(db.downloadsDir, fileName)).toString("latin1");

      expect(pdf).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+Inter/);
      expect(pdf).toMatch(/\/BaseFont\s*\/[A-Z]{6}\+JetBrainsMono/);
      expect(pdf).toMatch(/\/FontFile[23]?\b/);
      expect(pdf).not.toMatch(/Helvetica|Times|Courier/);
      expect(pdf).not.toMatch(/\/URI\b/);
      expect(pdf).not.toMatch(/https?:\/\//);
    });

    it("keeps a name already taken and saves the next one as (2), (3)", async () => {
      const diagnosis = await conclude(await createCompany());
      const base = `Academia Foco-${FILE_DATE}`;

      const first = asReportFile(await exportReport(diagnosis.id));
      const second = asReportFile(await exportReport(diagnosis.id));
      const third = asReportFile(await exportReport(diagnosis.id));

      expect([first.fileName, second.fileName, third.fileName]).toEqual([`${base}.pdf`, `${base} (2).pdf`, `${base} (3).pdf`]);
      expect(listDownloads()).toEqual([`${base} (2).pdf`, `${base} (3).pdf`, `${base}.pdf`]);
    });

    it("never overwrites a file the owner already has with that name", async () => {
      const diagnosis = await conclude(await createCompany());
      const existing = path.join(db.downloadsDir, `Academia Foco-${FILE_DATE}.pdf`);
      writeFileSync(existing, "meu arquivo");

      const response = await exportReport(diagnosis.id);

      expect(asReportFile(response).fileName).toBe(`Academia Foco-${FILE_DATE} (2).pdf`);
      expect(readFileSync(existing, "utf8")).toBe("meu arquivo");
    });

    it("leaves no temporary file behind", async () => {
      await exportReport((await conclude(await createCompany())).id);

      expect(listDownloads().filter((name) => name.endsWith(".tmp"))).toEqual([]);
      expect(listDownloads()).toHaveLength(1);
    });

    it("creates the Downloads folder when it is missing", async () => {
      const missing = path.join(db.downloadsDir, "novo", "Downloads");
      const session = await startServer(createApp({ ...db, downloadsDir: missing, backendPort: 4326 }));
      try {
        const diagnosis = await conclude(await createCompany());
        const response = await callApi(session.baseUrl, "POST", `/api/diagnoses/${diagnosis.id}/report`);

        expect(response.status).toBe(200);
        expect(asReportFile(response).directory).toBe(missing);
        expect(readdirSync(missing)).toEqual([`Academia Foco-${FILE_DATE}.pdf`]);
      } finally {
        await session.close();
      }
    });

    it.each([
      ["../../etc/passwd", "etc-passwd"],
      ["..\\..\\Windows\\System32", "Windows-System32"],
      ["CON", "_CON"],
      ["nul", "_nul"],
      ['a:b*c?"d<e>f|g', "a-b-c-d-e-f-g"],
      ["???", "arquivo"],
      ["..", "arquivo"],
      ["  .oculto  ", "oculto"],
    ])("keeps the hostile company name %j inside the folder as %j", async (companyName, expectedStem) => {
      const diagnosis = await conclude(await createCompany(companyName));

      const response = await exportReport(diagnosis.id);

      expect(response.status).toBe(200);
      const { fileName, directory } = asReportFile(response);
      expect(fileName).toBe(`${expectedStem}-${FILE_DATE}.pdf`);
      expect(directory).toBe(db.downloadsDir);
      expect(fileName).not.toMatch(/[\\/:*?"<>|]/);
      expect(path.dirname(path.resolve(db.downloadsDir, fileName))).toBe(path.resolve(db.downloadsDir));
      expect(listDownloads()).toEqual([fileName]);
      expect(readdirSync(path.dirname(db.downloadsDir))).not.toContain("etc");
    });

    it("keeps the date when a long company name is cut", async () => {
      const diagnosis = await conclude(await createCompany("Ñ".repeat(80)));

      const { fileName } = asReportFile(await exportReport(diagnosis.id));

      expect(fileName.endsWith(`-${FILE_DATE}.pdf`)).toBe(true);
      expect(fileName.length - ".pdf".length).toBeLessThanOrEqual(80);
    });

    it("answers 409 diagnosis_not_completed for a draft and writes nothing", async () => {
      const draft = await startDraft(await createCompany());

      const response = await exportReport(draft.id);

      expect(response.status).toBe(409);
      expect(asError(response).code).toBe("diagnosis_not_completed");
      expect(listDownloads()).toEqual([]);
    });

    it("answers 404 diagnosis_not_found for a diagnosis that does not exist", async () => {
      const response = await exportReport("not-a-diagnosis");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diagnosis_not_found");
      expect(listDownloads()).toEqual([]);
    });

    it("exports an archived diagnosis too, without changing it", async () => {
      const diagnosis = await conclude(await createCompany());
      expect((await send("POST", `/api/diagnoses/${diagnosis.id}/archive`)).status).toBe(200);

      const response = await exportReport(diagnosis.id);

      expect(response.status).toBe(200);
      expect(listDownloads()).toHaveLength(1);
    });

    it("takes the next free name when the name is a folder", async () => {
      // The name the report would take is a folder: it counts as taken.
      const diagnosis = await conclude(await createCompany());
      mkdirSync(path.join(db.downloadsDir, `Academia Foco-${FILE_DATE}.pdf`));

      const response = await exportReport(diagnosis.id);

      expect(asReportFile(response).fileName).toBe(`Academia Foco-${FILE_DATE} (2).pdf`);
      expect(listDownloads().filter((name) => name.endsWith(".tmp"))).toEqual([]);
    });

    it("changes nothing in the diagnosis", async () => {
      const diagnosis = await conclude(await createCompany());
      const before = await send("GET", `/api/diagnoses/${diagnosis.id}`);

      expect((await exportReport(diagnosis.id)).status).toBe(200);

      expect(await send("GET", `/api/diagnoses/${diagnosis.id}`)).toEqual(before);
    });
  });

  describe("when the file cannot be saved", () => {
    // A regular file where the folder should be: the folder can be neither found nor created.
    async function withBrokenDownloads(): Promise<{ session: RunningServer; blocker: string }> {
      const blocker = path.join(db.downloadsDir, "ocupado");
      writeFileSync(blocker, "não sou uma pasta");
      const session = await startServer(createApp({ ...db, downloadsDir: blocker, backendPort: 4327 }));
      return { session, blocker };
    }

    it("answers 500 write_failed with a message, leaves no file and keeps the result as it was", async () => {
      const diagnosis = await conclude(await createCompany());
      const before = await send("GET", `/api/diagnoses/${diagnosis.id}`);
      const { session, blocker } = await withBrokenDownloads();
      try {
        const response = await callApi(session.baseUrl, "POST", `/api/diagnoses/${diagnosis.id}/report`);

        expect(response.status).toBe(500);
        expect(asError(response).code).toBe("write_failed");
        expect(asError(response).message).toMatch(/Nada foi alterado/);
        expect(listDownloads()).toEqual(["ocupado"]);
        expect(readFileSync(blocker, "utf8")).toBe("não sou uma pasta");
        expect(await send("GET", `/api/diagnoses/${diagnosis.id}`)).toEqual(before);
      } finally {
        await session.close();
      }
    });

    it("works again once the problem is gone", async () => {
      const diagnosis = await conclude(await createCompany());
      const { session } = await withBrokenDownloads();
      try {
        expect((await callApi(session.baseUrl, "POST", `/api/diagnoses/${diagnosis.id}/report`)).status).toBe(500);
      } finally {
        await session.close();
      }

      expect((await exportReport(diagnosis.id)).status).toBe(200);
    });

    // AC-ra-19: the save fails, nothing changes, and saving again once the problem is gone works.
    it("fails the same way on POST /api/reports/export: no file, no record, then it saves once the problem is gone", async () => {
      const diagnosis = await conclude(await createCompany());
      const { session, blocker } = await withBrokenDownloads();
      try {
        const response = await callApi(session.baseUrl, "POST", "/api/reports/export", selectionOf(diagnosis.id));

        expect(response.status).toBe(500);
        expect(asError(response).code).toBe("write_failed");
        expect(listDownloads()).toEqual(["ocupado"]);
        expect(readFileSync(blocker, "utf8")).toBe("não sou uma pasta");
        expect(await db.prisma.generatedFile.count()).toBe(0);
      } finally {
        await session.close();
      }

      const retry = await exportSelection(selectionOf(diagnosis.id));

      expect(retry.status).toBe(200);
      expect(listDownloads()).toEqual([`Academia Foco-${FILE_DATE}.pdf`, "ocupado"]);
      expect(await db.prisma.generatedFile.count()).toBe(1);
    });

    it("takes the PDF back when its record cannot be written, so nothing is left behind", async () => {
      const diagnosis = await conclude(await createCompany());
      const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const session = await startServer(createApp({ ...db, prisma: withoutFileRecords(db.prisma), backendPort: 4328 }));
      try {
        const response = await callApi(session.baseUrl, "POST", "/api/reports/export", selectionOf(diagnosis.id));

        expect(response.status).toBe(500);
        expect(asError(response).code).toBe("write_failed");
        expect(listDownloads()).toEqual([]);
        expect(await db.prisma.generatedFile.count()).toBe(0);
      } finally {
        quiet.mockRestore();
        await session.close();
      }
    });
  });

  describe("GET /api/reports/preview", () => {
    it("answers the pages of the report as data and draws or saves nothing (AC-ra-02)", async () => {
      const diagnosis = await conclude(await createCompany());

      const response = await preview(`kind=diagnosis&diagnosisId=${diagnosis.id}`);

      expect(response.status).toBe(200);
      const document = asDocument(response);
      expect(document.kind).toBe("diagnosis");
      expect(document.subject).toBe("Academia Foco");
      expect(document.pages.map((page) => page.id)).toEqual(BASE_PAGE_IDS);
      for (const page of document.pages) {
        expect(page.title, page.id).not.toBe("");
        expect(page.blocks.length, page.id).toBeGreaterThan(0);
      }
      expect(listDownloads()).toEqual([]);
      expect(await db.prisma.generatedFile.count()).toBe(0);
    });

    it("leaves the answers out unless asked, and adds their pages when asked (BR-ra-08)", async () => {
      const diagnosis = await conclude(await createCompany());
      const marginText = ANSWERS_COPY.marginText(40);

      const without = JSON.stringify(asDocument(await preview(`kind=diagnosis&diagnosisId=${diagnosis.id}`)));
      const explicitlyOff = asDocument(await preview(`kind=diagnosis&diagnosisId=${diagnosis.id}&includeAnswers=false`));
      const withAnswers = asDocument(await preview(`kind=diagnosis&diagnosisId=${diagnosis.id}&includeAnswers=true`));

      expect(without).not.toContain(PAGE_TITLES.answers);
      expect(without).not.toContain(marginText);
      expect(explicitlyOff.pages.map((page) => page.id)).toEqual(BASE_PAGE_IDS);
      expect(withAnswers.pages.map((page) => page.id).slice(0, BASE_PAGE_IDS.length)).toEqual(BASE_PAGE_IDS);
      const extra = withAnswers.pages.slice(BASE_PAGE_IDS.length);
      expect(extra.length).toBeGreaterThan(1);
      expect(extra.every((page) => page.id.startsWith("answers-") && page.title.startsWith(PAGE_TITLES.answers))).toBe(true);
      expect(JSON.stringify(withAnswers)).toContain(marginText);
    });

    it("ignores any other key in the query, a path included", async () => {
      const diagnosis = await conclude(await createCompany());

      const response = await preview(`kind=diagnosis&diagnosisId=${diagnosis.id}&path=${encodeURIComponent("C:\\Windows")}`);

      expect(response.status).toBe(200);
      expect(asDocument(response).pages.map((page) => page.id)).toEqual(BASE_PAGE_IDS);
    });

    it("previews an archived diagnosis too", async () => {
      const diagnosis = await conclude(await createCompany());
      expect((await send("POST", `/api/diagnoses/${diagnosis.id}/archive`)).status).toBe(200);

      expect((await preview(`kind=diagnosis&diagnosisId=${diagnosis.id}`)).status).toBe(200);
    });

    it("answers 404 diagnosis_not_found for a diagnosis that does not exist", async () => {
      const response = await preview("kind=diagnosis&diagnosisId=not-a-diagnosis");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diagnosis_not_found");
    });

    it("answers 409 diagnosis_not_completed for a draft", async () => {
      const draft = await startDraft(await createCompany());

      const response = await preview(`kind=diagnosis&diagnosisId=${draft.id}`);

      expect(response.status).toBe(409);
      expect(asError(response).code).toBe("diagnosis_not_completed");
    });

    it.each([
      ["no type", ""],
      ["an unknown type", "kind=evolution&diagnosisId=x"],
      ["no diagnosis", "kind=diagnosis"],
      ["an empty diagnosis", "kind=diagnosis&diagnosisId="],
      ["a diagnosis id too long to be one", `kind=diagnosis&diagnosisId=${"a".repeat(65)}`],
      ["an answers flag that is not true or false", "kind=diagnosis&diagnosisId=x&includeAnswers=1"],
      ["the diagnosis sent twice", "kind=diagnosis&diagnosisId=a&diagnosisId=b"],
    ])("answers 400 validation_failed for %s", async (_label, query) => {
      const response = await preview(query);

      expect(response.status).toBe(400);
      expect(asError(response).code).toBe("validation_failed");
    });
  });

  describe("POST /api/reports/export", () => {
    it("saves {company}-{date}.pdf, registers the file and answers its id, name and folder (AC-ra-17)", async () => {
      const companyId = await createCompany();
      const diagnosis = await conclude(companyId);

      const response = await exportSelection(selectionOf(diagnosis.id));

      expect(response.status).toBe(200);
      const file = asReportFile(response);
      expect(file).toEqual({ fileId: expect.any(String), fileName: `Academia Foco-${FILE_DATE}.pdf`, directory: db.downloadsDir });
      expect(listDownloads()).toEqual([file.fileName]);
      expect(readFileSync(path.join(db.downloadsDir, file.fileName)).subarray(0, 5).toString("latin1")).toBe("%PDF-");
      const records = await db.prisma.generatedFile.findMany();
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        id: file.fileId,
        companyId,
        kind: "diagnosis_pdf",
        fileName: file.fileName,
        directory: db.downloadsDir,
      });
    });

    it("saves the same pages, titles and page count as the preview, with and without the answers (AC-ra-02)", async () => {
      const diagnosis = await conclude(await createCompany());

      for (const includeAnswers of [false, true]) {
        const document = asDocument(await preview(`kind=diagnosis&diagnosisId=${diagnosis.id}&includeAnswers=${includeAnswers}`));
        const { fileName } = asReportFile(await exportSelection(selectionOf(diagnosis.id, includeAnswers)));

        const { totalPages, pages } = await readPdfPages(path.join(db.downloadsDir, fileName));

        expect(totalPages, `answers ${includeAnswers}`).toBe(document.pages.length);
        document.pages.forEach((page, index) => {
          expect(pages[index], `${page.id} (answers ${includeAnswers})`).toContain(squash(page.title));
        });
      }
    });

    it("puts the answers appendix in the PDF only when asked (BR-ra-08)", async () => {
      const diagnosis = await conclude(await createCompany());

      const plain = asReportFile(await exportSelection(selectionOf(diagnosis.id)));
      const full = asReportFile(await exportSelection(selectionOf(diagnosis.id, true)));

      expect(await readPdfText(path.join(db.downloadsDir, plain.fileName))).not.toContain(PAGE_TITLES.answers);
      const fullText = await readPdfText(path.join(db.downloadsDir, full.fileName));
      expect(fullText).toContain(ANSWERS_COPY.numbersTitle);
      expect(fullText).toContain(ANSWERS_COPY.marginText(40));
    });

    it("gives a name already taken ' (2)' and its own record, never overwriting the first (AC-ra-17)", async () => {
      const diagnosis = await conclude(await createCompany());

      const first = asReportFile(await exportSelection(selectionOf(diagnosis.id)));
      const second = asReportFile(await exportSelection(selectionOf(diagnosis.id)));

      expect(first.fileName).toBe(`Academia Foco-${FILE_DATE}.pdf`);
      expect(second.fileName).toBe(`Academia Foco-${FILE_DATE} (2).pdf`);
      expect(second.fileId).not.toBe(first.fileId);
      expect(listDownloads()).toEqual([first.fileName, second.fileName].sort());
      expect(await db.prisma.generatedFile.count()).toBe(2);
    });

    it("keeps two exports at the same moment apart", async () => {
      const diagnosis = await conclude(await createCompany());

      const [a, b] = await Promise.all([
        exportSelection(selectionOf(diagnosis.id)),
        exportSelection(selectionOf(diagnosis.id)),
      ]);

      expect(new Set([asReportFile(a).fileName, asReportFile(b).fileName]).size).toBe(2);
      expect(new Set([asReportFile(a).fileId, asReportFile(b).fileId]).size).toBe(2);
      expect(listDownloads()).toHaveLength(2);
    });

    it("keeps a hostile company name inside the Downloads folder", async () => {
      const diagnosis = await conclude(await createCompany("../../etc/passwd"));

      const file = asReportFile(await exportSelection(selectionOf(diagnosis.id)));

      expect(path.basename(file.fileName)).toBe(file.fileName);
      expect(listDownloads()).toEqual([file.fileName]);
      expect(readdirSync(path.dirname(db.downloadsDir))).not.toContain("etc");
    });

    it("takes nothing from the body but the selection: a folder or a name sent is ignored (AC-ra-18)", async () => {
      const diagnosis = await conclude(await createCompany());
      const elsewhere = path.join(path.dirname(db.downloadsDir), "elsewhere");

      const response = await exportSelection({ ...selectionOf(diagnosis.id), directory: elsewhere, fileName: "mine.pdf" });

      expect(response.status).toBe(200);
      expect(asReportFile(response)).toMatchObject({ fileName: `Academia Foco-${FILE_DATE}.pdf`, directory: db.downloadsDir });
      expect(readdirSync(path.dirname(db.downloadsDir))).not.toContain("elsewhere");
    });

    it("lets the saved file be opened by its id and by nothing else (AC-ra-17, AC-ra-18)", async () => {
      const diagnosis = await conclude(await createCompany());
      const opened: string[] = [];
      const session = await startServer(
        createApp({
          ...db,
          systemOpener: { openFile: async (filePath) => void opened.push(filePath), revealFile: async () => undefined },
          backendPort: 4329,
        }),
      );
      try {
        const file = asReportFile(await callApi(session.baseUrl, "POST", "/api/reports/export", selectionOf(diagnosis.id)));

        const open = await callApi(session.baseUrl, "POST", `/api/files/${file.fileId}/open`);

        expect(open.status).toBe(204);
        expect(opened).toEqual([path.join(db.downloadsDir, file.fileName)]);
        expect((await callApi(session.baseUrl, "POST", "/api/files/not-a-file/open")).status).toBe(404);
      } finally {
        await session.close();
      }
    });

    it("answers 409 diagnosis_not_completed for a draft and writes nothing", async () => {
      const draft = await startDraft(await createCompany());

      const response = await exportSelection(selectionOf(draft.id));

      expect(response.status).toBe(409);
      expect(asError(response).code).toBe("diagnosis_not_completed");
      expect(listDownloads()).toEqual([]);
      expect(await db.prisma.generatedFile.count()).toBe(0);
    });

    it("answers 404 diagnosis_not_found for a diagnosis that does not exist and writes nothing", async () => {
      const response = await exportSelection(selectionOf("not-a-diagnosis"));

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diagnosis_not_found");
      expect(listDownloads()).toEqual([]);
      expect(await db.prisma.generatedFile.count()).toBe(0);
    });

    it.each([
      ["an empty body", {}],
      ["no diagnosis", { kind: "diagnosis" }],
      ["a type of report that does not exist", { kind: "carteira" }],
      ["an answers flag written as text", { kind: "diagnosis", diagnosisId: "x", includeAnswers: "true" }],
      ["a diagnosis id too long to be one", { kind: "diagnosis", diagnosisId: "a".repeat(65) }],
    ])("answers 400 validation_failed for %s and writes nothing", async (_label, body) => {
      const response = await exportSelection(body);

      expect(response.status).toBe(400);
      expect(asError(response).code).toBe("validation_failed");
      expect(listDownloads()).toEqual([]);
      expect(await db.prisma.generatedFile.count()).toBe(0);
    });

    it("saves the portfolio report as carteira-{data}.pdf, registered without a company", async () => {
      await conclude(await createCompany());
      await createCompany("Studio Norte");

      const response = await exportSelection({ kind: "portfolio" });

      expect(response.status).toBe(200);
      const file = response.body as { fileId: string; fileName: string; directory: string };
      expect(file.fileName).toBe(`carteira-${FILE_DATE}.pdf`);
      expect(listDownloads()).toEqual([file.fileName]);
      const record = await db.prisma.generatedFile.findUnique({ where: { id: file.fileId } });
      expect(record).toMatchObject({ kind: "portfolio_pdf", companyId: null, fileName: file.fileName });
      const text = await readPdfText(path.join(db.downloadsDir, file.fileName));
      expect(text).toContain("Academia Foco");
      expect(text).toContain("Studio Norte");
    });

    it("answers 409 portfolio_empty with no active company and writes nothing", async () => {
      // A portfolio file belongs to no company, so the reset between tests does not take it
      const recordsBefore = await db.prisma.generatedFile.count();

      const response = await exportSelection({ kind: "portfolio" });

      expect(response.status).toBe(409);
      expect(asError(response).code).toBe("portfolio_empty");
      expect(listDownloads()).toEqual([]);
      expect(await db.prisma.generatedFile.count()).toBe(recordsBefore);
    });

    it("changes nothing in the diagnosis", async () => {
      const diagnosis = await conclude(await createCompany());
      const before = await send("GET", `/api/diagnoses/${diagnosis.id}`);

      expect((await exportSelection(selectionOf(diagnosis.id, true))).status).toBe(200);

      expect(await send("GET", `/api/diagnoses/${diagnosis.id}`)).toEqual(before);
    });
  });

  describe("the report service", () => {
    it("uses the app clock for the credit line of the cover and for the record of the file", async () => {
      const diagnosis = await conclude(await createCompany());
      // 12:00 UTC is the same calendar day in every time zone the owner can be in.
      const clock = new Date("2026-11-02T12:00:00.000Z");
      const service = createReportService({ prisma: db.prisma, downloadsDir: db.downloadsDir, now: () => clock });

      const file = await service.export({ kind: "diagnosis", diagnosisId: diagnosis.id, includeAnswers: false });

      const record = await db.prisma.generatedFile.findUnique({ where: { id: file.fileId } });
      expect(record?.createdAt.toISOString()).toBe(clock.toISOString());
      const text = await readPdfText(path.join(db.downloadsDir, file.fileName));
      expect(text).toContain("em 02/11/2026");
      // the day the diagnosis was made does not move
      expect(text).toContain("Data do diagnóstico 23/10/2026");
    });
  });
});

describe("sanitizeFileStem", () => {
  it.each([
    ["Academia Foco", "Academia Foco"],
    ["Café & Cia. Ltda", "Café & Cia. Ltda"],
    ["a/b\\c", "a-b-c"],
    ["../x", "x"],
    ["  espaços   demais  ", "espaços demais"],
    ["fim com ponto.", "fim com ponto"],
    ["com\u0000controle\u001f", "com-controle"],
    ["LPT1", "_LPT1"],
    ["com1.txt", "_com1.txt"],
    ["", "arquivo"],
    ["...", "arquivo"],
  ])("turns %j into %j", (input, expected) => {
    expect(sanitizeFileStem(input)).toBe(expected);
  });

  it("cuts at the given length without breaking a character", () => {
    expect(sanitizeFileStem("a".repeat(200))).toHaveLength(80);
    expect(sanitizeFileStem("😀".repeat(100), 10)).toBe("😀".repeat(10));
    expect(sanitizeFileStem("abc-def", 4)).toBe("abc");
  });
});
