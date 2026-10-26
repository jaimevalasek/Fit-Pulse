export const EMAIL_INVALID_MESSAGE = "E-mail inválido. Use nome@empresa.com.br.";
export const WEBSITE_INVALID_MESSAGE = "Site inválido. Use empresa.com.br.";

export const EMAIL_MAX_LENGTH = 254;
export const WEBSITE_MAX_LENGTH = 200;

const EMAIL_LOCAL_PART_MAX_LENGTH = 64;
const EMAIL_LOCAL_PART = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const TOP_LEVEL_DOMAIN = /^[A-Za-z]{2,}$/;
const PORT = /^\d{1,5}$/;
const HTTP_SCHEME = /^https?:\/\//i;
// Whatever follows the host (path, query, fragment) may not hold spaces, quotes or markup characters.
const WEBSITE_TAIL = /^[^\s<>"`{}|\\^]*$/;

function isHostName(host: string): boolean {
  const labels = host.split(".");
  const topLevelDomain = labels[labels.length - 1] ?? "";
  return labels.length >= 2 && labels.every((label) => DOMAIN_LABEL.test(label)) && TOP_LEVEL_DOMAIN.test(topLevelDomain);
}

/** The e-mail as typed minus surrounding spaces, or `null` when it is blank or not a valid address. */
export function normalizeEmail(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim();
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH) return null;

  const parts = email.split("@");
  const [localPart, domain] = parts;
  if (parts.length !== 2 || localPart === undefined || domain === undefined) return null;
  if (localPart.length > EMAIL_LOCAL_PART_MAX_LENGTH || !EMAIL_LOCAL_PART.test(localPart)) return null;
  return isHostName(domain) ? email : null;
}

export function isValidEmail(value: string | null | undefined): boolean {
  return normalizeEmail(value) !== null;
}

// The e-mail is optional: an empty field is fine, anything else must be a complete address.
export function getEmailError(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return isValidEmail(value) ? null : EMAIL_INVALID_MESSAGE;
}

/**
 * The site the way it is shown on a report: `empresa.com.br/loja`, without `http(s)://`, with the
 * host in lower case and without a lone trailing slash. `null` when the value is blank or not a
 * site (no dot, spaces, another scheme such as `javascript:`, a login before the host).
 */
export function normalizeWebsite(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const typed = value.trim();
  if (typed.length === 0 || typed.length > WEBSITE_MAX_LENGTH) return null;

  const withoutScheme = typed.replace(HTTP_SCHEME, "");
  const tailStart = withoutScheme.search(/[/?#]/);
  const authority = tailStart === -1 ? withoutScheme : withoutScheme.slice(0, tailStart);
  const tail = tailStart === -1 ? "" : withoutScheme.slice(tailStart);

  const [host = "", port, ...rest] = authority.split(":");
  if (rest.length > 0 || !isHostName(host)) return null;
  if (port !== undefined && !PORT.test(port)) return null;
  if (!WEBSITE_TAIL.test(tail)) return null;

  return `${authority.toLowerCase()}${tail === "/" ? "" : tail}`;
}

export function isValidWebsite(value: string | null | undefined): boolean {
  return normalizeWebsite(value) !== null;
}

// The site is optional: an empty field is fine, anything else must be a complete address.
export function getWebsiteError(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return isValidWebsite(value) ? null : WEBSITE_INVALID_MESSAGE;
}
