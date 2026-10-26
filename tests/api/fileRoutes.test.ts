import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import type { ChildProcess } from "node:child_process";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { Express } from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../server/app.ts";
import {
  createSystemOpener,
  SystemOpenError,
  type SpawnProcess,
  type SystemOpener,
} from "../../server/files/systemOpener.ts";
import {
  createGeneratedFileRepository,
  type GeneratedFileKind,
  type GeneratedFileRepository,
} from "../../server/repositories/generatedFileRepository.ts";
import { createTestDatabase, type TestDatabase } from "../helpers/testDatabase.ts";

// IF-002: `POST /api/files/:fileId/open` and `/reveal` (AC-ra-18). The system opener is a fake:
// a file the app saved is accepted, an id with no file, a file outside the Downloads folder and a
// path sent by the screen are refused, and a failure of the system answers with the folder.
// The real opener is checked on the command lines it builds for each platform (fake `spawn`).

interface ApiResponse {
  status: number;
  body: unknown;
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

// Declares JSON on every write, as requireJsonWrites demands.
async function callApi(baseUrl: string, method: string, requestPath: string, body?: unknown): Promise<ApiResponse> {
  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text === "" ? null : JSON.parse(text) };
}

const asError = (response: ApiResponse): { code: string; message: string; directory?: string } =>
  (response.body as { error: { code: string; message: string; directory?: string } }).error;

interface OpenerCall {
  action: "open" | "reveal";
  filePath: string;
}

interface FakeOpener extends SystemOpener {
  calls: OpenerCall[];
  /** When set, the next calls fail the way the system does. */
  failWith: Error | null;
}

function createFakeOpener(): FakeOpener {
  const opener: FakeOpener = {
    calls: [],
    failWith: null,
    async openFile(filePath) {
      opener.calls.push({ action: "open", filePath });
      if (opener.failWith) throw opener.failWith;
    },
    async revealFile(filePath) {
      opener.calls.push({ action: "reveal", filePath });
      if (opener.failWith) throw opener.failWith;
    },
  };
  return opener;
}

describe("file routes", () => {
  let db: TestDatabase;
  let server: RunningServer;
  let opener: FakeOpener;
  let repository: GeneratedFileRepository;
  let outsideDir: string;

  const send = (method: string, requestPath: string, body?: unknown) => callApi(server.baseUrl, method, requestPath, body);
  const act = (action: "open" | "reveal", fileId: string, body: unknown = {}) =>
    send("POST", `/api/files/${encodeURIComponent(fileId)}/${action}`, body);

  async function createCompany(name = "Academia Foco"): Promise<string> {
    const response = await send("POST", "/api/companies", { name, segment: "health_wellness", salesChannel: "subscription" });
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  // A PDF the app "saved": the file is on disk and its record points at it.
  async function saveFile(
    companyId: string | null,
    fileName = "Academia Foco-2026-10-23.pdf",
    kind: GeneratedFileKind = "diagnosis_pdf",
  ): Promise<{ id: string; filePath: string }> {
    const filePath = path.join(db.downloadsDir, fileName);
    writeFileSync(filePath, "%PDF-1.7");
    const record = await repository.insert({ companyId, kind, fileName, directory: db.downloadsDir, createdAt: db.now() });
    return { id: record.id, filePath };
  }

  beforeAll(async () => {
    db = await createTestDatabase();
    opener = createFakeOpener();
    repository = createGeneratedFileRepository(db.prisma);
    server = await startServer(createApp({ ...db, systemOpener: opener, backendPort: 4331 }));
    outsideDir = mkdtempSync(path.join(os.tmpdir(), "fitpulse-outside-"));
  });

  afterAll(async () => {
    await server.close();
    await db.dispose();
    rmSync(outsideDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await db.resetData();
    // Files that belong to no company are not removed with the companies.
    await db.prisma.generatedFile.deleteMany();
    // Each test starts with an empty Downloads folder.
    for (const name of readdirSync(db.downloadsDir)) {
      rmSync(path.join(db.downloadsDir, name), { recursive: true, force: true });
    }
    opener.calls.length = 0;
    opener.failWith = null;
  });

  describe.each(["open", "reveal"] as const)("POST /api/files/:fileId/%s", (action) => {
    it("hands the file the app saved to the system and answers 204", async () => {
      const { id, filePath } = await saveFile(await createCompany());

      const response = await act(action, id);

      expect(response.status).toBe(204);
      expect(opener.calls).toEqual([{ action, filePath }]);
    });

    it("also works for a file that belongs to no company", async () => {
      const { id, filePath } = await saveFile(null, "carteira-2026-10-23.pdf", "portfolio_pdf");

      const response = await act(action, id);

      expect(response.status).toBe(204);
      expect(opener.calls).toEqual([{ action, filePath }]);
    });

    it("ignores any path the screen sends and uses the one it saved", async () => {
      const { id, filePath } = await saveFile(await createCompany());

      const response = await act(action, id, {
        path: "C:\\Windows\\System32\\notepad.exe",
        filePath: "/etc/passwd",
        fileName: "../../outro.pdf",
        directory: outsideDir,
      });

      expect(response.status).toBe(204);
      expect(opener.calls).toEqual([{ action, filePath }]);
    });

    it("answers 404 file_not_found for an id nobody saved and opens nothing", async () => {
      const response = await act(action, "not-a-file");

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("file_not_found");
      expect(opener.calls).toEqual([]);
    });

    it("answers 404 for an id too long to be one and for a path as the id", async () => {
      expect((await act(action, "a".repeat(65))).status).toBe(404);
      expect((await act(action, "../../etc/passwd")).status).toBe(404);
      expect((await act(action, "C:\\Windows\\notepad.exe")).status).toBe(404);
      expect(opener.calls).toEqual([]);
    });

    it("answers 404 when the file was deleted from the Downloads folder", async () => {
      const { id, filePath } = await saveFile(await createCompany());
      rmSync(filePath);

      const response = await act(action, id);

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("file_not_found");
      expect(opener.calls).toEqual([]);
    });

    it("answers 404 when the name now belongs to a folder", async () => {
      const { id, filePath } = await saveFile(await createCompany());
      rmSync(filePath);
      mkdirSync(filePath);

      const response = await act(action, id);

      expect(response.status).toBe(404);
      expect(opener.calls).toEqual([]);
    });

    it("refuses a record that points outside the Downloads folder", async () => {
      const company = await createCompany();
      writeFileSync(path.join(outsideDir, "segredo.pdf"), "%PDF-1.7");
      const record = await repository.insert({
        companyId: company,
        kind: "diagnosis_pdf",
        fileName: "segredo.pdf",
        directory: outsideDir,
        createdAt: db.now(),
      });

      const response = await act(action, record.id);

      expect(response.status).toBe(404);
      expect(asError(response).code).toBe("file_not_found");
      expect(opener.calls).toEqual([]);
    });

    it.each(["../fora.pdf", "..\\fora.pdf", "sub/dentro.pdf", path.join(os.tmpdir(), "absoluto.pdf")])(
      "refuses a record whose name is not a plain file name (%j)",
      async (fileName) => {
        const company = await createCompany();
        // Even if the file is really there, a name with a path in it is not one the app writes.
        writeFileSync(path.join(path.dirname(db.downloadsDir), "fora.pdf"), "%PDF-1.7");
        mkdirSync(path.join(db.downloadsDir, "sub"), { recursive: true });
        writeFileSync(path.join(db.downloadsDir, "sub", "dentro.pdf"), "%PDF-1.7");
        const record = await repository.insert({
          companyId: company,
          kind: "diagnosis_pdf",
          fileName,
          directory: db.downloadsDir,
          createdAt: db.now(),
        });

        const response = await act(action, record.id);

        expect(response.status).toBe(404);
        expect(opener.calls).toEqual([]);
      },
    );

    it("answers 500 open_failed with the folder when the system cannot open it", async () => {
      const { id } = await saveFile(await createCompany());
      opener.failWith = new SystemOpenError("explorer.exe could not start");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        const response = await act(action, id);

        expect(response.status).toBe(500);
        expect(asError(response)).toEqual({
          code: "open_failed",
          message: `Não foi possível abrir. O arquivo está em ${db.downloadsDir}.`,
          directory: db.downloadsDir,
        });
      } finally {
        consoleError.mockRestore();
      }
    });

    it("works again once the system can open files", async () => {
      const { id, filePath } = await saveFile(await createCompany());
      opener.failWith = new Error("no default reader");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        expect((await act(action, id)).status).toBe(500);
      } finally {
        consoleError.mockRestore();
      }
      opener.failWith = null;

      expect((await act(action, id)).status).toBe(204);
      expect(opener.calls.at(-1)).toEqual({ action, filePath });
    });

    it("needs a JSON write like every other route", async () => {
      const { id } = await saveFile(await createCompany());

      const response = await fetch(`${server.baseUrl}/api/files/${id}/${action}`, { method: "POST" });

      expect(response.status).toBe(415);
      expect(opener.calls).toEqual([]);
    });
  });

  it("does not open anything with a GET", async () => {
    const { id } = await saveFile(await createCompany());

    expect((await send("GET", `/api/files/${id}/open`)).status).toBe(404);
    expect((await send("GET", `/api/files/${id}/reveal`)).status).toBe(404);
    expect(opener.calls).toEqual([]);
  });

  describe("generated file records", () => {
    it("gives the last report PDF of each company, newest first", async () => {
      const ana = await createCompany("Ana");
      const bia = await createCompany("Bia");
      const at = (iso: string) => new Date(iso);
      const insert = (companyId: string | null, kind: GeneratedFileKind, fileName: string, createdAt: Date) =>
        repository.insert({ companyId, kind, fileName, directory: db.downloadsDir, createdAt });

      await insert(ana, "diagnosis_pdf", "ana-1.pdf", at("2026-10-20T10:00:00Z"));
      const newest = await insert(ana, "evolution_pdf", "ana-evolucao.pdf", at("2026-10-22T10:00:00Z"));
      await insert(ana, "questionnaire_html", "ana-questionario.html", at("2026-10-23T10:00:00Z"));
      await insert(bia, "diagnosis_pdf", "bia-1.pdf", at("2026-10-23T11:00:00Z"));
      await insert(null, "portfolio_pdf", "carteira.pdf", at("2026-10-23T12:00:00Z"));

      expect((await repository.findLatestByCompany(ana))?.id).toBe(newest.id);
      expect((await repository.findLatestByCompany(bia))?.fileName).toBe("bia-1.pdf");
      expect((await repository.findLatestByCompany(ana, ["questionnaire_html"]))?.fileName).toBe("ana-questionario.html");
      expect(await repository.findLatestByCompany("nobody")).toBeNull();
    });

    it("is removed with its company, and a file with no company stays", async () => {
      const company = await createCompany();
      const owned = await saveFile(company, "empresa.pdf");
      const shared = await saveFile(null, "carteira.pdf", "portfolio_pdf");

      await db.prisma.company.delete({ where: { id: company } });

      expect(await repository.findById(owned.id)).toBeNull();
      expect((await repository.findById(shared.id))?.fileName).toBe("carteira.pdf");
    });
  });
});

describe("createSystemOpener", () => {
  interface Launch {
    command: string;
    args: string[];
    windowsVerbatimArguments: boolean | undefined;
    child: EventEmitter & { unref: ReturnType<typeof vi.fn> };
  }

  function fakeSpawn(): { spawnProcess: SpawnProcess; launches: Launch[] } {
    const launches: Launch[] = [];
    const spawnProcess: SpawnProcess = (command, args, options) => {
      const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
      launches.push({ command, args, windowsVerbatimArguments: options.windowsVerbatimArguments, child });
      return child as unknown as ChildProcess;
    };
    return { spawnProcess, launches };
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("on Windows", () => {
    const filePath = "C:\\Users\\Ana Lima\\Downloads\\Academia Foco-2026-10-23.pdf";

    it("opens the file with explorer.exe, the path as one literal argument", async () => {
      const { spawnProcess, launches } = fakeSpawn();
      const pending = createSystemOpener({ platform: "win32", spawnProcess }).openFile(filePath);
      launches[0].child.emit("spawn");

      await expect(pending).resolves.toBeUndefined();
      expect(launches).toHaveLength(1);
      expect(launches[0]).toMatchObject({ command: "explorer.exe", args: [filePath] });
      expect(launches[0].windowsVerbatimArguments).toBeFalsy();
    });

    it("shows the file in its folder with /select, and the path quoted by hand", async () => {
      const { spawnProcess, launches } = fakeSpawn();
      const pending = createSystemOpener({ platform: "win32", spawnProcess }).revealFile(filePath);
      launches[0].child.emit("spawn");

      await expect(pending).resolves.toBeUndefined();
      expect(launches[0]).toMatchObject({
        command: "explorer.exe",
        args: [`/select,"${filePath}"`],
        windowsVerbatimArguments: true,
      });
    });

    it("does not take the exit code of explorer.exe as a failure", async () => {
      const { spawnProcess, launches } = fakeSpawn();
      const pending = createSystemOpener({ platform: "win32", spawnProcess }).openFile(filePath);
      launches[0].child.emit("spawn");
      launches[0].child.emit("exit", 1);

      await expect(pending).resolves.toBeUndefined();
    });

    it("fails when explorer.exe cannot start", async () => {
      const { spawnProcess, launches } = fakeSpawn();
      const pending = createSystemOpener({ platform: "win32", spawnProcess }).openFile(filePath);
      launches[0].child.emit("error", Object.assign(new Error("spawn explorer.exe ENOENT"), { code: "ENOENT" }));

      await expect(pending).rejects.toBeInstanceOf(SystemOpenError);
    });

    it("rejects a path with a quote instead of building a command line from it", async () => {
      const { spawnProcess, launches } = fakeSpawn();

      await expect(
        createSystemOpener({ platform: "win32", spawnProcess }).revealFile('C:\\Downloads\\a" /root,"C:\\x.pdf'),
      ).rejects.toBeInstanceOf(SystemOpenError);
      expect(launches).toEqual([]);
    });

    it("rejects when the program cannot be launched at all", async () => {
      const spawnProcess: SpawnProcess = () => {
        throw new Error("EPERM");
      };

      await expect(createSystemOpener({ platform: "win32", spawnProcess }).openFile(filePath)).rejects.toBeInstanceOf(
        SystemOpenError,
      );
    });
  });

  describe("on macOS", () => {
    const filePath = "/Users/ana/Downloads/Academia Foco-2026-10-23.pdf";

    it("opens the file with open and shows it with open -R", async () => {
      const { spawnProcess, launches } = fakeSpawn();
      const opener = createSystemOpener({ platform: "darwin", spawnProcess });

      const opening = opener.openFile(filePath);
      launches[0].child.emit("exit", 0);
      await opening;
      const revealing = opener.revealFile(filePath);
      launches[1].child.emit("exit", 0);
      await revealing;

      expect(launches.map(({ command, args }) => ({ command, args }))).toEqual([
        { command: "open", args: [filePath] },
        { command: "open", args: ["-R", filePath] },
      ]);
    });

    it("fails when open exits with an error", async () => {
      const { spawnProcess, launches } = fakeSpawn();
      const pending = createSystemOpener({ platform: "darwin", spawnProcess }).openFile(filePath);
      launches[0].child.emit("exit", 1);

      await expect(pending).rejects.toBeInstanceOf(SystemOpenError);
    });

    it("counts a program that is still running after a while as launched", async () => {
      vi.useFakeTimers();
      const { spawnProcess, launches } = fakeSpawn();
      const pending = createSystemOpener({ platform: "darwin", spawnProcess }).openFile(filePath);

      await vi.advanceTimersByTimeAsync(3000);

      await expect(pending).resolves.toBeUndefined();
      expect(launches[0].child.unref).toHaveBeenCalled();
    });
  });

  describe("on Linux", () => {
    const filePath = "/home/ana/Downloads/Academia Foco-2026-10-23.pdf";

    it("opens the file with xdg-open and shows the folder, because xdg-open cannot select a file", async () => {
      const { spawnProcess, launches } = fakeSpawn();
      const opener = createSystemOpener({ platform: "linux", spawnProcess });

      const opening = opener.openFile(filePath);
      launches[0].child.emit("exit", 0);
      await opening;
      const revealing = opener.revealFile(filePath);
      launches[1].child.emit("exit", 0);
      await revealing;

      expect(launches.map(({ command, args }) => ({ command, args }))).toEqual([
        { command: "xdg-open", args: [filePath] },
        { command: "xdg-open", args: ["/home/ana/Downloads"] },
      ]);
    });

    it("fails when xdg-open is not installed", async () => {
      const { spawnProcess, launches } = fakeSpawn();
      const pending = createSystemOpener({ platform: "linux", spawnProcess }).openFile(filePath);
      launches[0].child.emit("error", Object.assign(new Error("spawn xdg-open ENOENT"), { code: "ENOENT" }));

      await expect(pending).rejects.toBeInstanceOf(SystemOpenError);
    });
  });
});
