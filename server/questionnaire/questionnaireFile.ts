import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CALCULATOR_FIELDS,
  NEW_CUSTOMERS_MODE_OPTIONS,
  NEW_CUSTOMERS_RANGE_OPTIONS,
  PURCHASES_PER_YEAR_OPTIONS,
  RELATIONSHIP_LENGTH_OPTIONS,
  SPEND_MODE_OPTIONS,
  SPEND_PART_OPTIONS,
  SPEND_RANGE_OPTIONS,
} from "../../shared/content/calculatorOptions.ts";
import { BLOCKS, QUESTION_BANK } from "../../shared/content/questionBank.ts";

/** Marker and versions of the `.fitpulse` answers file the client saves (IF-004). */
export const ANSWERS_FILE_FORMAT = "fitpulse-answers";
export const ANSWERS_FILE_FORMAT_VERSION = 1;
/** Bumped when a question changes meaning or leaves the catalog: older answers no longer fit. */
export const QUESTIONNAIRE_VERSION = 1;
export const ANSWERS_FILE_EXTENSION = ".fitpulse";

/** Approved notice at the top of the file (PRD, "Conteúdo v2", item 3). */
export const QUESTIONNAIRE_DESKTOP_NOTICE =
  "Feito para abrir no computador. No celular, o formulário pode não funcionar direito. Se estiver no celular, abra este arquivo no computador. Responda tudo de uma vez: se fechar esta página antes de salvar, as respostas se perdem.";

// RULE-ra-11: no request of any kind leaves the page. `img-src data:` is for the brand logo.
const CONTENT_SECURITY_POLICY =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'";

const MAX_SLUG_LENGTH = 60;
const FALLBACK_COMPANY_NAME = "sua empresa";
const LOGO_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export interface QuestionnaireBrand {
  name: string | null;
  /** Phone as it is shown to people, for example "(11) 91234-5678". */
  phone: string | null;
  email: string | null;
  /** `data:image/png|jpeg|webp;base64,…`; any other value is left out of the file. */
  logoDataUrl: string | null;
}

export interface QuestionnaireFileInput {
  /** The only company the file knows: its id (to match the answers on import) and its name. */
  company: { id: string; name: string };
  /** Who delivers the work; `null` when no brand is set. */
  brand: QuestionnaireBrand | null;
  sentAt: Date;
}

export interface QuestionnaireFile {
  html: string;
  /** `{empresa}-questionario-{AAAA-MM-DD}.html` */
  fileName: string;
  /** `respostas-{empresa}.fitpulse`, the name the client's browser saves the answers under. */
  answersFileName: string;
}

interface EmbeddedBrand {
  name: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text === "" ? null : text;
}

function toEmbeddedBrand(brand: QuestionnaireBrand | null): EmbeddedBrand | null {
  if (brand === null) return null;
  const logo = brand.logoDataUrl !== null && LOGO_DATA_URL.test(brand.logoDataUrl) ? brand.logoDataUrl : null;
  const embedded = { name: cleanText(brand.name), phone: cleanText(brand.phone), email: cleanText(brand.email), logo };
  return Object.values(embedded).every((value) => value === null) ? null : embedded;
}

/** Lowercase letters, digits and hyphens only: safe in a file name on every system. */
export function slugifyForFileName(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug === "" ? "empresa" : slug;
}

function formatLocalIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function questionnaireFileName(companyName: string, sentAt: Date): string {
  return `${slugifyForFileName(companyName)}-questionario-${formatLocalIsoDate(sentAt)}.html`;
}

export function answersFileName(companyName: string): string {
  return `respostas-${slugifyForFileName(companyName)}${ANSWERS_FILE_EXTENSION}`;
}

/** The approved message the consultant copies to the client (PRD, "Conteúdo v2", item 3). */
export function buildClientMessage(companyName: string, brandName: string | null): string {
  const message =
    `Olá! Segue o questionário do FitPulse para a ${companyName}. Abra o arquivo no computador ` +
    '(no celular ele pode não funcionar), responda com calma e, no fim, clique em "Salvar minhas respostas". ' +
    "Depois me envie o arquivo que for salvo. Leva uns 12 minutos.";
  const signature = cleanText(brandName);
  return signature === null ? message : `${message}\n${signature}`;
}

/** JSON that can sit inside `<script>`: nothing in it can close the tag or start a comment (\p{Zl} and \p{Zp} are U+2028 and U+2029). */
export function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(
    /[<>&\p{Zl}\p{Zp}]/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function buildEmbeddedData(input: QuestionnaireFileInput, companyName: string) {
  return {
    format: ANSWERS_FILE_FORMAT,
    formatVersion: ANSWERS_FILE_FORMAT_VERSION,
    questionnaireVersion: QUESTIONNAIRE_VERSION,
    company: { id: input.company.id, name: companyName },
    answersFileName: answersFileName(companyName),
    brand: toEmbeddedBrand(input.brand),
    copy: { desktopNotice: QUESTIONNAIRE_DESKTOP_NOTICE },
    blocks: BLOCKS.map(({ number, id, title, intro }) => ({ number, id, title, intro })),
    // The dimension stays out: it only matters to the scoring, not to the person answering.
    questions: QUESTION_BANK.map(({ id, block, text, help, options, unknownLabel }) => ({
      id,
      block,
      text,
      help,
      options,
      unknownLabel,
    })),
    calculator: {
      fields: CALCULATOR_FIELDS,
      spendParts: SPEND_PART_OPTIONS,
      spendModes: SPEND_MODE_OPTIONS,
      spendRanges: SPEND_RANGE_OPTIONS,
      newCustomersModes: NEW_CUSTOMERS_MODE_OPTIONS,
      newCustomersRanges: NEW_CUSTOMERS_RANGE_OPTIONS,
      purchasesPerYear: PURCHASES_PER_YEAR_OPTIONS,
      relationshipLength: RELATIONSHIP_LENGTH_OPTIONS,
    },
  };
}

interface InlineAssets {
  css: string;
  script: string;
}

let cachedAssets: InlineAssets | undefined;

// Read when the first file is built, not on import: other modules import the constants above.
function readInlineAssets(): InlineAssets {
  if (cachedAssets === undefined) {
    const css = readFileSync(fileURLToPath(new URL("./questionnaireStyles.css", import.meta.url)), "utf8");
    const script = readFileSync(fileURLToPath(new URL("./questionnaireClient.js", import.meta.url)), "utf8");
    if (/<\/style/i.test(css)) throw new Error("questionnaireStyles.css would close its own <style> tag.");
    if (/<\/script|<!--/i.test(script)) throw new Error("questionnaireClient.js would close its own <script> tag.");
    cachedAssets = { css, script };
  }
  return cachedAssets;
}

/**
 * One self-contained HTML file for a company: styles, script, catalog and brand are inline and
 * the page makes no request (RULE-ra-11). It carries the company name and id, the real
 * catalog and the brand of whoever delivers; nothing of any other company.
 */
export function buildQuestionnaireFile(input: QuestionnaireFileInput): QuestionnaireFile {
  const companyName = cleanText(input.company.name) ?? FALLBACK_COMPANY_NAME;
  const { css, script } = readInlineAssets();
  const html = [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="noindex">',
    `<title>${escapeHtml(`Questionário de crescimento · ${companyName}`)}</title>`,
    `<style>\n${css}</style>`,
    "</head>",
    "<body>",
    '<main id="app"></main>',
    '<noscript><p class="fallback">Para responder, ative o JavaScript do navegador e abra este arquivo de novo.</p></noscript>',
    `<script type="application/json" id="fitpulse-data">${escapeJsonForHtml(buildEmbeddedData(input, companyName))}</script>`,
    `<script>\n${script}</script>`,
    "</body>",
    "</html>",
    "",
  ].join("\n");
  return { html, fileName: questionnaireFileName(companyName, input.sentAt), answersFileName: answersFileName(companyName) };
}
