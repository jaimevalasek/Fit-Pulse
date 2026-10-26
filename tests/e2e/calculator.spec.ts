import type { Page } from "@playwright/test";
import { formatMonthShort } from "../../shared/format/dates";
import { CASES, expect, openRoute, saveDraftAfter, test, type AppApi } from "./support/fixtures";

// CAP-dm-unit-economics: AC-dm-15, AC-dm-51 on the real screen, and the diary prefill of part 2 below

const NO_NEW_CUSTOMERS_EXPLANATION = "Sem clientes novos no período, não dá para calcular o custo de um cliente";

function panel(page: Page) {
  return page.locator('[data-aioson-id="calc-output"]');
}

/** The value (with its note) shown under one label of the "Seus números, calculados" panel. */
function figure(page: Page, label: string) {
  return panel(page).locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
}

const COST = "Custo para conquistar um cliente";
const PROFIT = "Quanto um cliente deixa de lucro";
const RATIO = "Relação entre os dois";
const PAYBACK = "Tempo para o cliente se pagar";

/** Nothing on the panel is ever NaN, Infinity or blank (AC-dm-51). */
async function expectPanelClean(page: Page) {
  const values = await panel(page).locator("dd").allInnerTexts();
  expect(values).toHaveLength(4);
  for (const value of values) {
    expect(value.trim()).not.toBe("");
    expect(value).not.toMatch(/NaN|Infinity|undefined/);
  }
}

async function openCalculator(page: Page, api: AppApi) {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const draft = await api.startDiagnosis(company.id);
  await openRoute(page, `/diagnostico/${draft.id}?bloco=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Seus números" })).toBeVisible();
  return draft;
}

async function chooseMode(page: Page, item: "spend" | "newCustomers", name: string) {
  await page.locator(`[data-aioson-id="calc-${item}"]`).getByRole("radio", { name }).check();
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("masks reais, keeps whole cents and recalculates the panel on every change", async ({ page, api }) => {
  const draft = await openCalculator(page, api);
  await expectPanelClean(page);

  await chooseMode(page, "spend", "Sei os valores");
  await page.locator("#spend-ads").pressSequentially("200000");
  await expect(page.locator("#spend-ads")).toHaveValue("R$ 2.000,00");
  await page.locator("#spend-agency").pressSequentially("100000");
  await page.locator("#spend-commission").pressSequentially("54000");
  await expect(page.locator("#spend-commission")).toHaveValue("R$ 540,00");
  await expect(page.locator('[data-aioson-id="spend-total"]')).toHaveText("R$ 3.540,00");

  await chooseMode(page, "newCustomers", "Sei o número");
  await page.locator("#new-customers").pressSequentially("59");
  await expect(figure(page, COST)).toContainText("R$ 60,00");
  await expect(figure(page, COST)).toContainText("Gasto ÷ clientes novos");
  await expectPanelClean(page);

  await page.locator("#average-purchase").pressSequentially("4800");
  await expect(page.locator("#average-purchase")).toHaveValue("R$ 48,00");
  await page.locator('[data-aioson-id="calc-purchasesPerYear"] select').selectOption("sevenToTwelve");
  await page.locator('[data-aioson-id="calc-relationshipLength"] select').selectOption("oneToTwoYears");
  await saveDraftAfter(page, () => page.locator("#margin").pressSequentially("40"), "marginPercent");

  await expect(figure(page, PROFIT)).toContainText("R$ 273,60");
  await expect(figure(page, RATIO)).toContainText("4,6× Saudável");
  await expect(figure(page, PAYBACK)).toContainText("4 meses");
  await expect(figure(page, PAYBACK)).toContainText("Dentro de 12 meses.");
  await expectPanelClean(page);

  // Money is stored as whole cents (RULE-dm-12)
  const saved = await api.getDiagnosis(draft.id);
  expect(saved.calculator).toMatchObject({
    spendParts: { ads: 200_000, agency: 100_000, commission: 54_000 },
    newCustomers: 59,
    averagePurchaseCents: 4_800,
    marginPercent: 40,
  });

  // A new margin recalculates profit, ratio and payback at once
  await saveDraftAfter(page, () => page.locator("#margin").fill("20"), "marginPercent");
  await expect(figure(page, PROFIT)).toContainText("R$ 136,80");
  await expect(figure(page, RATIO)).toContainText("2,3× Atenção");
  await expect(figure(page, PAYBACK)).toContainText("8 meses");
  await expectPanelClean(page);

  // The masked values come back after reopening
  await page.reload();
  await expect(page.locator("#spend-ads")).toHaveValue("R$ 2.000,00");
  await expect(page.locator("#average-purchase")).toHaveValue("R$ 48,00");
  await expect(page.locator("#margin")).toHaveValue("20");
});

test("marks values from ranges as estimated", async ({ page, api }) => {
  await openCalculator(page, api);
  await chooseMode(page, "spend", "Sei mais ou menos");
  await page.locator('[data-aioson-id="calc-spend"] select').selectOption("from1000To5000");
  await chooseMode(page, "newCustomers", "Sei mais ou menos");
  await page.locator('[data-aioson-id="calc-newCustomers"] select').selectOption("from11To30");
  await page.locator("#average-purchase").pressSequentially("4500");
  await page.locator('[data-aioson-id="calc-purchasesPerYear"] select').selectOption("twoToThree");
  await page.locator('[data-aioson-id="calc-relationshipLength"] select').selectOption("oneToTwoYears");
  await page.locator("#margin").pressSequentially("40");

  await expect(figure(page, COST)).toContainText("(estimado por faixa)");
  await expect(figure(page, COST)).toContainText(/R\$ \d/);
  await expect(figure(page, RATIO)).toContainText("(estimado por faixa)");
  await expectPanelClean(page);
});

test("explains the cost it cannot calculate and reads a zero margin without NaN", async ({ page, api }) => {
  await openCalculator(page, api);

  // Spend unknown: no cost, and the panel says why
  await chooseMode(page, "spend", "Não sei");
  await expect(panel(page)).toContainText("Sem o gasto ou o número de clientes novos, o app não calcula o custo de um cliente.");
  await expect(figure(page, COST)).toContainText("não calculado");
  await expectPanelClean(page);

  // 0 new customers: "não calculado" with the BR-dm-14 explanation
  await chooseMode(page, "spend", "Sei os valores");
  await page.locator("#spend-ads").pressSequentially("100000");
  await chooseMode(page, "newCustomers", "Sei o número");
  await page.locator("#new-customers").pressSequentially("0");
  await expect(figure(page, COST)).toContainText("não calculado");
  await expect(figure(page, COST)).toContainText(NO_NEW_CUSTOMERS_EXPLANATION);
  await expectPanelClean(page);

  // Margin R$ 0: profit R$ 0,00, "0,0× Crítico" and "não se paga" (BR-dm-15)
  await page.locator("#new-customers").fill("10");
  await expect(figure(page, COST)).toContainText("R$ 100,00");
  await page.locator("#average-purchase").pressSequentially("5000");
  await page.locator('[data-aioson-id="calc-purchasesPerYear"] select').selectOption("once");
  await page.locator('[data-aioson-id="calc-relationshipLength"] select').selectOption("underSixMonths");
  await page.locator("#margin").pressSequentially("0");
  await expect(figure(page, PROFIT)).toContainText("R$ 0,00");
  await expect(figure(page, RATIO)).toContainText("0,0× Crítico");
  await expect(figure(page, PAYBACK)).toContainText("não se paga");
  await expectPanelClean(page);
  await expect(page.locator("main")).not.toContainText(/NaN|Infinity/);
});

test("flags a margin above 100 and saves the corrected number", async ({ page, api }) => {
  const draft = await openCalculator(page, api);
  const margin = page.locator("#margin");
  await margin.pressSequentially("150");
  await margin.blur();
  await expect(page.getByText("Use um número de 0 a 100.")).toBeVisible();
  await expect(margin).toHaveAttribute("aria-invalid", "true");
  await saveDraftAfter(page, async () => {
    await margin.fill("35");
  }, "marginPercent");
  await expect(page.getByText("Use um número de 0 a 100.")).toHaveCount(0);
  expect((await api.getDiagnosis(draft.id)).calculator.marginPercent).toBe(35);
});

// CAP-ra-diary-prefill: AC-ra-44 (3 months fill "Seus números" as measured), AC-ra-45 ("Usar o diário"
// with 1 or 2 months, estimated), AC-ra-46 (an edited number loses the mark; the result says where the
// cost came from; a later diary change leaves the draft as it was)

/** `YYYY-MM` of `monthsAgo` months before the current month. */
function monthBefore(monthsAgo: number): string {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const DIARY: Array<{ month: string; newCustomers: number; spendParts: Record<string, number> }> = [
  { month: monthBefore(3), newCustomers: 10, spendParts: { ads: 100_000 } },
  { month: monthBefore(2), newCustomers: 20, spendParts: { ads: 150_000 } },
  { month: monthBefore(1), newCustomers: 25, spendParts: { ads: 100_000, tools: 25_000 } },
];

// The rest of block 1 and the questionnaire, so the draft can be concluded
const REST_OF_CALCULATOR = { averagePurchaseCents: 4_800, purchasesPerYear: "sevenToTwelve", relationshipLength: "oneToTwoYears", marginPercent: 40 };

/** The stored block 1 plus the rest of it; the diary marks are the server's, so they are not sent back. */
function completedCalculator(stored: Record<string, unknown>): Record<string, unknown> {
  const { diarySource: _source, diarySuggestion: _suggestion, ...typed } = stored;
  return { ...typed, ...REST_OF_CALCULATOR };
}

test("with 3 months in the diary, 'Novo diagnóstico' brings the measured numbers and the result says so", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  for (const entry of DIARY) await api.addDiaryMonth(company.id, entry);

  await openRoute(page, `/empresa/${company.id}`);
  await page.getByRole("button", { name: "Novo diagnóstico" }).click();
  await expect(page).toHaveURL(/#\/diagnostico\/[^/?]+/);
  const draftId = /#\/diagnostico\/([^/?]+)/.exec(page.url())?.[1] as string;
  await openRoute(page, `/diagnostico/${draftId}?bloco=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Seus números" })).toBeVisible();

  // The sum of the 3 most recent months, with the mark of where it came from
  const mark = `do diário: ${formatMonthShort(DIARY[0].month)} a ${formatMonthShort(DIARY[2].month)}`;
  await expect(page.locator('[data-aioson-id="spend-diary-mark"]')).toHaveText(mark);
  await expect(page.locator('[data-aioson-id="new-customers-diary-mark"]')).toHaveText(mark);
  await expect(page.locator("#spend-ads")).toHaveValue("R$ 3.500,00");
  await expect(page.locator("#spend-tools")).toHaveValue("R$ 250,00");
  await expect(page.locator("#new-customers")).toHaveValue("55");
  await expect(figure(page, COST)).toContainText("R$ 68,18");
  await expect(page.locator('[data-aioson-id="diary-suggestion"]')).toHaveCount(0);

  // The answers still come from the last completed diagnosis (AC-ra-47); only block 1 changed source
  const draft = await api.getDiagnosis(draftId);
  expect(draft.answers).toEqual(CASES.g2.answers);

  // A change in the diary now leaves the draft as it was
  await api.addDiaryMonth(company.id, { month: monthBefore(0), newCustomers: 1, spendTotalCents: 900_000 });
  await page.reload();
  await expect(page.locator("#new-customers")).toHaveValue("55");

  // Concluded, the result says the cost per customer came from the diary, measured
  await api.patchDiagnosis(draftId, { calculator: completedCalculator({ ...draft.calculator }) });
  await api.completeDiagnosis(draftId);
  await openRoute(page, `/resultado/${draftId}`);
  await expect(page.locator('[data-aioson-id="result-numbers"]')).toContainText("Origem: do diário, medido");
});

test("a month with only the total makes the spend one total, and the panel reads the same cost", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.addDiaryMonth(company.id, { month: DIARY[0].month, newCustomers: 10, spendTotalCents: 100_000 });
  await api.addDiaryMonth(company.id, DIARY[1]);
  await api.addDiaryMonth(company.id, DIARY[2]);
  const draft = await api.startDiagnosis(company.id);
  await openRoute(page, `/diagnostico/${draft.id}?bloco=1`);

  await expect(page.locator('[data-aioson-id="spend-single-total"]')).toBeVisible();
  await expect(page.locator("#spend-total-only")).toHaveValue("R$ 3.750,00");
  await expect(figure(page, COST)).toContainText("R$ 68,18");
  await expectPanelClean(page);
});

test("with 2 months, 'Usar o diário' fills an estimate; an edited number loses its mark", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.addDiaryMonth(company.id, DIARY[1]);
  await api.addDiaryMonth(company.id, DIARY[2]);
  const draft = await api.startDiagnosis(company.id);
  await openRoute(page, `/diagnostico/${draft.id}?bloco=1`);

  // Nothing filled in until the owner accepts
  const offer = page.locator('[data-aioson-id="diary-suggestion"]');
  await expect(offer).toContainText("Seu diário tem 2 meses");
  await expect(offer).toContainText("Projetado para 3 meses:");
  await expect(page.locator('[data-aioson-id="spend-diary-mark"]')).toHaveCount(0);
  await page.locator('[data-aioson-id="diary-use"]').click();
  await expect(page.locator('[data-aioson-id="spend-diary-mark"]')).toHaveText("do diário: 2 meses, estimado");
  await expect(page.locator('[data-aioson-id="new-customers-diary-mark"]')).toHaveText("do diário: 2 meses, estimado");
  await expectPanelClean(page);

  // Typed over, the number of new customers is the owner's again
  await saveDraftAfter(page, async () => {
    await page.locator("#new-customers").fill("60");
  }, "newCustomers");
  await expect(page.locator('[data-aioson-id="new-customers-diary-mark"]')).toHaveCount(0);
  await expect(page.locator('[data-aioson-id="spend-diary-mark"]')).toHaveText("do diário: 2 meses, estimado");

  // Concluded with the estimated spend, the confidence stays at medium at most (AC-dm-49)
  const saved = await api.getDiagnosis(draft.id);
  await api.patchDiagnosis(draft.id, { answers: CASES.g2.answers, calculator: completedCalculator({ ...saved.calculator }) });
  await api.completeDiagnosis(draft.id);
  await openRoute(page, `/resultado/${draft.id}`);
  await expect(page.locator('[data-aioson-id="result-confidence"]')).not.toHaveAttribute("data-level", "high");
});

test("a number typed just before 'Usar o diário' is saved first and never drops the diary marks (AC-ra-46)", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.addDiaryMonth(company.id, DIARY[1]);
  await api.addDiaryMonth(company.id, DIARY[2]);
  const draft = await api.startDiagnosis(company.id);
  await openRoute(page, `/diagnostico/${draft.id}?bloco=1`);

  // A slow save of the typed number is still on its way when the owner clicks
  await page.getByRole("radio", { name: "Sei o número" }).check();
  await page.route(/\/api\/diagnoses\/[^/]+$/, async (route) => {
    if (route.request().method() === "PATCH") await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  const typedSave = page.waitForRequest((request) => request.method() === "PATCH" && /newCustomers/.test(request.postData() ?? ""));
  await page.locator("#new-customers").fill("60");
  await typedSave;
  await page.locator('[data-aioson-id="diary-use"]').click();
  await expect(page.locator('[data-aioson-id="new-customers-diary-mark"]')).toHaveText("do diário: 2 meses, estimado");

  // Once every save settled, the stored draft still carries both marks
  await expect
    .poll(async () => (await api.getDiagnosis(draft.id)).calculator.diarySource ?? null)
    .toMatchObject({ spend: expect.anything(), newCustomers: expect.anything() });
  await page.reload();
  await expect(page.locator('[data-aioson-id="spend-diary-mark"]')).toHaveText("do diário: 2 meses, estimado");
  await expect(page.locator('[data-aioson-id="new-customers-diary-mark"]')).toHaveText("do diário: 2 meses, estimado");
});

test("without a diary the block is the one of version 1", async ({ page, api }) => {
  await openCalculator(page, api);
  await expect(page.locator('[data-aioson-id="diary-suggestion"]')).toHaveCount(0);
  await expect(page.locator('[data-aioson-id="spend-diary-mark"]')).toHaveCount(0);
  await expect(page.locator('[data-aioson-id="new-customers-diary-mark"]')).toHaveCount(0);
});
