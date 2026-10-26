import type { ChangeEvent } from "react";
import { TextField, useCaretRestore, type TextFieldProps } from "@/components/form/TextField";
import { getPhoneError, isValidPhone, maskPhoneInput, PHONE_MASK_MAX_LENGTH } from "../../../shared/format/phone";

type MaskOwnedProps = "value" | "onValueChange" | "onChange" | "validate" | "valid" | "type" | "inputMode" | "maxLength" | "ref";

interface PhoneFieldProps extends Omit<TextFieldProps, MaskOwnedProps | "label"> {
  label?: TextFieldProps["label"];
  // The masked value, e.g. "(11) 91234-5678" or "(11) 1234-5678"
  value: string;
  onValueChange: (maskedValue: string) => void;
}

// Landline or mobile phone with the mask following the first digit after the area code, validated on blur.
function PhoneField({ label = "Telefone", optional = true, value, onValueChange, ...props }: PhoneFieldProps) {
  const { inputRef, keepCaret } = useCaretRestore();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const masked = maskPhoneInput(event.target.value, event.target.selectionStart ?? undefined, value);
    keepCaret(masked.caret);
    onValueChange(masked.value);
  }

  return (
    <TextField
      label={label}
      optional={optional}
      placeholder="(11) 91234-5678"
      autoComplete="tel"
      {...props}
      ref={inputRef}
      type="text"
      inputMode="tel"
      maxLength={PHONE_MASK_MAX_LENGTH}
      value={value}
      onChange={handleChange}
      validate={getPhoneError}
      valid={isValidPhone(value)}
    />
  );
}

export { PhoneField };
export type { PhoneFieldProps };
