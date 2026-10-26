import { useId, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { createCompany, type Company, type CompanyInput } from "@/api/companiesApi";
import { startDiagnosis } from "@/api/diagnosesApi";
import { isApiError } from "@/api/httpClient";
import type { UsageMode } from "@/api/preferencesApi";
import { CnpjField } from "@/components/form/CnpjField";
import { TextField } from "@/components/form/TextField";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { cn } from "@/lib/utils";
import {
  ANNUAL_REVENUE_RANGE_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  SEGMENT_OPTIONS,
  type CompanyAnnualRevenueRange,
  type CompanySalesChannel,
  type CompanySegment,
} from "../../../shared/content/companyOptions";
import { extractCnpjDigits, getCnpjError } from "../../../shared/format/cnpj";
import { MODE_PARAM, WizardSteps } from "./WelcomeModePage";

type FieldKey = "name" | "segment" | "salesChannel" | "cnpj";
type FieldErrors = Partial<Record<FieldKey, string | null>>;

interface WizardValues {
  name: string;
  segment: CompanySegment | "";
  salesChannel: CompanySalesChannel | "";
  annualRevenueRange: CompanyAnnualRevenueRange | "";
  // Masked, as typed
  cnpj: string;
}

const NAME_MIN = 2;
const NAME_MAX = 80;
const FIELD_KEYS: FieldKey[] = ["name", "segment", "salesChannel", "cnpj"];
const START_ERROR = "Não foi possível começar o diagnóstico. Tente de novo.";
const SELECT_CLASS = cn(
  "h-(--control) w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text",
  "hover:border-text-soft focus:border-bronze aria-invalid:border-danger aria-invalid:bg-danger-wash max-sm:h-(--touch)",
);

function readMode(value: string | null): UsageMode {
  return value === "consultant" ? "consultant" : "owner";
}

function getNameError(value: string): string | null {
  const name = value.trim();
  if (!name) return "Informe o nome da empresa.";
  if (name.length < NAME_MIN) return "O nome precisa ter pelo menos 2 letras.";
  if (name.length > NAME_MAX) return "O nome pode ter até 80 caracteres.";
  return null;
}

function validate(values: WizardValues): FieldErrors {
  return {
    name: getNameError(values.name),
    segment: values.segment ? null : "Escolha o segmento mais próximo.",
    salesChannel: values.salesChannel ? null : "Escolha como você vende.",
    cnpj: values.cnpj ? getCnpjError(values.cnpj) : null,
  };
}

function toCompanyInput(values: WizardValues): CompanyInput {
  return {
    name: values.name.trim(),
    segment: values.segment as CompanySegment,
    salesChannel: values.salesChannel as CompanySalesChannel,
    annualRevenueRange: values.annualRevenueRange || null,
    cnpj: extractCnpjDigits(values.cnpj) || null,
  };
}

// The server answers 400 validation_failed with `fields`
function readServerFieldErrors(caught: unknown): FieldErrors {
  if (!isApiError(caught) || caught.code !== "validation_failed") return {};
  const fields = (caught.details as { fields?: Record<string, string> } | undefined)?.fields ?? {};
  return Object.fromEntries(FIELD_KEYS.filter((key) => fields[key]).map((key) => [key, fields[key]]));
}

function FieldError({ id, error }: { id: string; error?: string | null }) {
  return (
    <p id={id} aria-live="polite" className="min-h-[1.25em] text-xs text-danger">
      {error ?? null}
    </p>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}

// Form state and submit: client validation first, then create the company, save the mode and the
// focus company, open a new draft and land on "Seus números" (block 1 of the draft).
function useWizardForm(mode: UsageMode) {
  const navigate = useNavigate();
  const { savePreferences } = usePreferences();
  const formRef = useRef<HTMLFormElement>(null);
  // A retry after a later step failed must not register the company twice
  const createdRef = useRef<Company | null>(null);
  const [values, setValues] = useState<WizardValues>({ name: "", segment: "", salesChannel: "", annualRevenueRange: "", cnpj: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setValue<Key extends keyof WizardValues>(key: Key, value: WizardValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    // Text fields re-validate themselves while an error is shown; a choice clears on pick
    if (key === "segment" || key === "salesChannel") setErrors((current) => ({ ...current, [key]: null }));
  }

  function setFieldError(key: FieldKey) {
    return (error: string | null) => setErrors((current) => ({ ...current, [key]: error }));
  }

  function focusFirstInvalid() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  async function start() {
    setIsSaving(true);
    try {
      const company = createdRef.current ?? (await createCompany(toCompanyInput(values)));
      createdRef.current = company;
      await savePreferences({ usageMode: mode, focusCompanyId: company.id });
      const draft = await startDiagnosis(company.id);
      navigate(`/diagnostico/${encodeURIComponent(draft.id)}`, { replace: true });
    } catch (caught) {
      setIsSaving(false);
      const serverErrors = readServerFieldErrors(caught);
      if (Object.keys(serverErrors).length === 0) {
        setFormError(caught instanceof Error && caught.message ? caught.message : START_ERROR);
        return;
      }
      setErrors(serverErrors);
      focusFirstInvalid();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.values(nextErrors).some(Boolean)) {
      focusFirstInvalid();
      return;
    }
    void start();
  }

  return { formRef, values, errors, formError, isSaving, setValue, setFieldError, handleSubmit };
}

type WizardForm = ReturnType<typeof useWizardForm>;

function SegmentAndRevenueFields({ prefix, form }: { prefix: string; form: WizardForm }) {
  const { values, errors, setValue } = form;
  const segmentErrorId = `${prefix}segment-error`;
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      <div className="mb-4 flex flex-col gap-1">
        <Label htmlFor={`${prefix}segment`}>Segmento</Label>
        <select
          id={`${prefix}segment`}
          name="segment"
          className={SELECT_CLASS}
          value={values.segment}
          onChange={(event) => setValue("segment", event.target.value as CompanySegment | "")}
          aria-invalid={errors.segment ? true : undefined}
          aria-describedby={errors.segment ? segmentErrorId : undefined}
        >
          <option value="">Escolha</option>
          {SEGMENT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError id={segmentErrorId} error={errors.segment} />
      </div>
      <div className="mb-4 flex flex-col gap-1">
        <Label htmlFor={`${prefix}revenue`}>
          Faturamento por ano<span className="font-normal text-text-muted"> (opcional)</span>
        </Label>
        <select
          id={`${prefix}revenue`}
          name="annualRevenueRange"
          className={SELECT_CLASS}
          value={values.annualRevenueRange}
          onChange={(event) => setValue("annualRevenueRange", event.target.value as CompanyAnnualRevenueRange | "")}
        >
          <option value="">Prefiro não informar</option>
          {ANNUAL_REVENUE_RANGE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError id={`${prefix}revenue-error`} />
      </div>
    </div>
  );
}

function SalesChannelField({ prefix, form }: { prefix: string; form: WizardForm }) {
  const { values, errors, setValue } = form;
  const errorId = `${prefix}channel-error`;
  return (
    <fieldset
      className="mb-4 border-0 p-0"
      aria-invalid={errors.salesChannel ? true : undefined}
      aria-describedby={errors.salesChannel ? errorId : undefined}
    >
      <legend className="mb-1.5 text-sm font-medium">Como você vende</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {SALES_CHANNEL_OPTIONS.map((option) => (
          <label
            key={option.key}
            className={cn(
              "flex min-h-(--touch) cursor-pointer items-center gap-3 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm",
              "hover:border-text-soft has-checked:border-bronze has-checked:bg-wash",
            )}
          >
            <input
              type="radio"
              name={`${prefix}salesChannel`}
              value={option.key}
              checked={values.salesChannel === option.key}
              onChange={() => setValue("salesChannel", option.key)}
              className="size-4 shrink-0 accent-(--bronze)"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <FieldError id={errorId} error={errors.salesChannel} />
    </fieldset>
  );
}

function WizardFooter({ isSaving }: { isSaving: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
      <Link to="/boas-vindas" className={buttonVariants()} data-aioson-id="wizard-back">
        <BackIcon />
        Voltar
      </Link>
      <Button type="submit" variant="metal" aria-disabled={isSaving || undefined} data-aioson-id="wizard-submit">
        {isSaving ? "Preparando o diagnóstico…" : "Começar o diagnóstico"}
        <ArrowIcon />
      </Button>
    </div>
  );
}

// #/boas-vindas/empresa: minimal sign-up of the first company (AC-dm-02)
function WelcomeCompanyPage() {
  const prefix = useId();
  const [searchParams] = useSearchParams();
  const mode = readMode(searchParams.get(MODE_PARAM));
  const form = useWizardForm(mode);
  const { values, errors, setValue, setFieldError } = form;

  return (
    <div data-aioson-id="wizard-company" className="mx-auto mt-8 max-w-[760px]">
      <h1 className="text-[clamp(2.25rem,1.6rem+2.6vw,3.5rem)] leading-[1.04] tracking-[-0.035em]">
        {mode === "consultant" ? "Cadastre a primeira empresa que você atende" : "Conte um pouco sobre a sua empresa"}
      </h1>
      <p className="mt-4 mb-4 max-w-[54ch] text-lg text-text-soft">Quatro informações e você já começa o diagnóstico.</p>
      <WizardSteps current={1} />
      <form ref={form.formRef} noValidate onSubmit={form.handleSubmit} data-aioson-id="wizard-form">
        <TextField
          id={`${prefix}name`}
          name="name"
          label="Nome da empresa"
          autoComplete="organization"
          maxLength={NAME_MAX}
          value={values.name}
          onValueChange={(value) => setValue("name", value)}
          error={errors.name ?? null}
          onErrorChange={setFieldError("name")}
          validate={getNameError}
        />
        <SegmentAndRevenueFields prefix={prefix} form={form} />
        <SalesChannelField prefix={prefix} form={form} />
        <CnpjField
          id={`${prefix}cnpj`}
          name="cnpj"
          className="max-w-[320px]"
          hint="Usado só para diferenciar empresas com nomes parecidos."
          value={values.cnpj}
          onValueChange={(value) => setValue("cnpj", value)}
          error={errors.cnpj ?? null}
          onErrorChange={setFieldError("cnpj")}
        />
        {form.formError ? (
          <p role="alert" data-aioson-id="wizard-error" className="text-sm text-danger">
            {form.formError}
          </p>
        ) : null}
        <WizardFooter isSaving={form.isSaving} />
      </form>
    </div>
  );
}

export { WelcomeCompanyPage };
