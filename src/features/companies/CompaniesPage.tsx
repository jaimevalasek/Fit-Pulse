import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusView } from "@/components/feedback/StatusView";
import { listCompanies, type Company, type CompanyAttention } from "@/api/companiesApi";
import { cn } from "@/lib/utils";
import { CompanyFormDialog } from "./CompanyFormDialog";
import { CompanyStatusDialog, formatDate, formatDaysAgo, formatStage, type CompanyStatusAction } from "./CompanyPage";
import { SEGMENT_LABELS } from "../../../shared/content/companyOptions";
import type { StageNumber } from "../../../shared/domain/types";

// "aguardando" is a list filter the server accepts (IF-011) that the shared CompanyAttention type has yet to name
type ListAttention = CompanyAttention | "aguardando";

interface CompanyFilters {
  search: string;
  stage: StageNumber | null;
  attention: ListAttention | null;
  isArchived: boolean;
}

const SEARCH_DEBOUNCE_MS = 250;
const STAGE_FILTERS: { value: StageNumber | null; label: string }[] = [
  { value: null, label: "Todos" },
  { value: 1, label: "Estágio 1" },
  { value: 2, label: "Estágio 2" },
  { value: 3, label: "Estágio 3" },
  { value: 4, label: "Estágio 4" },
];

// What each indicator of "O que precisa de você" opens (AC-ra-35), as the list names it
const ATTENTION_LABELS: Record<ListAttention, string> = {
  atrasada: "Reavaliação atrasada",
  vencidas: "Ações vencidas",
  risco: "Risco alto",
  rascunhos: "Rascunhos parados",
  "sem-diagnostico": "Sem diagnóstico",
  aguardando: "Questionários aguardando resposta",
};

function parseAttention(value: string | null): ListAttention | null {
  return value && Object.hasOwn(ATTENTION_LABELS, value) ? (value as ListAttention) : null;
}

function parseStage(value: string | null): StageNumber | null {
  const stage = Number(value);
  return stage === 1 || stage === 2 || stage === 3 || stage === 4 ? stage : null;
}

// The URL owns the filters: ?busca=, ?estagio=1..4, ?atencao= and ?arquivadas=1
function useCompanyFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters: CompanyFilters = {
    search: searchParams.get("busca") ?? "",
    stage: parseStage(searchParams.get("estagio")),
    attention: parseAttention(searchParams.get("atencao")),
    isArchived: searchParams.get("arquivadas") === "1",
  };

  const buildSearch = useCallback(
    (next: Partial<CompanyFilters>) => {
      const merged = { ...filters, ...next };
      const params = new URLSearchParams();
      if (merged.search) params.set("busca", merged.search);
      if (merged.stage) params.set("estagio", String(merged.stage));
      if (merged.attention) params.set("atencao", merged.attention);
      if (merged.isArchived) params.set("arquivadas", "1");
      const search = params.toString();
      return search ? `?${search}` : "";
    },
    [filters.search, filters.stage, filters.attention, filters.isArchived],
  );

  const setSearch = (search: string) => setSearchParams(buildSearch({ search }).replace(/^\?/, ""), { replace: true });
  return { filters, buildSearch, setSearch };
}

function useCompanyList(filters: CompanyFilters) {
  const [companies, setCompanies] = useState<Company[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const { search, stage, attention, isArchived } = filters;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setError(null);
      // The query string carries the value as is; the cast only covers the narrower shared type
      listCompanies({ q: search, stage, attention: attention as CompanyAttention | null, archived: isArchived }, controller.signal)
        .then(setCompanies)
        .catch((caught: unknown) => {
          if (!controller.signal.aborted) setError(caught);
        });
    }, search ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, stage, attention, isArchived, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  return { companies, error, reload };
}

interface RowActionsProps {
  company: Company;
  onEdit: (company: Company) => void;
  onAction: (action: CompanyStatusAction, company: Company) => void;
}

function RowActions({ company, onEdit, onAction }: RowActionsProps) {
  if (company.archivedAt) {
    return (
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => onAction("restore", company)} aria-label={`Restaurar ${company.name}`}>
          Restaurar
        </Button>
        <Button variant="ghost" size="sm" className="text-danger" onClick={() => onAction("delete", company)} aria-label={`Excluir ${company.name}`}>
          Excluir
        </Button>
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => onEdit(company)} aria-label={`Editar ${company.name}`}>
        Editar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onAction("archive", company)} aria-label={`Arquivar ${company.name}`}>
        Arquivar
      </Button>
    </div>
  );
}

function CompanyRow({ company, onEdit, onAction }: RowActionsProps) {
  return (
    <tr data-row-id={company.id} className={cn("border-t border-line", company.archivedAt && "text-text-soft")}>
      <td className="py-3 pr-3">
        <Link to={`/empresa/${encodeURIComponent(company.id)}`} className="inline-flex min-h-(--touch) items-center font-medium break-words">
          {company.name}
        </Link>
        <small className="block text-xs text-text-muted">{SEGMENT_LABELS[company.segment]}</small>
      </td>
      <td className="py-3 pr-3 text-sm">
        {company.latestStage ? formatStage(company.latestStage) : <span className="text-text-muted">Sem diagnóstico</span>}
      </td>
      <td className="py-3 pr-3 text-sm max-sm:hidden">
        {company.latestCompletedAt ? (
          <>
            <span className="font-mono">{formatDate(company.latestCompletedAt)}</span>
            <span className="block text-xs text-text-muted">{formatDaysAgo(company.latestCompletedAt)}</span>
          </>
        ) : (
          "-"
        )}
      </td>
      <td className="py-3 pr-3 text-sm max-sm:hidden">{company.draftId ? <span className="text-warn">Rascunho em andamento</span> : null}</td>
      <td className="py-3">
        <RowActions company={company} onEdit={onEdit} onAction={onAction} />
      </td>
    </tr>
  );
}

function CompanyTable(props: { companies: Company[] } & Omit<RowActionsProps, "company">) {
  return (
    <table data-aioson-id="companies-table" className="w-full table-fixed border-collapse text-left">
      <thead className="text-xs text-text-muted">
        <tr>
          <th className="w-[38%] pb-2 font-medium max-sm:w-[50%]">Empresa</th>
          <th className="pb-2 font-medium">Estágio atual</th>
          <th className="pb-2 font-medium max-sm:hidden">Último diagnóstico</th>
          <th className="pb-2 font-medium max-sm:hidden">Atenção</th>
          <th className="w-[168px] pb-2 max-sm:w-[150px]">
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {props.companies.map((company) => (
          <CompanyRow key={company.id} company={company} onEdit={props.onEdit} onAction={props.onAction} />
        ))}
      </tbody>
    </table>
  );
}

function CompaniesToolbar({ filters, buildSearch, onSearch }: { filters: CompanyFilters; buildSearch: (next: Partial<CompanyFilters>) => string; onSearch: (value: string) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1 basis-[220px]">
        <label htmlFor="busca" className="sr-only">
          Buscar empresa
        </label>
        <Input id="busca" type="search" autoComplete="off" placeholder="Buscar pelo nome" value={filters.search} onChange={(event) => onSearch(event.target.value)} />
      </div>
      <nav aria-label="Filtrar por estágio" className="flex flex-wrap gap-1">
        {STAGE_FILTERS.map((option) => (
          <Link
            key={option.label}
            to={{ search: buildSearch({ stage: option.value }) }}
            replace
            aria-current={filters.stage === option.value ? "true" : undefined}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "aria-[current=true]:border-bronze aria-[current=true]:text-text")}
          >
            {option.label}
          </Link>
        ))}
      </nav>
      <Link to={{ search: buildSearch({ isArchived: !filters.isArchived }) }} className={buttonVariants({ variant: "ghost" })}>
        {filters.isArchived ? "Ver ativas" : "Ver arquivadas"}
      </Link>
    </div>
  );
}

// Names the filters in use so a list opened from the home says what it is showing (AC-ra-35)
function ActiveFilters({ filters }: { filters: CompanyFilters }) {
  const parts = [
    filters.attention ? ATTENTION_LABELS[filters.attention] : null,
    filters.stage ? `Estágio ${filters.stage}` : null,
    filters.search ? `Nome com "${filters.search}"` : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return null;
  return (
    <div data-aioson-id="companies-active-filter" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-4 py-2">
      <p className="text-sm text-text-soft">
        Filtro ativo: <b className="font-semibold text-text">{parts.join(" · ")}</b>
      </p>
      <Link to={filters.isArchived ? "/empresas?arquivadas=1" : "/empresas"} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        Limpar filtros
      </Link>
    </div>
  );
}

function CompaniesBody(props: { companies: Company[]; filters: CompanyFilters; onCreate: () => void } & Omit<RowActionsProps, "company">) {
  const { companies, filters, onCreate } = props;
  if (companies.length > 0) return <CompanyTable companies={companies} onEdit={props.onEdit} onAction={props.onAction} />;
  if (!filters.search && !filters.stage && !filters.attention && !filters.isArchived) {
    return (
      <StatusView
        state="empty"
        dataId="companies-empty"
        title="Nenhuma empresa cadastrada"
        description="Cadastre a primeira empresa para começar um diagnóstico. Cada empresa guarda o seu histórico."
        action={
          <Button variant="metal" onClick={onCreate}>
            Cadastrar a primeira empresa
          </Button>
        }
      />
    );
  }
  const reason = filters.search
    ? `Nenhum nome contém "${filters.search}".`
    : filters.isArchived && !filters.stage && !filters.attention
      ? "Nenhuma empresa arquivada."
      : "Nenhuma empresa com esse filtro.";
  return (
    <StatusView
      state="empty"
      title="Nenhuma empresa encontrada"
      description={reason}
      action={
        <Link to="/empresas" className={buttonVariants({ variant: "default" })}>
          Limpar filtros
        </Link>
      }
    />
  );
}

function CompaniesPage() {
  const navigate = useNavigate();
  const { filters, buildSearch, setSearch } = useCompanyFilters();
  const { companies, error, reload } = useCompanyList(filters);
  const [formCompany, setFormCompany] = useState<Company | null | undefined>(undefined);
  const [status, setStatus] = useState<{ action: CompanyStatusAction; company: Company } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSaved(saved: Company) {
    if (formCompany) {
      setNotice(`Dados de ${saved.name} salvos.`);
      reload();
      return;
    }
    navigate(`/empresa/${encodeURIComponent(saved.id)}`);
  }

  function handleStatusDone(action: CompanyStatusAction, company: Company) {
    setStatus(null);
    const verb = action === "archive" ? "arquivada" : action === "restore" ? "restaurada" : "excluída";
    setNotice(`${company.name} ${verb}.`);
    reload();
  }

  const rowProps = { onEdit: (company: Company) => setFormCompany(company), onAction: (action: CompanyStatusAction, company: Company) => setStatus({ action, company }) };

  return (
    <section aria-labelledby="companies-title" data-aioson-id="companies-page">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="companies-title">Empresas</h1>
          <p className="text-sm text-text-soft">{filters.isArchived ? "Empresas arquivadas" : "Empresas ativas"}</p>
        </div>
        <Button variant="metal" onClick={() => setFormCompany(null)} data-aioson-id="companies-new">
          Nova empresa
        </Button>
      </header>
      <CompaniesToolbar filters={filters} buildSearch={buildSearch} onSearch={setSearch} />
      <ActiveFilters filters={filters} />
      <p role="status" className="mb-2 min-h-[1.25em] text-sm text-ok">
        {notice}
      </p>
      {error ? (
        <StatusView state="error" description={error instanceof Error ? error.message : undefined} onRetry={reload} />
      ) : companies === null ? (
        <StatusView state="loading" title="Carregando empresas…" />
      ) : (
        <CompaniesBody companies={companies} filters={filters} onCreate={() => setFormCompany(null)} {...rowProps} />
      )}
      <CompanyFormDialog open={formCompany !== undefined} onOpenChange={(open) => !open && setFormCompany(undefined)} company={formCompany} onSaved={handleSaved} />
      <CompanyStatusDialog action={status?.action ?? null} company={status?.company ?? null} onClose={() => setStatus(null)} onDone={handleStatusDone} />
    </section>
  );
}

export { CompaniesPage };
