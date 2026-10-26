import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import path from "node:path";

/** The computer could not open the file or the folder; `cause` has the operating system error. */
export class SystemOpenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SystemOpenError";
  }
}

/** Opens a file the app saved with the program the computer chose for it, or shows it in its folder. */
export interface SystemOpener {
  /** Opens the file in the default reader. Rejects with `SystemOpenError` when the system cannot. */
  openFile(filePath: string): Promise<void>;
  /** Opens the folder with the file selected (the folder alone on Linux). Rejects with `SystemOpenError`. */
  revealFile(filePath: string): Promise<void>;
}

export type SpawnProcess = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export interface SystemOpenerOptions {
  platform?: NodeJS.Platform;
  /** Starts a program; tests swap it for a fake. */
  spawnProcess?: SpawnProcess;
}

// How long `open` / `xdg-open` may run before the launch counts as done. They hand the file to
// the program that shows it and exit at once; a slow one has started and is left alone.
const EXIT_WAIT_MS = 3000;

interface Launch {
  command: string;
  args: string[];
  /** Windows needs the argument of `/select,` quoted by hand; Node would quote it as a whole. */
  verbatimArguments?: boolean;
  /** `explorer.exe` exits with 1 even when it worked, so only a failure to start counts for it. */
  exitCodeMeansFailure: boolean;
}

function windowsLaunch(action: "open" | "reveal", filePath: string): Launch {
  if (action === "open") {
    return { command: "explorer.exe", args: [filePath], exitCodeMeansFailure: false };
  }
  // The path sits between quotes in a command line that Node passes on as it is. Windows
  // never allows a quote in a path, so one here is refused instead of escaped.
  if (filePath.includes('"')) {
    throw new SystemOpenError("The path has a quote and cannot be selected in Explorer.");
  }
  return { command: "explorer.exe", args: [`/select,"${filePath}"`], verbatimArguments: true, exitCodeMeansFailure: false };
}

function unixLaunch(platform: NodeJS.Platform, action: "open" | "reveal", filePath: string): Launch {
  if (platform === "darwin") {
    return { command: "open", args: action === "open" ? [filePath] : ["-R", filePath], exitCodeMeansFailure: true };
  }
  // xdg-open cannot select a file: the folder is what it shows.
  return { command: "xdg-open", args: [action === "open" ? filePath : path.dirname(filePath)], exitCodeMeansFailure: true };
}

function buildLaunch(platform: NodeJS.Platform, action: "open" | "reveal", filePath: string): Launch {
  return platform === "win32" ? windowsLaunch(action, filePath) : unixLaunch(platform, action, filePath);
}

function run(spawnProcess: SpawnProcess, launch: Launch): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const options: SpawnOptions = { stdio: "ignore", detached: true, windowsVerbatimArguments: launch.verbatimArguments };
    let child: ChildProcess;
    try {
      child = spawnProcess(launch.command, launch.args, options);
    } catch (error) {
      reject(new SystemOpenError(`Could not start ${launch.command}.`, { cause: error }));
      return;
    }

    let settled = false;
    const finish = (error?: SystemOpenError): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(waitTimer);
      child.unref();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    const waitTimer = setTimeout(() => finish(), EXIT_WAIT_MS);

    child.once("error", (cause) => finish(new SystemOpenError(`Could not start ${launch.command}.`, { cause })));
    child.once("exit", (code) => {
      finish(
        launch.exitCodeMeansFailure && code !== 0
          ? new SystemOpenError(`${launch.command} exited with code ${code ?? "none"}.`)
          : undefined,
      );
    });
    if (!launch.exitCodeMeansFailure) {
      child.once("spawn", () => finish());
    }
  });
}

/** The opener of the computer the app runs on. Programs start without a shell and with literal arguments. */
export function createSystemOpener({ platform = process.platform, spawnProcess = spawn }: SystemOpenerOptions = {}): SystemOpener {
  return {
    // `async` so a path that cannot be launched rejects instead of throwing.
    openFile: async (filePath) => run(spawnProcess, buildLaunch(platform, "open", filePath)),
    revealFile: async (filePath) => run(spawnProcess, buildLaunch(platform, "reveal", filePath)),
  };
}
