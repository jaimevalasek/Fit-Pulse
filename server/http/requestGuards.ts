import type { RequestHandler } from "express";
import { DomainError } from "../services/domainError.ts";

// The Host header, not the socket, is what a DNS-rebinding page cannot fake: a
// page served from evil.example that resolves to 127.0.0.1 still sends
// `Host: evil.example:<port>`. The server only listens on its own ports, so the
// hostname is what needs checking.
const LOCAL_HOST = /^(?:127\.0\.0\.1|localhost)(?::\d{1,5})?$/i;

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH"]);

/** Answers 403 `host_not_allowed` unless the request addressed 127.0.0.1 or localhost. */
export const requireLocalHost: RequestHandler = (req, _res, next) => {
  const host = req.headers.host;
  if (host === undefined || !LOCAL_HOST.test(host)) {
    next(new DomainError(403, "host_not_allowed", "O FitPulse só responde neste computador."));
    return;
  }
  next();
};

function isJsonContentType(header: string | undefined): boolean {
  const mediaType = header?.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

/**
 * Writes must declare `application/json`, even when they carry no body. A page on
 * another origin cannot send that type without a CORS preflight, and the app
 * answers none, so a cross-site form or `no-cors` fetch cannot reach a write route.
 * `req.is()` is not used because it returns null for a body-less request even when
 * the header is present, so it cannot tell that case from a wrong type.
 */
export const requireJsonWrites: RequestHandler = (req, _res, next) => {
  if (WRITE_METHODS.has(req.method) && !isJsonContentType(req.headers["content-type"])) {
    next(new DomainError(415, "json_required", "Envie o conteúdo como JSON."));
    return;
  }
  next();
};
