import { useCallback, useEffect, useRef, useState } from "react";
import { getReportPreview, type ReportSelection } from "@/api/reportApi";
import { isApiError } from "@/api/httpClient";
import type { ReportDocument } from "../../../shared/report/reportDocument";

type ReportPreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  // `refreshing` keeps the last pages on screen while the next ones are on the way;
  // `revision` grows on every answer, so the same page can be marked as changed twice in a row
  | { status: "ready"; document: ReportDocument; changedPageId: string | null; refreshing: boolean; revision: number };

const FALLBACK_ERROR = "Não foi possível montar a prévia do relatório.";

function describeFailure(error: unknown): string {
  return isApiError(error) && error.message ? error.message : FALLBACK_ERROR;
}

// The page that changed between two answers for the same company: the first page whose content
// differs or that is new. When the change only removed pages, the page right before the first
// removed one. Null on the first answer, when nothing was on screen to compare with (AC-ra-02).
function findChangedPageId(previous: ReportDocument | null, next: ReportDocument): string | null {
  if (!previous) return null;
  const before = new Map(previous.pages.map((page) => [page.id, JSON.stringify(page)]));
  const changed = next.pages.find((page) => before.get(page.id) !== JSON.stringify(page));
  if (changed) return changed.id;
  const remaining = new Set(next.pages.map((page) => page.id));
  const firstRemoved = previous.pages.findIndex((page) => !remaining.has(page.id));
  if (firstRemoved <= 0) return null;
  return previous.pages[firstRemoved - 1]?.id ?? null;
}

// Fetches the preview on every change of the selection, cancels the call still in flight and
// tells which page changed. A failure drops the pages: the screen never shows a partial preview (AC-ra-04).
function useReportPreview(selection: ReportSelection | null) {
  const [state, setState] = useState<ReportPreviewState>(selection ? { status: "loading" } : { status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const previousRef = useRef<ReportDocument | null>(null);
  const revisionRef = useRef(0);
  const selectionKey = selection ? JSON.stringify(selection) : null;

  useEffect(() => {
    if (selectionKey === null) {
      previousRef.current = null;
      setState({ status: "idle" });
      return;
    }
    const current = JSON.parse(selectionKey) as ReportSelection;
    const controller = new AbortController();
    setState((state) => (state.status === "ready" ? { ...state, refreshing: true } : { status: "loading" }));
    getReportPreview(current, controller.signal).then(
      (document) => {
        if (controller.signal.aborted) return;
        const changedPageId = findChangedPageId(previousRef.current, document);
        previousRef.current = document;
        revisionRef.current += 1;
        setState({ status: "ready", document, changedPageId, refreshing: false, revision: revisionRef.current });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        previousRef.current = null;
        setState({ status: "error", message: describeFailure(error) });
      },
    );
    return () => controller.abort();
  }, [selectionKey, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}

export { findChangedPageId, useReportPreview };
export type { ReportPreviewState };
