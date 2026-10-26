import type { Page } from "@playwright/test";
import {
  CASES,
  expect,
  expectNoAxeViolations,
  expectNoHorizontalScroll,
  openRoute,
  test,
  useMobileViewport,
  type AppApi,
} from "./support/fixtures";

// AC-dm-46 and AC-dm-47 on every route, in both themes, at 390 px; with part 2 the report center, the
// actions, the diary and the portfolio report join them (AC-ra-57, AC-ra-58)

const TOUCH = 44;
const TAB_STOPS = 12;

interface RouteCase {
  name: string;
  path: string;
  ready: string;
  mode?: "owner" | "consultant";
}

interface Seed {
  companyId: string;
  latestId: string;
  draftId: string;
  highRiskId: string;
  emptyId: string;
}

async function seed(api: AppApi): Promise<Seed> {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g1);
  const latest = await api.seedCompleted(company.id, CASES.g2);
  const draft = await api.startDiagnosis(company.id);
  const other = await api.createCompany({ name: "Academia Leste com um nome comprido para quebrar a linha" });
  await api.seedCompleted(other.id, CASES.g4);
  // G1 has the high risk (danger badge) and the discovery steps
  const risky = await api.createCompany({ name: "Floricultura Sol" });
  const highRisk = await api.seedCompleted(risky.id, CASES.g1);
  // Part 2: an action with deadline, owner and note, and 3 months of the diary
  await api.patchAction(latest.id, "re", { status: "in_progress", dueDate: "2026-01-10", ownerRole: "sales_team", note: "Ligar para a lista de outubro." });
  await api.addDiaryMonth(company.id, { month: "2026-07", newCustomers: 10, spendTotalCents: 100_000 });
  await api.addDiaryMonth(company.id, { month: "2026-08", newCustomers: 0, spendParts: { ads: 50_000 } });
  await api.addDiaryMonth(company.id, { month: "2026-09", newCustomers: 25, spendParts: { ads: 100_000, tools: 25_000 } });
  return { companyId: company.id, latestId: latest.id, draftId: draft.id, highRiskId: highRisk.id, emptyId: risky.id };
}

function routes({ companyId, latestId, draftId, highRiskId, emptyId }: Seed): RouteCase[] {
  return [
    { name: "início (minha empresa)", path: "/inicio", ready: "home-owner", mode: "owner" },
    { name: "início (consultoria)", path: "/inicio", ready: "home-consultant", mode: "consultant" },
    { name: "empresas", path: "/empresas", ready: "companies-table" },
    { name: "empresa", path: `/empresa/${companyId}`, ready: "company-timeline" },
    { name: "calculadora", path: `/diagnostico/${draftId}?bloco=1`, ready: "calc-output" },
    { name: "perguntas", path: `/diagnostico/${draftId}?bloco=2`, ready: "item-mp1" },
    { name: "resultado", path: `/resultado/${latestId}`, ready: "result" },
    { name: "resultado com risco alto", path: `/resultado/${highRiskId}`, ready: "result" },
    { name: "comparação", path: `/comparar/${latestId}`, ready: "compare" },
    { name: "configurações", path: "/configuracoes", ready: "settings" },
    { name: "relatórios da empresa", path: `/empresa/${companyId}/relatorios`, ready: "report-sheet" },
    { name: "ações", path: `/empresa/${companyId}/acoes`, ready: "actions-list" },
    { name: "diário", path: `/empresa/${companyId}/diario`, ready: "diary-chart" },
    { name: "diário vazio", path: `/empresa/${emptyId}/diario`, ready: "diary-empty" },
    { name: "relatório da carteira", path: "/relatorios/carteira", ready: "report-sheet", mode: "consultant" },
    { name: "boas-vindas", path: "/boas-vindas", ready: "wizard-mode" },
    { name: "boas-vindas: empresa", path: "/boas-vindas/empresa?modo=owner", ready: "wizard-form" },
  ];
}

/** Interactive elements smaller than 44 px that are not inside a 44 px clickable label. */
async function smallTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate((minimum) => {
    const limit = minimum - 0.5;
    const selector =
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
    const px = (value: string) => (value.endsWith("px") ? Number.parseFloat(value) : 0);
    const offenders: string[] = [];
    for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (element.closest('[aria-hidden="true"], [inert]')) continue;
      const style = getComputedStyle(element);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const rect = element.getBoundingClientRect();
      // Screen-reader-only controls (the skip link before it gets focus, the hidden file input)
      if (rect.width <= 1 || rect.height <= 1) continue;
      if (rect.width >= limit && rect.height >= limit) continue;
      // A transparent ::before that enlarges the hit area (the "?" buttons)
      const before = getComputedStyle(element, "::before");
      if (before.content !== "none" && before.position === "absolute") {
        const width = rect.width - px(before.left) - px(before.right);
        const height = rect.height - px(before.top) - px(before.bottom);
        if (width >= limit && height >= limit) continue;
      }
      const label = element.closest("label") ?? (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`) : null);
      if (label) {
        const labelRect = label.getBoundingClientRect();
        if (labelRect.width >= limit && labelRect.height >= limit) continue;
      }
      const name = (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      offenders.push(`${element.tagName.toLowerCase()} "${name}" ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
    return offenders;
  }, TOUCH);
}

/** Tabs through the page: every stop must show an outline or a ring. */
async function focusStopsWithoutIndicator(page: Page): Promise<string[]> {
  const missing: string[] = [];
  await page.locator("body").focus();
  for (let stop = 0; stop < TAB_STOPS; stop += 1) {
    await page.keyboard.press("Tab");
    const result = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      const outline = style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 1;
      const ring = style.boxShadow !== "none";
      const name = (element.getAttribute("aria-label") ?? element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
      return { visible: outline || ring, description: `${element.tagName.toLowerCase()} "${name}"` };
    });
    if (result && !result.visible) missing.push(result.description);
  }
  return missing;
}

async function runningAnimations(page: Page): Promise<number> {
  return page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length);
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

for (const theme of ["dark", "light"] as const) {
  test(`every route at 390 px in the ${theme === "dark" ? "dark" : "light"} theme (AC-ra-57)`, async ({ page, api }) => {
    test.setTimeout(420_000);
    const data = await seed(api);
    await useMobileViewport(page);
    await page.emulateMedia({ reducedMotion: "reduce" });

    const problems: string[] = [];
    for (const route of routes(data)) {
      await test.step(route.name, async () => {
        await api.setPreferences({ theme, usageMode: route.mode ?? "owner", focusCompanyId: data.companyId });
        await openRoute(page, route.path);
        // The preferences are read when the app opens; the same hash twice would not reopen it
        await page.reload();
        await expect(page.locator(`[data-aioson-id="${route.ready}"]`).first()).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

        await expectNoHorizontalScroll(page);
        const small = await smallTouchTargets(page);
        if (small.length > 0) problems.push(`${route.name}: touch targets under 44 px: ${small.join("; ")}`);
        const noFocus = await focusStopsWithoutIndicator(page);
        if (noFocus.length > 0) problems.push(`${route.name}: focus not visible on ${noFocus.join("; ")}`);
        const animations = await runningAnimations(page);
        if (animations > 0) problems.push(`${route.name}: ${animations} animation(s) running with reduced motion`);
        await expectNoAxeViolations(page);
      });
    }
    expect(problems).toEqual([]);
  });
}
