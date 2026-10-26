// JSON-only client for the app's own API. Calls stay on the same origin under /api: in dev the
// Vite proxy forwards them to the backend port the Play allocated.

const API_PREFIX = "/api/";

const NETWORK_ERROR_MESSAGE = "Não foi possível falar com o FitPulse. Verifique se o app está aberto e tente de novo.";
const UNEXPECTED_ERROR_MESSAGE = "Algo deu errado. Tente de novo.";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

// The server answers 415 to a write without this type even when it has no body: it is the guard
// against cross-site no-cors writes, so body-less writes send `{}` as JSON instead.
const JSON_WRITE_METHODS: ReadonlySet<HttpMethod> = new Set(["POST", "PUT", "PATCH"]);
const ERROR_ENVELOPE_KEYS = new Set(["code", "message", "details", "requestId"]);
type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
}

// Mirrors the server error body `{ error: { code, message, fields?, ...extra } }`. `details` holds
// `error.details` when the server sends one, otherwise the extra keys (`fields`, `pendingBlocks`...).
class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!path.startsWith(API_PREFIX)) throw new Error(`httpClient only calls ${API_PREFIX}*, got "${path}"`);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function readErrorDetails(error: Record<string, unknown>): unknown {
  if (error.details !== undefined) return error.details;
  const extra = Object.entries(error).filter(([key]) => !ERROR_ENVELOPE_KEYS.has(key));
  return extra.length > 0 ? Object.fromEntries(extra) : undefined;
}

function toApiError(response: Response, payload: unknown): ApiError {
  const body = isRecord(payload) ? payload : {};
  const error = body.error;
  const headerRequestId = response.headers.get("x-request-id") ?? undefined;
  if (isRecord(error)) {
    const requestId = typeof error.requestId === "string" ? error.requestId : headerRequestId;
    return new ApiError(
      response.status,
      typeof error.code === "string" ? error.code : "http_error",
      typeof error.message === "string" && error.message ? error.message : UNEXPECTED_ERROR_MESSAGE,
      readErrorDetails(error),
      requestId,
    );
  }
  const message = typeof error === "string" && error ? error : UNEXPECTED_ERROR_MESSAGE;
  return new ApiError(response.status, "http_error", message, undefined, headerRequestId);
}

async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const isJsonWrite = JSON_WRITE_METHODS.has(method);
  if (isJsonWrite) headers["Content-Type"] = "application/json";
  // A bad path is a caller bug, so it throws here instead of being reported as a network failure
  const url = buildUrl(path, options.query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: isJsonWrite ? JSON.stringify(options.body ?? {}) : undefined,
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") throw caught;
    throw new ApiError(0, "network_error", NETWORK_ERROR_MESSAGE);
  }

  const payload = await readJson(response);
  if (!response.ok) throw toApiError(response, payload);
  return payload as T;
}

const httpClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PUT", path, { ...options, body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("DELETE", path, options),
};

function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export { ApiError, httpClient, isApiError };
export type { HttpMethod, QueryValue, RequestOptions };
