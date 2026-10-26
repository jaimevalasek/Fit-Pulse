import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import { extractText } from "unpdf";
import {
  EMPTY_CALCULATOR,
  QUESTION_IDS,
  type AnchorValue,
  type Answers,
  type CalculatorInput,
} from "../../../shared/domain/types";
import { readE2eWorkspace } from "../global-setup";

// ------------------------------------------------------------------ app data

export interface CompanyRecord {
  id: string;
  name: string;
  archivedAt?: string | null;
  draftId?: string | null;
  completedCount: number;
}

export interface DiagnosisRecord {
  id: string;
  companyId: string;
  status: "draft" | "completed";
  createdAt?: string;
  completedAt?: string | null;
}

export interface CompanyInput {
  name: string;
  segment?: string;
  salesChannel?: string;
  annualRevenueRange?: string | null;
  cnpj?: string | null;
}

export interface DiagnosisCase {
  answers: Answers;
  calculator: CalculatorInput;
}

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

// The reference cases G1 to G4 of the PRD (the same inputs as tests/unit/evaluateDiagnosis.test.ts)
export const CASES = {
  // Stage 1, lock "cac", risks SIG-01 (16, high) and SIG-05, plan cac/mp/mm, confidence medium
  g1: {
    answers: answersOf(1, { mp1: null, mp3: null, cm1: null, mm1: null, co1: null }),
    calculator: {
      ...EMPTY_CALCULATOR,
      spendMode: "unknown",
      newCustomersMode: "range",
      newCustomersRange: "from11To30",
      averagePurchaseCents: 4_500,
      purchasesPerYear: "twoToThree",
      relationshipLength: "oneToTwoYears",
      marginPercent: 40,
    },
  },
  // Stage 2, lock "re", risks SIG-04 and SIG-05, plan re/dep/mp, confidence high
  g2: {
    answers: {
      mp1: 2, mp2: 2, mp3: 2, mp4: 2,
      pc1: 3, pc2: 2, pc3: 2,
      cm1: 2, cm2: 2,
      mm1: 2, mm2: 2,
      es1: 1,
      aq1: 3, aq2: 2, aq3: 2,
      en1: 2, en2: 2, en3: 2,
      co1: 2, co2: 2, co3: 2,
      re1: 2, re2: 0, re3: 1,
    },
    calculator: {
      ...EMPTY_CALCULATOR,
      spendMode: "exact",
      spendParts: { ads: 200_000, agency: 100_000, commission: 54_000 },
      newCustomersMode: "exact",
      newCustomers: 59,
      averagePurchaseCents: 4_800,
      purchasesPerYear: "sevenToTwelve",
      relationshipLength: "oneToTwoYears",
      marginPercent: 40,
    },
  },
  // Stage 3, lock "co", no risk, plan co/invest/pc, confidence high
  g3: {
    answers: {
      mp1: 3, mp2: 3, mp3: 2, mp4: 3,
      pc1: 2, pc2: 3, pc3: 2,
      cm1: 3, cm2: 3,
      mm1: 2, mm2: 3,
      es1: 2,
      aq1: 3, aq2: 3, aq3: 2,
      en1: 3, en2: 2, en3: 3,
      co1: 2, co2: 2, co3: 2,
      re1: 3, re2: 2, re3: 3,
    },
    calculator: {
      ...EMPTY_CALCULATOR,
      spendMode: "exact",
      spendParts: { ads: 2_000_000, agency: 400_000 },
      newCustomersMode: "exact",
      newCustomers: 80,
      averagePurchaseCents: 45_000,
      purchasesPerYear: "twoToThree",
      relationshipLength: "twoToFourYears",
      marginPercent: 55,
    },
  },
  // Stage 4 without lock, no risk, plan invest/pc/mp, confidence high
  g4: {
    answers: answersOf(3, { pc1: 2 }),
    calculator: {
      ...EMPTY_CALCULATOR,
      spendMode: "exact",
      spendParts: { ads: 3_000_000 },
      newCustomersMode: "exact",
      newCustomers: 100,
      averagePurchaseCents: 20_000,
      purchasesPerYear: "fourToSix",
      relationshipLength: "twoToFourYears",
      marginPercent: 50,
    },
  },
} satisfies Record<string, DiagnosisCase>;

async function readJson<T>(response: APIResponse): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.url()} answered ${response.status()}: ${await response.text()}`);
  }
  const body = await response.text();
  return (body === "" ? undefined : JSON.parse(body)) as T;
}

/** Seeds and clears data through the app's own HTTP API, the way the screens do. */
export class AppApi {
  constructor(private readonly request: APIRequestContext) {}

  async listCompanies(archived = false): Promise<CompanyRecord[]> {
    return readJson(await this.request.get(`/api/companies?archived=${archived}`));
  }

  /**
   * Every company (and so every diagnosis, action, diary month and questionnaire) is deleted, the
   * brand goes back to FitPulse, the reevaluation interval to 90 days and the tours count as seen.
   */
  async reset(): Promise<void> {
    for (const company of await this.listCompanies(false)) await this.archiveCompany(company.id);
    for (const company of await this.listCompanies(true)) {
      await readJson(await this.request.delete(`/api/companies/${company.id}`));
    }
    await readJson(await this.request.delete("/api/brand"));
    await this.setPreferences({
      usageMode: "consultant",
      focusCompanyId: null,
      theme: "dark",
      tourSeen: { owner: true, consultant: true },
      tourSeenVersion: TOUR_VERSION,
      reevaluationIntervalDays: 90,
    });
  }

  async setPreferences(preferences: Record<string, unknown>): Promise<void> {
    await readJson(await this.request.put("/api/preferences", { data: preferences }));
  }

  async createCompany(input: CompanyInput): Promise<CompanyRecord> {
    return readJson(
      await this.request.post("/api/companies", {
        data: { segment: "food", salesChannel: "storefront", annualRevenueRange: null, cnpj: null, ...input },
      }),
    );
  }

  async getCompany(id: string): Promise<CompanyRecord> {
    return readJson(await this.request.get(`/api/companies/${id}`));
  }

  async archiveCompany(id: string): Promise<void> {
    await readJson(await this.request.post(`/api/companies/${id}/archive`, { data: {} }));
  }

  async startDiagnosis(companyId: string): Promise<DiagnosisRecord> {
    return readJson(await this.request.post(`/api/companies/${companyId}/diagnoses`, { data: {} }));
  }

  async patchDiagnosis(id: string, patch: Record<string, unknown>): Promise<DiagnosisRecord> {
    return readJson(await this.request.patch(`/api/diagnoses/${id}`, { data: patch }));
  }

  async getDiagnosis(id: string): Promise<DiagnosisRecord & { answers: Answers; calculator: CalculatorInput }> {
    return readJson(await this.request.get(`/api/diagnoses/${id}`));
  }

  async completeDiagnosis(id: string): Promise<DiagnosisRecord> {
    return readJson(await this.request.post(`/api/diagnoses/${id}/complete`, { data: {} }));
  }

  async archiveDiagnosis(id: string): Promise<void> {
    await readJson(await this.request.post(`/api/diagnoses/${id}/archive`, { data: {} }));
  }

  /** An open draft with the answers and the calculator of `input` (all blocks complete). */
  async seedDraft(companyId: string, input: DiagnosisCase): Promise<DiagnosisRecord> {
    const draft = await this.startDiagnosis(companyId);
    await this.patchDiagnosis(draft.id, { answers: input.answers, calculator: input.calculator });
    return draft;
  }

  async seedCompleted(companyId: string, input: DiagnosisCase): Promise<DiagnosisRecord> {
    const draft = await this.seedDraft(companyId, input);
    return this.completeDiagnosis(draft.id);
  }

  async getBrand(): Promise<BrandRecord> {
    return readJson(await this.request.get("/api/brand"));
  }

  async setBrand(brand: Partial<Omit<BrandRecord, "hasLogo">>): Promise<BrandRecord> {
    return readJson(
      await this.request.put("/api/brand", { data: { name: null, phone: null, email: null, website: null, ...brand } }),
    );
  }

  async setBrandLogo(mimeType: string, content: Buffer): Promise<BrandRecord> {
    return readJson(await this.request.put("/api/brand/logo", { data: { mimeType, dataBase64: content.toString("base64") } }));
  }

  /** The plan of the company's current diagnosis with the progress of each action (IF-004). */
  async listActions(companyId: string): Promise<ActionsView> {
    return readJson(await this.request.get(`/api/companies/${companyId}/actions`));
  }

  async patchAction(diagnosisId: string, actionKey: string, patch: Record<string, unknown>): Promise<unknown> {
    return readJson(await this.request.patch(`/api/diagnoses/${diagnosisId}/actions/${actionKey}`, { data: patch }));
  }

  /** One month of the diary (IF-005): `YYYY-MM`, new customers and the spend in cents. */
  async addDiaryMonth(companyId: string, entry: { month: string; newCustomers: number; spendParts?: Record<string, number>; spendTotalCents?: number }): Promise<unknown> {
    return readJson(await this.request.post(`/api/companies/${companyId}/diary`, { data: entry }));
  }

  async listDiary(companyId: string): Promise<{ entries: Array<{ month: string }> } & Record<string, unknown>> {
    return readJson(await this.request.get(`/api/companies/${companyId}/diary`));
  }

  async getHome(mode: "owner" | "consultant"): Promise<Record<string, unknown>> {
    return readJson(await this.request.get(`/api/home?mode=${mode}`));
  }

  async exportBackup(): Promise<{ fileName: string; directory: string }> {
    return readJson(await this.request.post("/api/backup/export", { data: {} }));
  }

  async importBackup(backup: unknown): Promise<unknown> {
    return readJson(await this.request.post("/api/backup/import", { data: backup }));
  }

  /** The current data as the backup file "Exportar meus dados" writes. */
  async readBackup(): Promise<BackupFile> {
    const saved = await this.exportBackup();
    return JSON.parse(readFileSync(path.join(saved.directory, saved.fileName), "utf8")) as BackupFile;
  }

  /**
   * Moves a company and its diagnoses `days` into the past. The server stamps every write with the
   * real clock, so the records go out through a backup, come back with older dates, and are
   * imported again (the import keeps ids and dates).
   */
  async backdateCompany(companyId: string, days: number): Promise<void> {
    const backup = await this.readBackup();
    const shift = (iso: string | null) => (iso === null ? null : new Date(Date.parse(iso) - days * DAY_MS).toISOString());
    const shiftDates = <Item extends Record<string, unknown>>(item: Item, keys: string[]) =>
      Object.fromEntries(Object.entries(item).map(([key, value]) => [key, keys.includes(key) ? shift(value as string | null) : value]));
    const companies = backup.companies
      .filter((company) => company.id === companyId)
      .map((company) => shiftDates(company, ["createdAt", "updatedAt", "archivedAt"]));
    const diagnoses = backup.diagnoses
      .filter((diagnosis) => diagnosis.companyId === companyId)
      .map((diagnosis) => shiftDates(diagnosis, ["createdAt", "updatedAt", "completedAt", "archivedAt"]));
    // Version 2 of the file: what hangs on the company goes with it, with the same shift
    const diagnosisIds = new Set(diagnoses.map((diagnosis) => diagnosis.id));
    const actionProgress = (backup.actionProgress ?? [])
      .filter((action) => diagnosisIds.has(action.diagnosisId))
      .map((action) => shiftDates(action, ["createdAt", "updatedAt"]));
    const diaryEntries = (backup.diaryEntries ?? [])
      .filter((entry) => entry.companyId === companyId)
      .map((entry) => shiftDates(entry, ["createdAt", "updatedAt"]));
    const questionnaireSends = (backup.questionnaireSends ?? [])
      .filter((send) => send.companyId === companyId)
      .map((send) => shiftDates(send, ["sentAt", "answeredAt", "clientSavedAt"]));
    const company = await this.getCompany(companyId);
    if (!company.archivedAt) await this.archiveCompany(companyId);
    await readJson(await this.request.delete(`/api/companies/${companyId}`));
    await this.importBackup({ ...backup, companies, diagnoses, actionProgress, diaryEntries, questionnaireSends });
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The presentation tour of part 2 (src/features/home/OnboardingTour.tsx)
const TOUR_VERSION = 2;

export interface BrandRecord {
  name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hasLogo: boolean;
}

export interface ActionProgressRecord {
  diagnosisId: string;
  actionKey: string;
  status: "todo" | "in_progress" | "done" | "not_applicable";
  dueDate: string | null;
  ownerRole: string | null;
  note: string | null;
  overdue: boolean;
  inheritedFrom: { diagnosisId: string; completedAt: string } | null;
}

export interface ActionPlanRecord {
  diagnosisId: string;
  completedAt: string;
  actions: ActionProgressRecord[];
}

/** IF-004: the current plan of the company and the closed ones, newest first. */
export interface ActionsView {
  current: ActionPlanRecord | null;
  closed: ActionPlanRecord[];
}

export interface BackupFile {
  format: string;
  formatVersion: number;
  schemaVersion: number;
  rulesVersion: number;
  companies: Array<Record<string, unknown> & { id: string; name: string }>;
  diagnoses: Array<Record<string, unknown> & { id: string; companyId: string }>;
  // Version 2 (part 2): the brand, the interval and what follows each company
  actionProgress?: Array<Record<string, unknown> & { id: string; diagnosisId: string }>;
  diaryEntries?: Array<Record<string, unknown> & { id: string; companyId: string; month: string }>;
  questionnaireSends?: Array<Record<string, unknown> & { id: string; companyId: string }>;
  [key: string]: unknown;
}

// ------------------------------------------------------------------ fixtures

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function isLocal(url: URL): boolean {
  return LOOPBACK_HOSTS.has(url.hostname) || url.protocol === "data:" || url.protocol === "blob:";
}

interface Fixtures {
  api: AppApi;
  /** URLs the page tried to reach outside 127.0.0.1/localhost; any of them fails the test. */
  externalRequests: string[];
  /** Native alert/confirm/prompt the page opened; any of them fails the test (AC-dm-48). */
  nativeDialogs: string[];
}

export const test = base.extend<Fixtures>({
  nativeDialogs: [
    async ({ page }, use) => {
      const opened: string[] = [];
      page.on("dialog", (dialog) => {
        opened.push(`${dialog.type()}: ${dialog.message()}`);
        void dialog.dismiss();
      });
      await use(opened);
      expect(opened, "native alert/confirm/prompt (AC-dm-48)").toEqual([]);
    },
    { auto: true },
  ],
  // RULE-dm-19, AC-dm-50: the network outside this computer is cut and every attempt is recorded
  externalRequests: [
    async ({ context }, use) => {
      const blocked: string[] = [];
      await context.route(
        (url) => !isLocal(url),
        async (route) => {
          blocked.push(route.request().url());
          await route.abort("internetdisconnected");
        },
      );
      await context.routeWebSocket(
        (url) => !isLocal(url),
        (socket) => {
          blocked.push(socket.url());
          void socket.close();
        },
      );
      await use(blocked);
      expect(blocked, "requests outside 127.0.0.1/localhost (RULE-dm-19)").toEqual([]);
    },
    { auto: true },
  ],
  api: async ({ request }, use) => {
    await use(new AppApi(request));
  },
});

export { expect };

// ------------------------------------------------------------------ helpers

export const e2eWorkspace = readE2eWorkspace();

export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

/** Opens a hash route of the app, e.g. `/empresas`. */
export async function openRoute(page: Page, route: string): Promise<void> {
  await page.goto(`/#${route}`);
}

export async function useMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize(MOBILE_VIEWPORT);
}

export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { overflow, offenders } = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    // The deepest elements that stick out on the right, to say what to fix
    const sticking = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter(
      (element) => element.getBoundingClientRect().right > width + 1 && element.getClientRects().length > 0,
    );
    const deepest = sticking.filter((element) => !sticking.some((other) => other !== element && element.contains(other)));
    return {
      overflow: document.documentElement.scrollWidth - width,
      offenders: deepest.slice(0, 5).map((element) => {
        const id = element.getAttribute("data-aioson-id") ?? element.id;
        return `${element.tagName.toLowerCase()}${id ? `#${id}` : ""}.${element.className.toString().slice(0, 60)} (right ${Math.round(element.getBoundingClientRect().right)})`;
      }),
    };
  });
  expect(overflow, `horizontal scroll at the current width (AC-dm-46): ${offenders.join(" | ")}`).toBeLessThanOrEqual(0);
}

/** axe with the WCAG 2.1 A/AA rules, contrast included (AC-dm-46). */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const violations = results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    targets: violation.nodes.slice(0, 5).map((node) => node.target.join(" ")),
    summary: violation.nodes[0]?.failureSummary?.split("\n").slice(0, 3).join(" "),
  }));
  expect(violations, `axe violations on ${page.url()}`).toEqual([]);
}

// ------------------------------------------------------------------ saved PDFs

/** PDF files in the Downloads folder of the app under test. */
export function pdfFiles(): string[] {
  const dir = e2eWorkspace.downloadsDir;
  return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".pdf")) : [];
}

/**
 * Removes the PDFs earlier specs left in the Downloads folder, so a spec that checks the
 * `{empresa}-{data}.pdf` name and its " (2)" starts from an empty folder.
 */
export function clearSavedPdfs(): void {
  for (const name of pdfFiles()) rmSync(path.join(e2eWorkspace.downloadsDir, name), { force: true });
}

/** The text of each page of a saved PDF, in order, with the white space squashed. */
export async function readPdfPages(fileName: string): Promise<string[]> {
  const content = new Uint8Array(readFileSync(path.join(e2eWorkspace.downloadsDir, fileName)));
  const { text } = await extractText(content);
  return text.map((page) => page.replace(/\s+/g, " ").trim());
}

/**
 * "Abrir PDF" and "Mostrar na pasta" reach the system opener of this computer; the e2e run answers
 * them in the browser instead, so no viewer or file manager opens. The API tests cover the backend.
 */
export async function stubSystemOpener(page: Page, outcome: "ok" | "fail" = "ok"): Promise<string[]> {
  const calls: string[] = [];
  await page.route(/\/api\/files\/[^/]+\/(open|reveal)$/, async (route) => {
    calls.push(new URL(route.request().url()).pathname);
    if (outcome === "ok") {
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "open_failed",
          message: `Não foi possível abrir. O arquivo está em ${e2eWorkspace.downloadsDir}.`,
          details: { directory: e2eWorkspace.downloadsDir },
        },
        requestId: "e2e",
      }),
    });
  });
  return calls;
}

// AC-dm-29, RULE-dm-14: the same list as tests/unit/forbiddenTerms.test.ts
const FORBIDDEN_TERMS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "V1 to V4", pattern: /\bV[1-4]\b/i },
  { label: "Método V4", pattern: /m[ée]todo\s+V4/i },
  { label: "V4 Company", pattern: /V4\s+Company/i },
  { label: "PPA", pattern: /\bPPA\b/i },
  { label: "CREP", pattern: /\bCREP\b/i },
  { label: "vacinas", pattern: /vacina/i },
  { label: "V-Stage", pattern: /V-?Stage/i },
];

export function findForbiddenTerms(text: string): string[] {
  return FORBIDDEN_TERMS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

/** Visible text plus the accessible names hidden in attributes (aria-label, title, alt). */
export async function readScreenText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const attributes = Array.from(document.querySelectorAll("[aria-label], [title], [alt], [placeholder]")).flatMap((element) =>
      ["aria-label", "title", "alt", "placeholder"].map((name) => element.getAttribute(name) ?? ""),
    );
    return [document.title, document.body.innerText, ...attributes].join("\n");
  });
}

export async function expectNoForbiddenTerms(page: Page): Promise<void> {
  expect(findForbiddenTerms(await readScreenText(page)), `forbidden terms on ${page.url()}`).toEqual([]);
}

/** Text that must never reach the screen (AC-dm-51). */
export async function expectNoBrokenNumbers(page: Page): Promise<void> {
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/NaN|Infinity|undefined|null/);
}

/**
 * Resolves when the draft autosave has answered a PATCH after `action`. With `field`, only the
 * PATCH that carries that key counts (a block change saves `currentBlock` on its own).
 */
export async function saveDraftAfter(page: Page, action: () => Promise<unknown>, field?: string): Promise<void> {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      /\/api\/diagnoses\//.test(response.url()) &&
      response.ok() &&
      (field === undefined || (response.request().postData() ?? "").includes(`"${field}"`)),
  );
  await action();
  await saved;
  await expect(page.locator('[data-aioson-id="draft-saved"]')).toHaveAttribute("data-state", "saved");
}

/** Picks an anchor (0 to 3) or "não sei" (null) of a question on the open block. */
export async function answerQuestion(page: Page, questionId: string, value: AnchorValue | null): Promise<void> {
  const option = page
    .locator(`[data-aioson-id="item-${questionId}"]`)
    .locator(`input[type="radio"][value="${value === null ? "unknown" : value}"]`);
  await option.check();
}

/** Block of each question, in the order the questionnaire shows them. */
export const QUESTIONS_BY_BLOCK: Record<number, string[]> = {
  2: ["mp1", "mp2", "mp3", "mp4"],
  3: ["pc1", "pc2", "pc3", "cm1", "cm2"],
  4: ["mm1", "mm2", "es1"],
  5: ["aq1", "aq2", "aq3"],
  6: ["en1", "en2", "en3"],
  7: ["co1", "co2", "co3"],
  8: ["re1", "re2", "re3"],
};
