import { z } from "zod";
import {
  EMAIL_INVALID_MESSAGE,
  WEBSITE_INVALID_MESSAGE,
  getEmailError,
  getWebsiteError,
  normalizeEmail,
  normalizeWebsite,
} from "../../shared/format/contact.ts";
import { PHONE_INVALID_MESSAGE, getPhoneError, normalizePhone } from "../../shared/format/phone.ts";

export const BRAND_NAME_MAX_LENGTH = 80;
export const BRAND_LOGO_MAX_BYTES = 2 * 1024 * 1024;
/** The stored logo is never larger than this on its longer side; the screen reduces it before sending. */
export const BRAND_LOGO_MAX_SIDE = 600;
/** Base64 spells every 3 bytes with 4 characters, so this is the longest text a 2 MB image can have. */
export const BRAND_LOGO_MAX_BASE64_LENGTH = Math.ceil(BRAND_LOGO_MAX_BYTES / 3) * 4;
/** `PUT /api/brand/logo` carries the 2 MB image as base64 text plus the JSON around it. */
export const BRAND_LOGO_BODY_LIMIT = "3mb";
/** `PUT /api/brand` carries four short texts. */
export const BRAND_FIELDS_BODY_LIMIT = "16kb";
export const BRAND_LOGO_REFUSED_MESSAGE = "Use uma imagem PNG ou JPG de até 2 MB.";

const NAME_TOO_LONG_MESSAGE = "O nome pode ter até 80 caracteres.";
const NAME_ONE_LINE_MESSAGE = "O nome precisa caber em uma linha.";
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

// A missing key leaves the field as it is; null and blank text clear it.
const nameSchema = z
  .string({ error: "Informe o nome de quem entrega." })
  .trim()
  .max(BRAND_NAME_MAX_LENGTH, NAME_TOO_LONG_MESSAGE)
  .refine((value) => !CONTROL_CHARACTERS.test(value), NAME_ONE_LINE_MESSAGE)
  .nullable()
  .optional()
  .transform((value) => (value === "" ? null : value));

// The contact is stored the way the report prints it (`normalize`), so the PDF never reformats it.
function contactSchema(
  invalidMessage: string,
  getError: (value: string) => string | null,
  normalize: (value: string) => string | null,
) {
  return z
    .string({ error: invalidMessage })
    .nullable()
    .optional()
    .refine((value) => value == null || getError(value) === null, invalidMessage)
    .transform((value) => (value == null ? value : normalize(value)));
}

/**
 * Body of `PUT /api/brand` (IF-003). Every key is optional and only the keys sent change;
 * `null` or blank text clears one. The three contacts are the user's own and all optional.
 * Unknown keys are dropped, like in the company form.
 */
export const brandUpdateSchema = z.object(
  {
    name: nameSchema,
    phone: contactSchema(PHONE_INVALID_MESSAGE, getPhoneError, normalizePhone),
    email: contactSchema(EMAIL_INVALID_MESSAGE, getEmailError, normalizeEmail),
    website: contactSchema(WEBSITE_INVALID_MESSAGE, getWebsiteError, normalizeWebsite),
  },
  { error: "Envie os dados da marca." },
);

export type BrandUpdate = z.infer<typeof brandUpdateSchema>;

/**
 * Body of `PUT /api/brand/logo` (IF-003). The format is decided by the bytes, not by this
 * `mimeType`, so the service is the one that refuses a file that is not a PNG or a JPEG.
 */
export const brandLogoSchema = z.object(
  {
    mimeType: z.string({ error: "Envie o tipo da imagem." }).max(100, BRAND_LOGO_REFUSED_MESSAGE),
    dataBase64: z.string({ error: "Envie a imagem da logo." }).min(1, "Envie a imagem da logo."),
  },
  { error: "Envie a imagem da logo." },
);

export type BrandLogoInput = z.infer<typeof brandLogoSchema>;
