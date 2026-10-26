import { BLOCK_COUNT } from "../../shared/content/questionBank.ts";
import {
  compareDiagnoses,
  compareWithResults,
  type ComparableDiagnosis,
  type DiagnosisComparison,
} from "../../shared/domain/compareDiagnoses.ts";
import { pendingBlocks } from "../../shared/domain/completeness.ts";
import { EMPTY_CALCULATOR } from "../../shared/domain/types.ts";
import type {
  BlockNumber,
  CalculatorInput,
  ConfidenceLevel,
  DiagnosisResult,
  Rules,
  StageNumber,
} from "../../shared/domain/types.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { createDiagnosisRepository, type DiagnosisRecord } from "../repositories/diagnosisRepository.ts";
import { createQuestionnaireRepository } from "../repositories/questionnaireRepository.ts";
import { readStoredAnswers, readStoredCalculator } from "../validation/diagnosisSchemas.ts";
import { DomainError } from "./domainError.ts";

/** The company's open draft with how far the owner got. */
export interface TimelineDraft {
  id: string;
  /** The block the questionnaire reopens on. */
  currentBlock: BlockNumber;
  /** Blocks with every item answered, out of `totalBlocks`. */
  completedBlocks: number;
  totalBlocks: number;
  createdAt: string;
  updatedAt: string;
  /**
   * When the client saved the answers this draft was born from ("Respostas do cliente, salvas em {data}",
   * IF-011). Left out for a draft the owner started, so only an imported one carries the mark.
   */
  clientAnswersSavedAt?: string;
}

/** A completed diagnosis in the timeline, archived or not. */
export interface TimelineEntry {
  id: string;
  companyId: string;
  completedAt: string;
  /** `null` while the diagnosis counts; the date it was put away otherwise. */
  archivedAt: string | null;
  stage: StageNumber;
  /** Version of the rules the stored result was calculated with (RULE-dm-11). */
  rulesVersion: number;
  confidence: ConfidenceLevel;
  /** False for the first diagnosis: there is no earlier one to compare with (BR-dm-08). */
  canCompare: boolean;
}

/** Shape of IF-005 for `GET /api/companies/:id/timeline`. `draft` is `null` when there is none. */
export interface TimelineView {
  draft: TimelineDraft | null;
  /** Not archived, newest first. */
  completed: TimelineEntry[];
  /** Archived, newest first. */
  archived: TimelineEntry[];
}

/** One side of a pair the evolution report compares. */
export interface PairSide {
  id: string;
  completedAt: Date;
  /** The result stored when the diagnosis was concluded. */
  storedResult: DiagnosisResult;
  /** The result the comparison counted: the stored one, or the one calculated again when the rules versions differ (RULE-dm-11). */
  comparedResult: DiagnosisResult;
}

/** Two chosen diagnoses of one company, compared the way the "Comparar" screen compares them (RULE-ra-02). */
export interface ComparedPair {
  companyId: string;
  comparison: DiagnosisComparison;
  previous: PairSide;
  current: PairSide;
}

export interface HistoryService {
  timeline(companyId: string): Promise<TimelineView>;
  /** Puts a completed diagnosis away without deleting it (RULE-dm-15). Idempotent. */
  archive(id: string): Promise<TimelineEntry>;
  /** Brings an archived diagnosis back as it was. Idempotent. */
  restore(id: string): Promise<TimelineEntry>;
  /** The diagnosis against the completed, non-archived one right before it (BR-dm-07, RULE-dm-11). */
  compare(id: string): Promise<DiagnosisComparison>;
  /**
   * The two diagnoses the owner picked ("De" and "Até"), compared with the same `compareDiagnoses`.
   * Both must be completed, not archived, from the same company, and `fromId` must be the earlier one.
   */
  comparePair(fromId: string, toId: string): Promise<ComparedPair>;
}

export interface HistoryServiceDeps {
  prisma: PrismaClient;
  now: () => Date;
  /** The rules in force now: a previous diagnosis from other rules is calculated again with them. */
  rules: Rules;
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
    "Só um diagnóstico concluído pode ser arquivado, restaurado ou comparado.",
  );
}

function noPreviousDiagnosis(): DomainError {
  return new DomainError(
    409,
    "no_previous_diagnosis",
    "Ainda não há o que comparar: a comparação aparece a partir do segundo diagnóstico concluído.",
  );
}

function differentCompanies(): DomainError {
  return new DomainError(409, "different_companies", "Os dois diagnósticos precisam ser da mesma empresa.");
}

function diagnosisArchived(): DomainError {
  return new DomainError(
    409,
    "diagnosis_archived",
    "Um diagnóstico arquivado não entra na evolução. Restaure-o ou escolha outro.",
  );
}

function pairOutOfOrder(): DomainError {
  return new DomainError(
    409,
    "comparison_out_of_order",
    "O diagnóstico de partida precisa ser anterior ao de chegada.",
  );
}

// ---------------------------------------------------------------- data access
// Queries the diagnosis repository does not have. They stay together here, apart from the rules
// below, so they can move to a repository file as they are.

interface HistoryData {
  /** Every diagnosis of the company (drafts too), newest first; `null` when the company does not exist. */
  listByCompany(companyId: string): Promise<DiagnosisRecord[] | null>;
  /** Archives or restores a completed diagnosis only if it is in the opposite state; returns how many rows changed. */
  setArchivedAt(id: string, archivedAt: Date | null): Promise<number>;
}

function createHistoryData(prisma: PrismaClient): HistoryData {
  return {
    async listByCompany(companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { diagnoses: { orderBy: [{ completedAt: "desc" }, { id: "asc" }] } },
      });
      return company?.diagnoses ?? null;
    },

    async setArchivedAt(id, archivedAt) {
      const changed = await prisma.diagnosis.updateMany({
        where: { id, status: "completed", archivedAt: archivedAt === null ? { not: null } : null },
        data: { archivedAt },
      });
      return changed.count;
    },
  };
}

// ---------------------------------------------------------------- rules of the history

interface Dated {
  id: string;
  completedAt: Date | null;
}

/**
 * The diagnosis right before `record` among `active` (completed, non-archived, newest first):
 * the first one that is older. The order is the one the diagnosis repository lists in and the
 * one `DiagnosisView.previous` uses (same instant: the larger id counts as older), so "Comparar"
 * and the result page always point at the same diagnosis.
 */
function findPrevious<Candidate extends Dated>(record: Dated, active: Candidate[]): Candidate | null {
  for (const candidate of active) {
    if (candidate.id !== record.id && candidate.completedAt !== null && isOlder(candidate.completedAt, candidate.id, record)) {
      return candidate;
    }
  }
  return null;
}

/** Whether a diagnosis concluded at `completedAt` is older than `record`; at the same instant the larger id counts as older. */
function isOlder(completedAt: Date, id: string, record: Dated): boolean {
  const reference = record.completedAt;
  return (
    reference === null ||
    completedAt.getTime() < reference.getTime() ||
    (completedAt.getTime() === reference.getTime() && id > record.id)
  );
}

// A completed diagnosis is always written together with its result (see `completeDraft`).
function resultOf(record: DiagnosisRecord): DiagnosisResult {
  if (record.result === null || record.completedAt === null) {
    throw new Error(`Completed diagnosis ${record.id} has no stored result.`);
  }
  return record.result as unknown as DiagnosisResult;
}

function toCalculator(stored: unknown): CalculatorInput {
  return { ...EMPTY_CALCULATOR, ...readStoredCalculator(stored) } as CalculatorInput;
}

function toComparable(record: DiagnosisRecord): ComparableDiagnosis {
  return {
    id: record.id,
    completedAt: (record.completedAt as Date).toISOString(),
    answers: readStoredAnswers(record.answers),
    calculator: toCalculator(record.calculator),
    result: resultOf(record),
  };
}

function toPairSide(record: DiagnosisRecord, comparedResult: DiagnosisResult): PairSide {
  return {
    id: record.id,
    completedAt: record.completedAt as Date,
    storedResult: resultOf(record),
    comparedResult,
  };
}

function toDraft(record: DiagnosisRecord, clientSavedAt: Date | null): TimelineDraft {
  const pending = pendingBlocks(readStoredAnswers(record.answers), toCalculator(record.calculator));
  return {
    id: record.id,
    currentBlock: record.currentBlock as BlockNumber,
    completedBlocks: BLOCK_COUNT - pending.length,
    totalBlocks: BLOCK_COUNT,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ...(clientSavedAt === null ? {} : { clientAnswersSavedAt: clientSavedAt.toISOString() }),
  };
}

function toEntry(record: DiagnosisRecord, active: Dated[]): TimelineEntry {
  const result = resultOf(record);
  return {
    id: record.id,
    companyId: record.companyId,
    completedAt: (record.completedAt as Date).toISOString(),
    archivedAt: record.archivedAt?.toISOString() ?? null,
    stage: result.stage,
    rulesVersion: result.rulesVersion,
    confidence: result.confidence.level,
    canCompare: findPrevious(record, active) !== null,
  };
}

export function createHistoryService({ prisma, now, rules }: HistoryServiceDeps): HistoryService {
  const diagnoses = createDiagnosisRepository(prisma);
  const questionnaires = createQuestionnaireRepository(prisma);
  const data = createHistoryData(prisma);

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

  async function present(record: DiagnosisRecord): Promise<TimelineEntry> {
    return toEntry(record, await diagnoses.listCompleted(record.companyId));
  }

  async function changeArchiveState(id: string, archived: boolean): Promise<TimelineEntry> {
    const record = await requireCompleted(id);
    if ((record.archivedAt !== null) !== archived) {
      await data.setArchivedAt(id, archived ? now() : null);
      // Whoever got in first decided; the answer is what is stored now.
      return present(await requireCompleted(id));
    }
    return present(record);
  }

  return {
    async timeline(companyId) {
      const records = await data.listByCompany(companyId);
      if (records === null) {
        throw companyNotFound();
      }
      const draft = records.find((record) => record.status === "draft");
      const completed = records.filter((record) => record.status === "completed");
      const active = completed.filter((record) => record.archivedAt === null);
      const clientSavedAt = draft === undefined ? null : await questionnaires.findClientSavedAtByDraft(draft.id);
      return {
        draft: draft === undefined ? null : toDraft(draft, clientSavedAt),
        completed: active.map((record) => toEntry(record, active)),
        archived: completed.filter((record) => record.archivedAt !== null).map((record) => toEntry(record, active)),
      };
    },

    archive: (id) => changeArchiveState(id, true),

    restore: (id) => changeArchiveState(id, false),

    async compare(id) {
      const record = await requireCompleted(id);
      const previousSummary = findPrevious(record, await diagnoses.listCompleted(record.companyId));
      const previous = previousSummary === null ? null : await diagnoses.findById(previousSummary.id);
      if (previous === null) {
        throw noPreviousDiagnosis();
      }
      return compareDiagnoses(toComparable(previous), toComparable(record), rules);
    },

    async comparePair(fromId, toId) {
      const from = await requireCompleted(fromId);
      const to = await requireCompleted(toId);
      if (from.companyId !== to.companyId) {
        throw differentCompanies();
      }
      if (from.archivedAt !== null || to.archivedAt !== null) {
        throw diagnosisArchived();
      }
      if (!isOlder(from.completedAt as Date, from.id, to)) {
        throw pairOutOfOrder();
      }
      const { comparison, previousResult } = compareWithResults(toComparable(from), toComparable(to), rules);
      return {
        companyId: to.companyId,
        comparison,
        previous: toPairSide(from, previousResult),
        current: toPairSide(to, resultOf(to)),
      };
    },
  };
}
