import type { Locator, Page } from "@playwright/test";
import { CASES, expect, openRoute, pdfFiles, readPdfPages, test } from "./support/fixtures";

// CAP-ra-brand: AC-ra-20 (fields, mask, errors on blur, "Salvar marca" and the cover preview),
// AC-ra-21 (PNG/JPG logo up to 2 MB, reduced to 600 px), AC-ra-22 (the brand on the PDF, FitPulse when
// blank) and AC-ra-59 (removing the logo and going back to FitPulse use the app's modal).

const PHONE_INVALID = "Telefone inválido. Use (11) 91234-5678.";
const EMAIL_INVALID = "E-mail inválido. Use nome@empresa.com.br.";
const WEBSITE_INVALID = "Site inválido. Use empresa.com.br.";
const LOGO_REFUSED = "Use uma imagem PNG ou JPG de até 2 MB.";

function brandForm(page: Page): Locator {
  return page.locator('[data-aioson-id="brand-form"]');
}

function coverPreview(page: Page): Locator {
  return page.locator('[data-aioson-id="brand-cover-preview"]');
}

/** A picture drawn by the browser itself, so the test needs no image file on disk. */
async function drawImage(page: Page, width: number, height: number, mimeType: "image/png" | "image/jpeg"): Promise<Buffer> {
  const base64 = await page.evaluate(
    ({ width, height, mimeType }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.fillStyle = "#1d6b57";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#f4efe6";
      context.fillRect(width / 4, height / 4, width / 2, height / 2);
      return canvas.toDataURL(mimeType).split(",")[1];
    },
    { width, height, mimeType },
  );
  return Buffer.from(base64, "base64");
}

/** Size of the stored logo, read by the browser from GET /api/brand/logo. */
async function storedLogoSize(page: Page): Promise<{ width: number; height: number; type: string }> {
  return page.evaluate(async () => {
    const response = await fetch("/api/brand/logo");
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    return { width: bitmap.width, height: bitmap.height, type: blob.type };
  });
}

async function openBrand(page: Page): Promise<void> {
  await openRoute(page, "/configuracoes");
  await expect(brandForm(page)).toBeVisible();
}

test.beforeEach(async ({ api }) => {
  await api.reset();
});

test("the fields check themselves on blur, and 'Salvar marca' changes the cover at once", async ({ page, api }) => {
  await api.setPreferences({ usageMode: "consultant" });
  await openBrand(page);
  const form = brandForm(page);
  await expect(page.locator('[data-aioson-id="brand-section"]')).toContainText("Seus relatórios");
  // Blank: the cover preview carries the FitPulse brand
  await expect(coverPreview(page)).toContainText("Gerado com o FitPulse em");

  const name = form.getByLabel("Nome de quem entrega");
  await expect(name).toHaveAttribute("maxlength", "80");
  const phone = page.locator("#brand-phone");
  await expect(phone).toHaveAttribute("inputmode", "tel");

  // The mask, mobile and landline
  await phone.fill("11912345678");
  await expect(phone).toHaveValue("(11) 91234-5678");
  await phone.fill("1112345678");
  await expect(phone).toHaveValue("(11) 1234-5678");

  // Wrong values show their message in the field, with aria-invalid, once the field is left
  await phone.fill("119");
  await phone.blur();
  await expect(phone).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#brand-phone-error")).toHaveText(PHONE_INVALID);
  const email = page.locator("#brand-email");
  await email.fill("rumo@consultoria");
  await email.blur();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#brand-email-error")).toHaveText(EMAIL_INVALID);
  const website = page.locator("#brand-website");
  await website.fill("rumo consultoria");
  await website.blur();
  await expect(website).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#brand-website-error")).toHaveText(WEBSITE_INVALID);

  // Nothing is saved while a field is wrong
  await page.locator('[data-aioson-id="brand-save"]').click();
  expect(await api.getBrand()).toMatchObject({ name: null, phone: null, email: null, website: null });

  await name.fill("Rumo Consultoria");
  await phone.fill("11912345678");
  await email.fill("contato@rumo.com.br");
  await website.fill("rumo.com.br");
  await website.blur();
  for (const field of [phone, email, website]) await expect(field).not.toHaveAttribute("aria-invalid", "true");
  await page.locator('[data-aioson-id="brand-save"]').click();
  await expect(page.locator('[data-aioson-id="brand-status"]')).toHaveText("Marca salva. Os próximos PDFs saem com ela.");
  expect(await api.getBrand()).toMatchObject({ name: "Rumo Consultoria", phone: "(11) 91234-5678", email: "contato@rumo.com.br", website: "rumo.com.br" });
  await expect(coverPreview(page)).toContainText("Rumo Consultoria");
  await expect(coverPreview(page)).toContainText("(11) 91234-5678");
  await expect(coverPreview(page)).toContainText("Preparado por Rumo Consultoria com o FitPulse em");

  // The saved brand comes back after a reload
  await page.reload();
  await expect(brandForm(page).getByLabel("Nome de quem entrega")).toHaveValue("Rumo Consultoria");
});

test("in 'Minha empresa' the name speaks of the owner's own company", async ({ page, api }) => {
  await api.setPreferences({ usageMode: "owner" });
  await openBrand(page);
  await expect(brandForm(page).getByLabel("Nome que aparece no relatório")).toBeVisible();
  await expect(brandForm(page).getByLabel("Nome de quem entrega")).toHaveCount(0);
});

test("a PNG or JPG logo is reduced to 600 px; any other file is refused and changes nothing", async ({ page, api }) => {
  await openBrand(page);
  const input = page.locator("#brand-logo-file");

  // A text file named like a picture: the bytes decide, and it is refused
  await input.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("not a picture at all") });
  await expect(page.locator("#brand-logo-error")).toHaveText(LOGO_REFUSED);
  await expect(input).toHaveAttribute("aria-invalid", "true");
  expect((await api.getBrand()).hasLogo).toBe(false);

  // A wide PNG is redrawn at 600 px on its longer side and saved with the brand
  await input.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await drawImage(page, 1200, 400, "image/png") });
  await expect(page.locator("#brand-logo-error")).toHaveText("");
  await brandForm(page).getByLabel(/Nome/).fill("Rumo Consultoria");
  await page.locator('[data-aioson-id="brand-save"]').click();
  await expect(page.locator('[data-aioson-id="brand-status"]')).toHaveText("Marca salva. Os próximos PDFs saem com ela.");
  expect((await api.getBrand()).hasLogo).toBe(true);
  expect(await storedLogoSize(page)).toEqual({ width: 600, height: 200, type: "image/png" });
  await expect(page.getByRole("img", { name: "Logo atual" })).toBeVisible();

  // A tall JPG keeps its format
  await input.setInputFiles({ name: "logo.jpg", mimeType: "image/jpeg", buffer: await drawImage(page, 500, 900, "image/jpeg") });
  await page.locator('[data-aioson-id="brand-save"]').click();
  await expect(page.locator('[data-aioson-id="brand-status"]')).toHaveText("Marca salva. Os próximos PDFs saem com ela.");
  expect(await storedLogoSize(page)).toEqual({ width: 333, height: 600, type: "image/jpeg" });

  // More than 2 MB is refused before anything is read
  await input.setInputFiles({ name: "big.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 1) });
  await expect(page.locator("#brand-logo-error")).toHaveText(LOGO_REFUSED);
  expect(await storedLogoSize(page)).toEqual({ width: 333, height: 600, type: "image/jpeg" });
});

test("the PDF carries the saved brand, and the FitPulse brand when it is blank", async ({ page, api }) => {
  const company = await api.createCompany({ name: "Padaria Aurora" });
  await api.seedCompleted(company.id, CASES.g2);

  async function exportCover(): Promise<{ cover: string; last: string }> {
    await openRoute(page, `/empresa/${company.id}/relatorios`);
    await expect(page.getByLabel("Prévia das páginas do PDF")).toHaveAttribute("data-state", "ready");
    const before = new Set(pdfFiles());
    await page.locator('[data-aioson-id="report-export"]').click();
    await expect(page.locator('[data-aioson-id="report-pdf-saved"]')).toContainText("PDF salvo");
    const [fileName] = pdfFiles().filter((name) => !before.has(name));
    const pages = await readPdfPages(fileName);
    return { cover: pages[0], last: pages[pages.length - 1] };
  }

  const blank = await exportCover();
  expect(blank.cover).toContain("Gerado com o FitPulse em");
  expect(blank.last).toContain("FitPulse");

  await api.setBrand({ name: "Rumo Consultoria", phone: "(11) 91234-5678", email: "contato@rumo.com.br", website: "rumo.com.br" });
  await api.setBrandLogo("image/png", await drawImage(page, 300, 120, "image/png"));
  const branded = await exportCover();
  for (const expected of ["Rumo Consultoria", "(11) 91234-5678", "contato@rumo.com.br", "rumo.com.br", "Preparado por Rumo Consultoria com o FitPulse em"]) {
    expect(branded.cover, `cover has "${expected}"`).toContain(expected);
  }
  // The footer of every page names who delivers
  expect(branded.last).toContain("Rumo Consultoria");
});

test("removing the logo and going back to FitPulse ask in the app's modal; Esc and 'Cancelar' keep everything", async ({ page, api }) => {
  await api.setBrand({ name: "Rumo Consultoria", phone: "(11) 91234-5678", email: null, website: null });
  await openBrand(page);
  await page.locator("#brand-logo-file").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await drawImage(page, 200, 80, "image/png") });
  await page.locator('[data-aioson-id="brand-save"]').click();
  await expect(page.locator('[data-aioson-id="brand-status"]')).toHaveText("Marca salva. Os próximos PDFs saem com ela.");

  // "Remover logo": Esc cancels, the focus stays in the modal, then the verb removes it
  await page.locator('[data-aioson-id="brand-logo-remove"]').click();
  const removeDialog = page.getByRole("alertdialog", { name: "Remover a logo?" });
  await expect(removeDialog).toContainText("Os próximos PDFs saem só com o nome de quem entrega.");
  await expect(removeDialog.getByRole("button", { name: "Cancelar" })).toBeVisible();
  for (let stop = 0; stop < 4; stop += 1) {
    await page.keyboard.press("Tab");
    expect(await removeDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(removeDialog).toHaveCount(0);
  expect((await api.getBrand()).hasLogo).toBe(true);
  await page.locator('[data-aioson-id="brand-logo-remove"]').click();
  await removeDialog.getByRole("button", { name: "Remover logo" }).click();
  await expect(page.locator('[data-aioson-id="brand-status"]')).toHaveText("Logo removida.");
  expect(await api.getBrand()).toMatchObject({ hasLogo: false, name: "Rumo Consultoria" });

  // "Voltar para a marca FitPulse": "Cancelar" keeps the brand, "Apagar a marca" forgets it
  await page.locator('[data-aioson-id="brand-reset"]').click();
  const resetDialog = page.getByRole("alertdialog", { name: "Voltar para a marca FitPulse?" });
  await expect(resetDialog).toContainText("Nome, logo e contato serão apagados.");
  await resetDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(resetDialog).toHaveCount(0);
  expect((await api.getBrand()).name).toBe("Rumo Consultoria");
  await page.locator('[data-aioson-id="brand-reset"]').click();
  await resetDialog.getByRole("button", { name: "Apagar a marca" }).click();
  await expect(page.locator('[data-aioson-id="brand-status"]')).toHaveText("Marca apagada. Os PDFs voltam a sair com a marca FitPulse.");
  expect(await api.getBrand()).toMatchObject({ name: null, phone: null, email: null, website: null, hasLogo: false });
  await expect(coverPreview(page)).toContainText("Gerado com o FitPulse em");
});
