import { readFileSync } from "node:fs";
import path from "node:path";
import {
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  openRoute,
  readScreenText,
  test,
  useMobileViewport,
} from "./support/fixtures";

// CAP-dm-play-runtime: the shell the Play shows in its webview (AC-dm-40, AC-dm-43, AC-dm-50)

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("shows the FitPulse brand, never V-Stage, and asks for no password", async ({ page, api }) => {
  await api.createCompany({ name: "Padaria Aurora" });
  await openRoute(page, "/");

  // With a company registered the root opens the home screen, not the wizard
  await expect(page).toHaveURL(/#\/inicio$/);
  await expect(page).toHaveTitle(/FitPulse/);
  await expect(page.locator('[data-aioson-id="brand"]')).toContainText("FitPulse");
  await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();

  for (const route of ["/inicio", "/empresas", "/configuracoes"]) {
    await openRoute(page, route);
    await expect(page.locator("main h1").first()).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await expect(page.getByLabel(/senha/i)).toHaveCount(0);
    expect(await readScreenText(page)).not.toMatch(/V-?Stage/i);
  }
});

test("renders Inter and JetBrains Mono from the bundled files, with the outside network cut", async ({ page, api }) => {
  await api.createCompany({ name: "Padaria Aurora" });
  await openRoute(page, "/empresas");
  await expect(page.getByRole("heading", { name: "Empresas", level: 1 })).toBeVisible();

  const fonts = await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 16px "Inter"'),
      document.fonts.load('700 16px "Inter"'),
      document.fonts.load('400 16px "JetBrains Mono"'),
    ]);
    await document.fonts.ready;
    const loaded = (family: string) =>
      Array.from(document.fonts).some((face) => face.family.replaceAll('"', "") === family && face.status === "loaded");
    return {
      inter: document.fonts.check('400 16px "Inter"') && loaded("Inter"),
      mono: document.fonts.check('400 16px "JetBrains Mono"') && loaded("JetBrains Mono"),
      bodyFamily: getComputedStyle(document.body).fontFamily,
    };
  });

  expect(fonts.inter, "Inter loaded").toBe(true);
  expect(fonts.mono, "JetBrains Mono loaded").toBe(true);
  expect(fonts.bodyFamily).toMatch(/Inter/);
  // The `externalRequests` fixture fails the test if any request left 127.0.0.1/localhost
});

test("declares no auth service and the FitPulse name in the manifest", () => {
  const manifest = JSON.parse(readFileSync(path.resolve("manifest.json"), "utf8")) as Record<string, unknown>;
  expect(manifest.name).toBe("FitPulse");
  expect(manifest.has_api).toBe(true);
  expect(manifest).not.toHaveProperty("requires_services");
  expect(manifest).not.toHaveProperty("auth");
});

test("fits a 390 px screen and passes axe", async ({ page, api }) => {
  await api.createCompany({ name: "Padaria Aurora" });
  await useMobileViewport(page);
  await openRoute(page, "/empresas");
  await expect(page.getByRole("heading", { name: "Empresas", level: 1 })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
});
