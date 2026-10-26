import type { ChangeEvent } from "react";
import { TextField, useCaretRestore, type TextFieldProps } from "@/components/form/TextField";
import { DATE_MASK_LENGTH, getDateError, maskDateInput } from "../../../shared/format/dates";

type MaskOwnedProps = "value" | "onValueChange" | "onChange" | "validate" | "valid" | "type" | "inputMode" | "maxLength" | "ref";

interface DateFieldProps extends Omit<TextFieldProps, MaskOwnedProps> {
  // The masked value, e.g. "15/11/2026"; convert it with dateInputToIso before sending it
  value: string;
  onValueChange: (maskedValue: string) => void;
}

// Date with the DD/MM/AAAA mask while typing; an impossible date is refused when the field loses focus
function DateField({ value, onValueChange, ...props }: DateFieldProps) {
  const { inputRef, keepCaret } = useCaretRestore();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const masked = maskDateInput(event.target.value, event.target.selectionStart ?? undefined, value);
    keepCaret(masked.caret);
    onValueChange(masked.value);
  }

  return (
    <TextField
      placeholder="DD/MM/AAAA"
      autoComplete="off"
      inputClassName="font-mono"
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={DATE_MASK_LENGTH}
      value={value}
      onChange={handleChange}
      validate={getDateError}
      valid={value.length === DATE_MASK_LENGTH && getDateError(value) === null}
    />
  );
}

export { DateField };
export type { DateFieldProps };
