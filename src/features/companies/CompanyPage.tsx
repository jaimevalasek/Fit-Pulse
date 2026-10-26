import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link, Outlet, useNavigate, useOutletContext, useParams } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusView } from "@/components/feedback/StatusView";
import { isApiError } from "@/api/httpClient";
import {
  archiveCompany,
  countCompanyDiagnoses,
  deleteCompany,
  getCompany,
  restoreCompany,
  type Company,
} from "@/api/companiesApi";
import { getConsultantHome, type ConsultantHomeData } from "@/api/homeApi";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { ImportAnswersDialog } from "@/features/questionnaire/ImportAnswersDialog";
import { SendQuestionnaireDialog } from "@/features/questionnaire/SendQuestionnaireDialog";
import { CompanyFormDialog } from "./CompanyFormDialog";
import { CompanyTabs } from "./CompanyTabs";
import {
  ANNUAL_REVENUE_RANGE_LABELS,
  SALES_CHANNEL_LABELS,
  SEGMENT_LABELS,
} from "../../../shared/content/companyOptions";
import { getStage } from "../../../shared/content/stageContent";
import { maskCnpj } from "../../../shared/format/cnpj";
import type { StageNumber } from "../../../shared/domain/types";

type CompanyStatusAction = "archive" | "restore" | "delete";

interface CompanyStatusDialogProps {
  action: CompanyStatusAction | null;
  company: Company | null;
  onClose: () => void;
  onDone: (action: CompanyStatusAction, company: Company) => void;
}

interface CompanyPageProps {
  // Creates (or reopens) the draft through the diagnosis API and returns its id. Wired by the
  // questionnaire integration; without it the start buttons stay hidden.
  onStartDiagnosis?: (companyId: string) => Promise<{ id: string }>;
}

// What the company layout hands to its tabs (the diagnoses index and the report center)
interface CompanyOutletContext {
  company: Company;
  reload: () => void;
  onStartDiagnosis?: CompanyPageProps["onStartDiagnosis"];
  onStatusAction: (action: CompanyStatusAction) => void;
}

function useCompanyOutlet(): CompanyOutletContext {
  return useOutletContext<CompanyOutletContext>();
}

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : DATE_FORMAT.format(date);
}

function formatDaysAgo(iso: string): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));
  if (Number.isNaN(days)) return "";
  return days === 0 ? "hoje" : days === 1 ? "há 1 dia" : `há ${days} dias`;
}

function formatStage(stage: StageNumber): string {
  return `Estágio ${stage} · ${getStage(stage).name}`;
}

function describeDeletion(count: number): string {
  const diagnoses = count === 1 ? "1 diagnóstico" : `${count} diagnósticos`;
  return `A empresa e ${diagnoses} serão apagados deste computador. Não dá para desfazer. Se quiser guardar, exporte uma cópia antes em Configurações.`;
}

function getStatusCopy(action: CompanyStatusAction, company: Company) {
  if (action === "archive") {
    return {
      title: `Arquivar ${company.name}?`,
      consequence: "A empresa sai da carteira e da tela inicial. O histórico fica guardado e você pode restaurá-la quando quiser.",
      confirmLabel: "Arquivar empresa",
      tone: "metal" as const,
      run: archiveCompany,
    };
  }
  if (action === "restore") {
    return {
      title: `Restaurar ${company.name}?`,
      consequence: "A empresa volta para a carteira e para a tela inicial, com todos os diagnósticos.",
      confirmLabel: "Restaurar empresa",
      tone: "metal" as const,
      run: restoreCompany,
    };
  }
  return {
    title: `Excluir ${company.name}?`,
    consequence: describeDeletion(countCompanyDiagnoses(company)),
    confirmLabel: "Excluir definitivamente",
    tone: "destructive" as const,
    run: deleteCompany,
  };
}

// Archive, restore and delete always go through the app's own confirmation (AC-dm-06, AC-dm-48)
function CompanyStatusDialog({ action, company, onClose, onDone }: CompanyStatusDialogProps) {
  if (!action || !company) return null;
  const copy = getStatusCopy(action, company);
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={copy.title}
      consequence={copy.consequence}
      confirmLabel={copy.confirmLabel}
      tone={copy.tone}
      dataId={`company-${action}-confirm`}
      onConfirm={async () => {
        await copy.run(company.id);
        onDone(action, company);
      }}
    />
  );
}

function useCompany(companyId: string) {
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    getCompany(companyId, controller.signal)
      .then((loaded) => setCompany(loaded))
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) setError(caught);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [companyId, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { company, setCompany, error, isLoading, reload };
}

function describeCompany(company: Company): string {
  const parts = [SEGMENT_LABELS[company.segment], SALES_CHANNEL_LABELS[company.salesChannel]];
  if (company.annualRevenueRange) parts.push(ANNUAL_REVENUE_RANGE_LABELS[company.annualRevenueRange]);
  if (company.cnpj) parts.push(`CNPJ ${maskCnpj(company.cnpj)}`);
  return parts.filter(Boolean).join(" · ");
}

interface StartDiagnosisButtonProps {
  company: Company;
  label: string;
  onStartDiagnosis?: CompanyPageProps["onStartDiagnosis"];
  dataId?: string;
}

function StartDiagnosisButton({ company, label, onStartDiagnosis, dataId }: StartDiagnosisButtonProps) {
  const navigate = useNavigate();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!onStartDiagnosis) return null;

  async function handleStart() {
    if (isStarting || !onStartDiagnosis) return;
    setIsStarting(true);
    setError(null);
    try {
      const draft = await onStartDiagnosis(company.id);
      navigate(`/diagnostico/${encodeURIComponent(draft.id)}`);
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

interface CompanySectionProps {
  company: Company;
  onStartDiagnosis?: CompanyPageProps["onStartDiagnosis"];
}

function CompanyHeaderActions({ company, onStartDiagnosis, onEdit, questionnaire }: CompanySectionProps & { onEdit: () => void; questionnaire?: ReactNode }) {
  const isArchived = Boolean(company.archivedAt);
  return (
    <div className="flex flex-wrap gap-2">
      {isArchived ? null : questionnaire}
      <Button variant="default" onClick={onEdit} data-aioson-id="company-edit">
        Editar dados
      </Button>
      {isArchived ? null : company.draftId ? (
        <Link to={`/diagnostico/${encodeURIComponent(company.draftId)}`} className={buttonVariants({ variant: "metal" })}>
          Continuar diagnóstico
        </Link>
      ) : company.completedCount > 0 ? (
        <StartDiagnosisButton company={company} label="Novo diagnóstico" onStartDiagnosis={onStartDiagnosis} dataId="company-new-diag" />
      ) : null}
    </div>
  );
}

// The newest send still waiting for the client's answers. The company route carries no send, so it
// comes from "Questionários aguardando resposta" of the consultant home (IF-008); absent means none waits.
type AwaitingHomeData = ConsultantHomeData & { awaitingQuestionnaires?: Array<{ companyId: string; sentAt: string }> };

function usePendingQuestionnaire(companyId: string, enabled: boolean) {
  const [sentAt, setSentAt] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setSentAt(null);
    if (!enabled) return;
    const controller = new AbortController();
    getConsultantHome(controller.signal)
      .then((home) => {
        const waiting = (home as AwaitingHomeData).awaitingQuestionnaires ?? [];
        setSentAt(waiting.find((item) => item.companyId === companyId)?.sentAt ?? null);
      })
      // The line is a reminder; the page works the same without it
      .catch(() => undefined);
    return () => controller.abort();
  }, [companyId, enabled, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { sentAt, setSentAt, reload };
}

type QuestionnaireDialog = "send" | "import" | null;

interface CompanyQuestionnaireProps {
  company: Company;
  onSent: (sentAt: string) => void;
  onImported: () => void;
}

// Consultant mode only (CAP-ra-remote-questionnaire): "Enviar questionário" and "Importar respostas"
function CompanyQuestionnaireActions({ company, onSent, onImported }: CompanyQuestionnaireProps) {
  const [dialog, setDialog] = useState<QuestionnaireDialog>(null);
  const closeWhen = (open: boolean) => !open && setDialog(null);
  return (
    <>
      <Button variant="default" onClick={() => setDialog("send")} data-aioson-id="send-questionnaire">
        Enviar questionário
      </Button>
      <Button variant="default" onClick={() => setDialog("import")} data-aioson-id="import-answers">
        Importar respostas
      </Button>
      <SendQuestionnaireDialog open={dialog === "send"} onOpenChange={closeWhen} company={company} onSent={(send) => onSent(send.sentAt)} />
      <ImportAnswersDialog open={dialog === "import"} onOpenChange={closeWhen} company={company} onImported={onImported} />
    </>
  );
}

function QuestionnaireSentNotice({ sentAt }: { sentAt: string | null }) {
  if (!sentAt) return null;
  return (
    <p data-aioson-id="questionnaire-sent" className="mt-1 text-sm text-text-soft">
      Questionário enviado em <span className="font-mono">{formatDate(sentAt)}</span>. Quando o cliente devolver o arquivo de respostas, use
      "Importar respostas".
    </p>
  );
}

function CompanyLoadState({ error, isLoading, onRetry }: { error: unknown; isLoading: boolean; onRetry: () => void }) {
  if (isApiError(error) && error.status === 404) {
    return (
      <section data-state="not-found" aria-labelledby="company-missing" className="grid gap-3">
        <h1 id="company-missing">Empresa não encontrada</h1>
        <p className="text-text-soft">Ela pode ter sido excluída.</p>
        <p>
          <Link to="/empresas">Ir para Empresas</Link>
        </p>
      </section>
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : undefined;
    return <StatusView state="error" description={message} onRetry={onRetry} />;
  }
  return isLoading ? <StatusView state="loading" title="Carregando a empresa…" /> : null;
}

function CompanyPage({ onStartDiagnosis }: CompanyPageProps) {
  const { companyId = "" } = useParams();
  const navigate = useNavigate();
  const { company, setCompany, error, isLoading, reload } = useCompany(companyId);
  const [isEditing, setIsEditing] = useState(false);
  const [statusAction, setStatusAction] = useState<CompanyStatusAction | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { preferences } = usePreferences();
  const isConsultant = preferences.usageMode === "consultant";
  const pending = usePendingQuestionnaire(companyId, isConsultant);
  // Bumped by an import so the open tab (the timeline) loads the new draft again
  const [importCount, setImportCount] = useState(0);

  if (!company || company.id !== companyId) {
    return <CompanyLoadState error={error} isLoading={isLoading || !error} onRetry={reload} />;
  }

  function handleStatusDone(action: CompanyStatusAction, target: Company) {
    setStatusAction(null);
    if (action === "delete") {
      navigate("/empresas?arquivadas=1", { replace: true });
      return;
    }
    setNotice(action === "archive" ? `${target.name} arquivada.` : `${target.name} restaurada.`);
    reload();
  }

  return (
    <section aria-labelledby="company-title" data-aioson-id="company-page">
      <nav aria-label="Caminho" className="mb-2 text-sm">
        <Link to="/empresas" className="inline-flex min-h-(--touch) items-center">
          Empresas
        </Link>
      </nav>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="company-title" className="break-words">{company.name}</h1>
          <p className="text-sm text-text-soft">
            {describeCompany(company)}
            {company.archivedAt ? <span className="ml-2 rounded-sm border border-line-strong px-1.5 text-xs">Arquivada</span> : null}
          </p>
          {company.archivedAt ? null : <QuestionnaireSentNotice sentAt={pending.sentAt} />}
        </div>
        <CompanyHeaderActions
          company={company}
          onStartDiagnosis={onStartDiagnosis}
          onEdit={() => setIsEditing(true)}
          questionnaire={
            isConsultant ? (
              <CompanyQuestionnaireActions
                company={company}
                onSent={(sentAt) => {
                  pending.setSentAt(sentAt);
                  setNotice(`Questionário de ${company.name} salvo na pasta Downloads.`);
                }}
                onImported={() => {
                  pending.reload();
                  setImportCount((count) => count + 1);
                  reload();
                }}
              />
            ) : null
          }
        />
      </header>
      <CompanyTabs company={company} />
      <p role="status" className="mb-2 min-h-[1.25em] text-sm text-ok">
        {notice}
      </p>
      <Outlet key={importCount} context={{ company, reload, onStartDiagnosis, onStatusAction: setStatusAction } satisfies CompanyOutletContext} />
      <CompanyFormDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        company={company}
        onSaved={(saved) => {
          setCompany(saved);
          setNotice(`Dados de ${saved.name} salvos.`);
        }}
      />
      <CompanyStatusDialog action={statusAction} company={company} onClose={() => setStatusAction(null)} onDone={handleStatusDone} />
    </section>
  );
}

export { CompanyPage, CompanyStatusDialog, StartDiagnosisButton, formatDate, formatDaysAgo, formatStage, useCompanyOutlet };
export type { CompanyOutletContext, CompanyPageProps, CompanyStatusAction };
