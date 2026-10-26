import type { ChangeEvent } from "react";
import { TextField, useCaretRestore, type TextFieldProps } from "@/components/form/TextField";
import { CNPJ_MASK_LENGTH, getCnpjError, isValidCnpj, maskCnpjInput } from "../../../shared/format/cnpj";

type MaskOwnedProps = "value" | "onValueChange" | "onChange" | "validate" | "valid" | "type" | "inputMode" | "maxLength" | "ref";

interface CnpjFieldProps extends Omit<TextFieldProps, MaskOwnedProps | "label"> {
  label?: TextFieldProps["label"];
  // The masked value, e.g. "11.222.333/0001-81"; extract the 14 digits before sending it
  value: string;
  onValueChange: (maskedValue: string) => void;
}

// CNPJ with the 00.000.000/0000-00 mask while typing and the check digits validated on blur.
function CnpjField({ label = "CNPJ", optional = true, value, onValueChange, ...props }: CnpjFieldProps) {
  const { inputRef, keepCaret } = useCaretRestore();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const masked = maskCnpjInput(event.target.value, event.target.selectionStart ?? undefined, value);
    keepCaret(masked.caret);
    onValueChange(masked.value);
  }

  return (
    <TextField
      label={label}
      optional={optional}
      placeholder="00.000.000/0000-00"
      autoComplete="off"
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      maxLength={CNPJ_MASK_LENGTH}
      value={value}
      onChange={handleChange}
      validate={getCnpjError}
      valid={isValidCnpj(value)}
    />
  );
}

export { CnpjField };
export type { CnpjFieldProps };
