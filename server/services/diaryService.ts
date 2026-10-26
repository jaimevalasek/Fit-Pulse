import { buildDiaryView, diaryMonthTakenMessage, type DiaryView } from "../../shared/domain/diary.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import { createDiaryRepository } from "../repositories/diaryRepository.ts";
import type { DiaryCreateInput, DiaryUpdateInput } from "../validation/diarySchemas.ts";
import { DomainError } from "./domainError.ts";

/**
 * Every call answers with the whole diary of the company (IF-006), so the screen redraws the list, the
 * progress and the chart from one response.
 */
export interface DiaryService {
  list(companyId: string): Promise<DiaryView>;
  /** Notes a month; 409 `month_taken` when the company already has it (RULE-ra-08). */
  create(companyId: string, input: DiaryCreateInput): Promise<DiaryView>;
  /** Replaces the values of a month already noted; the month never changes. */
  update(companyId: string, month: string, input: DiaryUpdateInput): Promise<DiaryView>;
  remove(companyId: string, month: string): Promise<DiaryView>;
}

export interface DiaryServiceDeps {
  prisma: PrismaClient;
}

function companyNotFound(): DomainError {
  return new DomainError(404, "company_not_found", "Empresa não encontrada.");
}

function monthNotFound(): DomainError {
  return new DomainError(404, "diary_month_not_found", "Esse mês não está no diário.");
}

// `fields` points the message at the month field, like a validation failure does.
function monthTaken(month: string): DomainError {
  const message = diaryMonthTakenMessage(month);
  return new DomainError(409, "month_taken", message, { fields: { month: message } });
}

export function createDiaryService({ prisma }: DiaryServiceDeps): DiaryService {
  const diary = createDiaryRepository(prisma);

  async function requireCompany(companyId: string): Promise<void> {
    if (!(await diary.companyExists(companyId))) {
      throw companyNotFound();
    }
  }

  async function currentView(companyId: string): Promise<DiaryView> {
    return buildDiaryView(await diary.findByCompany(companyId));
  }

  return {
    async list(companyId) {
      await requireCompany(companyId);
      return currentView(companyId);
    },

    async create(companyId, { month, ...values }) {
      await requireCompany(companyId);
      // No read before the write: the unique (company, month) pair decides, so parallel calls cannot both note the month.
      if ((await diary.create(companyId, month, values)) === null) {
        throw monthTaken(month);
      }
      return currentView(companyId);
    },

    async update(companyId, month, input) {
      await requireCompany(companyId);
      if ((await diary.update(companyId, month, input)) === null) {
        throw monthNotFound();
      }
      return currentView(companyId);
    },

    async remove(companyId, month) {
      await requireCompany(companyId);
      if (!(await diary.remove(companyId, month))) {
        throw monthNotFound();
      }
      return currentView(companyId);
    },
  };
}
