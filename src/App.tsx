import { useEffect, useState } from "react";
import { HashRouter, Link, Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import { CompaniesPage } from "@/features/companies/CompaniesPage";
import { CompanyPage } from "@/features/companies/CompanyPage";
import { CompanyDiagnosesTab } from "@/features/companies/CompanyDiagnosesTab";
import { CompanyActionsTab } from "@/features/actions/CompanyActionsTab";
import { CompanyDiaryTab } from "@/features/diary/CompanyDiaryTab";
import { QuestionnairePage } from "@/features/diagnosis/QuestionnairePage";
import { ResultPage } from "@/features/result/ResultPage";
import { ComparePage } from "@/features/history/ComparePage";
import { PortfolioReportPage } from "@/features/report-center/PortfolioReportPage";
import { ReportCenterPage } from "@/features/report-center/ReportCenterPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { HomePage } from "@/features/home/HomePage";
import { WelcomeModePage } from "@/features/firstRun/WelcomeModePage";
import { WelcomeCompanyPage } from "@/features/firstRun/WelcomeCompanyPage";
import { TourProvider } from "@/features/home/OnboardingTour";
import { StatusView } from "@/components/feedback/StatusView";
import { listCompanies } from "@/api/companiesApi";
import { startDiagnosis } from "@/api/diagnosesApi";

type RootTarget = { status: "loading" } | { status: "error" } | { status: "ready"; to: string };

// Archived companies are still registered, so only an empty database opens the wizard
async function hasAnyCompany(signal: AbortSignal): Promise<boolean> {
  if ((await listCompanies({}, signal)).length > 0) return true;
  return (await listCompanies({ archived: true }, signal)).length > 0;
}

// "/" opens the first-run wizard when no company exists (BR-dm-11, AC-dm-01), the home otherwise
function RootRedirect() {
  const [target, setTarget] = useState<RootTarget>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setTarget({ status: "loading" });
    hasAnyCompany(controller.signal)
      .then((any) => setTarget({ status: "ready", to: any ? "/inicio" : "/boas-vindas" }))
      .catch(() => {
        if (!controller.signal.aborted) setTarget({ status: "error" });
      });
    return () => controller.abort();
  }, [attempt]);

  if (target.status === "ready") return <Navigate to={target.to} replace />;
  if (target.status === "error") {
    return (
      <StatusView
        state="error"
        dataId="root-error"
        title="Não foi possível abrir o FitPulse"
        description="Os dados continuam salvos neste computador."
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }
  return <StatusView state="loading" dataId="root-loading" title="Abrindo o FitPulse…" />;
}

function NotFoundScreen() {
  return (
    <section data-state="not-found" aria-labelledby="not-found-title" className="grid gap-3">
      <p className="meta-line">Endereço não encontrado</p>
      <h1 id="not-found-title">Esta página não existe</h1>
      <p className="text-text-soft">O endereço pode ter mudado ou a página foi removida.</p>
      <p>
        <Link to="/empresas" className="inline-flex min-h-(--touch) items-center">
          Ir para Empresas
        </Link>
      </p>
    </section>
  );
}

export function App() {
  return (
    <HashRouter>
      <TourProvider>
        <AppShell>
          <Routes>
            <Route index element={<RootRedirect />} />
            <Route path="boas-vindas" element={<WelcomeModePage />} />
            <Route path="boas-vindas/empresa" element={<WelcomeCompanyPage />} />
            <Route path="inicio" element={<HomePage />} />
            <Route path="empresas" element={<CompaniesPage />} />
            <Route path="empresa/:companyId" element={<CompanyPage onStartDiagnosis={startDiagnosis} />}>
              <Route index element={<CompanyDiagnosesTab />} />
              <Route path="acoes" element={<CompanyActionsTab />} />
              <Route path="diario" element={<CompanyDiaryTab />} />
              <Route path="relatorios" element={<ReportCenterPage />} />
            </Route>
            <Route path="diagnostico/:diagnosisId" element={<QuestionnairePage />} />
            <Route path="resultado/:diagnosisId" element={<ResultPage />} />
            <Route path="comparar/:diagnosisId" element={<ComparePage />} />
            <Route path="relatorios/carteira" element={<PortfolioReportPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Routes>
        </AppShell>
      </TourProvider>
    </HashRouter>
  );
}
