import type { PrismaClient } from "../generated/prisma/client.ts";
import { IMAGE_MIME_TYPES, readImageSignature, type ImageMimeType } from "../files/imageSignature.ts";
import {
  createPreferenceRepository,
  type PreferenceChanges,
  type PreferenceRepository,
} from "../repositories/preferenceRepository.ts";
import {
  BRAND_LOGO_MAX_BASE64_LENGTH,
  BRAND_LOGO_MAX_BYTES,
  BRAND_LOGO_MAX_SIDE,
  BRAND_LOGO_REFUSED_MESSAGE,
  type BrandLogoInput,
  type BrandUpdate,
} from "../validation/brandSchemas.ts";
import { DomainError } from "./domainError.ts";

/** Shape of IF-003. Every field is always present, `null` or `false` when nothing was saved. */
export interface Brand {
  name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hasLogo: boolean;
  /** ISO time of the last logo upload; `null` without a logo. */
  logoUpdatedAt: string | null;
}

export interface BrandLogo {
  mimeType: ImageMimeType;
  bytes: Buffer;
  updatedAt: string;
}

/** Everything a report prints about who delivers it; all `null` means the FitPulse brand. */
export interface BrandIdentity {
  name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo: BrandLogo | null;
}

export interface BrandService {
  get(): Promise<Brand>;
  /** Saves only the fields sent and answers with the whole brand. */
  update(input: BrandUpdate): Promise<Brand>;
  /** Back to the FitPulse brand: name, contacts and logo are all forgotten. */
  reset(): Promise<Brand>;
  /** Refuses with 422 `logo_invalid` and changes nothing unless the file is a PNG or JPEG within the limits. */
  setLogo(input: BrandLogoInput): Promise<Brand>;
  removeLogo(): Promise<Brand>;
  /** The stored logo; 404 `logo_not_found` without one. */
  readLogo(): Promise<BrandLogo>;
  /** For the report documents: the texts and the logo bytes in one read. */
  readIdentity(): Promise<BrandIdentity>;
}

export interface BrandServiceDeps {
  prisma: PrismaClient;
  now: () => Date;
}

/** Keys of the `preferences` table. */
const KEY = {
  name: "brand.name",
  phone: "brand.phone",
  email: "brand.email",
  website: "brand.website",
  logoMime: "brand.logo_mime",
  logoData: "brand.logo_data",
  logoUpdatedAt: "brand.logo_updated_at",
} as const;

const TEXT_FIELDS = [
  ["name", KEY.name],
  ["phone", KEY.phone],
  ["email", KEY.email],
  ["website", KEY.website],
] as const;

const LOGO_KEYS: readonly string[] = [KEY.logoMime, KEY.logoData, KEY.logoUpdatedAt];
// The view never loads the logo itself, only whether there is one.
const VIEW_KEYS: readonly string[] = [KEY.name, KEY.phone, KEY.email, KEY.website, KEY.logoMime, KEY.logoUpdatedAt];
const ALL_KEYS: readonly string[] = Object.values(KEY);

const LOGO_TOO_LARGE_IN_PIXELS_MESSAGE = `A logo deve ter no máximo ${BRAND_LOGO_MAX_SIDE} px no lado maior.`;
const BASE64_SHAPE = /^[A-Za-z0-9+/]*={0,2}$/;

function logoInvalid(message = BRAND_LOGO_REFUSED_MESSAGE): DomainError {
  return new DomainError(422, "logo_invalid", message);
}

function logoNotFound(): DomainError {
  return new DomainError(404, "logo_not_found", "Nenhuma logo foi enviada ainda.");
}

function isImageMimeType(value: string | undefined): value is ImageMimeType {
  return IMAGE_MIME_TYPES.some((mimeType) => mimeType === value);
}

function decodeBase64(text: string): Buffer | null {
  // Checked before decoding, so a huge or malformed text is never turned into bytes.
  if (text.length > BRAND_LOGO_MAX_BASE64_LENGTH || text.length % 4 !== 0 || !BASE64_SHAPE.test(text)) {
    return null;
  }
  return Buffer.from(text, "base64");
}

/** The bytes and the real format of the file, or the refusal. The declared type only has to be a PNG or JPEG one. */
function inspectLogo(input: BrandLogoInput): { mimeType: ImageMimeType; bytes: Buffer } {
  if (!isImageMimeType(input.mimeType)) {
    throw logoInvalid();
  }
  const bytes = decodeBase64(input.dataBase64);
  if (bytes === null || bytes.length === 0 || bytes.length > BRAND_LOGO_MAX_BYTES) {
    throw logoInvalid();
  }
  const signature = readImageSignature(bytes);
  if (signature === null) {
    throw logoInvalid();
  }
  if (Math.max(signature.width, signature.height) > BRAND_LOGO_MAX_SIDE) {
    throw logoInvalid(LOGO_TOO_LARGE_IN_PIXELS_MESSAGE);
  }
  return { mimeType: signature.mimeType, bytes };
}

function readStoredMimeType(stored: Map<string, string>): ImageMimeType | null {
  const mimeType = stored.get(KEY.logoMime);
  return isImageMimeType(mimeType) ? mimeType : null;
}

function toChanges(input: BrandUpdate): PreferenceChanges {
  const changes: PreferenceChanges = { upserts: [], removals: [] };
  for (const [field, key] of TEXT_FIELDS) {
    const value = input[field];
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      changes.removals.push(key);
    } else {
      changes.upserts.push({ key, value });
    }
  }
  return changes;
}

export function createBrandService({ prisma, now }: BrandServiceDeps): BrandService {
  const repository: PreferenceRepository = createPreferenceRepository(prisma);

  function toBrand(stored: Map<string, string>): Brand {
    const hasLogo = readStoredMimeType(stored) !== null;
    return {
      name: stored.get(KEY.name) ?? null,
      phone: stored.get(KEY.phone) ?? null,
      email: stored.get(KEY.email) ?? null,
      website: stored.get(KEY.website) ?? null,
      hasLogo,
      logoUpdatedAt: hasLogo ? (stored.get(KEY.logoUpdatedAt) ?? null) : null,
    };
  }

  function toLogo(stored: Map<string, string>): BrandLogo | null {
    const mimeType = readStoredMimeType(stored);
    const data = stored.get(KEY.logoData);
    if (mimeType === null || data === undefined) {
      return null;
    }
    return { mimeType, bytes: Buffer.from(data, "base64"), updatedAt: stored.get(KEY.logoUpdatedAt) ?? "" };
  }

  async function read(): Promise<Brand> {
    return toBrand(await repository.readKeys(VIEW_KEYS));
  }

  return {
    get: read,

    async update(input) {
      await repository.applyChanges(toChanges(input));
      return read();
    },

    async reset() {
      await repository.applyChanges({ upserts: [], removals: [...ALL_KEYS] });
      return read();
    },

    async setLogo(input) {
      // Everything is checked before anything is written, so a refused file changes nothing.
      const { mimeType, bytes } = inspectLogo(input);
      await repository.applyChanges({
        upserts: [
          { key: KEY.logoMime, value: mimeType },
          { key: KEY.logoData, value: bytes.toString("base64") },
          { key: KEY.logoUpdatedAt, value: now().toISOString() },
        ],
        removals: [],
      });
      return read();
    },

    async removeLogo() {
      await repository.applyChanges({ upserts: [], removals: [...LOGO_KEYS] });
      return read();
    },

    async readLogo() {
      const logo = toLogo(await repository.readKeys(LOGO_KEYS));
      if (logo === null) {
        throw logoNotFound();
      }
      return logo;
    },

    async readIdentity() {
      const stored = await repository.readKeys(ALL_KEYS);
      const { name, phone, email, website } = toBrand(stored);
      return { name, phone, email, website, logo: toLogo(stored) };
    },
  };
}
