// Calls of the report routes (IF-001, IF-006): the server builds the pages and renders the PDF.
// The screen draws the pages of the preview and, on export, the server saves the same pages in the Downloads folder.
import type { ReportDocument } from "../../shared/report/reportDocument";
import { httpClient } from "./httpClient";

// What the owner picked in the report center (IF-001): the diagnosis, with `includeAnswers` adding the
// questionnaire answers appendix; the evolution from "De" to "Até"; and the portfolio, with no option.
type ReportSelection =
  | { kind: "diagnosis"; diagnosisId: string; includeAnswers: boolean }
  | { kind: "evolution"; fromId: string; toId: string }
  | { kind: "portfolio" };

// Where the server saved the file: `directory` is the folder, `fileName` is `{empresa}-{data}.pdf`
// (with " (2)" when a file with that name already existed) and `fileId` is what "Abrir PDF" and
// "Mostrar na pasta" send (IF-002)
interface ReportExport {
  fileId: string;
  fileName: string;
  directory: string;
}

// 404 diagnosis_not_found; 409 diagnosis_not_completed for a draft (the evolution adds the errors of the
// pair, the portfolio 409 portfolio_empty). The optional signal cancels the call
// when the owner changes the selection before the answer arrives.
function getReportPreview(selection: ReportSelection, signal?: AbortSignal): Promise<ReportDocument> {
  return httpClient.get<ReportDocument>("/api/reports/preview", { query: { ...selection }, signal });
}

// Same errors as the preview, plus 500 write_failed when nothing could be saved (nothing is left in the folder)
function exportReportFile(selection: ReportSelection): Promise<ReportExport> {
  return httpClient.post<ReportExport>("/api/reports/export", selection);
}

// Report of the result screen: the diagnosis report with the default options (IF-006)
function exportReport(diagnosisId: string): Promise<ReportExport> {
  return httpClient.post<ReportExport>(`/api/diagnoses/${encodeURIComponent(diagnosisId)}/report`);
}

export { exportReport, exportReportFile, getReportPreview };
export type { ReportExport, ReportSelection };
