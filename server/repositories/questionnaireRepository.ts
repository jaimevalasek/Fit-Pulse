import type { Prisma, PrismaClient, QuestionnaireSend } from "../generated/prisma/client.ts";

export type QuestionnaireSendRecord = QuestionnaireSend;

export interface NewQuestionnaireSend {
  companyId: string;
  /** Name the file ended up with in the Downloads folder. */
  fileName: string;
  /** Absolute path of the folder the file was written to. */
  directory: string;
  /** Moment of the save, from the app clock; it is also when the file record is created. */
  sentAt: Date;
}

export interface RecordedSend {
  /** Id of the record of the saved file: what "Mostrar na pasta" sends (IF-002). */
  fileId: string;
  send: QuestionnaireSendRecord;
}

export interface AnsweredDraft {
  companyId: string;
  draftId: string;
  /** Moment of the import, from the app clock. */
  answeredAt: Date;
  /** Moment the client saved the answers, from the file. */
  clientSavedAt: Date;
  /** Name for the record when the company had no send waiting (the answers file came without one). */
  fallbackFileName: string;
}

/** The part of a Prisma client, or of its transaction, that the sends need. */
type SendsClient = Pick<Prisma.TransactionClient, "questionnaireSend">;

/**
 * Marks as answered every send of the company that was waiting, pointing them at the draft the answers
 * became. Without one waiting (a file that came back twice, or from a send the app never saw) the import
 * is recorded as a send of its own, so the draft always carries its mark. Takes the client so an import
 * can run it in the same transaction that creates the draft.
 */
export async function markSendsAnswered(client: SendsClient, input: AnsweredDraft): Promise<void> {
  const { companyId, draftId, answeredAt, clientSavedAt, fallbackFileName } = input;
  const updated = await client.questionnaireSend.updateMany({
    where: { companyId, answeredAt: null },
    data: { answeredAt, clientSavedAt, draftId },
  });
  if (updated.count === 0) {
    await client.questionnaireSend.create({
      data: { companyId, fileName: fallbackFileName, sentAt: answeredAt, answeredAt, clientSavedAt, draftId },
    });
  }
}

export interface QuestionnaireRepository {
  /** The saved file and the send waiting for its answers, written together: one without the other never exists. */
  recordSend(input: NewQuestionnaireSend): Promise<RecordedSend>;
  /** Sends still waiting for answers, newest first; of one company when `companyId` is given, else of all. */
  listAwaiting(companyId?: string): Promise<QuestionnaireSendRecord[]>;
  /** When the client saved the answers that became this draft; `null` for a draft that was not imported. */
  findClientSavedAtByDraft(draftId: string): Promise<Date | null>;
}

export function createQuestionnaireRepository(prisma: PrismaClient): QuestionnaireRepository {
  return {
    async recordSend({ companyId, fileName, directory, sentAt }) {
      const [file, send] = await prisma.$transaction([
        prisma.generatedFile.create({
          data: { companyId, kind: "questionnaire_html", fileName, directory, createdAt: sentAt },
        }),
        prisma.questionnaireSend.create({ data: { companyId, fileName, sentAt } }),
      ]);
      return { fileId: file.id, send };
    },

    listAwaiting: (companyId) =>
      prisma.questionnaireSend.findMany({
        where: { answeredAt: null, ...(companyId === undefined ? {} : { companyId }) },
        orderBy: [{ sentAt: "desc" }, { id: "asc" }],
      }),

    async findClientSavedAtByDraft(draftId) {
      const send = await prisma.questionnaireSend.findFirst({
        where: { draftId },
        select: { clientSavedAt: true },
        orderBy: [{ answeredAt: "desc" }, { id: "asc" }],
      });
      return send?.clientSavedAt ?? null;
    },
  };
}
