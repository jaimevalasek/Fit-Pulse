import { readdirSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { deflateSync } from "node:zlib";
import type { Express } from "express";
import { extractText } from "unpdf";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_CALCULATOR, QUESTION_IDS, type AnchorValue, type Answers, type DiagnosisInput } from "../../shared/domain/types.ts";
import type { ReportCoverBlock, ReportDocument } from "../../shared/report/reportDocument.ts";
import { createApp } from "../../server/app.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-003: the brand of whoever delivers the reports. AC-ra-21: the logo is a PNG or a JPEG of up to
// 2 MB and 600 px, told by its bytes and never by its name; anything else is refused with the same
// sentence and changes nothing (RULE-ra-03). AC-ra-22 end to end: what is saved here is what the
// preview and the PDF of the diagnosis print on the cover and in the footer.

interface ApiResponse {
  status: number;
  body: unknown;
  headers: Headers;
}

interface RunningServer {
  baseUrl: string;
  close(): Promise<void>;
}

async function startServer(app: Express): Promise<RunningServer> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

// Mirrors the browser client: every write declares JSON, even the ones without a body. A response
// that is not JSON (the logo bytes) comes back as `null` and is read through `fetchBytes`.
async function callApi(baseUrl: string, method: string, requestPath: string, body?: unknown): Promise<ApiResponse> {
  const isWrite = method !== "GET" && method !== "DELETE";
  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers: isWrite ? { "content-type": "application/json" } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  return { status: response.status, body: isJson && text !== "" ? JSON.parse(text) : null, headers: response.headers };
}

interface BrandBody {
  name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hasLogo: boolean;
  logoUpdatedAt: string | null;
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

const asBrand = (response: ApiResponse): BrandBody => response.body as BrandBody;
const asError = (response: ApiResponse): ErrorBody["error"] => (response.body as ErrorBody).error;

const BLANK_BRAND: BrandBody = { name: null, phone: null, email: null, website: null, hasLogo: false, logoUpdatedAt: null };
const LOGO_REFUSED = "Use uma imagem PNG ou JPG de até 2 MB.";
const MEGABYTE = 1024 * 1024;

const OCTOBER_23 = new Date("2026-10-23T12:00:00.000Z");
const OCTOBER_25 = new Date("2026-10-25T12:00:00.000Z");

// --- Files the logo field can receive, built from bytes so no binary lives in the repo ----------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A PNG pdfkit can decode: every pixel the same opaque teal. */
function solidPng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [0x0f, 0x76, 0x6e]).flat())]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The signature and the size of a real PNG with RGBA pixels whose data is not a zlib stream: kept at upload, never drawable. */
function corruptRgbaPng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", Buffer.from("this is not a zlib stream")),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Only the start of a PNG, enough to be told by its bytes; `size` pads it to a given length. */
function pngHeaderWithSize(width: number, height: number, size = 0): Buffer {
  const header = solidPng(1, 1).subarray(0, 8 + 25);
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return size > header.length ? Buffer.concat([header, Buffer.alloc(size - header.length)]) : header;
}

function uint16(value: number): number[] {
  return [Math.floor(value / 0x100) % 0x100, value % 0x100];
}

/** A JPEG with the segments the signature reader walks: JFIF, a frame header with the size, a scan. */
function jpegWithSize(width: number, height: number): Buffer {
  return Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, ...uint16(16), 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, ...uint16(11), 0x08, ...uint16(height), ...uint16(width), 0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, ...uint16(8), 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0xff, 0xd9,
  ]);
}

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
const TEXT = Buffer.from("Isto é só um texto que alguém renomeou para logo.png");
const GIF = Buffer.from("GIF89a\u0001\u0000\u0001\u0000\u0000\u0000\u0000;", "latin1");

const logoBody = (bytes: Buffer, mimeType = "image/png") => ({ mimeType, dataBase64: bytes.toString("base64") });

// --- A completed diagnosis, to read the brand back from the report -----------------------------

function answersOf(fill: AnchorValue, overrides: Answers = {}): Answers {
  const answers: Answers = {};
  for (const id of QUESTION_IDS) answers[id] = fill;
  return { ...answers, ...overrides };
}

const DIAGNOSIS: DiagnosisInput = {
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
};

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

async function readPdf(filePath: string): Promise<{ file: Buffer; sheets: string[] }> {
  const file = readFileSync(filePath);
  const { text } = await extractText(new Uint8Array(file), { mergePages: false });
  return { file, sheets: text.map(squash) };
}

describe("brand routes", () => {
  let db: TestDatabase;
  let server: RunningServer;

  const send = (method: string, requestPath: string, body?: unknown) => callApi(server.baseUrl, method, requestPath, body);
  const readBrand = async () => asBrand(await send("GET", "/api/brand"));
  const readLogo = async () => {
    const response = await fetch(`${server.baseUrl}/api/brand/logo`);
    return { status: response.status, type: response.headers.get("content-type"), bytes: Buffer.from(await response.arrayBuffer()) };
  };
  const saveLogo = (bytes: Buffer, mimeType?: string) => send("PUT", "/api/brand/logo", logoBody(bytes, mimeType));
  const listDownloads = () => readdirSync(db.downloadsDir).sort();

  beforeAll(async () => {
    db = await createTestDatabase();
    server = await startServer(createApp({ ...db, backendPort: 4331 }));
  });

  afterAll(async () => {
    await server.close();
    await db.dispose();
  });

  beforeEach(async () => {
    await db.resetData();
    db.setNow(OCTOBER_23);
    for (const name of listDownloads()) {
      rmSync(path.join(db.downloadsDir, name), { recursive: true, force: true });
    }
  });

  describe("GET and PUT /api/brand", () => {
    it("answers a blank brand, field by field, before anything is saved", async () => {
      const response = await send("GET", "/api/brand");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(BLANK_BRAND);
      expect((await readLogo()).status).toBe(404);
    });

    it("saves the name and the three contacts, trimmed and the way the report prints them", async () => {
      const response = await send("PUT", "/api/brand", {
        name: "  Consultoria Prumo ",
        phone: "11912345678",
        email: " ola@prumo.com.br ",
        website: "HTTPS://Prumo.com.br/",
      });

      expect(response.status).toBe(200);
      const expected: BrandBody = {
        ...BLANK_BRAND,
        name: "Consultoria Prumo",
        phone: "(11) 91234-5678",
        email: "ola@prumo.com.br",
        website: "prumo.com.br",
      };
      expect(response.body).toEqual(expected);
      expect(await readBrand()).toEqual(expected);
    });

    it("accepts a landline in the mask of 8 digits and keeps it as typed", async () => {
      const response = await send("PUT", "/api/brand", { phone: "(11) 1234-5678" });

      expect(response.status).toBe(200);
      expect(asBrand(response).phone).toBe("(11) 1234-5678");
    });

    it("changes only the keys sent, and clears a field sent as null or blank", async () => {
      await send("PUT", "/api/brand", { name: "Prumo", phone: "(11) 91234-5678", email: "ola@prumo.com.br", website: "prumo.com.br" });

      const renamed = await send("PUT", "/api/brand", { name: "Prumo Consultoria" });
      expect(asBrand(renamed)).toMatchObject({ name: "Prumo Consultoria", phone: "(11) 91234-5678", email: "ola@prumo.com.br" });

      const cleared = await send("PUT", "/api/brand", { phone: null, email: "   ", website: "" });
      expect(asBrand(cleared)).toEqual({ ...BLANK_BRAND, name: "Prumo Consultoria" });
    });

    it("answers each invalid field with its own sentence and saves nothing, even the valid ones", async () => {
      await send("PUT", "/api/brand", { name: "Prumo" });
      const before = await readBrand();

      const response = await send("PUT", "/api/brand", {
        name: "Outra marca",
        phone: "12345",
        email: "isto-nao-e-email",
        website: "javascript:alert(1)",
      });

      expect(response.status).toBe(400);
      expect(asError(response)).toMatchObject({
        code: "validation_failed",
        fields: {
          phone: "Telefone inválido. Use (11) 91234-5678.",
          email: "E-mail inválido. Use nome@empresa.com.br.",
          website: "Site inválido. Use empresa.com.br.",
        },
      });
      expect(await readBrand()).toEqual(before);
    });

    it("refuses a name past 80 characters or on more than one line", async () => {
      const tooLong = await send("PUT", "/api/brand", { name: "A".repeat(81) });
      expect(tooLong.status).toBe(400);
      expect(asError(tooLong).fields).toEqual({ name: "O nome pode ter até 80 caracteres." });

      const twoLines = await send("PUT", "/api/brand", { name: "Prumo\nConsultoria" });
      expect(twoLines.status).toBe(400);
      expect(asError(twoLines).fields).toEqual({ name: "O nome precisa caber em uma linha." });

      const exactly80 = await send("PUT", "/api/brand", { name: "A".repeat(80) });
      expect(exactly80.status).toBe(200);
      expect(await readBrand()).toEqual({ ...BLANK_BRAND, name: "A".repeat(80) });
    });

    it("keeps the 16 KB limit of its own fields", async () => {
      const response = await send("PUT", "/api/brand", { name: "Prumo", website: `prumo.com.br/${"a".repeat(20_000)}` });

      expect(response.status).toBe(413);
      expect(asError(response).code).toBe("payload_too_large");
      expect(await readBrand()).toEqual(BLANK_BRAND);
    });
  });

  describe("PUT /api/brand/logo (AC-ra-21)", () => {
    it("keeps a PNG and answers it back with its type", async () => {
      const png = solidPng(40, 20);

      const response = await saveLogo(png);

      expect(response.status).toBe(200);
      expect(asBrand(response)).toMatchObject({ hasLogo: true, logoUpdatedAt: OCTOBER_23.toISOString() });
      const logo = await readLogo();
      expect(logo.status).toBe(200);
      expect(logo.type).toBe("image/png");
      expect(logo.bytes.equals(png)).toBe(true);
    });

    it("keeps a JPEG too, and the type it answers is the one found in its bytes", async () => {
      const jpeg = jpegWithSize(300, 200);

      // The declared type only has to be one of the two; the bytes decide which one it is.
      const response = await saveLogo(jpeg, "image/png");

      expect(response.status).toBe(200);
      const logo = await readLogo();
      expect(logo.type).toBe("image/jpeg");
      expect(logo.bytes.equals(jpeg)).toBe(true);
    });

    it("serves the logo so that the browser never guesses its type or keeps a stale copy", async () => {
      await saveLogo(solidPng(10, 10));

      const response = await fetch(`${server.baseUrl}/api/brand/logo`);

      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("cache-control")).toBe("no-cache");
    });

    it("takes a logo at the limits: 600 px on the longer side and exactly 2 MB", async () => {
      expect((await saveLogo(pngHeaderWithSize(600, 600))).status).toBe(200);
      expect((await saveLogo(jpegWithSize(600, 120))).status).toBe(200);

      const twoMegabytes = pngHeaderWithSize(600, 600, 2 * MEGABYTE);
      const response = await saveLogo(twoMegabytes);

      expect(response.status).toBe(200);
      expect((await readLogo()).bytes.length).toBe(2 * MEGABYTE);
    });

    it("takes a logo whose text is larger than the 1 MB of the other routes", async () => {
      // 1.5 MB of bytes are 2 MB of base64 text: only the parser of this router lets it through.
      const response = await saveLogo(pngHeaderWithSize(300, 300, 1.5 * MEGABYTE));

      expect(response.status).toBe(200);
      expect(asBrand(response).hasLogo).toBe(true);
    });

    it("leaves the 1 MB limit on every other route", async () => {
      const response = await send("POST", "/api/companies", { name: "a".repeat(2 * MEGABYTE), segment: "health_wellness", salesChannel: "subscription" });

      expect(response.status).toBe(413);
      expect(asError(response).code).toBe("payload_too_large");
    });

    describe("refuses with the same sentence and changes nothing", () => {
      const refusals: Array<[string, () => { bytes: Buffer; mimeType: string }]> = [
        ["an SVG that says it is an SVG", () => ({ bytes: SVG, mimeType: "image/svg+xml" })],
        ["an SVG renamed to .png", () => ({ bytes: SVG, mimeType: "image/png" })],
        ["a text renamed to .png", () => ({ bytes: TEXT, mimeType: "image/png" })],
        ["a GIF renamed to .jpg", () => ({ bytes: GIF, mimeType: "image/jpeg" })],
        ["a PNG that says it is an SVG", () => ({ bytes: solidPng(10, 10), mimeType: "image/svg+xml" })],
        ["a PNG cut short", () => ({ bytes: solidPng(10, 10).subarray(0, 20), mimeType: "image/png" })],
        ["a file of 2 MB and one byte", () => ({ bytes: pngHeaderWithSize(100, 100, 2 * MEGABYTE + 1), mimeType: "image/png" })],
      ];

      it.each(refusals)("%s", async (_name, build) => {
        const original = solidPng(30, 30);
        await saveLogo(original);
        const before = await readBrand();
        const { bytes, mimeType } = build();

        const response = await saveLogo(bytes, mimeType);

        expect(response.status).toBe(422);
        expect(asError(response)).toMatchObject({ code: "logo_invalid", message: LOGO_REFUSED });
        expect(await readBrand()).toEqual(before);
        expect((await readLogo()).bytes.equals(original)).toBe(true);
      });

      it("a file of 3 MB, which does not even fit the body of the request", async () => {
        const original = solidPng(30, 30);
        await saveLogo(original);
        const before = await readBrand();

        const response = await saveLogo(pngHeaderWithSize(100, 100, 3 * MEGABYTE));

        expect(response.status).toBe(413);
        expect(asError(response)).toMatchObject({ code: "payload_too_large", message: LOGO_REFUSED });
        expect(await readBrand()).toEqual(before);
        expect((await readLogo()).bytes.equals(original)).toBe(true);
      });

      it("a text that is not base64", async () => {
        const response = await send("PUT", "/api/brand/logo", { mimeType: "image/png", dataBase64: "isto não é base64!" });

        expect(response.status).toBe(422);
        expect(asError(response)).toMatchObject({ code: "logo_invalid", message: LOGO_REFUSED });
        expect(await readBrand()).toEqual(BLANK_BRAND);
      });

      it("a body without the image, or with an empty one", async () => {
        for (const body of [{ mimeType: "image/png" }, logoBody(Buffer.alloc(0))]) {
          const response = await send("PUT", "/api/brand/logo", body);

          expect(response.status).toBe(400);
          expect(asError(response).code).toBe("validation_failed");
        }
        expect(await readBrand()).toEqual(BLANK_BRAND);
      });

      it("a PNG or a JPEG past 600 px on the longer side, which the screen shrinks before sending", async () => {
        for (const bytes of [pngHeaderWithSize(1200, 300), pngHeaderWithSize(300, 601), jpegWithSize(1200, 800)]) {
          const response = await saveLogo(bytes);

          expect(response.status).toBe(422);
          expect(asError(response)).toMatchObject({
            code: "logo_invalid",
            message: "A logo deve ter no máximo 600 px no lado maior.",
          });
        }
        expect(await readBrand()).toEqual(BLANK_BRAND);
      });
    });

    it("replaces the logo with the next one and moves the time of the change", async () => {
      await saveLogo(solidPng(10, 10));
      db.setNow(OCTOBER_25);
      const next = jpegWithSize(80, 40);

      const response = await saveLogo(next);

      expect(asBrand(response).logoUpdatedAt).toBe(OCTOBER_25.toISOString());
      expect((await readLogo()).bytes.equals(next)).toBe(true);
    });
  });

  describe("DELETE /api/brand/logo and DELETE /api/brand", () => {
    it("removes only the logo and leaves the name and the contacts", async () => {
      await send("PUT", "/api/brand", { name: "Prumo", email: "ola@prumo.com.br" });
      await saveLogo(solidPng(10, 10));

      const response = await send("DELETE", "/api/brand/logo");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ...BLANK_BRAND, name: "Prumo", email: "ola@prumo.com.br" });
      const logo = await readLogo();
      expect(logo.status).toBe(404);
    });

    it("answers 404 logo_not_found for a logo that was never sent", async () => {
      const response = await send("GET", "/api/brand/logo");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("logo_not_found");
    });

    it("goes back to the FitPulse brand: name, contacts and logo are all forgotten", async () => {
      await send("PUT", "/api/brand", { name: "Prumo", phone: "(11) 91234-5678", email: "ola@prumo.com.br", website: "prumo.com.br" });
      await saveLogo(solidPng(10, 10));

      const response = await send("DELETE", "/api/brand");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(BLANK_BRAND);
      expect(await db.prisma.preference.count({ where: { key: { startsWith: "brand." } } })).toBe(0);
    });

    it("does not touch the other preferences of the app", async () => {
      await send("PUT", "/api/preferences", { theme: "light" });
      await send("PUT", "/api/brand", { name: "Prumo" });
      await saveLogo(solidPng(10, 10));

      await send("DELETE", "/api/brand");

      expect(((await send("GET", "/api/preferences")).body as { theme: string }).theme).toBe("light");
    });

    it("keeps the logo out of the preferences the screens read", async () => {
      await saveLogo(solidPng(10, 10));

      const preferences = await send("GET", "/api/preferences");

      expect(JSON.stringify(preferences.body)).not.toContain("brand");
    });
  });

  describe("the brand on the reports (AC-ra-22)", () => {
    async function concludeDiagnosis(): Promise<string> {
      const company = await send("POST", "/api/companies", { name: "Academia Foco", segment: "health_wellness", salesChannel: "subscription" });
      expect(company.status).toBe(201);
      const companyId = (company.body as { id: string }).id;
      const draft = await send("POST", `/api/companies/${companyId}/diagnoses`);
      expect([200, 201]).toContain(draft.status);
      const diagnosisId = (draft.body as { id: string }).id;
      expect((await send("PATCH", `/api/diagnoses/${diagnosisId}`, DIAGNOSIS)).status).toBe(200);
      expect((await send("POST", `/api/diagnoses/${diagnosisId}/complete`)).status).toBe(200);
      return diagnosisId;
    }

    async function exportPdf(diagnosisId: string) {
      const response = await send("POST", `/api/diagnoses/${diagnosisId}/report`);
      expect(response.status).toBe(200);
      const { fileName } = response.body as { fileName: string };
      return readPdf(path.join(db.downloadsDir, fileName));
    }

    const coverOf = (document: ReportDocument): ReportCoverBlock => {
      const cover = document.pages[0]?.blocks.find((block): block is ReportCoverBlock => block.kind === "cover");
      if (cover === undefined) throw new Error("The document has no cover.");
      return cover;
    };

    it("prints the name, the contact and the logo on the cover and the name and the contact in the footer", async () => {
      const diagnosisId = await concludeDiagnosis();
      await send("PUT", "/api/brand", { name: "Consultoria Prumo", phone: "(11) 91234-5678", email: "ola@prumo.com.br", website: "prumo.com.br" });
      await saveLogo(solidPng(120, 60));

      const { file, sheets } = await exportPdf(diagnosisId);

      expect(sheets[0]).toContain("Consultoria Prumo");
      expect(sheets[0]).toContain("(11) 91234-5678 · ola@prumo.com.br · prumo.com.br");
      expect(sheets[0]).toContain("Preparado por Consultoria Prumo com o FitPulse");
      expect(file.toString("latin1")).toContain("/Subtype /Image");
      for (const [index, sheet] of sheets.entries()) {
        expect(sheet, `sheet ${index + 1}`).toContain("Consultoria Prumo · Diagnóstico de maturidade");
        expect(sheet, `sheet ${index + 1}`).toContain("(11) 91234-5678 · ola@prumo.com.br · prumo.com.br");
      }
    });

    it("shows the same brand in the preview, with the logo as an image the sheet can draw", async () => {
      const diagnosisId = await concludeDiagnosis();
      await send("PUT", "/api/brand", { name: "Consultoria Prumo", email: "ola@prumo.com.br" });
      const png = solidPng(50, 50);
      await saveLogo(png);

      const response = await send("GET", `/api/reports/preview?kind=diagnosis&diagnosisId=${diagnosisId}`);

      expect(response.status).toBe(200);
      const cover = coverOf(response.body as ReportDocument);
      expect(cover.brand).toEqual({
        name: "Consultoria Prumo",
        custom: true,
        phone: null,
        email: "ola@prumo.com.br",
        site: null,
        logoDataUrl: `data:image/png;base64,${png.toString("base64")}`,
      });
      expect(cover.contactLine).toBe("ola@prumo.com.br");
    });

    it("prints the FitPulse brand, with no logo and no contact, while the brand is blank", async () => {
      const diagnosisId = await concludeDiagnosis();

      const { file, sheets } = await exportPdf(diagnosisId);

      expect(sheets[0]).toContain("Gerado com o FitPulse");
      expect(file.toString("latin1")).not.toContain("/Subtype /Image");
      for (const sheet of sheets) expect(sheet).toContain("FitPulse · Diagnóstico de maturidade");
    });

    it("goes back to FitPulse on the next report once the brand is reset, and keeps the file already saved", async () => {
      const diagnosisId = await concludeDiagnosis();
      await send("PUT", "/api/brand", { name: "Consultoria Prumo" });
      await saveLogo(solidPng(30, 30));
      const first = await exportPdf(diagnosisId);

      await send("DELETE", "/api/brand");
      const second = await exportPdf(diagnosisId);

      expect(first.sheets[0]).toContain("Consultoria Prumo");
      expect(second.sheets[0]).toContain("Gerado com o FitPulse");
      expect(second.sheets[0]).not.toContain("Consultoria Prumo");
      expect(second.file.toString("latin1")).not.toContain("/Subtype /Image");
      expect(listDownloads()).toHaveLength(2);
    });

    it.each([
      ["a PNG cut short", () => pngHeaderWithSize(40, 40)],
      ["a PNG whose pixels are corrupt, which pdfkit would only notice after the export had started", () => corruptRgbaPng(4, 4)],
    ])("keeps the cover with the name and exports the report when the stored logo is %s", async (_name, build) => {
      const diagnosisId = await concludeDiagnosis();
      await send("PUT", "/api/brand", { name: "Consultoria Prumo" });
      // The upload only reads the signature and the size, so these are kept; the export has to cope with them.
      expect((await saveLogo(build())).status).toBe(200);

      const { file, sheets } = await exportPdf(diagnosisId);

      expect(sheets[0]).toContain("Consultoria Prumo");
      expect(file.toString("latin1")).not.toContain("/Subtype /Image");
      // and the server is still there for the next one
      expect((await send("GET", "/api/brand")).status).toBe(200);
    });

    it("refuses a report of a diagnosis that does not exist before it reads the brand", async () => {
      await send("PUT", "/api/brand", { name: "Consultoria Prumo" });

      const response = await send("GET", "/api/reports/preview?kind=diagnosis&diagnosisId=nao-existe");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("diagnosis_not_found");
    });
  });
});
