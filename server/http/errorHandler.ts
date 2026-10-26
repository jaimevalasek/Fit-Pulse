import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { DomainError } from "../services/domainError.ts";

/** Key used in `fields` for a validation issue that does not point at one field. */
export const ROOT_FIELD = "_root";

interface ErrorPayload {
  code: string;
  message: string;
  [key: string]: unknown;
}

function sendError(res: Response, status: number, payload: ErrorPayload): void {
  res.status(status).json({ error: payload });
}

function collectZodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : ROOT_FIELD;
    fields[key] ??= issue.message;
  }
  return fields;
}

// Errors raised by express.json carry a `type`; anything else with a 4xx status
// comes from the HTTP layer (aborted request, unsupported charset, ...).
function readHttpClientError(error: unknown): { status: number; type?: string } | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const { status, type } = error as { status?: unknown; type?: unknown };
  if (typeof status !== "number" || status < 400 || status >= 500) {
    return null;
  }
  return { status, type: typeof type === "string" ? type : undefined };
}

// Prisma reports an unusable database in different shapes: a TypeError when the
// file cannot be opened, a DriverAdapterError for a file that is not a database,
// and P1xxx / P2021 / P2022 when the connection or the schema is missing.
const DATABASE_ERROR_NAMES = new Set(["PrismaClientInitializationError", "DriverAdapterError"]);
const DATABASE_UNAVAILABLE_PRISMA_CODE = /^(?:P1\d{3}|P2021|P2022)$/;
const DATABASE_OPEN_FAILURE_MESSAGE = /cannot open database|unable to open database|database is locked/i;

function isDatabaseUnavailable(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (DATABASE_ERROR_NAMES.has(error.name)) {
    return true;
  }
  const { code } = error as { code?: unknown };
  if (error.name === "PrismaClientKnownRequestError" && typeof code === "string") {
    return DATABASE_UNAVAILABLE_PRISMA_CODE.test(code);
  }
  return DATABASE_OPEN_FAILURE_MESSAGE.test(error.message);
}

/** Fallback for any request no route answered. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, 404, { code: "not_found", message: "Rota não encontrada." });
};

/**
 * Turns every failure into `{ error: { code, message, ... } }` (IF-010). Unexpected
 * errors are logged to stderr, which the Play captures, and never echoed back.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof DomainError) {
    sendError(res, error.status, { ...error.details, code: error.code, message: error.message });
    return;
  }

  if (error instanceof ZodError) {
    sendError(res, 400, {
      code: "validation_failed",
      message: "Confira os campos destacados.",
      fields: collectZodFields(error),
    });
    return;
  }

  const clientError = readHttpClientError(error);
  if (clientError?.type === "entity.too.large") {
    sendError(res, 413, { code: "payload_too_large", message: "O conteúdo enviado é grande demais." });
    return;
  }
  if (clientError?.type === "entity.parse.failed") {
    sendError(res, 400, { code: "invalid_json", message: "O conteúdo enviado não é um JSON válido." });
    return;
  }
  if (clientError) {
    sendError(res, clientError.status, { code: "bad_request", message: "A requisição não pôde ser lida." });
    return;
  }

  if (isDatabaseUnavailable(error)) {
    console.error("[fitpulse] database unavailable:", error);
    sendError(res, 503, {
      code: "database_unavailable",
      message: "Não foi possível abrir os dados do FitPulse. Feche e abra o app de novo.",
    });
    return;
  }

  console.error("[fitpulse] unexpected error:", error);
  sendError(res, 500, { code: "internal_error", message: "Algo deu errado. Tente de novo." });
};
