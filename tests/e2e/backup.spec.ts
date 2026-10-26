import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { CASES, e2eWorkspace, expect, openRoute, test, type BackupFile } from "./support/fixtures";

// CAP-dm-backup: AC-dm-37 through the interface (RULE-dm-18). CAP-ra-data-continuity: AC-ra-55, the copy of
// version 2 carries the brand (logo included), the interval, the action progress, the diary and the
// questionnaires sent; a copy of version 1 still imports; importing never deletes.

const UNCHANGED = "Nenhum dado foi alterado.";
// A 1x1 PNG: the smallest logo the brand accepts
const TINY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

async function exportThroughUi(page: Page): Promise<string> {
  await openRoute(page, "/configuracoes");
  await page.locator('[data-aioson-id="backup-export"]').click();
  const saved = page.locator('[data-aioson-id="backup-export-saved"]');
  await expect(saved).toContainText("Cópia salva");
  const fileName = (await saved.locator(".font-mono").first().innerText()).trim();
  const filePath = path.join(e2eWorkspace.downloadsDir, fileName);
  expect(existsSync(filePath), `${filePath} exists`).toBe(true);
  return filePath;
}

async function importThroughUi(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.locator('[data-aioson-id="backup-import-file"]').setInputFiles(file);
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("exports every company and diagnosis and brings the same history into an empty installation", async ({ page, api }) => {
  const aurora = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(aurora.id, CASES.g1);
  const latest = await api.seedCompleted(aurora.id, CASES.g2);
  const east = await api.createCompany({ name: "Academia Leste" });
  const draft = await api.startDiagnosis(east.id);
  // What part 2 adds: the progress of an action, a month of the diary, a questionnaire sent, the brand with its logo
  await api.patchAction(latest.id, "re", { status: "done", note: "Lista de clientes refeita." });
  await api.addDiaryMonth(aurora.id, { month: "2026-08", newCustomers: 12, spendTotalCents: 90_000 });
  const sent = await page.request.post(`/api/companies/${east.id}/questionnaire`, { data: {} });
  expect(sent.status()).toBe(200);
  await api.setBrand({ name: "Rumo Consultoria", phone: "(11) 91234-5678", email: null, website: null });
  await api.setBrandLogo("image/png", Buffer.from(TINY_PNG, "base64"));

  const filePath = await exportThroughUi(page);
  await expect(page.locator('[data-aioson-id="backup-export-saved"]')).toContainText("com 2 empresas e 3 diagnósticos.");
  await expect(page.locator('[data-aioson-id="backup-export-saved"]')).toContainText("a marca dos relatórios");
  const backup = JSON.parse(readFileSync(filePath, "utf8")) as BackupFile & {
    brand: { name: string; logo: { mimeType: string; dataBase64: string } | null } | null;
  };
  expect(backup.format).toBe("fitpulse-backup");
  expect(backup.formatVersion).toBe(2);
  expect(backup.companies).toHaveLength(2);
  expect(backup.diagnoses).toHaveLength(3);
  expect(backup.brand).toMatchObject({ name: "Rumo Consultoria", logo: { mimeType: "image/png" } });
  expect(backup.brand?.logo?.dataBase64).toBe(TINY_PNG);
  expect(backup.diaryEntries).toEqual([expect.objectContaining({ companyId: aurora.id, month: "2026-08" })]);
  expect(backup.questionnaireSends).toEqual([expect.objectContaining({ companyId: east.id })]);
  expect(backup.actionProgress).toContainEqual(expect.objectContaining({ diagnosisId: latest.id, actionKey: "re", status: "done" }));

  // Another installation: nothing registered, then the file
  await api.reset();
  await page.reload();
  await importThroughUi(page, filePath);
  const done = page.locator('[data-aioson-id="backup-import-done"]');
  await expect(done).toContainText("Cópia importada");
  await expect(done).toContainText("2 empresas e 3 diagnósticos adicionados. Também entraram");
  await expect(done).toContainText("1 mês do diário, 1 questionário enviado e a marca dos relatórios");
  await expect(done).toContainText("Nada que já existia foi apagado.");

  expect((await api.listCompanies()).map((company) => company.name).sort()).toEqual(["Academia Leste", "Padaria Aurora"]);
  expect((await api.getCompany(aurora.id)).completedCount).toBe(2);
  expect((await api.getCompany(east.id)).draftId).toBe(draft.id);
  // Everything of part 2 came back
  expect(await api.getBrand()).toMatchObject({ name: "Rumo Consultoria", phone: "(11) 91234-5678", hasLogo: true });
  expect((await api.listDiary(aurora.id)).entries.map((entry) => entry.month)).toEqual(["2026-08"]);
  const actions = (await api.listActions(aurora.id)).current?.actions ?? [];
  expect(actions.find((action) => action.actionKey === "re")).toMatchObject({ status: "done", note: "Lista de clientes refeita." });
  expect(await api.getHome("consultant")).toMatchObject({ awaitingQuestionnaires: [expect.objectContaining({ companyId: east.id })] });
  await openRoute(page, `/resultado/${latest.id}`);
  await expect(page.locator('[data-aioson-id="ladder-steps"]')).toHaveAttribute("aria-label", /^Estágio 2 de 4: Ajuste\. Diagnóstico anterior no estágio 1\./);
});

test("importing never deletes what exists and keeps the records it already has", async ({ page, api }) => {
  const aurora = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(aurora.id, CASES.g2);
  const filePath = await exportThroughUi(page);
  await api.createCompany({ name: "Mercado Sol" });

  await importThroughUi(page, filePath);
  const done = page.locator('[data-aioson-id="backup-import-done"]');
  await expect(done).toContainText("0 empresas e 0 diagnósticos adicionados.");
  // The company, its diagnosis and the 3 actions of its plan
  await expect(done).toContainText("5 registros já existiam e não mudou.");
  expect((await api.listCompanies()).map((company) => company.name).sort()).toEqual(["Mercado Sol", "Padaria Aurora"]);
});

test("a copy of version 1 still imports, without brand, actions or diary", async ({ page, api }) => {
  const aurora = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(aurora.id, CASES.g2);
  const current = await api.readBackup();
  const { actionProgress: _actions, diaryEntries: _diary, questionnaireSends: _sends, brand: _brand, reevaluationIntervalDays: _interval, ...base } = current;
  const versionOne = { ...base, formatVersion: 1, schemaVersion: 1 };
  await api.reset();

  await openRoute(page, "/configuracoes");
  await importThroughUi(page, { name: "fitpulse-v1.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(versionOne)) });
  const done = page.locator('[data-aioson-id="backup-import-done"]');
  await expect(done).toContainText("1 empresa e 1 diagnóstico adicionados.");
  await expect(done).not.toContainText("Também entraram");
  expect((await api.getCompany(aurora.id)).completedCount).toBe(1);
  // The plan of the imported diagnosis starts "A fazer"
  const actions = (await api.listActions(aurora.id)).current?.actions ?? [];
  expect(actions.map((action) => action.status)).toEqual(["todo", "todo", "todo"]);
  expect(await api.getBrand()).toMatchObject({ name: null, hasLogo: false });
});

test("refuses a file that is not a copy, or comes from a newer version, and changes nothing", async ({ page, api }) => {
  const aurora = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(aurora.id, CASES.g2);
  const before = await api.readBackup();
  await openRoute(page, "/configuracoes");
  const refusal = page.locator('[data-aioson-id="backup-import-error"]');

  await importThroughUi(page, { name: "anotacoes.json", mimeType: "application/json", buffer: Buffer.from("isto não é json") });
  await expect(refusal).toHaveAttribute("role", "alert");
  await expect(refusal).toContainText("Não foi possível importar anotacoes.json");
  await expect(refusal).toContainText(`O arquivo não é uma cópia do FitPulse ou está danificado. ${UNCHANGED}`);

  await importThroughUi(page, { name: "outra-coisa.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ hello: "world" })) });
  await expect(refusal).toContainText("Não foi possível importar outra-coisa.json");
  await expect(refusal).toContainText(UNCHANGED);

  const newer = { ...before, formatVersion: 99, rulesVersion: 99, companies: [], diagnoses: [] };
  await importThroughUi(page, { name: "copia-nova.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(newer)) });
  await expect(refusal).toContainText("Não foi possível importar copia-nova.json");
  await expect(refusal).toContainText("versão mais nova");
  await expect(refusal).toContainText(UNCHANGED);
  await expect(refusal.getByRole("button", { name: "Escolher outro arquivo" })).toBeVisible();

  const after = await api.readBackup();
  expect(after.companies).toEqual(before.companies);
  expect(after.diagnoses).toEqual(before.diagnoses);
});
