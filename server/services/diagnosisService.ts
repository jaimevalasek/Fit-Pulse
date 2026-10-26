import { EMPTY_CALCULATOR } from "../../shared/domain/types.ts";
import type {
  Answers,
  BlockNumber,
  CalculatorInput,
  DiagnosisResult,
  Rules,
  StageNumber,
} from "../../shared/domain/types.ts";
import { inheritActionProgress, type PreviousPlanProgress } from "../../shared/domain/actionProgress.ts";
import { pendingBlocks } from "../../shared/domain/completeness.ts";
import { DIARY_MEASURED_MONTHS, type DiaryEntry } from "../../shared/domain/diary.ts";
import {
  applyDiarySuggestion as applySuggestionToCalculator,
  applyDiaryToCalculator,
  carryDiaryMarks,
} from "../../shared/domain/diaryPrefill.ts";
import { evaluateDiagnosis } from "../../shared/domain/evaluateDiagnosis.ts";
import type { Prisma, PrismaClient } from "../generated/prisma/client.ts";
import {
  createDiagnosisRepository,
  type CompletedSummary,
  type DiagnosisRecord,
  type PreviousPlanSource,
} from "../repositories/diagnosisRepository.ts";
import { createDiaryRepository } from "../repositories/diaryRepository.ts";
import {
  readStoredAnswers,
  readStoredCalculator,
  type CalculatorPatch,
  type DiagnosisPatch,
  type StoredCalculator,
} from "../validation/diagnosisSchemas.ts";
import { DomainError } from "./domainError.ts";

/** The last completed, non-archived diagnosis of the same company (older than this one, once completed). */
export interface PreviousDiagnosis {
  stage: StageNumber;
  completedAt: string;
}

/** Shape of IF-003. Optional values are always present, as `null` when there is none. */
export interface DiagnosisView {
  id: string;
  companyId: string;
  status: "draft" | "completed";
  answers: Answers;
  /** Money in integer cents (RULE-dm-12). */
  calculator: CalculatorInput;
  currentBlock: BlockNumber;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  rulesVersion: number | null;
  /** Frozen at completion (RULE-dm-11); `null` while it is a draft. */
  result: DiagnosisResult | null;
  previous: PreviousDiagnosis | null;
}

export interface DiagnosisService {
  /** The company's open draft, or a new one filled from its last completed diagnosis (RULE-dm-13). */
  start(companyId: string): Promise<{ diagnosis: DiagnosisView; created: boolean }>;
  get(id: string): Promise<DiagnosisView>;
  /** Partial save of a draft; refused once the diagnosis is completed. */
  update(id: string, patch: DiagnosisPatch): Promise<DiagnosisView>;
  /** Removes only this draft; completed diagnoses are never touched. */
  discard(id: string): Promise<void>;
  /** Calculates with the current rules and freezes the result. A second call returns what was stored. */
  complete(id: string): Promise<DiagnosisView>;
  /**
   * "Usar o diário": the 1 or 2 months the draft was created with become its numbers, marked as
   * estimated (AC-ra-45). Refused when the draft has no suggestion or is already completed.
   */
  applyDiarySuggestion(id: string): Promise<DiagnosisView>;
}

export interface DiagnosisServiceDeps {
  prisma: PrismaClient;
  now: () => Date;
  /** The rules a new completion is calculated with; the version is stored with the result. */
  rules: Rules;
}

function diagnosisNotFound(): DomainError {
  return new DomainError(404, "diagnosis_not_found", "Diagnóstico não encontrado.");
}

function companyNotFound(): DomainError {
  return new DomainError(404, "company_not_found", "Empresa não encontrada.");
}

function diagnosisNotDraft(): DomainError {
  return new DomainError(
    409,
    "diagnosis_not_draft",
    "Este diagnóstico já foi concluído e não pode mais ser alterado nem descartado.",
  );
}

function noDiarySuggestion(): DomainError {
  return new DomainError(
    409,
    "no_diary_suggestion",
    "Este diagnóstico não tem números do diário para usar. Anote 1 ou 2 meses no diário antes de começar um novo diagnóstico.",
  );
}

function incomplete(blocks: BlockNumber[]): DomainError {
  return new DomainError(
    422,
    "incomplete",
    "Ainda faltam respostas. Responda os blocos pendentes para ver o resultado.",
    { pendingBlocks: blocks },
  );
}

// A patch never carries `undefined` after validation, but the type allows it; those keys keep the stored value.
function mergeCalculator(stored: StoredCalculator, patch: CalculatorPatch = {}): StoredCalculator {
  const merged: Record<string, unknown> = { ...stored };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as StoredCalculator;
}

function toCalculator(stored: unknown): CalculatorInput {
  return { ...EMPTY_CALCULATOR, ...readStoredCalculator(stored) } as CalculatorInput;
}

// The calculator is plain data, so the JSON column keeps it exactly.
function toStoredJson(calculator: CalculatorInput): Prisma.InputJsonObject {
  return calculator as unknown as Prisma.InputJsonObject;
}

/**
 * The calculator to store after an edit, with the diary state decided here and never by the client:
 * a number edited by hand loses its "do diário" mark, the others keep it and the suggestion stays as
 * it was (AC-ra-46). The row stays as sparse as the PATCH left it.
 */
function withDiaryState(stored: StoredCalculator, merged: StoredCalculator): Prisma.InputJsonObject {
  const { diarySource, diarySuggestion } = carryDiaryMarks(toCalculator(stored), toCalculator(merged));
  const { diarySource: _source, diarySuggestion: _suggestion, ...rest } = merged;
  return {
    ...rest,
    ...(diarySource ? { diarySource } : {}),
    ...(diarySuggestion !== undefined ? { diarySuggestion } : {}),
  } as Prisma.InputJsonObject;
}

/**
 * The calculator a new draft starts with: the last completed diagnosis' numbers as in the first
 * version (AC-ra-47), then the diary over block 1 (RULE-ra-09). What the previous diagnosis stored about
 * its own diary use is dropped: the new draft only carries a mark for numbers that come from the diary now.
 */
function startingCalculator(latestCompleted: DiagnosisRecord | null, diary: readonly DiaryEntry[]): Prisma.InputJsonObject {
  const { diarySource: _source, diarySuggestion: _suggestion, ...inherited } =
    latestCompleted === null ? ({} as StoredCalculator) : readStoredCalculator(latestCompleted.calculator);
  const base = toCalculator(inherited);
  const prefilled = applyDiaryToCalculator(base, diary);
  // With no month in the diary the draft is exactly the one of the first version.
  return prefilled === base ? (inherited as Prisma.InputJsonObject) : toStoredJson(prefilled);
}

function asStageNumber(value: number | null): StageNumber | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

// `completed` is newest first (see the repository), so the first entry older than the
// record is the diagnosis right before it. A draft has no date: its previous is the newest.
function findPrevious(record: DiagnosisRecord, completed: CompletedSummary[]): PreviousDiagnosis | null {
  const reference = record.completedAt;
  for (const candidate of completed) {
    if (candidate.id === record.id || candidate.completedAt === null) {
      continue;
    }
    const isOlder =
      reference === null ||
      candidate.completedAt.getTime() < reference.getTime() ||
      (candidate.completedAt.getTime() === reference.getTime() && candidate.id > record.id);
    const stage = asStageNumber(candidate.stage);
    if (isOlder && stage !== null) {
      return { stage, completedAt: candidate.completedAt.toISOString() };
    }
  }
  return null;
}

// The plan frozen in the previous diagnosis' result; a row that does not look like one counts as having no plan.
function toPreviousPlan(source: PreviousPlanSource | null): PreviousPlanProgress | null {
  if (source === null) {
    return null;
  }
  const plan = (source.record.result as Partial<DiagnosisResult> | null)?.plan;
  return {
    diagnosisId: source.record.id,
    plan: Array.isArray(plan) ? plan : [],
    progress: source.progress,
  };
}

function toDiagnosisView(record: DiagnosisRecord, completed: CompletedSummary[]): DiagnosisView {
  return {
    id: record.id,
    companyId: record.companyId,
    status: record.status,
    answers: readStoredAnswers(record.answers),
    calculator: toCalculator(record.calculator),
    currentBlock: record.currentBlock as BlockNumber,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    rulesVersion: record.rulesVersion,
    result: record.result as DiagnosisResult | null,
    previous: findPrevious(record, completed),
  };
}

export function createDiagnosisService({ prisma, now, rules }: DiagnosisServiceDeps): DiagnosisService {
  const repository = createDiagnosisRepository(prisma);
  const diaries = createDiaryRepository(prisma);

  async function present(record: DiagnosisRecord): Promise<DiagnosisView> {
    return toDiagnosisView(record, await repository.listCompleted(record.companyId));
  }

  // The draft changed or vanished between the caller's intent and the write: tell which.
  async function explainMissingDraft(id: string): Promise<DomainError> {
    return (await repository.findById(id)) === null ? diagnosisNotFound() : diagnosisNotDraft();
  }

  return {
    async start(companyId) {
      // The diary is read once, here: the draft keeps these numbers even if the diary changes later (AC-ra-46).
      // Only the draft's block 1 changes; the answers still come from the last completed diagnosis (AC-ra-47).
      const diary = await diaries.findMostRecent(companyId, DIARY_MEASURED_MONTHS);
      const started = await repository.startDraft(companyId, ({ latestCompleted }) => ({
        answers: latestCompleted === null ? {} : readStoredAnswers(latestCompleted.answers),
        calculator: startingCalculator(latestCompleted, diary),
      }));
      if (started === null) {
        throw companyNotFound();
      }
      return { diagnosis: await present(started.record), created: started.created };
    },

    async get(id) {
      const record = await repository.findById(id);
      if (record === null) {
        throw diagnosisNotFound();
      }
      return present(record);
    },

    async update(id, patch) {
      const updated = await repository.editDraft(id, (current) => {
        const stored = readStoredCalculator(current.calculator);
        return {
          answers: { ...readStoredAnswers(current.answers), ...patch.answers } satisfies Prisma.InputJsonObject,
          calculator: withDiaryState(stored, mergeCalculator(stored, patch.calculator)),
          currentBlock: patch.currentBlock ?? current.currentBlock,
        };
      });
      if (updated === null) {
        throw await explainMissingDraft(id);
      }
      return present(updated);
    },

    async applyDiarySuggestion(id) {
      const updated = await repository.editDraft(id, (current) => {
        const calculator = toCalculator(current.calculator);
        if (!calculator.diarySuggestion) {
          throw noDiarySuggestion();
        }
        return {
          answers: readStoredAnswers(current.answers) satisfies Prisma.InputJsonObject,
          calculator: toStoredJson(applySuggestionToCalculator(calculator, calculator.diarySuggestion)),
          currentBlock: current.currentBlock,
        };
      });
      if (updated === null) {
        throw await explainMissingDraft(id);
      }
      return present(updated);
    },

    async discard(id) {
      if ((await repository.deleteDraft(id)) === 0) {
        throw await explainMissingDraft(id);
      }
    },

    async complete(id) {
      const completed = await repository.completeDraft(id, (draft, { latestCompleted }) => {
        const answers = readStoredAnswers(draft.answers);
        const calculator = toCalculator(draft.calculator);
        const pending = pendingBlocks(answers, calculator);
        if (pending.length > 0) {
          throw incomplete(pending);
        }
        const result = evaluateDiagnosis({ answers, calculator }, rules);
        return {
          values: {
            rulesVersion: result.rulesVersion,
            // The engine returns plain data, so the JSON column keeps it exactly.
            result: result as unknown as Prisma.InputJsonObject,
            stage: result.stage,
            completedAt: now(),
          },
          // The action that repeats keeps its tracking; the others close on the previous diagnosis (RULE-ra-05).
          actionProgress: inheritActionProgress(result.plan, toPreviousPlan(latestCompleted)).actions,
        };
      });
      if (completed !== null) {
        return present(completed);
      }
      // Not a draft anymore: another request concluded it first, so its stored result is the answer.
      const current = await repository.findById(id);
      if (current === null) {
        throw diagnosisNotFound();
      }
      return present(current);
    },
  };
}
