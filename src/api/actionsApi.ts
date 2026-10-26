// Calls of the action routes (IF-005): the plan the owner tracks, per company or per diagnosis, and the
// edit of one action. The stored diagnosis result is never touched by these calls.
import type { ActionOwnerRole, ActionStatus } from "../../shared/domain/actionProgress";
import type { ActionKey } from "../../shared/domain/types";
import { httpClient } from "./httpClient";

// The diagnosis an inherited action continues from ("Continua do diagnóstico de {data}")
interface InheritedFrom {
  diagnosisId: string;
  completedAt: string;
}

// One action of a plan; optional values are always present, as null when there is none
interface ActionProgress {
  diagnosisId: string;
  actionKey: ActionKey;
  status: ActionStatus;
  // YYYY-MM-DD
  dueDate: string | null;
  ownerRole: ActionOwnerRole | null;
  note: string | null;
  // Only an action of the current plan can be overdue (RULE-ra-06)
  overdue: boolean;
  inheritedFrom: InheritedFrom | null;
  updatedAt: string;
}

// The plan of one completed diagnosis, in the order of its result
interface ActionPlan {
  diagnosisId: string;
  completedAt: string;
  actions: ActionProgress[];
}

// current is null while the company has no completed diagnosis (AC-ra-63); closed comes newest first
interface CompanyActions {
  current: ActionPlan | null;
  closed: ActionPlan[];
}

// isCurrent is false once a newer diagnosis replaced the plan: the actions are then read-only
interface DiagnosisActions {
  isCurrent: boolean;
  actions: ActionProgress[];
}

// Only the keys sent change; null clears a deadline (YYYY-MM-DD), an owner role or a note (up to 500 characters)
interface ActionPatch {
  status?: ActionStatus;
  dueDate?: string | null;
  ownerRole?: ActionOwnerRole | null;
  note?: string | null;
}

function diagnosisPath(id: string): string {
  return `/api/diagnoses/${encodeURIComponent(id)}`;
}

// 404 company_not_found
function getCompanyActions(companyId: string, signal?: AbortSignal): Promise<CompanyActions> {
  return httpClient.get<CompanyActions>(`/api/companies/${encodeURIComponent(companyId)}/actions`, { signal });
}

// 404 diagnosis_not_found; 409 diagnosis_not_completed for a draft
function getDiagnosisActions(diagnosisId: string, signal?: AbortSignal): Promise<DiagnosisActions> {
  return httpClient.get<DiagnosisActions>(`${diagnosisPath(diagnosisId)}/actions`, { signal });
}

// 400 validation_failed; 404 diagnosis_not_found or action_not_found; 409 plan_closed or diagnosis_not_completed
function updateAction(diagnosisId: string, actionKey: ActionKey, patch: ActionPatch): Promise<ActionProgress> {
  return httpClient.patch<ActionProgress>(`${diagnosisPath(diagnosisId)}/actions/${encodeURIComponent(actionKey)}`, patch);
}

export { getCompanyActions, getDiagnosisActions, updateAction };
export type { ActionPatch, ActionPlan, ActionProgress, CompanyActions, DiagnosisActions, InheritedFrom };
