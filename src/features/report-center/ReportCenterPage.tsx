import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { getTimeline, type Timeline } from "@/api/historyApi";
import { isApiError } from "@/api/httpClient";
import { exportReportFile, type ReportSelection } from "@/api/reportApi";
import { buttonVariants } from "@/components/ui/button";
import { StatusView } from "@/components/feedback/StatusView";
import type { Company } from "@/api/companiesApi";
import { StartDiagnosisButton, useCompanyOutlet, type CompanyOutletContext } from "@/features/companies/CompanyPage";
import { ReportDelivery } from "./ReportDelivery";
import { ReportOptions, defaultEvolutionRange, type EvolutionRange, type ReportType } from "./ReportOptions";
import { ReportPreview } from "./ReportPreview";
import { useReportPreview } from "./useReportPreview";

type TimelineState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; timeline: Timeline };

// The result screen opens the center on its own diagnosis
const DIAGNOSIS_PARAM = "diagnostico";
const LOAD_ERROR = "Não foi possível carregar os diagnósticos desta empresa.";

function useCompanyTimeline(companyId: string) {
  const [state, setState] = useState<TimelineState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    getTimeline(companyId, controller.signal).then(
      (timeline) => {
        if (!controller.signal.aborted) setState({ status: "ready", timeline });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: isApiError(error) && error.message ? error.message : LOAD_ERROR });
      },
    );
    return () => controller.abort();
  }, [companyId, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { state, retry };
}

interface EmptyReportsProps {
  company: Company;
  draftId: string | null;
  onStartDiagnosis: CompanyOutletContext["onStartDiagnosis"];
}

// BR-ra-01: no completed diagnosis, no report; the way to begin or continue the diagnosis instead
function EmptyReports({ company, draftId, onStartDiagnosis }: EmptyReportsProps) {
  const action = company.archivedAt ? null : draftId ? (
    <Link className={buttonVariants({ variant: "metal" })} to={`/diagnostico/${encodeURIComponent(draftId)}`} data-aioson-id="reports-continue">
      Continuar o diagnóstico
    </Link>
  ) : (
    <StartDiagnosisButton company={company} label="Começar o diagnóstico" onStartDiagnosis={onStartDiagnosis} dataId="reports-start" />
  );
  return (
    <StatusView
      state="empty"
      dataId="reports-empty"
      title="Ainda não há relatório"
      description={`O relatório nasce de um diagnóstico concluído. ${company.name} ainda não tem nenhum.`}
      action={action}
    />
  );
}

interface ReportWorkspaceProps {
  timeline: Timeline;
  requestedDiagnosisId: string | null;
}

// Options on the left, the paged preview on the right; any change of option redraws the preview
// (AC-ra-02): the type, the diagnosis, "De" and "Até" of the evolution or the answers switch
function ReportWorkspace({ timeline, requestedDiagnosisId }: ReportWorkspaceProps) {
  const diagnoses = timeline.completed;
  const [diagnosisId, setDiagnosisId] = useState(() =>
    requestedDiagnosisId && diagnoses.some((entry) => entry.id === requestedDiagnosisId) ? requestedDiagnosisId : diagnoses[0].id,
  );
  const [includeAnswers, setIncludeAnswers] = useState(false);
  const [reportType, setReportType] = useState<ReportType>("diagnosis");
  // AC-ra-12: from the second latest diagnosis to the latest; null below 2 diagnoses (AC-ra-03)
  const [evolutionRange, setEvolutionRange] = useState<EvolutionRange | null>(() => defaultEvolutionRange(diagnoses));
  const selection = useMemo<ReportSelection>(
    () =>
      reportType === "evolution" && evolutionRange
        ? { kind: "evolution", fromId: evolutionRange.fromId, toId: evolutionRange.toId }
        : { kind: "diagnosis", diagnosisId, includeAnswers },
    [reportType, evolutionRange, diagnosisId, includeAnswers],
  );
  const { state, retry } = useReportPreview(selection);
  const exportSelection = useCallback(() => exportReportFile(selection), [selection]);

  return (
    <div className="report-center" data-aioson-id="reports">
      <ReportOptions
        diagnoses={diagnoses}
        diagnosisId={diagnosisId}
        includeAnswers={includeAnswers}
        onDiagnosisChange={setDiagnosisId}
        onIncludeAnswersChange={setIncludeAnswers}
        evolutionSupported
        reportType={reportType}
        onReportTypeChange={setReportType}
        evolutionRange={evolutionRange}
        onEvolutionRangeChange={setEvolutionRange}
      />
      <ReportPreview
        state={state}
        onRetry={retry}
        actions={<ReportDelivery onExport={exportSelection} disabled={state.status !== "ready" || state.refreshing} />}
      />
    </div>
  );
}

// "Relatórios" tab of the company (AC-ra-01): loading (`aria-busy`), the error with "Tentar de
// novo" and no partial preview (AC-ra-04), the empty state without export (AC-ra-03), then the center.
function ReportCenterPage() {
  const { company, onStartDiagnosis } = useCompanyOutlet();
  const [searchParams] = useSearchParams();
  const requestedDiagnosisId = searchParams.get(DIAGNOSIS_PARAM);
  const { state, retry } = useCompanyTimeline(company.id);

  let content;
  if (state.status === "loading") {
    content = <StatusView state="loading" dataId="reports-loading" title="Carregando os relatórios…" />;
  } else if (state.status === "error") {
    content = <StatusView state="error" dataId="reports-error" title="Não foi possível abrir os relatórios" description={state.message} onRetry={retry} />;
  } else if (state.timeline.completed.length === 0) {
    content = <EmptyReports company={company} draftId={state.timeline.draft?.id ?? null} onStartDiagnosis={onStartDiagnosis} />;
  } else {
    content = <ReportWorkspace key={requestedDiagnosisId ?? ""} timeline={state.timeline} requestedDiagnosisId={requestedDiagnosisId} />;
  }

  return (
    <section aria-labelledby="company-reports-title" data-aioson-id="company-reports">
      <h2 id="company-reports-title" className="sr-only">
        Relatórios
      </h2>
      {content}
    </section>
  );
}

export { ReportCenterPage };
