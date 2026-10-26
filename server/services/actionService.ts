import {
  defaultActionProgress,
  isActionOverdue,
  type ActionProgressFields,
} from "../../shared/domain/actionProgress.ts";
import type { ActionKey, DiagnosisResult } from "../../shared/domain/types.ts";
import { localIsoDate } from "../../shared/format/dates.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import {
  createActionProgressRepository,
  type ActionProgressRecord,
} from "../repositories/actionProgressRepository.ts";
import { createDiagnosisRepository, type DiagnosisRecord } from "../repositories/diagnosisRepository.ts";
import type { ActionPatch } from "../validation/actionSchemas.ts";
import { DomainError } from "./domainError.ts";

/** The diagnosis an inherited action continues from ("Continua do diagnóstico de {data}"). */
export interface InheritedFrom {
  diagnosisId: string;
  completedAt: string;
}

/** Shape of IF-005. Optional values are always present, as `null` when there is none. */
export interface ActionProgressView {
  diagnosisId: string;
  actionKey: ActionKey;
  status: ActionProgressFields["status"];
  /** `YYYY-MM-DD`. */
  dueDate: string | null;
  ownerRole: ActionProgressFields["ownerRole"];
  note: string | null;
  /** Only an action of the current plan can be overdue (RULE-ra-06). */
  overdue: boolean;
  inheritedFrom: InheritedFrom | null;
  /** Last change of the tracking; the day the plan was born while nothing was tracked yet. */
  updatedAt: string;
}

/** The plan of one completed diagnosis, in the order the diagnosis result lists it. */
export interface ActionPlanView {
  diagnosisId: string;
  completedAt: string;
  actions: ActionProgressView[];
}

export interface CompanyActionsView {
  /** The plan of the last completed, non-archived diagnosis; `null` while there is none (AC-ra-63). */
  current: ActionPlanView | null;
  /** The plans of the older completed, non-archived diagnoses, newest first: closed, with the state they ended in. */
  closed: ActionPlanView[];
}

export interface DiagnosisActionsView {
  /** False once a newer diagnosis replaced this plan, or while the diagnosis is archived. */
  isCurrent: boolean;
  actions: ActionProgressView[];
}

export interface ActionService {
  forCompany(companyId: string): Promise<CompanyActionsView>;
  forDiagnosis(diagnosisId: string): Promise<DiagnosisActionsView>;
  /** Changes only the fields sent, on one action of the current plan; the stored result is never touched (RULE-ra-01). */
  update(diagnosisId: string, actionKey: string, patch: ActionPatch): Promise<ActionProgressView>;
}

export interface ActionServiceDeps {
  prisma: PrismaClient;
  /** Clock behind "today" for overdue. */
  now: () => Date;
}

function diagnosisNotFound(): DomainError {
  return new DomainError(404, "diagnosis_not_found", "Diagnóstico não encontrado.");
}

function companyNotFound(): DomainError {
  return new DomainError(404, "company_not_found", "Empresa não encontrada.");
}

function diagnosisNotCompleted(): DomainError {
  return new DomainError(
    409,
    "diagnosis_not_completed",
    "Um rascunho ainda não tem ações. Elas nascem quando o diagnóstico é concluído.",
  );
}

function planClosed(): DomainError {
  return new DomainError(
    409,
    "plan_closed",
    "Este plano foi encerrado por um diagnóstico mais novo. As ações dele ficam só para consulta.",
  );
}

function actionNotFound(): DomainError {
  return new DomainError(404, "action_not_found", "Essa ação não faz parte do plano deste diagnóstico.");
}

// The result is frozen JSON written by `completeDraft`; a row that does not look like one has no plan.
function planOf(record: DiagnosisRecord): ActionKey[] {
  const plan = (record.result as Partial<DiagnosisResult> | null)?.plan;
  if (!Array.isArray(plan)) {
    return [];
  }
  return [...new Set(plan.filter((key): key is ActionKey => typeof key === "string"))];
}

function completedAtOf(record: DiagnosisRecord): Date {
  if (record.completedAt === null) {
    throw new Error(`Completed diagnosis ${record.id} has no completion date.`);
  }
  return record.completedAt;
}

export function createActionService({ prisma, now }: ActionServiceDeps): ActionService {
  const diagnoses = createDiagnosisRepository(prisma);
  const progress = createActionProgressRepository(prisma);

  // A version 1 diagnosis completed before this feature has no rows: its actions read as the default.
  function toView(
    record: DiagnosisRecord,
    actionKey: ActionKey,
    stored: ActionProgressRecord | undefined,
    isCurrent: boolean,
  ): ActionProgressView {
    const fields = stored ?? defaultActionProgress();
    const origin =
      stored?.inheritedFromId != null && stored.inheritedFromCompletedAt !== null
        ? { diagnosisId: stored.inheritedFromId, completedAt: stored.inheritedFromCompletedAt.toISOString() }
        : null;
    return {
      diagnosisId: record.id,
      actionKey,
      status: fields.status,
      dueDate: fields.dueDate,
      ownerRole: fields.ownerRole,
      note: fields.note,
      overdue: isCurrent && isActionOverdue(fields, localIsoDate(now())),
      inheritedFrom: origin,
      updatedAt: (stored?.updatedAt ?? completedAtOf(record)).toISOString(),
    };
  }

  function toActions(record: DiagnosisRecord, rows: ActionProgressRecord[], isCurrent: boolean): ActionProgressView[] {
    const byKey = new Map(rows.map((row) => [row.actionKey, row]));
    return planOf(record).map((actionKey) => toView(record, actionKey, byKey.get(actionKey), isCurrent));
  }

  async function requireCompleted(id: string): Promise<DiagnosisRecord> {
    const record = await diagnoses.findById(id);
    if (record === null) {
      throw diagnosisNotFound();
    }
    if (record.status !== "completed") {
      throw diagnosisNotCompleted();
    }
    return record;
  }

  // Current = the newest completed, non-archived diagnosis of the company, the same order the timeline uses.
  async function isCurrentPlan(record: DiagnosisRecord): Promise<boolean> {
    if (record.archivedAt !== null) {
      return false;
    }
    const [newest] = await diagnoses.listCompleted(record.companyId);
    return newest?.id === record.id;
  }

  return {
    async forCompany(companyId) {
      const records = await diagnoses.listCompletedRecords(companyId);
      if (records === null) {
        throw companyNotFound();
      }
      const rows = await progress.findByDiagnoses(records.map((record) => record.id));
      const toPlan = (record: DiagnosisRecord, isCurrent: boolean): ActionPlanView => ({
        diagnosisId: record.id,
        completedAt: completedAtOf(record).toISOString(),
        actions: toActions(
          record,
          rows.filter((row) => row.diagnosisId === record.id),
          isCurrent,
        ),
      });
      const [newest, ...older] = records;
      return {
        current: newest === undefined ? null : toPlan(newest, true),
        closed: older.map((record) => toPlan(record, false)),
      };
    },

    async forDiagnosis(diagnosisId) {
      const record = await requireCompleted(diagnosisId);
      const isCurrent = await isCurrentPlan(record);
      return { isCurrent, actions: toActions(record, await progress.findByDiagnosis(diagnosisId), isCurrent) };
    },

    async update(diagnosisId, actionKey, patch) {
      const record = await requireCompleted(diagnosisId);
      if (!(await isCurrentPlan(record))) {
        throw planClosed();
      }
      const key = planOf(record).find((planned) => planned === actionKey);
      if (key === undefined) {
        throw actionNotFound();
      }
      const hasChanges = Object.values(patch).some((value) => value !== undefined);
      if (!hasChanges) {
        const rows = await progress.findByDiagnosis(diagnosisId);
        return toView(record, key, rows.find((row) => row.actionKey === key), true);
      }
      return toView(record, key, await progress.save(diagnosisId, key, patch), true);
    },
  };
}
