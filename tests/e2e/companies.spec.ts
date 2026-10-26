import type { Locator, Page } from "@playwright/test";
import {
  CASES,
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  openRoute,
  test,
  useMobileViewport,
} from "./support/fixtures";

// CAP-dm-company: AC-dm-04 to AC-dm-09, AC-dm-17, AC-dm-46, AC-dm-48

const INVALID_CNPJ_MESSAGE = "CNPJ inválido. Formato: 00.000.000/0000-00.";

function companyRows(page: Page): Locator {
  return page.locator('[data-aioson-id="companies-table"] tbody tr');
}

function companyRow(page: Page, name: string): Locator {
  return companyRows(page).filter({ has: page.getByRole("link", { name, exact: true }) });
}

async function fillCompanyForm(dialog: Locator, values: { name: string; segment: string; channel: string; revenue?: string }) {
  await dialog.getByLabel("Nome da empresa").fill(values.name);
  await dialog.getByLabel("Segmento").selectOption(values.segment);
  if (values.revenue) await dialog.getByLabel(/Faturamento por ano/).selectOption(values.revenue);
  await dialog.getByRole("radio", { name: values.channel }).check();
}

/** Tab several times: the focus never leaves the open modal (AC-dm-48). */
async function expectFocusTrapped(page: Page, dialog: Locator) {
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("starts empty, validates the required fields and creates a company", async ({ page }) => {
  await openRoute(page, "/empresas");
  const empty = page.locator('[data-aioson-id="companies-empty"]');
  await expect(empty).toContainText("Nenhuma empresa cadastrada");
  await empty.getByRole("button", { name: "Cadastrar a primeira empresa" }).click();

  const dialog = page.getByRole("alertdialog", { name: "Nova empresa" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(dialog.getByText("Informe o nome da empresa.")).toBeVisible();
  await expect(dialog.getByText("Escolha o segmento mais próximo.")).toBeVisible();
  await expect(dialog.getByText("Escolha como você vende.")).toBeVisible();
  await expect(dialog.getByLabel("Nome da empresa")).toHaveAttribute("aria-invalid", "true");

  await fillCompanyForm(dialog, { name: "Padaria Aurora", segment: "food", channel: "Loja física ou balcão", revenue: "up_to_360k" });
  await dialog.getByLabel("CNPJ").pressSequentially("11222333000181");
  await dialog.getByRole("button", { name: "Cadastrar empresa" }).click();

  // Saving a new company opens its page (AC-dm-04)
  await expect(page).toHaveURL(/#\/empresa\/[^/]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Padaria Aurora" })).toBeVisible();
  await expect(page.locator('[data-aioson-id="company-page"]')).toContainText("CNPJ 11.222.333/0001-81");
  await expect(page.locator('[data-aioson-id="company-empty"]')).toContainText("Nenhum diagnóstico ainda");

  await openRoute(page, "/empresas");
  await expect(companyRows(page)).toHaveCount(1);
  await expect(companyRow(page, "Padaria Aurora")).toContainText("Sem diagnóstico");
});

test("masks the CNPJ, flags a wrong check digit on blur and sends right after the fix", async ({ page }) => {
  await openRoute(page, "/empresas");
  await page.locator('[data-aioson-id="companies-new"]').click();
  const dialog = page.getByRole("alertdialog", { name: "Nova empresa" });
  await fillCompanyForm(dialog, { name: "Studio Bela", segment: "beauty", channel: "Venda com orçamento ou visita" });

  const cnpj = dialog.getByLabel("CNPJ");
  await expect(cnpj).toHaveAttribute("inputmode", "numeric");
  await expect(cnpj).toHaveAttribute("maxlength", "18");
  await cnpj.pressSequentially("11222333000180");
  await expect(cnpj).toHaveValue("11.222.333/0001-80");
  await cnpj.blur();
  await expect(dialog.getByText(INVALID_CNPJ_MESSAGE)).toBeVisible();
  await expect(cnpj).toHaveAttribute("aria-invalid", "true");

  // Correcting the field clears its error; the click that follows sends the form (AC-dm-17)
  await cnpj.click();
  await cnpj.press("End");
  await cnpj.press("Backspace");
  await cnpj.press("1");
  await expect(cnpj).toHaveValue("11.222.333/0001-81");
  await expect(dialog.getByText(INVALID_CNPJ_MESSAGE)).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Studio Bela" })).toBeVisible();
});

test("edits only the company of the clicked row", async ({ page, api }) => {
  const east = await api.createCompany({ name: "Academia Leste", segment: "health_wellness" });
  const west = await api.createCompany({ name: "Academia Oeste", segment: "health_wellness" });
  await openRoute(page, "/empresas");

  await companyRow(page, "Academia Oeste").getByRole("button", { name: "Editar Academia Oeste" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Editar Academia Oeste" });
  await expect(dialog.getByLabel("Nome da empresa")).toHaveValue("Academia Oeste");
  await expect(dialog.getByLabel("Segmento")).toHaveValue("health_wellness");
  await expect(dialog.getByRole("radio", { name: "Loja física ou balcão" })).toBeChecked();

  await dialog.getByLabel("Nome da empresa").fill("Academia Oeste Fit");
  await dialog.getByRole("radio", { name: "Assinatura ou mensalidade" }).check();
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Dados de Academia Oeste Fit salvos." })).toBeVisible();
  await expect(companyRow(page, "Academia Oeste Fit")).toHaveCount(1);
  await expect(companyRow(page, "Academia Leste")).toHaveCount(1);
  expect((await api.getCompany(west.id)).name).toBe("Academia Oeste Fit");
  expect((await api.getCompany(east.id)).name).toBe("Academia Leste");
});

test("archives and restores with the app's own confirmation, keeping the history", async ({ page, api }) => {
  const aurora = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(aurora.id, CASES.g2);
  await api.createCompany({ name: "Mercado Sol" });
  await openRoute(page, "/empresas");
  const archiveButton = companyRow(page, "Padaria Aurora").getByRole("button", { name: "Arquivar Padaria Aurora" });

  // Esc and Cancelar leave everything as it was; the focus stays inside the modal
  await archiveButton.click();
  const dialog = page.getByRole("alertdialog", { name: "Arquivar Padaria Aurora?" });
  await expect(dialog).toContainText("A empresa sai da carteira e da tela inicial");
  await expectFocusTrapped(page, dialog);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await archiveButton.click();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(companyRows(page)).toHaveCount(2);

  await archiveButton.click();
  await dialog.getByRole("button", { name: "Arquivar empresa" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Padaria Aurora arquivada." })).toBeVisible();
  await expect(companyRow(page, "Padaria Aurora")).toHaveCount(0);
  await expect(companyRow(page, "Mercado Sol")).toHaveCount(1);

  // The archived company leaves the portfolio of the home screen too
  await openRoute(page, "/inicio");
  await expect(page.locator('[data-aioson-id="escada"] a[data-step="2"]')).toHaveAttribute("data-count", "0");

  await openRoute(page, "/empresas");
  await page.getByRole("link", { name: "Ver arquivadas" }).click();
  const archivedRow = companyRow(page, "Padaria Aurora");
  await expect(archivedRow.getByRole("button", { name: "Excluir Padaria Aurora" })).toBeVisible();
  await archivedRow.getByRole("button", { name: "Restaurar Padaria Aurora" }).click();
  const restore = page.getByRole("alertdialog", { name: "Restaurar Padaria Aurora?" });
  await restore.getByRole("button", { name: "Cancelar" }).click();
  await expect(archivedRow).toHaveCount(1);
  await archivedRow.getByRole("button", { name: "Restaurar Padaria Aurora" }).click();
  await restore.getByRole("button", { name: "Restaurar empresa" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Padaria Aurora restaurada." })).toBeVisible();
  await expect(archivedRow).toHaveCount(0);

  await page.getByRole("link", { name: "Ver ativas" }).click();
  await expect(companyRow(page, "Padaria Aurora")).toContainText("Estágio 2 · Ajuste");
  await companyRow(page, "Padaria Aurora").getByRole("link", { name: "Padaria Aurora" }).click();
  await expect(page.locator('[data-aioson-id="company-timeline"] li[data-status="completed"]')).toHaveCount(1);
});

test("deletes only an archived company, saying how many diagnoses go with it", async ({ page, api }) => {
  const aurora = await api.createCompany({ name: "Padaria Aurora" });
  const first = await api.seedCompleted(aurora.id, CASES.g1);
  await api.seedCompleted(aurora.id, CASES.g2);
  await api.createCompany({ name: "Mercado Sol" });

  // An active company offers no delete (RULE-dm-15)
  await openRoute(page, "/empresas");
  await expect(companyRows(page)).toHaveCount(2);
  await expect(page.getByRole("button", { name: /^Excluir/ })).toHaveCount(0);

  await api.archiveCompany(aurora.id);
  await openRoute(page, "/empresas?arquivadas=1");
  const row = companyRow(page, "Padaria Aurora");
  await row.getByRole("button", { name: "Excluir Padaria Aurora" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Excluir Padaria Aurora?" });
  await expect(dialog).toContainText("A empresa e 2 diagnósticos serão apagados deste computador. Não dá para desfazer.");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(row).toHaveCount(1);
  expect((await api.getCompany(aurora.id)).completedCount).toBe(2);

  await row.getByRole("button", { name: "Excluir Padaria Aurora" }).click();
  await dialog.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Padaria Aurora excluída." })).toBeVisible();
  await expect(page.getByText("Nenhuma empresa arquivada.")).toBeVisible();

  const companyResponse = await page.request.get(`/api/companies/${aurora.id}`);
  expect(companyResponse.status()).toBe(404);
  const diagnosisResponse = await page.request.get(`/api/diagnoses/${first.id}`);
  expect(diagnosisResponse.status()).toBe(404);
  expect((await api.listCompanies()).map((company) => company.name)).toEqual(["Mercado Sol"]);
});

test("searches by name, filters by stage and clears the filters", async ({ page, api }) => {
  const aurora = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(aurora.id, CASES.g2);
  const east = await api.createCompany({ name: "Academia Leste" });
  await api.seedCompleted(east.id, CASES.g4);
  await api.createCompany({ name: "Mercado Sol" });

  await openRoute(page, "/empresas");
  await expect(companyRows(page)).toHaveCount(3);

  await page.getByRole("searchbox", { name: "Buscar empresa" }).fill("aurora");
  await expect(companyRows(page)).toHaveCount(1);
  await expect(companyRow(page, "Padaria Aurora")).toHaveCount(1);

  await page.getByRole("searchbox", { name: "Buscar empresa" }).fill("xyz");
  await expect(page.getByText("Nenhuma empresa encontrada")).toBeVisible();
  await expect(page.getByText('Nenhum nome contém "xyz".')).toBeVisible();
  // The active filter is named above the list (AC-ra-35), with its own "Limpar filtros"
  await expect(page.locator('[data-aioson-id="companies-active-filter"]')).toContainText("Filtro ativo:");
  await expect(page.getByRole("link", { name: "Limpar filtros" })).toHaveCount(2);
  await page.getByRole("link", { name: "Limpar filtros" }).last().click();
  await expect(companyRows(page)).toHaveCount(3);

  const stageFilter = page.getByRole("navigation", { name: "Filtrar por estágio" });
  await stageFilter.getByRole("link", { name: "Estágio 4" }).click();
  await expect(companyRows(page)).toHaveCount(1);
  await expect(companyRow(page, "Academia Leste")).toContainText("Estágio 4 · Estruturação");
  await stageFilter.getByRole("link", { name: "Estágio 1" }).click();
  await expect(page.getByText("Nenhuma empresa com esse filtro.")).toBeVisible();
  await stageFilter.getByRole("link", { name: "Todos" }).click();
  await expect(companyRows(page)).toHaveCount(3);

  await page.getByRole("link", { name: "Ver arquivadas" }).click();
  await expect(page.getByText("Nenhuma empresa arquivada.")).toBeVisible();
});

test("fits 390 px and passes axe on the list and on the form", async ({ page, api }) => {
  await api.createCompany({ name: "Padaria Aurora com um nome bem comprido para testar a quebra de linha" });
  await useMobileViewport(page);
  await openRoute(page, "/empresas");
  await expect(companyRows(page)).toHaveCount(1);
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);

  await page.locator('[data-aioson-id="companies-new"]').click();
  const dialog = page.getByRole("alertdialog", { name: "Nova empresa" });
  await dialog.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(dialog.getByText("Informe o nome da empresa.")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});
