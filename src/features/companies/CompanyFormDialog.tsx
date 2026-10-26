import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TextField } from "@/components/form/TextField";
import { CnpjField } from "@/components/form/CnpjField";
import { isApiError } from "@/api/httpClient";
import { createCompany, updateCompany, type Company, type CompanyInput } from "@/api/companiesApi";
import { cn } from "@/lib/utils";
import {
  ANNUAL_REVENUE_RANGE_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  SEGMENT_OPTIONS,
  type CompanyAnnualRevenueRange,
  type CompanyOption,
  type CompanySalesChannel,
  type CompanySegment,
} from "../../../shared/content/companyOptions";
import { extractCnpjDigits, getCnpjError, maskCnpj } from "../../../shared/format/cnpj";

type FieldKey = "name" | "segment" | "salesChannel" | "annualRevenueRange" | "cnpj";
type FieldErrors = Partial<Record<FieldKey, string | null>>;

interface CompanyFormValues {
  name: string;
  segment: CompanySegment | "";
  salesChannel: CompanySalesChannel | "";
  annualRevenueRange: CompanyAnnualRevenueRange | "";
  // Masked, as typed
  cnpj: string;
}

interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Edit mode when present; create mode otherwise. Both modes show the same fields.
  company?: Company | null;
  onSaved: (company: Company) => void;
}

const NAME_MIN = 2;
const NAME_MAX = 80;
const FIELD_ORDER: FieldKey[] = ["name", "segment", "salesChannel", "annualRevenueRange", "cnpj"];
const SAVE_ERROR = "Não foi possível salvar. Tente de novo.";
const SELECT_CLASS = cn(
  "h-(--control) w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text",
  "hover:border-text-soft focus:border-bronze aria-invalid:border-danger aria-invalid:bg-danger-wash max-sm:h-(--touch)",
);

function toFormValues(company?: Company | null): CompanyFormValues {
  return {
    name: company?.name ?? "",
    segment: company?.segment ?? "",
    salesChannel: company?.salesChannel ?? "",
    annualRevenueRange: company?.annualRevenueRange ?? "",
    cnpj: company?.cnpj ? maskCnpj(company.cnpj) : "",
  };
}

function getNameError(value: string): string | null {
  const name = value.trim();
  if (!name) return "Informe o nome da empresa.";
  if (name.length < NAME_MIN) return "O nome precisa ter pelo menos 2 letras.";
  if (name.length > NAME_MAX) return "O nome pode ter até 80 caracteres.";
  return null;
}

function validateForm(values: CompanyFormValues): FieldErrors {
  const errors: FieldErrors = {};
  errors.name = getNameError(values.name);
  if (!values.segment) errors.segment = "Escolha o segmento mais próximo.";
  if (!values.salesChannel) errors.salesChannel = "Escolha como você vende.";
  if (values.cnpj) errors.cnpj = getCnpjError(values.cnpj);
  return errors;
}

function toCompanyInput(values: CompanyFormValues): CompanyInput {
  const cnpj = extractCnpjDigits(values.cnpj);
  return {
    name: values.name.trim(),
    segment: values.segment as CompanySegment,
    salesChannel: values.salesChannel as CompanySalesChannel,
    annualRevenueRange: values.annualRevenueRange || null,
    cnpj: cnpj || null,
  };
}

// The server answers 400 validation_failed with `fields`; read it from the error details
function readServerFieldErrors(caught: unknown): FieldErrors {
  if (!isApiError(caught) || caught.code !== "validation_failed") return {};
  const details = caught.details as { fields?: Record<string, string> } | undefined;
  const fields = details?.fields ?? {};
  return Object.fromEntries(FIELD_ORDER.filter((key) => fields[key]).map((key) => [key, fields[key]]));
}

function FieldError({ id, error }: { id: string; error?: string | null }) {
  return (
    <p id={id} aria-live="polite" className="min-h-[1.25em] text-xs text-danger">
      {error ?? null}
    </p>
  );
}

interface ChoiceOptionProps {
  name: string;
  checked: boolean;
  onSelect: () => void;
  children: ReactNode;
}

function ChoiceOption({ name, checked, onSelect, children }: ChoiceOptionProps) {
  return (
    <label
      className={cn(
        "flex min-h-(--touch) cursor-pointer items-center gap-3 rounded-md border border-line-strong bg-surface px-3 py-2 text-sm",
        "hover:border-text-soft has-checked:border-bronze has-checked:bg-wash",
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="size-4 shrink-0 accent-(--bronze)" />
      <span>{children}</span>
    </label>
  );
}

interface SelectFieldProps<Key extends string> {
  id: string;
  name: string;
  label: string;
  optional?: boolean;
  placeholder: string;
  options: readonly CompanyOption<Key>[];
  value: Key | "";
  onValueChange: (value: Key | "") => void;
  error?: string | null;
}

function SelectField<Key extends string>(props: SelectFieldProps<Key>) {
  const { id, name, label, optional, placeholder, options, value, onValueChange, error } = props;
  const errorId = `${id}-error`;
  return (
    <div className="mb-4 flex flex-col gap-1">
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-text-muted"> (opcional)</span> : null}
      </Label>
      <select
        id={id}
        name={name}
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => onValueChange(event.target.value as Key | "")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldError id={errorId} error={error} />
    </div>
  );
}

interface SalesChannelFieldProps {
  name: string;
  value: CompanySalesChannel | "";
  onValueChange: (value: CompanySalesChannel) => void;
  error?: string | null;
}

function SalesChannelField({ name, value, onValueChange, error }: SalesChannelFieldProps) {
  const errorId = `${name}-error`;
  return (
    <fieldset className="mb-4 border-0 p-0" aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5 text-sm font-medium">Como você vende</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {SALES_CHANNEL_OPTIONS.map((option) => (
          <ChoiceOption key={option.key} name={name} checked={value === option.key} onSelect={() => onValueChange(option.key)}>
            {option.label}
          </ChoiceOption>
        ))}
      </div>
      <FieldError id={errorId} error={error} />
    </fieldset>
  );
}

// Form state and submit: client validation first, then the API. Server field errors land on the
// same fields; anything else shows under the form.
function useCompanyForm(company: Company | null | undefined, onSaved: (company: Company) => void, onBusyChange: (busy: boolean) => void) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState(() => toFormValues(company));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function setValue<Key extends keyof CompanyFormValues>(key: Key, value: CompanyFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
    // Text fields re-validate themselves while an error is shown; a choice clears on pick
    if (key !== "name" && key !== "cnpj") setErrors((current) => ({ ...current, [key]: null }));
  }

  function setFieldError(key: FieldKey) {
    return (error: string | null) => setErrors((current) => ({ ...current, [key]: error }));
  }

  function focusFirstInvalid() {
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }

  function setBusy(busy: boolean) {
    setIsSaving(busy);
    onBusyChange(busy);
  }

  async function save() {
    setBusy(true);
    try {
      const input = toCompanyInput(values);
      const saved = company ? await updateCompany(company.id, input) : await createCompany(input);
      onBusyChange(false);
      onSaved(saved);
    } catch (caught) {
      setBusy(false);
      const serverErrors = readServerFieldErrors(caught);
      if (Object.keys(serverErrors).length === 0) {
        setFormError(caught instanceof Error && caught.message ? caught.message : SAVE_ERROR);
        return;
      }
      setErrors(serverErrors);
      focusFirstInvalid();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const nextErrors = validateForm(values);
    setErrors(nextErrors);
    setFormError(null);
    if (Object.values(nextErrors).some(Boolean)) {
      focusFirstInvalid();
      return;
    }
    void save();
  }

  return { formRef, values, errors, formError, isSaving, setValue, setFieldError, handleSubmit };
}

interface CompanyFormProps {
  company?: Company | null;
  onSaved: (company: Company) => void;
  onBusyChange: (busy: boolean) => void;
}

function CompanyChoiceFields({ prefix, form }: { prefix: string; form: ReturnType<typeof useCompanyForm> }) {
  const { values, errors, setValue } = form;
  return (
    <>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <SelectField
          id={`${prefix}segment`}
          name="segment"
          label="Segmento"
          placeholder="Escolha"
          options={SEGMENT_OPTIONS}
          value={values.segment}
          onValueChange={(value) => setValue("segment", value)}
          error={errors.segment}
        />
        <SelectField
          id={`${prefix}revenue`}
          name="annualRevenueRange"
          label="Faturamento por ano"
          optional
          placeholder="Prefiro não informar"
          options={ANNUAL_REVENUE_RANGE_OPTIONS}
          value={values.annualRevenueRange}
          onValueChange={(value) => setValue("annualRevenueRange", value)}
          error={errors.annualRevenueRange}
        />
      </div>
      <SalesChannelField
        name={`${prefix}salesChannel`}
        value={values.salesChannel}
        onValueChange={(value) => setValue("salesChannel", value)}
        error={errors.salesChannel}
      />
    </>
  );
}

function CompanyForm({ company, onSaved, onBusyChange }: CompanyFormProps) {
  const prefix = useId();
  const form = useCompanyForm(company, onSaved, onBusyChange);
  const { values, errors, isSaving, setValue, setFieldError } = form;
  const isEdit = Boolean(company);

  return (
    <form ref={form.formRef} noValidate onSubmit={form.handleSubmit} className="mt-4" data-aioson-id={isEdit ? "company-edit-form" : "company-create-form"}>
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
      <CompanyChoiceFields prefix={prefix} form={form} />
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
        <p role="alert" className="text-sm text-danger">
          {form.formError}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel aria-disabled={isSaving || undefined} onClick={(event) => isSaving && event.preventDefault()}>
          Cancelar
        </AlertDialogCancel>
        <Button type="submit" variant="metal" aria-disabled={isSaving || undefined} data-aioson-id={isEdit ? "company-edit-submit" : "company-create-submit"}>
          {isSaving ? "Salvando…" : isEdit ? "Salvar alterações" : "Cadastrar empresa"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

function CompanyFormDialog({ open, onOpenChange, company, onSaved }: CompanyFormDialogProps) {
  const [isBusy, setIsBusy] = useState(false);

  function handleOpenChange(next: boolean) {
    // Esc and Cancel cannot drop a save that is already running
    if (!next && isBusy) return;
    onOpenChange(next);
  }

  function handleSaved(saved: Company) {
    setIsBusy(false);
    onOpenChange(false);
    onSaved(saved);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-aioson-id={company ? "company-edit-modal" : "company-create-modal"} className="w-[min(720px,calc(100%-32px))]">
        <AlertDialogHeader>
          <AlertDialogTitle>{company ? `Editar ${company.name}` : "Nova empresa"}</AlertDialogTitle>
          <AlertDialogDescription>
            {company ? "Altere o que mudou. Os diagnósticos da empresa continuam como estão." : "Quatro informações e você já pode começar o diagnóstico."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* Mounted only while open, so every opening starts from the company's saved values */}
        <CompanyForm company={company} onBusyChange={setIsBusy} onSaved={handleSaved} />
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { CompanyFormDialog };
export type { CompanyFormDialogProps };
