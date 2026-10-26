import { normalizeActionProgress } from "../../shared/domain/actionProgress.ts";
import type { ActionProgressEntry, InheritedActionProgress } from "../../shared/domain/actionProgress.ts";
import type { ActionKey } from "../../shared/domain/types.ts";
import type { Diagnosis as DiagnosisRecord, Prisma, PrismaClient } from "../generated/prisma/client.ts";
import { toNewActionProgressRows } from "./actionProgressRepository.ts";

export type { DiagnosisRecord };

/** What `previous` needs from the other completed diagnoses of a company. */
export interface CompletedSummary {
  id: string;
  stage: number | null;
  completedAt: Date | null;
}

export interface NewDraftValues {
  answers: Prisma.InputJsonValue;
  calculator: Prisma.InputJsonValue;
}

export interface DraftStart {
  record: DiagnosisRecord;
  /** False when the company already had an open draft and it was returned as it is. */
  created: boolean;
}

/** What `importDraft` found or did. A draft in the way is reported, never touched, unless the caller asked to replace it. */
export type DraftImport =
  | { status: "company_not_found" }
  | { status: "draft_exists"; draftCreatedAt: Date }
  | { status: "imported"; record: DiagnosisRecord };

export interface DraftImportOptions {
  /** True once the owner confirmed that the company's open draft goes away. */
  replace: boolean;
  /** Runs in the same transaction, right after the new draft exists: whatever must change together with it. */
  afterCreate?: (tx: Prisma.TransactionClient, record: DiagnosisRecord) => Promise<void>;
}

export interface CompletionValues {
  rulesVersion: number;
  result: Prisma.InputJsonValue;
  stage: number;
  completedAt: Date;
}

/** The diagnosis a new completion is compared with (RULE-ra-05), read in the completion transaction. */
export interface PreviousPlanSource {
  record: DiagnosisRecord;
  /** What was tracked on it; empty for a diagnosis completed before the tracking existed. */
  progress: ActionProgressEntry[];
}

export interface CompletionContext {
  /** The last completed, non-archived diagnosis of the company; `null` for its first one. */
  latestCompleted: PreviousPlanSource | null;
}

/** What `build` hands back: the values to freeze and the tracking of the new plan, inheritance applied. */
export interface Completion {
  values: CompletionValues;
  actionProgress: readonly InheritedActionProgress[];
}

export interface DraftEdit {
  answers: Prisma.InputJsonValue;
  calculator: Prisma.InputJsonValue;
  currentBlock: number;
}

export interface DiagnosisRepository {
  findById(id: string): Promise<DiagnosisRecord | null>;
  /** Completed, non-archived diagnoses of the company, newest first. */
  listCompleted(companyId: string): Promise<CompletedSummary[]>;
  /** The same diagnoses with their stored result; `null` when the company does not exist. */
  listCompletedRecords(companyId: string): Promise<DiagnosisRecord[] | null>;
  /**
   * Returns the company's open draft or creates one in the same transaction, so two
   * simultaneous starts end with a single draft (RULE-dm-13). `prefill` runs only when
   * a draft has to be created and may read the company's last completed diagnosis.
   */
  startDraft(
    companyId: string,
    prefill: (read: { latestCompleted: DiagnosisRecord | null }) => NewDraftValues,
  ): Promise<DraftStart | null>;
  /**
   * Creates the company's draft from values that arrive ready (the client's questionnaire answers). When the
   * company already has a draft nothing changes and `draft_exists` comes back, unless `replace` is set: then
   * the old draft is removed and the new one created in the same transaction, so the company keeps a single
   * draft (RULE-dm-13) and a failure leaves the old one in place.
   */
  importDraft(companyId: string, values: NewDraftValues, options: DraftImportOptions): Promise<DraftImport>;
  /**
   * Reads the draft, lets `edit` build the new values from it and saves them, all in one
   * transaction so two autosaves never overwrite each other's keys. `null` when the
   * diagnosis does not exist or is no longer a draft.
   */
  editDraft(id: string, edit: (current: DiagnosisRecord) => DraftEdit): Promise<DiagnosisRecord | null>;
  /**
   * Draft → completed. The draft and the company's last completed diagnosis (with its tracking) are
   * read, `build` turns them into the values to freeze and the tracking rows of the new plan, and
   * everything is saved in one transaction, so an autosave can never slip in between the calculation
   * and the write and a second completion creates nothing. An error thrown by `build` cancels
   * everything. `null` when the diagnosis does not exist or is no longer a draft.
   */
  completeDraft(
    id: string,
    build: (draft: DiagnosisRecord, context: CompletionContext) => Completion,
  ): Promise<DiagnosisRecord | null>;
  /** Removes the diagnosis only if it is a draft. Returns how many rows were removed. */
  deleteDraft(id: string): Promise<number>;
}

const NEWEST_COMPLETED_FIRST = [{ completedAt: "desc" }, { id: "asc" }] as const;

export function createDiagnosisRepository(prisma: PrismaClient): DiagnosisRepository {
  return {
    findById: (id) => prisma.diagnosis.findUnique({ where: { id } }),

    listCompleted: (companyId) =>
      prisma.diagnosis.findMany({
        where: { companyId, status: "completed", archivedAt: null },
        select: { id: true, stage: true, completedAt: true },
        orderBy: [...NEWEST_COMPLETED_FIRST],
      }),

    async listCompletedRecords(companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          diagnoses: {
            where: { status: "completed", archivedAt: null, completedAt: { not: null } },
            orderBy: [...NEWEST_COMPLETED_FIRST],
          },
        },
      });
      return company?.diagnoses ?? null;
    },

    startDraft: (companyId, prefill) =>
      prisma.$transaction(async (tx) => {
        const company = await tx.company.findUnique({ where: { id: companyId }, select: { id: true } });
        if (company === null) {
          return null;
        }
        const existing = await tx.diagnosis.findFirst({
          where: { companyId, status: "draft" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        if (existing !== null) {
          return { record: existing, created: false };
        }
        const latestCompleted = await tx.diagnosis.findFirst({
          where: { companyId, status: "completed", archivedAt: null, completedAt: { not: null } },
          orderBy: [...NEWEST_COMPLETED_FIRST],
        });
        const record = await tx.diagnosis.create({
          data: { companyId, status: "draft", currentBlock: 1, ...prefill({ latestCompleted }) },
        });
        return { record, created: true };
      }),

    importDraft: (companyId, values, { replace, afterCreate }) =>
      prisma.$transaction(async (tx): Promise<DraftImport> => {
        const company = await tx.company.findUnique({ where: { id: companyId }, select: { id: true } });
        if (company === null) {
          return { status: "company_not_found" };
        }
        const existing = await tx.diagnosis.findFirst({
          where: { companyId, status: "draft" },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        if (existing !== null) {
          if (!replace) {
            return { status: "draft_exists", draftCreatedAt: existing.createdAt };
          }
          await tx.diagnosis.deleteMany({ where: { companyId, status: "draft" } });
        }
        const record = await tx.diagnosis.create({ data: { companyId, status: "draft", currentBlock: 1, ...values } });
        await afterCreate?.(tx, record);
        return { status: "imported", record };
      }),

    editDraft: (id, edit) =>
      prisma.$transaction(async (tx) => {
        const current = await tx.diagnosis.findFirst({ where: { id, status: "draft" } });
        if (current === null) {
          return null;
        }
        return tx.diagnosis.update({ where: { id }, data: edit(current) });
      }),

    completeDraft: (id, build) =>
      prisma.$transaction(async (tx) => {
        const draft = await tx.diagnosis.findFirst({ where: { id, status: "draft" } });
        if (draft === null) {
          return null;
        }
        const latest = await tx.diagnosis.findFirst({
          where: { companyId: draft.companyId, status: "completed", archivedAt: null, completedAt: { not: null } },
          orderBy: [...NEWEST_COMPLETED_FIRST],
        });
        const tracked = latest === null ? [] : await tx.actionProgress.findMany({ where: { diagnosisId: latest.id } });
        const { values, actionProgress } = build(draft, {
          latestCompleted:
            latest === null
              ? null
              : {
                  record: latest,
                  // The app is the only writer of these text columns; an unknown value reads as the default.
                  progress: tracked.map((row) => ({
                    actionKey: row.actionKey as ActionKey,
                    ...normalizeActionProgress(row),
                  })),
                },
        });
        const completed = await tx.diagnosis.update({ where: { id }, data: { status: "completed", ...values } });
        if (actionProgress.length > 0) {
          await tx.actionProgress.createMany({ data: toNewActionProgressRows(id, actionProgress) });
        }
        return completed;
      }),

    async deleteDraft(id) {
      const removed = await prisma.diagnosis.deleteMany({ where: { id, status: "draft" } });
      return removed.count;
    },
  };
}
