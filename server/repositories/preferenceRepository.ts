import type { PrismaClient } from "../generated/prisma/client.ts";

export interface PreferenceEntry {
  key: string;
  value: string;
}

/** What one save changes: keys to write and keys to forget, applied together or not at all. */
export interface PreferenceChanges {
  upserts: PreferenceEntry[];
  removals: string[];
}

export interface PreferenceRepository {
  /**
   * The stored entries among `keys`, as `key -> value`. Each service names its own keys, so a
   * large value kept under another feature's keys (the report logo) is never loaded for it.
   */
  readKeys(keys: readonly string[]): Promise<Map<string, string>>;
  applyChanges(changes: PreferenceChanges): Promise<void>;
  /** True when the id belongs to a company that exists and is not archived. */
  activeCompanyExists(id: string): Promise<boolean>;
}

export function createPreferenceRepository(prisma: PrismaClient): PreferenceRepository {
  return {
    async readKeys(keys) {
      if (keys.length === 0) {
        return new Map();
      }
      const rows = await prisma.preference.findMany({ where: { key: { in: [...keys] } } });
      return new Map(rows.map((row) => [row.key, row.value]));
    },

    async applyChanges({ upserts, removals }) {
      if (upserts.length === 0 && removals.length === 0) {
        return;
      }
      await prisma.$transaction([
        ...upserts.map(({ key, value }) =>
          prisma.preference.upsert({ where: { key }, create: { key, value }, update: { value } }),
        ),
        ...(removals.length > 0 ? [prisma.preference.deleteMany({ where: { key: { in: removals } } })] : []),
      ]);
    },

    async activeCompanyExists(id) {
      const company = await prisma.company.findFirst({
        where: { id, archivedAt: null },
        select: { id: true },
      });
      return company !== null;
    },
  };
}
