import { useState, type ChangeEvent } from "react";
import { TextField, useCaretRestore, type TextFieldProps } from "@/components/form/TextField";
import { MONEY_MAX_CENTS, formatMoney, maskMoneyInput, parseMoney } from "../../../shared/format/money";

type MaskOwnedProps = "value" | "onValueChange" | "onChange" | "validate" | "type" | "inputMode" | "maxLength" | "ref";

interface MoneyFieldProps extends Omit<TextFieldProps, MaskOwnedProps> {
  // Whole cents (RULE-dm-12); null is an empty field
  cents: number | null;
  onCentsChange: (cents: number | null) => void;
  validate?: (cents: number | null) => string | null;
}

// "R$ 99.999.999.999,99": the longest value the mask produces
const MONEY_MASK_LENGTH = formatMoney(MONEY_MAX_CENTS).length;

function centsToText(cents: number | null): string {
  return typeof cents === "number" && Number.isSafeInteger(cents) ? formatMoney(cents) : "";
}

// Money in the R$ 1.234,56 mask; the field holds the text and reports whole cents.
function MoneyField({ cents, onCentsChange, validate, ...props }: MoneyFieldProps) {
  const { inputRef, keepCaret } = useCaretRestore();
  const [shown, setShown] = useState(() => ({ text: centsToText(cents), cents }));

  // A value set from outside (loading a draft, a reset) replaces what the field shows
  if (!Object.is(cents, shown.cents)) setShown({ text: centsToText(cents), cents });

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const masked = maskMoneyInput(event.target.value, event.target.selectionStart ?? undefined, shown.text);
    keepCaret(masked.caret);
    setShown({ text: masked.value, cents: masked.cents });
    if (!Object.is(masked.cents, shown.cents)) onCentsChange(masked.cents);
  }

  return (
    <TextField
      placeholder="R$ 0,00"
      autoComplete="off"
      {...props}
      ref={inputRef}
      type="text"
      inputMode="decimal"
      maxLength={MONEY_MASK_LENGTH}
      value={shown.text}
      onChange={handleChange}
      validate={validate ? (text) => validate(parseMoney(text)) : undefined}
    />
  );
}

export { MoneyField };
export type { MoneyFieldProps };
