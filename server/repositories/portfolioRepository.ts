import type { Prisma, PrismaClient } from "../generated/prisma/client.ts";
import { createQuestionnaireRepository, type QuestionnaireSendRecord } from "./questionnaireRepository.ts";

// What the home and the portfolio read of a diagnosis. The frozen result is small; the answers and
// the calculator are never read here.
export const DIAGNOSIS_SUMMARY_SELECT = {
  id: true,
  status: true,
  stage: true,
  completedAt: true,
  updatedAt: true,
  result: true,
} satisfies Prisma.DiagnosisSelect;

// What the portfolio reads of the action tracking: the state and the deadline decide RULE-ra-06; the owner
// and the note tell whether the owner recorded anything at all.
const ACTION_PROGRESS_SELECT = {
  actionKey: true,
  status: true,
  dueDate: true,
  ownerRole: true,
  note: true,
} satisfies Prisma.ActionProgressSelect;

const PORTFOLIO_SELECT = {
  id: true,
  name: true,
  diagnoses: {
    where: { OR: [{ status: "draft" }, { status: "completed", archivedAt: null }] },
    select: { ...DIAGNOSIS_SUMMARY_SELECT, actionProgress: { select: ACTION_PROGRESS_SELECT } },
    orderBy: [{ completedAt: "desc" }, { id: "asc" }],
  },
} satisfies Prisma.CompanySelect;

export type DiagnosisSummaryRecord = Prisma.DiagnosisGetPayload<{ select: typeof DIAGNOSIS_SUMMARY_SELECT }>;
export type ActionProgressSummaryRecord = Prisma.ActionProgressGetPayload<{ select: typeof ACTION_PROGRESS_SELECT }>;
export type PortfolioRecord = Prisma.CompanyGetPayload<{ select: typeof PORTFOLIO_SELECT }>;
/** What the home reads of a questionnaire sent and not yet answered: whose it is and when it went out. */
export type AwaitingSendRecord = Pick<QuestionnaireSendRecord, "companyId" | "sentAt">;

export interface PortfolioRepository {
  /**
   * Active companies with their drafts and completed, non-archived diagnoses (newest first), each with
   * the action tracking stored for it. The current plan is the newest completed one, so only its rows count.
   */
  listActive(): Promise<PortfolioRecord[]>;
  /**
   * Questionnaires sent and still waiting for the client's answers, newest first, of every company.
   * The portfolio keeps only those of the companies it lists, so an archived company appears nowhere.
   */
  listAwaitingSends(): Promise<AwaitingSendRecord[]>;
}

export function createPortfolioRepository(prisma: PrismaClient): PortfolioRepository {
  const questionnaires = createQuestionnaireRepository(prisma);
  return {
    listActive: () => prisma.company.findMany({ where: { archivedAt: null }, select: PORTFOLIO_SELECT }),
    listAwaitingSends: () => questionnaires.listAwaiting(),
  };
}
