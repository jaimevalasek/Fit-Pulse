import { useEffect, useLayoutEffect, useReducer, useRef, useState, type ChangeEvent, type ComponentProps, type FocusEvent, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldValidator = (value: string) => string | null;

interface TextFieldProps extends Omit<ComponentProps<typeof Input>, "id" | "value"> {
  id: string;
  label: ReactNode;
  value: string;
  onValueChange?: (value: string) => void;
  hint?: ReactNode;
  // Adds "(opcional)" next to the label
  optional?: boolean;
  // With onErrorChange the parent owns the error; without it the field keeps its own copy,
  // seeded from this prop (e.g. the error returned by a submit)
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  // Runs on blur, and on every change while an error is shown so fixing the value clears it
  validate?: FieldValidator;
  // Marks a complete, valid value (patina border)
  valid?: boolean;
  className?: string;
  inputClassName?: string;
}

function useFieldError(error: string | null | undefined, onErrorChange?: (error: string | null) => void) {
  const controlled = onErrorChange !== undefined;
  const [ownError, setOwnError] = useState<string | null>(error ?? null);
  const [seededFrom, setSeededFrom] = useState(error);
  if (!controlled && error !== seededFrom) {
    setSeededFrom(error);
    setOwnError(error ?? null);
  }
  const current = controlled ? (error ?? null) : ownError;

  function setError(next: string | null) {
    if (next === current) return;
    if (!controlled) setOwnError(next);
    onErrorChange?.(next);
  }

  return [current, setError] as const;
}

// Re-validates when the value changes while an error is shown: correcting the field clears it.
// Masked fields change the value after the keystroke, so this follows the value, not the event.
function useRevalidateOnChange(
  value: string,
  currentError: string | null,
  setError: (error: string | null) => void,
  validate?: FieldValidator,
) {
  const lastValue = useRef(value);
  useEffect(() => {
    if (lastValue.current === value) return;
    lastValue.current = value;
    if (currentError !== null) setError(validate ? validate(value) : null);
  });
}

// For masked fields: call `keepCaret(position)` in onChange with the caret the mask returned; it is
// restored after React writes the masked value. The forced render covers a keystroke the mask
// rejects, where the value does not change and React would otherwise leave the caret at the end.
function useCaretRestore() {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);
  const [, forceRender] = useReducer((count: number) => count + 1, 0);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    if (input && caret !== null && input.ownerDocument.activeElement === input) {
      input.setSelectionRange(caret, caret);
    }
  });

  function keepCaret(position: number) {
    pendingCaret.current = position;
    forceRender();
  }

  return { inputRef, keepCaret };
}

// The blur error is skipped when the focus goes to the submit button: the submit validates
// anyway, and an error appearing mid-click would move the button away from the pointer.
function isMovingToSubmit(event: FocusEvent<HTMLInputElement>): boolean {
  const next = event.relatedTarget;
  if (!(next instanceof HTMLElement)) return false;
  if (next.closest("[data-skip-blur-validation]")) return true;
  return next instanceof HTMLButtonElement && next.type === "submit" && next.form === event.currentTarget.form;
}

interface FieldMessagesProps {
  errorId: string;
  error: string | null;
  hintId: string;
  hint?: ReactNode;
}

// The error line is always reserved, so a message never shifts what sits below it
function FieldMessages({ errorId, error, hintId, hint }: FieldMessagesProps) {
  return (
    <>
      <p id={errorId} aria-live="polite" className="flex min-h-[1.25em] items-center gap-1 text-xs text-danger">
        {error ? (
          <>
            <FieldErrorIcon />
            {error}
          </>
        ) : null}
      </p>
      {hint ? (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </>
  );
}

function FieldErrorIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" strokeLinecap="round" />
    </svg>
  );
}

function TextField({
  id,
  label,
  value,
  onValueChange,
  onChange,
  onBlur,
  hint,
  optional = false,
  error,
  onErrorChange,
  validate,
  valid = false,
  className,
  inputClassName,
  ...inputProps
}: TextFieldProps) {
  const [currentError, setError] = useFieldError(error, onErrorChange);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  useRevalidateOnChange(value, currentError, setError, validate);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event);
    onValueChange?.(event.target.value);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    onBlur?.(event);
    if (validate && !isMovingToSubmit(event)) setError(validate(event.currentTarget.value));
  }

  const describedBy = [currentError ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div data-slot="text-field" className={cn("mb-4 flex flex-col gap-1", className)}>
      <Label htmlFor={id}>
        {label}
        {optional ? <span className="font-normal text-text-muted"> (opcional)</span> : null}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-invalid={currentError ? true : undefined}
        aria-describedby={describedBy || undefined}
        data-valid={valid && !currentError ? true : undefined}
        className={inputClassName}
        {...inputProps}
      />
      <FieldMessages errorId={errorId} error={currentError} hintId={hintId} hint={hint} />
    </div>
  );
}

export { TextField, useCaretRestore };
export type { FieldValidator, TextFieldProps };
