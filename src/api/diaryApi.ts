// Calls of the diary routes (IF-006): the months a company noted (spend and new customers), the cost per
// customer of each one, the progress towards 3 measured months and the chart. Every call answers with the
// whole diary, so the screen redraws from one response. Money travels in whole cents.
import type { DiaryChartPoint, DiaryEntryView, DiaryProgress, DiarySpendParts, DiaryView } from "../../shared/domain/diary";
import { httpClient } from "./httpClient";

// The values of one month. The spend is the filled-in parts of the calculator or, for "Só sei o total", one
// total, never both. Parts and total are whole cents from 0 up to 9999999999 (R$ 99.999.999,99); new customers
// is an integer from 0 to 99999.
interface DiaryEntryInput {
  newCustomers: number;
  spendParts?: DiarySpendParts;
  spendTotalCents?: number;
}

// A new month also carries its month as YYYY-MM (the screen converts from MM/AAAA); it is not after this month.
interface DiaryMonthInput extends DiaryEntryInput {
  month: string;
}

function diaryPath(companyId: string): string {
  return `/api/companies/${encodeURIComponent(companyId)}/diary`;
}

// 404 company_not_found
function getDiary(companyId: string, signal?: AbortSignal): Promise<DiaryView> {
  return httpClient.get<DiaryView>(diaryPath(companyId), { signal });
}

// 400 validation_failed with fields (month, newCustomers, spendParts, spendParts.<part>, spendTotalCents);
// 404 company_not_found; 409 month_taken (also carries fields.month)
function addDiaryMonth(companyId: string, input: DiaryMonthInput): Promise<DiaryView> {
  return httpClient.post<DiaryView>(diaryPath(companyId), input);
}

// The month is read-only (RULE-ra-08): it comes from the route and the body carries only the values.
// 400 validation_failed with fields; 404 company_not_found or diary_month_not_found
function updateDiaryMonth(companyId: string, month: string, input: DiaryEntryInput): Promise<DiaryView> {
  return httpClient.put<DiaryView>(`${diaryPath(companyId)}/${encodeURIComponent(month)}`, input);
}

// 404 company_not_found or diary_month_not_found
function deleteDiaryMonth(companyId: string, month: string): Promise<DiaryView> {
  return httpClient.delete<DiaryView>(`${diaryPath(companyId)}/${encodeURIComponent(month)}`);
}

export { addDiaryMonth, deleteDiaryMonth, getDiary, updateDiaryMonth };
export type { DiaryChartPoint, DiaryEntryInput, DiaryEntryView, DiaryMonthInput, DiaryProgress, DiarySpendParts, DiaryView };
