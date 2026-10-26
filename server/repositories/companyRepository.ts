import type { Prisma, PrismaClient } from "../generated/prisma/client.ts";
import type { CompanyInput } from "../validation/companySchemas.ts";

// Only the columns the company summary reads: the answers and the frozen result of a
// diagnosis can be large and are not needed to list companies.
const WITH_DIAGNOSIS_SUMMARY = {
  diagnoses: {
    select: { id: true, status: true, archivedAt: true, stage: true, completedAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  },
} satisfies Prisma.CompanyInclude;

export type CompanyRecord = Prisma.CompanyGetPayload<{ include: typeof WITH_DIAGNOSIS_SUMMARY }>;

export interface CompanyRepository {
  /** Active companies (`archived: false`) or archived ones, each with its diagnosis summary. */
  listByArchived(archived: boolean): Promise<CompanyRecord[]>;
  findById(id: string): Promise<CompanyRecord | null>;
  insert(input: CompanyInput): Promise<CompanyRecord>;
  /** Overwrites the editable fields; the archive state and the diagnoses are not touched. */
  updateFields(id: string, input: CompanyInput): Promise<CompanyRecord | null>;
  setArchivedAt(id: string, archivedAt: Date | null): Promise<CompanyRecord | null>;
  /**
   * Removes an archived company and every diagnosis it owns (completed, draft and archived)
   * in one transaction. Returns how many companies were removed: 0 when the id does not
   * exist or the company is not archived, in which case nothing was deleted.
   */
  deleteArchivedWithDiagnoses(id: string): Promise<number>;
}

// Prisma raises P2025 when an update targets a row that is gone (e.g. deleted in another request).
function isRecordNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2025";
}

export function createCompanyRepository(prisma: PrismaClient): CompanyRepository {
  async function updateOrNull(id: string, data: Prisma.CompanyUpdateInput): Promise<CompanyRecord | null> {
    try {
      return await prisma.company.update({ where: { id }, data, include: WITH_DIAGNOSIS_SUMMARY });
    } catch (error) {
      if (isRecordNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  return {
    listByArchived: (archived) =>
      prisma.company.findMany({
        where: { archivedAt: archived ? { not: null } : null },
        include: WITH_DIAGNOSIS_SUMMARY,
      }),

    findById: (id) => prisma.company.findUnique({ where: { id }, include: WITH_DIAGNOSIS_SUMMARY }),

    insert: (input) => prisma.company.create({ data: input, include: WITH_DIAGNOSIS_SUMMARY }),

    updateFields: (id, input) => updateOrNull(id, input),

    setArchivedAt: (id, archivedAt) => updateOrNull(id, { archivedAt }),

    async deleteArchivedWithDiagnoses(id) {
      // Both statements carry the archived condition, so a company restored between the
      // service check and this transaction is left untouched, diagnoses included.
      const [, removedCompanies] = await prisma.$transaction([
        prisma.diagnosis.deleteMany({ where: { company: { id, archivedAt: { not: null } } } }),
        prisma.company.deleteMany({ where: { id, archivedAt: { not: null } } }),
      ]);
      return removedCompanies.count;
    },
  };
}
