import type { ActionProgress } from "@/api/actionsApi";
import { ActionProgressRow, TrackedActionRows, formatMoment } from "@/features/actions/ActionProgressRow";
import { actionRowKey } from "@/features/actions/useActionStatus";
import { getActionInfo } from "../../../shared/content/actionCatalog";
import type { ActionKey } from "../../../shared/domain/types";

// The progress of the plan as the result screen loads it; the stored result never changes with it (RULE-ra-01)
type ActionPlanProgress =
  | { status: "loading" }
  | { status: "error"; retry: () => void }
  // closedBy: completion date of the diagnosis that replaced this plan, when known
  | { status: "ready"; isCurrent: boolean; actions: ActionProgress[]; closedBy: string | null };

// The plan without its progress (loading or unreadable): title, reason and how to do it (RULE-dm-09)
function StaticPlanRows({ plan }: { plan: readonly ActionKey[] }) {
  return (
    <ol className="m-0 list-none border-t border-line p-0">
      {plan.map((key, index) => {
        const action = getActionInfo(key);
        return (
          <li key={key} data-action-key={key} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-line py-4">
            <span aria-hidden="true" className="pt-0.5 font-mono text-sm font-medium text-bronze">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <b className="block font-semibold text-text">{action.title}</b>
              <p className="mt-0.5 text-sm text-text-soft">{action.reason}</p>
              <p className="mt-0.5 text-sm text-text-muted">{action.howTo}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// A replaced plan: each action shows how it ended, with no editing controls (AC-ra-30)
function ClosedPlanRows({ actions, closedBy }: { actions: ActionProgress[]; closedBy: string | null }) {
  return (
    <>
      <p role="note" className="mb-3 rounded-md border border-line bg-surface px-4 py-3 text-sm text-text-soft" data-aioson-id="result-plan-closed">
        {closedBy ? (
          <>
            Este plano foi encerrado com o diagnóstico de <span className="font-mono">{formatMoment(closedBy)}</span>.
          </>
        ) : (
          "Este plano foi encerrado por um diagnóstico mais novo."
        )}{" "}
        As ações que se repetiram continuam no plano novo.
      </p>
      <ul className="m-0 list-none border-t border-line p-0" data-aioson-id="result-actions-closed">
        {actions.map((action, index) => (
          <ActionProgressRow key={actionRowKey(action)} action={action} index={index} closed closedAt={closedBy} showHowTo />
        ))}
      </ul>
    </>
  );
}

function PlanBody({ plan, progress }: { plan: readonly ActionKey[]; progress?: ActionPlanProgress }) {
  if (!progress) return <StaticPlanRows plan={plan} />;
  if (progress.status === "ready") {
    return progress.isCurrent ? (
      <TrackedActionRows actions={progress.actions} showHowTo dataId="result-actions-list" />
    ) : (
      <ClosedPlanRows actions={progress.actions} closedBy={progress.closedBy} />
    );
  }
  return (
    <>
      {progress.status === "error" ? (
        <p role="alert" className="mb-2 flex flex-wrap items-center gap-2 text-sm text-danger" data-aioson-id="result-actions-error">
          Não foi possível carregar o andamento das ações.
          <button type="button" onClick={progress.retry} className="inline-flex min-h-(--touch) items-center font-semibold text-bronze underline underline-offset-3">
            Tentar de novo
          </button>
        </p>
      ) : null}
      <StaticPlanRows plan={plan} />
    </>
  );
}

// The three actions of the plan; the current plan has editable progress, a replaced one is read-only.
// Without progress (screens that do not track it yet) it shows the plan alone.
function ActionPlanList({ plan, progress }: { plan: readonly ActionKey[]; progress?: ActionPlanProgress }) {
  return (
    <section data-aioson-id="result-actions" aria-labelledby="result-actions-title" aria-busy={progress?.status === "loading" || undefined}>
      <div className="mb-4">
        <h2 id="result-actions-title">Suas próximas 3 ações</h2>
        <p className="meta-line mt-2 text-bronze">Para os próximos 30 dias</p>
        {progress ? <p className="mt-1 text-sm text-text-muted">O resultado não muda. O andamento das ações fica registrado à parte.</p> : null}
      </div>
      <PlanBody plan={plan} progress={progress} />
    </section>
  );
}

export { ActionPlanList };
export type { ActionPlanProgress };
