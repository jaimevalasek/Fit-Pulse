import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { getStage } from "../../../shared/content/stageContent";
import { startDiagnosis } from "@/api/diagnosesApi";
import type { HomeLatestDiagnosis, OwnerHomeData } from "@/api/homeApi";
import type { TimelineDraft } from "@/api/historyApi";
import { StatusView } from "@/components/feedback/StatusView";
import { Button, buttonVariants } from "@/components/ui/button";
import { TrackedActionRows } from "@/features/actions/ActionProgressRow";
import { formatDate } from "@/features/companies/CompanyPage";
import { formatMonth } from "@/features/history/ComparePage";
import { OwnerFollowUpWidgets } from "./OwnerFollowUpWidgets";
import { ReevaluationCountdown } from "./ReevaluationCountdown";

const LINK_CLASS = "inline-flex min-h-(--touch) items-center font-medium text-bronze underline-offset-4 hover:underline";

function draftPath(draftId: string): string {
  return `/diagnostico/${encodeURIComponent(draftId)}`;
}

// Starts a draft for the company and opens the questionnaire on it
function StartDiagnosisButton({ companyId, label, dataId }: { companyId: string; label: string; dataId: string }) {
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      const draft = await startDiagnosis(companyId);
      navigate(draftPath(draft.id));
    } catch (caught) {
      setIsStarting(false);
      setError(caught instanceof Error && caught.message ? caught.message : "Não foi possível começar. Tente de novo.");
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="metal" onClick={handleStart} aria-disabled={isStarting || undefined} data-aioson-id={dataId}>
        {isStarting ? "Abrindo…" : label}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}

// A company with no completed diagnosis: start the first one or continue the open draft (AC-dm-35)
function FirstDiagnosisState({ companyId, draft }: { companyId: string; draft?: TimelineDraft | null }) {
  return (
    <StatusView
      state="empty"
      dataId="home-first-diagnosis"
      title={draft ? "O primeiro diagnóstico está em andamento" : "Faça o primeiro diagnóstico"}
      description={
        draft
          ? `${draft.completedBlocks} de ${draft.totalBlocks} blocos respondidos. Salvo em ${formatDate(draft.updatedAt)}.`
          : "São 8 blocos curtos, cerca de 12 minutos. Dá para parar e continuar depois."
      }
      action={
        draft ? (
          <Link to={draftPath(draft.id)} className={buttonVariants({ variant: "metal" })} data-aioson-id="home-continue-draft">
            Continuar de onde parei
          </Link>
        ) : (
          <StartDiagnosisButton companyId={companyId} label="Começar o primeiro diagnóstico" dataId="home-start-first" />
        )
      }
    />
  );
}

// An open draft keeps the "Continuar de onde parei" of version 1 (AC-ra-33)
function DraftCard({ draft }: { draft: TimelineDraft }) {
  return (
    <div
      data-aioson-id="home-draft"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4"
    >
      <div className="min-w-0">
        <b className="block font-semibold">Diagnóstico de {formatMonth(draft.createdAt)} em andamento</b>
        <p className="mt-1 text-sm text-text-soft">
          {draft.completedBlocks} de {draft.totalBlocks} blocos respondidos. Salvo em {formatDate(draft.updatedAt)}.
        </p>
      </div>
      <Link to={draftPath(draft.id)} className={buttonVariants({ variant: "metal" })} data-aioson-id="home-continue-draft">
        Continuar de onde parei
      </Link>
    </div>
  );
}

// "Suas 3 ações": the status changes right here, with the same row and undo as the actions tab (AC-ra-26)
function CurrentActions({ companyId, latest, actions }: { companyId: string; latest: HomeLatestDiagnosis; actions: OwnerHomeData["actions"]["current"] }) {
  if (actions.length === 0) return null;
  return (
    <section aria-labelledby="home-actions-title" data-aioson-id="home-actions">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="home-actions-title" className="text-xl">
            Suas 3 ações
          </h2>
          <p className="mt-1 text-sm text-text-soft">
            Do diagnóstico de <span className="font-mono">{formatDate(latest.completedAt)}</span>. Mude o estado aqui mesmo.
          </p>
        </div>
        <Link to={`/empresa/${encodeURIComponent(companyId)}/acoes`} className={LINK_CLASS} data-aioson-id="home-actions-open">
          Ver prazos e notas →
        </Link>
      </div>
      <TrackedActionRows key={latest.id} actions={actions} dataId="home-actions-list" />
    </section>
  );
}

function OwnerHeader({ data }: { data: OwnerHomeData }) {
  const { company, latest, draft } = data;
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="meta-line">Minha empresa</p>
        <h1 className="mt-2 break-words">{company.name}</h1>
        <p data-aioson-id="home-last-date" className="mt-1 text-text-soft">
          {latest ? (
            <>
              Estágio {latest.stage} de 4 · {getStage(latest.stage).name}, desde o diagnóstico de{" "}
              <span className="font-mono">{formatDate(latest.completedAt)}</span>
            </>
          ) : (
            "Nenhum diagnóstico concluído ainda."
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/empresa/${encodeURIComponent(company.id)}/relatorios`} className={buttonVariants()} data-aioson-id="home-reports">
          Relatórios
        </Link>
        {latest && !draft ? <StartDiagnosisButton companyId={company.id} label="Novo diagnóstico" dataId="home-new-diag" /> : null}
      </div>
    </header>
  );
}

function ResultLinks({ latest }: { latest: HomeLatestDiagnosis }) {
  return (
    <p className="flex flex-wrap gap-x-6">
      <Link to={`/resultado/${encodeURIComponent(latest.id)}`} className={LINK_CLASS} data-aioson-id="home-see-result">
        Ver o resultado completo
      </Link>
      {latest.previous ? (
        <Link to={`/comparar/${encodeURIComponent(latest.id)}`} className={LINK_CLASS} data-aioson-id="home-compare">
          Comparar com {formatMonth(latest.previous.completedAt, latest.completedAt)}
        </Link>
      ) : null}
    </p>
  );
}

// Owner mode: the focus is "Refazer o diagnóstico", then the follow-up indicators and "Suas 3 ações"
// (AC-ra-33, PRD deviation 3); every number comes from the home route, read again on each opening
function OwnerHome({ data }: { data: OwnerHomeData }) {
  const { company, latest, draft, reevaluation } = data;
  return (
    <div data-aioson-id="home-owner" className="grid gap-8">
      <OwnerHeader data={data} />
      {latest ? (
        <>
          {draft ? <DraftCard draft={draft} /> : null}
          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            {reevaluation ? <ReevaluationCountdown reevaluation={reevaluation} latest={latest} /> : null}
            <OwnerFollowUpWidgets
              companyId={company.id}
              counts={data.actions.counts}
              diary={data.diary}
              latestReport={data.latestReport}
              diagnosedAt={latest.completedAt}
            />
          </div>
          <CurrentActions companyId={company.id} latest={latest} actions={data.actions.current} />
          <ResultLinks latest={latest} />
        </>
      ) : (
        <FirstDiagnosisState companyId={company.id} draft={draft} />
      )}
    </div>
  );
}

export { OwnerHome, StartDiagnosisButton };
