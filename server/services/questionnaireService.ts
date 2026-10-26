import { rm } from "node:fs/promises";
import path from "node:path";
import { FileWriteError, MAX_FILE_STEM_LENGTH, saveFile } from "../files/downloadsFolder.ts";
import type { Prisma, PrismaClient } from "../generated/prisma/client.ts";
import {
  answersFileName,
  buildClientMessage,
  buildQuestionnaireFile,
  type QuestionnaireBrand,
} from "../questionnaire/questionnaireFile.ts";
import { createCompanyRepository } from "../repositories/companyRepository.ts";
import { createDiagnosisRepository } from "../repositories/diagnosisRepository.ts";
import { createQuestionnaireRepository, markSendsAnswered } from "../repositories/questionnaireRepository.ts";
import {
  ANSWERS_FILE_MAX_BYTES,
  ANSWERS_INCOMPATIBLE_MESSAGE,
  ANSWERS_INVALID_MESSAGE,
  ANSWERS_NEWER_VERSION_MESSAGE,
  ANSWERS_TOO_LARGE_MESSAGE,
  answersOtherCompanyMessage,
  readAnswersFile,
  readAnswersPayload,
  type ImportAnswersInput,
} from "../validation/questionnaireSchemas.ts";
import { createBrandService, type BrandIdentity } from "./brandService.ts";
import { DomainError } from "./domainError.ts";

/** Shape of IF-011 for `POST /api/companies/:id/questionnaire`. */
export interface QuestionnaireSendResult {
  /** Id of the record of the file: what "Mostrar na pasta" sends (IF-002). */
  fileId: string;
  fileName: string;
  directory: string;
  /** ISO time of the save. */
  sentAt: string;
  /** The approved message the consultant copies to the client. */
  message: string;
}

/** Shape of IF-011 for `POST /api/companies/:id/questionnaire-answers`. */
export interface ImportedAnswers {
  draftId: string;
  /** ISO time the client saved the answers, from the file. */
  clientSavedAt: string;
}

export interface QuestionnaireService {
  /** Saves the company's questionnaire file in the Downloads folder and registers that it now waits for answers. */
  send(companyId: string): Promise<QuestionnaireSendResult>;
  /**
   * Turns the client's answers file into the company's draft. Every refusal (RULE-ra-10) leaves the data as
   * it was; a draft already there is only replaced when the caller says so.
   */
  importAnswers(companyId: string, input: ImportAnswersInput): Promise<ImportedAnswers>;
}

export interface QuestionnaireServiceDeps {
  prisma: PrismaClient;
  now: () => Date;
  /** Folder the questionnaire file is written to. */
  downloadsDir: string;
}

const HTML_EXTENSION = ".html";
// `-questionario-2026-10-23`: what the name keeps after the company part, so a long company name never cuts the date.
const NAME_SUFFIX_LENGTH = "-questionario-2026-10-23".length;

function companyNotFound(): DomainError {
  return new DomainError(404, "company_not_found", "Empresa não encontrada.");
}

function writeFailed(): DomainError {
  return new DomainError(
    500,
    "write_failed",
    "Não foi possível salvar o questionário na pasta Downloads. Nada foi alterado. Confira se há espaço no disco e tente de novo.",
  );
}

/** The saved brand as the file takes it: the logo turned into the data URL the page draws. */
function toQuestionnaireBrand({ name, phone, email, logo }: BrandIdentity): QuestionnaireBrand {
  return {
    name,
    phone,
    email,
    logoDataUrl: logo === null ? null : `data:${logo.mimeType};base64,${logo.bytes.toString("base64")}`,
  };
}

// The company part is ASCII (a slug), so cutting it never splits a character; the date at the end stays.
function toFileStem(fileName: string): string {
  const stem = fileName.slice(0, -HTML_EXTENSION.length);
  if (stem.length <= MAX_FILE_STEM_LENGTH) {
    return stem;
  }
  const head = stem.slice(0, MAX_FILE_STEM_LENGTH - NAME_SUFFIX_LENGTH).replace(/-+$/, "");
  return `${head}${stem.slice(-NAME_SUFFIX_LENGTH)}`;
}

export function createQuestionnaireService({ prisma, now, downloadsDir }: QuestionnaireServiceDeps): QuestionnaireService {
  const companies = createCompanyRepository(prisma);
  const diagnoses = createDiagnosisRepository(prisma);
  const sends = createQuestionnaireRepository(prisma);
  const brand = createBrandService({ prisma, now });

  return {
    async send(companyId) {
      const company = await companies.findById(companyId);
      if (company === null) {
        throw companyNotFound();
      }
      const identity = await brand.readIdentity();
      const sentAt = now();
      const file = buildQuestionnaireFile({
        company: { id: company.id, name: company.name },
        brand: toQuestionnaireBrand(identity),
        sentAt,
      });

      let saved;
      try {
        saved = await saveFile({
          directory: downloadsDir,
          stem: toFileStem(file.fileName),
          extension: HTML_EXTENSION,
          content: Buffer.from(file.html, "utf8"),
        });
      } catch (error) {
        if (error instanceof FileWriteError) {
          throw writeFailed();
        }
        throw error;
      }

      // Without the record the owner could neither open the folder nor see the company waiting, so the file
      // goes too and the save counts as failed: nothing is left behind.
      try {
        const { fileId } = await sends.recordSend({
          companyId: company.id,
          fileName: saved.fileName,
          directory: saved.directory,
          sentAt,
        });
        return {
          fileId,
          fileName: saved.fileName,
          directory: saved.directory,
          sentAt: sentAt.toISOString(),
          message: buildClientMessage(company.name, identity.name),
        };
      } catch (error) {
        console.error("[fitpulse] could not register the saved questionnaire:", error);
        await rm(path.join(saved.directory, saved.fileName), { force: true }).catch(() => undefined);
        throw writeFailed();
      }
    },

    async importAnswers(companyId, input) {
      const company = await companies.findById(companyId);
      if (company === null) {
        throw companyNotFound();
      }
      if (Buffer.byteLength(input.content, "utf8") > ANSWERS_FILE_MAX_BYTES) {
        throw new DomainError(413, "payload_too_large", ANSWERS_TOO_LARGE_MESSAGE);
      }

      // Each way a file can be wrong has its own answer, checked from the most basic to the most specific.
      const reading = readAnswersFile(input.content);
      if (reading.status === "invalid") {
        throw new DomainError(422, "answers_invalid", ANSWERS_INVALID_MESSAGE);
      }
      if (reading.status === "newer_version") {
        throw new DomainError(422, "answers_newer_version", ANSWERS_NEWER_VERSION_MESSAGE);
      }
      const { file } = reading;
      if (file.company.id !== company.id) {
        throw new DomainError(422, "answers_other_company", answersOtherCompanyMessage(file.company.name, company.name), {
          fileCompanyName: file.company.name,
          currentCompanyName: company.name,
        });
      }
      const payload = readAnswersPayload(file);
      if (payload === null) {
        throw new DomainError(422, "answers_incompatible", ANSWERS_INCOMPATIBLE_MESSAGE);
      }

      // A client clock set ahead must not date the answers in the future.
      const importedAt = now();
      const clientSavedAt = file.savedAt.getTime() > importedAt.getTime() ? importedAt : file.savedAt;
      const outcome = await diagnoses.importDraft(
        company.id,
        {
          answers: { ...payload.answers } satisfies Prisma.InputJsonObject,
          calculator: payload.calculator as unknown as Prisma.InputJsonObject,
        },
        {
          replace: input.replaceDraft === true,
          afterCreate: (tx, draft) =>
            markSendsAnswered(tx, {
              companyId: company.id,
              draftId: draft.id,
              answeredAt: importedAt,
              clientSavedAt,
              fallbackFileName: answersFileName(company.name),
            }),
        },
      );

      switch (outcome.status) {
        case "company_not_found":
          throw companyNotFound();
        case "draft_exists":
          throw new DomainError(
            409,
            "draft_exists",
            "Esta empresa já tem um diagnóstico em andamento. Confirme para trocá-lo pelas respostas do arquivo.",
            { draftCreatedAt: outcome.draftCreatedAt.toISOString() },
          );
        case "imported":
          return { draftId: outcome.record.id, clientSavedAt: clientSavedAt.toISOString() };
      }
    },
  };
}
