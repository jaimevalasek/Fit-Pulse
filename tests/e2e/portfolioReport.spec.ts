import type { Page } from "@playwright/test";
import { CASES, clearSavedPdfs, e2eWorkspace, expect, findForbiddenTerms, openRoute, pdfFiles, readPdfPages, test } from "./support/fixtures";

// CAP-ra-portfolio-report: AC-ra-15 (the portfolio PDF in consultancy mode, with the overdue actions of
// part 2), AC-ra-16 (owner mode and an empty portfolio) and AC-ra-17 (`carteira-{data}.pdf`). The
// network outside this computer is cut by the fixture (AC-ra-60).

async function readPreviewTitles(page: Page): Promise<string[]> {
  const box = page.getByLabel("Prévia das páginas do PDF");
  await expect(box).toHaveAttribute("data-state", "ready");
  await expect(box).not.toHaveAttribute("aria-busy", "true");
  const labels = await box.locator('[data-aioson-id="report-sheet"]').evaluateAll((sheets) => sheets.map((sheet) => sheet.getAttribute("aria-label") ?? ""));
  return labels.map((label) => label.replace(/^Página \d+ de \d+: /, ""));
}

test.beforeEach(async ({ api }) => {
  await api.reset();
  clearSavedPdfs();
});

test("the consultant saves the portfolio report, with the same pages as the preview and the home numbers", async ({ page, api }) => {
  const aurora = await api.createCompany({ name: "Padaria Aurora" });
  const auroraDiagnosis = await api.seedCompleted(aurora.id, CASES.g1);
  const leste = await api.createCompany({ name: "Academia Leste" });
  await api.seedCompleted(leste.id, CASES.g4);
  await api.createCompany({ name: "Floricultura Sol" });
  // An action past its deadline counts in "Ações vencidas" (RULE-ra-06)
  const plan = (await api.listActions(aurora.id)).current;
  expect(plan?.diagnosisId).toBe(auroraDiagnosis.id);
  await api.patchAction(auroraDiagnosis.id, plan!.actions[0].actionKey, { dueDate: "2026-01-15" });
  await api.setPreferences({ usageMode: "consultant" });

  // From the consultant home
  await openRoute(page, "/inicio");
  await page.locator('[data-aioson-id="home-portfolio-report"]').click();
  await expect(page).toHaveURL(/#\/relatorios\/carteira$/);
  await expect(page.getByRole("heading", { level: 1, name: "Relatório da carteira" })).toBeVisible();

  const titles = await readPreviewTitles(page);
  expect(titles).toContain("Empresas por estágio");
  expect(titles.some((title) => title.startsWith("Empresas ativas"))).toBe(true);
  const sheets = page.locator('[data-aioson-id="report-sheet"]');
  for (const name of ["Padaria Aurora", "Academia Leste", "Floricultura Sol"]) await expect(sheets.filter({ hasText: name })).not.toHaveCount(0);
  await expect(sheets.filter({ hasText: "Ações vencidas" })).not.toHaveCount(0);

  const before = new Set(pdfFiles());
  await page.locator('[data-aioson-id="report-export"]').click();
  const saved = page.locator('[data-aioson-id="report-pdf-saved"]');
  await expect(saved).toContainText("PDF salvo");
  const [fileName] = pdfFiles().filter((name) => !before.has(name));
  expect(fileName).toMatch(/^carteira-\d{4}-\d{2}-\d{2}\.pdf$/);
  await expect(saved).toContainText(`Arquivo ${fileName} na pasta ${e2eWorkspace.downloadsDir}`);

  const pages = await readPdfPages(fileName);
  expect(pages).toHaveLength(titles.length);
  titles.forEach((title, index) => {
    if (index > 0) expect(pages[index], `page ${index + 1} of the PDF`).toContain(title);
  });
  const text = pages.join("\n");
  for (const name of ["Padaria Aurora", "Academia Leste", "Floricultura Sol"]) expect(text).toContain(name);
  expect(text).toContain("Ações vencidas");
  expect(findForbiddenTerms(text)).toEqual([]);

  // The count of active companies is the one of the consultant home
  expect(await api.getHome("consultant")).toMatchObject({ mode: "consultant", companyCount: 3 });
});

test("in owner mode the route explains the report is for consultancy and leads to Configurações", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  await api.setPreferences({ usageMode: "owner", focusCompanyId: company.id });

  await openRoute(page, "/relatorios/carteira");
  await expect(page.locator('[data-aioson-id="portfolio-owner-mode"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="report-export"]')).toHaveCount(0);
  await page.locator('[data-aioson-id="portfolio-open-settings"]').click();
  await expect(page).toHaveURL(/#\/configuracoes$/);
});

test("an empty portfolio says there is no active company and offers to register the first one", async ({ page, api }) => {
  await api.setPreferences({ usageMode: "consultant" });
  await openRoute(page, "/relatorios/carteira");
  const empty = page.locator('[data-aioson-id="portfolio-empty"]');
  await expect(empty).toBeVisible();
  await expect(page.locator('[data-aioson-id="portfolio-first-company"]')).toHaveText("Cadastrar a primeira empresa");
  await expect(page.locator('[data-aioson-id="report-export"]')).toHaveCount(0);
});
