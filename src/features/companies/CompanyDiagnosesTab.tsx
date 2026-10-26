import { buttonVariants } from "@/components/ui/button";
import { StatusView } from "@/components/feedback/StatusView";
import { cn } from "@/lib/utils";
import type { Company } from "@/api/companiesApi";
import { CompanyTimeline } from "@/features/history/CompanyTimeline";
import { StartDiagnosisButton, formatDate, useCompanyOutlet, type CompanyStatusAction } from "./CompanyPage";

function CompanyStatusLinks({ company, onAction }: { company: Company; onAction: (action: CompanyStatusAction) => void }) {
  // The link look keeps a 44 px touch height (AC-dm-46)
  const linkClass = cn(buttonVariants({ variant: "link" }), "min-h-(--touch) max-sm:min-h-(--touch)");
  if (!company.archivedAt) {
    return (
      <p className="mt-8">
        <button type="button" className={linkClass} onClick={() => onAction("archive")} data-aioson-id="company-archive">
          Arquivar esta empresa
        </button>
      </p>
    );
  }
  return (
    <p className="mt-8 flex flex-wrap gap-4">
      <button type="button" className={linkClass} onClick={() => onAction("restore")} data-aioson-id="company-restore">
        Restaurar empresa
      </button>
      <button type="button" className={`${linkClass} text-danger`} onClick={() => onAction("delete")} data-aioson-id="company-delete">
        Excluir empresa e diagnósticos
      </button>
    </p>
  );
}

// Index tab of the company: the version 1 timeline of its diagnoses (AC-dm-30); the empty state starts the first one
function CompanyDiagnosesTab() {
  const { company, reload, onStartDiagnosis, onStatusAction } = useCompanyOutlet();
  const isArchived = Boolean(company.archivedAt);
  const empty = (
    <StatusView
      state="empty"
      dataId="company-empty"
      title="Nenhum diagnóstico ainda"
      description="O primeiro diagnóstico leva cerca de 12 minutos. Ele fica salvo enquanto você responde."
      action={
        isArchived ? null : (
          <StartDiagnosisButton company={company} label="Começar o primeiro diagnóstico" onStartDiagnosis={onStartDiagnosis} />
        )
      }
    />
  );
  return (
    <section aria-labelledby="company-diagnoses-title" data-aioson-id="company-diagnoses">
      <h2 id="company-diagnoses-title" className="sr-only">
        Diagnósticos
      </h2>
      {company.latestCompletedAt && !company.draftId && !isArchived ? (
        <p className="mb-4 text-sm text-text-muted">
          O novo diagnóstico começa com as respostas de {formatDate(company.latestCompletedAt)} já preenchidas. Você só muda o que mudou.
        </p>
      ) : null}
      <CompanyTimeline companyId={company.id} empty={empty} onChanged={reload} />
      <CompanyStatusLinks company={company} onAction={onStatusAction} />
    </section>
  );
}

export { CompanyDiagnosesTab };
