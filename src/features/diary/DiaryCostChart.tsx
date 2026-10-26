import type { DiaryChartPoint } from "@/api/diaryApi";
import { cn } from "@/lib/utils";
import { buildChartSummary } from "../../../shared/domain/diary";
import { formatMonthShort } from "../../../shared/format/dates";
import { formatMoney } from "../../../shared/format/money";

// Tallest bar as a share of the plot, leaving room for the value written above it
const MAX_BAR_PERCENT = 82;

function barHeight(point: DiaryChartPoint, max: number): string {
  if (point.cacCents === null || max <= 0) return "0%";
  return `${Math.max(2, Math.round((point.cacCents / max) * MAX_BAR_PERCENT))}%`;
}

// Cost per customer of the last 6 months noted, oldest first, with the value written on each bar and
// a sentence that reads the trend (AC-ra-41). A month without new customers says "não calculado".
function DiaryCostChart({ chart }: { chart: readonly DiaryChartPoint[] }) {
  const max = Math.max(0, ...chart.map((point) => point.cacCents ?? 0));
  const label = `Custo por cliente por mês: ${chart.map((point) => `${formatMonthShort(point.month)} ${formatMoney(point.cacCents)}`).join(", ")}`;
  return (
    <figure className="m-0" data-aioson-id="diary-chart">
      <div role="img" aria-label={label} className="flex h-[170px] items-end gap-2 border-b border-line-strong px-1 pt-2 sm:gap-3.5">
        {chart.map((point, index) => (
          <div key={point.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" data-aioson-id={`chart-${point.month}`}>
            <span className={cn("max-w-full text-center font-mono text-xs leading-tight font-medium break-words", point.cacCents === null ? "text-text-muted" : "text-text-soft")}>
              {formatMoney(point.cacCents)}
            </span>
            <span
              aria-hidden="true"
              className={cn("w-full max-w-14 rounded-t-md", index === chart.length - 1 ? "bg-bronze" : "bg-bronze/70")}
              style={{ height: barHeight(point, max) }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-2 px-1 pt-1.5 sm:gap-3.5">
        {chart.map((point) => (
          <span key={point.month} className="min-w-0 flex-1 text-center font-mono text-xs font-medium text-text-muted">
            {formatMonthShort(point.month)}
          </span>
        ))}
      </div>
      <figcaption className="mt-3">
        <p className="text-sm text-text-soft" data-aioson-id="diary-chart-summary">
          {buildChartSummary(chart)}
        </p>
        <p className="mt-1 text-xs text-text-muted">Custo por cliente = gasto para atrair clientes ÷ clientes novos do mês.</p>
      </figcaption>
    </figure>
  );
}

export { DiaryCostChart };
