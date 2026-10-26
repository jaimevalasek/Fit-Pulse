import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router";
import {
  DIMENSIONS,
  DISCOVERY_RESEARCH_INTRO,
  DISCOVERY_RESEARCH_STEPS,
  getStage,
  LAST_STEP_PHRASE,
  LOCK_PHRASES,
} from "../../../shared/content/stageContent";
import { DIMENSION_KEYS, type DiagnosisResult, type StageNumber } from "../../../shared/domain/types";
import { formatConfidenceStatement } from "../../../shared/format/confidenceText";
import { formatMoney } from "../../../shared/format/money";
import { formatRatio, getRatioBand } from "../../../shared/format/displayNumbers";
import { getCompany } from "@/api/companiesApi";
import { getDiagnosis, type Diagnosis } from "@/api/diagnosesApi";
import { getCompanyActions, getDiagnosisActions, type CompanyActions } from "@/api/actionsApi";
import { isApiError } from "@/api/httpClient";
import { exportReport } from "@/api/reportApi";
import { StatusView } from "@/components/feedback/StatusView";
import { Button, buttonVariants } from "@/components/ui/button";
import { CompareWithLink, loadCompareTarget } from "@/features/history/ComparePage";
import { ReportDelivery } from "@/features/report-center/ReportDelivery";
import { ActionPlanList, type ActionPlanProgress } from "./ActionPlanList";
import { ConfidenceNote } from "./ConfidenceNote";
import { DimensionScores } from "./DimensionScores";
import { NumbersSummary } from "./NumbersSummary";
import { RiskList } from "./RiskList";
import { LockIcon, StageLadder } from "./StageLadder";

type LoadState =
  | { status: "loading" }
  | { status: "error"; notFound: boolean }
  // compareWith: completion date of the diagnosis the comparison would use, null on the first one
  | { status: "ready"; diagnosis: Diagnosis; companyName?: string; compareWith: string | null };

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

const FIT_KEYS = DIMENSION_KEYS.filter((key) => DIMENSIONS[key].group === "fit");
const FRONT_KEYS = DIMENSION_KEYS.filter((key) => DIMENSIONS[key].group === "front");

function formatDate(iso: string | null | undefined, format = DATE_FORMAT): string {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? format.format(date) : "";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function useResultLoad(diagnosisId: string) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    (async () => {
      try {
        const diagnosis = await getDiagnosis(diagnosisId, controller.signal);
        // The company name is only the breadcrumb: the result opens even if it cannot be read
        const company = await getCompany(diagnosis.companyId, controller.signal).catch(() => null);
        const compareWith = await loadCompareTarget(diagnosis, controller.signal);
        if (!controller.signal.aborted) setLoad({ status: "ready", diagnosis, companyName: company?.name, compareWith });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoad({ status: "error", notFound: isApiError(error) && error.status === 404 });
      }
    })();
    return () => controller.abort();
  }, [diagnosisId, attempt]);

  return { load, retry: () => setAttempt((value) => value + 1) };
}

// Completion date of the diagnosis that replaced this plan: the next newer plan of the company
function findClosingDate(company: CompanyActions, diagnosisId: string): string | null {
  const index = company.closed.findIndex((plan) => plan.diagnosisId === diagnosisId);
  if (index < 0) return null;
  return (index === 0 ? company.current : company.closed[index - 1])?.completedAt ?? null;
}

// The action progress of this diagnosis, loaded apart so the result opens even when it cannot be read
function useActionPlanProgress(diagnosisId: string, companyId: string | null): ActionPlanProgress {
  const [progress, setProgress] = useState<ActionPlanProgress>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    const retry = () => setAttempt((value) => value + 1);
    setProgress({ status: "loading" });
    (async () => {
      try {
        const { isCurrent, actions } = await getDiagnosisActions(diagnosisId, controller.signal);
        const company = isCurrent ? null : await getCompanyActions(companyId, controller.signal).catch(() => null);
        const closedBy = company ? findClosingDate(company, diagnosisId) : null;
        if (!controller.signal.aborted) setProgress({ status: "ready", isCurrent, actions, closedBy });
      } catch {
        if (!controller.signal.aborted) setProgress({ status: "error", retry });
      }
    })();
    return () => controller.abort();
  }, [diagnosisId, companyId, attempt]);

  return progress;
}

function StageSummary({ result }: { result: DiagnosisResult }) {
  const stage = getStage(result.stage);
  const weakest = DIMENSIONS[result.weakestDimension];
  const showResearchSteps = result.stage === 1 && result.lock === "cac";

  return (
    <div className="min-w-0">
      <h2 className="text-[clamp(2.5rem,2rem+2.2vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.035em]">{stage.name}</h2>
      <p className="mt-4 max-w-[38ch] text-lg text-text-soft">
        <b className="font-semibold text-text">Estágio {result.stage} de 4.</b> {stage.phrase}
      </p>
      {showResearchSteps ? (
        <div className="mt-4 text-sm text-text-soft">
          <p>{DISCOVERY_RESEARCH_INTRO}</p>
          <ul className="mt-2 list-disc pl-5">
            {DISCOVERY_RESEARCH_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div
        data-aioson-id="result-trava"
        className="mt-6 flex items-start gap-4 rounded-lg border border-line bg-surface p-4"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong bg-solid text-bronze">
          <LockIcon className="size-4" />
        </span>
        {result.lock ? (
          <p className="min-w-0 text-base text-text-soft">
            Para subir de degrau:
            <span data-aioson-id="result-lock-phrase" className="voice-human mt-0.5 block text-lg leading-snug">
              {capitalize(LOCK_PHRASES[result.lock])}.
            </span>
            <span className="mt-2 block font-mono text-xs tracking-[0.06em] text-text-muted">
              O que mais trava agora: {weakest.name} · {result.dimensions[result.weakestDimension].score}/100
            </span>
          </p>
        ) : (
          <p className="min-w-0 text-base text-text-soft">
            <span data-aioson-id="result-lock-phrase" className="voice-human block text-lg leading-snug">
              {LAST_STEP_PHRASE}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function NumbersAside({ result }: { result: DiagnosisResult }) {
  const economics = result.unitEconomics;
  const band = getRatioBand(economics.ratio);
  return (
    <aside aria-labelledby="result-kpi-title" className="min-w-0">
      <h2 id="result-kpi-title" className="mb-4">
        Seus números
      </h2>
      <div className="border-b border-line py-4">
        <div className="text-sm text-text-muted">Custo para conquistar um cliente</div>
        <div className="font-mono text-4xl leading-tight font-medium break-words">{formatMoney(economics.cacCents)}</div>
      </div>
      <div className="border-b border-line py-4">
        <div className="text-sm text-text-muted">Lucro de um cliente comparado ao custo dele</div>
        <div className="font-mono text-4xl leading-tight font-medium">{formatRatio(economics.ratio)}</div>
        <div className="text-sm text-text-muted">{band ? band.label : "Sem o custo de um cliente, não há comparação."}</div>
      </div>
    </aside>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

// "Exportar PDF" saves the diagnosis report with the default options (answers off) right here.
// The saved file stays on screen until the owner closes it (AC-ra-25); closing resets the delivery.
function ResultExport({ diagnosisId }: { diagnosisId: string }) {
  const [deliveryKey, setDeliveryKey] = useState(0);
  const [saved, setSaved] = useState(false);

  async function handleExport() {
    const exported = await exportReport(diagnosisId);
    setSaved(true);
    return exported;
  }

  function handleClose() {
    setSaved(false);
    setDeliveryKey((key) => key + 1);
  }

  return (
    <div className="flex min-w-0 flex-col items-end gap-2 max-sm:w-full max-sm:items-stretch">
      <ReportDelivery key={deliveryKey} onExport={handleExport} className="flex-none max-sm:w-full" />
      {saved ? (
        <Button onClick={handleClose} data-aioson-id="result-export-close">
          Fechar
        </Button>
      ) : null}
    </div>
  );
}

interface ResultHeaderProps {
  companyId: string;
  diagnosisId: string;
  finishedAt: string;
  result: DiagnosisResult;
  compareWith: string | null;
}

// "Relatórios" opens the center on this diagnosis; "Exportar PDF" is the main action (AC-ra-01, AC-ra-25)
function ResultHeader({ companyId, diagnosisId, finishedAt, result, compareWith }: ResultHeaderProps) {
  const reportsPath = `/empresa/${encodeURIComponent(companyId)}/relatorios?diagnostico=${encodeURIComponent(diagnosisId)}`;
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 id="result-title">Diagnóstico de {formatDate(finishedAt)}</h1>
        <p className="mt-2 text-sm text-text-muted">
          Calculado com as regras da versão {result.rulesVersion} · {formatConfidenceStatement(result.confidence)}
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <CompareWithLink diagnosisId={diagnosisId} compareWith={compareWith} finishedAt={finishedAt} />
        <Link to={reportsPath} className={buttonVariants()} data-aioson-id="result-reports">
          <FileIcon />
          Relatórios
        </Link>
        <ResultExport diagnosisId={diagnosisId} />
      </div>
    </header>
  );
}

interface ResultViewProps {
  diagnosis: Diagnosis;
  result: DiagnosisResult;
  companyName?: string;
  compareWith: string | null;
}

function ResultView({ diagnosis, result, companyName, compareWith }: ResultViewProps) {
  const finishedAt = diagnosis.completedAt ?? diagnosis.createdAt ?? diagnosis.updatedAt;
  const previousStage: StageNumber | null = diagnosis.previous?.stage ?? null;
  const actionProgress = useActionPlanProgress(diagnosis.id, diagnosis.companyId);

  return (
    <article data-state="success" data-aioson-id="result" aria-labelledby="result-title">
      <nav aria-label="Caminho" className="mb-4 text-sm">
        <Link to={`/empresa/${encodeURIComponent(diagnosis.companyId)}`} className="inline-flex min-h-(--touch) items-center text-text-muted">
          {companyName ?? "Voltar para a empresa"}
        </Link>
      </nav>
      <ResultHeader companyId={diagnosis.companyId} diagnosisId={diagnosis.id} finishedAt={finishedAt} result={result} compareWith={compareWith} />

      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
        <StageLadder
          stage={result.stage}
          previousStage={previousStage}
          lock={result.lock}
          caption={
            <>
              <span className="meta-line">Estágio em {formatDate(finishedAt, SHORT_DATE_FORMAT)}</span>
              <span className="meta-line">{previousStage ? `Antes: estágio ${previousStage}` : "Primeiro diagnóstico"}</span>
            </>
          }
        />
        <StageSummary result={result} />
      </div>

      <div
        aria-hidden="true"
        className="my-12 h-[33px] border-l-2 border-bronze bg-[repeating-linear-gradient(to_bottom,var(--line)_0_1px,transparent_1px_8px)]"
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ActionPlanList plan={result.plan} progress={actionProgress} />
        <NumbersAside result={result} />
      </div>

      <p
        role="note"
        data-aioson-id="result-guidance"
        className="mt-6 flex items-start gap-2 rounded-md border border-line bg-surface px-4 py-3 text-sm text-text-soft"
      >
        <span>
          Orientação baseada nas suas respostas. Não substitui uma análise financeira. Ações que aumentam investimento só
          aparecem quando o custo de um cliente foi medido.
        </span>
      </p>

      <h2 className="mt-12 mb-2">Os detalhes</h2>
      <p className="mb-4 text-sm text-text-muted">
        Os encaixes mostram se as peças do negócio combinam entre si. As frentes mostram o que você faz no dia a dia. Cada
        uma indica o estágio que sustentaria sozinha; o estágio da empresa fica limitado pela mais fraca.
      </p>
      <DimensionScores title="Encaixes do negócio" keys={FIT_KEYS} dimensions={result.dimensions} dataId="result-fits" />
      <DimensionScores title="Frentes de crescimento" keys={FRONT_KEYS} dimensions={result.dimensions} dataId="result-fronts" />
      <NumbersSummary economics={result.unitEconomics} calculator={diagnosis.calculator} />
      <RiskList risks={result.risks} />
      <ConfidenceNote confidence={result.confidence} />
    </article>
  );
}

// Route #/resultado/:diagnosisId — the frozen result in layers (AC-dm-28)
function ResultPage() {
  const { diagnosisId = "" } = useParams();
  const { load, retry } = useResultLoad(diagnosisId);

  if (load.status === "loading") {
    return (
      <StatusView
        state="loading"
        title="Calculando o seu diagnóstico"
        description="Comparando as respostas com as regras. Leva poucos segundos."
        dataId="result-loading"
      />
    );
  }
  if (load.status === "error") {
    return load.notFound ? (
      <StatusView
        state="error"
        title="Diagnóstico não encontrado"
        description="Ele pode ter sido excluído junto com a empresa."
        action={
          <Link to="/empresas" className={buttonVariants({ variant: "default" })}>
            Ir para Empresas
          </Link>
        }
        dataId="result-not-found"
      />
    ) : (
      <StatusView
        state="error"
        title="Não foi possível abrir o resultado"
        description="O diagnóstico continua guardado. Tente de novo em instantes."
        onRetry={retry}
        dataId="result-error"
      />
    );
  }

  const { diagnosis, companyName, compareWith } = load;
  if (diagnosis.status === "draft") {
    return <Navigate to={`/diagnostico/${encodeURIComponent(diagnosis.id)}`} replace />;
  }
  if (!diagnosis.result) {
    return (
      <StatusView
        state="error"
        title="O resultado deste diagnóstico não está disponível"
        description="Abra a empresa e comece um novo diagnóstico."
        action={
          <Link to={`/empresa/${encodeURIComponent(diagnosis.companyId)}`} className={buttonVariants({ variant: "default" })}>
            Abrir a empresa
          </Link>
        }
        dataId="result-missing"
      />
    );
  }
  return <ResultView diagnosis={diagnosis} result={diagnosis.result} companyName={companyName} compareWith={compareWith} />;
}

export { ResultPage };
