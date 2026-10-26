import type { Locator, Page } from "@playwright/test";
import {
  CASES,
  MOBILE_VIEWPORT,
  e2eWorkspace,
  expect,
  findForbiddenTerms,
  openRoute,
  pdfFiles,
  clearSavedPdfs,
  readPdfPages,
  stubSystemOpener,
  test,
} from "./support/fixtures";

// CAP-ra-report-center, CAP-ra-pdf-delivery, CAP-ra-evolution-report: AC-ra-01 to AC-ra-04,
// AC-ra-12, AC-ra-14, AC-ra-17, AC-ra-18, AC-ra-60 (the network outside this computer is cut by the
// fixture, so every preview and PDF here is made offline) and AC-ra-61.

const FILE_DATE = /\d{4}-\d{2}-\d{2}/.source;

interface PreviewPage {
  id: string;
  title: string;
}

function previewBox(page: Page): Locator {
  return page.getByLabel("Prévia das páginas do PDF");
}

/** Waits for the preview to settle and reads its pages from the sheets ("Página N de T: {título}"). */
async function readPreview(page: Page): Promise<PreviewPage[]> {
  const box = previewBox(page);
  await expect(box).toHaveAttribute("data-state", "ready");
  await expect(box).not.toHaveAttribute("aria-busy", "true");
  const sheets = box.locator('[data-aioson-id="report-sheet"]');
  const total = await sheets.count();
  const pages: PreviewPage[] = [];
  for (let index = 0; index < total; index += 1) {
    const sheet = sheets.nth(index);
    const label = (await sheet.getAttribute("aria-label")) ?? "";
    expect(label).toMatch(new RegExp(`^Página ${index + 1} de ${total}: `));
    pages.push({ id: (await sheet.getAttribute("data-page-id")) ?? "", title: label.replace(/^Página \d+ de \d+: /, "") });
  }
  return pages;
}

/** The page the last change touched: the reprint band, scrolled into the preview (AC-ra-02). */
async function expectReprinted(page: Page, pageId?: string): Promise<void> {
  const reprinted = previewBox(page).locator(".report-sheet.is-reprinted");
  await expect(reprinted).toHaveCount(1);
  if (pageId) await expect(reprinted).toHaveAttribute("data-page-id", pageId);
  await expect(reprinted).toBeInViewport();
}

/** "Exportar PDF", then the saved state with the name and the folder (AC-ra-17). */
async function exportFromCenter(page: Page): Promise<string> {
  const before = new Set(pdfFiles());
  await page.locator('[data-aioson-id="report-export"]').click();
  const saved = page.locator('[data-aioson-id="report-pdf-saved"]');
  await expect(saved).toContainText("PDF salvo");
  await expect(saved).toContainText(e2eWorkspace.downloadsDir);
  const created = pdfFiles().filter((name) => !before.has(name));
  expect(created).toHaveLength(1);
  await expect(saved).toContainText(created[0]);
  return created[0];
}

/** The PDF has the pages of the preview, in the same order, with the same titles (AC-ra-02). */
async function expectPdfMatchesPreview(fileName: string, preview: PreviewPage[], coverText: string): Promise<string[]> {
  const pdfPages = await readPdfPages(fileName);
  expect(pdfPages, "pages of the PDF").toHaveLength(preview.length);
  preview.forEach((sheet, index) => {
    const text = pdfPages[index].toLowerCase();
    const expected = sheet.id === "cover" ? coverText : sheet.title;
    expect(text, `page ${index + 1} of the PDF (${sheet.id})`).toContain(expected.replace(/\s+/g, " ").toLowerCase());
  });
  expect(findForbiddenTerms(pdfPages.join("\n")), "forbidden terms in the PDF").toEqual([]);
  return pdfPages;
}

test.beforeEach(async ({ api }) => {
  await api.reset();
  clearSavedPdfs();
});

test("the center previews the same pages it saves, and the delivery opens the saved file", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  const opener = await stubSystemOpener(page);
  // A short pause on the export, so the "Salvando…" state can be seen
  await page.route("**/api/reports/export", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.continue();
  });

  await openRoute(page, `/empresa/${company.id}/relatorios`);
  const preview = await readPreview(page);
  expect(preview.map((sheet) => sheet.id)).toEqual(["cover", "executive-summary", "dimensions", "risks", "numbers", "how-to-read"]);
  await expect(page.locator(".report-preview-label")).toHaveText(`Prévia · A4 · ${preview.length} páginas`);

  const exportButton = page.locator('[data-aioson-id="report-export"]');
  const before = new Set(pdfFiles());
  await exportButton.click();
  await expect(exportButton).toHaveText("Salvando…");
  const saved = page.locator('[data-aioson-id="report-pdf-saved"]');
  await expect(saved).toContainText("PDF salvo");
  const [fileName] = pdfFiles().filter((name) => !before.has(name));
  expect(fileName).toMatch(new RegExp(`^Padaria Aurora-${FILE_DATE}\\.pdf$`));
  await expect(saved).toContainText(`Arquivo ${fileName} na pasta ${e2eWorkspace.downloadsDir}`);
  await expectPdfMatchesPreview(fileName, preview, "Padaria Aurora");

  // "Abrir PDF" and "Mostrar na pasta" send only the id of the saved file: no path leaves the screen
  const openRequest = page.waitForRequest(/\/api\/files\/[^/]+\/open$/);
  await saved.locator('[data-aioson-id="report-open-pdf"]').click();
  expect((await openRequest).postData() ?? "").not.toContain(e2eWorkspace.downloadsDir);
  await saved.locator('[data-aioson-id="report-show-folder"]').click();
  await expect.poll(() => opener.length).toBe(2);
  expect(opener[0]).toMatch(/^\/api\/files\/[^/]+\/open$/);
  expect(opener[1]).toBe(opener[0].replace(/open$/, "reveal"));
  await expect(page.locator('[data-aioson-id="report-open-error"]')).toHaveCount(0);

  // A repeated name gets " (2)" and the first file stays
  const again = await exportFromCenter(page);
  expect(again).toBe(fileName.replace(".pdf", " (2).pdf"));
  expect(pdfFiles()).toContain(fileName);
});

test("every option redraws the preview at once and marks the page it changed", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Studio Norte" });
  await api.seedCompleted(company.id, CASES.g1);
  await api.seedCompleted(company.id, CASES.g2);
  await api.seedCompleted(company.id, CASES.g3);

  await openRoute(page, `/empresa/${company.id}/relatorios`);
  const base = await readPreview(page);
  await expect(previewBox(page).locator(".report-sheet.is-reprinted")).toHaveCount(0);

  // "Incluir as respostas do questionário": the answers pages come after the report and the first one is marked
  await page.locator('[data-aioson-id="report-include-answers"] input').check();
  await expect.poll(async () => (await readPreview(page)).length).toBeGreaterThan(base.length);
  const withAnswers = await readPreview(page);
  expect(withAnswers.slice(0, base.length)).toEqual(base);
  await expectReprinted(page, withAnswers[base.length].id);
  const answersFile = await exportFromCenter(page);
  await expectPdfMatchesPreview(answersFile, withAnswers, "Studio Norte");

  // Another diagnosis of the list
  await page.locator('[data-aioson-id="report-include-answers"] input').uncheck();
  await expect.poll(async () => (await readPreview(page)).length).toBe(base.length);
  await page.locator('[data-aioson-id="report-diagnosis"]').selectOption({ index: 2 });
  await expectReprinted(page);

  // The evolution: from the second latest to the latest by default, with the same math as the comparison
  await page.locator('[data-aioson-id="report-type-evolution"]').click();
  await expect(page.locator('[data-aioson-id="report-type-evolution"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-aioson-id="report-from"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="report-diagnosis"]')).toHaveCount(0);
  await expect(page.locator('[data-aioson-id="report-evolution-math"]')).toContainText("Usa a mesma conta da tela de comparação.");
  const evolution = await readPreview(page);
  expect(evolution.map((sheet) => sheet.id)).not.toEqual(base.map((sheet) => sheet.id));
  // "Até" only offers diagnoses after "De" (AC-ra-14)
  await expect(page.locator('[data-aioson-id="report-to"] option')).toHaveCount(1);
  const evolutionFile = await exportFromCenter(page);
  expect(evolutionFile).toMatch(new RegExp(`^Studio Norte-evolucao-${FILE_DATE}-a-${FILE_DATE}\\.pdf$`));
  await expectPdfMatchesPreview(evolutionFile, evolution, "Studio Norte");

  // A new "De" redraws the evolution and "Até" now offers both later diagnoses
  await page.locator('[data-aioson-id="report-from"]').selectOption({ index: 1 });
  await expect(page.locator('[data-aioson-id="report-to"] option')).toHaveCount(2);
  await expectReprinted(page);

  // Back to the diagnosis report
  await page.locator('[data-aioson-id="report-type-diagnosis"]').click();
  await expect(page.locator('[data-aioson-id="report-diagnosis"]')).toBeVisible();
  expect((await readPreview(page)).map((sheet) => sheet.id)).toEqual(base.map((sheet) => sheet.id));
});

test("the evolution needs 2 diagnoses, and a company with none has no report to export (AC-ra-03)", async ({ page, api }) => {
  const single = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(single.id, CASES.g2);
  await openRoute(page, `/empresa/${single.id}/relatorios`);
  await readPreview(page);
  const evolution = page.locator('[data-aioson-id="report-type-evolution"]');
  await expect(evolution).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator('[data-aioson-id="report-evolution-note"]')).toHaveText(
    "A evolução precisa de 2 diagnósticos concluídos da mesma empresa. Esta tem 1.",
  );
  await expect(page.locator('[data-aioson-id="report-type-diagnosis"]')).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-aioson-id="report-from"]')).toHaveCount(0);

  // BR-ra-01: no completed diagnosis, no report and no "Exportar PDF"
  const empty = await api.createCompany({ name: "Academia Leste" });
  await openRoute(page, `/empresa/${empty.id}/relatorios`);
  await expect(page.locator('[data-aioson-id="reports-empty"]')).toContainText("Ainda não há relatório");
  await expect(page.locator('[data-aioson-id="reports-start"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="report-export"]')).toHaveCount(0);
});

test("a failed preview shows no partial page, and 'Tentar de novo' brings the pages", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  // Every preview fails until the retry (the dev build asks twice on the first render)
  let failing = true;
  await page.route(/\/api\/reports\/preview\?/, async (route) => {
    if (failing) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "internal_error", message: "Não foi possível montar a prévia do relatório." }, requestId: "e2e" }),
      });
      return;
    }
    await route.continue();
  });

  await openRoute(page, `/empresa/${company.id}/relatorios`);
  const error = page.locator('[data-aioson-id="report-preview-error"]');
  await expect(error).toContainText("Não foi possível montar a prévia");
  await expect(page.locator('[data-aioson-id="report-sheet"]')).toHaveCount(0);
  await expect(page.locator('[data-aioson-id="report-export"]')).toBeDisabled();
  failing = false;
  await error.getByRole("button", { name: "Tentar de novo" }).click();
  expect((await readPreview(page)).length).toBe(6);
  await expect(page.locator('[data-aioson-id="report-export"]')).toBeEnabled();
});

test("a failed save says nothing was saved and offers a new attempt", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  const message = "Não foi possível salvar o PDF na pasta Downloads. Nada foi alterado. Confira se há espaço no disco e tente de novo.";
  let failures = 1;
  await page.route("**/api/reports/export", async (route) => {
    if (failures > 0) {
      failures -= 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { code: "write_failed", message }, requestId: "e2e" }) });
      return;
    }
    await route.continue();
  });
  await openRoute(page, `/empresa/${company.id}/relatorios`);
  await readPreview(page);
  const before = pdfFiles();

  await page.locator('[data-aioson-id="report-export"]').click();
  const error = page.locator('[data-aioson-id="report-export-error"]');
  await expect(error).toHaveAttribute("role", "alert");
  await expect(error).toContainText(message);
  expect(pdfFiles()).toEqual(before);

  await page.locator('[data-aioson-id="report-export-retry"]').click();
  await expect(page.locator('[data-aioson-id="report-pdf-saved"]')).toContainText("PDF salvo");
  expect(pdfFiles()).toHaveLength(before.length + 1);
});

test("when the computer cannot open the file, the delivery says where it is", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  await stubSystemOpener(page, "fail");
  await openRoute(page, `/empresa/${company.id}/relatorios`);
  await readPreview(page);
  await exportFromCenter(page);

  const failure = `Não foi possível abrir. O arquivo está em ${e2eWorkspace.downloadsDir}.`;
  await page.locator('[data-aioson-id="report-open-pdf"]').click();
  await expect(page.locator('[data-aioson-id="report-open-error"]')).toHaveText(failure);
  await page.locator('[data-aioson-id="report-show-folder"]').click();
  await expect(page.locator('[data-aioson-id="report-open-error"]')).toHaveText(failure);
  // The saved state stays: the owner still sees the name and the folder
  await expect(page.locator('[data-aioson-id="report-pdf-saved"]')).toContainText("PDF salvo");
});

test("with reduced motion the reprint band and the pages show in their final state", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openRoute(page, `/empresa/${company.id}/relatorios`);
  await readPreview(page);
  await page.locator('[data-aioson-id="report-include-answers"] input').check();
  await expect(previewBox(page).locator(".report-sheet.is-reprinted")).toHaveCount(1);
  const running = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length);
  expect(running, "animations running with prefers-reduced-motion (AC-ra-58)").toBe(0);
});

for (const viewport of [{ width: 1280, height: 800 }, MOBILE_VIEWPORT]) {
  test(`"Relatórios" is in the first fold of the company and of the result at ${viewport.width} px`, async ({ page, api }) => {
    const company = await api.createCompany({ name: "Padaria Aurora com um nome bem comprido para a linha" });
    const diagnosis = await api.seedCompleted(company.id, CASES.g2);
    await page.setViewportSize(viewport);

    await openRoute(page, `/empresa/${company.id}`);
    const tab = page.locator('[data-aioson-id="tab-relatorios"]');
    // The active-tab line hangs 1 px below the tab bar, which clips it
    await expect(tab).toBeInViewport({ ratio: 0.9 });
    await tab.click();
    await expect(page).toHaveURL(new RegExp(`#/empresa/${company.id}/relatorios$`));
    await readPreview(page);

    await openRoute(page, `/resultado/${diagnosis.id}`);
    const fromResult = page.locator('[data-aioson-id="result-reports"]');
    await expect(fromResult).toBeInViewport({ ratio: 1 });
    await fromResult.click();
    // The center opens on the diagnosis of the result
    await expect(page).toHaveURL(new RegExp(`#/empresa/${company.id}/relatorios\\?diagnostico=${diagnosis.id}$`));
    await expect(page.locator('[data-aioson-id="report-diagnosis"]')).toHaveValue(diagnosis.id);
  });
}
