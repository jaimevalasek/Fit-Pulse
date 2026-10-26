// Calls of the remote questionnaire routes (IF-011): the consultant saves a questionnaire file for a company
// to send to the client, and later imports the answers file the client sent back as the company's draft.
import { httpClient } from "./httpClient";

// Where the server saved the file: `directory` is the folder, `fileName` is `{empresa}-questionario-{AAAA-MM-DD}.html`
// (with " (2)" when a file with that name already existed), `fileId` is what "Mostrar na pasta" sends (IF-002),
// `sentAt` is the ISO time of the save and `message` is the approved text to copy to the client.
interface QuestionnaireSend {
  fileId: string;
  fileName: string;
  directory: string;
  sentAt: string;
  message: string;
}

// `draftId` is the draft the answers became (open it to review and conclude); `clientSavedAt` is the ISO time
// the client saved the answers, read from the file.
interface ImportedAnswers {
  draftId: string;
  clientSavedAt: string;
}

// `content` is the text of the `.fitpulse` file (up to 1 MB). `replaceDraft` is sent only after the consultant
// confirmed that the company's open draft goes away.
interface ImportAnswersInput {
  content: string;
  replaceDraft?: boolean;
}

// What the 409 and 422 answers carry in `ApiError.details`. Every failure leaves the data as it was; the screen
// adds "Nada foi alterado." to the message of the server.
interface DraftExistsDetails {
  draftCreatedAt: string;
}

interface OtherCompanyDetails {
  fileCompanyName: string;
  currentCompanyName: string;
}

function companyPath(companyId: string): string {
  return `/api/companies/${encodeURIComponent(companyId)}`;
}

// 404 company_not_found; 500 write_failed when nothing could be saved (nothing is left in the folder)
function sendQuestionnaire(companyId: string): Promise<QuestionnaireSend> {
  return httpClient.post<QuestionnaireSend>(`${companyPath(companyId)}/questionnaire`);
}

// 404 company_not_found; 400 validation_failed (no text); 413 payload_too_large (over 1 MB);
// 422 answers_invalid (not an answers file), answers_newer_version, answers_other_company (details:
// OtherCompanyDetails) or answers_incompatible; 409 draft_exists (details: DraftExistsDetails) until
// the call is repeated with `replaceDraft: true`
function importAnswers(companyId: string, input: ImportAnswersInput): Promise<ImportedAnswers> {
  return httpClient.post<ImportedAnswers>(`${companyPath(companyId)}/questionnaire-answers`, input);
}

export { importAnswers, sendQuestionnaire };
export type { DraftExistsDetails, ImportAnswersInput, ImportedAnswers, OtherCompanyDetails, QuestionnaireSend };
