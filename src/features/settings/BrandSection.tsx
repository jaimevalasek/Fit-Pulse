// "Seus relatórios" in #/configuracoes (CAP-ra-brand): name, logo and contacts of who delivers the
// reports, a preview of the cover with the saved brand and the two confirmations (AC-ra-20, AC-ra-21,
// AC-ra-59). Talks only to the brand routes (IF-003); the PDFs read the same saved brand.
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { brandLogoUrl, getBrand, removeBrandLogo, resetBrand, saveBrand, saveBrandLogo } from "@/api/brandApi";
import type { Brand } from "@/api/brandApi";
import { isApiError } from "@/api/httpClient";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { PhoneField } from "@/components/form/PhoneField";
import { TextField } from "@/components/form/TextField";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { ReportSheet } from "@/features/report-center/ReportSheet";
import { LOGO_REFUSED_MESSAGE, LogoRefusedError, prepareBrandLogo } from "@/features/settings/brandLogoImage";
import type { PreparedLogo } from "@/features/settings/brandLogoImage";
import { cn } from "@/lib/utils";
import { EMAIL_MAX_LENGTH, getEmailError, getWebsiteError, WEBSITE_MAX_LENGTH } from "../../../shared/format/contact";
import { isoToDateInput, localIsoDate } from "../../../shared/format/dates";
import { getPhoneError } from "../../../shared/format/phone";
import type { ReportBrand, ReportPage } from "../../../shared/report/reportDocument";

type BrandField = "name" | "phone" | "email" | "website";
type ErrorKey = BrandField | "logo";
type FieldErrors = Partial<Record<ErrorKey, string | null>>;
type BrandForm = Record<BrandField, string>;
type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; brand: Brand };
type PendingConfirm = "removeLogo" | "reset" | null;

const NAME_MAX_LENGTH = 80;
const FITPULSE_NAME = "FitPulse";
const PREVIEW_TITLE = "Relatório do diagnóstico de maturidade";
const PREVIEW_SUBJECT = "Empresa de exemplo";
const SAVE_FALLBACK = "Não foi possível salvar a marca. Tente de novo.";
const BRAND_FIELDS: BrandField[] = ["name", "phone", "email", "website"];

function formOf(brand: Brand): BrandForm {
  return { name: brand.name ?? "", phone: brand.phone ?? "", email: brand.email ?? "", website: brand.website ?? "" };
}

function hasSavedBrand(brand: Brand): boolean {
  return Boolean(brand.name || brand.phone || brand.email || brand.website || brand.hasLogo);
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function validateForm(form: BrandForm): FieldErrors {
  return { phone: getPhoneError(form.phone), email: getEmailError(form.email), website: getWebsiteError(form.website) };
}

// The server answers 400 validation_failed with the message of each refused field
function serverFieldErrors(error: unknown): FieldErrors | null {
  if (!isApiError(error) || error.code !== "validation_failed") return null;
  const fields = (error.details as { fields?: Record<string, string> } | undefined)?.fields ?? {};
  const errors: FieldErrors = {};
  for (const field of BRAND_FIELDS) if (fields[field]) errors[field] = fields[field];
  return errors;
}

function saveFailureMessage(error: unknown): string {
  return isApiError(error) && error.code === "network_error" ? error.message : SAVE_FALLBACK;
}

// The logo routes answer with the message to show in the field ("Use uma imagem PNG ou JPG de até 2 MB.")
function logoFailureMessage(error: unknown): string {
  return isApiError(error) && error.code !== "network_error" ? error.message : SAVE_FALLBACK;
}

// Mirrors the server's resolveBrand: a blank name prints FitPulse (BR-ra-04)
function toReportBrand(brand: Brand): ReportBrand {
  return {
    name: brand.name ?? FITPULSE_NAME,
    custom: brand.name !== null,
    phone: brand.phone,
    email: brand.email,
    site: brand.website,
    logoDataUrl: brand.hasLogo ? brandLogoUrl(brand.logoUpdatedAt) : null,
  };
}

// The same cover the PDF draws, with the saved brand only
function previewCoverPage(brand: Brand): ReportPage {
  const reportBrand = toReportBrand(brand);
  const contacts = [reportBrand.phone, reportBrand.email, reportBrand.site].filter(Boolean);
  const today = isoToDateInput(localIsoDate(new Date()));
  const credit = reportBrand.custom
    ? `Preparado por ${reportBrand.name} com o FitPulse em ${today}`
    : `Gerado com o FitPulse em ${today}`;
  return {
    id: "cover",
    title: PREVIEW_TITLE,
    blocks: [
      {
        kind: "cover",
        brand: reportBrand,
        title: PREVIEW_TITLE,
        subject: PREVIEW_SUBJECT,
        facts: [],
        contactLine: contacts.length > 0 ? contacts.join(" · ") : null,
        credit,
      },
    ],
  };
}

function CoverPreview({ brand }: { brand: Brand }) {
  const footer = { text: `${brand.name ?? FITPULSE_NAME} · ${PREVIEW_SUBJECT}` };
  return (
    <div aria-label="Prévia da capa" role="group" data-aioson-id="brand-cover-preview" className="w-full max-w-[280px]">
      <p className="mb-2 text-sm text-text-soft">Prévia da capa com a marca salva</p>
      <ReportSheet page={previewCoverPage(brand)} number={1} total={1} footer={footer} />
    </div>
  );
}

function LogoThumbnail({ source }: { source: string | null }) {
  return (
    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-line-strong bg-ground-sunken">
      {source ? (
        <img src={source} alt="Logo atual" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="text-xs text-text-muted">Sem logo</span>
      )}
    </div>
  );
}

function LogoPicker({ invalid, busy, onChoose }: { invalid: boolean; busy: boolean; onChoose: (file: File) => void }) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Lets the same file be picked again after a refusal
    event.target.value = "";
    if (file) onChoose(file);
  }
  return (
    <label
      htmlFor="brand-logo-file"
      data-aioson-id="brand-logo-upload"
      className={cn(
        "inline-flex min-h-(--control) cursor-pointer items-center rounded-md border border-line-strong px-4 text-sm",
        "hover:border-text-soft hover:bg-surface has-focus-visible:outline-2 has-focus-visible:outline-bronze max-sm:min-h-(--touch)",
      )}
    >
      Escolher imagem
      <input
        id="brand-logo-file"
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        disabled={busy}
        aria-invalid={invalid || undefined}
        aria-describedby="brand-logo-hint brand-logo-error"
        onChange={handleChange}
      />
    </label>
  );
}

function logoHint(pending: PreparedLogo | null): string {
  const base = "PNG ou JPG até 2 MB. A imagem é reduzida para no máximo 600 px.";
  if (!pending) return base;
  const size = `${pending.resized ? "Reduzida para" : "Mantida em"} ${pending.width} × ${pending.height} px.`;
  return `${base} ${size} Clique em Salvar marca para usar.`;
}

function LogoField({ brand, pending, error, busy, onChoose, onRemove }: {
  brand: Brand;
  pending: PreparedLogo | null;
  error: string | null | undefined;
  busy: boolean;
  onChoose: (file: File) => void;
  onRemove: () => void;
}) {
  const source = pending?.dataUrl ?? (brand.hasLogo ? brandLogoUrl(brand.logoUpdatedAt) : null);
  return (
    <div className="mb-4 flex flex-col gap-1 sm:col-span-2" data-aioson-id="brand-logo">
      <span className="text-sm font-medium">
        Logo <span className="font-normal text-text-muted">(opcional)</span>
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <LogoThumbnail source={source} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap gap-2">
            <LogoPicker invalid={Boolean(error)} busy={busy} onChoose={onChoose} />
            {source ? (
              <Button variant="ghost" className="text-danger" disabled={busy} onClick={onRemove} data-aioson-id="brand-logo-remove">
                Remover logo
              </Button>
            ) : null}
          </div>
          <p id="brand-logo-hint" className="text-xs text-text-muted">
            {logoHint(pending)}
          </p>
        </div>
      </div>
      <p id="brand-logo-error" role={error ? "alert" : undefined} className="min-h-[1.25em] text-xs text-danger">
        {error ?? ""}
      </p>
    </div>
  );
}

function useBrand() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    getBrand(controller.signal)
      .then((brand) => setState({ status: "ready", brand }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [attempt]);
  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  return { state, retry };
}

// Fields first, then the picked logo: a refused logo leaves the fields saved and says so in its own field
async function saveAll(form: BrandForm, pendingLogo: PreparedLogo | null): Promise<{ brand: Brand; logoError: string | null }> {
  const brand = await saveBrand({
    name: blankToNull(form.name),
    phone: blankToNull(form.phone),
    email: blankToNull(form.email),
    website: blankToNull(form.website),
  });
  if (!pendingLogo) return { brand, logoError: null };
  try {
    return { brand: await saveBrandLogo({ mimeType: pendingLogo.mimeType, dataBase64: pendingLogo.dataBase64 }), logoError: null };
  } catch (caught) {
    return { brand, logoError: logoFailureMessage(caught) };
  }
}

function useBrandEditor(initial: Brand) {
  const [brand, setBrand] = useState(initial);
  const [form, setForm] = useState<BrandForm>(() => formOf(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pendingLogo, setPendingLogo] = useState<PreparedLogo | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);

  const setField = (field: BrandField) => (value: string) => setForm((current) => ({ ...current, [field]: value }));
  const setError = (key: ErrorKey) => (error: string | null) => setErrors((current) => ({ ...current, [key]: error }));

  async function chooseLogo(file: File) {
    setStatus("");
    try {
      setPendingLogo(await prepareBrandLogo(file));
      setError("logo")(null);
    } catch (caught) {
      // A refused file changes nothing: the saved logo and any logo already picked stay
      setError("logo")(caught instanceof LogoRefusedError ? caught.message : LOGO_REFUSED_MESSAGE);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setStatus("");
    setSaveError(null);
    const fieldErrors = validateForm(form);
    setErrors((current) => ({ ...current, ...fieldErrors }));
    if (Object.values(fieldErrors).some(Boolean)) return;
    setSaving(true);
    try {
      const { brand: saved, logoError } = await saveAll(form, pendingLogo);
      setBrand(saved);
      setForm(formOf(saved));
      if (logoError) setError("logo")(logoError);
      else setPendingLogo(null);
      setStatus(logoError ? "" : "Marca salva. Os próximos PDFs saem com ela.");
    } catch (caught) {
      const fromServer = serverFieldErrors(caught);
      if (fromServer) setErrors((current) => ({ ...current, ...fromServer }));
      else setSaveError(saveFailureMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function requestRemoveLogo() {
    // A picked logo that was never saved is just dropped: nothing stored is lost
    if (brand.hasLogo) setConfirm("removeLogo");
    else setPendingLogo(null);
  }

  async function removeLogo() {
    setBrand(await removeBrandLogo());
    setPendingLogo(null);
    setError("logo")(null);
    setStatus("Logo removida.");
  }

  async function reset() {
    const next = await resetBrand();
    setBrand(next);
    setForm(formOf(next));
    setPendingLogo(null);
    setErrors({});
    setStatus("Marca apagada. Os PDFs voltam a sair com a marca FitPulse.");
  }

  return {
    brand, form, errors, pendingLogo, saving, status, saveError, confirm,
    setField, setError, setConfirm, chooseLogo, submit, requestRemoveLogo, removeLogo, reset,
  };
}

type BrandEditorState = ReturnType<typeof useBrandEditor>;

function NameField({ editor }: { editor: BrandEditorState }) {
  const { preferences } = usePreferences();
  // In "Minha empresa" the name is usually the user's own company
  const ownCompany = (preferences.usageMode ?? "owner") === "owner";
  return (
    <TextField
      id="brand-name"
      className="sm:col-span-2"
      label={ownCompany ? "Nome que aparece no relatório" : "Nome de quem entrega"}
      optional
      hint={ownCompany ? "Pode ser o nome da sua empresa ou de quem prepara o relatório. Até 80 letras." : "Até 80 letras."}
      placeholder={ownCompany ? "Ex.: Padaria Trigo Bom" : "Ex.: Rumo Consultoria"}
      autoComplete="organization"
      maxLength={NAME_MAX_LENGTH}
      value={editor.form.name}
      onValueChange={editor.setField("name")}
      error={editor.errors.name}
      onErrorChange={editor.setError("name")}
    />
  );
}

function ContactFields({ editor }: { editor: BrandEditorState }) {
  const { form, errors, setField, setError } = editor;
  return (
    <>
      <PhoneField id="brand-phone" value={form.phone} onValueChange={setField("phone")} error={errors.phone} onErrorChange={setError("phone")} />
      <TextField
        id="brand-email"
        label="E-mail"
        optional
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="voce@empresa.com.br"
        maxLength={EMAIL_MAX_LENGTH}
        value={form.email}
        onValueChange={setField("email")}
        validate={getEmailError}
        error={errors.email}
        onErrorChange={setError("email")}
      />
      <TextField
        id="brand-website"
        className="sm:col-span-2"
        label="Site"
        optional
        inputMode="url"
        autoComplete="url"
        placeholder="empresa.com.br"
        maxLength={WEBSITE_MAX_LENGTH}
        value={form.website}
        onValueChange={setField("website")}
        validate={getWebsiteError}
        error={errors.website}
        onErrorChange={setError("website")}
      />
    </>
  );
}

function BrandActions({ editor }: { editor: BrandEditorState }) {
  const { brand, saving, status, saveError, setConfirm } = editor;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="metal" aria-disabled={saving || undefined} data-aioson-id="brand-save">
          {saving ? "Salvando…" : "Salvar marca"}
        </Button>
        {hasSavedBrand(brand) ? (
          <Button variant="ghost" disabled={saving} onClick={() => setConfirm("reset")} data-aioson-id="brand-reset">
            Voltar para a marca FitPulse
          </Button>
        ) : null}
      </div>
      <p role="status" className="mt-2 min-h-[1.25em] text-sm text-ok" data-aioson-id="brand-status">
        {status}
      </p>
      {saveError ? (
        <p role="alert" className="text-sm text-danger">
          {saveError}
        </p>
      ) : null}
    </>
  );
}

function BrandConfirmations({ editor }: { editor: BrandEditorState }) {
  const { confirm, setConfirm, removeLogo, reset } = editor;
  return (
    <>
      <ConfirmDialog
        open={confirm === "removeLogo"}
        onOpenChange={(open) => setConfirm(open ? "removeLogo" : null)}
        title="Remover a logo?"
        consequence="Os próximos PDFs saem só com o nome de quem entrega. Você pode escolher outra imagem depois."
        confirmLabel="Remover logo"
        onConfirm={removeLogo}
        dataId="brand-logo-remove-confirm"
      />
      <ConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(open) => setConfirm(open ? "reset" : null)}
        title="Voltar para a marca FitPulse?"
        consequence="Nome, logo e contato serão apagados. Os próximos PDFs saem com a marca FitPulse. Não dá para desfazer."
        confirmLabel="Apagar a marca"
        onConfirm={reset}
        dataId="brand-reset-confirm"
      />
    </>
  );
}

function BrandEditor({ initial }: { initial: Brand }) {
  const editor = useBrandEditor(initial);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
      <form noValidate onSubmit={editor.submit} aria-busy={editor.saving || undefined} data-aioson-id="brand-form">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <NameField editor={editor} />
          <LogoField
            brand={editor.brand}
            pending={editor.pendingLogo}
            error={editor.errors.logo}
            busy={editor.saving}
            onChoose={editor.chooseLogo}
            onRemove={editor.requestRemoveLogo}
          />
          <ContactFields editor={editor} />
        </div>
        <BrandActions editor={editor} />
      </form>
      <CoverPreview brand={editor.brand} />
      <BrandConfirmations editor={editor} />
    </div>
  );
}

function BrandSection() {
  const { state, retry } = useBrand();
  if (state.status === "loading") {
    return <p className="text-sm text-text-soft" role="status">Carregando a marca…</p>;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        Não foi possível carregar a marca.{" "}
        <button type="button" onClick={retry} className="inline-flex min-h-(--touch) items-center underline">
          Tentar de novo
        </button>
      </p>
    );
  }
  return <BrandEditor initial={state.brand} />;
}

export { BrandSection };
