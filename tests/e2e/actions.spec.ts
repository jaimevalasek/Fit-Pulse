import type { Page } from "@playwright/test";
import { ACTION_CATALOG } from "../../shared/content/actionCatalog";
import { CASES, expect, expectNoHorizontalScroll, openRoute, test, useMobileViewport } from "./support/fixtures";

// CAP-ra-action-tracking and CAP-ra-action-inheritance: AC-ra-26 (state, deadline, owner and note on
// the "Ações" tab and the result), AC-ra-27 (status with "Desfazer" for 6 s, kept after a reload),
// AC-ra-28 (the edit form), AC-ra-30 (a replaced plan is read-only), AC-ra-31 (a new diagnosis inherits
// the repeated action) and AC-ra-63 (no completed diagnosis, no action).
// G1 plans cac, mp, mm; G2 plans re, dep, mp: "mp" repeats.

const DATE = /\d{2}\/\d{2}\/\d{4}/.source;
const DATE_INVALID = "Data inválida. Use o formato DD/MM/AAAA.";

function row(page: Page, diagnosisId: string, key: string) {
  return page.locator(`[data-aioson-id="action-${diagnosisId}-${key}"]`);
}

function status(page: Page, diagnosisId: string, key: string) {
  return page.locator(`[data-aioson-id="status-${diagnosisId}-${key}"]`);
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("a status saves at once, 'Desfazer' brings it back for 6 seconds, and a reload shows what was saved", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const diagnosis = await api.seedCompleted(company.id, CASES.g2);
  await openRoute(page, `/empresa/${company.id}/acoes`);

  const list = page.locator('[data-aioson-id="actions-list"]');
  await expect(list.locator("> li")).toHaveCount(3);
  expect(await list.locator("> li").evaluateAll((items) => items.map((item) => item.getAttribute("data-action-key")))).toEqual(["re", "dep", "mp"]);
  for (const key of ["re", "dep", "mp"]) {
    await expect(status(page, diagnosis.id, key)).toHaveValue("todo");
    await expect(page.locator(`[data-aioson-id="action-meta-${diagnosis.id}-${key}"]`)).toHaveText("Sem prazo");
  }

  const notice = page.locator('[data-aioson-id="action-status-notice"]');
  const title = ACTION_CATALOG.re.title;
  await status(page, diagnosis.id, "re").selectOption("in_progress");
  await expect(notice).toContainText(`"${title}" agora está em andamento.`);
  await expect.poll(async () => (await api.listActions(company.id)).current?.actions.find((action) => action.actionKey === "re")?.status).toBe("in_progress");

  // "Desfazer" saves the previous state again
  await notice.getByRole("button", { name: "Desfazer" }).click();
  await expect(status(page, diagnosis.id, "re")).toHaveValue("todo");
  await expect.poll(async () => (await api.listActions(company.id)).current?.actions.find((action) => action.actionKey === "re")?.status).toBe("todo");

  // The notice of a new change leaves after 6 seconds
  await status(page, diagnosis.id, "dep").selectOption("done");
  await expect(notice).toContainText(`"${ACTION_CATALOG.dep.title}" agora está feita.`);
  await page.waitForTimeout(6_500);
  await expect(notice.getByRole("button", { name: "Desfazer" })).toHaveCount(0);

  await page.reload();
  await expect(status(page, diagnosis.id, "dep")).toHaveValue("done");
  await expect(status(page, diagnosis.id, "re")).toHaveValue("todo");
  await expect(row(page, diagnosis.id, "dep")).toHaveAttribute("data-status", "done");
});

test("'Editar' changes the deadline, the owner role and the note of that action only", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const diagnosis = await api.seedCompleted(company.id, CASES.g2);
  await openRoute(page, `/empresa/${company.id}/acoes`);

  await page.locator(`[data-aioson-id="edit-${diagnosis.id}-dep"]`).click();
  const modal = page.locator('[data-aioson-id="action-edit-modal"]');
  await expect(modal.getByRole("heading", { name: ACTION_CATALOG.dep.title })).toBeVisible();

  // The deadline: DD/MM/AAAA mask, a wrong date is refused on blur with the message in the field
  const due = modal.getByLabel("Prazo");
  await expect(due).toHaveAttribute("inputmode", "numeric");
  await due.fill("31022026");
  await expect(due).toHaveValue("31/02/2026");
  await due.blur();
  await expect(due).toHaveAttribute("aria-invalid", "true");
  await expect(modal).toContainText(DATE_INVALID);
  await modal.locator('[data-aioson-id="action-edit-submit"]').click();
  await expect(modal).toBeVisible();
  expect((await api.listActions(company.id)).current?.actions.find((action) => action.actionKey === "dep")?.dueDate).toBeNull();
  await due.fill("15122026");
  await due.blur();
  await expect(due).not.toHaveAttribute("aria-invalid", "true");

  // The owner by role, never a person's name
  const role = modal.getByLabel("Responsável");
  await expect(role.locator("option")).toContainText(["Dono", "Equipe de vendas", "Equipe de marketing", "Consultor", "Outro"]);
  await expect(modal.getByLabel(/nome/i)).toHaveCount(0);
  await role.selectOption("sales_team");

  // The note: up to 500 characters with a counter
  const note = modal.locator('[data-aioson-id="action-edit-note"]');
  await expect(note).toHaveAttribute("maxlength", "500");
  await note.fill("Ligar para os clientes da lista de outubro.");
  await expect(modal.locator('[data-aioson-id="action-edit-note-count"]')).toContainText("43");
  await modal.locator('[data-aioson-id="action-edit-submit"]').click();
  await expect(modal).toHaveCount(0);

  const meta = page.locator(`[data-aioson-id="action-meta-${diagnosis.id}-dep"]`);
  await expect(meta).toContainText("Prazo 15/12/2026");
  await expect(meta).toContainText("Equipe de vendas");
  await expect(row(page, diagnosis.id, "dep")).toContainText("Ligar para os clientes da lista de outubro.");
  const actions = (await api.listActions(company.id)).current?.actions ?? [];
  expect(actions.find((action) => action.actionKey === "dep")).toMatchObject({
    dueDate: "2026-12-15",
    ownerRole: "sales_team",
    note: "Ligar para os clientes da lista de outubro.",
  });
  // Only that action changed
  for (const key of ["re", "mp"]) {
    expect(actions.find((action) => action.actionKey === key)).toMatchObject({ status: "todo", dueDate: null, ownerRole: null, note: null });
  }

  // Editing again brings the same values back
  await page.reload();
  await page.locator(`[data-aioson-id="edit-${diagnosis.id}-dep"]`).click();
  await expect(modal.getByLabel("Prazo")).toHaveValue("15/12/2026");
  await expect(modal.getByLabel("Responsável")).toHaveValue("sales_team");
  await expect(modal.locator('[data-aioson-id="action-edit-note"]')).toHaveValue("Ligar para os clientes da lista de outubro.");
  await modal.getByRole("button", { name: "Cancelar" }).click();
  await expect(modal).toHaveCount(0);
});

test("a new diagnosis carries the repeated action on, closes the others and starts the new ones", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const first = await api.seedCompleted(company.id, CASES.g1);
  await api.patchAction(first.id, "mp", { status: "in_progress", dueDate: "2026-12-01", ownerRole: "marketing_team", note: "Revisar a vitrine." });
  await api.patchAction(first.id, "cac", { status: "done" });
  const second = await api.seedCompleted(company.id, CASES.g2);

  await openRoute(page, `/empresa/${company.id}/acoes`);
  // The current plan: no action twice, the repeated one with its progress and where it came from
  await expect(page.locator('[data-aioson-id="actions-list"] > li')).toHaveCount(3);
  expect(
    await page.locator('[data-aioson-id="actions-list"] > li').evaluateAll((items) => items.map((item) => item.getAttribute("data-action-key"))),
  ).toEqual(["re", "dep", "mp"]);
  await expect(status(page, second.id, "mp")).toHaveValue("in_progress");
  const inherited = page.locator(`[data-aioson-id="action-meta-${second.id}-mp"]`);
  await expect(inherited).toContainText(new RegExp(`Continua do diagnóstico de ${DATE}`));
  await expect(inherited).toContainText("Prazo 01/12/2026");
  await expect(inherited).toContainText("Equipe de marketing");
  await expect(row(page, second.id, "mp")).toContainText("Revisar a vitrine.");
  for (const key of ["re", "dep"]) {
    await expect(status(page, second.id, key)).toHaveValue("todo");
    await expect(page.locator(`[data-aioson-id="action-meta-${second.id}-${key}"]`)).not.toContainText("Continua do diagnóstico");
  }

  // The plan it replaced: closed, with the state each action ended in and no control
  const closed = page.locator('[data-aioson-id="closed-actions"]');
  await expect(closed).toBeVisible();
  await expect(closed.locator(`[data-aioson-id="action-meta-${first.id}-cac"]`)).toContainText(/Encerrada em .* · Feita/);
  await expect(closed.locator(`[data-aioson-id="action-meta-${first.id}-mm"]`)).toContainText(/Encerrada em .* · A fazer/);
  await expect(closed.locator("select")).toHaveCount(0);
  await expect(closed.getByRole("button", { name: /Editar/ })).toHaveCount(0);

  // The result of the replaced diagnosis shows the plan closed, read-only (AC-ra-30)
  await openRoute(page, `/resultado/${first.id}`);
  await expect(page.locator('[data-aioson-id="result-plan-closed"]')).toBeVisible();
  const closedList = page.locator('[data-aioson-id="result-actions-closed"]');
  await expect(closedList.locator("> li")).toHaveCount(3);
  await expect(page.locator('[data-aioson-id="result-actions"] select')).toHaveCount(0);

  // The result of the current one edits the progress, the same as the tab (AC-ra-26)
  await openRoute(page, `/resultado/${second.id}`);
  await expect(page.locator(`[data-aioson-id="result-actions"] [data-aioson-id="status-${second.id}-mp"]`)).toHaveValue("in_progress");

  // Archiving the new diagnosis makes the previous plan current again, with its progress (AC-ra-32)
  await api.archiveDiagnosis(second.id);
  await openRoute(page, `/empresa/${company.id}/acoes`);
  await expect(status(page, first.id, "mp")).toHaveValue("in_progress");
  await expect(status(page, first.id, "cac")).toHaveValue("done");
});

test("without a completed diagnosis the tab explains where the actions come from", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Academia Leste" });
  await openRoute(page, `/empresa/${company.id}/acoes`);
  const empty = page.locator('[data-aioson-id="actions-empty"]');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText("diagnóstico");
  await expect(page.locator('[data-aioson-id="actions-start-diag"]')).toBeVisible();

  // A draft has no actions; the way is to continue it
  const draft = await api.startDiagnosis(company.id);
  await page.reload();
  await expect(page.locator('[data-aioson-id="actions-empty"]')).toBeVisible();
  await page.locator('[data-aioson-id="actions-continue-diag"]').click();
  await expect(page).toHaveURL(new RegExp(`#/diagnostico/${draft.id}`));
});

test("the tab fits 390 px", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora com um nome comprido" });
  const diagnosis = await api.seedCompleted(company.id, CASES.g2);
  await api.patchAction(diagnosis.id, "re", { dueDate: "2026-01-10", ownerRole: "sales_team", note: "Uma nota longa para ver a quebra de linha no celular." });
  await useMobileViewport(page);
  await openRoute(page, `/empresa/${company.id}/acoes`);
  await expect(page.locator(`[data-aioson-id="action-meta-${diagnosis.id}-re"]`)).toContainText("Vencida em 10/01/2026");
  await expectNoHorizontalScroll(page);
});
