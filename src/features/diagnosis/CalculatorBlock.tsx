import { useId, useState, type ReactNode } from "react";
import { applyDiarySuggestion } from "@/api/diagnosesApi";
import { Button } from "@/components/ui/button";
import { MoneyField } from "@/components/form/MoneyField";
import { TextField } from "@/components/form/TextField";
import { cn } from "@/lib/utils";
import {
  CALCULATOR_FIELDS,
  NEW_CUSTOMERS_MODE_OPTIONS,
  NEW_CUSTOMERS_RANGE_OPTIONS,
  PURCHASES_PER_YEAR_OPTIONS,
  RELATIONSHIP_LENGTH_OPTIONS,
  SPEND_MODE_OPTIONS,
  SPEND_PART_OPTIONS,
  SPEND_RANGE_OPTIONS,
  type CalculatorFieldKey,
  type OptionLabel,
} from "../../../shared/content/calculatorOptions";
import { carryDiaryMarks, formatDiaryMark, isDiarySuggestionOffered } from "../../../shared/domain/diaryPrefill";
import { sumSpendParts } from "../../../shared/domain/unitEconomics";
import type { CalculatorInput, DiaryFieldSource, DiarySuggestion, EntryMode, SpendPartKey } from "../../../shared/domain/types";
import { formatMonthShort } from "../../../shared/format/dates";
import { formatMoney } from "../../../shared/format/money";
import { QuestionHeading } from "./AnchoredQuestion";
import type { CalculatorChangeOptions } from "./useDraftAutosave";

const NEW_CUSTOMERS_MAX = 1_000_000;
const MARGIN_MAX = 100;
const SELECT_CLASS = cn(
  "h-(--control) w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text",
  "hover:border-text-soft focus:border-bronze max-sm:h-(--touch)",
);
const MODE_CLASS = cn(
  "inline-flex min-h-(--touch) cursor-pointer items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm",
  "has-checked:border-bronze has-checked:bg-wash",
);

type CalculatorChange = (next: CalculatorInput, options?: CalculatorChangeOptions) => void;

function onlyDigits(text: string): string {
  return text.replace(/\D/g, "");
}

// A whole number typed by the owner; null when empty or above the limit
function readWhole(text: string, max: number): number | null {
  if (text === "") return null;
  const value = Number(text);
  return Number.isSafeInteger(value) && value <= max ? value : null;
}

function wholeToText(value: number | null): string {
  return typeof value === "number" && Number.isSafeInteger(value) ? String(value) : "";
}

function CalculatorItem({ field, helpLabel, children }: { field: CalculatorFieldKey; helpLabel?: string; children: (titleId: string) => ReactNode }) {
  const titleId = useId();
  const copy = CALCULATOR_FIELDS[field];
  return (
    <div className="border-b border-line py-6" data-aioson-id={`calc-${field}`}>
      <QuestionHeading title={copy.label} help={copy.help} helpLabel={helpLabel} titleId={titleId} />
      <div className="mt-3">{children(titleId)}</div>
    </div>
  );
}

interface ModeRowProps {
  name: string;
  labelledBy: string;
  options: readonly OptionLabel<EntryMode>[];
  value: EntryMode | null;
  onValueChange: (mode: EntryMode) => void;
}

function ModeRow({ name, labelledBy, options, value, onValueChange }: ModeRowProps) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="mb-3 flex flex-wrap gap-2">
      {options.map((option) => (
        <label key={option.key} className={MODE_CLASS}>
          <input
            type="radio"
            className="accent-bronze"
            name={name}
            value={option.key}
            checked={value === option.key}
            onChange={() => onValueChange(option.key)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

interface OptionSelectProps<Key extends string> {
  labelledBy: string;
  placeholder: string;
  options: readonly OptionLabel<Key>[];
  value: Key | null;
  onValueChange: (value: Key | null) => void;
}

function OptionSelect<Key extends string>({ labelledBy, placeholder, options, value, onValueChange }: OptionSelectProps<Key>) {
  return (
    <select
      aria-labelledby={labelledBy}
      className={cn(SELECT_CLASS, "max-w-sm")}
      value={value ?? ""}
      onChange={(event) => onValueChange(event.target.value === "" ? null : (event.target.value as Key))}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.key} value={option.key}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

interface WholeFieldProps {
  id: string;
  label: string;
  value: number | null;
  max: number;
  error: string;
  placeholder: string;
  hint?: string;
  onValueChange: (value: number | null) => void;
}

// Digits only; a value above the limit shows the error and is not kept
function WholeField({ id, label, value, max, error, placeholder, hint, onValueChange }: WholeFieldProps) {
  const [text, setText] = useState(() => wholeToText(value));
  return (
    <TextField
      id={id}
      label={<span className="sr-only">{label}</span>}
      className="max-w-[220px]"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={String(max).length}
      placeholder={placeholder}
      hint={hint}
      value={text}
      onValueChange={(raw) => {
        const digits = onlyDigits(raw);
        setText(digits);
        onValueChange(readWhole(digits, max));
      }}
      validate={(current) => (current !== "" && readWhole(current, max) === null ? error : null)}
    />
  );
}

interface CalculatorBlockProps {
  diagnosisId: string;
  calculator: CalculatorInput;
  onChange: CalculatorChange;
  // Sends the edits still waiting to be saved, so none lands after "Usar o diário" and drops its marks
  flushPending?: () => Promise<void>;
}

// "do diário: ago/2026 a out/2026" or "do diário: 2 meses, estimado" beside a number the diary filled in (AC-ra-44, AC-ra-45)
function DiaryMark({ source, dataId }: { source: DiaryFieldSource | undefined; dataId: string }) {
  if (!source) return null;
  return (
    <p className="mb-3 inline-flex items-center rounded-full border border-bronze/60 bg-wash px-2.5 py-0.5 text-xs font-medium text-text-soft" data-aioson-id={dataId}>
      {formatDiaryMark(source)}
    </p>
  );
}

// The diary gives a single total when one of its months has only the total
function hasSingleTotal(calculator: CalculatorInput): boolean {
  return typeof calculator.spendTotalCents === "number" && sumSpendParts(calculator.spendParts) === null;
}

function SpendTotalField({ calculator, onChange, onSplit }: Omit<CalculatorBlockProps, "diagnosisId"> & { onSplit: () => void }) {
  return (
    <div data-aioson-id="spend-single-total">
      <MoneyField
        id="spend-total-only"
        label="Total em 3 meses"
        className="max-w-[260px]"
        cents={calculator.spendTotalCents ?? null}
        onCentsChange={(spendTotalCents) => onChange({ ...calculator, spendTotalCents }, { typed: true })}
        hint="Um total único, sem divisão por parte: algum mês do diário tem só o total."
      />
      <Button type="button" variant="link" size="sm" className="min-h-(--touch) px-0" onClick={onSplit} data-aioson-id="spend-split-parts">
        Dividir por parte
      </Button>
    </div>
  );
}

function SpendItem({ diagnosisId, calculator, onChange }: CalculatorBlockProps) {
  const [singleTotal, setSingleTotal] = useState(() => hasSingleTotal(calculator));
  function splitByPart() {
    setSingleTotal(false);
    onChange({ ...calculator, spendTotalCents: null });
  }
  function setPart(key: SpendPartKey, cents: number | null) {
    const spendParts = { ...calculator.spendParts };
    if (cents === null) delete spendParts[key];
    else spendParts[key] = cents;
    onChange({ ...calculator, spendParts }, { typed: true });
  }
  return (
    <CalculatorItem field="spend" helpLabel="O que entra nesse gasto?">
      {(titleId) => (
        <>
          <DiaryMark source={calculator.diarySource?.spend} dataId="spend-diary-mark" />
          <ModeRow
            name={`${diagnosisId}-spendMode`}
            labelledBy={titleId}
            options={SPEND_MODE_OPTIONS}
            value={calculator.spendMode}
            onValueChange={(spendMode) => onChange({ ...calculator, spendMode })}
          />
          {calculator.spendMode === "exact" && singleTotal ? (
            <SpendTotalField calculator={calculator} onChange={onChange} onSplit={splitByPart} />
          ) : null}
          {calculator.spendMode === "exact" && !singleTotal ? (
            <div className="grid gap-x-4 sm:grid-cols-2">
              {SPEND_PART_OPTIONS.map((part) => (
                <MoneyField
                  key={part.key}
                  id={`spend-${part.key}`}
                  label={part.label}
                  cents={calculator.spendParts[part.key] ?? null}
                  onCentsChange={(cents) => setPart(part.key, cents)}
                />
              ))}
              <p className="flex justify-between gap-3 border-t border-line pt-2 font-semibold sm:col-span-2">
                <span>Total em 3 meses</span>
                <span className="font-mono" data-aioson-id="spend-total">
                  {formatMoney(sumSpendParts(calculator.spendParts) ?? 0)}
                </span>
              </p>
              <p className="mt-2 text-sm text-text-muted sm:col-span-2">
                Deixe em branco o que você não usa. Contar só o anúncio deixa o custo do cliente menor do que é.
              </p>
            </div>
          ) : null}
          {calculator.spendMode === "range" ? (
            <OptionSelect
              labelledBy={titleId}
              placeholder="Escolha uma faixa"
              options={SPEND_RANGE_OPTIONS}
              value={calculator.spendRange}
              onValueChange={(spendRange) => onChange({ ...calculator, spendRange })}
            />
          ) : null}
        </>
      )}
    </CalculatorItem>
  );
}

function NewCustomersItem({ diagnosisId, calculator, onChange }: CalculatorBlockProps) {
  return (
    <CalculatorItem field="newCustomers" helpLabel="Quem conta como cliente novo?">
      {(titleId) => (
        <>
          <DiaryMark source={calculator.diarySource?.newCustomers} dataId="new-customers-diary-mark" />
          <ModeRow
            name={`${diagnosisId}-newCustomersMode`}
            labelledBy={titleId}
            options={NEW_CUSTOMERS_MODE_OPTIONS}
            value={calculator.newCustomersMode}
            onValueChange={(newCustomersMode) => onChange({ ...calculator, newCustomersMode })}
          />
          {calculator.newCustomersMode === "exact" ? (
            <WholeField
              id="new-customers"
              label={CALCULATOR_FIELDS.newCustomers.label}
              value={calculator.newCustomers}
              max={NEW_CUSTOMERS_MAX}
              placeholder="Ex.: 40"
              error="Use um número de 0 a 1.000.000."
              onValueChange={(newCustomers) => onChange({ ...calculator, newCustomers }, { typed: true })}
            />
          ) : null}
          {calculator.newCustomersMode === "range" ? (
            <OptionSelect
              labelledBy={titleId}
              placeholder="Escolha uma faixa"
              options={NEW_CUSTOMERS_RANGE_OPTIONS}
              value={calculator.newCustomersRange}
              onValueChange={(newCustomersRange) => onChange({ ...calculator, newCustomersRange })}
            />
          ) : null}
        </>
      )}
    </CalculatorItem>
  );
}

function suggestionSpendCents(suggestion: DiarySuggestion): number {
  return sumSpendParts(suggestion.spendParts) ?? suggestion.spendTotalCents ?? 0;
}

interface DiarySuggestionOfferProps {
  diagnosisId: string;
  suggestion: DiarySuggestion;
  onApplied: (calculator: CalculatorInput) => void;
  beforeApply?: () => Promise<void>;
}

// 1 or 2 months in the diary: "Usar o diário" fills spend and new customers with the projection to 3 months,
// which counts as estimated (AC-ra-45). The server applies it and answers the whole draft.
function DiarySuggestionOffer({ diagnosisId, suggestion, onApplied, beforeApply }: DiarySuggestionOfferProps) {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const months = `${suggestion.monthCount} ${suggestion.monthCount === 1 ? "mês" : "meses"}`;
  const span =
    suggestion.fromMonth === suggestion.toMonth
      ? formatMonthShort(suggestion.toMonth)
      : `${formatMonthShort(suggestion.fromMonth)} a ${formatMonthShort(suggestion.toMonth)}`;

  async function apply() {
    if (applying) return;
    setApplying(true);
    setError(null);
    try {
      await beforeApply?.();
      const diagnosis = await applyDiarySuggestion(diagnosisId);
      onApplied(diagnosis.calculator);
    } catch {
      setError("Não foi possível usar o diário. Tente de novo.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <section aria-labelledby="diary-offer-title" className="mt-4 rounded-md border border-line bg-surface px-4 py-3" data-aioson-id="diary-suggestion">
      <h3 id="diary-offer-title" className="text-base font-semibold">
        Seu diário tem {months} ({span})
      </h3>
      <p className="mt-1 text-sm text-text-soft">
        Projetado para 3 meses: <span className="font-mono">{formatMoney(suggestionSpendCents(suggestion))}</span> de gasto e{" "}
        <span className="font-mono">{suggestion.newCustomers}</span> clientes novos. Entra marcado como “do diário: {months}, estimado”. Com 3
        meses anotados, o número passa a contar como medido.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="button" variant="metal" className="mt-3" aria-disabled={applying || undefined} onClick={() => void apply()} data-aioson-id="diary-use">
        {applying ? "Usando o diário…" : "Usar o diário"}
      </Button>
    </section>
  );
}

// Block 1 "Seus números": the six fields of the calculator, money in whole cents (CAP-dm-unit-economics).
// A number the diary filled in keeps its mark until it is edited by hand (AC-ra-46).
function CalculatorBlock({ diagnosisId, calculator, onChange: save, flushPending }: CalculatorBlockProps) {
  // Bumped when the diary replaces the numbers, so the fields that keep their own text start again from them
  const [diaryVersion, setDiaryVersion] = useState(0);
  const onChange: CalculatorChange = (next, options) => save(carryDiaryMarks(calculator, next), options);
  const props = { diagnosisId, calculator, onChange };

  function takeDiaryNumbers(next: CalculatorInput) {
    save(next);
    setDiaryVersion((version) => version + 1);
  }

  return (
    <div>
      {calculator.diarySuggestion && isDiarySuggestionOffered(calculator) ? (
        <DiarySuggestionOffer diagnosisId={diagnosisId} suggestion={calculator.diarySuggestion} onApplied={takeDiaryNumbers} beforeApply={flushPending} />
      ) : null}
      <SpendItem key={`spend-${diaryVersion}`} {...props} />
      <NewCustomersItem key={`customers-${diaryVersion}`} {...props} />
      <CalculatorItem field="averagePurchase">
        {() => (
          <MoneyField
            id="average-purchase"
            label={<span className="sr-only">{CALCULATOR_FIELDS.averagePurchase.label}</span>}
            className="max-w-[260px]"
            cents={calculator.averagePurchaseCents}
            onCentsChange={(averagePurchaseCents) => onChange({ ...calculator, averagePurchaseCents }, { typed: true })}
          />
        )}
      </CalculatorItem>
      <CalculatorItem field="purchasesPerYear">
        {(titleId) => (
          <OptionSelect
            labelledBy={titleId}
            placeholder="Escolha"
            options={PURCHASES_PER_YEAR_OPTIONS}
            value={calculator.purchasesPerYear}
            onValueChange={(purchasesPerYear) => onChange({ ...calculator, purchasesPerYear })}
          />
        )}
      </CalculatorItem>
      <CalculatorItem field="relationshipLength">
        {(titleId) => (
          <OptionSelect
            labelledBy={titleId}
            placeholder="Escolha"
            options={RELATIONSHIP_LENGTH_OPTIONS}
            value={calculator.relationshipLength}
            onValueChange={(relationshipLength) => onChange({ ...calculator, relationshipLength })}
          />
        )}
      </CalculatorItem>
      <CalculatorItem field="margin">
        {() => (
          <WholeField
            id="margin"
            label={CALCULATOR_FIELDS.margin.label}
            value={calculator.marginPercent}
            max={MARGIN_MAX}
            placeholder="Ex.: 35"
            hint="Digite só o número: 35 quer dizer que sobram R$ 35."
            error="Use um número de 0 a 100."
            onValueChange={(marginPercent) => onChange({ ...calculator, marginPercent }, { typed: true })}
          />
        )}
      </CalculatorItem>
    </div>
  );
}

export { CalculatorBlock };
export type { CalculatorBlockProps };
