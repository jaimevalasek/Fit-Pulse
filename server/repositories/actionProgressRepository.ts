import { defaultActionProgress, normalizeActionProgress } from "../../shared/domain/actionProgress.ts";
import type {
  ActionProgressEntry,
  ActionProgressFields,
  InheritedActionProgress,
} from "../../shared/domain/actionProgress.ts";
import type { ActionKey } from "../../shared/domain/types.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";

/** The progress of one action of one diagnosis' plan, as stored. */
export interface ActionProgressRecord extends ActionProgressEntry {
  diagnosisId: string;
  /** The earlier diagnosis this action continues from, when it repeated from the previous plan. */
  inheritedFromId: string | null;
  /** When that earlier diagnosis was completed ("Continua do diagnóstico de {data}"). */
  inheritedFromCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Only the fields to change; a field left out stays as it is, and `null` clears it. */
export type ActionProgressPatch = Partial<ActionProgressFields>;

/** The row written when a diagnosis is completed, ready for `createMany` in the completion transaction. */
export interface NewActionProgressRow extends ActionProgressFields {
  diagnosisId: string;
  actionKey: ActionKey;
  inheritedFromId: string | null;
}

export interface ActionProgressRepository {
  findByDiagnosis(diagnosisId: string): Promise<ActionProgressRecord[]>;
  findByDiagnoses(diagnosisIds: readonly string[]): Promise<ActionProgressRecord[]>;
  /** Every tracked action of the company's completed diagnoses, archived ones included. */
  findByCompany(companyId: string): Promise<ActionProgressRecord[]>;
  /**
   * Applies the patch to one action, creating its row first when it has none: a version 1
   * diagnosis completed before this feature gets its row on the first edit.
   */
  save(diagnosisId: string, actionKey: ActionKey, patch: ActionProgressPatch): Promise<ActionProgressRecord>;
}

const WITH_ORIGIN = { inheritedFrom: { select: { completedAt: true } } } as const;
const ORDER = [{ actionKey: "asc" }, { id: "asc" }] as const;

interface StoredActionProgress {
  diagnosisId: string;
  actionKey: string;
  status: string;
  dueDate: string | null;
  ownerRole: string | null;
  note: string | null;
  inheritedFromId: string | null;
  inheritedFrom: { completedAt: Date | null } | null;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(row: StoredActionProgress): ActionProgressRecord {
  return {
    diagnosisId: row.diagnosisId,
    // The app is the only writer of these text columns; an unknown value reads as the default.
    actionKey: row.actionKey as ActionKey,
    ...normalizeActionProgress(row),
    inheritedFromId: row.inheritedFromId,
    inheritedFromCompletedAt: row.inheritedFrom?.completedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function definedFields(patch: ActionProgressPatch): ActionProgressPatch {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "PrismaClientKnownRequestError" &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** The rows to create when a diagnosis is completed: one per action of its plan, with the inheritance applied. */
export function toNewActionProgressRows(
  diagnosisId: string,
  actions: readonly InheritedActionProgress[],
): NewActionProgressRow[] {
  return actions.map((action) => ({
    diagnosisId,
    actionKey: action.actionKey,
    status: action.status,
    dueDate: action.dueDate,
    ownerRole: action.ownerRole,
    note: action.note,
    inheritedFromId: action.inheritedFromId,
  }));
}

export function createActionProgressRepository(prisma: PrismaClient): ActionProgressRepository {
  async function findMany(where: { diagnosisId: string | { in: string[] } } | { diagnosis: { companyId: string } }) {
    const rows = await prisma.actionProgress.findMany({ where, include: WITH_ORIGIN, orderBy: [...ORDER] });
    return rows.map(toRecord);
  }

  function upsert(diagnosisId: string, actionKey: ActionKey, patch: ActionProgressPatch) {
    const changes = definedFields(patch);
    return prisma.actionProgress.upsert({
      where: { diagnosisId_actionKey: { diagnosisId, actionKey } },
      create: { diagnosisId, actionKey, ...defaultActionProgress(), ...changes },
      update: changes,
      include: WITH_ORIGIN,
    });
  }

  return {
    findByDiagnosis: (diagnosisId) => findMany({ diagnosisId }),

    findByDiagnoses: (diagnosisIds) => (diagnosisIds.length === 0 ? Promise.resolve([]) : findMany({ diagnosisId: { in: [...diagnosisIds] } })),

    findByCompany: (companyId) => findMany({ diagnosis: { companyId } }),

    async save(diagnosisId, actionKey, patch) {
      try {
        return toRecord(await upsert(diagnosisId, actionKey, patch));
      } catch (error) {
        // Two first edits of the same version 1 action raced to create the row: the loser updates it.
        if (!isUniqueViolation(error)) throw error;
        return toRecord(await upsert(diagnosisId, actionKey, patch));
      }
    },
  };
}
