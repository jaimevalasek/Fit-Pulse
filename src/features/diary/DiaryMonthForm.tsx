import { useId, useState, type FormEvent } from "react";
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
import { MoneyField } from "@/components/form/MoneyField";
import { MonthField } from "@/components/form/MonthField";
import { TextField } from "@/components/form/TextField";
import { isApiError } from "@/api/httpClient";
import { addDiaryMonth, updateDiaryMonth, type DiaryEntryView, type DiarySpendParts, type DiaryView } from "@/api/diaryApi";
import { SPEND_PART_OPTIONS } from "../../../shared/content/calculatorOptions";
import {
  DIARY_CUSTOMERS_EMPTY_MESSAGE,
  DIARY_MAX_NEW_CUSTOMERS,
  DIARY_MAX_SPEND_CENTS,
  DIARY_SPEND_EMPTY_MESSAGE,
  DIARY_TOTAL_EMPTY_MESSAGE,
  diaryMonthTakenMessage,
} from "../../../shared/domain/diary";
import { formatMonthLong, getMonthError, isoToMonthInput, localIsoMonth, monthInputToIso } from "../../../shared/format/dates";
import type { SpendPartKey } from "../../../shared/domain/types";

const SPEND_MAX_MESSAGE = "Use um valor de até R$ 99.999.999,99.";
const SAVE_ERROR = "Não foi possível anotar o mês. Tente de novo.";

// "month", "newCustomers", "spend" (no part filled), "spendTotalCents" or "spendParts.<part>"
type FieldErrors = Partial<Record<string, string>>;

interface DiaryMonthDialogProps {
  companyId: string;
  // null closes the dialog; "new" notes a month; an entry edits that month
  target: DiaryEntryView | "new" | null;
  // Months already noted, YYYY-MM: a new month cannot repeat one (AC-ra-39)
  takenMonths: readonly string[];
  onClose: () => void;
  onSaved: (view: DiaryView, month: string) => void;
}

function shiftMonth(iso: string, delta: number): string {
  const [year, month] = iso.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

// The month after the newest one noted, or the last closed month when nothing is noted; never a future month
function suggestMonth(takenMonths: readonly string[]): string {
  const current = localIsoMonth(new Date());
  if (!current) return "";
  const newest = [...takenMonths].sort().at(-1);
  const next = newest ? shiftMonth(newest, 1) : shiftMonth(current, -1);
  return next > current || takenMonths.includes(next) ? "" : isoToMonthInput(next);
}

function readServerErrors(caught: unknown): FieldErrors | null {
  if (!isApiError(caught) || (caught.code !== "validation_failed" && caught.code !== "month_taken")) return null;
  const fields = (caught.details as { fields?: Record<string, string> } | undefined)?.fields ?? {};
  const errors: FieldErrors = { ...fields };
  if (fields.spendParts) errors.spend = fields.spendParts;
  return Object.keys(errors).length > 0 ? errors : null;
}

function validate(form: DiaryMonthFormState, isEdit: boolean, takenMonths: readonly string[]): FieldErrors {
  const errors: FieldErrors = {};
  if (!isEdit) {
    const monthError = getMonthError(form.month, localIsoMonth(new Date()) ?? "");
    const iso = monthInputToIso(form.month);
    if (monthError) errors.month = monthError;
    else if (iso && takenMonths.includes(iso)) errors.month = diaryMonthTakenMessage(iso);
  }
  if (form.newCustomers === "") errors.newCustomers = DIARY_CUSTOMERS_EMPTY_MESSAGE;
  if (form.totalOnly) {
    if (form.totalCents === null) errors.spendTotalCents = DIARY_TOTAL_EMPTY_MESSAGE;
    else if (form.totalCents > DIARY_MAX_SPEND_CENTS) errors.spendTotalCents = SPEND_MAX_MESSAGE;
    return errors;
  }
  const filled = SPEND_PART_OPTIONS.filter((part) => form.parts[part.key] !== undefined);
  if (filled.length === 0) errors.spend = DIARY_SPEND_EMPTY_MESSAGE;
  for (const part of filled) {
    if ((form.parts[part.key] ?? 0) > DIARY_MAX_SPEND_CENTS) errors[`spendParts.${part.key}`] = SPEND_MAX_MESSAGE;
  }
  return errors;
}

interface DiaryMonthFormState {
  month: string;
  newCustomers: string;
  totalOnly: boolean;
  parts: DiarySpendParts;
  totalCents: number | null;
}

function initialState(entry: DiaryEntryView | null, takenMonths: readonly string[]): DiaryMonthFormState {
  if (!entry) return { month: suggestMonth(takenMonths), newCustomers: "", totalOnly: false, parts: {}, totalCents: null };
  return {
    month: isoToMonthInput(entry.month),
    newCustomers: String(entry.newCustomers),
    totalOnly: entry.spendParts === null,
    parts: { ...(entry.spendParts ?? {}) },
    totalCents: entry.spendParts === null ? entry.spendTotalCents : null,
  };
}

// Order the first error is focused in, top to bottom
const FOCUS_ORDER = ["month", "newCustomers", "spendTotalCents", "spend", ...SPEND_PART_OPTIONS.map((part) => `spendParts.${part.key}`)];

type FormProps = Omit<DiaryMonthDialogProps, "target"> & { entry: DiaryEntryView | null };

function useDiaryMonthForm({ companyId, entry, takenMonths, onClose, onSaved }: FormProps) {
  const baseId = useId();
  const [form, setForm] = useState(() => initialState(entry, takenMonths));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fieldId = (key: string) => `${baseId}-${key.replace(".", "-")}`;
  const errorSetter = (key: string) => (error: string | null) => setErrors((current) => ({ ...current, [key]: error ?? undefined }));
  const update = (patch: Partial<DiaryMonthFormState>) => setForm((current) => ({ ...current, ...patch }));

  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = FOCUS_ORDER.find((key) => next[key]);
    const target = first === "spend" ? `spendParts.${SPEND_PART_OPTIONS[0].key}` : first;
    if (target) document.getElementById(fieldId(target))?.focus();
  }

  function setPart(key: SpendPartKey, cents: number | null) {
    setForm((current) => {
      const parts = { ...current.parts };
      if (cents === null) delete parts[key];
      else parts[key] = cents;
      return { ...current, parts };
    });
    setErrors((current) => ({ ...current, spend: undefined }));
  }

  function setTotalOnly(totalOnly: boolean) {
    update({ totalOnly });
    setErrors((current) => ({ ...current, spend: undefined, spendTotalCents: undefined }));
  }

  async function save() {
    const spend = form.totalOnly ? { spendTotalCents: form.totalCents ?? 0 } : { spendParts: form.parts };
    const values = { newCustomers: Number(form.newCustomers), ...spend };
    const month = entry ? entry.month : (monthInputToIso(form.month) ?? "");
    setSaving(true);
    setFormError(null);
    try {
      const view = entry ? await updateDiaryMonth(companyId, month, values) : await addDiaryMonth(companyId, { month, ...values });
      onSaved(view, month);
      onClose();
    } catch (caught) {
      setSaving(false);
      const serverErrors = readServerErrors(caught);
      if (serverErrors) showErrors(serverErrors);
      else setFormError(isApiError(caught) && caught.status < 500 && caught.message ? caught.message : SAVE_ERROR);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const found = validate(form, entry !== null, takenMonths);
    if (Object.values(found).some(Boolean)) showErrors(found);
    else void save();
  }

  return { baseId, form, errors, saving, formError, fieldId, errorSetter, update, setPart, setTotalOnly, handleSubmit };
}

type DiaryMonthFormModel = ReturnType<typeof useDiaryMonthForm>;

function MonthAndCustomersFields({ model, isEdit }: { model: DiaryMonthFormModel; isEdit: boolean }) {
  const { form, errors, fieldId, errorSetter, update } = model;
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
      <MonthField
        id={fieldId("month")}
        label="Mês"
        value={form.month}
        onValueChange={(month) => update({ month })}
        readOnly={isEdit}
        error={errors.month ?? null}
        onErrorChange={errorSetter("month")}
        hint={isEdit ? "Para mudar o mês, exclua e anote de novo." : "O mês que fechou ou o atual, nunca um mês que ainda não chegou."}
        data-aioson-id="month-month"
      />
      <TextField
        id={fieldId("newCustomers")}
        label="Clientes novos no mês"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={String(DIARY_MAX_NEW_CUSTOMERS).length}
        inputClassName="font-mono"
        value={form.newCustomers}
        onValueChange={(raw) => update({ newCustomers: raw.replace(/\D/g, "") })}
        error={errors.newCustomers ?? null}
        onErrorChange={errorSetter("newCustomers")}
        validate={(value) => (value === "" ? DIARY_CUSTOMERS_EMPTY_MESSAGE : null)}
        hint="Só quem comprou pela primeira vez. Pode ser 0."
        data-aioson-id="month-customers"
      />
    </div>
  );
}

function TotalOnlySwitch({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <label className="mb-4 flex min-h-(--touch) cursor-pointer items-start gap-3 rounded-md border border-line px-3 py-2.5 has-checked:border-bronze has-checked:bg-wash">
      <input
        type="checkbox"
        className="mt-1 size-4 accent-bronze"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        data-aioson-id="month-total-only"
      />
      <span>
        <span className="block font-semibold">Só sei o total do gasto</span>
        <span className="block text-sm text-text-muted">Sem separar por parte. O custo por cliente sai igual.</span>
      </span>
    </label>
  );
}

function SpendPartsFields({ model }: { model: DiaryMonthFormModel }) {
  const { baseId, form, errors, fieldId, errorSetter, setPart } = model;
  const spendErrorId = `${baseId}-spend-error`;
  return (
    <fieldset aria-describedby={errors.spend ? spendErrorId : undefined} data-aioson-id="month-parts">
      <legend className="mb-2 text-sm font-semibold">Gasto para atrair clientes no mês</legend>
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        {SPEND_PART_OPTIONS.map((part) => (
          <MoneyField
            key={part.key}
            id={fieldId(`spendParts.${part.key}`)}
            label={part.label}
            inputClassName="font-mono"
            cents={form.parts[part.key] ?? null}
            onCentsChange={(cents) => setPart(part.key, cents)}
            error={errors[`spendParts.${part.key}`] ?? null}
            onErrorChange={errorSetter(`spendParts.${part.key}`)}
            validate={(cents) => (cents !== null && cents > DIARY_MAX_SPEND_CENTS ? SPEND_MAX_MESSAGE : null)}
          />
        ))}
      </div>
      <p className="text-sm text-text-muted">As mesmas 6 partes do bloco "Seus números" do diagnóstico. Deixe em branco o que não teve.</p>
      <p id={spendErrorId} aria-live="polite" className="mt-1 min-h-[1.25em] text-sm text-danger" data-aioson-id="month-spend-error">
        {errors.spend ?? null}
      </p>
    </fieldset>
  );
}

function SpendTotalField({ model }: { model: DiaryMonthFormModel }) {
  const { form, errors, fieldId, errorSetter, update } = model;
  return (
    <MoneyField
      id={fieldId("spendTotalCents")}
      label="Gasto total do mês"
      className="max-w-[320px]"
      inputClassName="font-mono"
      cents={form.totalCents}
      onCentsChange={(totalCents) => update({ totalCents })}
      error={errors.spendTotalCents ?? null}
      onErrorChange={errorSetter("spendTotalCents")}
      validate={(cents) => (cents === null ? DIARY_TOTAL_EMPTY_MESSAGE : cents > DIARY_MAX_SPEND_CENTS ? SPEND_MAX_MESSAGE : null)}
      data-aioson-id="month-total"
    />
  );
}

function DiaryMonthForm(props: FormProps) {
  const model = useDiaryMonthForm(props);
  const { form, saving, formError } = model;
  return (
    <form noValidate onSubmit={model.handleSubmit} className="mt-4" data-aioson-id="month-form">
      <MonthAndCustomersFields model={model} isEdit={props.entry !== null} />
      <TotalOnlySwitch checked={form.totalOnly} onCheckedChange={model.setTotalOnly} />
      {form.totalOnly ? <SpendTotalField model={model} /> : <SpendPartsFields model={model} />}
      {formError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel aria-disabled={saving || undefined} onClick={(event) => saving && event.preventDefault()}>
          Cancelar
        </AlertDialogCancel>
        <Button type="submit" variant="metal" aria-disabled={saving || undefined} data-aioson-id="month-save">
          {saving ? "Salvando…" : props.entry ? "Salvar" : "Anotar mês"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

// "Anotar um mês" and "Editar": month, new customers and the spend in the 6 parts or as one total (AC-ra-38, AC-ra-40)
function DiaryMonthDialog({ target, ...props }: DiaryMonthDialogProps) {
  const entry = target === "new" ? null : target;
  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && props.onClose()}>
      {target !== null ? (
        <AlertDialogContent data-aioson-id="month-modal" className="max-h-[calc(100dvh-32px)] w-[min(680px,calc(100%-32px))] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{entry ? `Editar ${formatMonthLong(entry.month)}` : "Anotar um mês"}</AlertDialogTitle>
            <AlertDialogDescription>Quanto foi gasto para atrair clientes e quantos clientes novos vieram.</AlertDialogDescription>
          </AlertDialogHeader>
          <DiaryMonthForm key={entry?.month ?? "new"} entry={entry} {...props} />
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}

export { DiaryMonthDialog };
export type { DiaryMonthDialogProps };
