interface UndoNoticeProps {
  // The sentence of what just changed; null hides the notice but keeps the live region mounted
  message: string | null;
  onUndo: () => void;
  undoLabel?: string;
  // Keeps the button busy while the undo is being saved
  pending?: boolean;
  dataId?: string;
}

// Announces a change that already happened and offers "Desfazer" while it lasts (the caller owns the timer)
function UndoNotice({ message, onUndo, undoLabel = "Desfazer", pending = false, dataId }: UndoNoticeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-aioson-id={dataId}
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex justify-center sm:inset-x-auto sm:right-6 sm:bottom-6"
    >
      {message ? (
        <div className="pointer-events-auto flex max-w-[min(560px,100%)] items-center gap-3 rounded-md border border-line-strong bg-surface py-1 pr-1 pl-4 text-sm text-text shadow-lg">
          <span className="min-w-0 py-2">{message}</span>
          <button
            type="button"
            onClick={onUndo}
            aria-disabled={pending || undefined}
            className="inline-flex min-h-(--touch) shrink-0 items-center rounded-md px-3 font-semibold text-bronze underline underline-offset-3 hover:bg-ground-sunken aria-disabled:cursor-progress aria-disabled:opacity-45"
            data-aioson-id={dataId ? `${dataId}-undo` : undefined}
          >
            {undoLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { UndoNotice };
export type { UndoNoticeProps };
