import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { getStage } from "../../../shared/content/stageContent";
import type { ConfidenceLevel } from "../../../shared/domain/types";
import { discardDiagnosis } from "@/api/diagnosesApi";
import {
  archiveDiagnosis,
  getTimeline,
  restoreDiagnosis,
  type Timeline,
  type TimelineDraft,
  type TimelineEntry,
} from "@/api/historyApi";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusView } from "@/components/feedback/StatusView";
import { Button, buttonVariants } from "@/components/ui/button";

type TimelineAction =
  | { kind: "archive"; entry: TimelineEntry }
  | { kind: "restore"; entry: TimelineEntry }
  | { kind: "discard"; draft: TimelineDraft };

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; timeline: Timeline };

interface CompanyTimelineProps {
  companyId: string;
  // Shown instead of the list while there is no draft and no active completed diagnosis
  empty: ReactNode;
  // Bumped by the page when something outside the timeline changed (e.g. company restored)
  refreshKey?: number;
  // Called after archive, restore or discard so the page can refresh the company header
  onChanged?: () => void;
}

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = { high: "alta", medium: "média", low: "baixa" };

const TAG_CLASS = "inline-flex items-center gap-1 rounded-sm border border-line-strong px-1.5 py-0.5 text-xs text-text-soft";
const ROW_CLASS =
  "grid grid-cols-1 items-center gap-2 border-b border-line py-4 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-4";

function formatDate(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? DATE_FORMAT.format(date) : "";
}

function getActionCopy(action: TimelineAction) {
  if (action.kind === "discard") {
    return {
      title: `Descartar o rascunho de ${formatDate(action.draft.createdAt)}?`,
      consequence: "As respostas deste rascunho serão apagadas. Os diagnósticos concluídos não mudam.",
      confirmLabel: "Descartar rascunho",
      tone: "destructive" as const,
      notice: "Rascunho descartado.",
    };
  }
  const date = formatDate(action.entry.completedAt);
  if (action.kind === "archive") {
    return {
      title: `Arquivar o diagnóstico de ${date}?`,
      consequence:
        "Ele sai da linha do tempo e das comparações. Fica guardado em “Diagnósticos arquivados” e pode ser restaurado.",
      confirmLabel: "Arquivar diagnóstico",
      tone: "metal" as const,
      notice: `Diagnóstico de ${date} arquivado.`,
    };
  }
  return {
    title: `Restaurar o diagnóstico de ${date}?`,
    consequence: "Ele volta para a linha do tempo e para as comparações, com o resultado que tinha quando foi concluído.",
    confirmLabel: "Restaurar diagnóstico",
    tone: "metal" as const,
    notice: `Diagnóstico de ${date} restaurado.`,
  };
}

async function runAction(action: TimelineAction): Promise<void> {
  if (action.kind === "discard") await discardDiagnosis(action.draft.id);
  else if (action.kind === "archive") await archiveDiagnosis(action.entry.id);
  else await restoreDiagnosis(action.entry.id);
}

function useTimeline(companyId: string, refreshKey: number) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getTimeline(companyId, controller.signal)
      .then((timeline) => {
        if (!controller.signal.aborted) setLoad({ status: "ready", timeline });
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: "error" });
      });
    return () => controller.abort();
  }, [companyId, refreshKey, attempt]);

  // A reload keeps the current list on screen until the new one arrives
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { load, reload };
}

function DraftRow({ draft, onDiscard }: { draft: TimelineDraft; onDiscard: () => void }) {
  const percent = Math.round((draft.completedBlocks / Math.max(1, draft.totalBlocks)) * 100);
  const progress = `${draft.completedBlocks} de ${draft.totalBlocks} blocos`;
  // A draft the client's answers file became (AC-ra-51) is reviewed and concluded by the normal gate
  const clientSavedAt = draft.clientAnswersSavedAt;
  return (
    <li data-row-id={draft.id} data-status="draft" data-source={clientSavedAt ? "client-answers" : undefined} tabIndex={-1} className={ROW_CLASS}>
      <div className="text-sm text-text-muted">
        <b className="block font-mono font-medium text-text">{formatDate(draft.createdAt)}</b>
        Rascunho
      </div>
      <div className="min-w-0">
        <b className="text-lg font-semibold">Em andamento</b>
        {clientSavedAt ? (
          <p data-aioson-id="imported-draft" className="mt-1 text-sm text-text-soft">
            Respostas do cliente, salvas em <span className="font-mono">{formatDate(clientSavedAt)}</span>
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`${TAG_CLASS} border-warn/40 text-warn`}>{progress}</span>
          <span className="text-sm text-text-muted">Salvo em {formatDate(draft.updatedAt)}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso do rascunho"
          aria-valuemin={0}
          aria-valuemax={draft.totalBlocks}
          aria-valuenow={draft.completedBlocks}
          aria-valuetext={progress}
          className="mt-2 h-1.5 max-w-80 overflow-hidden rounded-full bg-line"
        >
          <i className="block h-full bg-bronze" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <Link to={`/diagnostico/${encodeURIComponent(draft.id)}`} className={buttonVariants({ variant: "metal" })}>
          {clientSavedAt ? "Revisar e concluir" : "Continuar"}
        </Link>
        <Button variant="ghost" onClick={onDiscard} title="Apaga as respostas deste rascunho" data-action="diag-discard">
          Descartar rascunho
        </Button>
      </div>
    </li>
  );
}

function EntryRow({ entry, onAction }: { entry: TimelineEntry; onAction: (action: TimelineAction) => void }) {
  const archived = entry.archivedAt !== null;
  const date = formatDate(entry.completedAt);
  return (
    <li data-row-id={entry.id} data-status={archived ? "archived" : "completed"} tabIndex={-1} className={ROW_CLASS}>
      <div className="text-sm text-text-muted">
        <b className="block font-mono font-medium text-text">{date}</b>
        {archived ? "Arquivado" : "Concluído"}
      </div>
      <div className="min-w-0">
        <b className="text-lg font-semibold">
          Estágio {entry.stage} · {getStage(entry.stage).name}
        </b>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className={TAG_CLASS} title="Versão do cálculo usada neste diagnóstico">
            Cálculo {entry.rulesVersion}
          </span>
          <span className={TAG_CLASS} title="Quanto das respostas foi medido">
            Dados: confiança {CONFIDENCE_LABELS[entry.confidence]}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {archived ? (
          <Button
            variant="default"
            onClick={() => onAction({ kind: "restore", entry })}
            aria-label={`Restaurar diagnóstico de ${date}`}
            data-action="diag-restore"
          >
            Restaurar
          </Button>
        ) : (
          <>
            <Link to={`/resultado/${encodeURIComponent(entry.id)}`} className={buttonVariants({ variant: "default" })}>
              Ver resultado
            </Link>
            {entry.canCompare ? (
              <Link
                to={`/comparar/${encodeURIComponent(entry.id)}`}
                className={buttonVariants({ variant: "ghost" })}
                aria-label={`Comparar diagnóstico de ${date} com o anterior`}
              >
                Comparar
              </Link>
            ) : null}
            <Button
              variant="ghost"
              onClick={() => onAction({ kind: "archive", entry })}
              aria-label={`Arquivar diagnóstico de ${date}`}
              title="Tira da linha do tempo sem apagar"
              data-action="diag-archive"
            >
              Arquivar
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function TimelineLists({ timeline, empty, onAction }: { timeline: Timeline; empty: ReactNode; onAction: (action: TimelineAction) => void }) {
  const { draft, completed, archived } = timeline;
  return (
    <>
      {draft || completed.length > 0 ? (
        <ul data-aioson-id="company-timeline" aria-label="Linha do tempo dos diagnósticos" className="m-0 list-none border-t border-line p-0">
          {draft ? <DraftRow draft={draft} onDiscard={() => onAction({ kind: "discard", draft })} /> : null}
          {completed.map((entry) => (
            <EntryRow key={entry.id} entry={entry} onAction={onAction} />
          ))}
        </ul>
      ) : (
        empty
      )}
      {archived.length > 0 ? (
        <details data-aioson-id="company-archived-diagnoses" className="mt-6">
          <summary className="inline-flex min-h-(--touch) cursor-pointer items-center text-sm text-text-muted">
            Diagnósticos arquivados ({archived.length})
          </summary>
          <ul aria-label="Diagnósticos arquivados" className="m-0 mt-3 list-none border-t border-line p-0">
            {archived.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onAction={onAction} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function TimelineActionDialog({ action, onClose, onDone }: { action: TimelineAction | null; onClose: () => void; onDone: (action: TimelineAction) => void }) {
  if (!action) return null;
  const copy = getActionCopy(action);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={copy.title}
      consequence={copy.consequence}
      confirmLabel={copy.confirmLabel}
      tone={copy.tone}
      dataId={`diagnosis-${action.kind}-confirm`}
      onConfirm={async () => {
        await runAction(action);
        onDone(action);
      }}
    />
  );
}

// Moves the focus to a row once it is on screen: after a restore the row changed list and the
// button that opened the dialog is gone
function useRowFocus(ready: boolean) {
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId || !ready) return;
    const row = document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(focusId)}"]`);
    if (row) {
      row.focus();
      setFocusId(null);
    }
  });
  return setFocusId;
}

// Draft with progress, completed diagnoses with stage, rules version and confidence, archived
// ones folded away; archive, restore and discard go through ConfirmDialog (AC-dm-30, AC-dm-48)
function CompanyTimeline({ companyId, empty, refreshKey = 0, onChanged }: CompanyTimelineProps) {
  const { load, reload } = useTimeline(companyId, refreshKey);
  const [action, setAction] = useState<TimelineAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const focusRow = useRowFocus(load.status === "ready");

  if (load.status === "loading") {
    return <StatusView state="loading" title="Carregando os diagnósticos…" dataId="company-timeline-loading" />;
  }
  if (load.status === "error") {
    return (
      <StatusView
        state="error"
        title="Não foi possível carregar os diagnósticos"
        description="Eles continuam guardados. Tente de novo em instantes."
        onRetry={reload}
        dataId="company-timeline-error"
      />
    );
  }

  function handleDone(done: TimelineAction) {
    setNotice(getActionCopy(done).notice);
    if (done.kind === "restore") focusRow(done.entry.id);
    reload();
    onChanged?.();
  }

  return (
    <div data-aioson-id="company-history">
      <p role="status" className="mb-2 min-h-[1.25em] text-sm text-ok">
        {notice}
      </p>
      <TimelineLists timeline={load.timeline} empty={empty} onAction={setAction} />
      <TimelineActionDialog action={action} onClose={() => setAction(null)} onDone={handleDone} />
    </div>
  );
}

export { CompanyTimeline };
export type { CompanyTimelineProps };
