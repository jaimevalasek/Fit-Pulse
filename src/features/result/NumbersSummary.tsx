import type { ReactNode } from "react";
import {
  formatPayback,
  formatRatio,
  getRatioBand,
  NO_NEW_CUSTOMERS_EXPLANATION,
} from "../../../shared/format/displayNumbers";
import { formatMoney } from "../../../shared/format/money";
import { rulesV1 } from "../../../shared/rules/rulesV1";
import { formatCostDiaryOrigin, getCostDiaryOrigin } from "../../../shared/domain/diaryPrefill";
import type { CalculatorInput, CostOrigin, UnitEconomics } from "../../../shared/domain/types";

const ORIGIN_LABELS: Record<CostOrigin, string> = {
  measured: "Medido",
  estimated: "Estimado por faixa",
  unknown: "Gasto ou clientes novos desconhecidos",
};

// Where the cost per customer came from: "do diário, medido", "do diário, estimado" or what was typed (AC-ra-46)
function describeCacOrigin(economics: UnitEconomics, calculator?: CalculatorInput): string {
  if (economics.cacCents === null && economics.newCustomers === 0) return NO_NEW_CUSTOMERS_EXPLANATION;
  const diaryOrigin = calculator ? getCostDiaryOrigin(calculator) : null;
  if (diaryOrigin) return `Origem: ${formatCostDiaryOrigin(diaryOrigin)}`;
  return ORIGIN_LABELS[economics.origin];
}

function describePayback(economics: UnitEconomics): string {
  if (economics.neverPaysBack) return "O lucro de um cliente não cobre o custo dele";
  if (economics.paybackMonths === null) return "Sem dados";
  return economics.paybackMonths <= rulesV1.risk.paybackAboveMonths
    ? `Dentro de ${rulesV1.risk.paybackAboveMonths} meses`
    : `Mais de ${rulesV1.risk.paybackAboveMonths} meses`;
}

function NumberCell({ label, value, children, dataId }: { label: string; value: string; children: ReactNode; dataId: string }) {
  return (
    <div data-aioson-id={dataId} className="min-w-0 bg-ground py-4 sm:px-4">
      <div className="text-sm text-text-muted">{label}</div>
      <div className="my-1 font-mono text-2xl leading-tight font-medium break-words">{value}</div>
      <p className="text-sm text-text-soft">{children}</p>
    </div>
  );
}

// CAC, LTV, ratio and payback with where the cost came from; `calculator` is the stored block 1 of the
// diagnosis, which carries the diary marks
function NumbersSummary({ economics, calculator }: { economics: UnitEconomics; calculator?: CalculatorInput }) {
  const band = getRatioBand(economics.ratio);
  const payback = economics.neverPaysBack ? "never" : economics.paybackMonths;

  return (
    <section aria-labelledby="result-numbers-title">
      <h3 id="result-numbers-title" className="mt-8 mb-3">
        Seus números
      </h3>
      <div
        data-aioson-id="result-numbers"
        className="grid grid-cols-1 gap-px border-y border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
      >
        <NumberCell dataId="number-cac" label="Custo de um cliente" value={formatMoney(economics.cacCents)}>
          {describeCacOrigin(economics, calculator)}
        </NumberCell>
        <NumberCell dataId="number-ltv" label="Lucro de um cliente no tempo" value={formatMoney(economics.ltvCents)}>
          Depois de pagar produto, insumo e entrega
        </NumberCell>
        <NumberCell dataId="number-ratio" label="Relação lucro ÷ custo" value={formatRatio(economics.ratio)}>
          {band ? `${band.label}. ${band.phrase}` : "Sem o custo de um cliente, não há comparação."}
        </NumberCell>
        <NumberCell dataId="number-payback" label="Tempo para se pagar" value={formatPayback(payback)}>
          {describePayback(economics)}
        </NumberCell>
      </div>
    </section>
  );
}

export { NumbersSummary };
