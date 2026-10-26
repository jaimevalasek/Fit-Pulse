import { z } from "zod";
import type { Answers } from "../../shared/domain/types.ts";
import { ANSWERS_FILE_FORMAT, ANSWERS_FILE_FORMAT_VERSION, QUESTIONNAIRE_VERSION } from "../questionnaire/questionnaireFile.ts";
import { diagnosisPatchSchema, type CalculatorPatch } from "./diagnosisSchemas.ts";

/** The answers file the client saves is a few KB; past 1 MB it cannot be one (RULE-ra-10). */
export const ANSWERS_FILE_MAX_BYTES = 1024 * 1024;
/** `POST /api/companies/:id/questionnaire-answers` carries the file as JSON text: quotes and line breaks double its size. */
export const ANSWERS_BODY_LIMIT = "2mb";

export const ANSWERS_INVALID_MESSAGE = "Este arquivo não é um arquivo de respostas do FitPulse.";
export const ANSWERS_NEWER_VERSION_MESSAGE =
  "Este arquivo foi feito por uma versão mais nova do FitPulse. Atualize o app pelo Play e importe de novo.";
export const ANSWERS_INCOMPATIBLE_MESSAGE =
  "Este arquivo foi feito para outra versão do questionário e não pode ser importado. Peça ao cliente para responder de novo com um questionário gerado por este app.";
export const ANSWERS_TOO_LARGE_MESSAGE = "Este arquivo é grande demais para ser um arquivo de respostas do FitPulse (o limite é 1 MB).";

export function answersOtherCompanyMessage(fileCompanyName: string, currentCompanyName: string): string {
  return `Este arquivo é de ${fileCompanyName}, não de ${currentCompanyName}.`;
}

const MAX_ID_LENGTH = 64;
const MAX_COMPANY_NAME_LENGTH = 200;

/**
 * `POST /api/companies/:id/questionnaire-answers`: the text of the file the client sent back and, once the
 * consultant confirmed it, the wish to replace the company's open draft. The text is judged by the service,
 * so each way a file can be wrong gets its own answer instead of a generic validation failure.
 */
export const importAnswersSchema = z.strictObject(
  {
    content: z.string({ error: "Escolha o arquivo de respostas." }),
    replaceDraft: z.boolean({ error: "Confirme se deve substituir o rascunho." }).optional(),
  },
  { error: "Envie o arquivo de respostas." },
);

export type ImportAnswersInput = z.infer<typeof importAnswersSchema>;

// The marker and the versions come first and alone: a file from a newer release may shape the rest differently.
const headerSchema = z.object({
  format: z.literal(ANSWERS_FILE_FORMAT),
  formatVersion: z.number().int().min(1),
  questionnaireVersion: z.number().int().min(1),
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const bodySchema = z.object({
  company: z.object({
    id: z.string().min(1).max(MAX_ID_LENGTH),
    name: z.string().trim().min(1).max(MAX_COMPANY_NAME_LENGTH),
  }),
  savedAt: z.iso.datetime({ offset: true }),
  answers: z.custom<Record<string, unknown>>(isPlainObject),
  calculator: z.custom<Record<string, unknown>>(isPlainObject),
});

/** What the client's file says before its answers are judged. */
export interface AnswersFile {
  questionnaireVersion: number;
  company: { id: string; name: string };
  /** The moment the client saved, from the client's clock. */
  savedAt: Date;
  answers: Record<string, unknown>;
  calculator: Record<string, unknown>;
}

export type AnswersFileReading =
  | { status: "invalid" }
  | { status: "newer_version" }
  | { status: "readable"; file: AnswersFile };

/** The answers and numbers of a file, shaped as a diagnosis PATCH takes them. */
export interface AnswersPayload {
  answers: Answers;
  calculator: CalculatorPatch;
}

/** Reads the text of a `.fitpulse` file (IF-004). Nothing here knows which company is importing. */
export function readAnswersFile(content: string): AnswersFileReading {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.replace(/^﻿/, ""));
  } catch {
    return { status: "invalid" };
  }
  const header = headerSchema.safeParse(parsed);
  if (!header.success) {
    return { status: "invalid" };
  }
  if (header.data.formatVersion > ANSWERS_FILE_FORMAT_VERSION || header.data.questionnaireVersion > QUESTIONNAIRE_VERSION) {
    return { status: "newer_version" };
  }
  const body = bodySchema.safeParse(parsed);
  if (!body.success) {
    return { status: "invalid" };
  }
  return {
    status: "readable",
    file: {
      questionnaireVersion: header.data.questionnaireVersion,
      company: body.data.company,
      savedAt: new Date(body.data.savedAt),
      answers: body.data.answers,
      calculator: body.data.calculator,
    },
  };
}

/**
 * The answers and the calculator of a readable file, judged by the same schema the draft's PATCH uses, so a
 * question the catalog does not have or a value out of range is refused here too. `null` when the file
 * does not fit this questionnaire: nothing of it may become a draft.
 */
export function readAnswersPayload(file: AnswersFile): AnswersPayload | null {
  if (file.questionnaireVersion < QUESTIONNAIRE_VERSION) {
    return null;
  }
  const patch = diagnosisPatchSchema.safeParse({ answers: file.answers, calculator: file.calculator });
  if (!patch.success) {
    return null;
  }
  return { answers: patch.data.answers ?? {}, calculator: patch.data.calculator ?? {} };
}
