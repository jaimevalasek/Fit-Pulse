import { useState } from "react";
import { isApiError } from "@/api/httpClient";
import type { ReportExport } from "@/api/reportApi";
import { openSavedFile, revealSavedFile, type OpenFailureDetails } from "@/api/filesApi";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DeliveryState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved"; saved: ReportExport }
  | { status: "failed"; message: string };

type OpenAction = "open" | "reveal";

const BUSY_CLASS = "aria-disabled:cursor-progress aria-disabled:opacity-45";
const WRITE_FAILED_FALLBACK =
  "Não foi possível salvar o PDF na pasta Downloads. Nada foi alterado. Confira se há espaço no disco e tente de novo.";

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M12 4v11M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function isOpenFailureDetails(value: unknown): value is OpenFailureDetails {
  return typeof value === "object" && value !== null && typeof (value as { directory?: unknown }).directory === "string";
}

// BR-ra-06: when the computer cannot open it, the owner still learns where the file is
function describeOpenFailure(error: unknown, saved: ReportExport): string {
  if (isApiError(error) && error.code === "file_not_found" && error.message) return error.message;
  const directory = isApiError(error) && isOpenFailureDetails(error.details) ? error.details.directory : saved.directory;
  return `Não foi possível abrir. O arquivo está em ${directory}.`;
}

interface SavedFileProps {
  saved: ReportExport;
}

// "PDF salvo" with the name, the folder, "Abrir PDF" and "Mostrar na pasta". Only the file id
// goes to the server, which opens the file it saved itself (IF-002, AC-ra-18).
function SavedFile({ saved }: SavedFileProps) {
  const [pending, setPending] = useState<OpenAction | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  async function handleOpen(action: OpenAction) {
    if (pending) return;
    setPending(action);
    setOpenError(null);
    try {
      await (action === "open" ? openSavedFile(saved.fileId) : revealSavedFile(saved.fileId));
    } catch (error) {
      setOpenError(describeOpenFailure(error, saved));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="report-delivery-panel" data-state="success" data-aioson-id="report-pdf-saved">
      <p role="status">
        <b className="block">PDF salvo</b>
        <span className="text-text-soft">
          Arquivo <span className="font-mono break-all text-text">{saved.fileName}</span> na pasta{" "}
          <span className="font-mono break-all text-text">{saved.directory}</span>
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="metal"
          className={BUSY_CLASS}
          aria-disabled={pending !== null || undefined}
          onClick={() => handleOpen("open")}
          data-aioson-id="report-open-pdf"
        >
          {pending === "open" ? "Abrindo…" : "Abrir PDF"}
        </Button>
        <Button
          className={BUSY_CLASS}
          aria-disabled={pending !== null || undefined}
          onClick={() => handleOpen("reveal")}
          data-aioson-id="report-show-folder"
        >
          {pending === "reveal" ? "Abrindo…" : "Mostrar na pasta"}
        </Button>
      </div>
      {openError ? (
        <p role="alert" className="mt-2 text-sm text-danger" data-aioson-id="report-open-error">
          {openError}
        </p>
      ) : null}
    </div>
  );
}

interface ReportDeliveryProps {
  // Saves the PDF of the current selection and answers where it went (IF-001)
  onExport: () => Promise<ReportExport>;
  // While the preview is not ready there is nothing to export yet
  disabled?: boolean;
  className?: string;
}

// "Exportar PDF": "Salvando…", then "PDF salvo" with the file. A write failure shows the server
// message with "Tentar de novo" and leaves the center as it was (AC-ra-17, AC-ra-19).
function ReportDelivery({ onExport, disabled = false, className }: ReportDeliveryProps) {
  const [state, setState] = useState<DeliveryState>({ status: "idle" });
  const saving = state.status === "saving";
  const blocked = saving || disabled;

  async function handleExport() {
    if (blocked) return;
    setState({ status: "saving" });
    try {
      setState({ status: "saved", saved: await onExport() });
    } catch (error) {
      setState({ status: "failed", message: isApiError(error) && error.message ? error.message : WRITE_FAILED_FALLBACK });
    }
  }

  return (
    <div className={cn("report-delivery", className)} aria-busy={saving || undefined}>
      <Button
        variant="metal"
        className={BUSY_CLASS}
        aria-disabled={blocked || undefined}
        onClick={handleExport}
        data-aioson-id="report-export"
      >
        <DownloadIcon />
        {saving ? "Salvando…" : "Exportar PDF"}
      </Button>
      {saving ? (
        <p role="status" className="report-delivery-panel" data-state="loading">
          Salvando o PDF na pasta Downloads…
        </p>
      ) : null}
      {state.status === "saved" ? <SavedFile key={state.saved.fileId} saved={state.saved} /> : null}
      {state.status === "failed" ? (
        <div role="alert" className="report-delivery-panel is-error" data-state="error" data-aioson-id="report-export-error">
          <p className="text-danger">{state.message}</p>
          <Button className="mt-3" onClick={handleExport} data-aioson-id="report-export-retry">
            Tentar de novo
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export { ReportDelivery };
export type { ReportDeliveryProps };
