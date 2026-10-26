import type { DiaryEntry, DiarySpendParts } from "../../shared/domain/diary.ts";
import { SPEND_PART_KEYS } from "../../shared/domain/types.ts";
import { isCents } from "../../shared/domain/unitEconomics.ts";
import { Prisma, type PrismaClient } from "../generated/prisma/client.ts";

/** What one noted month carries besides its month: the spend is the parts or the single total, never both. */
export interface DiaryEntryValues {
  newCustomers: number;
  spendParts: DiarySpendParts | null;
  spendTotalCents: number | null;
}

export interface DiaryRepository {
  companyExists(companyId: string): Promise<boolean>;
  /** Every month noted by the company, the most recent first. */
  findByCompany(companyId: string): Promise<DiaryEntry[]>;
  /** The `count` most recent months noted by the company, the newest first (RULE-ra-09). */
  findMostRecent(companyId: string, count: number): Promise<DiaryEntry[]>;
  /** Notes the month; `null` when the company already has it (the unique pair decides, so two parallel calls never both win). */
  create(companyId: string, month: string, values: DiaryEntryValues): Promise<DiaryEntry | null>;
  /** Overwrites the values of a month already noted; the month itself never changes. `null` when there is no such month. */
  update(companyId: string, month: string, values: DiaryEntryValues): Promise<DiaryEntry | null>;
  /** Whether a month was removed. */
  remove(companyId: string, month: string): Promise<boolean>;
}

interface StoredDiaryEntry {
  month: string;
  newCustomers: number;
  spendParts: Prisma.JsonValue | null;
  spendTotalCents: bigint | null;
}

const NEWEST_FIRST = { month: "desc" } as const;

// The app is the only writer of the JSON column; a value that does not look like the parts reads as "no parts".
function readSpendParts(stored: Prisma.JsonValue | null): DiarySpendParts | null {
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) {
    return null;
  }
  const parts: DiarySpendParts = {};
  for (const key of SPEND_PART_KEYS) {
    const value = stored[key];
    if (isCents(value)) {
      parts[key] = value;
    }
  }
  return Object.keys(parts).length > 0 ? parts : null;
}

function toEntry(row: StoredDiaryEntry): DiaryEntry {
  return {
    month: row.month,
    newCustomers: row.newCustomers,
    spendParts: readSpendParts(row.spendParts),
    spendTotalCents: row.spendTotalCents === null ? null : Number(row.spendTotalCents),
  };
}

function toData(values: DiaryEntryValues) {
  return {
    newCustomers: values.newCustomers,
    spendParts: values.spendParts ?? Prisma.DbNull,
    spendTotalCents: values.spendTotalCents === null ? null : BigInt(values.spendTotalCents),
  };
}

function isPrismaError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    error.name === "PrismaClientKnownRequestError" &&
    (error as { code?: unknown }).code === code
  );
}

export function createDiaryRepository(prisma: PrismaClient): DiaryRepository {
  return {
    async companyExists(companyId) {
      return (await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } })) !== null;
    },

    async findByCompany(companyId) {
      const rows = await prisma.diaryEntry.findMany({ where: { companyId }, orderBy: NEWEST_FIRST });
      return rows.map(toEntry);
    },

    async findMostRecent(companyId, count) {
      const rows = await prisma.diaryEntry.findMany({ where: { companyId }, orderBy: NEWEST_FIRST, take: Math.max(0, count) });
      return rows.map(toEntry);
    },

    async create(companyId, month, values) {
      try {
        return toEntry(await prisma.diaryEntry.create({ data: { companyId, month, ...toData(values) } }));
      } catch (error) {
        if (isPrismaError(error, "P2002")) {
          return null;
        }
        throw error;
      }
    },

    async update(companyId, month, values) {
      try {
        return toEntry(await prisma.diaryEntry.update({ where: { companyId_month: { companyId, month } }, data: toData(values) }));
      } catch (error) {
        // The month was removed between the request and the write.
        if (isPrismaError(error, "P2025")) {
          return null;
        }
        throw error;
      }
    },

    async remove(companyId, month) {
      const { count } = await prisma.diaryEntry.deleteMany({ where: { companyId, month } });
      return count > 0;
    },
  };
}
