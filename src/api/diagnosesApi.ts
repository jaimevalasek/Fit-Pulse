// Calls of the diagnosis routes (IF-003). The PATCH is partial: only the keys sent change.
import type {
  Answers,
  BlockNumber,
  CalculatorInput,
  DiagnosisResult,
  StageNumber,
} from "../../shared/domain/types";
import { pendingBlocks } from "../../shared/domain/completeness";
import { ApiError, httpClient, isApiError } from "./httpClient";

type DiagnosisStatus = "draft" | "completed";

interface Diagnosis {
  id: string;
  companyId: string;
  status: DiagnosisStatus;
  answers: Answers;
  // Money in whole cents (RULE-dm-12)
  calculator: CalculatorInput;
  currentBlock: BlockNumber;
  updatedAt: string;
  createdAt?: string;
  completedAt?: string | null;
  rulesVersion?: number | null;
  result?: DiagnosisResult | null;
  // The last completed diagnosis of the company, when there is one
  previous?: { stage: StageNumber; completedAt: string } | null;
}

// The diary marks are decided by the server (RULE-ra-09): the patch never carries them.
type CalculatorPatch = Partial<Omit<CalculatorInput, "diarySource" | "diarySuggestion">>;

interface DiagnosisPatch {
  answers?: Answers;
  calculator?: CalculatorPatch;
  currentBlock?: BlockNumber;
}

function diagnosisPath(id: string): string {
  return `/api/diagnoses/${encodeURIComponent(id)}`;
}

// Returns the open draft of the company or a new one, filled from the last completed diagnosis
function startDiagnosis(companyId: string): Promise<Diagnosis> {
  return httpClient.post<Diagnosis>(`/api/companies/${encodeURIComponent(companyId)}/diagnoses`);
}

function getDiagnosis(id: string, signal?: AbortSignal): Promise<Diagnosis> {
  return httpClient.get<Diagnosis>(diagnosisPath(id), { signal });
}

// Drops the diary marks a caller may still hold from a stored calculator: the server refuses them.
function withoutDiaryMarks(calculator: CalculatorPatch | undefined): CalculatorPatch | undefined {
  if (!calculator) return calculator;
  const { diarySource: _source, diarySuggestion: _suggestion, ...rest } = calculator as CalculatorInput;
  return rest;
}

// 409 diagnosis_not_draft once the diagnosis is completed
function updateDiagnosis(id: string, patch: DiagnosisPatch): Promise<Diagnosis> {
  return httpClient.patch<Diagnosis>(diagnosisPath(id), { ...patch, calculator: withoutDiaryMarks(patch.calculator) });
}

// "Usar o diário": the 1 or 2 months of the diary become the numbers of the draft, as estimated.
// 409 no_diary_suggestion when the draft has none; 409 diagnosis_not_draft once completed
function applyDiarySuggestion(id: string): Promise<Diagnosis> {
  return httpClient.post<Diagnosis>(`${diagnosisPath(id)}/diary-suggestion`);
}

// Removes only this draft; completed diagnoses stay (AC-dm-16)
function discardDiagnosis(id: string): Promise<void> {
  return httpClient.delete(diagnosisPath(id));
}

// 422 incomplete carries the pending blocks; a second call returns the stored result
async function completeDiagnosis(id: string): Promise<Diagnosis> {
  try {
    return await httpClient.post<Diagnosis>(`${diagnosisPath(id)}/complete`);
  } catch (error) {
    throw await withPendingBlocks(id, error);
  }
}

function isBlockNumber(value: unknown): value is BlockNumber {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 8;
}

function blocksFromDetails(details: unknown): BlockNumber[] {
  const list = Array.isArray(details) ? details : (details as { pendingBlocks?: unknown } | undefined)?.pendingBlocks;
  return Array.isArray(list) ? list.filter(isBlockNumber) : [];
}

// The server puts pendingBlocks next to code/message; httpClient folds those extra keys into details.
// If a transport ever drops the list, read the stored draft and run the same completeness check the server runs.
async function withPendingBlocks(id: string, error: unknown): Promise<unknown> {
  if (!isApiError(error) || error.status !== 422 || error.code !== "incomplete") return error;
  if (blocksFromDetails(error.details).length > 0) return error;
  try {
    const stored = await getDiagnosis(id);
    const blocks = pendingBlocks(stored.answers, stored.calculator);
    if (blocks.length === 0) return error;
    return new ApiError(error.status, error.code, error.message, { pendingBlocks: blocks }, error.requestId);
  } catch {
    return error;
  }
}

// Pending blocks of a 422 incomplete answer; null for any other error or when no block list came back
function readPendingBlocks(error: unknown): BlockNumber[] | null {
  if (!isApiError(error) || error.status !== 422) return null;
  const blocks = blocksFromDetails(error.details);
  return blocks.length > 0 ? blocks : null;
}

export {
  applyDiarySuggestion,
  completeDiagnosis,
  discardDiagnosis,
  getDiagnosis,
  isBlockNumber,
  readPendingBlocks,
  startDiagnosis,
  updateDiagnosis,
};
export type { CalculatorPatch, Diagnosis, DiagnosisPatch, DiagnosisStatus };
