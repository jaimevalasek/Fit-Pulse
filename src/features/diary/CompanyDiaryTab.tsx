import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusView } from "@/components/feedback/StatusView";
import { deleteDiaryMonth, getDiary, type DiaryEntryView, type DiaryView } from "@/api/diaryApi";
import { useCompanyOutlet } from "@/features/companies/CompanyPage";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { computeRecentCost, DIARY_MEASURED_MONTHS, formatDiaryProgress, isDiaryMeasured, isTotalOnlyEntry } from "../../../shared/domain/diary";
import { formatMonthLong, formatMonthShort } from "../../../shared/format/dates";
import { formatMoney } from "../../../shared/format/money";
import { DiaryCostChart } from "./DiaryCostChart";
import { DiaryMonthDialog } from "./DiaryMonthForm";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; view: DiaryView };

const COUNT_FORMAT = new Intl.NumberFormat("pt-BR");

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function useCompanyDiary(companyId: string) {
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoad({ status: "loading" });
    getDiary(companyId, controller.signal)
      .then((view) => !controller.signal.aborted && setLoad({ status: "ready", view }))
      .catch(() => !controller.signal.aborted && setLoad({ status: "error" }));
    return () => controller.abort();
  }, [companyId, attempt]);
  return { load, retry: () => setAttempt((value) => value + 1), show: (view: DiaryView) => setLoad({ status: "ready", view }) };
}

function savedMessage(view: DiaryView, month: string, edited: boolean): string {
  const entry = view.entries.find((item) => item.month === month);
  const done = `${capitalize(formatMonthLong(month))} ${edited ? "atualizado" : "anotado"}.`;
  if (!entry || entry.cacCents === null) return `${done} Sem clientes novos, o custo por cliente deste mês não é calculado.`;
  return `${done} Custo por cliente: ${formatMoney(entry.cacCents)}.`;
}

// Consultant mode: the consultant types the client's numbers (F12)
function ConsultantNotice() {
  return (
    <p role="note" className="mb-4 rounded-md border border-line bg-surface px-4 py-3 text-sm text-text-soft" data-aioson-id="diary-consultant-note">
      Você anota os números do cliente: peça a ele o gasto e os clientes novos de cada mês.
    </p>
  );
}

function DiaryStatusPanel({ view }: { view: DiaryView }) {
  const measured = isDiaryMeasured(view.progress);
  const count = view.progress.count;
  const missing = DIARY_MEASURED_MONTHS - count;
  const recent = computeRecentCost(view.entries);
  return (
    <section aria-labelledby="diary-status-title" className="rounded-lg border border-line bg-surface p-5" data-aioson-id="diary-status">
      <h2 id="diary-status-title" className="text-xl">
        {measured ? "Custo por cliente medido" : `Faltam ${missing} ${missing === 1 ? "mês" : "meses"} para medir`}
      </h2>
      <div className="my-3 flex gap-2" aria-hidden="true">
        {Array.from({ length: DIARY_MEASURED_MONTHS }, (_, index) => (
          <i key={index} className={index < count ? "h-2 w-7 rounded border border-bronze bg-bronze" : "h-2 w-7 rounded border border-line-strong"} />
        ))}
      </div>
      <p className="font-mono text-sm font-medium text-text-soft" data-aioson-id="diary-progress">
        {formatDiaryProgress(view.progress)}
      </p>
      <p className="mt-2 font-mono text-4xl leading-tight font-medium break-words" data-aioson-id="diary-recent-cost">
        {formatMoney(recent?.cacCents)}
      </p>
      <p className="mt-2 text-[0.9375rem] text-text-soft">
        {measured && recent
          ? `De ${formatMonthShort(view.progress.measuredFrom)} a ${formatMonthShort(view.progress.measuredTo)}: ${formatMoney(recent.spendCents)} de gasto ÷ ${COUNT_FORMAT.format(recent.newCustomers)} clientes novos. O próximo diagnóstico já vem com esse número, marcado como medido. Você pode corrigir antes de concluir.`
          : `Com ${count} ${count === 1 ? "mês" : "meses"}, o número entra no próximo diagnóstico só como sugestão, marcada como estimado. Com 3 meses, ele passa a contar como medido.`}
      </p>
    </section>
  );
}

function spendLabel(entry: DiaryEntryView): string {
  if (isTotalOnlyEntry(entry)) return "gasto (só o total)";
  const parts = Object.values(entry.spendParts ?? {}).filter((cents) => typeof cents === "number").length;
  return `gasto em ${parts} ${parts === 1 ? "parte" : "partes"}`;
}

interface MonthRowProps {
  entry: DiaryEntryView;
  onEdit: (entry: DiaryEntryView) => void;
  onDelete: (month: string) => void;
}

function MonthValue({ value, label, strong = false }: { value: string; label: string; strong?: boolean }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className={strong ? "font-mono font-semibold break-words" : "font-mono break-words"}>{value}</span>
      <span className="text-xs text-text-muted">{label}</span>
    </span>
  );
}

function MonthRow({ entry, onEdit, onDelete }: MonthRowProps) {
  const monthName = formatMonthLong(entry.month);
  return (
    <li className="grid grid-cols-2 items-center gap-x-4 gap-y-2 border-b border-line py-3 sm:grid-cols-[6rem_1fr_1fr_1fr_auto]" data-aioson-id={`month-${entry.month}`}>
      <span className="col-span-2 font-mono font-semibold sm:col-span-1">{formatMonthShort(entry.month)}</span>
      <MonthValue value={formatMoney(entry.totalCents)} label={spendLabel(entry)} />
      <MonthValue value={COUNT_FORMAT.format(entry.newCustomers)} label="clientes novos" />
      <MonthValue value={formatMoney(entry.cacCents)} label="por cliente" strong />
      <span className="flex gap-1 max-sm:col-span-2 sm:justify-end">
        <Button variant="ghost" size="sm" className="min-h-(--touch)" aria-label={`Editar ${monthName}`} onClick={() => onEdit(entry)} data-aioson-id={`edit-month-${entry.month}`}>
          Editar
        </Button>
        <Button variant="ghost" size="sm" className="min-h-(--touch) text-danger" aria-label={`Excluir ${monthName}`} onClick={() => onDelete(entry.month)} data-aioson-id={`delete-month-${entry.month}`}>
          Excluir
        </Button>
      </span>
    </li>
  );
}

function DiaryContent({ view, onAdd, onEdit, onDelete }: { view: DiaryView; onAdd: () => void } & Omit<MonthRowProps, "entry">) {
  return (
    <div data-aioson-tour="diario">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <DiaryStatusPanel view={view} />
        <section aria-labelledby="diary-chart-title" className="min-w-0">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="diary-chart-title" className="text-xl">
              Custo por cliente, mês a mês
            </h2>
            <Button variant="metal" onClick={onAdd} data-aioson-id="add-month">
              Anotar mês
            </Button>
          </div>
          <DiaryCostChart chart={view.chart} />
        </section>
      </div>
      <ul className="m-0 mt-8 list-none border-t border-line p-0" aria-label="Meses anotados" data-aioson-id="diary-list">
        {view.entries.map((entry) => (
          <MonthRow key={entry.month} entry={entry} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </div>
  );
}

function DiaryEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div data-aioson-tour="diario">
      <StatusView
        state="empty"
        dataId="diary-empty"
        title="Por que anotar todo mês?"
        description="Com 3 meses de gasto para atrair clientes e de clientes novos, o FitPulse calcula sozinho quanto custa cada cliente. O próximo diagnóstico já vem com esse número medido."
        action={
          <Button variant="metal" onClick={onAdd} data-aioson-id="add-month">
            Anotar o primeiro mês
          </Button>
        }
      />
    </div>
  );
}

// Tab #/empresa/:companyId/diario — the months noted, the cost per customer of each one, the chart and the
// progress towards a measured number (CAP-ra-diary). Every change redraws from the diary the server answers.
function CompanyDiaryTab() {
  const { company } = useCompanyOutlet();
  const { preferences } = usePreferences();
  const { load, retry, show } = useCompanyDiary(company.id);
  const [editing, setEditing] = useState<DiaryEntryView | "new" | null>(null);
  // The month stays while the dialog closes, so its title never goes blank
  const [deleting, setDeleting] = useState<{ month: string; open: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (load.status === "loading") return <StatusView state="loading" title="Carregando o diário" dataId="diary-loading" />;
  if (load.status === "error") {
    return <StatusView state="error" title="Não foi possível abrir o diário" description="Os meses anotados continuam guardados. Tente de novo em instantes." onRetry={retry} dataId="diary-error" />;
  }
  const { view } = load;
  const openNew = () => setEditing("new");

  async function confirmDelete(month: string) {
    show(await deleteDiaryMonth(company.id, month));
    setNotice(`${capitalize(formatMonthLong(month))} excluído do diário.`);
  }

  return (
    <div data-aioson-id="company-diary" data-state={view.entries.length > 0 ? "success" : "empty"}>
      {preferences.usageMode === "consultant" ? <ConsultantNotice /> : null}
      <p role="status" className={notice ? "mb-4 text-sm text-text-soft" : "sr-only"} data-aioson-id="diary-notice">
        {notice}
      </p>
      {view.entries.length === 0 ? <DiaryEmpty onAdd={openNew} /> : <DiaryContent view={view} onAdd={openNew} onEdit={setEditing} onDelete={(month) => setDeleting({ month, open: true })} />}
      <DiaryMonthDialog
        companyId={company.id}
        target={editing}
        takenMonths={view.entries.map((entry) => entry.month)}
        onClose={() => setEditing(null)}
        onSaved={(next, month) => {
          show(next);
          setNotice(savedMessage(next, month, editing !== "new"));
        }}
      />
      <ConfirmDialog
        open={deleting?.open ?? false}
        onOpenChange={(open) => setDeleting((current) => (current ? { ...current, open } : null))}
        title={deleting ? `Excluir ${formatMonthLong(deleting.month)} do diário?` : ""}
        consequence="O custo por cliente desse mês sai da média e do próximo diagnóstico. Não dá para desfazer."
        confirmLabel="Excluir mês"
        tone="destructive"
        onConfirm={() => (deleting ? confirmDelete(deleting.month) : undefined)}
        dataId="diary-delete-confirm"
      />
    </div>
  );
}

export { CompanyDiaryTab };
