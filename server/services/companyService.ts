import type {
  CompanyAnnualRevenueRange,
  CompanySalesChannel,
  CompanySegment,
} from "../../shared/content/companyOptions.ts";
import type { StageNumber } from "../../shared/domain/types.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { createCompanyRepository, type CompanyRecord } from "../repositories/companyRepository.ts";
import type { CompanyInput, CompanyListFilters } from "../validation/companySchemas.ts";
import { DomainError } from "./domainError.ts";
import type { PortfolioService } from "./portfolioService.ts";

/** Shape of IF-002. Optional values are always present, as `null` when not informed. */
export interface CompanyView {
  id: string;
  name: string;
  segment: CompanySegment;
  salesChannel: CompanySalesChannel;
  annualRevenueRange: CompanyAnnualRevenueRange | null;
  /** 14 digits, no mask. */
  cnpj: string | null;
  archivedAt: string | null;
  /** Stage of the latest completed, non-archived diagnosis. */
  latestStage: StageNumber | null;
  latestCompletedAt: string | null;
  /** The open draft, if any (a company has at most one, RULE-dm-13). */
  draftId: string | null;
  /**
   * Every completed diagnosis the company owns, archived ones included: together with the
   * draft it is the exact amount a delete removes, which is what the confirmation shows.
   */
  completedCount: number;
}

export interface CompanyService {
  list(filters: CompanyListFilters): Promise<CompanyView[]>;
  get(id: string): Promise<CompanyView>;
  create(input: CompanyInput): Promise<CompanyView>;
  update(id: string, input: CompanyInput): Promise<CompanyView>;
  /** Hides the company from the portfolio; no data is deleted (RULE-dm-15). Idempotent. */
  archive(id: string): Promise<CompanyView>;
  /** Brings an archived company back with its whole history. Idempotent. */
  restore(id: string): Promise<CompanyView>;
  /** Permanently removes an archived company and its diagnoses (RULE-dm-15). */
  remove(id: string): Promise<void>;
}

export interface CompanyServiceDeps {
  prisma: PrismaClient;
  now: () => Date;
  /** Counts the attention indicators of the home; the `attention` filter of the list reads them (IF-010). */
  portfolio: PortfolioService;
}

function companyNotFound(): DomainError {
  return new DomainError(404, "company_not_found", "Empresa não encontrada.");
}

function companyNotArchived(): DomainError {
  return new DomainError(
    409,
    "company_not_archived",
    "Só é possível excluir uma empresa arquivada. Arquive a empresa primeiro.",
  );
}

function asStageNumber(value: number | null): StageNumber | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

function toCompanyView(record: CompanyRecord): CompanyView {
  const completed = record.diagnoses.filter((diagnosis) => diagnosis.status === "completed");
  const latest = completed
    .filter((diagnosis) => diagnosis.archivedAt === null && diagnosis.completedAt !== null)
    .sort(
      (a, b) =>
        (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0) || a.id.localeCompare(b.id),
    )[0];
  const draft = record.diagnoses.find((diagnosis) => diagnosis.status === "draft");

  return {
    id: record.id,
    name: record.name,
    segment: record.segment as CompanySegment,
    salesChannel: record.salesChannel as CompanySalesChannel,
    annualRevenueRange: record.annualRevenueRange as CompanyAnnualRevenueRange | null,
    cnpj: record.cnpj,
    archivedAt: record.archivedAt?.toISOString() ?? null,
    latestStage: asStageNumber(latest?.stage ?? null),
    latestCompletedAt: latest?.completedAt?.toISOString() ?? null,
    draftId: draft?.id ?? null,
    completedCount: completed.length,
  };
}

// Search ignores case and accents: typing "sao" finds "Padaria São João".
function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

function compareByName(a: CompanyView, b: CompanyView): number {
  return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) || a.id.localeCompare(b.id);
}

export function createCompanyService({ prisma, now, portfolio }: CompanyServiceDeps): CompanyService {
  const repository = createCompanyRepository(prisma);

  async function requireRecord(id: string): Promise<CompanyRecord> {
    const record = await repository.findById(id);
    if (record === null) {
      throw companyNotFound();
    }
    return record;
  }

  async function changeArchiveState(id: string, archived: boolean): Promise<CompanyView> {
    const record = await requireRecord(id);
    if ((record.archivedAt !== null) === archived) {
      return toCompanyView(record);
    }
    const changed = await repository.setArchivedAt(id, archived ? now() : null);
    if (changed === null) {
      throw companyNotFound();
    }
    return toCompanyView(changed);
  }

  return {
    async list({ q, stage, attention, archived }) {
      const needle = q === null ? null : normalizeForSearch(q);
      // Only active companies carry an attention indicator, so the archived list under a filter is empty.
      const flagged = attention === null ? null : await portfolio.needingAttention(attention);
      const records = await repository.listByArchived(archived);
      return records
        .map(toCompanyView)
        .filter((company) => needle === null || normalizeForSearch(company.name).includes(needle))
        .filter((company) => stage === null || company.latestStage === stage)
        .filter((company) => flagged === null || flagged.has(company.id))
        .sort(compareByName);
    },

    async get(id) {
      return toCompanyView(await requireRecord(id));
    },

    async create(input) {
      return toCompanyView(await repository.insert(input));
    },

    async update(id, input) {
      await requireRecord(id);
      const updated = await repository.updateFields(id, input);
      if (updated === null) {
        throw companyNotFound();
      }
      return toCompanyView(updated);
    },

    archive: (id) => changeArchiveState(id, true),

    restore: (id) => changeArchiveState(id, false),

    async remove(id) {
      const record = await requireRecord(id);
      if (record.archivedAt === null) {
        throw companyNotArchived();
      }
      const removed = await repository.deleteArchivedWithDiagnoses(id);
      if (removed === 0) {
        // Restored (or removed) by another request after the check above; nothing was deleted.
        throw companyNotArchived();
      }
    },
  };
}
