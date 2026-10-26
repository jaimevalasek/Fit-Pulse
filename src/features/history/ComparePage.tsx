import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import {
  STAGE_MOVES,
  directionOf,
  formatComparisonMonth,
  formatDelta,
  recalculationNotice,
  type ChangeDirection,
} from "../../../shared/content/comparisonCopy";
import { getRiskInfo } from "../../../shared/content/riskCatalog";
import { DIMENSIONS, getStage } from "../../../shared/content/stageContent";
import type { RiskResult } from "../../../shared/domain/types";
import { getCompany } from "@/api/companiesApi";
import { getDiagnosis, type Diagnosis } from "@/api/diagnosesApi";
import { getComparison, getTimeline, type DiagnosisComparison, type Timeline } from "@/api/historyApi";
import { isApiError } from "@/api/httpClient";
import { StatusView } from "@/components/feedback/StatusView";
import { buttonVariants } from "@/components/ui/button";
import { StageLadder } from "@/features/result/StageLadder";
import { cn } from "@/lib/utils";

type LoadState =
  | { status: "loading" }
  | { status: "error"; notFound: boolean }
  | { status: "no-previous"; companyId: string; companyName?: string }
  | { status: "ready"; comparison: DiagnosisComparison; companyId: string; companyName?: string };

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const SHORT_MONTH_FORMAT = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const DAY_MS = 24 * 60 * 60 * 1000;

const DELTA_TONES: Record<ChangeDirection, string> = { up: "text-ok", down: "text-danger", same: "text-text-muted" };

function toDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(iso: string): string {
  const date = toDate(iso);
  return date ? DATE_FORMAT.format(date) : "";
}

// "outubro"; the year is added when it differs from the other date, so "dezembro de 2025" → "março".
// Same words as the evolution PDF (AC-ra-13).
function formatMonth(iso: string, otherIso?: string | null): string {
  return formatComparisonMonth(iso, otherIso);
}

function formatShortMonth(iso: string): string {
  const date = toDate(iso);
  return date ? SHORT_MONTH_FORMAT.format(date).replace(".", "") : "";
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = toDate(fromIso);
  const to = toDate(toIso);
  return from && to ? Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS)) : 0;
}

function useComparisonLoad(diagnosisId: string) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    (async () => {
      try {
        const diagnosis = await getDiagnosis(diagnosisId, controller.signal);
        // The company name is only the breadcrumb: the comparison opens even if it cannot be read
        const company = await getCompany(diagnosis.companyId, controller.signal).catch(() => null);
        const base = { companyId: diagnosis.companyId, companyName: company?.name };
        try {
          const comparison = await getComparison(diagnosisId, controller.signal);
          if (!controller.signal.aborted) setLoad({ status: "ready", comparison, ...base });
        } catch (error) {
          if (!(isApiError(error) && error.code === "no_previous_diagnosis")) throw error;
          if (!controller.signal.aborted) setLoad({ status: "no-previous", ...base });
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoad({ status: "error", notFound: isApiError(error) && error.status === 404 });
      }
    })();
    return () => controller.abort();
  }, [diagnosisId, attempt]);

  return { load, retry: () => setAttempt((value) => value + 1) };
}

function DeltaIcon({ direction }: { direction: ChangeDirection }) {
  const path = direction === "up" ? "M12 19V5M5 12l7-7 7 7" : direction === "down" ? "M12 5v14M5 12l7 7 7-7" : "M5 12h14";
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <path d={path} />
    </svg>
  );
}

// The change is told by the arrow and the words, never by the color alone (AC-dm-31)
function Delta({ delta }: { delta: number }) {
  const direction = directionOf(delta);
  return (
    <span data-direction={direction} className={cn("inline-flex items-center gap-1 font-semibold", DELTA_TONES[direction])}>
      <DeltaIcon direction={direction} />
      {formatDelta(delta)}
    </span>
  );
}

// RULE-ra-02: the same sentence the evolution PDF prints for this pair (AC-ra-13)
function RecalculationNotice({ comparison }: { comparison: DiagnosisComparison }) {
  const notice = recalculationNotice(comparison);
  if (!notice) return null;
  return (
    <p role="note" data-aioson-id="compare-rules" className="mb-6 rounded-md border border-line bg-surface px-4 py-3 text-sm text-text-soft">
      {notice}
    </p>
  );
}

function StageComparison({ comparison }: { comparison: DiagnosisComparison }) {
  const { previous, current, stageChange, average } = comparison;
  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
      <StageLadder
        stage={stageChange.to}
        previousStage={stageChange.from}
        caption={
          <>
            <span className="meta-line">Estágio em {formatDate(current.completedAt)}</span>
            <span className="meta-line">
              Antes: estágio {stageChange.from} em {formatMonth(previous.completedAt, current.completedAt)}
            </span>
          </>
        }
      />
      <div className="min-w-0" data-aioson-id="compare-stage">
        <h2 className="text-[clamp(1.75rem,1.5rem+1.4vw,2.5rem)] leading-[1.05] font-bold tracking-[-0.03em]">
          {getStage(stageChange.from).name} → {getStage(stageChange.to).name}
        </h2>
        <p className="mt-4 max-w-[42ch] text-lg text-text-soft">
          <b className="font-semibold text-text">{STAGE_MOVES[stageChange.direction]}</b> Estágio {stageChange.from} →{" "}
          {stageChange.to}. Média das 8 dimensões: {average.before} → {average.after} pontos.
        </p>
      </div>
    </div>
  );
}

function DimensionTable({ comparison }: { comparison: DiagnosisComparison }) {
  const before = formatShortMonth(comparison.previous.completedAt);
  const after = formatShortMonth(comparison.current.completedAt);
  // Two diagnoses in the same month would get the same header: the dates tell them apart
  const sameMonth = before === after;
  const head = "py-3 pr-3 text-left font-mono text-xs font-normal tracking-[0.1em] text-text-muted uppercase";
  return (
    <table data-aioson-id="compare-table" className="w-full border-collapse text-sm">
      <caption className="sr-only">Nota de cada dimensão antes e depois, com a diferença</caption>
      <thead>
        <tr className="border-b border-line-strong">
          <th scope="col" className={head}>Dimensão</th>
          <th scope="col" className={head}>{sameMonth ? formatDate(comparison.previous.completedAt) : before}</th>
          <th scope="col" className={head}>{sameMonth ? formatDate(comparison.current.completedAt) : after}</th>
          <th scope="col" className={head}>Mudança</th>
        </tr>
      </thead>
      <tbody>
        {comparison.dimensions.map((dimension) => (
          <tr key={dimension.key} data-dimension={dimension.key} className="border-b border-line">
            <th scope="row" className="py-3 pr-3 text-left font-normal">
              <b className="block">{DIMENSIONS[dimension.key].name}</b>
              <span className="text-xs text-text-muted">{DIMENSIONS[dimension.key].question}</span>
            </th>
            <td className="py-3 pr-3 font-mono text-lg">{dimension.before}</td>
            <td className="py-3 pr-3 font-mono text-lg">{dimension.after}</td>
            <td className="py-3">
              <Delta delta={dimension.delta} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RiskChanges({ title, risks, tag, emptyText, dataId }: { title: string; risks: RiskResult[]; tag: string; emptyText: string; dataId: string }) {
  const tagTone = tag === "Resolvido" ? "border-ok/40 text-ok" : "border-warn/40 text-warn";
  return (
    <section data-aioson-id={dataId} aria-label={title}>
      <h2 className="mb-3">{title}</h2>
      {risks.length > 0 ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {risks.map((risk) => (
            <li key={risk.signalId} data-risk-id={risk.signalId} className="flex items-start gap-2 text-sm">
              <span className={cn("shrink-0 rounded-sm border px-1.5 py-0.5 text-xs font-medium", tagTone)}>{tag}</span>
              <span>{getRiskInfo(risk.signalId).title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{emptyText}</p>
      )}
    </section>
  );
}

function ComparisonView({ comparison, companyId, companyName }: { comparison: DiagnosisComparison; companyId: string; companyName?: string }) {
  const { previous, current } = comparison;
  const previousMonth = formatMonth(previous.completedAt, current.completedAt);
  const currentMonth = formatMonth(current.completedAt, previous.completedAt);
  return (
    <article data-state="success" data-aioson-id="compare" aria-labelledby="compare-title">
      <nav aria-label="Caminho" className="mb-4 text-sm">
        <Link to={`/empresa/${encodeURIComponent(companyId)}`} className="inline-flex min-h-(--touch) items-center text-text-muted">
          {companyName ?? "Voltar para a empresa"}
        </Link>
      </nav>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="compare-title">
            De {previousMonth} para {currentMonth}
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            {formatDate(previous.completedAt)} → {formatDate(current.completedAt)} ·{" "}
            {daysBetween(previous.completedAt, current.completedAt)} dias entre os dois
          </p>
        </div>
        <Link to={`/resultado/${encodeURIComponent(current.id)}`} className={buttonVariants({ variant: "default" })}>
          Ver resultado de {currentMonth}
        </Link>
      </header>
      <RecalculationNotice comparison={comparison} />
      <StageComparison comparison={comparison} />
      <h2 className="mt-12 mb-3">Dimensão por dimensão</h2>
      <DimensionTable comparison={comparison} />
      <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <RiskChanges title="Riscos resolvidos" risks={comparison.risksResolved} tag="Resolvido" emptyText="Nenhum risco deixou de existir." dataId="compare-risks-resolved" />
        <RiskChanges title="Riscos novos" risks={comparison.risksNew} tag="Novo" emptyText="Nenhum risco novo." dataId="compare-risks-new" />
      </div>
    </article>
  );
}

// "Comparar com {mês}" only when there is an earlier completed, non-archived diagnosis (BR-dm-08).
// Returns the completion date of the diagnosis the comparison would use, or null.
function findCompareTarget(timeline: Timeline, diagnosis: Diagnosis): string | null {
  const entry = [...timeline.completed, ...timeline.archived].find((item) => item.id === diagnosis.id);
  if (!entry?.canCompare) return null;
  // Newest first, so the first older entry is the one right before
  const previous = timeline.completed.find((item) => item.id !== entry.id && item.completedAt < entry.completedAt);
  return previous?.completedAt ?? diagnosis.previous?.completedAt ?? null;
}

// Without the timeline the result still opens, only without the comparison link
async function loadCompareTarget(diagnosis: Diagnosis, signal?: AbortSignal): Promise<string | null> {
  const timeline = await getTimeline(diagnosis.companyId, signal).catch(() => null);
  return timeline ? findCompareTarget(timeline, diagnosis) : null;
}

function CompareWithLink({ diagnosisId, compareWith, finishedAt }: { diagnosisId: string; compareWith: string | null; finishedAt: string }) {
  if (!compareWith) return null;
  return (
    <Link to={`/comparar/${encodeURIComponent(diagnosisId)}`} className={buttonVariants({ variant: "default" })} data-aioson-id="result-compare">
      Comparar com {formatMonth(compareWith, finishedAt)}
    </Link>
  );
}

// Route #/comparar/:diagnosisId — the diagnosis against the one before it (AC-dm-31, RULE-dm-11)
function ComparePage() {
  const { diagnosisId = "" } = useParams();
  const { load, retry } = useComparisonLoad(diagnosisId);

  if (load.status === "loading") {
    return <StatusView state="loading" title="Comparando os diagnósticos" dataId="compare-loading" />;
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
        dataId="compare-not-found"
      />
    ) : (
      <StatusView
        state="error"
        title="Não foi possível abrir a comparação"
        description="Os diagnósticos continuam guardados. Tente de novo em instantes."
        onRetry={retry}
        dataId="compare-error"
      />
    );
  }
  if (load.status === "no-previous") {
    return (
      <StatusView
        state="empty"
        title="Ainda não há o que comparar"
        description="A comparação aparece a partir do segundo diagnóstico concluído."
        action={
          <Link to={`/empresa/${encodeURIComponent(load.companyId)}`} className={buttonVariants({ variant: "default" })}>
            {load.companyName ? `Voltar para ${load.companyName}` : "Voltar para a empresa"}
          </Link>
        }
        dataId="compare-empty"
      />
    );
  }
  return <ComparisonView comparison={load.comparison} companyId={load.companyId} companyName={load.companyName} />;
}

export { ComparePage, CompareWithLink, findCompareTarget, formatMonth, loadCompareTarget };
