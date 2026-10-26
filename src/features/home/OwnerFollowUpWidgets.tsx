import type { ReactNode } from "react";
import { Link } from "react-router";
import type { HomeActionCounts, HomeDiary, HomeLatestReport } from "@/api/homeApi";
import { formatDate } from "@/features/companies/CompanyPage";
import { formatMonthShort } from "../../../shared/format/dates";
import { formatMoney } from "../../../shared/format/money";

// Months the diary needs before the cost per customer counts as measured
const MEASURED_MONTHS = 3;

interface WidgetProps {
  to: string;
  dataId: string;
  title: string;
  value: string;
  children: ReactNode;
}

// One row of "O que precisa de você": the whole row opens the tab behind the number
function Widget({ to, dataId, title, value, children }: WidgetProps) {
  return (
    <Link
      to={to}
      data-aioson-id={dataId}
      className="grid min-h-(--touch) grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-b border-line px-1 py-4.5 text-text no-underline transition-colors duration-(--fast) ease-app hover:bg-surface-raised/70 motion-reduce:transition-none"
    >
      <h3 className="text-base font-semibold">{title}</h3>
      <span aria-hidden="true" className="self-center text-bronze">
        →
      </span>
      <span data-aioson-id={`${dataId}-value`} className="font-mono text-2xl leading-tight font-medium tabular-nums">
        {value}
      </span>
      <span data-aioson-id={`${dataId}-sub`} className="col-span-full text-sm text-text-soft">
        {children}
      </span>
    </Link>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function ActionsWidget({ companyPath, counts }: { companyPath: string; counts: HomeActionCounts }) {
  const total = counts.done + counts.inProgress + counts.todo + counts.notApplicable;
  return (
    <Widget to={`${companyPath}/acoes`} dataId="home-actions-widget" title="Ações do plano" value={`${counts.done} de ${total} feitas`}>
      {counts.inProgress} em andamento · {counts.todo} a fazer
      {counts.notApplicable > 0 ? ` · ${counts.notApplicable} não se aplica` : null}
      {counts.overdue > 0 ? (
        <>
          {" · "}
          <span
            data-aioson-id="home-actions-overdue"
            className="inline-flex items-center rounded-full border border-danger bg-danger-wash px-2.5 py-0.5 text-xs font-medium text-danger"
          >
            {counts.overdue} com prazo vencido
          </span>
        </>
      ) : null}
    </Widget>
  );
}

function diaryProgress(diary: HomeDiary): string {
  const noted = plural(diary.count, "mês anotado", "meses anotados");
  if (diary.measuredFrom && diary.measuredTo) {
    return `Custo por cliente pelo diário, medido de ${formatMonthShort(diary.measuredFrom)} a ${formatMonthShort(diary.measuredTo)} · ${noted}.`;
  }
  return `Custo por cliente pelo diário · ${Math.min(diary.count, MEASURED_MONTHS)} de ${MEASURED_MONTHS} meses anotados.`;
}

function DiaryWidget({ companyPath, diary }: { companyPath: string; diary: HomeDiary }) {
  return (
    <Widget
      to={`${companyPath}/diario`}
      dataId="home-diary-widget"
      title="Diário de números"
      value={diary.cacCents !== null ? formatMoney(diary.cacCents) : "sem dados"}
    >
      {diaryProgress(diary)}
    </Widget>
  );
}

function ReportsWidget({ companyPath, report, diagnosedAt }: { companyPath: string; report: HomeLatestReport | null; diagnosedAt: string }) {
  return (
    <Widget
      to={`${companyPath}/relatorios`}
      dataId="home-reports-widget"
      title="Relatórios"
      value={report ? "PDF salvo" : "Nenhum PDF ainda"}
    >
      {report
        ? `${report.fileName}, salvo em ${formatDate(report.savedAt)}.`
        : `Gere o relatório do diagnóstico de ${formatDate(diagnosedAt)} para mostrar a sócios, contador ou banco.`}
    </Widget>
  );
}

interface OwnerFollowUpWidgetsProps {
  companyId: string;
  counts: HomeActionCounts;
  diary: HomeDiary;
  latestReport: HomeLatestReport | null;
  // Moment the latest diagnosis was completed: the report invitation names it
  diagnosedAt: string;
}

// "Ações do plano", "Diário de números" and "Relatórios", each opening its company tab (AC-ra-33)
function OwnerFollowUpWidgets({ companyId, counts, diary, latestReport, diagnosedAt }: OwnerFollowUpWidgetsProps) {
  const companyPath = `/empresa/${encodeURIComponent(companyId)}`;
  return (
    <section aria-label="O que precisa de você" data-aioson-id="home-widgets" className="flex min-w-0 flex-col border-t border-line">
      <ActionsWidget companyPath={companyPath} counts={counts} />
      <DiaryWidget companyPath={companyPath} diary={diary} />
      <ReportsWidget companyPath={companyPath} report={latestReport} diagnosedAt={diagnosedAt} />
    </section>
  );
}

export { OwnerFollowUpWidgets };
