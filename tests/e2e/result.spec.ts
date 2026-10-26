import type { Page } from "@playwright/test";
import {
  CASES,
  MOBILE_VIEWPORT,
  e2eWorkspace,
  expect,
  expectNoAxeViolations,
  expectNoForbiddenTerms,
  expectNoHorizontalScroll,
  openRoute,
  pdfFiles,
  clearSavedPdfs,
  readPdfPages,
  stubSystemOpener,
  test,
  useMobileViewport,
  type AppApi,
  type DiagnosisCase,
} from "./support/fixtures";

// CAP-dm-result and the engine on screen: AC-dm-19, AC-dm-21, AC-dm-23, AC-dm-24, AC-dm-27, AC-dm-28,
// AC-dm-29, AC-dm-47, AC-dm-49, AC-dm-46. CAP-ra-polish: AC-ra-23 to AC-ra-25 (the confidence wording,
// the risk labels that never break and "Exportar PDF" at the top of the result)

const DIMENSION_KEYS = ["mp", "pc", "cm", "mm", "aq", "en", "co", "re"];
const GUIDANCE = "Orientação baseada nas suas respostas. Não substitui uma análise financeira.";

async function seedCompleted(api: AppApi, input: DiagnosisCase, name = "Padaria Aurora") {
  const company = await api.createCompany({ name });
  return api.seedCompleted(company.id, input);
}

function result(page: Page) {
  return page.locator('[data-aioson-id="result"]');
}

/** The data-aioson-id regions in document order, to check the layers. */
async function regionOrder(page: Page, ids: string[]): Promise<string[]> {
  return page.evaluate((wanted) => {
    const found = Array.from(document.querySelectorAll<HTMLElement>("[data-aioson-id]"))
      .map((element) => element.dataset.aiosonId ?? "")
      .filter((id) => wanted.includes(id));
    return found.filter((id, index) => found.indexOf(id) === index);
  }, ids);
}

test.beforeEach(async ({ api }) => {
  await api.reset();
  clearSavedPdfs();
});

test("concludes through the gate and shows the layered result within 3 seconds", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const draft = await api.seedDraft(company.id, CASES.g2);
  await openRoute(page, `/diagnostico/${draft.id}?bloco=8`);
  await page.locator('[data-aioson-id="quiz-finish"]').click();
  const confirm = page.getByRole("alertdialog", { name: "Concluir o diagnóstico?" }).getByRole("button", { name: "Concluir e ver resultado" });

  const startedAt = Date.now();
  await confirm.click();
  await expect(result(page)).toBeVisible();
  expect(Date.now() - startedAt, "time from confirming to the result (AC-dm-27)").toBeLessThan(3_000);

  // Top layer: ladder with its accessible description, the lock in the human voice, 3 actions, the guidance
  await expect(page.locator('[data-aioson-id="ladder-steps"]')).toHaveAttribute(
    "aria-label",
    "Estágio 2 de 4: Ajuste. Trava para subir: voltar a vender para quem já comprou.",
  );
  const lock = page.locator('[data-aioson-id="result-trava"] [data-aioson-id="result-lock-phrase"]');
  await expect(lock).toHaveText("Voltar a vender para quem já comprou.");
  expect(await lock.evaluate((element) => getComputedStyle(element).fontStyle)).toBe("italic");
  const actions = page.locator('[data-aioson-id="result-actions"] li');
  await expect(actions).toHaveCount(3);
  expect(await actions.evaluateAll((items) => items.map((item) => item.getAttribute("data-action-key")))).toEqual(["re", "dep", "mp"]);
  // The current plan carries its progress (CAP-ra-action-tracking): title, reason, how to do it and the state
  for (const action of await actions.all()) {
    await expect(action.locator("h3")).not.toBeEmpty();
    await expect(action.locator("> div > p")).toHaveCount(2);
    await expect(action.locator("select")).toHaveValue("todo");
  }
  await expect(page.locator('[data-aioson-id="result-guidance"]')).toContainText(GUIDANCE);

  // Below: fits, fronts, numbers, risks and confidence, in this order
  expect(
    await regionOrder(page, ["escada", "result-trava", "result-actions", "result-guidance", "result-fits", "result-fronts", "result-numbers", "result-risks", "result-confidence"]),
  ).toEqual(["escada", "result-trava", "result-actions", "result-guidance", "result-fits", "result-fronts", "result-numbers", "result-risks", "result-confidence"]);

  // Each dimension says which stage it would sustain; below 50 is flagged (AC-dm-19)
  for (const key of DIMENSION_KEYS) {
    await expect(page.locator(`[data-aioson-id="dim-${key}"]`)).toContainText(/Sustentaria o estágio [1-4]/);
  }
  await expect(page.locator('[data-aioson-id="dim-re"]')).toContainText("33");
  await expect(page.locator('[data-aioson-id="dim-re"]')).toContainText("Abaixo de 50");
  await expect(page.locator('[data-aioson-id="dim-pc"]')).not.toContainText("Abaixo de 50");

  // Each risk with title, cause, probability, impact, score, level and how to reduce it (AC-dm-23)
  const risks = page.locator('[data-aioson-id="result-risks"] li');
  expect(await risks.evaluateAll((items) => items.map((item) => item.getAttribute("data-risk-id")))).toEqual(["SIG-04", "SIG-05"]);
  for (const risk of await risks.all()) {
    await expect(risk).toContainText(/Probabilidade [1-5] de 5/);
    await expect(risk).toContainText(/Impacto [1-5] de 5/);
    await expect(risk).toContainText(/Nota [1-5] × [1-5] = \d+/);
    await expect(risk).toContainText(/Alto|Médio|Baixo/);
    await expect(risk).toContainText("Como reduzir:");
  }

  await expect(page.locator('[data-aioson-id="result-confidence"]')).toHaveAttribute("data-level", "high");
  await expect(page.locator('[data-aioson-id="result-confidence"]')).toContainText("Confiança nos dados: alta");
  await expect(page.locator('[data-aioson-id="result-provisional"]')).toHaveCount(0);

  // RULE-dm-14: no method names, stages by their own names (AC-dm-29)
  await expectNoForbiddenTerms(page);
  await expect(page.getByRole("heading", { name: "Ajuste" }).first()).toBeVisible();
});

test("shows the no-risk state and the last-step lock of a structured company", async ({ page, api }) => {
  const diagnosis = await seedCompleted(api, CASES.g4);
  await openRoute(page, `/resultado/${diagnosis.id}`);
  await expect(result(page)).toBeVisible();
  await expect(page.locator('[data-aioson-id="ladder-steps"]')).toHaveAttribute("aria-label", "Estágio 4 de 4: Estruturação.");
  await expect(page.locator('[data-aioson-id="result-no-risks"]')).toContainText("Nenhum risco encontrado nas suas respostas");
  await expect(page.locator('[data-aioson-id="result-risks"]')).toHaveCount(0);
  expect(
    await page.locator('[data-aioson-id="result-actions"] li').evaluateAll((items) => items.map((item) => item.getAttribute("data-action-key"))),
  ).toEqual(["invest", "pc", "mp"]);
  await expectNoForbiddenTerms(page);
});

test("puts an unmeasured cost in stage 1 with the high risk of score 16 (AC-dm-21)", async ({ page, api }) => {
  const diagnosis = await seedCompleted(api, CASES.g1);
  await openRoute(page, `/resultado/${diagnosis.id}`);
  await expect(page.locator('[data-aioson-id="ladder-steps"]')).toHaveAttribute("aria-label", /^Estágio 1 de 4: Descoberta\./);
  await expect(page.locator('[data-aioson-id="result-lock-phrase"]')).toHaveText("Descobrir quanto custa cada cliente novo.");
  const highRisk = page.locator('[data-aioson-id="result-risks"] li[data-risk-id="SIG-01"]');
  await expect(highRisk).toHaveAttribute("data-level", "high");
  await expect(highRisk).toContainText("Nota 4 × 4 = 16");
  await expect(highRisk).toContainText("Alto · 16");
  // An estimated number of new customers caps the confidence at medium (AC-dm-49)
  await expect(page.locator('[data-aioson-id="result-confidence"]')).toHaveAttribute("data-level", "medium");
  await expect(page.locator('[data-aioson-id="result-confidence"]')).toContainText("Confiança nos dados: média");
  await expect(page.locator("main")).not.toContainText(/NaN|Infinity/);
});

test("calls a low-confidence result provisional", async ({ page, api }) => {
  const lowConfidence: DiagnosisCase = {
    answers: CASES.g1.answers,
    calculator: { ...CASES.g1.calculator, newCustomersMode: "unknown", newCustomersRange: null },
  };
  const diagnosis = await seedCompleted(api, lowConfidence);
  await openRoute(page, `/resultado/${diagnosis.id}`);
  await expect(page.locator('[data-aioson-id="result-confidence"]')).toHaveAttribute("data-level", "low");
  await expect(page.locator('[data-aioson-id="result-confidence"]')).toContainText("Confiança nos dados: baixa");
  await expect(page.locator('[data-aioson-id="result-provisional"]')).toContainText("O resultado é provisório até você medir esses números.");
});

test("shows everything in its final state with reduced motion (AC-dm-47)", async ({ page, api }) => {
  const diagnosis = await seedCompleted(api, CASES.g2);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openRoute(page, `/resultado/${diagnosis.id}`);
  await expect(result(page)).toBeVisible();

  for (const id of ["result-fits", "result-fronts"]) {
    await expect(page.locator(`[data-aioson-id="${id}"] [data-revealed]`).first()).toHaveAttribute("data-revealed", "true");
  }
  const running = await page.evaluate(() =>
    document.getAnimations().filter((animation) => animation.playState === "running").map((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target;
      return `${animation.constructor.name} on ${target instanceof Element ? target.className.toString().slice(0, 60) : "?"}`;
    }),
  );
  expect(running, "animations running with prefers-reduced-motion").toEqual([]);
  // The bars are drawn at their final width, not scaled to zero
  const barScale = await page.locator('[data-aioson-id="dim-mp"] [data-bar]').evaluate((element) => getComputedStyle(element).transform);
  expect(barScale === "none" || barScale === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);
});

test("fits 390 px and passes axe", async ({ page, api }) => {
  const diagnosis = await seedCompleted(api, CASES.g2);
  await useMobileViewport(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openRoute(page, `/resultado/${diagnosis.id}`);
  await expect(result(page)).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});

test('"Exportar PDF" at the top saves the diagnosis report and keeps the message until "Fechar" (AC-ra-25)', async ({ page, api }) => {
  const diagnosis = await seedCompleted(api, CASES.g2);
  const opener = await stubSystemOpener(page);
  await openRoute(page, `/resultado/${diagnosis.id}`);
  await expect(result(page)).toBeVisible();

  // "Relatórios" and "Exportar PDF" in the header, the export as the main button
  const header = page.locator("header").filter({ has: page.locator("#result-title") });
  await expect(header.locator('[data-aioson-id="result-reports"]')).toHaveText("Relatórios");
  const exportButton = header.locator('[data-aioson-id="report-export"]');
  await expect(exportButton).toHaveText("Exportar PDF");
  const before = new Set(pdfFiles());
  await exportButton.click();

  const saved = header.locator('[data-aioson-id="report-pdf-saved"]');
  await expect(saved).toContainText("PDF salvo");
  const [fileName] = pdfFiles().filter((name) => !before.has(name));
  expect(fileName).toMatch(/^Padaria Aurora-\d{4}-\d{2}-\d{2}\.pdf$/);
  await expect(saved).toContainText(`Arquivo ${fileName} na pasta ${e2eWorkspace.downloadsDir}`);
  // The default options: the answers stay out
  const pages = await readPdfPages(fileName);
  expect(pages).toHaveLength(6);
  expect(pages.join(" ")).not.toMatch(/Suas respostas/i);
  await saved.locator('[data-aioson-id="report-open-pdf"]').click();
  await expect.poll(() => opener).toEqual([expect.stringMatching(/^\/api\/files\/[^/]+\/open$/)]);

  // The message stays until the owner closes it
  await page.waitForTimeout(1_500);
  await expect(saved).toBeVisible();
  await header.locator('[data-aioson-id="result-export-close"]').click();
  await expect(saved).toHaveCount(0);
  await expect(exportButton).toHaveText("Exportar PDF");
});

test("the confidence counts the items without the number", async ({ page, api }) => {
  const diagnosis = await seedCompleted(api, CASES.g1);
  await openRoute(page, `/resultado/${diagnosis.id}`);
  // AC-ra-23: always "itens", even for one
  await expect(page.locator('[data-aioson-id="result-confidence"]')).toContainText(/\d+ de 26 itens sem o número/);
  await expect(page.locator('[data-aioson-id="result-confidence"]')).not.toContainText(/\b1 de 26 item\b/);
});

for (const viewport of [{ width: 1280, height: 800 }, MOBILE_VIEWPORT]) {
  test(`the risk labels never break in the middle at ${viewport.width} px`, async ({ page, api }) => {
    const diagnosis = await seedCompleted(api, CASES.g1);
    await page.setViewportSize(viewport);
    await openRoute(page, `/resultado/${diagnosis.id}`);
    const risks = page.locator('[data-aioson-id="result-risks"] li');
    await expect(risks.first()).toBeVisible();
    const broken = await risks.evaluateAll((items) =>
      items.flatMap((item) =>
        Array.from(item.querySelectorAll("span"))
          .filter((span) => /^(Probabilidade \d de 5|Impacto \d de 5|Nota \d × \d = \d+)$/.test((span.textContent ?? "").trim()))
          .filter((span) => {
            const lines = new Set(Array.from(span.getClientRects()).map((rect) => Math.round(rect.top)));
            return lines.size > 1;
          })
          .map((span) => `${item.getAttribute("data-risk-id")}: ${span.textContent}`),
      ),
    );
    expect(broken, "labels split over two lines (AC-ra-24)").toEqual([]);
    // Every risk has the three labels
    for (const risk of await risks.all()) {
      await expect(risk.getByText(/^Probabilidade \d de 5$/)).toBeVisible();
      await expect(risk.getByText(/^Impacto \d de 5$/)).toBeVisible();
      await expect(risk.getByText(/^Nota \d × \d = \d+$/)).toBeVisible();
    }
  });
}
