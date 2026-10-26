import { STAGES } from "../../shared/content/stageContent.ts";
import {
  DEFAULT_ACTION_STATUS,
  isActionOverdue,
  normalizeActionProgress,
  type ActionProgressFields,
} from "../../shared/domain/actionProgress.ts";
import { DEFAULT_REEVALUATION_DAYS, reevaluationOf, type Reevaluation } from "../../shared/domain/followUp.ts";
import type { DiagnosisResult, SignalId, StageNumber } from "../../shared/domain/types.ts";
import { localIsoDate } from "../../shared/format/dates.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import {
  createPortfolioRepository,
  type ActionProgressSummaryRecord,
  type AwaitingSendRecord,
  type DiagnosisSummaryRecord,
  type PortfolioRecord,
} from "../repositories/portfolioRepository.ts";
import type { AttentionFilter } from "../validation/companySchemas.ts";
import { createPreferenceService } from "./preferenceService.ts";

// The portfolio of the consultant, read once and counted once: the home of the consultant and the
// PDF of the portfolio both take their numbers from here, so the two never disagree (AC-ra-15).

/** A draft untouched for more than this many days is listed as stalled (PRD, CAP-dm-home). */
export const STALE_DRAFT_DAYS = 7;
/**
 * The interval until a company is due for a new diagnosis when the user never chose one in
 * "Configurações"; the home calls it "overdue" when that day has passed (RULE-ra-07).
 */
export const OVERDUE_DIAGNOSIS_DAYS = DEFAULT_REEVALUATION_DAYS;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PortfolioCompany {
  companyId: string;
  name: string;
}

export interface StageGroup {
  stage: StageNumber;
  count: number;
  companies: Array<PortfolioCompany & { lastDiagnosisAt: string }>;
}

/** Shape of IF-008 in "consultoria" mode. Archived companies appear nowhere. */
export interface ConsultantHomeView {
  mode: "consultant";
  /** Days between diagnoses the user chose (60, 90, 120 or 180): the line "overdue" is drawn at. */
  reevaluationDays: number;
  /** Active companies; zero is the empty state. */
  companyCount: number;
  /** Always four groups, stage 1 to 4, by the latest diagnosis of each company. */
  byStage: StageGroup[];
  /** No completed, non-archived diagnosis at all. */
  withoutDiagnosis: PortfolioCompany[];
  /** Open draft untouched for more than `STALE_DRAFT_DAYS`; longest idle first. */
  staleDrafts: Array<PortfolioCompany & { draftId: string; updatedAt: string; idleDays: number }>;
  /** The reevaluation day of the latest diagnosis has passed; oldest first. `daysSince` counts calendar days. */
  overdue: Array<PortfolioCompany & { diagnosisId: string; lastDiagnosisAt: string; daysSince: number }>;
  /** Latest diagnosis carries a high risk (score from 16 under rules v1); highest first. */
  highRisk: Array<PortfolioCompany & { diagnosisId: string; signalId: SignalId; riskScore: number }>;
  /** Actions of the current plan past their deadline (RULE-ra-06); the most overdue first. */
  overdueActions: Array<PortfolioCompany & { diagnosisId: string; overdueCount: number }>;
  /**
   * Companies with a questionnaire file sent and not yet answered, once each, by the newest send; the
   * longest wait first. `waitingDays` counts calendar days since `sentAt`. Left out while nobody waits.
   */
  awaitingQuestionnaires?: Array<PortfolioCompany & { sentAt: string; waitingDays: number }>;
}

/** One active company as the report lists it. The same data the lists of the home were counted from. */
export interface PortfolioRow extends PortfolioCompany {
  /** Stage of the latest diagnosis; `null` without a completed, non-archived one. */
  stage: StageNumber | null;
  /** Moment the latest diagnosis was completed (ISO). */
  lastDiagnosisAt: string | null;
  /** When the next diagnosis is due and whether that day has passed; `null` without a diagnosis. */
  reevaluation: Reevaluation | null;
  /** The latest diagnosis carries a high risk. */
  highRisk: boolean;
  /** Actions of the current plan past their deadline (RULE-ra-06); `null` without a current plan or while nothing was recorded on its actions. */
  overdueActions: number | null;
}

export interface Portfolio {
  /** Days from the last diagnosis until the next is due, the interval every `reevaluation` was counted with. */
  reevaluationDays: number;
  /** The consultant home, exactly as IF-008 sends it. */
  view: ConsultantHomeView;
  /** Every active company once: stage 1 to 4 in order, then those without a diagnosis; by name inside each. */
  rows: PortfolioRow[];
}

export interface PortfolioService {
  /** The portfolio as of `at` (the app clock when omitted), counted with the interval the user chose. */
  read(at?: Date): Promise<Portfolio>;
  /**
   * The companies one indicator of "O que precisa de você" counted, as of `at`. The list a filter
   * opens is exactly the list the home showed (AC-ra-35). Only active companies are in the portfolio.
   */
  needingAttention(attention: AttentionFilter, at?: Date): Promise<ReadonlySet<string>>;
}

export interface PortfolioServiceDeps {
  prisma: PrismaClient;
  /** Clock the day counts are measured against; tests control it. */
  now: () => Date;
}

// ---------------------------------------------------------------- reading stored diagnoses

/** A completed diagnosis whose stored result is readable. */
export interface CompletedDiagnosis {
  id: string;
  completedAt: Date;
  stage: StageNumber;
  result: DiagnosisResult;
}

function asStageNumber(value: number | null): StageNumber | null {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

// The result is frozen JSON written by `completeDraft`; a row that does not look like one
// is left out of the home instead of blanking the whole screen.
function isReadableResult(stored: unknown): stored is DiagnosisResult {
  if (typeof stored !== "object" || stored === null) {
    return false;
  }
  const { dimensions, risks, plan } = stored as Partial<DiagnosisResult>;
  return typeof dimensions === "object" && dimensions !== null && Array.isArray(risks) && Array.isArray(plan);
}

function toCompleted(record: DiagnosisSummaryRecord): CompletedDiagnosis | null {
  const stage = asStageNumber(record.stage);
  if (record.status !== "completed" || record.completedAt === null || stage === null) {
    return null;
  }
  return isReadableResult(record.result)
    ? { id: record.id, completedAt: record.completedAt, stage, result: record.result }
    : null;
}

export function readCompleted(records: DiagnosisSummaryRecord[]): CompletedDiagnosis[] {
  return records.flatMap((record) => toCompleted(record) ?? []);
}

// ---------------------------------------------------------------- counting

const nameCollator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function byName(a: PortfolioCompany, b: PortfolioCompany): number {
  return nameCollator.compare(a.name, b.name) || a.companyId.localeCompare(b.companyId);
}

/** Without a stage the company goes last. */
function byStageThenName(a: PortfolioRow, b: PortfolioRow): number {
  return (a.stage ?? STAGES.length + 1) - (b.stage ?? STAGES.length + 1) || byName(a, b);
}

/** Whole days elapsed from `from` until `at`. */
function wholeDaysBetween(from: Date, at: Date): number {
  return Math.floor((at.getTime() - from.getTime()) / DAY_MS);
}

/** Whether the owner recorded anything on the action: a state other than "A fazer", a deadline, an owner or a note. */
function isRecorded({ status, dueDate, ownerRole, note }: ActionProgressFields): boolean {
  return status !== DEFAULT_ACTION_STATUS || dueDate !== null || ownerRole !== null || note !== null;
}

/**
 * Actions of the current plan past their deadline (RULE-ra-06). Each action of the plan counts once;
 * a row of another plan, an action done or not applicable, one without a deadline and one due today
 * or later do not count. `today` is the computer's local day. `null` while nothing was recorded on the
 * plan: the rows born with a diagnosis are not tracking yet, so the report has no count to show.
 */
function countOverdueActions(
  plan: DiagnosisResult["plan"],
  progress: readonly ActionProgressSummaryRecord[],
  today: string | null,
): number | null {
  const planned = new Set<string>(plan);
  const tracked = progress
    .filter((row) => planned.has(row.actionKey))
    .map((row) => ({ actionKey: row.actionKey, fields: normalizeActionProgress(row) }));
  if (!tracked.some(({ fields }) => isRecorded(fields))) {
    return null;
  }
  return new Set(tracked.filter(({ fields }) => isActionOverdue(fields, today)).map(({ actionKey }) => actionKey)).size;
}

/** "More than N days" is strict: exactly N days is still on time. */
function isOlderThan(from: Date, at: Date, days: number): boolean {
  return at.getTime() - from.getTime() > days * DAY_MS;
}

/**
 * The newest send of each listed company that is still waiting for its answers (CAP-ra-remote-questionnaire).
 * A send of a company the portfolio does not list (archived) counts for nobody.
 */
function awaitingOf(
  companies: readonly PortfolioRecord[],
  sends: readonly AwaitingSendRecord[],
  at: Date,
): NonNullable<ConsultantHomeView["awaitingQuestionnaires"]> {
  const newest = new Map<string, Date>();
  for (const { companyId, sentAt } of sends) {
    const current = newest.get(companyId);
    if (current === undefined || sentAt > current) {
      newest.set(companyId, sentAt);
    }
  }
  return companies
    .filter(({ id }) => newest.has(id))
    .map(({ id, name }) => {
      const sentAt = newest.get(id) as Date;
      return { companyId: id, name, sentAt: sentAt.toISOString(), waitingDays: wholeDaysBetween(sentAt, at) };
    })
    .sort((a, b) => b.waitingDays - a.waitingDays || byName(a, b));
}

export function buildPortfolio(
  records: PortfolioRecord[],
  at: Date,
  intervalDays: number = OVERDUE_DIAGNOSIS_DAYS,
  awaitingSends: readonly AwaitingSendRecord[] = [],
): Portfolio {
  const byStage: StageGroup[] = STAGES.map(({ number }) => ({ stage: number, count: 0, companies: [] }));
  const view: ConsultantHomeView = {
    mode: "consultant",
    reevaluationDays: intervalDays,
    companyCount: records.length,
    byStage,
    withoutDiagnosis: [],
    staleDrafts: [],
    overdue: [],
    highRisk: [],
    overdueActions: [],
  };
  const rows: PortfolioRow[] = [];
  const today = localIsoDate(at);

  for (const company of records) {
    const ref: PortfolioCompany = { companyId: company.id, name: company.name };
    const [latest] = readCompleted(company.diagnoses);
    const draft = company.diagnoses.find((record) => record.status === "draft");

    if (draft !== undefined && isOlderThan(draft.updatedAt, at, STALE_DRAFT_DAYS)) {
      view.staleDrafts.push({
        ...ref,
        draftId: draft.id,
        updatedAt: draft.updatedAt.toISOString(),
        idleDays: wholeDaysBetween(draft.updatedAt, at),
      });
    }

    if (latest === undefined) {
      view.withoutDiagnosis.push(ref);
      rows.push({ ...ref, stage: null, lastDiagnosisAt: null, reevaluation: null, highRisk: false, overdueActions: null });
      continue;
    }

    const lastDiagnosisAt = latest.completedAt.toISOString();
    byStage[latest.stage - 1].companies.push({ ...ref, lastDiagnosisAt });
    const reevaluation = reevaluationOf(latest.completedAt, at, intervalDays);
    if (reevaluation?.late) {
      view.overdue.push({ ...ref, diagnosisId: latest.id, lastDiagnosisAt, daysSince: reevaluation.daysSince });
    }
    // The stored risks are ordered by score, so the first high one is the highest.
    const topRisk = latest.result.risks.find((risk) => risk.level === "high");
    // The latest diagnosis holds the current plan. A record that came without the tracking has no count.
    const tracking = company.diagnoses.find((record) => record.id === latest.id)?.actionProgress;
    if (topRisk !== undefined) {
      view.highRisk.push({ ...ref, diagnosisId: latest.id, signalId: topRisk.signalId, riskScore: topRisk.score });
    }
    const overdueActions = tracking === undefined ? null : countOverdueActions(latest.result.plan, tracking, today);
    if (overdueActions !== null && overdueActions > 0) {
      view.overdueActions.push({ ...ref, diagnosisId: latest.id, overdueCount: overdueActions });
    }
    rows.push({
      ...ref,
      stage: latest.stage,
      lastDiagnosisAt,
      reevaluation,
      highRisk: topRisk !== undefined,
      overdueActions,
    });
  }

  for (const group of byStage) {
    group.companies.sort(byName);
    group.count = group.companies.length;
  }
  view.withoutDiagnosis.sort(byName);
  view.staleDrafts.sort((a, b) => b.idleDays - a.idleDays || byName(a, b));
  view.overdue.sort((a, b) => b.daysSince - a.daysSince || byName(a, b));
  view.highRisk.sort((a, b) => b.riskScore - a.riskScore || byName(a, b));
  view.overdueActions.sort((a, b) => b.overdueCount - a.overdueCount || byName(a, b));
  const awaiting = awaitingOf(records, awaitingSends, at);
  if (awaiting.length > 0) {
    view.awaitingQuestionnaires = awaiting;
  }
  rows.sort(byStageThenName);
  return { reevaluationDays: intervalDays, view, rows };
}

// ---------------------------------------------------------------- attention

// One list of the consultant home per filter, so a filter and its indicator can never disagree.
const ATTENTION_LISTS: Record<AttentionFilter, (view: ConsultantHomeView) => PortfolioCompany[]> = {
  atrasada: (view) => view.overdue,
  vencidas: (view) => view.overdueActions,
  risco: (view) => view.highRisk,
  aguardando: (view) => view.awaitingQuestionnaires ?? [],
  rascunhos: (view) => view.staleDrafts,
  "sem-diagnostico": (view) => view.withoutDiagnosis,
};

/** Ids of the companies the indicator of the home counted for `attention`. */
export function companyIdsNeedingAttention(view: ConsultantHomeView, attention: AttentionFilter): Set<string> {
  return new Set(ATTENTION_LISTS[attention](view).map(({ companyId }) => companyId));
}

// ---------------------------------------------------------------- service

export function createPortfolioService({ prisma, now }: PortfolioServiceDeps): PortfolioService {
  const portfolio = createPortfolioRepository(prisma);
  const preferences = createPreferenceService({ prisma });

  // The interval is read on every call, so a change in "Configurações" moves the very next count.
  async function read(at = now()): Promise<Portfolio> {
    const [records, awaitingSends, { reevaluationIntervalDays }] = await Promise.all([
      portfolio.listActive(),
      portfolio.listAwaitingSends(),
      preferences.get(),
    ]);
    return buildPortfolio(records, at, reevaluationIntervalDays, awaitingSends);
  }

  return {
    read,

    async needingAttention(attention, at) {
      return companyIdsNeedingAttention((await read(at)).view, attention);
    },
  };
}
