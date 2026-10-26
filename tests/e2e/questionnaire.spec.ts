import type { Page } from "@playwright/test";
import {
  CASES,
  QUESTIONS_BY_BLOCK,
  answerQuestion,
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  openRoute,
  saveDraftAfter,
  test,
  useMobileViewport,
} from "./support/fixtures";

// CAP-dm-questionnaire: AC-dm-10 to AC-dm-14, AC-dm-16, AC-dm-46, AC-dm-48

const BLOCK_TITLES = ["Seus números", "Clientes e produto", "Canais e preço", "Mercado e equipe", "Atrair", "Conversar", "Vender", "Manter"];
const CALCULATOR_ITEMS = ["spend", "newCustomers", "averagePurchase", "purchasesPerYear", "relationshipLength", "margin"];

function rail(page: Page) {
  return page.getByRole("navigation", { name: "Blocos do diagnóstico" });
}

async function fillCalculatorByHand(page: Page) {
  await saveDraftAfter(page, () => page.locator('[data-aioson-id="calc-spend"]').getByRole("radio", { name: "Sei mais ou menos" }).check(), "spendMode");
  await saveDraftAfter(page, () => page.locator('[data-aioson-id="calc-spend"] select').selectOption("from1000To5000"), "spendRange");
  await saveDraftAfter(page, () => page.locator('[data-aioson-id="calc-newCustomers"]').getByRole("radio", { name: "Sei o número" }).check(), "newCustomersMode");
  await saveDraftAfter(page, () => page.locator("#new-customers").pressSequentially("40"), "newCustomers");
  await saveDraftAfter(page, () => page.locator("#average-purchase").pressSequentially("4500"), "averagePurchaseCents");
  await saveDraftAfter(page, () => page.locator('[data-aioson-id="calc-purchasesPerYear"] select').selectOption("twoToThree"), "purchasesPerYear");
  await saveDraftAfter(page, () => page.locator('[data-aioson-id="calc-relationshipLength"] select').selectOption("oneToTwoYears"), "relationshipLength");
  await saveDraftAfter(page, () => page.locator("#margin").pressSequentially("40"), "marginPercent");
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("walks the 8 blocks, keeps every answer and resumes after reopening", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await openRoute(page, `/empresa/${company.id}`);
  await page.getByRole("button", { name: "Começar o primeiro diagnóstico" }).click();
  await expect(page).toHaveURL(/#\/diagnostico\/[^/?]+/);
  const diagnosisId = /#\/diagnostico\/([^/?]+)/.exec(page.url())?.[1] ?? "";

  // The rail lists the 8 blocks with their numbers (AC-dm-10)
  const links = rail(page).getByRole("link");
  await expect(links).toHaveCount(8);
  for (const [index, title] of BLOCK_TITLES.entries()) {
    await expect(links.nth(index)).toContainText(`${index + 1}`);
    await expect(links.nth(index)).toContainText(title);
  }

  // Block 1: the six calculator fields
  await expect(page.getByRole("heading", { level: 1, name: "Seus números" })).toBeVisible();
  for (const item of CALCULATOR_ITEMS) await expect(page.locator(`[data-aioson-id="calc-${item}"]`)).toBeVisible();
  await fillCalculatorByHand(page);
  await expect(links.nth(0)).toContainText("(respondido)");

  let questionCount = 0;
  for (let block = 2; block <= 8; block += 1) {
    await page.locator('[data-aioson-id="quiz-next"]').click();
    await expect(page.getByRole("heading", { level: 1, name: BLOCK_TITLES[block - 1] })).toBeVisible();
    await expect(page.getByText(`Bloco ${block} de 8`)).toBeVisible();
    const ids = QUESTIONS_BY_BLOCK[block];
    await expect(page.locator('[data-aioson-id="quiz-block"] fieldset[data-aioson-id^="item-"]')).toHaveCount(ids.length);
    questionCount += ids.length;
    for (const id of ids) await saveDraftAfter(page, () => answerQuestion(page, id, 2), id);
    await expect(links.nth(block - 1)).toContainText("(respondido)");
    if (block === 3) {
      // Closing and opening the app brings the same draft back (AC-dm-12)
      await page.reload();
      await expect(page.getByRole("heading", { level: 1, name: "Canais e preço" })).toBeVisible();
      for (const id of ids) {
        await expect(page.locator(`[data-aioson-id="item-${id}"] input[value="2"]`)).toBeChecked();
      }
      await expect(page.locator('[data-aioson-id="draft-saved"]')).toHaveText(/Salvo automaticamente às \d{2}:\d{2}/);
    }
  }
  expect(questionCount).toBe(24);

  // Reopening from scratch: the company offers "Continuar diagnóstico" and the draft has everything
  await openRoute(page, `/empresa/${company.id}`);
  await page.getByRole("link", { name: "Continuar diagnóstico" }).click();
  await expect(page).toHaveURL(new RegExp(`#/diagnostico/${diagnosisId}`));
  // It reopens on the last block visited
  await expect(page.getByRole("heading", { level: 1, name: "Manter" })).toBeVisible();
  const saved = await api.getDiagnosis(diagnosisId);
  expect(saved.status).toBe("draft");
  expect(Object.values(saved.answers).filter((value) => value === 2)).toHaveLength(24);
  expect(saved.calculator).toMatchObject({ averagePurchaseCents: 4_500, newCustomers: 40, marginPercent: 40, spendRange: "from1000To5000" });
});

test("shows and hides each help text, and offers 'não sei' only on the questions about facts", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const draft = await api.startDiagnosis(company.id);
  await openRoute(page, `/diagnostico/${draft.id}?bloco=2`);

  const question = page.locator('[data-aioson-id="item-mp1"]');
  const help = question.getByRole("button", { name: "O que significa esta pergunta?" });
  await expect(help).toHaveAttribute("aria-expanded", "false");
  const helpText = question.getByText("Quem volta a comprar mostra que o produto resolve algo de verdade.");
  await expect(helpText).toBeHidden();
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "true");
  await expect(helpText).toBeVisible();
  await help.click();
  await expect(helpText).toBeHidden();

  // mp1 and mp3 are facts ("Não acompanho", "Não sei dizer"); mp2 and mp4 are not
  await expect(page.locator('[data-aioson-id="item-mp1"] input[value="unknown"]')).toHaveCount(1);
  await expect(page.locator('[data-aioson-id="item-mp1"]').getByRole("radio", { name: "Não acompanho" })).toHaveCount(1);
  await expect(page.locator('[data-aioson-id="item-mp3"]').getByRole("radio", { name: "Não sei dizer" })).toHaveCount(1);
  await expect(page.locator('[data-aioson-id="item-mp2"] input[value="unknown"]')).toHaveCount(0);
  await expect(page.locator('[data-aioson-id="item-mp4"] input[value="unknown"]')).toHaveCount(0);

  await saveDraftAfter(page, () => answerQuestion(page, "mp1", null), "mp1");
  expect((await api.getDiagnosis(draft.id)).answers.mp1).toBeNull();
});

test("lists the pending blocks, then concludes only through the gold confirmation", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const draft = await api.startDiagnosis(company.id);
  const { answers, calculator } = CASES.g2;
  const firstBlocks = Object.fromEntries(Object.entries(answers).filter(([id]) => /^(mp|pc|cm|mm|es)/.test(id)));
  await api.patchDiagnosis(draft.id, { answers: firstBlocks, calculator });

  await openRoute(page, `/diagnostico/${draft.id}?bloco=8`);
  await page.locator('[data-aioson-id="quiz-finish"]').click();
  const missing = page.getByRole("alert").filter({ hasText: "Faltam respostas para concluir" });
  await expect(missing).toBeVisible();
  for (const title of ["Atrair", "Conversar", "Vender", "Manter"]) {
    await expect(missing.getByRole("link", { name: title })).toBeVisible();
  }
  await expect(missing.getByRole("link", { name: "Seus números" })).toHaveCount(0);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await missing.getByRole("link", { name: "Atrair" }).click();
  await expect(page).toHaveURL(/bloco=5/);
  await expect(page.getByRole("heading", { level: 1, name: "Atrair" })).toBeVisible();
  expect((await api.getDiagnosis(draft.id)).status).toBe("draft");

  await api.patchDiagnosis(draft.id, { answers });
  await openRoute(page, `/diagnostico/${draft.id}?bloco=8`);
  await page.reload();
  await page.locator('[data-aioson-id="quiz-finish"]').click();
  const gate = page.getByRole("alertdialog", { name: "Concluir o diagnóstico?" });
  await expect(gate).toContainText("o resultado não muda");
  const confirm = gate.getByRole("button", { name: "Concluir e ver resultado" });
  await expect(confirm).toHaveAttribute("data-tone", "gate");
  await gate.getByRole("button", { name: "Cancelar" }).click();
  await expect(gate).toHaveCount(0);
  expect((await api.getDiagnosis(draft.id)).status).toBe("draft");

  await page.locator('[data-aioson-id="quiz-finish"]').click();
  await confirm.click();
  await expect(page).toHaveURL(new RegExp(`#/resultado/${draft.id}`));
  await expect(page.locator('[data-aioson-id="result"]')).toBeVisible();
  expect((await api.getDiagnosis(draft.id)).status).toBe("completed");
});

test("discards only the draft, after confirming", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const completed = await api.seedCompleted(company.id, CASES.g2);
  const draft = await api.startDiagnosis(company.id);
  await openRoute(page, `/diagnostico/${draft.id}?bloco=2`);

  await page.locator('[data-aioson-id="diagnosis-discard"]').click();
  const dialog = page.getByRole("alertdialog", { name: /^Descartar o rascunho de \d{2}\/\d{2}\/\d{4}\?$/ });
  await expect(dialog).toContainText("Os diagnósticos concluídos não mudam.");
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Clientes e produto" })).toBeVisible();
  expect((await api.getDiagnosis(draft.id)).status).toBe("draft");

  await page.locator('[data-aioson-id="diagnosis-discard"]').click();
  await dialog.getByRole("button", { name: "Descartar rascunho" }).click();
  await expect(page).toHaveURL(new RegExp(`#/empresa/${company.id}$`));
  expect((await page.request.get(`/api/diagnoses/${draft.id}`)).status()).toBe(404);
  expect((await api.getDiagnosis(completed.id)).status).toBe("completed");
  const after = await api.getCompany(company.id);
  expect(after.completedCount).toBe(1);
  expect(after.draftId ?? null).toBeNull();
});

test("starts the next diagnosis from the last completed one and never opens a second draft", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Academia Leste" });
  await api.seedCompleted(company.id, CASES.g3);
  await openRoute(page, `/empresa/${company.id}`);
  await expect(page.getByText(/O novo diagnóstico começa com as respostas de \d{2}\/\d{2}\/\d{4} já preenchidas/)).toBeVisible();

  await page.locator('[data-aioson-id="company-new-diag"]').click();
  await expect(page).toHaveURL(/#\/diagnostico\//);
  // The answers and the calculator of the completed diagnosis come filled in (AC-dm-13)
  await expect(page.locator("#margin")).toHaveValue("55");
  await expect(page.locator("#average-purchase")).toHaveValue("R$ 450,00");
  await page.locator('[data-aioson-id="quiz-next"]').click();
  await expect(page.locator('[data-aioson-id="item-mp1"] input[value="3"]')).toBeChecked();
  await expect(page.locator('[data-aioson-id="item-mp3"] input[value="2"]')).toBeChecked();

  // With a draft open, the company offers "Continuar diagnóstico" instead (RULE-dm-13)
  await openRoute(page, `/empresa/${company.id}`);
  await expect(page.getByRole("link", { name: "Continuar diagnóstico" })).toBeVisible();
  await expect(page.locator('[data-aioson-id="company-new-diag"]')).toHaveCount(0);
  await expect(page.locator('[data-aioson-id="company-timeline"] li[data-status="draft"]')).toHaveCount(1);
});

test("fits 390 px and passes axe on the calculator and on a question block", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const draft = await api.startDiagnosis(company.id);
  await useMobileViewport(page);

  await openRoute(page, `/diagnostico/${draft.id}?bloco=1`);
  await expect(page.getByRole("heading", { level: 1, name: "Seus números" })).toBeVisible();
  await page.locator('[data-aioson-id="calc-spend"]').getByRole("radio", { name: "Sei os valores" }).check();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);

  await openRoute(page, `/diagnostico/${draft.id}?bloco=3`);
  await expect(page.getByRole("heading", { level: 1, name: "Canais e preço" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});
