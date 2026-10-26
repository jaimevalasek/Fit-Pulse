import { CASES, expect, openRoute, test } from "./support/fixtures";

// CAP-dm-settings: AC-dm-38, AC-dm-39

const SAVED = "Salvo neste computador.";

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("switches the usage mode and the focus company at once and keeps them after reopening (AC-ra-62)", async ({ page, api }) => {
  await api.createCompany({ name: "Padaria Aurora" });
  const focus = await api.createCompany({ name: "Academia Leste" });
  await api.seedCompleted(focus.id, CASES.g2);
  await openRoute(page, "/configuracoes");

  const modes = page.getByRole("radiogroup", { name: "Modo de uso" });
  await expect(modes.getByRole("radio", { name: /Consultoria/ })).toBeChecked();
  await expect(page.locator('[data-aioson-id="nav-empresas"]')).toBeVisible();
  await expect(page.locator('[data-aioson-id="mode-chip"]')).toHaveText("Modo consultoria");

  await modes.getByRole("radio", { name: /Minha empresa/ }).check();
  await expect(page.locator('[data-aioson-id="settings-mode"]').getByRole("status").filter({ hasText: SAVED })).toHaveCount(1);
  await expect(page.locator('[data-aioson-id="mode-chip"]')).toHaveText("Modo minha empresa");
  const focusField = page.getByLabel("Empresa em foco", { exact: true });
  await expect(focusField).toHaveValue("");
  await focusField.selectOption(focus.id);
  await expect(page.locator('[data-aioson-id="settings-mode"]').getByRole("status").filter({ hasText: SAVED })).toHaveCount(1);

  // The menu follows at once: "Minha empresa" goes straight to the focus company
  const myCompany = page.locator('[data-aioson-id="nav-minha-empresa"]');
  await expect(myCompany).toHaveText("Minha empresa");
  await expect(myCompany).toHaveAttribute("href", `#/empresa/${focus.id}`);
  await page.locator('[data-aioson-id="nav-inicio"]').click();
  await expect(page.locator('[data-aioson-id="home-owner"]').getByRole("heading", { level: 1, name: "Academia Leste" })).toBeVisible();

  await openRoute(page, "/configuracoes");
  await page.reload();
  await expect(modes.getByRole("radio", { name: /Minha empresa/ })).toBeChecked();
  await expect(focusField).toHaveValue(focus.id);
  const saved = (await (await page.request.get("/api/preferences")).json()) as Record<string, unknown>;
  expect(saved).toMatchObject({ usageMode: "owner", focusCompanyId: focus.id });
});

test("switches the theme at once, from Configurações and from the top bar, and keeps it", async ({ page }) => {
  await openRoute(page, "/configuracoes");
  const themes = page.getByRole("radiogroup", { name: "Tema" });
  await expect(themes.getByRole("radio", { name: /Escuro/ })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkGround = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  await themes.getByRole("radio", { name: /Claro/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('[data-aioson-id="settings-theme"]').getByRole("status")).toHaveText(SAVED);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(darkGround);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(themes.getByRole("radio", { name: /Claro/ })).toBeChecked();

  await page.getByRole("button", { name: "Alternar entre tema escuro e claro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(themes.getByRole("radio", { name: /Escuro/ })).toBeChecked();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("explains how to read the results and lists exactly what the Play assistant reads", async ({ page }) => {
  await openRoute(page, "/configuracoes");
  const guide = page.locator('[data-aioson-id="settings-results"]');
  await expect(guide).toContainText("O diagnóstico é uma orientação baseada nas suas respostas e não substitui uma análise financeira.");
  await expect(guide).toContainText("Cada diagnóstico guarda a versão do cálculo usada nele. Os diagnósticos novos usam a versão 1.");

  const fields = page.locator('[data-aioson-id="settings-assistant-fields"] li');
  await expect(fields).toHaveText([
    "Se o app está funcionando.",
    "De cada empresa ativa: o nome, o estágio, a dimensão que mais trava e a data do último diagnóstico.",
  ]);
  await expect(page.locator('[data-aioson-id="settings-assistant"]')).toContainText(
    "O assistente não vê valores em reais nem as suas respostas, e não cria nem altera diagnósticos.",
  );

  // The two items are the two routes the capability schema exposes (RULE-dm-17)
  const capabilities = JSON.stringify(await (await page.request.get("/api/aioson-play")).json());
  expect(capabilities).toContain("/api/health");
  expect(capabilities).toContain("/api/assistant/summary");
  expect(capabilities.match(/"path":"\/api\//g) ?? []).toHaveLength(2);
});

// CAP-ra-home-followup: AC-ra-34
test("'Lembrete de reavaliação' offers 60 to 180 days, changes the count at once and keeps the choice", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);
  await api.setPreferences({ usageMode: "owner", focusCompanyId: company.id });

  await openRoute(page, "/configuracoes");
  const interval = page.locator('[data-aioson-id="settings-reevaluation-interval"]');
  await expect(page.getByLabel("Refazer o diagnóstico a cada")).toBeVisible();
  await expect(interval.locator("option")).toHaveText(["60 dias", "90 dias (recomendado)", "120 dias", "180 dias"]);
  await expect(interval).toHaveValue("90");

  await interval.selectOption("120");
  await expect(page.getByText(SAVED)).toBeVisible();
  expect(await (await page.request.get("/api/preferences")).json()).toMatchObject({ reevaluationIntervalDays: 120 });

  // The home counts with the new interval right away
  await page.getByRole("navigation", { name: "Principal" }).getByRole("link", { name: "Início" }).click();
  await expect(page.locator('[data-aioson-id="home-reeval-count"]')).toHaveText(/^120 dias\s*até \d{2}\/\d{2}\/\d{4}, a cada 120 dias$/);

  // And after closing and opening the app
  await page.reload();
  await expect(page.locator('[data-aioson-id="home-reeval-interval"]')).toHaveText("a cada 120 dias");
  await openRoute(page, "/configuracoes");
  await expect(page.locator('[data-aioson-id="settings-reevaluation-interval"]')).toHaveValue("120");
});
