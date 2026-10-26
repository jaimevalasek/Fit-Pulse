import type { Page } from "@playwright/test";
import {
  CASES,
  expect,
  expectNoAxeViolations,
  expectNoForbiddenTerms,
  expectNoHorizontalScroll,
  openRoute,
  test,
  useMobileViewport,
} from "./support/fixtures";

// CAP-dm-history: AC-dm-30, AC-dm-31 (on screen), AC-dm-48. The recalculation notice for a
// change of rules is covered by tests/unit/compareDiagnoses.test.ts and tests/api/historyRoutes.test.ts:
// this build ships only the v1 rules, so two diagnoses on screen always share the version.

function timelineRow(page: Page, id: string) {
  return page.locator(`li[data-row-id="${id}"]`);
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("starts a second diagnosis from the first and compares the two", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const first = await api.seedCompleted(company.id, CASES.g1);

  // The first diagnosis offers no comparison (AC-dm-30)
  await openRoute(page, `/empresa/${company.id}`);
  const firstRow = timelineRow(page, first.id);
  await expect(firstRow).toHaveAttribute("data-status", "completed");
  await expect(firstRow).toContainText("Estágio 1 · Descoberta");
  await expect(firstRow).toContainText("Cálculo 1");
  await expect(firstRow).toContainText("Dados: confiança média");
  await expect(firstRow.getByRole("link", { name: /^Comparar/ })).toHaveCount(0);
  await openRoute(page, `/resultado/${first.id}`);
  await expect(page.locator('[data-aioson-id="result"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="result-compare"]')).toHaveCount(0);

  // "Novo diagnóstico" opens a draft prefilled with the first one; the owner updates the numbers
  await openRoute(page, `/empresa/${company.id}`);
  await page.locator('[data-aioson-id="company-new-diag"]').click();
  await expect(page).toHaveURL(/#\/diagnostico\//);
  const draftId = /#\/diagnostico\/([^/?]+)/.exec(page.url())?.[1] ?? "";
  await openRoute(page, `/empresa/${company.id}`);
  const draftRow = timelineRow(page, draftId);
  await expect(draftRow).toHaveAttribute("data-status", "draft");
  await expect(draftRow).toContainText("Em andamento");
  await expect(draftRow.getByRole("progressbar", { name: "Progresso do rascunho" })).toHaveAttribute("aria-valuetext", "8 de 8 blocos");

  await api.patchDiagnosis(draftId, { answers: CASES.g2.answers, calculator: CASES.g2.calculator });
  await openRoute(page, `/diagnostico/${draftId}?bloco=8`);
  await page.locator('[data-aioson-id="quiz-finish"]').click();
  await page.getByRole("alertdialog", { name: "Concluir o diagnóstico?" }).getByRole("button", { name: "Concluir e ver resultado" }).click();
  await expect(page.locator('[data-aioson-id="result"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="ladder-steps"]')).toHaveAttribute("aria-label", /Diagnóstico anterior no estágio 1\./);

  // "Comparar com {mês}": stage before -> after, every dimension with arrow and words, risks
  await page.locator('[data-aioson-id="result-compare"]').click();
  await expect(page).toHaveURL(new RegExp(`#/comparar/${draftId}$`));
  await expect(page.locator('[data-aioson-id="compare-stage"]')).toContainText("Descoberta → Ajuste");
  await expect(page.locator('[data-aioson-id="compare-stage"]')).toContainText("Subiu de degrau.");
  const rows = page.locator('[data-aioson-id="compare-table"] tbody tr');
  await expect(rows).toHaveCount(8);
  const mp = page.locator('[data-aioson-id="compare-table"] tr[data-dimension="mp"]');
  await expect(mp.locator("td").nth(0)).toHaveText("17");
  await expect(mp.locator("td").nth(1)).toHaveText("67");
  await expect(mp.locator("[data-direction]")).toHaveAttribute("data-direction", "up");
  await expect(mp.locator("[data-direction]")).toContainText("+50");
  await expect(mp.locator("[data-direction] svg")).toHaveCount(1);
  await expect(page.locator('[data-aioson-id="compare-risks-resolved"] li[data-risk-id="SIG-01"]')).toContainText("Resolvido");
  await expect(page.locator('[data-aioson-id="compare-risks-new"] li[data-risk-id="SIG-04"]')).toContainText("Novo");
  await expect(page.locator('[data-aioson-id="compare-risks-new"] li[data-risk-id="SIG-05"]')).toHaveCount(0);
  // Same rules on both sides: no recalculation notice
  await expect(page.locator('[data-aioson-id="compare-rules"]')).toHaveCount(0);
  await expectNoForbiddenTerms(page);

  // The newest entry of the timeline now offers the comparison, the first one still does not
  await openRoute(page, `/empresa/${company.id}`);
  await expect(timelineRow(page, draftId).getByRole("link", { name: /^Comparar diagnóstico de/ })).toBeVisible();
  await expect(timelineRow(page, first.id).getByRole("link", { name: /^Comparar/ })).toHaveCount(0);
});

test("archives and restores a diagnosis only after confirming", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const first = await api.seedCompleted(company.id, CASES.g1);
  const second = await api.seedCompleted(company.id, CASES.g2);
  await openRoute(page, `/empresa/${company.id}`);
  await expect(page.locator('[data-aioson-id="company-timeline"] li[data-status="completed"]')).toHaveCount(2);

  const archive = timelineRow(page, second.id).getByRole("button", { name: /^Arquivar diagnóstico de/ });
  await archive.click();
  const dialog = page.getByRole("alertdialog", { name: /^Arquivar o diagnóstico de \d{2}\/\d{2}\/\d{4}\?$/ });
  await expect(dialog).toContainText("Ele sai da linha do tempo e das comparações.");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await archive.click();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(page.locator('[data-aioson-id="company-timeline"] li[data-status="completed"]')).toHaveCount(2);

  await archive.click();
  await dialog.getByRole("button", { name: "Arquivar diagnóstico" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Diagnóstico de \d{2}\/\d{2}\/\d{4} arquivado\./ })).toBeVisible();
  await expect(page.locator('[data-aioson-id="company-timeline"] li[data-status="completed"]')).toHaveCount(1);
  await expect(timelineRow(page, first.id).getByRole("link", { name: /^Comparar/ })).toHaveCount(0);

  // Archived entries stay folded under "Diagnósticos arquivados"
  const archived = page.locator('[data-aioson-id="company-archived-diagnoses"]');
  await expect(archived.locator("summary")).toHaveText("Diagnósticos arquivados (1)");
  await archived.locator("summary").click();
  const restore = timelineRow(page, second.id).getByRole("button", { name: /^Restaurar diagnóstico de/ });
  await restore.click();
  const restoreDialog = page.getByRole("alertdialog", { name: /^Restaurar o diagnóstico de/ });
  await restoreDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(timelineRow(page, second.id)).toHaveAttribute("data-status", "archived");
  await restore.click();
  await restoreDialog.getByRole("button", { name: "Restaurar diagnóstico" }).click();
  await expect(page.getByRole("status").filter({ hasText: /restaurado\./ })).toBeVisible();
  await expect(page.locator('[data-aioson-id="company-timeline"] li[data-status="completed"]')).toHaveCount(2);
  await expect(archived).toHaveCount(0);
});

test("fits 390 px and passes axe on the timeline and on the comparison", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g1);
  const second = await api.seedCompleted(company.id, CASES.g2);
  await api.startDiagnosis(company.id);
  await useMobileViewport(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  await openRoute(page, `/empresa/${company.id}`);
  await expect(page.locator('[data-aioson-id="company-timeline"]')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);

  await openRoute(page, `/comparar/${second.id}`);
  await expect(page.locator('[data-aioson-id="compare"]')).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});
