import { useState, type ReactNode } from "react";
import { UndoNotice } from "@/components/feedback/UndoNotice";
import type { ActionProgress } from "@/api/actionsApi";
import { cn } from "@/lib/utils";
import { ACTION_OWNER_ROLE_LABELS, ACTION_STATUS_LABELS, ACTION_STATUS_OPTIONS } from "../../../shared/content/actionProgressOptions";
import { getActionInfo } from "../../../shared/content/actionCatalog";
import type { ActionStatus } from "../../../shared/domain/actionProgress";
import { isoToDateInput } from "../../../shared/format/dates";
import { ActionEditDialog } from "./ActionEditDialog";
import { actionRowKey, useActionStatus } from "./useActionStatus";

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

const STATUS_SELECT_CLASS = cn(
  "h-(--control) w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text sm:w-44",
  "hover:border-text-soft focus:border-bronze aria-busy:cursor-progress max-sm:h-(--touch)",
);

function formatMoment(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? DATE_FORMAT.format(date) : "";
}

function Chip({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "danger"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "accent" && "border-bronze text-bronze",
        tone === "danger" && "border-danger bg-danger-wash text-danger",
        tone === "neutral" && "border-line-strong text-text-soft",
      )}
    >
      {children}
    </span>
  );
}

// Inherited, deadline (overdue only on the current plan, RULE-ra-06), owner role and, when closed, how it ended
function ActionChips({ action, closed, closedAt }: { action: ActionProgress; closed: boolean; closedAt?: string | null }) {
  const due = isoToDateInput(action.dueDate);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-aioson-id={`action-meta-${action.diagnosisId}-${action.actionKey}`}>
      {action.inheritedFrom ? (
        <Chip tone="accent">Continua do diagnóstico de {formatMoment(action.inheritedFrom.completedAt)}</Chip>
      ) : null}
      {!closed && action.overdue && due ? (
        <Chip tone="danger">Vencida em {due}</Chip>
      ) : due ? (
        <Chip>Prazo {due}</Chip>
      ) : !closed ? (
        <Chip>Sem prazo</Chip>
      ) : null}
      {action.ownerRole ? <Chip>{ACTION_OWNER_ROLE_LABELS[action.ownerRole]}</Chip> : null}
      {closed ? (
        <Chip>
          {closedAt ? `Encerrada em ${formatMoment(closedAt)}` : "Encerrada"} · {ACTION_STATUS_LABELS[action.status]}
        </Chip>
      ) : null}
    </div>
  );
}

interface ActionControlsProps {
  action: ActionProgress;
  title: string;
  pending: boolean;
  onStatusChange: (status: ActionStatus) => void;
  onEdit: () => void;
}

function ActionControls({ action, title, pending, onStatusChange, onEdit }: ActionControlsProps) {
  const uid = `${action.diagnosisId}-${action.actionKey}`;
  return (
    <div className="flex flex-col items-stretch gap-1 max-sm:col-span-2 sm:items-end">
      <label className="sr-only" htmlFor={`status-${uid}`}>
        Estado de {title}
      </label>
      <select
        id={`status-${uid}`}
        className={STATUS_SELECT_CLASS}
        value={action.status}
        aria-busy={pending || undefined}
        onChange={(event) => onStatusChange(event.target.value as ActionStatus)}
        data-aioson-id={`status-${uid}`}
      >
        {ACTION_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex min-h-(--touch) items-center px-1 text-sm font-semibold text-bronze underline underline-offset-3"
        data-aioson-id={`edit-${uid}`}
      >
        Editar<span className="max-sm:sr-only">&nbsp;prazo, responsável e nota</span>
        <span className="sr-only"> de {title}</span>
      </button>
    </div>
  );
}

interface ActionProgressRowProps {
  action: ActionProgress;
  index: number;
  // A closed plan shows how each action ended, without controls (AC-ra-30)
  closed?: boolean;
  closedAt?: string | null;
  // Also shows the step by step of the result screen
  showHowTo?: boolean;
  pending?: boolean;
  onStatusChange?: (action: ActionProgress, status: ActionStatus) => void;
  onEdit?: (action: ActionProgress) => void;
}

// One action of a plan; the list keys it by `diagnosisId:actionKey` so a repeated action never collides
function ActionProgressRow(props: ActionProgressRowProps) {
  const { action, index, closed = false, closedAt, showHowTo = false, pending = false, onStatusChange, onEdit } = props;
  const info = getActionInfo(action.actionKey);
  const editable = !closed && onStatusChange && onEdit;
  return (
    <li
      data-aioson-id={`action-${action.diagnosisId}-${action.actionKey}`}
      data-action-key={action.actionKey}
      data-status={action.status}
      className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-line py-4 sm:grid-cols-[44px_minmax(0,1fr)_auto]"
    >
      <span aria-hidden="true" className="pt-0.5 font-mono text-sm font-medium text-bronze">
        {closed ? "·" : String(index + 1).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <h3 className={cn("text-base font-semibold", action.status === "done" ? "text-text-soft" : "text-text")}>{info.title}</h3>
        <p className="mt-0.5 text-sm text-text-soft">{info.reason}</p>
        {showHowTo ? <p className="mt-0.5 text-sm text-text-muted">{info.howTo}</p> : null}
        <ActionChips action={action} closed={closed} closedAt={closedAt} />
        {action.note ? <p className="mt-2 text-sm whitespace-pre-line text-text-soft">{action.note}</p> : null}
      </div>
      {editable ? (
        <ActionControls
          action={action}
          title={info.title}
          pending={pending}
          onStatusChange={(status) => onStatusChange(action, status)}
          onEdit={() => onEdit(action)}
        />
      ) : null}
    </li>
  );
}

interface TrackedActionRowsProps {
  actions: readonly ActionProgress[];
  showHowTo?: boolean;
  dataId?: string;
}

// The current plan: status saves at once with "Desfazer" for 6 s, and "Editar" changes one action (AC-ra-27, AC-ra-28)
function TrackedActionRows({ actions, showHowTo, dataId }: TrackedActionRowsProps) {
  const tracking = useActionStatus(actions);
  const [editing, setEditing] = useState<ActionProgress | null>(null);
  return (
    <>
      {tracking.error ? (
        <p role="alert" className="mb-2 text-sm text-danger" data-aioson-id="actions-save-error">
          {tracking.error}
        </p>
      ) : null}
      <ol className="m-0 list-none border-t border-line p-0" data-aioson-id={dataId}>
        {tracking.items.map((action, index) => (
          <ActionProgressRow
            key={actionRowKey(action)}
            action={action}
            index={index}
            showHowTo={showHowTo}
            pending={tracking.isPending(action)}
            onStatusChange={tracking.changeStatus}
            onEdit={setEditing}
          />
        ))}
      </ol>
      <UndoNotice message={tracking.notice?.message ?? null} onUndo={tracking.undo} dataId="action-status-notice" />
      <ActionEditDialog action={editing} onClose={() => setEditing(null)} onSaved={tracking.replace} />
    </>
  );
}

export { ActionProgressRow, TrackedActionRows, formatMoment };
export type { ActionProgressRowProps, TrackedActionRowsProps };
