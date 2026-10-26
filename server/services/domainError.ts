/** Extra keys merged into the `error` object of the response, e.g. `pendingBlocks`. */
export type DomainErrorDetails = Record<string, unknown>;

/**
 * A business-rule failure with the HTTP status and the stable `code` the
 * frontend branches on (IF-010). Services throw it; the error handler turns it
 * into `{ error: { code, message, ...details } }`.
 */
export class DomainError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: DomainErrorDetails;

  constructor(status: number, code: string, message: string, details?: DomainErrorDetails) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
