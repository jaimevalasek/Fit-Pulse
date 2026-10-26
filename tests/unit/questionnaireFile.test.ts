import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { allowsUnknown, BLOCKS, QUESTION_BANK } from "../../shared/content/questionBank.ts";
import { maskMoneyInput } from "../../shared/format/money.ts";
import {
  ANSWERS_FILE_FORMAT,
  ANSWERS_FILE_FORMAT_VERSION,
  QUESTIONNAIRE_DESKTOP_NOTICE,
  QUESTIONNAIRE_VERSION,
  answersFileName,
  buildClientMessage,
  buildQuestionnaireFile,
  escapeJsonForHtml,
  questionnaireFileName,
  slugifyForFileName,
  type QuestionnaireBrand,
  type QuestionnaireFileInput,
} from "../../server/questionnaire/questionnaireFile.ts";
import { diagnosisPatchSchema } from "../../server/validation/diagnosisSchemas.ts";

const CLIENT_SCRIPT_PATH = path.resolve("server/questionnaire/questionnaireClient.js");
const STYLES_PATH = path.resolve("server/questionnaire/questionnaireStyles.css");
const EXAMPLE_PATH = path.resolve("test-results/questionario-exemplo.html");
const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAR0lEQVR4nO3OMQ0AIAwAsOnBDyKwgCJkIG0iODaSJhXQmGu0EuUDoZfQubuEkJCQkJCQkJCQkJCQkJCQkJCQkJCQUBdC34USCVtDUzr5TqcAAAAASUVORK5CYII=";
const SENT_AT = new Date(2026, 9, 25);
const BRAND: QuestionnaireBrand = {
  name: "Marina Costa Consultoria",
  phone: "(11) 91234-5678",
  email: "marina@exemplo.com.br",
  logoDataUrl: LOGO,
};

function input(overrides: Partial<QuestionnaireFileInput> = {}): QuestionnaireFileInput {
  return { company: { id: "company-1", name: "Academia Força Total" }, brand: BRAND, sentAt: SENT_AT, ...overrides };
}

interface EmbeddedData {
  format: string;
  formatVersion: number;
  questionnaireVersion: number;
  company: { id: string; name: string };
  answersFileName: string;
  brand: { name: string | null; phone: string | null; email: string | null; logo: string | null } | null;
  copy: { desktopNotice: string };
  blocks: { number: number; id: string; title: string; intro: string }[];
  questions: { id: string; block: number; text: string; help: string; options: { value: number; label: string }[]; unknownLabel: string | null }[];
  calculator: Record<string, unknown> & { fields: Record<string, { label: string; help: string }>; spendParts: { key: string }[] };
}

function embeddedData(html: string): EmbeddedData {
  const match = /<script type="application\/json" id="fitpulse-data">([\s\S]*?)<\/script>/.exec(html);
  if (match?.[1] === undefined) throw new Error("embedded data not found");
  return JSON.parse(match[1]) as EmbeddedData;
}

// The page without its inline script, style and data: what is left must not reference anything.
function staticMarkup(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
}

describe("questionnaire file (AC-ra-49, RULE-ra-11)", () => {
  const { html } = buildQuestionnaireFile(input());

  it("is one document with no URL and no way to reach the network", () => {
    const client = readFileSync(CLIENT_SCRIPT_PATH, "utf8");
    const styles = readFileSync(STYLES_PATH, "utf8");
    expect(html).not.toMatch(/\b(?:https?|wss?|ftp):/i);
    expect(html).not.toMatch(/@import|(?<![A-Za-z])url\(|<link|<iframe|<object|<embed|<form/i);
    expect(client).not.toMatch(/\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts|Worker)\b|\bimport\s*\(/);
    expect(client).not.toMatch(/\b(?:localStorage|sessionStorage|indexedDB|cookie)\b/);
    expect(styles).not.toMatch(/@import|url\(|https?:/i);
    expect(staticMarkup(html)).not.toMatch(/\b(?:src|href|action|srcset|data)\s*=/i);
    expect(html.match(/<script/gi)).toHaveLength(2);
    expect(html.match(/<\/script/gi)).toHaveLength(2);
    expect(html.match(/<style/gi)).toHaveLength(1);
  });

  it("builds the page with textContent only, so no name can become markup", () => {
    const client = readFileSync(CLIENT_SCRIPT_PATH, "utf8");
    expect(client).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\b|new Function/);
  });

  it("carries a CSP that allows inline script and style, data images and nothing else", () => {
    const policy = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1] ?? "";
    expect(policy).toBe(
      "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'",
    );
    expect(policy).not.toMatch(/connect-src|http|\*/);
    expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<script"));
  });

  it("holds the 8 blocks and the 24 questions of the catalog, with help and 'não sei' only where allowed", () => {
    const data = embeddedData(html);
    expect(data.blocks.map((block) => block.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(data.blocks.map((block) => block.title)).toEqual(BLOCKS.map((block) => block.title));
    expect(data.questions).toHaveLength(24);
    for (const [index, question] of data.questions.entries()) {
      const source = QUESTION_BANK[index];
      expect(question).toEqual({
        id: source?.id,
        block: source?.block,
        text: source?.text,
        help: source?.help,
        options: source?.options,
        unknownLabel: source?.unknownLabel,
      });
      expect(question.help).not.toBe("");
      expect(question.options).toHaveLength(4);
      expect(question.unknownLabel !== null).toBe(allowsUnknown(question.id as (typeof QUESTION_BANK)[number]["id"]));
    }
  });

  it("holds the six calculator fields with their copy and options", () => {
    const { calculator } = embeddedData(html);
    expect(Object.keys(calculator.fields)).toEqual(["spend", "newCustomers", "averagePurchase", "purchasesPerYear", "relationshipLength", "margin"]);
    expect(calculator.spendParts.map((part) => part.key)).toEqual(["ads", "agency", "commission", "discount", "salary", "tools"]);
    for (const field of Object.values(calculator.fields)) {
      expect(field.label).not.toBe("");
      expect(field.help).not.toBe("");
    }
  });

  it("shows the approved desktop notice and the approved texts of the screens", () => {
    expect(embeddedData(html).copy.desktopNotice).toBe(QUESTIONNAIRE_DESKTOP_NOTICE);
    expect(QUESTIONNAIRE_DESKTOP_NOTICE).toBe(
      "Feito para abrir no computador. No celular, o formulário pode não funcionar direito. Se estiver no celular, abra este arquivo no computador. Responda tudo de uma vez: se fechar esta página antes de salvar, as respostas se perdem.",
    );
    for (const text of ["Revise e salve", "blocos respondidos", "Salvar minhas respostas", "Respostas salvas", "O arquivo foi para a pasta de downloads deste computador: "]) {
      expect(html).toContain(text);
    }
    expect(readFileSync(STYLES_PATH, "utf8")).toMatch(/@media \(max-width: 700px\), \(pointer: coarse\)/);
  });

  it("names the files by company and date", () => {
    const file = buildQuestionnaireFile(input());
    expect(file.fileName).toBe("academia-forca-total-questionario-2026-10-25.html");
    expect(file.answersFileName).toBe("respostas-academia-forca-total.fitpulse");
    expect(embeddedData(file.html).answersFileName).toBe(file.answersFileName);
    expect(questionnaireFileName("Café & Cia", new Date(2026, 0, 5))).toBe("cafe-cia-questionario-2026-01-05.html");
  });
});

describe("hostile names (output escaping)", () => {
  const separators = String.fromCharCode(0x2028, 0x2029);
  const hostileName = `</script><img src=x onerror=alert(1)><!-- "quote" ${separators} 'apos' &`;
  const hostileBrand: QuestionnaireBrand = { name: "</style><script>alert(2)</script>", phone: "<b>1</b>", email: "a&b@x.com", logoDataUrl: "javascript:alert(3)" };
  const file = buildQuestionnaireFile(input({ company: { id: "c-</script>", name: hostileName }, brand: hostileBrand }));

  it("cannot close the script or start a comment", () => {
    expect(file.html.match(/<\/script/gi)).toHaveLength(2);
    expect(file.html.match(/<script/gi)).toHaveLength(2);
    expect(file.html).not.toContain("<!--");
    expect(file.html).not.toContain("<img");
    const dataBlock = /<script type="application\/json" id="fitpulse-data">([\s\S]*?)<\/script>/.exec(file.html)?.[1] ?? "";
    expect(dataBlock).not.toBe("");
    expect(dataBlock).not.toMatch(new RegExp(`[${separators}]`));
    const title = file.html.slice(file.html.indexOf("<title>") + "<title>".length, file.html.indexOf("</title>"));
    expect(title).not.toMatch(/[<>"']/);
    expect(title).toContain("&#60;/script&#62;");
  });

  it("gives the browser the exact text back", () => {
    const data = embeddedData(file.html);
    expect(data.company).toEqual({ id: "c-</script>", name: hostileName });
    expect(data.brand?.name).toBe("</style><script>alert(2)</script>");
    expect(data.brand?.logo).toBeNull();
  });

  it("keeps the file names to letters, digits and hyphens", () => {
    expect(file.fileName).toMatch(/^[a-z0-9-]+-questionario-2026-10-25\.html$/);
    expect(file.answersFileName).toMatch(/^respostas-[a-z0-9-]+\.fitpulse$/);
    expect(slugifyForFileName("../../Windows/System32/con")).toBe("windows-system32-con");
    expect(slugifyForFileName("   ")).toBe("empresa");
    expect(slugifyForFileName("A".repeat(200))).toHaveLength(60);
    expect(slugifyForFileName("Ação Ñandú Ltda.")).toBe("acao-nandu-ltda");
  });

  it("escapes <, >, & and the line separators in the embedded JSON", () => {
    const escaped = escapeJsonForHtml({ text: `<>&${separators}` });
    expect(escaped).toBe('{"text":"\\u003c\\u003e\\u0026\\u2028\\u2029"}');
    expect(JSON.parse(escaped)).toEqual({ text: `<>&${separators}` });
  });
});

describe("what the file carries (RULE-ra-11)", () => {
  it("knows only its own company and the brand of whoever delivers", () => {
    const first = buildQuestionnaireFile(input({ company: { id: "id-aaa", name: "Padaria Alfa" }, brand: null }));
    const second = buildQuestionnaireFile(input({ company: { id: "id-bbb", name: "Oficina Beta" } }));
    expect(first.html).not.toMatch(/Oficina Beta|id-bbb|Marina Costa/);
    expect(second.html).not.toMatch(/Padaria Alfa|id-aaa/);
    const data = embeddedData(second.html);
    expect(Object.keys(data).sort()).toEqual(
      ["answersFileName", "blocks", "brand", "calculator", "company", "copy", "format", "formatVersion", "questionnaireVersion", "questions"].sort(),
    );
    expect(Object.keys(data.company).sort()).toEqual(["id", "name"]);
    expect(data.format).toBe(ANSWERS_FILE_FORMAT);
    expect(data.formatVersion).toBe(ANSWERS_FILE_FORMAT_VERSION);
    expect(data.questionnaireVersion).toBe(QUESTIONNAIRE_VERSION);
  });

  it("takes the brand with its logo, or none", () => {
    expect(embeddedData(buildQuestionnaireFile(input()).html).brand).toEqual({ name: BRAND.name, phone: BRAND.phone, email: BRAND.email, logo: LOGO });
    expect(embeddedData(buildQuestionnaireFile(input({ brand: null })).html).brand).toBeNull();
    expect(embeddedData(buildQuestionnaireFile(input({ brand: { name: " ", phone: null, email: "", logoDataUrl: null } })).html).brand).toBeNull();
    const svg = "data:image/svg+xml;base64,PHN2Zy8+";
    expect(embeddedData(buildQuestionnaireFile(input({ brand: { ...BRAND, logoDataUrl: svg } })).html).brand?.logo).toBeNull();
  });

  it("writes the approved message for the client", () => {
    expect(buildClientMessage("Academia Força Total", "Marina Costa Consultoria")).toBe(
      'Olá! Segue o questionário do FitPulse para a Academia Força Total. Abra o arquivo no computador (no celular ele pode não funcionar), responda com calma e, no fim, clique em "Salvar minhas respostas". Depois me envie o arquivo que for salvo. Leva uns 12 minutos.\nMarina Costa Consultoria',
    );
    expect(buildClientMessage("Padaria Alfa", null)).not.toContain("\n");
    expect(answersFileName("Padaria Alfa")).toBe("respostas-padaria-alfa.fitpulse");
  });

  it("writes an example file for the owner's Q-10 test", () => {
    const example = buildQuestionnaireFile(input());
    mkdirSync(path.dirname(EXAMPLE_PATH), { recursive: true });
    writeFileSync(EXAMPLE_PATH, example.html, "utf8");
    expect(readFileSync(EXAMPLE_PATH, "utf8")).toBe(example.html);
  });
});

// The script of the page, run without a browser: it hands its pure functions to a test hook.
interface ClientApi {
  maskMoney(raw: string, caret?: number, previous?: string): { value: string; cents: number | null; caret: number };
  readWhole(text: string, max: number): number | null;
  emptyCalculator(): Record<string, unknown>;
  isBlockAnswered(data: EmbeddedData, state: ClientState, block: number): boolean;
  countAnsweredBlocks(data: EmbeddedData, state: ClientState): number;
  buildAnswersFile(data: EmbeddedData, state: ClientState, now: Date): Record<string, unknown>;
  savedInstruction(brand: EmbeddedData["brand"]): string;
}
interface ClientState {
  answers: Record<string, number | null>;
  calc: Record<string, unknown>;
}

function loadClient(): ClientApi {
  let api: ClientApi | undefined;
  vm.runInNewContext(readFileSync(CLIENT_SCRIPT_PATH, "utf8"), {
    __fitpulseQuestionnaireTestHook: (exported: ClientApi) => {
      api = exported;
    },
  });
  if (api === undefined) throw new Error("the client script did not call the test hook");
  return api;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("masks of the calculator (AC-ra-49)", () => {
  const client = loadClient();

  it("masks money like the app does, caret included, over thousands of keystrokes", () => {
    const random = mulberry32(20261025);
    const mismatches: string[] = [];
    for (let round = 0; round < 40; round += 1) {
      let previous = "";
      for (let step = 0; step < 80; step += 1) {
        const position = Math.floor(random() * (previous.length + 1));
        const kind = random();
        let raw: string;
        let caret: number;
        if (kind < 0.55) {
          raw = previous.slice(0, position) + String(Math.floor(random() * 10)) + previous.slice(position);
          caret = position + 1;
        } else if (kind < 0.8 && position > 0) {
          raw = previous.slice(0, position - 1) + previous.slice(position);
          caret = position - 1;
        } else if (kind < 0.9) {
          raw = previous.slice(0, position) + previous.slice(position + 1);
          caret = position;
        } else {
          raw = previous.slice(0, position) + "a" + previous.slice(position);
          caret = position + 1;
        }
        const expected = maskMoneyInput(raw, caret, previous);
        const actual = client.maskMoney(raw, caret, previous);
        if (actual.value !== expected.value || actual.cents !== expected.cents || actual.caret !== expected.caret) {
          mismatches.push(JSON.stringify({ raw, caret, previous, expected, actual }));
        }
        previous = expected.value;
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("matches the app on the plain cases", () => {
    for (const [raw, caret, previous] of [
      ["12", undefined, undefined],
      ["R$ 0,12", 7, "R$ 0,1"],
      ["R$ 1.234,56", undefined, undefined],
      ["R$ 12345678901234", 18, "R$ 99.999.999.999,99"],
      ["R$ 0,0", 6, "R$ 0,00"],
      ["", undefined, "R$ 0,00"],
      ["abc", undefined, undefined],
    ] as const) {
      const expected = maskMoneyInput(raw, caret, previous);
      const actual = client.maskMoney(raw, caret, previous);
      expect({ ...actual }).toEqual({ ...expected });
    }
    expect(client.maskMoney("12").value).toBe("R$ 0,12");
    expect(client.maskMoney("123456").cents).toBe(123456);
  });

  it("keeps whole numbers inside their limits", () => {
    expect(client.readWhole("", 100)).toBeNull();
    expect(client.readWhole("0", 100)).toBe(0);
    expect(client.readWhole("100", 100)).toBe(100);
    expect(client.readWhole("101", 100)).toBeNull();
    expect(client.readWhole("1000000", 1_000_000)).toBe(1_000_000);
    expect(client.readWhole("1000001", 1_000_000)).toBeNull();
  });
});

describe("answers file the client saves (AC-ra-50)", () => {
  const client = loadClient();
  const data = embeddedData(buildQuestionnaireFile(input()).html);
  const savedAt = new Date("2026-10-26T14:30:00.000Z");

  function completeCalculator(): Record<string, unknown> {
    return {
      ...client.emptyCalculator(),
      spendMode: "exact",
      spendParts: { ads: 120000, agency: 50000 },
      newCustomersMode: "exact",
      newCustomers: 40,
      averagePurchaseCents: 15000,
      purchasesPerYear: "fourToSix",
      relationshipLength: "oneToTwoYears",
      marginPercent: 35,
    };
  }

  function allAnswers(): Record<string, number | null> {
    return Object.fromEntries(data.questions.map((question, index) => [question.id, question.unknownLabel !== null && index % 2 === 0 ? null : index % 4]));
  }

  it("counts a block as answered only when all of it is, and 'não sei' counts", () => {
    const state: ClientState = { answers: {}, calc: client.emptyCalculator() };
    expect(client.countAnsweredBlocks(data, state)).toBe(0);
    state.answers = { mp1: null, mp2: 1, mp3: 2 };
    expect(client.isBlockAnswered(data, state, 2)).toBe(false);
    state.answers.mp4 = 3;
    expect(client.isBlockAnswered(data, state, 2)).toBe(true);
    expect(client.countAnsweredBlocks(data, state)).toBe(1);
    state.calc = { ...completeCalculator(), marginPercent: null };
    expect(client.isBlockAnswered(data, state, 1)).toBe(false);
    state.calc = completeCalculator();
    expect(client.isBlockAnswered(data, state, 1)).toBe(true);
    state.answers = allAnswers();
    expect(client.countAnsweredBlocks(data, state)).toBe(8);
  });

  it("produces what the diagnosis PATCH accepts, for all 24 answers and the six numbers", () => {
    const file = JSON.parse(JSON.stringify(client.buildAnswersFile(data, { answers: allAnswers(), calc: completeCalculator() }, savedAt))) as {
      answers: Record<string, unknown>;
      calculator: Record<string, unknown>;
    };
    expect(file).toMatchObject({
      format: "fitpulse-answers",
      formatVersion: ANSWERS_FILE_FORMAT_VERSION,
      questionnaireVersion: QUESTIONNAIRE_VERSION,
      company: { id: "company-1", name: "Academia Força Total" },
      savedAt: "2026-10-26T14:30:00.000Z",
    });
    expect(Object.keys(file.answers)).toHaveLength(24);
    const parsed = diagnosisPatchSchema.safeParse({ answers: file.answers, calculator: file.calculator });
    expect(parsed.success).toBe(true);
    expect(file.calculator).toEqual({
      spendMode: "exact",
      spendParts: { ads: 120000, agency: 50000 },
      newCustomersMode: "exact",
      newCustomers: 40,
      averagePurchaseCents: 15000,
      purchasesPerYear: "fourToSix",
      relationshipLength: "oneToTwoYears",
      marginPercent: 35,
    });
  });

  it("saves with blocks missing, and carries only the values of the mode picked", () => {
    const calc = { ...client.emptyCalculator(), spendMode: "range", spendRange: "from1000To5000", spendParts: { ads: 9900 }, newCustomersMode: "unknown", newCustomers: 7 };
    const file = JSON.parse(JSON.stringify(client.buildAnswersFile(data, { answers: { mp1: 2 }, calc }, savedAt))) as { answers: unknown; calculator: unknown };
    expect(file.answers).toEqual({ mp1: 2 });
    expect(file.calculator).toEqual({ spendMode: "range", spendRange: "from1000To5000", newCustomersMode: "unknown" });
    expect(diagnosisPatchSchema.safeParse({ answers: file.answers, calculator: file.calculator }).success).toBe(true);
    const empty = JSON.parse(JSON.stringify(client.buildAnswersFile(data, { answers: {}, calc: client.emptyCalculator() }, savedAt))) as { answers: unknown; calculator: unknown };
    expect(empty).toMatchObject({ answers: {}, calculator: {} });
  });

  it("tells the client where to send the file, with the brand when there is one", () => {
    const brand = { name: "Marina Costa Consultoria", phone: "(11) 91234-5678", email: "marina@exemplo.com.br", logo: null };
    const tail = ". Ele importa as respostas no FitPulse e revisa com você.";
    expect(client.savedInstruction(brand)).toBe(`Agora envie o arquivo para Marina Costa Consultoria pelo WhatsApp (11) 91234-5678 ou por e-mail para marina@exemplo.com.br${tail}`);
    expect(client.savedInstruction({ ...brand, email: null })).toBe(`Agora envie o arquivo para Marina Costa Consultoria pelo WhatsApp (11) 91234-5678${tail}`);
    expect(client.savedInstruction({ ...brand, phone: null })).toBe(`Agora envie o arquivo para Marina Costa Consultoria por e-mail para marina@exemplo.com.br${tail}`);
    expect(client.savedInstruction(null)).toBe(`Agora envie o arquivo para o seu consultor${tail}`);
  });
});
