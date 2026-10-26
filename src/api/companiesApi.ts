// Calls of the company routes (IF-002). Same body for create and edit; empty optional fields go
// as null so an edit can clear them.
import type {
  CompanyAnnualRevenueRange,
  CompanySalesChannel,
  CompanySegment,
} from "../../shared/content/companyOptions";
import type { StageNumber } from "../../shared/domain/types";
import { httpClient } from "./httpClient";

interface Company {
  id: string;
  name: string;
  segment: CompanySegment;
  salesChannel: CompanySalesChannel;
  annualRevenueRange?: CompanyAnnualRevenueRange | null;
  // 14 digits, no mask
  cnpj?: string | null;
  archivedAt?: string | null;
  latestStage?: StageNumber | null;
  latestCompletedAt?: string | null;
  draftId?: string | null;
  completedCount: number;
}

interface CompanyInput {
  name: string;
  segment: CompanySegment;
  salesChannel: CompanySalesChannel;
  annualRevenueRange: CompanyAnnualRevenueRange | null;
  cnpj: string | null;
}

// What "O que precisa de você" on the consultant home flags; the list keeps only the companies the
// indicator counted. The route answers 400 validation_failed for any other value.
type CompanyAttention = "atrasada" | "vencidas" | "risco" | "rascunhos" | "sem-diagnostico";

interface CompanyListFilters {
  q?: string;
  stage?: StageNumber | null;
  attention?: CompanyAttention | null;
  archived?: boolean;
}

// The list route may answer with the array or wrap it as { companies }
type CompanyListResponse = Company[] | { companies: Company[] };

function companyPath(id: string): string {
  return `/api/companies/${encodeURIComponent(id)}`;
}

async function listCompanies(filters: CompanyListFilters = {}, signal?: AbortSignal): Promise<Company[]> {
  const response = await httpClient.get<CompanyListResponse>("/api/companies", {
    query: {
      q: filters.q?.trim(),
      stage: filters.stage,
      attention: filters.attention,
      archived: filters.archived ? "true" : undefined,
    },
    signal,
  });
  return Array.isArray(response) ? response : (response?.companies ?? []);
}

function getCompany(id: string, signal?: AbortSignal): Promise<Company> {
  return httpClient.get<Company>(companyPath(id), { signal });
}

function createCompany(input: CompanyInput): Promise<Company> {
  return httpClient.post<Company>("/api/companies", input);
}

function updateCompany(id: string, input: CompanyInput): Promise<Company> {
  return httpClient.patch<Company>(companyPath(id), input);
}

function archiveCompany(id: string): Promise<Company> {
  return httpClient.post<Company>(`${companyPath(id)}/archive`);
}

function restoreCompany(id: string): Promise<Company> {
  return httpClient.post<Company>(`${companyPath(id)}/restore`);
}

// 409 company_not_archived when the company is still active
function deleteCompany(id: string): Promise<void> {
  return httpClient.delete(companyPath(id));
}

// Everything the delete removes: the completed diagnoses and the open draft
function countCompanyDiagnoses(company: Company): number {
  return company.completedCount + (company.draftId ? 1 : 0);
}

export {
  archiveCompany,
  countCompanyDiagnoses,
  createCompany,
  deleteCompany,
  getCompany,
  listCompanies,
  restoreCompany,
  updateCompany,
};
export type { Company, CompanyAttention, CompanyInput, CompanyListFilters };
