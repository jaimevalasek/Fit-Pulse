// Call of the home screen route (IF-008). Owner mode answers the focus company; consultant mode
// answers the portfolio by stage and the attention lists. Every number comes from the database.
import type { ActionKey, ConfidenceLevel, DimensionKey, LockKey, SignalId, StageNumber } from "../../shared/domain/types";
import type { ActionProgress } from "./actionsApi";
import { httpClient } from "./httpClient";
import type { TimelineDraft } from "./historyApi";

// The latest completed, non-archived diagnosis of the focus company
interface HomeLatestDiagnosis {
  id: string;
  completedAt: string;
  stage: StageNumber;
  // The completed diagnosis right before; null for the first one
  previous: { stage: StageNumber; completedAt: string } | null;
  // null at the top stage
  lock: LockKey | null;
  weakestDimension: DimensionKey;
  plan: ActionKey[];
  confidence: ConfidenceLevel;
}

// When the next diagnosis is due, counted from the latest one with the interval chosen in
// "Configurações". The days are calendar days of the computer's own time zone.
interface HomeReevaluation {
  // Moment the latest diagnosis was completed (ISO)
  lastAt: string;
  // The day the next diagnosis is due, YYYY-MM-DD
  dueAt: string;
  // The day the counts were measured at, YYYY-MM-DD: the "Hoje" of the home
  today: string;
  // Calendar days from today until dueAt; negative once it has passed
  daysUntil: number;
  // Calendar days since dueAt has passed; 0 while on time (the due day itself is still on time)
  daysOverdue: number;
  // 60, 90, 120 or 180
  intervalDays: number;
}

// The actions of the current plan by state. An overdue action is also counted in todo or inProgress.
interface HomeActionCounts {
  done: number;
  inProgress: number;
  todo: number;
  notApplicable: number;
  overdue: number;
}

interface HomeActions {
  counts: HomeActionCounts;
  // The three actions of the plan of the latest diagnosis (same shape as the actions route, so the
  // home edits them with updateAction); empty without a diagnosis
  current: ActionProgress[];
}

// What the monthly diary says so far
interface HomeDiary {
  // Months noted
  count: number;
  // Cost per customer over the (up to) 3 most recent months, in cents; null while nothing is noted or no customer came
  cacCents: number | null;
  // YYYY-MM of the oldest and the newest of the 3 most recent months; null before there are 3 months
  measuredFrom: string | null;
  measuredTo: string | null;
}

// The last report PDF saved for the company
interface HomeLatestReport {
  fileId: string;
  fileName: string;
  // Moment of the save (ISO)
  savedAt: string;
}

interface OwnerHomeData {
  mode: "owner";
  company: { id: string; name: string };
  latest: HomeLatestDiagnosis | null;
  draft: TimelineDraft | null;
  // null until the company has a completed, non-archived diagnosis
  reevaluation: HomeReevaluation | null;
  actions: HomeActions;
  diary: HomeDiary;
  latestReport: HomeLatestReport | null;
}

// Every item of the consultant lists carries the company it leads to
interface HomeCompanyItem {
  companyId: string;
  name: string;
}

interface HomeStageGroup {
  stage: StageNumber;
  count: number;
  companies: Array<HomeCompanyItem & { lastDiagnosisAt: string }>;
}

// A draft with no answer for more than 7 days; longest idle first
interface HomeStaleDraft extends HomeCompanyItem {
  draftId: string;
  updatedAt: string;
  idleDays: number;
}

// The reevaluation day of the latest diagnosis has passed; oldest first
interface HomeOverdueCompany extends HomeCompanyItem {
  diagnosisId: string;
  lastDiagnosisAt: string;
  daysSince: number;
}

// The latest diagnosis carries a risk scored 16 or more; highest first
interface HomeHighRiskCompany extends HomeCompanyItem {
  diagnosisId: string;
  signalId: SignalId;
  riskScore: number;
}

// Actions of the current plan past their deadline; the most overdue first
interface HomeOverdueActionsCompany extends HomeCompanyItem {
  diagnosisId: string;
  overdueCount: number;
}

interface ConsultantHomeData {
  mode: "consultant";
  // Days between diagnoses the user chose (60, 90, 120 or 180): the line "overdue" is drawn at
  reevaluationDays: number;
  // Active companies; zero is the empty state
  companyCount: number;
  // Always four groups, stage 1 to 4
  byStage: HomeStageGroup[];
  withoutDiagnosis: HomeCompanyItem[];
  staleDrafts: HomeStaleDraft[];
  overdue: HomeOverdueCompany[];
  highRisk: HomeHighRiskCompany[];
  overdueActions: HomeOverdueActionsCompany[];
}

// Without companyId the server uses the saved focus, then the first active company.
// 404 company_not_found when the given company is missing or archived, or when there is no company.
function getOwnerHome(companyId?: string | null, signal?: AbortSignal): Promise<OwnerHomeData> {
  return httpClient.get<OwnerHomeData>("/api/home", { query: { mode: "owner", companyId }, signal });
}

function getConsultantHome(signal?: AbortSignal): Promise<ConsultantHomeData> {
  return httpClient.get<ConsultantHomeData>("/api/home", { query: { mode: "consultant" }, signal });
}

export { getConsultantHome, getOwnerHome };
export type {
  ConsultantHomeData,
  HomeActionCounts,
  HomeActions,
  HomeCompanyItem,
  HomeDiary,
  HomeHighRiskCompany,
  HomeLatestDiagnosis,
  HomeLatestReport,
  HomeOverdueActionsCompany,
  HomeOverdueCompany,
  HomeReevaluation,
  HomeStageGroup,
  HomeStaleDraft,
  OwnerHomeData,
};
