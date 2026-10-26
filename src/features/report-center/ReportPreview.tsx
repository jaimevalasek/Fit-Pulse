import { useEffect, useRef, type ReactNode } from "react";
import { StatusView } from "@/components/feedback/StatusView";
import { ReportSheet } from "./ReportSheet";
import type { ReportPreviewState } from "./useReportPreview";

const REPRINT_SCROLL_OFFSET = 12;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Brings the changed page into view: inside the preview box when it scrolls on its own (wide
// screens), or the page itself when the sheets stack in the page flow (390 px)
function scrollToSheet(container: HTMLElement, sheet: HTMLElement) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  if (container.scrollHeight > container.clientHeight + 1) {
    container.scrollTo({ top: Math.max(0, sheet.offsetTop - REPRINT_SCROLL_OFFSET), behavior });
  } else {
    sheet.scrollIntoView({ block: "start", behavior });
  }
}

function previewLabel(state: ReportPreviewState): string {
  if (state.status === "error") return "Prévia indisponível";
  if (state.status !== "ready") return "Montando a prévia…";
  const count = state.document.pages.length;
  return `Prévia · A4 · ${count} ${count === 1 ? "página" : "páginas"}`;
}

interface ReportPreviewProps {
  state: ReportPreviewState;
  onRetry: () => void;
  // "Exportar PDF" and its outcome, in the head of the preview
  actions?: ReactNode;
}

// The pages of the PDF, drawn from the same document the server prints: same pages, order,
// titles and numbers. The page the last change touched gets the reprint band and the scroll (AC-ra-02).
function ReportPreview({ state, onRetry, actions }: ReportPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const changedRef = useRef<HTMLElement>(null);
  const ready = state.status === "ready" ? state : null;
  const revision = ready?.revision ?? 0;
  const changedPageId = ready?.changedPageId ?? null;

  useEffect(() => {
    if (!changedPageId || !containerRef.current || !changedRef.current) return;
    scrollToSheet(containerRef.current, changedRef.current);
  }, [revision, changedPageId]);

  const pageCount = ready?.document.pages.length ?? 0;

  return (
    <div className="report-preview" data-aioson-id="report-preview">
      <div className="report-preview-head">
        <span className="report-preview-label" aria-live="polite">
          {previewLabel(state)}
        </span>
        {actions}
      </div>
      {state.status === "error" ? (
        <StatusView
          state="error"
          dataId="report-preview-error"
          title="Não foi possível montar a prévia"
          description={state.message}
          onRetry={onRetry}
        />
      ) : (
        <div
          ref={containerRef}
          className="report-pages"
          aria-label="Prévia das páginas do PDF"
          aria-busy={state.status !== "ready" || ready?.refreshing || undefined}
          data-state={state.status === "ready" ? "ready" : "loading"}
        >
          {ready ? (
            ready.document.pages.map((page, index) => {
              const changed = page.id === changedPageId;
              return (
                <ReportSheet
                  // A new key remounts the changed page, so the band runs again on every change
                  key={changed ? `${page.id}:${revision}` : page.id}
                  ref={changed ? changedRef : undefined}
                  page={page}
                  number={index + 1}
                  total={pageCount}
                  footer={ready.document.footer}
                  reprinted={changed}
                />
              );
            })
          ) : (
            <>
              <div className="report-sheet-skeleton" aria-hidden="true" />
              <div className="report-sheet-skeleton" aria-hidden="true" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { ReportPreview };
