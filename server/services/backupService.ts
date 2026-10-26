import { normalizeActionProgress } from "../../shared/domain/actionProgress.ts";
import { REEVALUATION_INTERVAL_OPTIONS } from "../../shared/domain/followUp.ts";
import { SPEND_PART_KEYS } from "../../shared/domain/types.ts";
import { isCents } from "../../shared/domain/unitEconomics.ts";
import { FileWriteError, saveFile, type SavedFile } from "../files/downloadsFolder.ts";
import { IMAGE_MIME_TYPES } from "../files/imageSignature.ts";
import { Prisma, type PrismaClient } from "../generated/prisma/client.ts";
import { formatFileDate } from "../report/reportModel.ts";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BACKUP_SCHEMA_VERSION,
  backupEnvelopeSchema,
  parseBackupFile,
  type BackupBrand,
  type BackupDiagnosis,
  type BackupDiaryEntry,
  type BackupFile,
} from "../validation/backupSchemas.ts";
import { readStoredAnswers, readStoredCalculator } from "../validation/diagnosisSchemas.ts";
import { DomainError } from "./domainError.ts";

export interface BackupCounts {
  companies: number;
  diagnoses: number;
  /** Action progress rows (CAP-ra-actions). */
  actions: number;
  /** Months of the diary (CAP-ra-diary). */
  diaryEntries: number;
  /** Questionnaire files the consultant saved (CAP-ra-remote-questionnaire). */
  questionnaireSends: number;
  /** 0 or 1: the report brand, logo included. */
  brand: number;
  /** 0 or 1: the days between diagnoses the user chose. */
  reevaluationInterval: number;
}

/** Shape of IF-009 for `POST /api/backup/export`. */
export interface BackupExportResult extends SavedFile, BackupCounts {}

/**
 * Shape of IF-009 for `POST /api/backup/import`. `skipped` are the records whose id already exists
 * here, and the brand or the interval the file carries when this installation already has its own.
 */
export interface BackupImportResult {
  imported: BackupCounts;
  skipped: BackupCounts;
}

export interface BackupService {
  /** Saves every company, diagnosis, action, diary month, questionnaire, the brand and the interval in a file in the Downloads folder. Changes no data. */
  export(): Promise<BackupExportResult>;
  /** Adds what the file holds and this database does not have yet; nothing is deleted or overwritten (RULE-dm-18). */
  import(raw: unknown): Promise<BackupImportResult>;
}

export interface BackupServiceDeps {
  prisma: PrismaClient;
  /** Folder the backup file is written to. */
  downloadsDir: string;
  now: () => Date;
  /** Version of the rules this app calculates with; a file from a higher one is refused. */
  rulesVersion: number;
}

// Rows per `createMany`: SQLite caps the parameters of one statement, and a diagnosis has 13 columns.
const INSERT_CHUNK_SIZE = 500;
// A large history is written in one transaction; the default 5 s would cut it.
const IMPORT_TRANSACTION_TIMEOUT_MS = 60_000;

// Keys of the `preferences` table that `brandService` and `preferenceService` own.
const BRAND_KEY = {
  name: "brand.name",
  phone: "brand.phone",
  email: "brand.email",
  website: "brand.website",
  logoMime: "brand.logo_mime",
  logoData: "brand.logo_data",
  logoUpdatedAt: "brand.logo_updated_at",
} as const;
const BRAND_KEYS: readonly string[] = Object.values(BRAND_KEY);
const REEVALUATION_KEY = "reevaluation_interval_days";

function writeFailed(): DomainError {
  return new DomainError(
    500,
    "write_failed",
    "Não foi possível salvar a cópia na pasta Downloads. Nenhum dado foi alterado. Confira se há espaço no disco e tente de novo.",
  );
}

function invalidBackup(): DomainError {
  return new DomainError(
    422,
    "backup_invalid",
    "Este arquivo não é uma cópia de segurança do FitPulse, ou está incompleto ou danificado. Nenhum dado foi alterado.",
  );
}

function newerBackup(rulesVersion: number): DomainError {
  return new DomainError(
    422,
    "backup_newer_version",
    `O arquivo veio de uma versão mais nova do app (regras v${rulesVersion}). Atualize o FitPulse pela loja do Play e tente de novo. Nenhum dado foi alterado.`,
    { rulesVersion },
  );
}

async function insertInChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
    await insert(rows.slice(start, start + INSERT_CHUNK_SIZE));
  }
}

// The spend of a diary month is the parts or the single total, never both (see `toValues` of the diary schemas).
function readDiarySpend(stored: Prisma.JsonValue | null, totalCents: bigint | null): Pick<BackupDiaryEntry, "spendParts" | "spendTotalCents"> {
  const parts: NonNullable<BackupDiaryEntry["spendParts"]> = {};
  if (stored !== null && typeof stored === "object" && !Array.isArray(stored)) {
    for (const key of SPEND_PART_KEYS) {
      const value = stored[key];
      if (isCents(value)) {
        parts[key] = value;
      }
    }
  }
  if (Object.keys(parts).length > 0) {
    return { spendParts: parts, spendTotalCents: null };
  }
  return { spendParts: null, spendTotalCents: totalCents === null ? null : Number(totalCents) };
}

// The brand as the reports print it; `null` when nothing of it was ever saved.
function readBrand(stored: Map<string, string>, exportedAt: Date): BackupBrand | null {
  const mimeType = IMAGE_MIME_TYPES.find((option) => option === stored.get(BRAND_KEY.logoMime));
  const data = stored.get(BRAND_KEY.logoData);
  const brand: BackupBrand = {
    name: stored.get(BRAND_KEY.name) ?? null,
    phone: stored.get(BRAND_KEY.phone) ?? null,
    email: stored.get(BRAND_KEY.email) ?? null,
    website: stored.get(BRAND_KEY.website) ?? null,
    logo:
      mimeType !== undefined && data !== undefined
        ? { mimeType, dataBase64: data, updatedAt: stored.get(BRAND_KEY.logoUpdatedAt) ?? exportedAt.toISOString() }
        : null,
  };
  return brand.name === null && brand.phone === null && brand.email === null && brand.website === null && brand.logo === null ? null : brand;
}

// The entries of the `preferences` table that bring the brand of the file here.
function brandEntries(brand: BackupBrand): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string | null }> = [
    { key: BRAND_KEY.name, value: brand.name },
    { key: BRAND_KEY.phone, value: brand.phone },
    { key: BRAND_KEY.email, value: brand.email },
    { key: BRAND_KEY.website, value: brand.website },
  ];
  if (brand.logo !== null) {
    entries.push(
      { key: BRAND_KEY.logoMime, value: brand.logo.mimeType },
      { key: BRAND_KEY.logoData, value: brand.logo.dataBase64 },
      { key: BRAND_KEY.logoUpdatedAt, value: brand.logo.updatedAt },
    );
  }
  return entries.filter((entry): entry is { key: string; value: string } => entry.value !== null);
}

function countsOf(backup: BackupFile): BackupCounts {
  return {
    companies: backup.companies.length,
    diagnoses: backup.diagnoses.length,
    actions: backup.actionProgress.length,
    diaryEntries: backup.diaryEntries.length,
    questionnaireSends: backup.questionnaireSends.length,
    brand: backup.brand === null ? 0 : 1,
    reevaluationInterval: backup.reevaluationIntervalDays === null ? 0 : 1,
  };
}

export function createBackupService({ prisma, downloadsDir, now, rulesVersion }: BackupServiceDeps): BackupService {
  async function readBackup(exportedAt: Date): Promise<BackupFile> {
    // One batch, so every list comes from the same moment.
    const [companies, diagnoses, actions, diaryEntries, questionnaireSends, preferences] = await prisma.$transaction([
      prisma.company.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.diagnosis.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.actionProgress.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.diaryEntry.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      prisma.questionnaireSend.findMany({ orderBy: [{ sentAt: "asc" }, { id: "asc" }] }),
      // Only the brand and the interval: the other preferences belong to the installation (the mode, the theme, the tours).
      prisma.preference.findMany({ where: { key: { in: [...BRAND_KEYS, REEVALUATION_KEY] } } }),
    ]);
    const stored = new Map(preferences.map((row) => [row.key, row.value]));
    return {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      rulesVersion,
      exportedAt,
      companies: companies.map((company) => ({
        id: company.id,
        name: company.name,
        segment: company.segment as BackupFile["companies"][number]["segment"],
        salesChannel: company.salesChannel as BackupFile["companies"][number]["salesChannel"],
        annualRevenueRange: company.annualRevenueRange as BackupFile["companies"][number]["annualRevenueRange"],
        cnpj: company.cnpj,
        archivedAt: company.archivedAt,
        createdAt: company.createdAt,
        updatedAt: company.updatedAt,
      })),
      diagnoses: diagnoses.map((diagnosis) => ({
        id: diagnosis.id,
        companyId: diagnosis.companyId,
        status: diagnosis.status,
        archivedAt: diagnosis.archivedAt,
        // Keys that no longer validate are left out, exactly as the screens read them, so the file always passes its own schema.
        answers: readStoredAnswers(diagnosis.answers),
        calculator: readStoredCalculator(diagnosis.calculator),
        currentBlock: diagnosis.currentBlock as BackupDiagnosis["currentBlock"],
        rulesVersion: diagnosis.rulesVersion,
        result: diagnosis.result as BackupFile["diagnoses"][number]["result"],
        stage: diagnosis.stage,
        completedAt: diagnosis.completedAt,
        createdAt: diagnosis.createdAt,
        updatedAt: diagnosis.updatedAt,
      })),
      actionProgress: actions.map((action) => ({
        id: action.id,
        diagnosisId: action.diagnosisId,
        actionKey: action.actionKey,
        ...normalizeActionProgress(action),
        inheritedFromId: action.inheritedFromId,
        createdAt: action.createdAt,
        updatedAt: action.updatedAt,
      })),
      // A month without a usable spend cannot be told from the parts or the total, so it is left out, as the diary screens do.
      diaryEntries: diaryEntries
        .map((entry) => ({
          id: entry.id,
          companyId: entry.companyId,
          month: entry.month,
          newCustomers: entry.newCustomers,
          ...readDiarySpend(entry.spendParts, entry.spendTotalCents),
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        }))
        .filter((entry) => entry.spendParts !== null || entry.spendTotalCents !== null),
      questionnaireSends: questionnaireSends.map((send) => ({
        id: send.id,
        companyId: send.companyId,
        fileName: send.fileName,
        sentAt: send.sentAt,
        answeredAt: send.answeredAt,
        clientSavedAt: send.clientSavedAt,
        draftId: send.draftId,
      })),
      brand: readBrand(stored, exportedAt),
      reevaluationIntervalDays: REEVALUATION_INTERVAL_OPTIONS.find((option) => String(option) === stored.get(REEVALUATION_KEY)) ?? null,
    };
  }

  // Everything in one transaction: any failure undoes the whole import.
  function insertMissing(backup: BackupFile): Promise<BackupImportResult> {
    return prisma.$transaction(
      async (tx) => {
        const knownCompanies = new Set((await tx.company.findMany({ select: { id: true } })).map((row) => row.id));
        const knownDiagnoses = new Set((await tx.diagnosis.findMany({ select: { id: true } })).map((row) => row.id));
        // A company keeps a single open draft (RULE-dm-13): a second one from the file is left out.
        const companiesWithDraft = new Set(
          (await tx.diagnosis.findMany({ where: { status: "draft" }, select: { companyId: true } })).map((row) => row.companyId),
        );
        const knownActions = await tx.actionProgress.findMany({ select: { id: true, diagnosisId: true, actionKey: true } });
        const knownDiaryEntries = await tx.diaryEntry.findMany({ select: { id: true, companyId: true, month: true } });
        const knownSends = new Set((await tx.questionnaireSend.findMany({ select: { id: true } })).map((row) => row.id));

        const newCompanies = backup.companies.filter((company) => !knownCompanies.has(company.id));
        const newDiagnoses = backup.diagnoses.filter((diagnosis) => {
          if (knownDiagnoses.has(diagnosis.id)) {
            return false;
          }
          if (diagnosis.status === "draft") {
            if (companiesWithDraft.has(diagnosis.companyId)) {
              return false;
            }
            companiesWithDraft.add(diagnosis.companyId);
          }
          return true;
        });

        // What the owner of each new record is, once the companies and diagnoses above are in.
        const companyIds = new Set([...knownCompanies, ...backup.companies.map((company) => company.id)]);
        const diagnosisIds = new Set([...knownDiagnoses, ...newDiagnoses.map((diagnosis) => diagnosis.id)]);

        // A row is new when neither its id nor its place (the action of a diagnosis, the month of a company) is taken here.
        const takenActionIds = new Set(knownActions.map((row) => row.id));
        const takenActionSlots = new Set(knownActions.map((row) => `${row.diagnosisId}/${row.actionKey}`));
        const newActions = backup.actionProgress.filter(
          (action) =>
            !takenActionIds.has(action.id) &&
            !takenActionSlots.has(`${action.diagnosisId}/${action.actionKey}`) &&
            diagnosisIds.has(action.diagnosisId),
        );
        const takenDiaryIds = new Set(knownDiaryEntries.map((row) => row.id));
        const takenMonths = new Set(knownDiaryEntries.map((row) => `${row.companyId}/${row.month}`));
        const newDiaryEntries = backup.diaryEntries.filter(
          (entry) => !takenDiaryIds.has(entry.id) && !takenMonths.has(`${entry.companyId}/${entry.month}`) && companyIds.has(entry.companyId),
        );
        const newSends = backup.questionnaireSends.filter((send) => !knownSends.has(send.id) && companyIds.has(send.companyId));

        // The brand and the interval are the installation's own: the file's only enter where there is none.
        const hasBrand = (await tx.preference.count({ where: { key: { in: [...BRAND_KEYS] } } })) > 0;
        const brandToAdd = backup.brand !== null && !hasBrand ? brandEntries(backup.brand) : [];
        const hasInterval = (await tx.preference.count({ where: { key: REEVALUATION_KEY } })) > 0;
        const intervalToAdd = backup.reevaluationIntervalDays !== null && !hasInterval ? backup.reevaluationIntervalDays : null;

        await insertInChunks(newCompanies, (data) => tx.company.createMany({ data }));
        await insertInChunks(newDiagnoses, (data) =>
          tx.diagnosis.createMany({
            data: data.map(({ result, answers, calculator, ...fields }) => ({
              ...fields,
              answers: answers as Prisma.InputJsonValue,
              calculator: calculator as Prisma.InputJsonValue,
              // An open draft has no result: the column stays empty instead of holding a JSON null.
              result: result === null ? undefined : (result as Prisma.InputJsonValue),
            })),
          }),
        );
        await insertInChunks(newActions, (data) =>
          tx.actionProgress.createMany({
            // The diagnosis an action continues from may be gone from here: it then starts on its own, as on a deleted diagnosis.
            data: data.map((action) => ({ ...action, inheritedFromId: action.inheritedFromId !== null && diagnosisIds.has(action.inheritedFromId) ? action.inheritedFromId : null })),
          }),
        );
        await insertInChunks(newDiaryEntries, (data) =>
          tx.diaryEntry.createMany({
            data: data.map(({ spendParts, spendTotalCents, ...fields }) => ({
              ...fields,
              spendParts: spendParts ?? Prisma.DbNull,
              spendTotalCents: spendTotalCents === null ? null : BigInt(spendTotalCents),
            })),
          }),
        );
        await insertInChunks(newSends, (data) => tx.questionnaireSend.createMany({ data }));
        if (brandToAdd.length > 0) {
          await tx.preference.createMany({ data: brandToAdd });
        }
        if (intervalToAdd !== null) {
          await tx.preference.create({ data: { key: REEVALUATION_KEY, value: String(intervalToAdd) } });
        }

        const imported: BackupCounts = {
          companies: newCompanies.length,
          diagnoses: newDiagnoses.length,
          actions: newActions.length,
          diaryEntries: newDiaryEntries.length,
          questionnaireSends: newSends.length,
          brand: brandToAdd.length > 0 ? 1 : 0,
          reevaluationInterval: intervalToAdd === null ? 0 : 1,
        };
        const inFile = countsOf(backup);
        return {
          imported,
          skipped: {
            companies: inFile.companies - imported.companies,
            diagnoses: inFile.diagnoses - imported.diagnoses,
            actions: inFile.actions - imported.actions,
            diaryEntries: inFile.diaryEntries - imported.diaryEntries,
            questionnaireSends: inFile.questionnaireSends - imported.questionnaireSends,
            brand: inFile.brand - imported.brand,
            reevaluationInterval: inFile.reevaluationInterval - imported.reevaluationInterval,
          },
        };
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT_MS },
    );
  }

  return {
    async export() {
      const exportedAt = now();
      const backup = await readBackup(exportedAt);
      const content = Buffer.from(`${JSON.stringify(backup, null, 2)}\n`, "utf8");
      try {
        const saved = await saveFile({
          directory: downloadsDir,
          stem: `fitpulse-copia-${formatFileDate(exportedAt)}`,
          extension: ".json",
          content,
        });
        return { ...saved, ...countsOf(backup) };
      } catch (error) {
        if (error instanceof FileWriteError) {
          throw writeFailed();
        }
        throw error;
      }
    },

    async import(raw) {
      // The versions come first: a newer file may have another layout and must not read as "invalid".
      const envelope = backupEnvelopeSchema.safeParse(raw);
      if (!envelope.success) {
        throw invalidBackup();
      }
      const { formatVersion, schemaVersion, rulesVersion: fileRulesVersion } = envelope.data;
      if (formatVersion > BACKUP_FORMAT_VERSION || schemaVersion > BACKUP_SCHEMA_VERSION || fileRulesVersion > rulesVersion) {
        throw newerBackup(fileRulesVersion);
      }

      // The file of the first release (formatVersion 1) is read by its own schema; the current one by the strict one.
      const backup = parseBackupFile(raw, formatVersion);
      if (backup === null) {
        throw invalidBackup();
      }
      const newestDiagnosisRules = Math.max(0, ...backup.diagnoses.map((diagnosis) => diagnosis.rulesVersion ?? 0));
      if (newestDiagnosisRules > rulesVersion) {
        throw newerBackup(newestDiagnosisRules);
      }

      return insertMissing(backup);
    },
  };
}
