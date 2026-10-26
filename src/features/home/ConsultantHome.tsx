import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { getRiskInfo } from "../../../shared/content/riskCatalog";
import { STAGES } from "../../../shared/content/stageContent";
import type { StageNumber } from "../../../shared/domain/types";
import type { Company, CompanyAttention } from "@/api/companiesApi";
import type { ConsultantHomeData, HomeCompanyItem } from "@/api/homeApi";
import { StatusView } from "@/components/feedback/StatusView";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/features/companies/CompanyPage";
import { CompanyFormDialog } from "@/features/companies/CompanyFormDialog";
import { cn } from "@/lib/utils";

const RISER_HEIGHTS: Record<StageNumber, string> = { 1: "28%", 2: "48%", 3: "68%", 4: "88%" };

function countLabel(count: number): string {
  return count === 1 ? "1 empresa" : `${count} empresas`;
}

function companyPath(companyId: string): string {
  return `/empresa/${encodeURIComponent(companyId)}`;
}

// "aguardando" is a valid list filter of the server (IF-011) that the shared CompanyAttention type has yet to name
type HomeAttention = CompanyAttention | "aguardando";

// The newest unanswered questionnaire of each active company, longest wait first; the key is absent when
// nobody waits (IF-011)
interface HomeAwaitingQuestionnaire extends HomeCompanyItem {
  sentAt: string;
  waitingDays: number;
}

function awaitingQuestionnaires(data: ConsultantHomeData): HomeAwaitingQuestionnaire[] {
  return (data as ConsultantHomeData & { awaitingQuestionnaires?: HomeAwaitingQuestionnaire[] }).awaitingQuestionnaires ?? [];
}

function waitingLabel(days: number): string {
  return days === 0 ? "enviado hoje" : days === 1 ? "enviado há 1 dia" : `enviado há ${days} dias`;
}

function attentionPath(attention: HomeAttention): string {
  return `/empresas?atencao=${attention}`;
}

function joinNames(items: HomeCompanyItem[]): string {
  return items.map((item) => item.name).join(", ");
}

function stageCount(data: ConsultantHomeData, stage: StageNumber): number {
  return data.byStage.find((group) => group.stage === stage)?.count ?? 0;
}

// Stage of each company's latest diagnosis, for the tag beside it in the attention lists
function stagesByCompany(data: ConsultantHomeData): Map<string, StageNumber> {
  return new Map(data.byStage.flatMap((group) => group.companies.map((company) => [company.companyId, group.stage] as const)));
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

// Opens the company form in create mode and goes to the new company once saved
function NewCompanyButton({ label, dataId, variant = "metal" }: { label: string; dataId: string; variant?: "metal" | "default" }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  function handleSaved(company: Company) {
    setOpen(false);
    navigate(companyPath(company.id));
  }
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} data-aioson-id={dataId}>
        {label}
      </Button>
      <CompanyFormDialog open={open} onOpenChange={setOpen} onSaved={handleSaved} />
    </>
  );
}

// The portfolio ladder: each step counts the companies at that stage and opens the filtered list
function PortfolioLadder({ data }: { data: ConsultantHomeData }) {
  return (
    <figure data-aioson-id="escada" className="m-0 rounded-lg border border-line-strong bg-surface px-4 pt-8 pb-4 sm:px-6">
      <div className="grid h-[180px] grid-cols-4 items-end gap-3 px-2 sm:h-[210px]" aria-label="Carteira por estágio" role="group">
        {STAGES.map((info) => {
          const count = stageCount(data, info.number);
          return (
            <Link
              key={info.number}
              to={`/empresas?estagio=${info.number}`}
              data-step={info.number}
              data-count={count}
              aria-label={`Ver empresas no estágio ${info.number}, ${info.name}: ${countLabel(count)}`}
              className="relative flex h-full min-w-0 flex-col justify-end rounded-sm no-underline"
            >
              <span
                className={cn(
                  "relative block rounded-t-sm border border-b-0",
                  count > 0 ? "border-bronze bg-wash" : "border-line bg-surface-raised",
                )}
                style={{ height: RISER_HEIGHTS[info.number] }}
              >
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-sm bg-surface px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-text">
                  {count}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <div aria-hidden="true" className="mx-2 h-6 border-l-2 border-bronze bg-[repeating-linear-gradient(to_bottom,var(--line-strong)_0_1px,transparent_1px_6px)]" />
      <div className="grid grid-cols-4 gap-3 px-2 pt-2" aria-hidden="true">
        {STAGES.map((info) => (
          <b key={info.number} className="block text-sm leading-tight font-semibold break-words text-text-soft">
            {info.number}. {info.name}
          </b>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap justify-between gap-3 border-t border-line pt-3 text-sm text-text-muted">
        <span>Empresas por estágio no último diagnóstico</span>
        <span>Toque num degrau para ver a lista</span>
      </figcaption>
    </figure>
  );
}

function PortfolioSummary({ data }: { data: ConsultantHomeData }) {
  const parts = STAGES.map((info) => `${stageCount(data, info.number)} em ${info.name}`);
  const without = data.withoutDiagnosis.length;
  return (
    <div className="min-w-0">
      <h2 className="text-[clamp(2rem,1.7rem+1.6vw,2.75rem)] leading-[1.05] font-bold tracking-[-0.03em]">Carteira por estágio</h2>
      <p data-aioson-id="consult-summary" className="mt-4 max-w-[40ch] text-lg text-text-soft">
        {parts.slice(0, -1).join(", ")} e {parts[parts.length - 1]}.
        {without > 0 ? " " : ""}
        {without > 0 ? (
          <Link to={attentionPath("sem-diagnostico")} className="underline">
            {countLabel(without)} sem diagnóstico concluído.
          </Link>
        ) : null}
      </p>
    </div>
  );
}

interface AttentionIndicator {
  attention: HomeAttention;
  title: string;
  value: number;
  detail: string;
}

// "O que precisa de você" (AC-ra-35): every number comes from the home route, and each card opens the
// company list filtered by what it counted
function attentionIndicators(data: ConsultantHomeData): AttentionIndicator[] {
  const overdueActionCount = data.overdueActions.reduce((total, item) => total + item.overdueCount, 0);
  const overdueActionCompanies = data.overdueActions.length;
  const awaiting = awaitingQuestionnaires(data);
  return [
    {
      attention: "atrasada",
      title: "Reavaliação atrasada",
      value: data.overdue.length,
      detail:
        data.overdue.length > 0
          ? data.overdue.map((item) => `${item.name} (há ${item.daysSince} dias)`).join(", ")
          : `Nenhuma empresa passou dos ${data.reevaluationDays} dias.`,
    },
    {
      attention: "vencidas",
      title: "Ações vencidas",
      value: overdueActionCount,
      detail: overdueActionCompanies === 1 ? "em 1 empresa" : `em ${overdueActionCompanies} empresas`,
    },
    {
      attention: "risco",
      title: "Risco alto",
      value: data.highRisk.length,
      detail: joinNames(data.highRisk) || "Nenhuma",
    },
    {
      attention: "rascunhos",
      title: "Rascunhos parados",
      value: data.staleDrafts.length,
      detail: data.staleDrafts.length > 0 ? joinNames(data.staleDrafts) : "Nenhum rascunho sem resposta há mais de 7 dias.",
    },
    {
      attention: "aguardando",
      title: "Questionários aguardando resposta",
      value: awaiting.length,
      detail: awaiting.length > 0 ? awaiting.map((item) => `${item.name}, ${waitingLabel(item.waitingDays)}`).join("; ") : "Nenhum",
    },
  ];
}

function AttentionWidgets({ data }: { data: ConsultantHomeData }) {
  return (
    <section data-aioson-id="consult-attention" aria-labelledby="consult-attention-title" className="min-w-0">
      <h2 id="consult-attention-title" className="text-xl">
        O que precisa de você
      </h2>
      <ul className="m-0 mt-3 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-0">
        {attentionIndicators(data).map((indicator) => (
          <li key={indicator.attention} className="min-w-0">
            <Link
              to={attentionPath(indicator.attention)}
              data-attention={indicator.attention}
              data-count={indicator.value}
              className={cn(
                "group flex h-full min-h-(--touch) flex-col gap-1 rounded-lg border border-line-strong bg-surface px-4 py-3 text-text no-underline",
                "transition-colors duration-(--fast) ease-app hover:border-bronze",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <b className="text-sm font-semibold text-text-soft">{indicator.title}</b>
                <span className="text-text-muted group-hover:text-bronze">
                  <ArrowIcon />
                </span>
              </span>
              <span className="font-mono text-3xl leading-none">{indicator.value}</span>
              <span className="text-sm break-words text-text-muted">{indicator.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompanyRow({ item, note, stage }: { item: HomeCompanyItem; note: string; stage?: StageNumber }) {
  return (
    <li data-company-id={item.companyId} className="flex items-center justify-between gap-3 border-b border-line py-2">
      <div className="min-w-0">
        <Link to={companyPath(item.companyId)} className="inline-flex min-h-(--touch) items-center font-semibold break-words text-text no-underline hover:underline">
          {item.name}
        </Link>
        <p className="text-sm text-text-muted">{note}</p>
      </div>
      {stage ? <span className="shrink-0 font-mono text-xs text-bronze">Estágio {stage}</span> : null}
    </li>
  );
}

function AttentionList({ title, hint, dataId, emptyText, children }: { title: string; hint: string; dataId: string; emptyText: string; children: ReactNode[] }) {
  const headingId = `${dataId}-title`;
  return (
    <section data-aioson-id={dataId} aria-labelledby={headingId} className="min-w-0">
      <h2 id={headingId} className="text-xl">
        {title}
      </h2>
      <p className="mt-1 mb-2 text-sm text-text-muted">{hint}</p>
      {children.length > 0 ? <ul className="m-0 list-none border-t border-line p-0">{children}</ul> : <p className="text-sm text-text-soft">{emptyText}</p>}
    </section>
  );
}

function AttentionLists({ data }: { data: ConsultantHomeData }) {
  const stages = stagesByCompany(data);
  return (
    <div className="grid items-start gap-8 lg:grid-cols-3">
      <AttentionList title="Rascunhos parados" hint="Sem resposta há mais de 7 dias." dataId="consult-stalled" emptyText="Nenhum rascunho parado.">
        {data.staleDrafts.map((item) => (
          <CompanyRow
            key={item.companyId}
            item={item}
            stage={stages.get(item.companyId)}
            note={`Parado há ${item.idleDays} dias · salvo em ${formatDate(item.updatedAt)}`}
          />
        ))}
      </AttentionList>
      <AttentionList title="Sem diagnóstico recente" hint={`Último diagnóstico há mais de ${data.reevaluationDays} dias, ou nenhum.`} dataId="consult-old" emptyText="Todas em dia.">
        {[
          ...data.withoutDiagnosis.map((item) => <CompanyRow key={`new-${item.companyId}`} item={item} note="Nunca diagnosticada" />),
          ...data.overdue.map((item) => (
            <CompanyRow
              key={item.companyId}
              item={item}
              stage={stages.get(item.companyId)}
              note={`Há ${item.daysSince} dias · ${formatDate(item.lastDiagnosisAt)}`}
            />
          )),
        ]}
      </AttentionList>
      <AttentionList title="Com risco alto" hint="Pelo menos um risco com nota 16 ou mais." dataId="consult-risk" emptyText="Nenhuma empresa com risco alto.">
        {data.highRisk.map((item) => (
          <CompanyRow
            key={item.companyId}
            item={item}
            stage={stages.get(item.companyId)}
            note={`${getRiskInfo(item.signalId).title} · nota ${item.riskScore}`}
          />
        ))}
      </AttentionList>
    </div>
  );
}

// Consultant mode: the portfolio by stage stays the focus (AC-dm-34), followed by "O que precisa de você"
// (AC-ra-35) and the attention lists; empty state of AC-dm-35
function ConsultantHome({ data }: { data: ConsultantHomeData }) {
  const total = data.companyCount;
  if (total === 0) {
    return (
      <StatusView
        state="empty"
        dataId="home-consult-empty"
        title="Nenhuma empresa cadastrada"
        description="Cadastre a primeira empresa para começar um diagnóstico. Cada empresa guarda o seu histórico."
        action={<NewCompanyButton label="Cadastrar a primeira empresa" dataId="home-first-company" />}
      />
    );
  }
  return (
    <div data-aioson-id="home-consultant" className="grid gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="meta-line">Consultoria</p>
          <h1 className="mt-2">Sua carteira</h1>
          <p data-aioson-id="consult-active-count" className="mt-1 text-text-soft">
            {total === 1 ? "1 empresa ativa" : `${total} empresas ativas`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/relatorios/carteira" className={buttonVariants({ variant: "default" })} data-aioson-id="home-portfolio-report">
            <FileIcon />
            Relatório da carteira
          </Link>
          <NewCompanyButton label="Nova empresa" dataId="consult-new-company" variant="default" />
        </div>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <PortfolioLadder data={data} />
        <PortfolioSummary data={data} />
      </div>
      <AttentionWidgets data={data} />
      <AttentionLists data={data} />
    </div>
  );
}

export { ConsultantHome, NewCompanyButton };
