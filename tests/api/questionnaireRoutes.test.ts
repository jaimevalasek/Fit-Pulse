import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import type { Express } from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { QUESTION_BANK, allowsUnknown } from "../../shared/content/questionBank.ts";
import { PURCHASES_PER_YEAR_KEYS, RELATIONSHIP_LENGTH_KEYS } from "../../shared/domain/types.ts";
import { createApp } from "../../server/app.ts";
import type { SystemOpener } from "../../server/files/systemOpener.ts";
import {
  ANSWERS_FILE_FORMAT,
  ANSWERS_FILE_FORMAT_VERSION,
  QUESTIONNAIRE_VERSION,
} from "../../server/questionnaire/questionnaireFile.ts";
import { createDiagnosisRepository } from "../../server/repositories/diagnosisRepository.ts";
import { createQuestionnaireRepository } from "../../server/repositories/questionnaireRepository.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-011: the remote questionnaire routes. Covers the file saved for the client and the company waiting for
// its answers (AC-ra-48), the answers file that becomes a draft with the answers and numbers and leaves
// "aguardando" (AC-ra-51), each file that is refused with nothing changed (AC-ra-52, RULE-ra-10) and the
// draft that is only replaced once confirmed (AC-ra-53, RULE-dm-13).

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

async function callApi(baseUrl: string, method: string, path: string, body?: unknown): Promise<ApiResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? null : JSON.parse(text) };
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> } & Record<string, unknown>;
}

interface SentBody {
  fileId: string;
  fileName: string;
  directory: string;
  sentAt: string;
  message: string;
}

interface ImportedBody {
  draftId: string;
  clientSavedAt: string;
}

interface AwaitingBody {
  companyId: string;
  name: string;
  sentAt: string;
  waitingDays: number;
}

interface DraftBody {
  id: string;
  status: string;
  answers: Record<string, number | null>;
  calculator: Record<string, unknown>;
  currentBlock: number;
}

const asError = (response: ApiResponse): ErrorBody["error"] => (response.body as ErrorBody).error;
const asSent = (response: ApiResponse): SentBody => response.body as SentBody;
const asImported = (response: ApiResponse): ImportedBody => response.body as ImportedBody;
const asDraft = (response: ApiResponse): DraftBody => response.body as DraftBody;

// 2026-10-23 is "today" in these tests; the client saved the answers two days before.
const TODAY = new Date("2026-10-23T12:00:00.000Z");
const CLIENT_SAVED_AT = "2026-10-21T15:30:00.000Z";

// All 24 questions answered (one of them "não sei" where the catalog offers it) and the 6 numbers of block 1.
const ANSWERS: Record<string, number | null> = Object.fromEntries(
  QUESTION_BANK.map((question, index) => [question.id, index === 0 && allowsUnknown(question.id) ? null : index % 4]),
);
const CALCULATOR = {
  spendMode: "exact",
  spendParts: { ads: 300_000, agency: 100_000 },
  newCustomersMode: "exact",
  newCustomers: 40,
  averagePurchaseCents: 15_000,
  purchasesPerYear: PURCHASES_PER_YEAR_KEYS[0],
  relationshipLength: RELATIONSHIP_LENGTH_KEYS[0],
  marginPercent: 40,
};

interface FileCompany {
  id: string;
  name: string;
}

// What the client's browser saves as `respostas-{empresa}.fitpulse` (IF-004).
function answersFile(company: FileCompany, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: ANSWERS_FILE_FORMAT,
    formatVersion: ANSWERS_FILE_FORMAT_VERSION,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    company,
    savedAt: CLIENT_SAVED_AT,
    answers: ANSWERS,
    calculator: CALCULATOR,
    ...overrides,
  });
}

describe("questionnaire routes", () => {
  let db: TestDatabase;
  let server: RunningServer;
  const revealed: string[] = [];

  const get = (path: string) => callApi(server.baseUrl, "GET", path);
  const post = (path: string, body?: unknown) => callApi(server.baseUrl, "POST", path, body ?? {});

  async function createCompany(name = "Academia Foco"): Promise<FileCompany> {
    const response = await post("/api/companies", { name, segment: "health_wellness", salesChannel: "subscription" });
    expect(response.status).toBe(201);
    return { id: (response.body as { id: string }).id, name };
  }

  const sendQuestionnaire = (company: FileCompany) => post(`/api/companies/${company.id}/questionnaire`);
  const importAnswers = (company: FileCompany, content: string, replaceDraft?: boolean) =>
    post(`/api/companies/${company.id}/questionnaire-answers`, replaceDraft === undefined ? { content } : { content, replaceDraft });
  const startDraft = async (company: FileCompany) => asDraft(await post(`/api/companies/${company.id}/diagnoses`));

  const downloads = () => readdirSync(db.downloadsDir).sort();
  const sendRows = (companyId: string) =>
    db.prisma.questionnaireSend.findMany({ where: { companyId }, orderBy: [{ sentAt: "asc" }, { id: "asc" }] });
  const draftRows = (companyId: string) => db.prisma.diagnosis.findMany({ where: { companyId, status: "draft" } });
  const awaitingIds = async () => (await createQuestionnaireRepository(db.prisma).listAwaiting()).map((send) => send.companyId);

  // Everything a refused import must leave as it was: the company's diagnoses and its sends.
  async function snapshot(companyId: string) {
    return {
      diagnoses: await db.prisma.diagnosis.findMany({ where: { companyId }, orderBy: { id: "asc" } }),
      sends: await sendRows(companyId),
    };
  }

  async function expectRefused(company: FileCompany, content: string, status: number, code: string, replaceDraft?: boolean) {
    const before = await snapshot(company.id);
    const response = await importAnswers(company, content, replaceDraft);
    expect(response.status).toBe(status);
    expect(asError(response).code).toBe(code);
    expect(await snapshot(company.id)).toEqual(before);
    return asError(response);
  }

  const opener: SystemOpener = {
    async openFile() {},
    async revealFile(filePath) {
      revealed.push(filePath);
    },
  };

  beforeAll(async () => {
    db = await createTestDatabase();
    server = await startServer(createApp({ ...db, systemOpener: opener, backendPort: 4361 }));
  });

  afterAll(async () => {
    await server.close();
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
    for (const name of downloads()) {
      await rm(path.join(db.downloadsDir, name), { recursive: true, force: true });
    }
    revealed.length = 0;
    db.setNow(TODAY);
  });

  describe("POST /api/companies/:id/questionnaire (AC-ra-48)", () => {
    it("saves {empresa}-questionario-{data}.html in Downloads and answers with the message for the client", async () => {
      const company = await createCompany();

      const response = await sendQuestionnaire(company);

      expect(response.status).toBe(200);
      const sent = asSent(response);
      expect(sent.fileName).toBe("academia-foco-questionario-2026-10-23.html");
      expect(sent.directory).toBe(db.downloadsDir);
      expect(sent.sentAt).toBe(TODAY.toISOString());
      expect(sent.message).toBe(
        "Olá! Segue o questionário do FitPulse para a Academia Foco. Abra o arquivo no computador " +
          '(no celular ele pode não funcionar), responda com calma e, no fim, clique em "Salvar minhas respostas". ' +
          "Depois me envie o arquivo que for salvo. Leva uns 12 minutos.",
      );
      expect(downloads()).toEqual([sent.fileName]);
      const html = readFileSync(path.join(db.downloadsDir, sent.fileName), "utf8");
      expect(html).toContain(company.id);
    });

    it("signs the message with the brand of whoever delivers", async () => {
      const company = await createCompany();
      expect((await callApi(server.baseUrl, "PUT", "/api/brand", { name: "Marina Costa Consultoria" })).status).toBe(200);

      const { message } = asSent(await sendQuestionnaire(company));

      expect(message.endsWith('Leva uns 12 minutos.\nMarina Costa Consultoria')).toBe(true);
    });

    it("registers the file and puts the company in 'aguardando resposta'", async () => {
      const company = await createCompany();
      const other = await createCompany("Mercado Azul");

      const sent = asSent(await sendQuestionnaire(company));

      const rows = await sendRows(company.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ companyId: company.id, fileName: sent.fileName, answeredAt: null, clientSavedAt: null, draftId: null });
      expect(rows[0].sentAt).toEqual(TODAY);
      expect(await awaitingIds()).toEqual([company.id]);
      expect(await sendRows(other.id)).toEqual([]);
      const record = await db.prisma.generatedFile.findUnique({ where: { id: sent.fileId } });
      expect(record).toMatchObject({ companyId: company.id, kind: "questionnaire_html", fileName: sent.fileName, directory: db.downloadsDir });
    });

    it("lets 'Mostrar na pasta' find the saved file by its id", async () => {
      const company = await createCompany();
      const sent = asSent(await sendQuestionnaire(company));

      const response = await post(`/api/files/${sent.fileId}/reveal`);

      expect(response.status).toBe(204);
      expect(revealed).toEqual([path.join(db.downloadsDir, sent.fileName)]);
    });

    it("carries only its own company (RULE-ra-11)", async () => {
      const company = await createCompany();
      const other = await createCompany("Mercado Azul");

      const sent = asSent(await sendQuestionnaire(company));

      const html = readFileSync(path.join(db.downloadsDir, sent.fileName), "utf8");
      expect(html).not.toContain(other.id);
      expect(html).not.toContain(other.name);
    });

    it("keeps the first file when the same day sends again", async () => {
      const company = await createCompany();

      const first = asSent(await sendQuestionnaire(company));
      const second = asSent(await sendQuestionnaire(company));

      expect(second.fileName).toBe("academia-foco-questionario-2026-10-23 (2).html");
      expect(downloads()).toEqual([first.fileName, second.fileName].sort());
      expect(await sendRows(company.id)).toHaveLength(2);
    });

    it("answers 404 for a company that does not exist and saves nothing", async () => {
      const response = await post("/api/companies/nao-existe/questionnaire");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
      expect(downloads()).toEqual([]);
      expect(await db.prisma.questionnaireSend.count()).toBe(0);
    });

    it("answers 500 write_failed and leaves nothing behind when the folder cannot be written", async () => {
      const company = await createCompany();
      const blocker = path.join(db.downloadsDir, "blocker");
      writeFileSync(blocker, "not a folder");
      const broken = await startServer(createApp({ ...db, downloadsDir: path.join(blocker, "inside"), backendPort: 4362 }));
      try {
        const response = await callApi(broken.baseUrl, "POST", `/api/companies/${company.id}/questionnaire`, {});

        expect(response.status).toBe(500);
        expect(asError(response).code).toBe("write_failed");
        expect(asError(response).message).toContain("Nada foi alterado.");
        expect(await db.prisma.questionnaireSend.count()).toBe(0);
        expect(await db.prisma.generatedFile.count()).toBe(0);
        expect(downloads()).toEqual(["blocker"]);
      } finally {
        await broken.close();
      }
    });
  });

  describe("POST /api/companies/:id/questionnaire-answers", () => {
    it("turns the client's file into a draft with the 24 answers and the 6 numbers (AC-ra-51)", async () => {
      const company = await createCompany();
      await sendQuestionnaire(company);

      const response = await importAnswers(company, answersFile(company));

      expect(response.status).toBe(201);
      const imported = asImported(response);
      expect(imported.clientSavedAt).toBe(CLIENT_SAVED_AT);
      const draft = asDraft(await get(`/api/diagnoses/${imported.draftId}`));
      expect(draft).toMatchObject({ id: imported.draftId, status: "draft", currentBlock: 1 });
      expect(Object.keys(draft.answers)).toHaveLength(QUESTION_BANK.length);
      expect(draft.answers).toEqual(ANSWERS);
      expect(draft.calculator).toMatchObject(CALCULATOR);
      expect(await draftRows(company.id)).toHaveLength(1);
    });

    it("takes the company out of 'aguardando resposta' and marks the draft with the client's date", async () => {
      const company = await createCompany();
      const other = await createCompany("Mercado Azul");
      await sendQuestionnaire(company);
      await sendQuestionnaire(other);

      const { draftId } = asImported(await importAnswers(company, answersFile(company)));

      expect(await awaitingIds()).toEqual([other.id]);
      const [send] = await sendRows(company.id);
      expect(send).toMatchObject({ draftId });
      expect(send.answeredAt).toEqual(TODAY);
      expect(send.clientSavedAt).toEqual(new Date(CLIENT_SAVED_AT));
      const repository = createQuestionnaireRepository(db.prisma);
      expect(await repository.findClientSavedAtByDraft(draftId)).toEqual(new Date(CLIENT_SAVED_AT));
      expect(await repository.findClientSavedAtByDraft("outro-rascunho")).toBeNull();
    });

    it("hands over a draft that concludes through the normal gate (AC-dm-14)", async () => {
      const company = await createCompany();
      await sendQuestionnaire(company);
      const { draftId } = asImported(await importAnswers(company, answersFile(company)));

      const response = await post(`/api/diagnoses/${draftId}/complete`);

      expect(response.status).toBe(200);
      expect(asDraft(response)).toMatchObject({ id: draftId, status: "completed" });
    });

    it("does not date the answers after the day of the import when the client's clock is ahead", async () => {
      const company = await createCompany();

      const response = await importAnswers(company, answersFile(company, { savedAt: "2030-01-01T00:00:00.000Z" }));

      expect(asImported(response).clientSavedAt).toBe(TODAY.toISOString());
    });

    it("keeps the mark when there was no send waiting: the import records itself", async () => {
      const company = await createCompany();

      const { draftId } = asImported(await importAnswers(company, answersFile(company)));

      const rows = await sendRows(company.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ fileName: "respostas-academia-foco.fitpulse", draftId });
      expect(rows[0].clientSavedAt).toEqual(new Date(CLIENT_SAVED_AT));
      expect(await awaitingIds()).toEqual([]);
    });

    it("answers 404 for a company that does not exist", async () => {
      const company = await createCompany();
      const ghost = { id: "nao-existe", name: company.name };

      const response = await importAnswers(ghost, answersFile(company));

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("company_not_found");
      expect(await db.prisma.diagnosis.count()).toBe(0);
    });

    it("asks for the text of the file", async () => {
      const company = await createCompany();

      const noContent = await post(`/api/companies/${company.id}/questionnaire-answers`, {});
      const badReplace = await post(`/api/companies/${company.id}/questionnaire-answers`, {
        content: answersFile(company),
        replaceDraft: "sim",
      });

      expect(noContent.status).toBe(400);
      expect(asError(noContent).code).toBe("validation_failed");
      expect(asError(noContent).fields).toHaveProperty("content");
      expect(badReplace.status).toBe(400);
      expect(asError(badReplace).fields).toHaveProperty("replaceDraft");
      expect(await db.prisma.diagnosis.count()).toBe(0);
    });
  });

  describe("files that are refused change nothing (AC-ra-52, RULE-ra-10)", () => {
    let company: FileCompany;

    beforeEach(async () => {
      company = await createCompany();
      await sendQuestionnaire(company);
    });

    it("refuses the file of another company and names both", async () => {
      const other = await createCompany("Mercado Azul");

      const error = await expectRefused(company, answersFile(other), 422, "answers_other_company");

      expect(error.message).toBe("Este arquivo é de Mercado Azul, não de Academia Foco.");
      expect(error).toMatchObject({ fileCompanyName: "Mercado Azul", currentCompanyName: "Academia Foco" });
    });

    it("refuses a file saved by a newer release, of the file format or of the questionnaire", async () => {
      const newerFormat = await expectRefused(company, answersFile(company, { formatVersion: ANSWERS_FILE_FORMAT_VERSION + 1 }), 422, "answers_newer_version");
      await expectRefused(company, answersFile(company, { questionnaireVersion: QUESTIONNAIRE_VERSION + 1 }), 422, "answers_newer_version");

      expect(newerFormat.message).toBe(
        "Este arquivo foi feito por uma versão mais nova do FitPulse. Atualize o app pelo Play e importe de novo.",
      );
    });

    it("refuses a file that does not fit the questionnaire", async () => {
      const unknownQuestion = await expectRefused(company, answersFile(company, { answers: { ...ANSWERS, zz9: 2 } }), 422, "answers_incompatible");
      await expectRefused(company, answersFile(company, { answers: { ...ANSWERS, [QUESTION_BANK[0].id]: 7 } }), 422, "answers_incompatible");
      await expectRefused(company, answersFile(company, { calculator: { ...CALCULATOR, marginPercent: 150 } }), 422, "answers_incompatible");
      await expectRefused(company, answersFile(company, { calculator: { ...CALCULATOR, diarySource: {} } }), 422, "answers_incompatible");
      await expectRefused(company, answersFile(company, { calculator: { ...CALCULATOR, cac: 1 } }), 422, "answers_incompatible");

      expect(unknownQuestion.message).toContain("outra versão do questionário");
    });

    it("refuses a file that is not an answers file", async () => {
      const notJson = await expectRefused(company, "isto não é um arquivo de respostas {", 422, "answers_invalid");
      await expectRefused(company, "", 422, "answers_invalid");
      await expectRefused(company, "[1, 2, 3]", 422, "answers_invalid");
      await expectRefused(company, JSON.stringify({ format: "outro-formato", answers: {} }), 422, "answers_invalid");
      await expectRefused(company, answersFile(company, { format: "outro-formato" }), 422, "answers_invalid");
      await expectRefused(company, answersFile(company, { company: { id: company.id } }), 422, "answers_invalid");
      await expectRefused(company, answersFile(company, { savedAt: "ontem" }), 422, "answers_invalid");
      await expectRefused(company, answersFile(company, { answers: [] }), 422, "answers_invalid");
      await expectRefused(company, answersFile(company, { calculator: null }), 422, "answers_invalid");

      expect(notJson.message).toBe("Este arquivo não é um arquivo de respostas do FitPulse.");
    });

    it("refuses a file over 1 MB, whether the route or the service notices", async () => {
      const justOver = "x".repeat(1024 * 1024 + 1);
      const wayOver = "x".repeat(2.5 * 1024 * 1024);

      const small = await expectRefused(company, justOver, 413, "payload_too_large");
      const large = await expectRefused(company, wayOver, 413, "payload_too_large");

      expect(small.message).toContain("1 MB");
      expect(large.message).toBe(small.message);
    });

    it("accepts a file just under 1 MB as long as it is the right file", async () => {
      const padding = "x".repeat(1024 * 1024 - answersFile(company).length - 64);

      const response = await importAnswers(company, answersFile(company, { note: padding }));

      expect(response.status).toBe(201);
    });
  });

  describe("a draft already there (AC-ra-53, RULE-dm-13)", () => {
    let company: FileCompany;

    beforeEach(async () => {
      company = await createCompany();
      await sendQuestionnaire(company);
    });

    it("asks before replacing it and changes nothing until then", async () => {
      const draft = await startDraft(company);
      const created = (await draftRows(company.id))[0].createdAt;
      const before = await snapshot(company.id);

      const response = await importAnswers(company, answersFile(company));

      expect(response.status).toBe(409);
      expect(asError(response)).toMatchObject({ code: "draft_exists", draftCreatedAt: created.toISOString() });
      expect(await snapshot(company.id)).toEqual(before);
      expect((await draftRows(company.id)).map((row) => row.id)).toEqual([draft.id]);
      expect(await awaitingIds()).toEqual([company.id]);
      expect((await importAnswers(company, answersFile(company), false)).status).toBe(409);
    });

    it("swaps the draft for the answers once confirmed and keeps a single draft", async () => {
      const draft = await startDraft(company);

      const response = await importAnswers(company, answersFile(company), true);

      expect(response.status).toBe(201);
      const { draftId } = asImported(response);
      expect(draftId).not.toBe(draft.id);
      expect((await get(`/api/diagnoses/${draft.id}`)).status).toBe(404);
      expect((await draftRows(company.id)).map((row) => row.id)).toEqual([draftId]);
      expect(asDraft(await get(`/api/diagnoses/${draftId}`)).answers).toEqual(ANSWERS);
      expect(await awaitingIds()).toEqual([]);
    });

    it("leaves the draft alone when the confirmed import is for a file that is refused", async () => {
      const draft = await startDraft(company);
      const other = await createCompany("Mercado Azul");

      await expectRefused(company, answersFile(other), 422, "answers_other_company", true);
      await expectRefused(company, "não é um arquivo", 422, "answers_invalid", true);

      expect((await draftRows(company.id)).map((row) => row.id)).toEqual([draft.id]);
    });

    it("does not touch the diagnoses already concluded", async () => {
      const first = asImported(await importAnswers(company, answersFile(company)));
      expect((await post(`/api/diagnoses/${first.draftId}/complete`)).status).toBe(200);
      await startDraft(company);

      const response = await importAnswers(company, answersFile(company), true);

      expect(response.status).toBe(201);
      const diagnoses = await db.prisma.diagnosis.findMany({ where: { companyId: company.id } });
      expect(diagnoses.filter((row) => row.status === "completed").map((row) => row.id)).toEqual([first.draftId]);
      expect(diagnoses.filter((row) => row.status === "draft")).toHaveLength(1);
    });

    it("undoes the swap when something fails after the new draft exists", async () => {
      const draft = await startDraft(company);
      const diagnoses = createDiagnosisRepository(db.prisma);

      await expect(
        diagnoses.importDraft(
          company.id,
          { answers: ANSWERS, calculator: CALCULATOR },
          {
            replace: true,
            afterCreate: async () => {
              throw new Error("the marks could not be saved");
            },
          },
        ),
      ).rejects.toThrow("the marks could not be saved");

      expect((await draftRows(company.id)).map((row) => row.id)).toEqual([draft.id]);
    });

    it("ends with a single draft when two imports arrive together", async () => {
      const statuses = (
        await Promise.all([importAnswers(company, answersFile(company)), importAnswers(company, answersFile(company))])
      )
        .map((response) => response.status)
        .sort();

      expect(statuses).toEqual([201, 409]);
      expect(await draftRows(company.id)).toHaveLength(1);
    });
  });

  describe("'Questionários aguardando resposta' in the consultant's attention (AC-ra-35)", () => {
    const sendOn = async (company: FileCompany, at: Date) => {
      db.setNow(at);
      await sendQuestionnaire(company);
      db.setNow(TODAY);
    };
    const daysBefore = (days: number) => new Date(TODAY.getTime() - days * 24 * 60 * 60 * 1000);
    const consultantHome = async () => (await get("/api/home?mode=consultant")).body as { awaitingQuestionnaires?: AwaitingBody[] };
    const filtered = async () => ((await get("/api/companies?attention=aguardando")).body as Array<{ id: string }>).map((company) => company.id);

    it("lists the company with the day it was sent and how long it waits, and leaves the key out while nobody waits", async () => {
      const company = await createCompany();
      expect((await consultantHome()).awaitingQuestionnaires).toBeUndefined();

      await sendOn(company, daysBefore(5));

      expect((await consultantHome()).awaitingQuestionnaires).toEqual([
        { companyId: company.id, name: company.name, sentAt: daysBefore(5).toISOString(), waitingDays: 5 },
      ]);
    });

    it("opens exactly the companies the home listed, and none of the others", async () => {
      const waiting = await createCompany("Academia Foco");
      const answered = await createCompany("Mercado Azul");
      await createCompany("Padaria Nova");
      await sendOn(waiting, daysBefore(2));
      await sendOn(answered, daysBefore(3));
      await importAnswers(answered, answersFile(answered));

      const listed = ((await consultantHome()).awaitingQuestionnaires ?? []).map((item) => item.companyId);

      expect(listed).toEqual([waiting.id]);
      expect(await filtered()).toEqual(listed);
    });

    it("counts a company once, by its newest send, and puts the longest wait first", async () => {
      const resent = await createCompany("Zeta Fitness");
      const longest = await createCompany("Alfa Studio");
      const recent = await createCompany("Beta Gym");
      await sendOn(resent, daysBefore(20));
      await sendOn(resent, daysBefore(4));
      await sendOn(longest, daysBefore(9));
      await sendOn(recent, daysBefore(1));

      const { awaitingQuestionnaires = [] } = await consultantHome();

      expect(awaitingQuestionnaires.map((item) => [item.name, item.waitingDays])).toEqual([
        ["Alfa Studio", 9],
        ["Zeta Fitness", 4],
        ["Beta Gym", 1],
      ]);
      expect([...(await filtered())].sort()).toEqual([resent.id, longest.id, recent.id].sort());
    });

    it("takes the company out of the home and of the filter once its answers are imported (AC-ra-51)", async () => {
      const company = await createCompany();
      await sendOn(company, daysBefore(3));
      expect(await filtered()).toEqual([company.id]);

      await importAnswers(company, answersFile(company));

      expect((await consultantHome()).awaitingQuestionnaires).toBeUndefined();
      expect(await filtered()).toEqual([]);
    });

    it("keeps a refused file from taking the company out of the list (RULE-ra-10)", async () => {
      const company = await createCompany();
      const other = await createCompany("Mercado Azul");
      await sendOn(company, daysBefore(3));

      await expectRefused(company, answersFile(other), 422, "answers_other_company");

      expect(await filtered()).toEqual([company.id]);
    });

    it("shows an archived company nowhere", async () => {
      const company = await createCompany();
      await sendOn(company, daysBefore(3));

      expect((await post(`/api/companies/${company.id}/archive`)).status).toBe(200);

      expect((await consultantHome()).awaitingQuestionnaires).toBeUndefined();
      expect(await filtered()).toEqual([]);

      expect((await post(`/api/companies/${company.id}/restore`)).status).toBe(200);
      expect(await filtered()).toEqual([company.id]);
    });
  });

  describe("the imported draft in the company timeline (AC-ra-51, IF-011)", () => {
    const timelineDraft = async (company: FileCompany) =>
      ((await get(`/api/companies/${company.id}/timeline`)).body as { draft: { id: string; clientAnswersSavedAt?: string | null } | null }).draft;

    it("marks the draft with the day the client saved the answers", async () => {
      const company = await createCompany();
      await sendQuestionnaire(company);

      const { draftId } = asImported(await importAnswers(company, answersFile(company)));

      expect(await timelineDraft(company)).toMatchObject({ id: draftId, clientAnswersSavedAt: CLIENT_SAVED_AT });
    });

    it("leaves the mark off a draft the owner started", async () => {
      const company = await createCompany();
      const draft = await startDraft(company);

      const shown = await timelineDraft(company);

      expect(shown?.id).toBe(draft.id);
      expect(shown?.clientAnswersSavedAt ?? null).toBeNull();
    });

    it("marks the draft that replaced the old one with the date of the new file, not the old one's", async () => {
      const company = await createCompany();
      const { draftId: older } = asImported(await importAnswers(company, answersFile(company)));
      const newerSavedAt = "2026-10-22T10:00:00.000Z";

      const { draftId } = asImported(await importAnswers(company, answersFile(company, { savedAt: newerSavedAt }), true));

      expect(draftId).not.toBe(older);
      expect(await timelineDraft(company)).toMatchObject({ id: draftId, clientAnswersSavedAt: newerSavedAt });
    });

    it("keeps the mark when the imported draft is worked on", async () => {
      const company = await createCompany();
      const { draftId } = asImported(await importAnswers(company, answersFile(company)));

      expect((await callApi(server.baseUrl, "PATCH", `/api/diagnoses/${draftId}`, { currentBlock: 3 })).status).toBe(200);

      expect(await timelineDraft(company)).toMatchObject({ id: draftId, currentBlock: 3, clientAnswersSavedAt: CLIENT_SAVED_AT });
    });
  });

  it("forgets the sends of a company that is removed", async () => {
    const company = await createCompany();
    await sendQuestionnaire(company);
    await importAnswers(company, answersFile(company));
    expect(await db.prisma.questionnaireSend.count()).toBe(1);

    await db.prisma.company.delete({ where: { id: company.id } });

    expect(await db.prisma.questionnaireSend.count()).toBe(0);
    expect(existsSync(db.downloadsDir)).toBe(true);
  });
});
