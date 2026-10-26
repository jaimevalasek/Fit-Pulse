import type { Page } from "@playwright/test";
import { SPEND_PART_OPTIONS } from "../../shared/content/calculatorOptions";
import { DIARY_CUSTOMERS_EMPTY_MESSAGE, DIARY_SPEND_EMPTY_MESSAGE, diaryMonthTakenMessage } from "../../shared/domain/diary";
import { MONTH_FUTURE_MESSAGE, MONTH_INVALID_MESSAGE, formatMonthLong } from "../../shared/format/dates";
import { expect, expectNoBrokenNumbers, expectNoHorizontalScroll, openRoute, test, useMobileViewport } from "./support/fixtures";

// CAP-ra-diary: AC-ra-38 (the form), AC-ra-39 (each error in its field, nothing saved), AC-ra-40
// (edit with the month read-only, delete in the app's modal), AC-ra-41 (cost per customer, chart and
// progress, never NaN), AC-ra-42 (the empty state, consultancy wording) and AC-ra-59 (the modal)

/** `YYYY-MM` of `monthsAgo` months before the current month (negative is the future). */
function monthBefore(monthsAgo: number): string {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The digits typed in the MM/AAAA mask. */
function typedMonth(month: string): string {
  const [year, number] = month.split("-");
  return `${number}${year}`;
}

function partLabel(key: string): string {
  const option = SPEND_PART_OPTIONS.find((part) => part.key === key);
  if (!option) throw new Error(`unknown spend part ${key}`);
  return option.label;
}

async function openAddMonth(page: Page) {
  await page.locator('[data-aioson-id="add-month"]').click();
  const modal = page.locator('[data-aioson-id="month-modal"]');
  await expect(modal.getByRole("heading", { name: "Anotar um mês" })).toBeVisible();
  return modal;
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("an empty diary explains why, and 'Anotar mês' saves the month with its cost per customer", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.setPreferences({ usageMode: "owner", focusCompanyId: company.id });
  await openRoute(page, `/empresa/${company.id}/diario`);
  const empty = page.locator('[data-aioson-id="diary-empty"]');
  await expect(empty).toContainText("Por que anotar todo mês?");
  await expect(empty.getByRole("button", { name: "Anotar o primeiro mês" })).toBeVisible();
  await expect(page.locator('[data-aioson-id="diary-consultant-note"]')).toHaveCount(0);

  const modal = await openAddMonth(page);
  const month = modal.getByLabel("Mês", { exact: true });
  await expect(month).toHaveAttribute("inputmode", "numeric");
  const lastMonth = monthBefore(1);
  // The field comes with a suggested month; another one is typed over it
  await month.fill("");
  await month.pressSequentially(typedMonth(lastMonth));
  await expect(month).toHaveValue(`${lastMonth.slice(5)}/${lastMonth.slice(0, 4)}`);
  const customers = modal.getByLabel("Clientes novos no mês");
  await expect(customers).toHaveAttribute("inputmode", "numeric");
  await expect(customers).toHaveAttribute("maxlength", "5");
  await customers.fill("20");
  // The 6 parts of the calculator, with the reais mask
  await expect(modal.locator('[data-aioson-id="month-parts"] input')).toHaveCount(6);
  await modal.getByLabel(partLabel("ads")).pressSequentially("150000");
  await expect(modal.getByLabel(partLabel("ads"))).toHaveValue("R$ 1.500,00");
  await modal.getByLabel(partLabel("agency")).pressSequentially("50000");
  await modal.locator('[data-aioson-id="month-save"]').click();
  await expect(modal).toHaveCount(0);

  const saved = page.locator(`[data-aioson-id="month-${lastMonth}"]`);
  await expect(saved).toContainText("R$ 2.000,00");
  await expect(saved).toContainText("20");
  await expect(saved).toContainText("R$ 100,00");
  await expect(page.locator('[data-aioson-id="diary-progress"]')).toHaveText("1 de 3 meses anotados");
  expect((await api.listDiary(company.id)).entries.map((entry) => entry.month)).toEqual([lastMonth]);

  // "Só sei o total do gasto": a single field
  const second = await openAddMonth(page);
  await second.getByLabel("Mês", { exact: true }).fill("");
  await second.getByLabel("Mês", { exact: true }).pressSequentially(typedMonth(monthBefore(2)));
  await second.getByLabel("Clientes novos no mês").fill("0");
  await second.locator('[data-aioson-id="month-total-only"]').check();
  await expect(second.locator('[data-aioson-id="month-parts"]')).toHaveCount(0);
  await second.getByLabel("Gasto total do mês").pressSequentially("80000");
  await second.locator('[data-aioson-id="month-save"]').click();
  await expect(second).toHaveCount(0);
  // 0 new customers: the cost of that month is not calculated, never NaN
  await expect(page.locator(`[data-aioson-id="chart-${monthBefore(2)}"]`)).toContainText("não calculado");
  await expect(page.locator('[data-aioson-id="diary-progress"]')).toHaveText("2 de 3 meses anotados");
  await expectNoBrokenNumbers(page);
});

test("each wrong field says why in place and nothing is saved", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const noted = monthBefore(1);
  await api.addDiaryMonth(company.id, { month: noted, newCustomers: 10, spendTotalCents: 100_000 });
  await openRoute(page, `/empresa/${company.id}/diario`);
  await expect(page.locator(`[data-aioson-id="month-${noted}"]`)).toBeVisible();

  const modal = await openAddMonth(page);
  const month = modal.getByLabel("Mês", { exact: true });
  const save = modal.locator('[data-aioson-id="month-save"]');

  // A month that has not come yet
  await month.fill("");
  await month.pressSequentially(typedMonth(monthBefore(-1)));
  await month.blur();
  await expect(modal).toContainText(MONTH_FUTURE_MESSAGE);
  await expect(month).toHaveAttribute("aria-invalid", "true");
  // A month that does not exist
  await month.fill("");
  await month.pressSequentially("132026");
  await month.blur();
  await expect(modal).toContainText(MONTH_INVALID_MESSAGE);

  // Empty customers and empty spend
  await month.fill("");
  await month.pressSequentially(typedMonth(noted));
  await save.click();
  await expect(modal).toContainText(DIARY_CUSTOMERS_EMPTY_MESSAGE);
  await expect(modal.locator('[data-aioson-id="month-spend-error"]')).toHaveText(DIARY_SPEND_EMPTY_MESSAGE);

  // A month already in the diary
  await modal.getByLabel("Clientes novos no mês").fill("5");
  await modal.getByLabel(partLabel("ads")).pressSequentially("10000");
  await save.click();
  await expect(modal).toContainText(diaryMonthTakenMessage(noted));
  await expect(modal).toBeVisible();

  expect((await api.listDiary(company.id)).entries).toHaveLength(1);
  // The server refuses the same month too
  const repeated = await page.request.post(`/api/companies/${company.id}/diary`, { data: { month: noted, newCustomers: 1, spendTotalCents: 100 } });
  expect(repeated.status()).toBeGreaterThanOrEqual(400);
  expect((await api.listDiary(company.id)).entries).toHaveLength(1);
});

test("'Editar' keeps the month read-only; 'Excluir' asks in the app's modal and Esc keeps the month", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const noted = monthBefore(1);
  await api.addDiaryMonth(company.id, { month: noted, newCustomers: 10, spendParts: { ads: 100_000 } });
  await openRoute(page, `/empresa/${company.id}/diario`);

  await page.locator(`[data-aioson-id="edit-month-${noted}"]`).click();
  const modal = page.locator('[data-aioson-id="month-modal"]');
  await expect(modal.getByRole("heading", { name: new RegExp(`^Editar ${formatMonthLong(noted)}$`, "i") })).toBeVisible();
  const month = modal.getByLabel("Mês", { exact: true });
  await expect(month).toHaveAttribute("readonly", "");
  await expect(modal).toContainText("Para mudar o mês, exclua e anote de novo.");
  await expect(modal.getByLabel("Clientes novos no mês")).toHaveValue("10");
  await expect(modal.getByLabel(partLabel("ads"))).toHaveValue("R$ 1.000,00");
  await modal.getByLabel("Clientes novos no mês").fill("25");
  await modal.locator('[data-aioson-id="month-save"]').click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(`[data-aioson-id="month-${noted}"]`)).toContainText("R$ 40,00");

  // "Excluir {mês} do diário?": Esc and "Cancelar" keep it, "Excluir mês" removes it
  const title = `Excluir ${formatMonthLong(noted)} do diário?`;
  await page.locator(`[data-aioson-id="delete-month-${noted}"]`).click();
  const confirm = page.getByRole("alertdialog", { name: title });
  await expect(confirm).toContainText("O custo por cliente desse mês sai da média e do próximo diagnóstico.");
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  await page.locator(`[data-aioson-id="delete-month-${noted}"]`).click();
  await confirm.getByRole("button", { name: "Cancelar" }).click();
  expect((await api.listDiary(company.id)).entries).toHaveLength(1);
  await page.locator(`[data-aioson-id="delete-month-${noted}"]`).click();
  await confirm.getByRole("button", { name: "Excluir mês" }).click();
  await expect(page.locator('[data-aioson-id="diary-empty"]')).toBeVisible();
  expect((await api.listDiary(company.id)).entries).toHaveLength(0);
});

test("with 3 months the cost is measured: the chart writes each value and the progress names the months", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const months = [monthBefore(3), monthBefore(2), monthBefore(1)];
  await api.addDiaryMonth(company.id, { month: months[0], newCustomers: 10, spendTotalCents: 100_000 });
  await api.addDiaryMonth(company.id, { month: months[1], newCustomers: 20, spendParts: { ads: 150_000 } });
  await api.addDiaryMonth(company.id, { month: months[2], newCustomers: 25, spendParts: { ads: 100_000, tools: 25_000 } });
  await api.setPreferences({ usageMode: "consultant" });
  await openRoute(page, `/empresa/${company.id}/diario`);

  // In consultancy mode the tab says who notes the numbers (F12)
  await expect(page.locator('[data-aioson-id="diary-consultant-note"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="diary-progress"]')).toHaveText(/^Medido: de .+ a .+$/);
  const chart = page.locator('[data-aioson-id="diary-chart"]');
  await expect(chart).toBeVisible();
  await expect(page.locator(`[data-aioson-id="chart-${months[0]}"]`)).toContainText("R$ 100,00");
  await expect(page.locator(`[data-aioson-id="chart-${months[1]}"]`)).toContainText("R$ 75,00");
  await expect(page.locator(`[data-aioson-id="chart-${months[2]}"]`)).toContainText("R$ 50,00");
  await expect(page.locator('[data-aioson-id="diary-chart-summary"]')).not.toBeEmpty();
  // 3 months: (1.000 + 1.500 + 1.250) / 55 customers
  await expect(page.locator('[data-aioson-id="diary-recent-cost"]')).toContainText("R$ 68,18");
  await expectNoBrokenNumbers(page);

  await useMobileViewport(page);
  await expectNoHorizontalScroll(page);
});
