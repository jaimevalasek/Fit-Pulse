import { rm } from "node:fs/promises";
import path from "node:path";
import { ACTION_OWNER_ROLE_LABELS } from "../../shared/content/actionProgressOptions.ts";
import { DEFAULT_ACTION_STATUS, isActionOverdue, type ActionStatus } from "../../shared/domain/actionProgress.ts";
import { getCostDiaryOrigin } from "../../shared/domain/diaryPrefill.ts";
import {
  EMPTY_CALCULATOR,
  type ActionKey,
  type CalculatorInput,
  type DiagnosisInput,
  type DiagnosisResult,
  type Rules,
} from "../../shared/domain/types.ts";
import { isoToDateInput, localIsoDate } from "../../shared/format/dates.ts";
import type { ReportDocument } from "../../shared/report/reportDocument.ts";
import { rulesV1 } from "../../shared/rules/rulesV1.ts";
import { FileWriteError, MAX_FILE_STEM_LENGTH, sanitizeFileStem, saveFile, type SavedFile } from "../files/downloadsFolder.ts";
import type { PrismaClient } from "../generated/prisma/client.ts";
import type { ReportBrandInput } from "../report/documentParts.ts";
import { buildEvolutionDocument, buildPeriodDiary } from "../report/evolutionDocument.ts";
import { buildPortfolioDocument } from "../report/portfolioDocument.ts";
import {
  buildDiagnosisDocument,
  formatFileDate,
  type ReportActionProgress,
  type ReportActionStatus,
} from "../report/reportModel.ts";
import { renderReportPdf } from "../report/pdfRenderer.ts";
import { createActionProgressRepository, type ActionProgressRecord } from "../repositories/actionProgressRepository.ts";
import { createCompanyRepository } from "../repositories/companyRepository.ts";
import { createDiagnosisRepository } from "../repositories/diagnosisRepository.ts";
import { createDiaryRepository } from "../repositories/diaryRepository.ts";
import { createGeneratedFileRepository, type GeneratedFileKind } from "../repositories/generatedFileRepository.ts";
import { readStoredAnswers, readStoredCalculator } from "../validation/diagnosisSchemas.ts";
import type { ReportSelection } from "../validation/reportSchemas.ts";
import { createBrandService, type BrandIdentity } from "./brandService.ts";
import { DomainError } from "./domainError.ts";
import { createHistoryService } from "./historyService.ts";
import { createPortfolioService } from "./portfolioService.ts";

/** Shape of IF-001 for `POST /api/reports/export` and of IF-006 for `POST /api/diagnoses/:id/report`. */
export interface ReportFile extends SavedFile {
  /** Id of the record of the file: what "Abrir PDF" and "Mostrar na pasta" send (IF-002). */
  fileId: string;
}

/** The portfolio report takes no option: it is every active company, as of today. */
export interface PortfolioSelection {
  kind: "portfolio";
}

/** What the service builds a report from: the selection of the owner's report center and the portfolio. */
export type ReportRequest = ReportSelection | PortfolioSelection;

export interface ReportService {
  /** The pages of the report as data, with nothing drawn and nothing saved. */
  preview(selection: ReportRequest): Promise<ReportDocument>;
  /** Draws the same pages into a PDF, saves it in the Downloads folder and registers it. Changes nothing else. */
  export(selection: ReportRequest): Promise<ReportFile>;
}

export interface ReportServiceDeps {
  prisma: PrismaClient;
  /** Folder the PDF is written to. */
  downloadsDir: string;
  /** The app clock: the day of the credit line on the cover and the moment of the save. */
  now?: () => Date;
  /** The rules in force: the evolution recalculates an earlier diagnosis from other rules with them (RULE-ra-02). */
  rules?: Rules;
}

// What both the preview and the export need from a selection: the document, whose file it is and its name.
interface PreparedReport {
  document: ReportDocument;
  /** Company the file belongs to, for the record of the saved file. */
  companyId: string | null;
  fileKind: GeneratedFileKind;
  /** Name without extension, as the owner will see it in the folder. */
  fileStem: string;
}

// `-` plus `2026-10-23`: what the name keeps after the company part, so a long company name never cuts the date.
const DATE_SUFFIX_LENGTH = "-2026-10-23".length;
// `-evolucao-2026-03-12-a-2026-10-23`: the same for the evolution, which carries both dates.
const EVOLUTION_SUFFIX_LENGTH = "-evolucao-2026-03-12-a-2026-10-23".length;

const REPORT_STATUS: Record<ActionStatus, ReportActionStatus> = {
  todo: "todo",
  in_progress: "doing",
  done: "done",
  not_applicable: "notApplicable",
};

function diagnosisNotFound(): DomainError {
  return new DomainError(404, "diagnosis_not_found", "Diagnóstico não encontrado.");
}

function companyNotFound(): DomainError {
  return new DomainError(404, "company_not_found", "Empresa não encontrada.");
}

function diagnosisNotCompleted(): DomainError {
  return new DomainError(409, "diagnosis_not_completed", "Só um diagnóstico concluído pode virar relatório em PDF.");
}

/** The saved brand as the documents take it: the logo turned into the data URL the cover and the preview draw. */
function toReportBrand({ name, phone, email, website, logo }: BrandIdentity): ReportBrandInput {
  return {
    name,
    phone,
    email,
    site: website,
    logoDataUrl: logo === null ? null : `data:${logo.mimeType};base64,${logo.bytes.toString("base64")}`,
  };
}

/** Whether the owner recorded anything on the action: a state other than "A fazer", a deadline, an owner or a note. */
function isTracked(record: ActionProgressRecord): boolean {
  return (
    record.status !== DEFAULT_ACTION_STATUS || record.dueDate !== null || record.ownerRole !== null || record.note !== null
  );
}

/**
 * The actions of a plan with what the owner recorded, in plan order, for "Andamento das ações" and for
 * "O que foi feito no período". Empty when nothing was recorded on any of them: an untouched plan has
 * nothing to tell. When the owner recorded something, every action of the plan is listed, the untouched
 * ones as "A fazer". `today` is the local day, or `null` for a plan that is closed: only the current
 * plan has overdue actions (RULE-ra-06), so the report agrees with the "Ações" tab.
 */
function toTrackedActions(
  plan: readonly ActionKey[],
  records: readonly ActionProgressRecord[],
  today: string | null,
): ReportActionProgress[] {
  if (!records.some(isTracked)) {
    return [];
  }
  return plan.map((actionKey): ReportActionProgress => {
    const record = records.find((candidate) => candidate.actionKey === actionKey);
    const status = record?.status ?? DEFAULT_ACTION_STATUS;
    const dueDate = record?.dueDate ?? null;
    return {
      actionKey,
      status: REPORT_STATUS[status],
      dueDate: dueDate === null ? null : isoToDateInput(dueDate) || null,
      owner: record?.ownerRole ? ACTION_OWNER_ROLE_LABELS[record.ownerRole] : null,
      note: record?.note ?? null,
      overdue: isActionOverdue({ status, dueDate }, today),
    };
  });
}

function portfolioEmpty(): DomainError {
  return new DomainError(
    409,
    "portfolio_empty",
    "Não há empresas ativas para o relatório da carteira. Cadastre a primeira empresa para gerá-lo.",
  );
}

function writeFailed(): DomainError {
  return new DomainError(
    500,
    "write_failed",
    "Não foi possível salvar o PDF na pasta Downloads. Nada foi alterado. Confira se há espaço no disco e tente de novo.",
  );
}

export function createReportService({
  prisma,
  downloadsDir,
  now = () => new Date(),
  rules = rulesV1,
}: ReportServiceDeps): ReportService {
  const diagnoses = createDiagnosisRepository(prisma);
  const companies = createCompanyRepository(prisma);
  const files = createGeneratedFileRepository(prisma);
  const actionProgress = createActionProgressRepository(prisma);
  const diaries = createDiaryRepository(prisma);
  const history = createHistoryService({ prisma, now, rules });
  const brand = createBrandService({ prisma, now });
  const portfolios = createPortfolioService({ prisma, now });

  /** Who delivers the report, read once per document and only after the selection proved valid. All blank is FitPulse. */
  async function readBrand(): Promise<ReportBrandInput> {
    return toReportBrand(await brand.readIdentity());
  }

  // The current plan is the newest completed, non-archived diagnosis of the company (RULE-ra-06).
  async function isCurrentPlan(diagnosis: { id: string; companyId: string; archivedAt: Date | null }): Promise<boolean> {
    if (diagnosis.archivedAt !== null) {
      return false;
    }
    const [newest] = await diagnoses.listCompleted(diagnosis.companyId);
    return newest?.id === diagnosis.id;
  }

  async function prepareDiagnosis(selection: Extract<ReportSelection, { kind: "diagnosis" }>): Promise<PreparedReport> {
    const diagnosis = await diagnoses.findById(selection.diagnosisId);
    if (diagnosis === null) {
      throw diagnosisNotFound();
    }
    if (diagnosis.status !== "completed") {
      throw diagnosisNotCompleted();
    }
    const company = await companies.findById(diagnosis.companyId);
    if (company === null) {
      throw companyNotFound();
    }
    // A completed diagnosis is always written together with its result (see `completeDraft`).
    if (diagnosis.result === null || diagnosis.completedAt === null) {
      throw new Error(`Completed diagnosis ${diagnosis.id} has no stored result.`);
    }

    const calculator = { ...EMPTY_CALCULATOR, ...readStoredCalculator(diagnosis.calculator) } as CalculatorInput;
    // The typed answers go into the file only when the owner asked for them (BR-ra-08); of the calculator,
    // "Seus números" only takes the origin of the cost per customer, never what was typed.
    const diagnosisInput: DiagnosisInput | null = selection.includeAnswers
      ? { answers: readStoredAnswers(diagnosis.answers), calculator }
      : null;

    const result = diagnosis.result as unknown as DiagnosisResult;
    const generatedAt = now();
    // The plan that was tracked is the one stored with the diagnosis. A plan replaced by a newer
    // diagnosis, or an archived one, is told as it ended: nothing in it is overdue any more.
    const trackedActions = toTrackedActions(
      result.plan,
      await actionProgress.findByDiagnosis(diagnosis.id),
      (await isCurrentPlan(diagnosis)) ? localIsoDate(generatedAt) : null,
    );

    return {
      document: buildDiagnosisDocument({
        companyName: company.name,
        completedAt: diagnosis.completedAt,
        result,
        generatedAt,
        actionProgress: trackedActions,
        includeAnswers: selection.includeAnswers,
        diagnosisInput,
        costDiaryOrigin: getCostDiaryOrigin(calculator),
        brand: await readBrand(),
      }),
      companyId: company.id,
      fileKind: "diagnosis_pdf",
      fileStem: `${sanitizeFileStem(company.name, MAX_FILE_STEM_LENGTH - DATE_SUFFIX_LENGTH)}-${formatFileDate(diagnosis.completedAt)}`,
    };
  }

  async function prepareEvolution(selection: Extract<ReportSelection, { kind: "evolution" }>): Promise<PreparedReport> {
    // The history service refuses a pair from two companies, an archived one or one out of order.
    const pair = await history.comparePair(selection.fromId, selection.toId);
    const company = await companies.findById(pair.companyId);
    if (company === null) {
      throw companyNotFound();
    }
    const generatedAt = now();
    // The plan that was tracked is the one stored with the earlier diagnosis, not the recalculated one.
    // The later diagnosis of the pair closed that plan, so none of its actions is overdue any more.
    const actions = toTrackedActions(pair.previous.storedResult.plan, await actionProgress.findByDiagnosis(pair.previous.id), null);
    const diary = buildPeriodDiary(await diaries.findByCompany(company.id), pair.previous.completedAt, pair.current.completedAt);

    return {
      document: buildEvolutionDocument({
        companyName: company.name,
        comparison: pair.comparison,
        previousResult: pair.previous.comparedResult,
        currentResult: pair.current.comparedResult,
        generatedAt,
        brand: await readBrand(),
        period: { actions, diary },
      }),
      companyId: company.id,
      fileKind: "evolution_pdf",
      fileStem:
        `${sanitizeFileStem(company.name, MAX_FILE_STEM_LENGTH - EVOLUTION_SUFFIX_LENGTH)}-evolucao-` +
        `${formatFileDate(pair.previous.completedAt)}-a-${formatFileDate(pair.current.completedAt)}`,
    };
  }

  async function preparePortfolio(): Promise<PreparedReport> {
    // One reading of the clock: the days counted in the lists and the date of the cover are the same day.
    const generatedAt = now();
    const portfolio = await portfolios.read(generatedAt);
    if (portfolio.view.companyCount === 0) {
      throw portfolioEmpty();
    }
    return {
      document: buildPortfolioDocument({ portfolio, generatedAt, brand: await readBrand() }),
      companyId: null,
      fileKind: "portfolio_pdf",
      fileStem: `carteira-${formatFileDate(generatedAt)}`,
    };
  }

  function prepare(selection: ReportRequest): Promise<PreparedReport> {
    switch (selection.kind) {
      case "diagnosis":
        return prepareDiagnosis(selection);
      case "evolution":
        return prepareEvolution(selection);
      case "portfolio":
        return preparePortfolio();
    }
  }

  return {
    async preview(selection) {
      return (await prepare(selection)).document;
    },

    async export(selection) {
      const { document, companyId, fileKind, fileStem } = await prepare(selection);
      const pdf = await renderReportPdf(document);

      let saved: SavedFile;
      try {
        saved = await saveFile({ directory: downloadsDir, stem: fileStem, extension: ".pdf", content: pdf });
      } catch (error) {
        if (error instanceof FileWriteError) {
          throw writeFailed();
        }
        throw error;
      }

      // The record is what lets "Abrir PDF" find the file later. Without it the owner could not
      // open what was saved, so the file goes too and the save counts as failed: nothing is left behind.
      try {
        const record = await files.insert({
          companyId,
          kind: fileKind,
          fileName: saved.fileName,
          directory: saved.directory,
          createdAt: now(),
        });
        return { fileId: record.id, fileName: saved.fileName, directory: saved.directory };
      } catch (error) {
        console.error("[fitpulse] could not register the saved report:", error);
        await rm(path.join(saved.directory, saved.fileName), { force: true }).catch(() => undefined);
        throw writeFailed();
      }
    },
  };
}
