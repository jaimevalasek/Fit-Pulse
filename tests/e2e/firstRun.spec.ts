import type { Page } from "@playwright/test";
import { CASES, expect, openRoute, readScreenText, test } from "./support/fixtures";

// CAP-dm-first-run, project "fresh-db": a new installation, no company and no preference yet.
// AC-dm-01, AC-dm-02, AC-dm-03. The tests run in order and build on each other.
test.describe.configure({ mode: "serial" });

const WIZARD_TITLE = "Vamos descobrir em que degrau a sua empresa está";

async function readPreferences(page: Page): Promise<Record<string, unknown>> {
  return (await (await page.request.get("/api/preferences")).json()) as Record<string, unknown>;
}

/** Walks the tour to the end, checking the counter and that each step points somewhere else. */
async function walkTour(page: Page, total: number) {
  const card = page.locator('[data-aioson-id="tour-card"]');
  const anchors = new Set<string | null>();
  for (let step = 1; step <= total; step += 1) {
    await expect(page.locator('[data-aioson-id="tour-count"]')).toHaveText(`${step} de ${total}`);
    await expect(page.locator('[data-aioson-id="tour-highlight"]')).toBeVisible();
    anchors.add(await card.getAttribute("data-tour-step"));
    await page.locator('[data-aioson-id="tour-next"]').click();
  }
  expect(anchors.size, "each step highlights its own region").toBe(total);
  await expect(card).toHaveCount(0);
}

test("a new installation opens straight on the wizard, with no technical screen", async ({ page, api }) => {
  expect(await api.listCompanies(false)).toEqual([]);
  expect(await api.listCompanies(true)).toEqual([]);

  await openRoute(page, "/");
  await expect(page).toHaveURL(/#\/boas-vindas$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(WIZARD_TITLE);
  await expect(page.getByRole("list", { name: "Etapas do primeiro uso" }).locator('[aria-current="step"]')).toHaveText("1. Como vai usar");
  // Nothing to navigate to yet, and nothing to configure
  await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  expect(await readScreenText(page)).not.toMatch(/\b(banco de dados|database|porta|port|login|senha|auth url|binding id|servidor)\b/i);
});

test("'Para a minha empresa' plus name, segment and channel creates the company and opens 'Seus números'", async ({ page }) => {
  await openRoute(page, "/boas-vindas");
  await page.locator('[data-aioson-id="wizard-mode-empresa"]').click();
  await expect(page).toHaveURL(/#\/boas-vindas\/empresa\?modo=owner$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conte um pouco sobre a sua empresa");

  // "Voltar" returns to the choice without saving anything
  await page.locator('[data-aioson-id="wizard-back"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(WIZARD_TITLE);
  await page.locator('[data-aioson-id="wizard-mode-empresa"]').click();

  const form = page.locator('[data-aioson-id="wizard-form"]');
  await page.locator('[data-aioson-id="wizard-submit"]').click();
  await expect(form.getByText("Informe o nome da empresa.")).toBeVisible();
  await expect(form.getByText("Escolha o segmento mais próximo.")).toBeVisible();
  await expect(form.getByText("Escolha como você vende.")).toBeVisible();

  await form.getByLabel("Nome da empresa").fill("Padaria Aurora");
  await form.getByLabel("Segmento").selectOption("food");
  await form.getByRole("radio", { name: "Loja física ou balcão" }).check();
  await page.locator('[data-aioson-id="wizard-submit"]').click();

  await expect(page).toHaveURL(/#\/diagnostico\/[^/?]+/);
  await expect(page.getByRole("heading", { level: 1, name: "Seus números" })).toBeVisible();
  const companies = await (await page.request.get("/api/companies")).json();
  expect(companies).toHaveLength(1);
  expect(companies[0]).toMatchObject({ name: "Padaria Aurora", segment: "food", salesChannel: "storefront" });
  expect(companies[0].draftId).toBeTruthy();
  expect(await readPreferences(page)).toMatchObject({ usageMode: "owner", focusCompanyId: companies[0].id });
  await expect(page.locator('[data-aioson-id="nav-minha-empresa"]')).toBeVisible();
});

// AC-ra-37: the 5 steps of the prototype open their own pages; step 1 is the company reports
test("the owner tour shows 5 steps the first time, can be skipped and comes back from the '?'", async ({ page, api }) => {
  const [company] = await api.listCompanies();
  expect(company.draftId).toBeTruthy();
  await api.patchDiagnosis(company.draftId as string, { answers: CASES.g2.answers, calculator: CASES.g2.calculator });
  await api.completeDiagnosis(company.draftId as string);
  const reportsPage = new RegExp(`#/empresa/${company.id}/relatorios$`);

  await openRoute(page, "/inicio");
  await expect(page.locator('[data-aioson-id="tour-card"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="tour-count"]')).toHaveText("1 de 5");
  await expect(page).toHaveURL(reportsPage);
  await page.locator('[data-aioson-id="tour-next"]').click();
  await expect(page.locator('[data-aioson-id="tour-count"]')).toHaveText("2 de 5");
  await page.locator('[data-aioson-id="tour-prev"]').click();
  await expect(page.locator('[data-aioson-id="tour-count"]')).toHaveText("1 de 5");
  await page.locator('[data-aioson-id="tour-skip"]').click();
  await expect(page.locator('[data-aioson-id="tour-card"]')).toHaveCount(0);

  // Skipping counts as seen and keeps the page of the step: the home does not show it again
  await expect.poll(async () => (await readPreferences(page)).tourSeen).toMatchObject({ owner: true });
  await expect(page).toHaveURL(reportsPage);
  await openRoute(page, "/inicio");
  await page.reload();
  await expect(page.locator('[data-aioson-id="home-owner"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="tour-card"]')).toHaveCount(0);

  // The "?" of the top bar reopens it, from any page, on its first step
  await openRoute(page, "/configuracoes");
  await page.locator('[data-aioson-id="tour-reopen"]').click();
  await expect(page).toHaveURL(reportsPage);
  await walkTour(page, 5);
});

test("the consultancy mode does not show the tour again and its '?' walks the same 5 steps", async ({ page, api }) => {
  await api.setPreferences({ usageMode: "consultant" });
  await openRoute(page, "/inicio");
  await expect(page.locator('[data-aioson-id="home-consultant"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="tour-card"]')).toHaveCount(0);
  await page.locator('[data-aioson-id="tour-reopen"]').click();
  await walkTour(page, 5);
  await openRoute(page, "/inicio");
  await page.reload();
  await expect(page.locator('[data-aioson-id="home-consultant"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="tour-card"]')).toHaveCount(0);
});

test("'Atendo várias empresas' registers the first client in consultancy mode", async ({ page }) => {
  await openRoute(page, "/boas-vindas");
  await page.locator('[data-aioson-id="wizard-mode-consultoria"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cadastre a primeira empresa que você atende");
  const form = page.locator('[data-aioson-id="wizard-form"]');
  await form.getByLabel("Nome da empresa").fill("Academia Leste");
  await form.getByLabel("Segmento").selectOption("health_wellness");
  await form.getByRole("radio", { name: "Assinatura ou mensalidade" }).check();
  await page.locator('[data-aioson-id="wizard-submit"]').click();
  await expect(page.getByRole("heading", { level: 1, name: "Seus números" })).toBeVisible();
  expect(await readPreferences(page)).toMatchObject({ usageMode: "consultant" });
});
