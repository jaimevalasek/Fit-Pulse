import type { Page } from "@playwright/test";
import { ACTION_CATALOG } from "../../shared/content/actionCatalog";
import {
  CASES,
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  clearSavedPdfs,
  openRoute,
  test,
  useMobileViewport,
} from "./support/fixtures";

// CAP-dm-home (AC-dm-34, AC-dm-35, AC-dm-46, AC-dm-47) and CAP-ra-home-followup: AC-ra-26 on the
// home, AC-ra-33 (the owner home around "Refazer o diagnóstico"), AC-ra-35 (what needs the
// consultant), AC-ra-36 (every number follows the data) and AC-ra-37 (the 5-step tour)

const DATE = /\d{2}\/\d{2}\/\d{4}/.source;

async function actionKeys(page: Page, listId: string): Promise<(string | null)[]> {
  return page.locator(`[data-aioson-id="${listId}"] > li`).evaluateAll((items) => items.map((item) => item.getAttribute("data-action-key")));
}

async function runningAnimations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.playState === "running")
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target;
        return target instanceof Element ? `${target.tagName} ${target.className.toString().slice(0, 60)}` : "?";
      }),
  );
}

/** `YYYY-MM` of `monthsAgo` months before the current month. */
function monthBefore(monthsAgo: number): string {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function widgetValue(page: Page, widget: string) {
  return page.locator(`[data-aioson-id="${widget}-value"]`);
}

test.beforeEach(async ({ api }) => {
  await api.reset();
  clearSavedPdfs();
});

test("the owner home leads with 'Refazer o diagnóstico', the follow-up widgets and the 3 actions", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g1);
  const latest = await api.seedCompleted(company.id, CASES.g2);
  await api.setPreferences({ usageMode: "owner", focusCompanyId: company.id });
  await openRoute(page, "/inicio");

  const home = page.locator('[data-aioson-id="home-owner"]');
  await expect(home.getByRole("heading", { level: 1, name: "Padaria Aurora" })).toBeVisible();
  await expect(page.locator('[data-aioson-id="home-last-date"]')).toHaveText(new RegExp(`^Estágio 2 de 4 · Ajuste, desde o diagnóstico de ${DATE}$`));

  // The countdown: "N dias até {data}", the Último / Hoje / Próximo line, the interval, the lock, the reminder
  const reevaluation = page.locator('[data-aioson-id="home-reeval"]');
  await expect(reevaluation.getByRole("heading", { name: "Refazer o diagnóstico" })).toBeVisible();
  await expect(page.locator('[data-aioson-id="home-reeval-count"]')).toHaveText(new RegExp(`^90 dias\\s*até ${DATE}, a cada 90 dias$`));
  await expect(page.locator('[data-aioson-id="home-reeval-timeline"]')).toContainText(new RegExp(`Último: ${DATE}.*Hoje: ${DATE}.*Próximo: ${DATE}`));
  await expect(page.locator('[data-aioson-id="home-trava"]')).toContainText("Voltar a vender para quem já comprou.");
  await expect(page.locator('[data-aioson-id="home-reeval-reminder"]')).toContainText("O lembrete aparece aqui no app");

  // The widgets, each opening its tab of the company
  await expect(widgetValue(page, "home-actions-widget")).toHaveText("0 de 3 feitas");
  await expect(page.locator('[data-aioson-id="home-actions-widget-sub"]')).toContainText("0 em andamento · 3 a fazer");
  await expect(widgetValue(page, "home-diary-widget")).toHaveText("sem dados");
  await expect(widgetValue(page, "home-reports-widget")).toHaveText("Nenhum PDF ainda");
  for (const [widget, tab] of [
    ["home-actions-widget", "acoes"],
    ["home-diary-widget", "diario"],
    ["home-reports-widget", "relatorios"],
  ] as const) {
    await expect(page.locator(`[data-aioson-id="${widget}"]`)).toHaveAttribute("href", `#/empresa/${company.id}/${tab}`);
  }

  // "Suas 3 ações": a new action starts "A fazer", without deadline, owner or note (AC-ra-26)
  expect(await actionKeys(page, "home-actions-list")).toEqual(["re", "dep", "mp"]);
  for (const key of ["re", "dep", "mp"]) {
    await expect(page.locator(`[data-aioson-id="status-${latest.id}-${key}"]`)).toHaveValue("todo");
  }
  for (const key of ["re", "dep"]) {
    await expect(page.locator(`[data-aioson-id="action-meta-${latest.id}-${key}"]`)).toHaveText("Sem prazo");
  }
  // "mp" repeats from the first diagnosis, so it carries on from it (AC-ra-31)
  await expect(page.locator(`[data-aioson-id="action-meta-${latest.id}-mp"]`)).toHaveText(new RegExp(`^Continua do diagnóstico de ${DATE}Sem prazo$`));
  await expect(page.locator('[data-aioson-id="home-draft"]')).toHaveCount(0);

  await page.locator('[data-aioson-id="home-compare"]').click();
  await expect(page).toHaveURL(new RegExp(`#/comparar/${latest.id}$`));
  await expect(page.locator('[data-aioson-id="compare"]')).toBeVisible();

  await openRoute(page, "/inicio");
  await page.locator('[data-aioson-id="home-actions-widget"]').click();
  await expect(page).toHaveURL(new RegExp(`#/empresa/${company.id}/acoes$`));
});

test("the owner numbers follow the data: actions, a report, the diary, a draft, a conclusion, the interval", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  const first = await api.seedCompleted(company.id, CASES.g1);
  await api.setPreferences({ usageMode: "owner", focusCompanyId: company.id });

  // An overdue action shows on the widget
  await api.patchAction(first.id, "cac", { dueDate: "2026-01-15" });
  await openRoute(page, "/inicio");
  await expect(page.locator('[data-aioson-id="home-actions-overdue"]')).toHaveText("1 com prazo vencido");
  await expect(page.locator(`[data-aioson-id="action-meta-${first.id}-cac"]`)).toContainText("Vencida em 15/01/2026");

  // Marked "Feita" right on the home, with "Desfazer"; the next opening counts it
  await page.locator(`[data-aioson-id="status-${first.id}-cac"]`).selectOption("done");
  await expect(page.getByText(`"${ACTION_CATALOG.cac.title}" agora está feita.`)).toBeVisible();
  await page.reload();
  await expect(widgetValue(page, "home-actions-widget")).toHaveText("1 de 3 feitas");
  await expect(page.locator('[data-aioson-id="home-actions-overdue"]')).toHaveCount(0);

  // A saved report and a noted month
  const report = await page.request.post(`/api/diagnoses/${first.id}/report`, { data: {} });
  expect(report.status(), await report.text()).toBe(200);
  await api.addDiaryMonth(company.id, { month: monthBefore(1), newCustomers: 20, spendTotalCents: 300_000 });
  await page.reload();
  await expect(widgetValue(page, "home-reports-widget")).toHaveText("PDF salvo");
  await expect(page.locator('[data-aioson-id="home-reports-widget-sub"]')).toContainText(/^Padaria Aurora-\d{4}-\d{2}-\d{2}\.pdf, salvo em /);
  await expect(page.locator('[data-aioson-id="home-diary-widget-sub"]')).toContainText("1 de 3 meses anotados");

  // A draft brings back "Continuar de onde parei"
  const draft = await api.startDiagnosis(company.id);
  await page.reload();
  await expect(page.locator('[data-aioson-id="home-draft"]')).toContainText("em andamento");
  await expect(page.locator('[data-aioson-id="home-new-diag"]')).toHaveCount(0);
  await page.locator('[data-aioson-id="home-continue-draft"]').click();
  await expect(page).toHaveURL(new RegExp(`#/diagnostico/${draft.id}`));

  // Concluding it moves the stage and the plan
  await api.patchDiagnosis(draft.id, { answers: CASES.g4.answers, calculator: CASES.g4.calculator });
  const second = await api.completeDiagnosis(draft.id);
  await openRoute(page, "/inicio");
  await expect(page.locator('[data-aioson-id="home-last-date"]')).toHaveText(new RegExp(`^Estágio 4 de 4 · Estruturação, desde o diagnóstico de ${DATE}$`));
  expect(await actionKeys(page, "home-actions-list")).toEqual(["invest", "pc", "mp"]);
  await expect(page.locator(`[data-aioson-id="status-${second.id}-invest"]`)).toHaveValue("todo");
  await expect(page.locator('[data-aioson-id="home-compare"]')).toBeVisible();

  // Another interval changes the count
  await api.setPreferences({ reevaluationIntervalDays: 60 });
  await page.reload();
  await expect(page.locator('[data-aioson-id="home-reeval-count"]')).toHaveText(new RegExp(`^60 dias\\s*até ${DATE}, a cada 60 dias$`));

  // Archiving the new one brings the previous one back
  await api.archiveDiagnosis(second.id);
  await page.reload();
  await expect(page.locator('[data-aioson-id="home-last-date"]')).toHaveText(new RegExp(`^Estágio 1 de 4 · Descoberta, desde o diagnóstico de ${DATE}$`));
  await expect(page.locator('[data-aioson-id="home-compare"]')).toHaveCount(0);
});

test("owner company without a completed diagnosis is invited to start the first one", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.setPreferences({ usageMode: "owner", focusCompanyId: company.id });
  await openRoute(page, "/inicio");
  const first = page.locator('[data-aioson-id="home-first-diagnosis"]');
  await expect(first).toContainText("Faça o primeiro diagnóstico");
  await expect(page.locator('[data-aioson-id="home-reeval"]')).toHaveCount(0);
  await first.getByRole("button", { name: "Começar o primeiro diagnóstico" }).click();
  await expect(page).toHaveURL(/#\/diagnostico\//);
});

test("consultant mode shows the portfolio by stage and leads each list to the right companies", async ({ page, api }) => {
  const adjust = await api.createCompany({ name: "Academia Leste" });
  await api.seedCompleted(adjust.id, CASES.g2);
  const structured = await api.createCompany({ name: "Bistrô Central" });
  await api.seedCompleted(structured.id, CASES.g4);
  const never = await api.createCompany({ name: "Clínica Vida" });
  const stalled = await api.createCompany({ name: "Doceria Mel" });
  await api.seedDraft(stalled.id, CASES.g2);
  await api.backdateCompany(stalled.id, 10);
  const overdue = await api.createCompany({ name: "Estúdio Forma" });
  await api.seedCompleted(overdue.id, CASES.g3);
  await api.backdateCompany(overdue.id, 120);
  const risky = await api.createCompany({ name: "Floricultura Sol" });
  await api.seedCompleted(risky.id, CASES.g1);
  await api.setPreferences({ usageMode: "consultant" });

  await openRoute(page, "/inicio");
  await expect(page.locator('[data-aioson-id="home-consultant"]').getByRole("heading", { level: 1, name: "Sua carteira" })).toBeVisible();
  const steps = page.locator('[data-aioson-id="escada"] a[data-step]');
  await expect(steps).toHaveCount(4);
  for (const step of [1, 2, 3, 4]) {
    await expect(page.locator(`[data-aioson-id="escada"] a[data-step="${step}"]`)).toHaveAttribute("data-count", "1");
  }
  await expect(page.locator('[data-aioson-id="consult-summary"]')).toContainText("1 em Descoberta, 1 em Ajuste, 1 em Escala e 1 em Estruturação.");

  const stalledList = page.locator('[data-aioson-id="consult-stalled"]');
  await expect(stalledList.locator("li")).toHaveCount(1);
  await expect(stalledList.locator(`li[data-company-id="${stalled.id}"]`)).toContainText("Parado há 10 dias");
  const oldList = page.locator('[data-aioson-id="consult-old"]');
  await expect(oldList.locator(`li[data-company-id="${never.id}"]`)).toContainText("Nunca diagnosticada");
  await expect(oldList.locator(`li[data-company-id="${overdue.id}"]`)).toContainText("Há 120 dias");
  await expect(oldList.locator(`li[data-company-id="${adjust.id}"]`)).toHaveCount(0);
  const riskList = page.locator('[data-aioson-id="consult-risk"]');
  await expect(riskList.locator("li")).toHaveCount(1);
  await expect(riskList.locator(`li[data-company-id="${risky.id}"]`)).toBeVisible();

  // A step opens the list filtered by that stage
  await page.locator('[data-aioson-id="escada"] a[data-step="2"]').click();
  await expect(page).toHaveURL(/#\/empresas\?estagio=2$/);
  await expect(page.locator('[data-aioson-id="companies-table"] tbody tr')).toHaveCount(1);
  await expect(page.locator('[data-aioson-id="companies-table"]')).toContainText("Academia Leste");

  // Each attention list leads to the company it names
  await openRoute(page, "/inicio");
  await stalledList.getByRole("link", { name: "Doceria Mel" }).click();
  await expect(page).toHaveURL(new RegExp(`#/empresa/${stalled.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Doceria Mel" })).toBeVisible();
});

test("'O que precisa de você' follows the data and opens the list filtered by what it counted", async ({ page, api }) => {
  const late = await api.createCompany({ name: "Estúdio Forma" });
  await api.seedCompleted(late.id, CASES.g3);
  await api.backdateCompany(late.id, 100);
  const tracked = await api.createCompany({ name: "Padaria Aurora" });
  const trackedDiagnosis = await api.seedCompleted(tracked.id, CASES.g2);
  await api.patchAction(trackedDiagnosis.id, "re", { dueDate: "2026-01-15" });
  await api.patchAction(trackedDiagnosis.id, "dep", { dueDate: "2026-02-15" });
  await api.setPreferences({ usageMode: "consultant" });

  const indicator = (attention: string) => page.locator(`[data-aioson-id="consult-attention"] a[data-attention="${attention}"]`);
  await openRoute(page, "/inicio");
  await expect(indicator("atrasada")).toHaveAttribute("data-count", "1");
  await expect(indicator("atrasada")).toContainText("Estúdio Forma (há 100 dias)");
  await expect(indicator("vencidas")).toHaveAttribute("data-count", "2");
  await expect(indicator("vencidas")).toContainText("em 1 empresa");
  await expect(indicator("aguardando")).toHaveAttribute("data-count", "0");

  // The indicator opens the companies list with the filter it counted
  await indicator("vencidas").click();
  await expect(page).toHaveURL(/#\/empresas\?atencao=vencidas$/);
  await expect(page.locator('[data-aioson-id="companies-active-filter"]')).toContainText("Filtro ativo:");
  await expect(page.locator('[data-aioson-id="companies-table"] tbody tr')).toHaveCount(1);
  await expect(page.locator('[data-aioson-id="companies-table"]')).toContainText("Padaria Aurora");

  // Done actions leave the count; an empty filter says so and offers "Limpar filtros"
  await api.patchAction(trackedDiagnosis.id, "re", { status: "done" });
  await api.patchAction(trackedDiagnosis.id, "dep", { status: "done" });
  await page.reload();
  await expect(page.getByText("Nenhuma empresa encontrada")).toBeVisible();
  await page.locator('[data-aioson-id="companies-active-filter"]').getByRole("link", { name: "Limpar filtros" }).click();
  await expect(page).toHaveURL(/#\/empresas$/);
  await expect(page.locator('[data-aioson-id="companies-table"] tbody tr')).toHaveCount(2);

  // A longer interval takes the late company out of "Reavaliação atrasada"
  await api.setPreferences({ reevaluationIntervalDays: 120 });
  await openRoute(page, "/inicio");
  await expect(indicator("vencidas")).toHaveAttribute("data-count", "0");
  await expect(indicator("atrasada")).toHaveAttribute("data-count", "0");
  await expect(indicator("atrasada")).toContainText("Nenhuma empresa passou dos 120 dias.");
});

test("consultant mode without companies offers the first one", async ({ page, api }) => {
  await api.setPreferences({ usageMode: "consultant" });
  await openRoute(page, "/inicio");
  const empty = page.locator('[data-aioson-id="home-consult-empty"]');
  await expect(empty).toContainText("Nenhuma empresa cadastrada");
  await empty.getByRole("button", { name: "Cadastrar a primeira empresa" }).click();
  await expect(page.getByRole("alertdialog", { name: "Nova empresa" })).toBeVisible();
});

test("the 5-step tour shows once to a version 1 user, opens each page, and comes back from the '?'", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  // A version 1 user: the old tour seen, the new one not yet
  await api.setPreferences({ usageMode: "owner", focusCompanyId: company.id, tourSeen: { owner: true, consultant: true }, tourSeenVersion: 0 });
  await openRoute(page, "/inicio");

  const card = page.locator('[data-aioson-id="tour-card"]');
  const count = page.locator('[data-aioson-id="tour-count"]');
  const pages = [
    new RegExp(`#/empresa/${company.id}/relatorios$`),
    /#\/configuracoes$/,
    new RegExp(`#/empresa/${company.id}/acoes$`),
    new RegExp(`#/empresa/${company.id}/diario$`),
  ];
  const anchors = new Set<string | null>();
  for (let step = 1; step <= 5; step += 1) {
    await expect(count).toHaveText(`${step} de 5`);
    if (step <= pages.length) await expect(page).toHaveURL(pages[step - 1]);
    await expect(page.locator('[data-aioson-id="tour-highlight"]')).toBeVisible();
    anchors.add(await card.getAttribute("data-tour-step"));
    await page.locator('[data-aioson-id="tour-next"]').click();
  }
  await expect(card).toHaveCount(0);
  expect(anchors.size, "each step highlights its own region").toBe(5);
  await expect.poll(async () => ((await (await page.request.get("/api/preferences")).json()) as { tourSeenVersion: number }).tourSeenVersion).toBe(2);

  // Seen: the home opens without it
  await openRoute(page, "/inicio");
  await page.reload();
  await expect(page.locator('[data-aioson-id="home-owner"]')).toBeVisible();
  await expect(card).toHaveCount(0);

  // The "?" of the top bar reopens it from the first step, and "Pular" closes it
  await page.locator('[data-aioson-id="tour-reopen"]').click();
  await expect(count).toHaveText("1 de 5");
  await expect(page).toHaveURL(pages[0]);
  await page.locator('[data-aioson-id="tour-skip"]').click();
  await expect(card).toHaveCount(0);
});

test("both home screens show their final state with reduced motion, fit 390 px and pass axe", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g1);
  await api.seedCompleted(company.id, CASES.g2);
  await api.startDiagnosis(company.id);
  await useMobileViewport(page);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const usageMode of ["owner", "consultant"] as const) {
    await api.setPreferences({ usageMode, focusCompanyId: company.id });
    await openRoute(page, "/inicio");
    // The preferences are read when the app opens; the same hash twice would not reopen it
    await page.reload();
    await expect(page.locator(`[data-aioson-id="home-${usageMode === "owner" ? "owner" : "consultant"}"]`)).toBeVisible();
    expect(await runningAnimations(page), `animations on the ${usageMode} home`).toEqual([]);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  }
});
