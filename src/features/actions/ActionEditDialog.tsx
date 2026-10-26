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
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/form/DateField";
import { updateAction, type ActionProgress } from "@/api/actionsApi";
import { cn } from "@/lib/utils";
import { ACTION_OWNER_ROLE_OPTIONS } from "../../../shared/content/actionProgressOptions";
import { getActionInfo } from "../../../shared/content/actionCatalog";
import { ACTION_NOTE_MAX_LENGTH, type ActionOwnerRole } from "../../../shared/domain/actionProgress";
import { dateInputToIso, getDateError, isoToDateInput } from "../../../shared/format/dates";
import { describeSaveError } from "./useActionStatus";

interface ActionEditDialogProps {
  // The action being edited; null keeps the dialog closed
  action: ActionProgress | null;
  onClose: () => void;
  onSaved: (updated: ActionProgress) => void;
}

const CONTROL_CLASS = cn(
  "w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text",
  "hover:border-text-soft focus:border-bronze",
);

interface ChoiceFieldProps<Value> {
  id: string;
  value: Value;
  onChange: (value: Value) => void;
}

function OwnerRoleField({ id, value, onChange }: ChoiceFieldProps<ActionOwnerRole | "">) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <Label htmlFor={id}>Responsável</Label>
      <select
        id={id}
        className={cn(CONTROL_CLASS, "h-(--control) max-sm:h-(--touch)")}
        value={value}
        onChange={(event) => onChange(event.target.value as ActionOwnerRole | "")}
        aria-describedby={`${id}-hint`}
        data-aioson-id="action-edit-role"
      >
        <option value="">Ninguém definido</option>
        {ACTION_OWNER_ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span id={`${id}-hint`} className="text-sm text-text-muted">
        Por papel, sem nome de pessoa.
      </span>
    </div>
  );
}

function NoteField({ id, value, onChange }: ChoiceFieldProps<string>) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <Label htmlFor={id}>
        Nota <span className="font-normal text-text-muted">(opcional)</span>
      </Label>
      <textarea
        id={id}
        className={cn(CONTROL_CLASS, "min-h-28 py-2")}
        maxLength={ACTION_NOTE_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-count`}
        data-aioson-id="action-edit-note"
      />
      <span id={`${id}-count`} className="self-end font-mono text-sm text-text-muted" data-aioson-id="action-edit-note-count">
        {value.length}/{ACTION_NOTE_MAX_LENGTH}
      </span>
    </div>
  );
}

// The form state; saving sends only this action's deadline, role and note (AC-ra-28)
function useActionEditForm(action: ActionProgress, dueFieldId: string, onSaved: (updated: ActionProgress) => void) {
  const [dueDate, setDueDate] = useState(() => isoToDateInput(action.dueDate));
  const [dueError, setDueError] = useState<string | null>(null);
  const [ownerRole, setOwnerRole] = useState<ActionOwnerRole | "">(action.ownerRole ?? "");
  const [note, setNote] = useState(action.note ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const dateError = getDateError(dueDate);
    if (dateError) {
      setDueError(dateError);
      document.getElementById(dueFieldId)?.focus();
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const trimmedNote = note.trim();
      const updated = await updateAction(action.diagnosisId, action.actionKey, {
        dueDate: dueDate ? dateInputToIso(dueDate) : null,
        ownerRole: ownerRole || null,
        note: trimmedNote ? trimmedNote : null,
      });
      onSaved(updated);
    } catch (caught) {
      setSaving(false);
      setFormError(describeSaveError(caught));
    }
  }

  return { dueDate, setDueDate, dueError, setDueError, ownerRole, setOwnerRole, note, setNote, saving, formError, handleSubmit };
}

function ActionEditForm({ action, onClose, onSaved }: { action: ActionProgress } & Omit<ActionEditDialogProps, "action">) {
  const baseId = useId();
  const form = useActionEditForm(action, `${baseId}-due`, (updated) => {
    onSaved(updated);
    onClose();
  });

  return (
    <form noValidate onSubmit={form.handleSubmit} className="mt-4" data-aioson-id="action-edit-form">
      <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <DateField
          id={`${baseId}-due`}
          label="Prazo"
          optional
          value={form.dueDate}
          onValueChange={form.setDueDate}
          error={form.dueError}
          onErrorChange={form.setDueError}
          hint="Deixe em branco para ficar sem prazo."
          data-aioson-id="action-edit-due"
        />
        <OwnerRoleField id={`${baseId}-role`} value={form.ownerRole} onChange={form.setOwnerRole} />
      </div>
      <NoteField id={`${baseId}-note`} value={form.note} onChange={form.setNote} />
      {form.formError ? (
        <p role="alert" className="mb-4 text-sm text-danger">
          {form.formError}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel aria-disabled={form.saving || undefined} onClick={(event) => form.saving && event.preventDefault()}>
          Cancelar
        </AlertDialogCancel>
        <Button type="submit" variant="metal" aria-disabled={form.saving || undefined} data-aioson-id="action-edit-submit">
          {form.saving ? "Salvando…" : "Salvar"}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}

// "Editar": deadline with the DD/MM/AAAA mask, owner by role (never a person's name) and a note of up to 500 characters
function ActionEditDialog({ action, onClose, onSaved }: ActionEditDialogProps) {
  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => !open && onClose()}>
      {action ? (
        <AlertDialogContent data-aioson-id="action-edit-modal" className="w-[min(640px,calc(100%-32px))]">
          <AlertDialogHeader>
            <AlertDialogTitle>{getActionInfo(action.actionKey).title}</AlertDialogTitle>
            <AlertDialogDescription>Prazo, responsável e nota desta ação.</AlertDialogDescription>
          </AlertDialogHeader>
          <ActionEditForm key={`${action.diagnosisId}:${action.actionKey}`} action={action} onClose={onClose} onSaved={onSaved} />
        </AlertDialogContent>
      ) : null}
    </AlertDialog>
  );
}

export { ActionEditDialog };
export type { ActionEditDialogProps };
