import { z } from "zod";
import { ACTION_NOTE_MAX_LENGTH, ACTION_OWNER_ROLES, ACTION_STATUSES } from "../../shared/domain/actionProgress.ts";
import { DIARY_MAX_NEW_CUSTOMERS, DIARY_MAX_SPEND_CENTS } from "../../shared/domain/diary.ts";
import { REEVALUATION_INTERVAL_OPTIONS } from "../../shared/domain/followUp.ts";
import { SPEND_PART_KEYS } from "../../shared/domain/types.ts";
import { isValidIsoDate, isValidIsoMonth } from "../../shared/format/dates.ts";
import { IMAGE_MIME_TYPES, readImageSignature } from "../files/imageSignature.ts";
import {
  BRAND_LOGO_MAX_BASE64_LENGTH,
  BRAND_LOGO_MAX_BYTES,
  BRAND_LOGO_MAX_SIDE,
  brandUpdateSchema,
} from "./brandSchemas.ts";
import { companyInputSchema } from "./companySchemas.ts";
import { diagnosisPatchSchema } from "./diagnosisSchemas.ts";

/** The mark every FitPulse backup carries; anything else is not one of ours. */
export const BACKUP_FORMAT = "fitpulse-backup";
/** Layout of the file itself. Raised when the keys below change; 1 is the file of the first release. */
export const BACKUP_FORMAT_VERSION = 2;
/** Version of the database tables the records come from (`compatibility.schema_version`). */
export const BACKUP_SCHEMA_VERSION = 2;
/** Largest import body, in bytes. The rest of the API stays at 1 MB. */
export const BACKUP_MAX_BYTES = 10 * 1024 * 1024;

const MAX_STAGE = 4;
// The note and the file name are the only free texts of the new records; the caps keep a damaged file from filling the disk.
const FILE_NAME_MAX_LENGTH = 255;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const PATH_SEPARATORS = /[\\/]/;
const BASE64_SHAPE = /^[A-Za-z0-9+/]*={0,2}$/;

const versionNumber = z.number().int().min(1);

// 8-4-4-4-12 hexadecimal digits: the shape of the ids the database generates.
const recordId = z.guid();

// ISO 8601 in UTC, as `Date.toISOString` writes it; read back into a Date.
const timestamp = z.iso
  .datetime()
  .transform((value) => new Date(value))
  .refine((value) => !Number.isNaN(value.getTime()));

const jsonObject = z.looseObject({});

/**
 * The frozen result as the engine wrote it. Its inner content is kept untouched, but the
 * keys the history, the home and the report read are required so a damaged file cannot
 * reach them.
 */
const storedResultSchema = z.looseObject({
  rulesVersion: versionNumber,
  stage: z.number().int().min(1).max(MAX_STAGE),
  lock: z.string().nullable(),
  dimensions: z.record(z.string(), jsonObject),
  weakestDimension: z.string(),
  unitEconomics: jsonObject,
  risks: z.array(z.unknown()),
  confidence: jsonObject,
  plan: z.array(z.string()),
});

// Same fields and limits as the company form (`companyInputSchema`), plus the ones the database owns.
const companyBackupSchema = z.strictObject({
  id: recordId,
  ...companyInputSchema.shape,
  archivedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

// Answers, calculator and block go through the schemas of the diagnosis PATCH, so a backup can
// hold nothing the screens could not have saved.
const diagnosisBackupSchema = z
  .strictObject({
    id: recordId,
    companyId: recordId,
    status: z.enum(["draft", "completed"]),
    archivedAt: timestamp.nullable(),
    answers: diagnosisPatchSchema.shape.answers.unwrap(),
    calculator: diagnosisPatchSchema.shape.calculator.unwrap(),
    currentBlock: diagnosisPatchSchema.shape.currentBlock.unwrap(),
    rulesVersion: versionNumber.nullable(),
    result: storedResultSchema.nullable(),
    stage: z.number().int().min(1).max(MAX_STAGE).nullable(),
    completedAt: timestamp.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .superRefine((diagnosis, ctx) => {
    // A completed diagnosis is always written together with its result (see `completeDraft`);
    // a draft never has one.
    const isCompleted = diagnosis.status === "completed";
    const frozen = [diagnosis.result, diagnosis.stage, diagnosis.rulesVersion, diagnosis.completedAt];
    if (frozen.some((value) => (value !== null) !== isCompleted)) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: isCompleted ? "Diagnóstico concluído sem resultado." : "Rascunho com resultado.",
      });
      return;
    }
    if (diagnosis.result !== null && (diagnosis.result.stage !== diagnosis.stage || diagnosis.result.rulesVersion !== diagnosis.rulesVersion)) {
      ctx.addIssue({ code: "custom", path: ["result"], message: "O resultado não combina com o estágio ou com as regras." });
    }
  });

// What the owner tracks about one of the 3 actions of a completed diagnosis (`action_progress`).
const actionProgressBackupSchema = z.strictObject({
  id: recordId,
  diagnosisId: recordId,
  actionKey: z.string().min(1).max(32),
  status: z.enum(ACTION_STATUSES),
  dueDate: z
    .string()
    .refine((value) => isValidIsoDate(value))
    .nullable(),
  ownerRole: z.enum(ACTION_OWNER_ROLES).nullable(),
  note: z.string().max(ACTION_NOTE_MAX_LENGTH).nullable(),
  inheritedFromId: recordId.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const cents = z.number().int().min(0).max(DIARY_MAX_SPEND_CENTS);

// One noted month (`diary_entries`): the spend is the parts or the single total, never both and never neither.
const diaryEntryBackupSchema = z
  .strictObject({
    id: recordId,
    companyId: recordId,
    month: z.string().refine((value) => isValidIsoMonth(value)),
    newCustomers: z.number().int().min(0).max(DIARY_MAX_NEW_CUSTOMERS),
    spendParts: z.partialRecord(z.enum(SPEND_PART_KEYS), cents).nullable(),
    spendTotalCents: cents.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .superRefine((entry, ctx) => {
    const hasParts = entry.spendParts !== null && Object.keys(entry.spendParts).length > 0;
    const hasTotal = entry.spendTotalCents !== null;
    if (hasParts === hasTotal) {
      ctx.addIssue({ code: "custom", path: ["spendParts"], message: "O gasto é as partes ou só o total." });
    }
  });

// One questionnaire file the consultant saved (`questionnaire_sends`). `draftId` has no foreign key on purpose.
const questionnaireSendBackupSchema = z.strictObject({
  id: recordId,
  companyId: recordId,
  fileName: z
    .string()
    .min(1)
    .max(FILE_NAME_MAX_LENGTH)
    .refine((value) => !CONTROL_CHARACTERS.test(value) && !PATH_SEPARATORS.test(value)),
  sentAt: timestamp,
  answeredAt: timestamp.nullable(),
  clientSavedAt: timestamp.nullable(),
  draftId: recordId.nullable(),
});

// The logo as the brand stores it: base64 text of a PNG or JPEG within the limits `PUT /api/brand/logo` enforces.
const brandLogoBackupSchema = z
  .strictObject({
    mimeType: z.enum(IMAGE_MIME_TYPES),
    dataBase64: z.string().min(1).max(BRAND_LOGO_MAX_BASE64_LENGTH),
    updatedAt: z.iso.datetime(),
  })
  .refine((logo) => {
    // Checked before decoding, so a malformed text is never turned into bytes.
    if (logo.dataBase64.length % 4 !== 0 || !BASE64_SHAPE.test(logo.dataBase64)) {
      return false;
    }
    const bytes = Buffer.from(logo.dataBase64, "base64");
    const signature = bytes.length <= BRAND_LOGO_MAX_BYTES ? readImageSignature(bytes) : null;
    return signature !== null && signature.mimeType === logo.mimeType && Math.max(signature.width, signature.height) <= BRAND_LOGO_MAX_SIDE;
  }, "A logo não é uma imagem PNG ou JPG válida.");

// The texts go through the schema of `PUT /api/brand`, so the file holds only what the screen could have saved.
const brandBackupSchema = z
  .strictObject({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    website: z.string().nullable(),
    logo: brandLogoBackupSchema.nullable(),
  })
  .transform((brand, ctx) => {
    const { logo, ...texts } = brand;
    const checked = brandUpdateSchema.safeParse(texts);
    if (!checked.success) {
      ctx.addIssue({ code: "custom", message: "Os dados da marca são inválidos." });
      return z.NEVER;
    }
    return {
      name: checked.data.name ?? null,
      phone: checked.data.phone ?? null,
      email: checked.data.email ?? null,
      website: checked.data.website ?? null,
      logo,
    };
  });

function findDuplicate(ids: string[]): number {
  const seen = new Set<string>();
  return ids.findIndex((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

interface Issues {
  addIssue(issue: { code: "custom"; path: Array<string | number>; message: string }): void;
}

function reportDuplicates(ids: string[], path: string, message: string, ctx: Issues): void {
  const duplicate = findDuplicate(ids);
  if (duplicate >= 0) {
    ctx.addIssue({ code: "custom", path: [path, duplicate, "id"], message });
  }
}

type BackupBase = { companies: Array<{ id: string }>; diagnoses: Array<{ id: string; companyId: string }> };

// Unique ids, and every diagnosis owned by a company of the same file.
function checkCompaniesAndDiagnoses(backup: BackupBase, ctx: Issues): void {
  reportDuplicates(backup.companies.map((company) => company.id), "companies", "Empresa repetida.", ctx);
  reportDuplicates(backup.diagnoses.map((diagnosis) => diagnosis.id), "diagnoses", "Diagnóstico repetido.", ctx);
  const companyIds = new Set(backup.companies.map((company) => company.id));
  backup.diagnoses.forEach((diagnosis, index) => {
    if (!companyIds.has(diagnosis.companyId)) {
      ctx.addIssue({ code: "custom", path: ["diagnoses", index, "companyId"], message: "Empresa não encontrada no arquivo." });
    }
  });
}

const baseShape = {
  format: z.literal(BACKUP_FORMAT),
  formatVersion: versionNumber,
  schemaVersion: versionNumber,
  /** Version of the rules the app that exported the file was running. */
  rulesVersion: versionNumber,
  exportedAt: timestamp,
  companies: z.array(companyBackupSchema),
  diagnoses: z.array(diagnosisBackupSchema),
};

/**
 * The file of the first release (`formatVersion` 1): companies and diagnoses only. Still read, and
 * still strict: a key it does not know is a sign the file came from somewhere else.
 */
export const backupFileV1Schema = z.strictObject(baseShape).superRefine(checkCompaniesAndDiagnoses);

/**
 * The whole file. Strict on purpose, and it must stand on its own: unique ids, every record owned by
 * a company or a diagnosis of the same file, and an action only on a completed diagnosis that plans it.
 * `generated_files` is not here: each row holds a path of the computer that wrote it.
 */
export const backupFileSchema = z
  .strictObject({
    ...baseShape,
    actionProgress: z.array(actionProgressBackupSchema),
    diaryEntries: z.array(diaryEntryBackupSchema),
    questionnaireSends: z.array(questionnaireSendBackupSchema),
    /** `null` when the installation never set a brand (the reports carry the FitPulse one). */
    brand: brandBackupSchema.nullable(),
    /** Days between diagnoses; `null` when the installation never chose one. */
    reevaluationIntervalDays: z.literal([...REEVALUATION_INTERVAL_OPTIONS]).nullable(),
  })
  .superRefine((backup, ctx) => {
    checkCompaniesAndDiagnoses(backup, ctx);
    reportDuplicates(backup.actionProgress.map((action) => action.id), "actionProgress", "Ação repetida.", ctx);
    reportDuplicates(backup.diaryEntries.map((entry) => entry.id), "diaryEntries", "Mês do diário repetido.", ctx);
    reportDuplicates(backup.questionnaireSends.map((send) => send.id), "questionnaireSends", "Questionário repetido.", ctx);

    const diagnosesById = new Map(backup.diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]));
    const seenActions = new Set<string>();
    backup.actionProgress.forEach((action, index) => {
      const owner = diagnosesById.get(action.diagnosisId);
      const fail = (field: string, message: string) => ctx.addIssue({ code: "custom", path: ["actionProgress", index, field], message });
      if (owner === undefined) {
        fail("diagnosisId", "Diagnóstico não encontrado no arquivo.");
      } else if (owner.status !== "completed" || !owner.result?.plan.includes(action.actionKey)) {
        fail("actionKey", "Essa ação não faz parte do plano do diagnóstico.");
      }
      if (action.inheritedFromId !== null && !diagnosesById.has(action.inheritedFromId)) {
        fail("inheritedFromId", "Diagnóstico de origem não encontrado no arquivo.");
      }
      const slot = `${action.diagnosisId}/${action.actionKey}`;
      if (seenActions.has(slot)) {
        fail("actionKey", "Ação repetida no mesmo diagnóstico.");
      }
      seenActions.add(slot);
    });

    const companyIds = new Set(backup.companies.map((company) => company.id));
    const seenMonths = new Set<string>();
    backup.diaryEntries.forEach((entry, index) => {
      if (!companyIds.has(entry.companyId)) {
        ctx.addIssue({ code: "custom", path: ["diaryEntries", index, "companyId"], message: "Empresa não encontrada no arquivo." });
      }
      const slot = `${entry.companyId}/${entry.month}`;
      if (seenMonths.has(slot)) {
        ctx.addIssue({ code: "custom", path: ["diaryEntries", index, "month"], message: "Mês repetido na mesma empresa." });
      }
      seenMonths.add(slot);
    });
    backup.questionnaireSends.forEach((send, index) => {
      if (!companyIds.has(send.companyId)) {
        ctx.addIssue({ code: "custom", path: ["questionnaireSends", index, "companyId"], message: "Empresa não encontrada no arquivo." });
      }
    });
  });

export type BackupFile = z.output<typeof backupFileSchema>;
export type BackupCompany = BackupFile["companies"][number];
export type BackupDiagnosis = BackupFile["diagnoses"][number];
export type BackupActionProgress = BackupFile["actionProgress"][number];
export type BackupDiaryEntry = BackupFile["diaryEntries"][number];
export type BackupQuestionnaireSend = BackupFile["questionnaireSends"][number];
export type BackupBrand = NonNullable<BackupFile["brand"]>;

/**
 * Reads the file by its layout: the first release's file goes through the old schema and comes out
 * as a current one with nothing in the new records; the current one goes through the strict schema.
 * `null` when it does not pass.
 */
export function parseBackupFile(raw: unknown, formatVersion: number): BackupFile | null {
  if (formatVersion === 1) {
    const legacy = backupFileV1Schema.safeParse(raw);
    return legacy.success
      ? { ...legacy.data, actionProgress: [], diaryEntries: [], questionnaireSends: [], brand: null, reevaluationIntervalDays: null }
      : null;
  }
  const parsed = backupFileSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Just the mark and the versions. It is read before the full schema so that a file from a
 * newer app, whose records may have another layout, is answered with "update the app" and not
 * with "invalid file".
 */
export const backupEnvelopeSchema = z.looseObject({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: versionNumber,
  schemaVersion: versionNumber,
  rulesVersion: versionNumber,
});
