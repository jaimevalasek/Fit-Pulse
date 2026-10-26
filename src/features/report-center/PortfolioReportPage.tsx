import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { getConsultantHome } from "@/api/homeApi";
import { exportReportFile, type ReportSelection } from "@/api/reportApi";
import { StatusView } from "@/components/feedback/StatusView";
import { buttonVariants } from "@/components/ui/button";
import { NewCompanyButton } from "@/features/home/ConsultantHome";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { ReportDelivery } from "./ReportDelivery";
import { ReportPreview } from "./ReportPreview";
import { useReportPreview } from "./useReportPreview";

type PortfolioLoad = { status: "loading" } | { status: "error" } | { status: "ready"; companyCount: number };

// IF-001 `{ kind: "portfolio" }`: the preview and the export of the whole portfolio, with no option.
// `ReportSelection` in src/api/reportApi.ts still lists only the company reports, hence the cast.
const PORTFOLIO_SELECTION: ReportSelection = { kind: "portfolio" };

const PORTFOLIO_CONTENTS = [
  "Empresas por estágio, com a data do último diagnóstico",
  "Reavaliações atrasadas e riscos altos",
  "Ações vencidas de cada empresa",
  "Como ler este relatório",
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-bronze">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// The active companies come from the consultant home, the same numbers the report prints (AC-ra-15)
function usePortfolioLoad() {
  const [load, setLoad] = useState<PortfolioLoad>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    getConsultantHome(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setLoad({ status: "ready", companyCount: data.companyCount });
      },
      () => {
        if (!controller.signal.aborted) setLoad({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { load, retry };
}

// AC-ra-16: owner mode has a single company, so the report lives in consultant mode
function OwnerModeNotice() {
  return (
    <StatusView
      state="empty"
      dataId="portfolio-owner-mode"
      title="Disponível no modo consultoria"
      description="O relatório da carteira junta todas as empresas que você atende. No modo minha empresa há só uma empresa. Troque o modo em Configurações."
      action={
        <Link className={buttonVariants({ variant: "metal" })} to="/configuracoes" data-aioson-id="portfolio-open-settings">
          Ir para Configurações
        </Link>
      }
    />
  );
}

// AC-ra-16: no active company, no portfolio report
function EmptyPortfolio() {
  return (
    <StatusView
      state="empty"
      dataId="portfolio-empty"
      title="Nenhuma empresa ativa"
      description="O relatório da carteira junta as empresas ativas que você atende. Ainda não há nenhuma."
      action={<NewCompanyButton label="Cadastrar a primeira empresa" dataId="portfolio-first-company" />}
    />
  );
}

// What the portfolio report holds on the left, the paged preview and the delivery on the right
function PortfolioWorkspace() {
  const { state, retry } = useReportPreview(PORTFOLIO_SELECTION);
  const exportSelection = useCallback(() => exportReportFile(PORTFOLIO_SELECTION), []);

  return (
    <div className="report-center" data-aioson-id="reports">
      <div className="report-options" data-aioson-id="portfolio-options">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">O que entra</span>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[0.9375rem] text-text-soft">
            {PORTFOLIO_CONTENTS.map((item) => (
              <li key={item} className="flex gap-2.5">
                <CheckIcon />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-text-muted">Exportar para planilha fica para uma versão seguinte.</p>
      </div>
      <ReportPreview
        state={state}
        onRetry={retry}
        actions={<ReportDelivery onExport={exportSelection} disabled={state.status !== "ready" || state.refreshing} />}
      />
    </div>
  );
}

function ConsultantPortfolio() {
  const { load, retry } = usePortfolioLoad();
  if (load.status === "loading") return <StatusView state="loading" dataId="portfolio-loading" title="Carregando a carteira…" />;
  if (load.status === "error") {
    return (
      <StatusView
        state="error"
        dataId="portfolio-error"
        title="Não foi possível carregar a carteira"
        description="Os dados continuam salvos neste computador."
        onRetry={retry}
      />
    );
  }
  if (load.companyCount === 0) return <EmptyPortfolio />;
  return <PortfolioWorkspace />;
}

// #/relatorios/carteira (CAP-ra-portfolio-report): the portfolio report in consultant mode, the
// explanation in owner mode and the empty portfolio with "Cadastrar a primeira empresa" (AC-ra-16)
function PortfolioReportPage() {
  const { preferences } = usePreferences();
  const consultant = preferences.usageMode === "consultant";

  return (
    <section aria-labelledby="portfolio-report-title" className="grid gap-6" data-aioson-id="portfolio-report">
      <header className="min-w-0">
        <h1 id="portfolio-report-title">Relatório da carteira</h1>
        {consultant ? <p className="mt-1 text-text-soft">Todas as empresas que você atende, numa visão só.</p> : null}
      </header>
      {consultant ? <ConsultantPortfolio /> : <OwnerModeNotice />}
    </section>
  );
}

export { PortfolioReportPage };
