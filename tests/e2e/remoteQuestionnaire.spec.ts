import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Browser, Page } from "@playwright/test";
import { QUESTION_BANK } from "../../shared/content/questionBank";
import {
  ANSWERS_FILE_FORMAT,
  ANSWERS_FILE_FORMAT_VERSION,
  QUESTIONNAIRE_DESKTOP_NOTICE,
  QUESTIONNAIRE_VERSION,
} from "../../server/questionnaire/questionnaireFile";
import {
  ANSWERS_INCOMPATIBLE_MESSAGE,
  ANSWERS_INVALID_MESSAGE,
  ANSWERS_NEWER_VERSION_MESSAGE,
  ANSWERS_TOO_LARGE_MESSAGE,
  answersOtherCompanyMessage,
} from "../../server/validation/questionnaireSchemas";
import { CASES, e2eWorkspace, expect, openRoute, stubSystemOpener, test, type CompanyRecord } from "./support/fixtures";

// CAP-ra-remote-questionnaire: AC-ra-48 (send), AC-ra-49 (the file opens offline, makes no request,
// has the 8 blocks and 24 questions), AC-ra-50 (review and save), AC-ra-51 (import as a draft),
// AC-ra-52 (each wrong file refused, nothing changes) and AC-ra-53 / AC-ra-59 (replace a draft in the
// app's modal). The manual check in the 4 browsers (Q-10) stays with the owner.

const NOTHING_CHANGED = "Nada foi alterado.";
const FILE_DATE = /\d{4}-\d{2}-\d{2}/.source;

interface SentQuestionnaire {
  fileId: string;
  fileName: string;
  directory: string;
  sentAt: string;
  message: string;
}

async function sendQuestionnaire(page: Page, companyId: string): Promise<SentQuestionnaire> {
  const response = await page.request.post(`/api/companies/${companyId}/questionnaire`, { data: {} });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as SentQuestionnaire;
}

/** An answers file as the client's page writes it (server/questionnaire/questionnaireClient.js). */
function answersFile(company: Pick<CompanyRecord, "id" | "name">, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: ANSWERS_FILE_FORMAT,
    formatVersion: ANSWERS_FILE_FORMAT_VERSION,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    company: { id: company.id, name: company.name },
    savedAt: "2026-10-20T15:00:00.000Z",
    answers: CASES.g3.answers,
    calculator: { spendParts: { ads: 2_000_000 }, newCustomers: 80, averagePurchaseCents: 45_000, marginPercent: 55 },
    ...overrides,
  });
}

async function openImport(page: Page, companyId: string) {
  await openRoute(page, `/empresa/${companyId}`);
  await page.locator('[data-aioson-id="import-answers"]').click();
  const modal = page.locator('[data-aioson-id="import-answers-modal"]');
  await expect(modal).toBeVisible();
  return modal;
}

async function chooseAnswersFile(page: Page, content: string | Buffer, name = "respostas.fitpulse") {
  const chooser = page.waitForEvent("filechooser");
  await page.locator('[data-aioson-id="import-choose-file"]').click();
  await (await chooser).setFiles({ name, mimeType: "application/octet-stream", buffer: typeof content === "string" ? Buffer.from(content) : content });
}

/** Opens the questionnaire file in a browser with no network at all and records every request it makes. */
async function openClientFile(browser: Browser, filePath: string, viewport = { width: 1280, height: 900 }) {
  const context = await browser.newContext({ offline: true, acceptDownloads: true, viewport, locale: "pt-BR" });
  const requests: string[] = [];
  context.on("request", (request) => requests.push(request.url()));
  const client = await context.newPage();
  await client.goto(pathToFileURL(filePath).href);
  const external = () => requests.filter((url) => !/^(file|data|blob):/.test(url));
  return { context, client, external };
}

test.beforeEach(async ({ api }) => {
  await api.reset();
  await api.setPreferences({ usageMode: "consultant" });
});

test("'Enviar questionário' saves the file in Downloads with the message, and the company waits for the answers", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Studio Norte" });
  const opener = await stubSystemOpener(page);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await openRoute(page, `/empresa/${company.id}`);

  await page.locator('[data-aioson-id="send-questionnaire"]').click();
  const modal = page.locator('[data-aioson-id="send-questionnaire-modal"]');
  await expect(modal.locator("ol > li")).toHaveCount(3);
  await modal.locator('[data-aioson-id="send-generate"]').click();
  const saved = modal.locator('[data-aioson-id="send-saved"]');
  await expect(saved).toBeVisible();
  const fileName = (await modal.locator('[data-aioson-id="send-file-name"]').innerText()).trim();
  // `{empresa}-questionario-{data}.html`, the company part made safe for any computer
  expect(fileName).toMatch(new RegExp(`^studio-norte-questionario-${FILE_DATE}\\.html$`));
  expect(readFileSync(path.join(e2eWorkspace.downloadsDir, fileName), "utf8")).toContain("<!doctype html");

  // "Copiar mensagem" puts the approved message on the clipboard
  const message = await modal.locator('[data-aioson-id="send-message"]').inputValue();
  expect(message).toContain("Studio Norte");
  await modal.locator('[data-aioson-id="send-copy-message"]').click();
  await expect(modal).toContainText("Mensagem copiada.");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(message);
  // When the clipboard refuses, the text is left selected for a copy by hand
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error("blocked"));
  });
  await modal.locator('[data-aioson-id="send-copy-message"]').click();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-aioson-id"))).toBe("send-message");
  await expect(modal.locator('[data-aioson-id="send-message"]')).toHaveAttribute("readonly", "");

  // "Mostrar na pasta" sends the id of the saved file
  await modal.locator('[data-aioson-id="send-show-folder"]').click();
  await expect.poll(() => opener).toEqual([expect.stringMatching(/^\/api\/files\/[^/]+\/reveal$/)]);

  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.locator("main")).toContainText(/Questionário enviado em \d{2}\/\d{2}\/\d{4}/);

  // The consultant home counts it among the questionnaires awaiting an answer
  await openRoute(page, "/inicio");
  const awaiting = page.locator('[data-aioson-id="consult-attention"] a[data-attention="aguardando"]');
  await expect(awaiting).toHaveAttribute("data-count", "1");
  await expect(awaiting).toContainText("Studio Norte, enviado hoje");
});

test("the client answers the file offline, saves it, and the import becomes the company's draft", async ({ page, api, browser }) => {
  const company = await api.createCompany({ name: "Studio Norte" });
  await api.setBrand({ name: "Rumo Consultoria", phone: "(11) 91234-5678", email: null, website: null });
  const sent = await sendQuestionnaire(page, company.id);

  const { context, client, external } = await openClientFile(browser, path.join(sent.directory, sent.fileName));
  try {
    await expect(client.getByRole("heading", { level: 1, name: "Questionário de crescimento" })).toBeVisible();
    await expect(client.getByRole("note")).toHaveText(`!${QUESTIONNAIRE_DESKTOP_NOTICE}`);
    await expect(client.getByRole("navigation", { name: "Blocos do questionário" }).getByRole("link")).toHaveCount(8);

    // Block 1, the calculator, with the masks of the app
    await expect(client.getByRole("heading", { level: 2, name: /^1\. / })).toBeVisible();
    await client.getByRole("radiogroup", { name: /pela primeira vez nesses 3 meses/ }).getByRole("radio", { name: "Sei o número" }).check();
    await client.locator("#new-customers").pressSequentially("40");
    await expect(client.locator("#new-customers")).toHaveValue("40");

    // Blocks 2 to 8: 24 questions, "não sei" only where the catalog allows it; block 5 left blank
    let questions = 0;
    let unknownOptions = 0;
    for (let block = 2; block <= 8; block += 1) {
      await client.getByRole("button", { name: "Próximo bloco" }).click();
      await expect(client.getByRole("heading", { level: 2, name: new RegExp(`^${block}\\. `) })).toBeVisible();
      const groups = client.getByRole("radiogroup");
      const count = await groups.count();
      questions += count;
      unknownOptions += await client.locator("label.unknown").count();
      if (block === 5) continue;
      for (let index = 0; index < count; index += 1) await groups.nth(index).locator('input[type="radio"]').nth(1).check();
    }
    expect(questions).toBe(24);
    expect(unknownOptions).toBe(QUESTION_BANK.filter((question) => question.unknownLabel !== null).length);

    // "Revise e salve": what is missing has a link, and it saves anyway
    await client.getByRole("button", { name: "Revisar" }).click();
    await expect(client.getByRole("heading", { name: "Revise e salve" })).toBeVisible();
    // Block 1 has only one of its six numbers and block 5 is blank
    await expect(client.locator("body")).toContainText("6 de 8 blocos respondidos.");
    await expect(client.getByRole("link", { name: /^Responder o bloco 5:/ })).toBeVisible();
    const download = client.waitForEvent("download");
    await client.getByRole("button", { name: "Salvar minhas respostas" }).click();
    const answers = await download;
    expect(answers.suggestedFilename()).toBe("respostas-studio-norte.fitpulse");
    await expect(client.getByRole("heading", { name: "Respostas salvas" })).toBeVisible();
    await expect(client.locator("body")).toContainText("Agora envie o arquivo para Rumo Consultoria pelo WhatsApp (11) 91234-5678.");
    const content = readFileSync(await answers.path(), "utf8");

    // RULE-ra-11: nothing left the page
    expect(external(), "requests made by the questionnaire file").toEqual([]);

    // A narrow screen keeps the warning in evidence
    await client.setViewportSize({ width: 390, height: 844 });
    await client.getByRole("button", { name: "Voltar às respostas" }).click();
    await expect(client.getByRole("note")).toBeVisible();
    expect(await client.getByRole("note").evaluate((note) => getComputedStyle(note).fontWeight)).toBe("600");

    // "Importar respostas": the file becomes the draft, marked with the client's date
    const modal = await openImport(page, company.id);
    await chooseAnswersFile(page, content, answers.suggestedFilename());
    await expect(modal.locator('[data-aioson-id="import-done"]')).toContainText("Rascunho criado");
    const listed = await api.getCompany(company.id);
    expect(listed.draftId).toBeTruthy();
    const draft = await api.getDiagnosis(listed.draftId as string);
    expect(draft.calculator).toMatchObject({ newCustomers: 40 });
    expect(Object.keys(draft.answers)).not.toContain("aq1");

    await modal.locator('[data-aioson-id="import-review-draft"]').click();
    await expect(page).toHaveURL(new RegExp(`#/diagnostico/${listed.draftId}`));
    await openRoute(page, `/empresa/${company.id}`);
    await expect(page.locator("main")).toContainText(/Respostas do cliente, salvas em \d{2}\/\d{2}\/\d{4}/);

    // It leaves "Questionários aguardando resposta"
    await openRoute(page, "/inicio");
    await expect(page.locator('[data-aioson-id="consult-attention"] a[data-attention="aguardando"]')).toHaveAttribute("data-count", "0");
  } finally {
    await context.close();
  }
});

test("a wrong answers file is refused with its own message, and nothing changes", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Studio Norte" });
  const other = await api.createCompany({ name: "Academia Leste" });
  await sendQuestionnaire(page, company.id);
  const before = await api.getCompany(company.id);

  const cases: Array<{ label: string; content: string | Buffer; message: string }> = [
    { label: "another company", content: answersFile(other), message: answersOtherCompanyMessage("Academia Leste", "Studio Norte") },
    { label: "a newer release", content: answersFile(company, { formatVersion: ANSWERS_FILE_FORMAT_VERSION + 1 }), message: ANSWERS_NEWER_VERSION_MESSAGE },
    // Answers that do not fit this questionnaire: a value no question of the catalog has
    { label: "another questionnaire", content: answersFile(company, { answers: { mp1: 9 } }), message: ANSWERS_INCOMPATIBLE_MESSAGE },
    { label: "a broken file", content: "{ isto não é um arquivo", message: ANSWERS_INVALID_MESSAGE },
    { label: "more than 1 MB", content: Buffer.alloc(1024 * 1024 + 10, 32), message: ANSWERS_TOO_LARGE_MESSAGE },
  ];

  const modal = await openImport(page, company.id);
  for (const item of cases) {
    await test.step(item.label, async () => {
      await chooseAnswersFile(page, item.content);
      const error = modal.locator('[data-aioson-id="import-error"]');
      await expect(error).toHaveAttribute("role", "alert");
      await expect(error).toContainText(item.message);
      await expect(error).toContainText(NOTHING_CHANGED);
      await expect(page.locator('[data-aioson-id="import-choose-file"]')).toHaveText("Escolher outro arquivo");
    });
  }
  expect(await api.getCompany(company.id)).toEqual(before);
  expect((await api.getCompany(company.id)).draftId ?? null).toBeNull();
});

test("importing over a draft asks to replace it; 'Cancelar' keeps it, the verb swaps it", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Studio Norte" });
  await sendQuestionnaire(page, company.id);
  const existing = await api.seedDraft(company.id, CASES.g1);

  const modal = await openImport(page, company.id);
  await chooseAnswersFile(page, answersFile(company));
  const confirm = page.getByRole("alertdialog", { name: /^Substituir o rascunho de \d{2}\/\d{2}\/\d{4}\?$/ });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Substituir rascunho" })).toBeVisible();
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  await expect(confirm).toHaveCount(0);
  expect((await api.getCompany(company.id)).draftId).toBe(existing.id);
  expect((await api.getDiagnosis(existing.id)).answers).toEqual(CASES.g1.answers);

  // Confirmed, the company keeps a single draft: the client's
  if (!(await modal.isVisible())) await page.locator('[data-aioson-id="import-answers"]').click();
  await chooseAnswersFile(page, answersFile(company));
  await confirm.getByRole("button", { name: "Substituir rascunho" }).click();
  await expect(page.locator('[data-aioson-id="import-done"]')).toContainText("Rascunho criado");
  const after = await api.getCompany(company.id);
  expect(after.draftId).toBeTruthy();
  const draft = await api.getDiagnosis(after.draftId as string);
  expect(draft.answers).toEqual(CASES.g3.answers);
  const timeline = (await (await page.request.get(`/api/companies/${company.id}/timeline`)).json()) as { draft: { id: string } | null };
  expect(timeline.draft?.id).toBe(after.draftId);
});
