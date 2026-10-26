// Calls of the history routes (IF-005): the company timeline, archive/restore of a completed
// diagnosis and the comparison with the one before it.
import type { DiagnosisComparison } from "../../shared/domain/compareDiagnoses";
import type { BlockNumber, ConfidenceLevel, StageNumber } from "../../shared/domain/types";
import { httpClient } from "./httpClient";

// The company's open draft with how far the owner got
interface TimelineDraft {
  id: string;
  currentBlock: BlockNumber;
  // Blocks with every item answered, out of totalBlocks
  completedBlocks: number;
  totalBlocks: number;
  createdAt: string;
  updatedAt: string;
  // When the client saved the answers this draft came from ("Respostas do cliente, salvas em {data}");
  // absent or null for a draft the owner started (IF-011)
  clientAnswersSavedAt?: string | null;
}

// A completed diagnosis in the timeline, archived or not
interface TimelineEntry {
  id: string;
  companyId: string;
  completedAt: string;
  // null while the diagnosis counts
  archivedAt: string | null;
  stage: StageNumber;
  rulesVersion: number;
  confidence: ConfidenceLevel;
  // False for the first diagnosis: there is nothing earlier to compare with (BR-dm-08)
  canCompare: boolean;
}

// Both lists come newest first; draft is null when there is none
interface Timeline {
  draft: TimelineDraft | null;
  completed: TimelineEntry[];
  archived: TimelineEntry[];
}

function diagnosisPath(id: string): string {
  return `/api/diagnoses/${encodeURIComponent(id)}`;
}

function getTimeline(companyId: string, signal?: AbortSignal): Promise<Timeline> {
  return httpClient.get<Timeline>(`/api/companies/${encodeURIComponent(companyId)}/timeline`, { signal });
}

// Idempotent; 409 diagnosis_not_completed for a draft
function archiveDiagnosis(id: string): Promise<TimelineEntry> {
  return httpClient.post<TimelineEntry>(`${diagnosisPath(id)}/archive`);
}

function restoreDiagnosis(id: string): Promise<TimelineEntry> {
  return httpClient.post<TimelineEntry>(`${diagnosisPath(id)}/restore`);
}

// 409 no_previous_diagnosis when there is no earlier completed, non-archived diagnosis
function getComparison(id: string, signal?: AbortSignal): Promise<DiagnosisComparison> {
  return httpClient.get<DiagnosisComparison>(`${diagnosisPath(id)}/comparison`, { signal });
}

export { archiveDiagnosis, getComparison, getTimeline, restoreDiagnosis };
export type { DiagnosisComparison, Timeline, TimelineDraft, TimelineEntry };
