import { useCallback, useEffect, useRef, useState } from "react";
import { updateAction, type ActionProgress } from "@/api/actionsApi";
import { isApiError } from "@/api/httpClient";
import { ACTION_STATUS_LABELS } from "../../../shared/content/actionProgressOptions";
import { getActionInfo } from "../../../shared/content/actionCatalog";
import type { ActionStatus } from "../../../shared/domain/actionProgress";

// How long "Desfazer" stays on screen after a status change (AC-ra-27)
const UNDO_WINDOW_MS = 6000;
const SAVE_ERROR = "Não foi possível gravar o estado. Tente de novo.";
const PLAN_CLOSED_ERROR = "Este plano foi encerrado por um diagnóstico mais novo. Recarregue a página para ver o plano atual.";

interface StatusNotice {
  rowKey: string;
  message: string;
  action: ActionProgress;
  previous: ActionStatus;
}

// The identity of a row across plans: the same action key repeats in a newer diagnosis
function actionRowKey(action: Pick<ActionProgress, "diagnosisId" | "actionKey">): string {
  return `${action.diagnosisId}:${action.actionKey}`;
}

function describeStatusChange(action: ActionProgress): string {
  return `"${getActionInfo(action.actionKey).title}" agora está ${ACTION_STATUS_LABELS[action.status].toLowerCase()}.`;
}

function describeSaveError(error: unknown): string {
  if (isApiError(error) && error.code === "plan_closed") return PLAN_CLOSED_ERROR;
  return isApiError(error) && error.status < 500 && error.message ? error.message : SAVE_ERROR;
}

// Rows with a save in flight; only the latest request of a row may write its answer back
function useRowRequests() {
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const requestIds = useRef(new Map<string, number>());

  const setPending = useCallback((key: string, pending: boolean) => {
    setPendingKeys((current) => {
      const next = new Set(current);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const begin = useCallback(
    (key: string) => {
      const requestId = (requestIds.current.get(key) ?? 0) + 1;
      requestIds.current.set(key, requestId);
      setPending(key, true);
      return {
        isLatest: () => requestIds.current.get(key) === requestId,
        finish: () => requestIds.current.get(key) === requestId && setPending(key, false),
      };
    },
    [setPending],
  );

  return { pendingKeys, begin };
}

// The plan rows, reseeded whenever the loaded plan changes
function usePlanItems(source: readonly ActionProgress[], onReseed: () => void) {
  const [items, setItems] = useState<ActionProgress[]>(() => [...source]);
  const [seededFrom, setSeededFrom] = useState(source);
  if (source !== seededFrom) {
    setSeededFrom(source);
    setItems([...source]);
    onReseed();
  }
  const replace = useCallback((updated: ActionProgress) => {
    const key = actionRowKey(updated);
    setItems((current) => current.map((item) => (actionRowKey(item) === key ? updated : item)));
  }, []);
  return { items, replace };
}

function useNoticeTimeout(notice: StatusNotice | null, clear: () => void) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clear, UNDO_WINDOW_MS);
    return () => window.clearTimeout(timer);
  }, [notice, clear]);
}

// The tracked actions of one plan: a status change saves at once and can be undone for 6 seconds,
// and the undo saves the previous status again (AC-ra-27, RULE-ra-12)
function useActionStatus(source: readonly ActionProgress[]) {
  const [notice, setNotice] = useState<StatusNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);
  const { items, replace } = usePlanItems(source, clearNotice);
  const { pendingKeys, begin } = useRowRequests();
  useNoticeTimeout(notice, clearNotice);

  const saveStatus = useCallback(
    async (action: ActionProgress, status: ActionStatus): Promise<ActionProgress | null> => {
      const request = begin(actionRowKey(action));
      replace({ ...action, status });
      setError(null);
      try {
        const saved = await updateAction(action.diagnosisId, action.actionKey, { status });
        if (!request.isLatest()) return null;
        replace(saved);
        return saved;
      } catch (caught) {
        if (request.isLatest()) {
          replace(action);
          setError(describeSaveError(caught));
        }
        return null;
      } finally {
        request.finish();
      }
    },
    [begin, replace],
  );

  const changeStatus = useCallback(
    async (action: ActionProgress, status: ActionStatus) => {
      if (action.status === status) return;
      const saved = await saveStatus(action, status);
      if (saved) setNotice({ rowKey: actionRowKey(saved), message: describeStatusChange(saved), action: saved, previous: action.status });
    },
    [saveStatus],
  );

  const undo = useCallback(async () => {
    if (!notice || pendingKeys.has(notice.rowKey)) return;
    const current = items.find((item) => actionRowKey(item) === notice.rowKey) ?? notice.action;
    setNotice(null);
    await saveStatus(current, notice.previous);
  }, [items, notice, pendingKeys, saveStatus]);

  return {
    items,
    notice,
    error,
    dismissError: () => setError(null),
    isPending: (action: ActionProgress) => pendingKeys.has(actionRowKey(action)),
    changeStatus,
    undo,
    replace,
  };
}

export { UNDO_WINDOW_MS, actionRowKey, describeSaveError, useActionStatus };
