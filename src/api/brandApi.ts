// Calls of the brand routes (IF-003): who delivers the reports. A PUT sends only the keys that
// change and every answer is the whole brand. The logo travels as base64 text and is read back by
// its address, so an <img> shows it without the bytes ever crossing this client.
import { httpClient } from "./httpClient";

// Every field is always present: `null` or `false` when nothing was saved
interface Brand {
  name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  hasLogo: boolean;
  // ISO time of the last upload; null without a logo
  logoUpdatedAt: string | null;
}

// A missing key keeps the field; null or blank text clears it
interface BrandUpdate {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

// Format is decided by the server from the bytes; `mimeType` is only what the file declared
interface BrandLogoUpload {
  mimeType: "image/png" | "image/jpeg";
  dataBase64: string;
}

const BRAND_PATH = "/api/brand";
const BRAND_LOGO_PATH = `${BRAND_PATH}/logo`;

function getBrand(signal?: AbortSignal): Promise<Brand> {
  return httpClient.get<Brand>(BRAND_PATH, { signal });
}

// 400 validation_failed with `fields` ("phone", "email", "website", "name") holding the message to show in the field
function saveBrand(update: BrandUpdate): Promise<Brand> {
  return httpClient.put<Brand>(BRAND_PATH, update);
}

// 422 logo_invalid ("Use uma imagem PNG ou JPG de até 2 MB.") for anything but a PNG or JPEG within the
// limits, a file past the body limit included (413 payload_too_large with the same message); nothing changes
function saveBrandLogo(logo: BrandLogoUpload): Promise<Brand> {
  return httpClient.put<Brand>(BRAND_LOGO_PATH, logo);
}

function removeBrandLogo(): Promise<Brand> {
  return httpClient.delete<Brand>(BRAND_LOGO_PATH);
}

// Back to the FitPulse brand: name, contacts and logo are all forgotten
function resetBrand(): Promise<Brand> {
  return httpClient.delete<Brand>(BRAND_PATH);
}

// Address of the stored logo for <img src>. The version (`Brand.logoUpdatedAt`) changes the address on
// every upload, so a new logo never shows as the old one
function brandLogoUrl(version: string | null): string {
  return version === null ? BRAND_LOGO_PATH : `${BRAND_LOGO_PATH}?v=${encodeURIComponent(version)}`;
}

export { brandLogoUrl, getBrand, removeBrandLogo, resetBrand, saveBrand, saveBrandLogo };
export type { Brand, BrandLogoUpload, BrandUpdate };
