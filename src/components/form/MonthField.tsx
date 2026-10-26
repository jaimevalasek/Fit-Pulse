import type { ChangeEvent } from "react";
import { TextField, useCaretRestore, type TextFieldProps } from "@/components/form/TextField";
import { MONTH_MASK_LENGTH, getMonthError, localIsoMonth, maskMonthInput } from "../../../shared/format/dates";

type MaskOwnedProps = "value" | "onValueChange" | "onChange" | "validate" | "valid" | "type" | "inputMode" | "maxLength" | "ref";

interface MonthFieldProps extends Omit<TextFieldProps, MaskOwnedProps> {
  // The masked value, e.g. "09/2026"; convert it with monthInputToIso before sending it
  value: string;
  onValueChange: (maskedValue: string) => void;
}

function validateMonth(value: string): string | null {
  return getMonthError(value, localIsoMonth(new Date()) ?? "");
}

// Month with the MM/AAAA mask while typing; an invalid or future month is refused when the field loses focus.
// A read-only field (editing a month, RULE-ra-08) shows the value and is never validated.
function MonthField({ value, onValueChange, readOnly, ...props }: MonthFieldProps) {
  const { inputRef, keepCaret } = useCaretRestore();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const masked = maskMonthInput(event.target.value, event.target.selectionStart ?? undefined, value);
    keepCaret(masked.caret);
    onValueChange(masked.value);
  }

  return (
    <TextField
      placeholder="MM/AAAA"
      autoComplete="off"
      inputClassName="font-mono read-only:bg-surface read-only:text-text-soft"
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={MONTH_MASK_LENGTH}
      readOnly={readOnly}
      value={value}
      onChange={handleChange}
      validate={readOnly ? undefined : validateMonth}
      valid={!readOnly && value.length === MONTH_MASK_LENGTH && validateMonth(value) === null}
    />
  );
}

export { MonthField };
export type { MonthFieldProps };
