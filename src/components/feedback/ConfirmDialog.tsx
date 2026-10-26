import { useState, type MouseEvent, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmTone = "destructive" | "gate" | "metal";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Names the action and the object, e.g. "Arquivar Academia Leste?"
  title: ReactNode;
  // What happens and whether it can be undone
  consequence: ReactNode;
  // The verb of the action, e.g. "Arquivar"
  confirmLabel: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  // The dialog stays open while the returned promise runs and closes only when it resolves
  onConfirm: () => void | Promise<void>;
  // Lets the caller keep the dialog busy (e.g. a mutation still running elsewhere)
  pending?: boolean;
  dataId?: string;
}

const BUSY_CLASS = "aria-disabled:cursor-progress aria-disabled:opacity-45";
const FALLBACK_ERROR = "Não foi possível concluir. Tente de novo.";

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "destructive",
  onConfirm,
  pending = false,
  dataId,
}: ConfirmDialogProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || running;

  function handleOpenChange(next: boolean) {
    // Esc and Cancel cannot drop an action that is already in flight
    if (!next && busy) return;
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    // The second click of the double-click that opened the dialog never confirms
    if (busy || event.detail > 1) return;
    setRunning(true);
    setError(null);
    try {
      await onConfirm();
      setRunning(false);
      onOpenChange(false);
    } catch (caught) {
      setRunning(false);
      setError(caught instanceof Error && caught.message ? caught.message : FALLBACK_ERROR);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent data-aioson-id={dataId} aria-busy={busy || undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          {/* aria-disabled instead of disabled keeps the focus inside the trap while busy */}
          <AlertDialogCancel aria-disabled={busy || undefined} className={BUSY_CLASS}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: tone }), BUSY_CLASS)}
            data-tone={tone}
            aria-disabled={busy || undefined}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps, ConfirmTone };
