import { BLOCK_COUNT } from "../../shared/content/questionBank.ts";
import { pendingBlocks } from "../../shared/domain/completeness.ts";
import { computeDiaryProgress, computeRecentCost, type DiaryEntry } from "../../shared/domain/diary.ts";
import { reevaluationOf } from "../../shared/domain/followUp.ts";
import {
  EMPTY_CALCULATOR,
  type ActionKey,
  type BlockNumber,
  type CalculatorInput,
  type ConfidenceLevel,
  type DimensionKey,
  type LockKey,
  type StageNumber,
} from "../../shared/domain/types.ts";
import { localIsoDate } from "../../shared/format/dates.ts";
import type { Prisma, PrismaClient } from "../generated/prisma/client.ts";
import type { DiagnosisRecord } from "../repositories/diagnosisRepository.ts";
import { createDiaryRepository } from "../repositories/diaryRepository.ts";
import { createGeneratedFileRepository, type GeneratedFileRecord } from "../repositories/generatedFileRepository.ts";
import { DIAGNOSIS_SUMMARY_SELECT, type DiagnosisSummaryRecord } from "../repositories/portfolioRepository.ts";
import { readStoredAnswers, readStoredCalculator } from "../validation/diagnosisSchemas.ts";
import type { UsageMode } from "../validation/preferenceSchemas.ts";
import { createActionService, type ActionProgressView } from "./actionService.ts";
import { DomainError } from "./domainError.ts";
import type { TimelineDraft } from "./historyService.ts";
import {
  createPortfolioService,
  readCompleted,
  type CompletedDiagnosis,
  type ConsultantHomeView,
} from "./portfolioService.ts";
import { createPreferenceService } from "./preferenceService.ts";

// The consultant side of the home (the portfolio) is counted by the portfolio service; these stay
// importable from here, where the home contract (IF-008) has always been.
export { OVERDUE_DIAGNOSIS_DAYS, STALE_DRAFT_DAYS } from "./portfolioService.ts";
export type { ConsultantHomeView, PortfolioCompany, StageGroup } from "./portfolioService.ts";

export interface HomeCompany {
  id: string;
  name: string;
}

/** The latest completed, non-archived diagnosis of the company in focus. */
export interface HomeLatestDiagnosis {
  id: string;
  completedAt: string;
  stage: StageNumber;
  /** The completed, non-archived diagnosis right before; `null` for the first one (BR-dm-08). */
  previous: { stage: StageNumber; completedAt: string } | null;
  /** First unmet criterion of the next stage; `null` at the top stage. */
  lock: LockKey | null;
  /** The dimension that holds the company back most. */
  weakestDimension: DimensionKey;
  /** Exactly three action keys. */
  plan: ActionKey[];
  confidence: ConfidenceLevel;
}

/**
 * When the next diagnosis is due, counted from the latest one with the interval the user chose
 * (RULE-ra-07). The days are calendar days of the computer's own time zone.
 */
export interface HomeReevaluation {
  /** Moment the latest diagnosis was completed (ISO). */
  lastAt: string;
  /** The day the next diagnosis is due, `YYYY-MM-DD`. */
  dueAt: string;
  /** The day the counts were measured at, `YYYY-MM-DD`: the "Hoje" of the home. */
  today: string;
  /** Calendar days from today until `dueAt`; negative once it has passed. */
  daysUntil: number;
  /** Calendar days since `dueAt` has passed; 0 while on time (on the due day itself the company is on time). */
  daysOverdue: number;
  /** Days between diagnoses the user chose: 60, 90, 120 or 180. */
  intervalDays: number;
}

/** The actions of the current plan by state. An overdue action is also counted in "A fazer" or "Em andamento". */
export interface HomeActionCounts {
  done: number;
  inProgress: number;
  todo: number;
  notApplicable: number;
  /** Past their deadline and still open (RULE-ra-06). */
  overdue: number;
}

export interface HomeActions {
  counts: HomeActionCounts;
  /** The three actions of the plan of the latest diagnosis, in IF-005 shape so the home can edit them; empty without a diagnosis. */
  current: ActionProgressView[];
}

/** What the monthly diary says so far (RULE-ra-09). */
export interface HomeDiary {
  /** Months noted. */
  count: number;
  /** Cost per customer over the (up to) 3 most recent months, in cents; `null` while nothing is noted or no customer came. */
  cacCents: number | null;
  /** `YYYY-MM` of the oldest and the newest of the 3 most recent months once there are 3 or more; `null` before. */
  measuredFrom: string | null;
  measuredTo: string | null;
}

/** The last report PDF saved for the company. */
export interface HomeLatestReport {
  fileId: string;
  fileName: string;
  /** Moment of the save (ISO). */
  savedAt: string;
}

/**
 * Shape of IF-008 in "minha empresa" mode. `latest`, `draft`, `reevaluation` and `latestReport` are
 * `null` when there is none.
 */
export interface OwnerHomeView {
  mode: "owner";
  company: HomeCompany;
  latest: HomeLatestDiagnosis | null;
  draft: TimelineDraft | null;
  /** `null` until the company has a completed, non-archived diagnosis. */
  reevaluation: HomeReevaluation | null;
  actions: HomeActions;
  diary: HomeDiary;
  latestReport: HomeLatestReport | null;
}

export type HomeView = OwnerHomeView | ConsultantHomeView;

export interface HomeQuery {
  mode: UsageMode;
  /** Company in focus (owner mode); without it the saved focus, then the first active company. */
  companyId?: string;
}

export interface HomeService {
  get(query: HomeQuery): Promise<HomeView>;
}

export interface HomeServiceDeps {
  prisma: PrismaClient;
  /** Clock the day counts are measured against; tests control it. */
  now: () => Date;
}

function companyNotFound(): DomainError {
  return new DomainError(404, "company_not_found", "Empresa não encontrada.");
}

function noCompanyYet(): DomainError {
  return new DomainError(404, "company_not_found", "Ainda não há empresa cadastrada.");
}

// ---------------------------------------------------------------- data access
// The queries of the owner home stay together here, apart from the rules below. The portfolio of
// the consultant is read by the portfolio repository.

type HomeDiagnosisRecord = DiagnosisSummaryRecord;

interface HomeData {
  findActiveCompany(id: string): Promise<HomeCompany | null>;
  /** The oldest registered active company. */
  findFirstActiveCompany(): Promise<HomeCompany | null>;
  /** Completed, non-archived diagnoses of the company, newest first (same order as the history). */
  listCompleted(companyId: string): Promise<HomeDiagnosisRecord[]>;
  findDraft(companyId: string): Promise<DiagnosisRecord | null>;
}

function createHomeData(prisma: PrismaClient): HomeData {
  const companyFields = { id: true, name: true } satisfies Prisma.CompanySelect;
  return {
    findActiveCompany: (id) => prisma.company.findFirst({ where: { id, archivedAt: null }, select: companyFields }),

    findFirstActiveCompany: () =>
      prisma.company.findFirst({
        where: { archivedAt: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: companyFields,
      }),

    listCompleted: (companyId) =>
      prisma.diagnosis.findMany({
        where: { companyId, status: "completed", archivedAt: null, completedAt: { not: null } },
        select: DIAGNOSIS_SUMMARY_SELECT,
        orderBy: [{ completedAt: "desc" }, { id: "asc" }],
      }),

    findDraft: (companyId) =>
      prisma.diagnosis.findFirst({
        where: { companyId, status: "draft" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
  };
}

// ---------------------------------------------------------------- reading stored diagnoses

function toDraft(record: DiagnosisRecord): TimelineDraft {
  const calculator = { ...EMPTY_CALCULATOR, ...readStoredCalculator(record.calculator) } as CalculatorInput;
  const pending = pendingBlocks(readStoredAnswers(record.answers), calculator);
  return {
    id: record.id,
    currentBlock: record.currentBlock as BlockNumber,
    completedBlocks: BLOCK_COUNT - pending.length,
    totalBlocks: BLOCK_COUNT,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toLatest(newest: CompletedDiagnosis, before: CompletedDiagnosis | undefined): HomeLatestDiagnosis {
  return {
    id: newest.id,
    completedAt: newest.completedAt.toISOString(),
    stage: newest.stage,
    previous: before === undefined ? null : { stage: before.stage, completedAt: before.completedAt.toISOString() },
    lock: newest.result.lock,
    weakestDimension: newest.result.weakestDimension,
    plan: newest.result.plan,
    confidence: newest.result.confidence.level,
  };
}

function toReevaluation(latest: CompletedDiagnosis, at: Date, intervalDays: number): HomeReevaluation | null {
  const today = localIsoDate(at);
  const reevaluation = reevaluationOf(latest.completedAt, at, intervalDays);
  if (today === null || reevaluation === null) {
    return null;
  }
  return {
    lastAt: latest.completedAt.toISOString(),
    dueAt: reevaluation.dueDate,
    today,
    daysUntil: reevaluation.daysUntil,
    daysOverdue: reevaluation.daysLate,
    intervalDays,
  };
}

function countActions(actions: readonly ActionProgressView[]): HomeActionCounts {
  const inStatus = (status: ActionProgressView["status"]): number =>
    actions.filter((action) => action.status === status).length;
  return {
    done: inStatus("done"),
    inProgress: inStatus("in_progress"),
    todo: inStatus("todo"),
    notApplicable: inStatus("not_applicable"),
    overdue: actions.filter((action) => action.overdue).length,
  };
}

function toDiary(entries: readonly DiaryEntry[]): HomeDiary {
  const { count, measuredFrom, measuredTo } = computeDiaryProgress(entries);
  return { count, cacCents: computeRecentCost(entries)?.cacCents ?? null, measuredFrom, measuredTo };
}

function toLatestReport(file: GeneratedFileRecord | null): HomeLatestReport | null {
  return file === null ? null : { fileId: file.id, fileName: file.fileName, savedAt: file.createdAt.toISOString() };
}

// ---------------------------------------------------------------- service

export function createHomeService({ prisma, now }: HomeServiceDeps): HomeService {
  const data = createHomeData(prisma);
  const preferences = createPreferenceService({ prisma });
  const portfolio = createPortfolioService({ prisma, now });
  const actions = createActionService({ prisma, now });
  const diary = createDiaryRepository(prisma);
  const files = createGeneratedFileRepository(prisma);

  // An explicit company must exist and be active; otherwise the saved focus, then the oldest
  // active company, so the owner never lands on an empty home while a company exists.
  async function resolveFocusCompany(
    requestedId: string | undefined,
    focusCompanyId: string | null,
  ): Promise<HomeCompany> {
    if (requestedId !== undefined) {
      const requested = await data.findActiveCompany(requestedId);
      if (requested === null) {
        throw companyNotFound();
      }
      return requested;
    }
    const saved = focusCompanyId === null ? null : await data.findActiveCompany(focusCompanyId);
    const company = saved ?? (await data.findFirstActiveCompany());
    if (company === null) {
      throw noCompanyYet();
    }
    return company;
  }

  // Every number is read at the call, from the stored data and the clock: nothing is kept between opens (AC-ra-36).
  async function ownerView(requestedId: string | undefined): Promise<OwnerHomeView> {
    const at = now();
    const { focusCompanyId, reevaluationIntervalDays } = await preferences.get();
    const company = await resolveFocusCompany(requestedId, focusCompanyId);
    const [records, draft, plans, diaryEntries, latestFile] = await Promise.all([
      data.listCompleted(company.id),
      data.findDraft(company.id),
      actions.forCompany(company.id),
      diary.findByCompany(company.id),
      files.findLatestByCompany(company.id),
    ]);
    const completed = readCompleted(records);
    const current = plans.current?.actions ?? [];
    return {
      mode: "owner",
      company,
      latest: completed.length === 0 ? null : toLatest(completed[0], completed[1]),
      draft: draft === null ? null : toDraft(draft),
      reevaluation: completed.length === 0 ? null : toReevaluation(completed[0], at, reevaluationIntervalDays),
      actions: { counts: countActions(current), current },
      diary: toDiary(diaryEntries),
      latestReport: toLatestReport(latestFile),
    };
  }

  return {
    async get({ mode, companyId }) {
      return mode === "owner" ? ownerView(companyId) : (await portfolio.read()).view;
    },
  };
}
