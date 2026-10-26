import { useEffect, useState } from "react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { StatusView } from "@/components/feedback/StatusView";
import { getCompanyActions, type ActionPlan, type CompanyActions } from "@/api/actionsApi";
import type { Company } from "@/api/companiesApi";
import { StartDiagnosisButton, useCompanyOutlet, type CompanyOutletContext } from "@/features/companies/CompanyPage";
import { ActionProgressRow, TrackedActionRows, formatMoment } from "./ActionProgressRow";
import { actionRowKey } from "./useActionStatus";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; data: CompanyActions };

function useCompanyActions(companyId: string) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    getCompanyActions(companyId, controller.signal)
      .then((data) => !controller.signal.aborted && setLoad({ status: "ready", data }))
      .catch(() => !controller.signal.aborted && setLoad({ status: "error" }));
    return () => controller.abort();
  }, [companyId, attempt]);
  return { load, retry: () => setAttempt((value) => value + 1) };
}

// A closed plan ended when the next newer diagnosis was completed (closed comes newest first)
function closingDate(data: CompanyActions, index: number): string | null {
  const newer = index === 0 ? data.current : data.closed[index - 1];
  return newer?.completedAt ?? null;
}

// No completed diagnosis: actions are born from one, and a draft has none (AC-ra-63)
function ActionsEmpty({ company, onStartDiagnosis }: Pick<CompanyOutletContext, "company" | "onStartDiagnosis">) {
  const action = company.archivedAt ? null : company.draftId ? (
    <Link to={`/diagnostico/${encodeURIComponent(company.draftId)}`} className={buttonVariants({ variant: "metal" })} data-aioson-id="actions-continue-diag">
      Continuar o diagnóstico
    </Link>
  ) : (
    <StartDiagnosisButton company={company} label="Começar o diagnóstico" onStartDiagnosis={onStartDiagnosis} dataId="actions-start-diag" />
  );
  return (
    <StatusView
      state="empty"
      dataId="actions-empty"
      title="Ainda não há ações"
      description={
        company.draftId
          ? "As 3 ações nascem de um diagnóstico concluído. Termine o diagnóstico em andamento para ver o plano aqui."
          : "As 3 ações nascem de um diagnóstico concluído. Ao terminar o diagnóstico, o plano aparece aqui."
      }
      action={action}
    />
  );
}

function ClosedPlans({ data }: { data: CompanyActions }) {
  const rows = data.closed.flatMap((plan: ActionPlan, index) => plan.actions.map((action) => ({ action, closedAt: closingDate(data, index) })));
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="closed-actions-title" className="mt-12">
      <h2 id="closed-actions-title" className="text-xl">
        Encerradas com diagnósticos anteriores
      </h2>
      <ul className="m-0 mt-3 list-none border-t border-line p-0" data-aioson-id="closed-actions">
        {rows.map(({ action, closedAt }, index) => (
          <ActionProgressRow key={actionRowKey(action)} action={action} index={index} closed closedAt={closedAt} />
        ))}
      </ul>
    </section>
  );
}

function CurrentPlan({ company, plan }: { company: Company; plan: ActionPlan }) {
  return (
    <section aria-labelledby="current-plan-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id="current-plan-title">
            Plano do diagnóstico de <span className="font-mono">{formatMoment(plan.completedAt)}</span>
          </h2>
          <p className="mt-1 text-sm text-text-muted">O resultado do diagnóstico não muda. O andamento das ações fica registrado à parte.</p>
        </div>
        <Link to={`/resultado/${encodeURIComponent(plan.diagnosisId)}`} className={buttonVariants({ variant: "ghost" })} data-aioson-id="actions-open-result">
          Ver resultado
        </Link>
      </div>
      <div data-aioson-tour="acoes">
        <TrackedActionRows key={`${company.id}:${plan.diagnosisId}`} actions={plan.actions} dataId="actions-list" />
      </div>
      <p role="note" className="mt-5 rounded-md border border-line bg-surface px-4 py-3 text-sm text-text-soft">
        Quando sai um diagnóstico novo, a ação que se repete continua de onde parou, com estado, prazo e nota. As outras ficam
        encerradas aqui embaixo. O responsável é escolhido por papel (dono, equipe, consultor); o app não guarda nome de outras
        pessoas.
      </p>
    </section>
  );
}

// Tab #/empresa/:companyId/acoes — the current plan with its progress and the plans already closed
function CompanyActionsTab() {
  const { company, onStartDiagnosis } = useCompanyOutlet();
  const { load, retry } = useCompanyActions(company.id);

  if (load.status === "loading") {
    return <StatusView state="loading" title="Carregando as ações" dataId="actions-loading" />;
  }
  if (load.status === "error") {
    return (
      <StatusView
        state="error"
        title="Não foi possível abrir as ações"
        description="O andamento continua guardado. Tente de novo em instantes."
        onRetry={retry}
        dataId="actions-error"
      />
    );
  }
  const { data } = load;
  return (
    <div data-aioson-id="company-actions" data-state={data.current ? "success" : "empty"}>
      {data.current ? <CurrentPlan company={company} plan={data.current} /> : <ActionsEmpty company={company} onStartDiagnosis={onStartDiagnosis} />}
      <ClosedPlans data={data} />
    </div>
  );
}

export { CompanyActionsTab };
