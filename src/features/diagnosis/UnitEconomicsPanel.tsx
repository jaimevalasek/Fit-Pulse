import type { ReactNode } from "react";
import { rulesV1 } from "../../../shared/rules/rulesV1";
import { computeUnitEconomics } from "../../../shared/domain/unitEconomics";
import type { CalculatorInput, UnitEconomics } from "../../../shared/domain/types";
import { formatMoney } from "../../../shared/format/money";
import {
  NO_NEW_CUSTOMERS_EXPLANATION,
  NOT_CALCULATED_LABEL,
  formatPayback,
  formatRatioWithBand,
  getRatioBand,
} from "../../../shared/format/displayNumbers";

const ESTIMATED_NOTE = "estimado por faixa";
const PAYBACK_LIMIT_MONTHS = 12;

function moneyOrNotCalculated(cents: number | null): string {
  return cents === null ? NOT_CALCULATED_LABEL : formatMoney(cents);
}

function withEstimate(text: string, economics: UnitEconomics): string {
  return economics.origin === "estimated" ? `${text} (${ESTIMATED_NOTE})` : text;
}

function hasNoNewCustomers(economics: UnitEconomics): boolean {
  return economics.newCustomersOrigin === "measured" && economics.newCustomers === 0;
}

function costNote(economics: UnitEconomics): string {
  if (economics.cacCents !== null) return withEstimate("Gasto ÷ clientes novos", economics);
  return hasNoNewCustomers(economics) ? NO_NEW_CUSTOMERS_EXPLANATION : "";
}

function ratioNote(economics: UnitEconomics): string {
  const band = getRatioBand(economics.ratio);
  return band === null ? "" : withEstimate(band.phrase, economics);
}

function paybackNote(economics: UnitEconomics): string {
  if (economics.neverPaysBack) return "Sem lucro por mês, o custo do cliente não volta.";
  if (economics.paybackMonths === null) return "";
  const note = economics.paybackMonths <= PAYBACK_LIMIT_MONTHS ? "Dentro de 12 meses." : "Mais de 12 meses: o caixa fica preso.";
  return withEstimate(note, economics);
}

function Figure({ label, value, note }: { label: string; value: string; note: ReactNode }) {
  return (
    <>
      <dt className="mt-4 text-sm text-text-muted">{label}</dt>
      <dd className="m-0 font-mono text-2xl leading-snug font-medium">
        {value}
        {note ? <small className="mt-0.5 block font-sans text-xs text-text-soft">{note}</small> : null}
      </dd>
    </>
  );
}

// Recalculates cost per customer, profit per customer, their ratio and the payback on every change
// (AC-dm-15, AC-dm-51); nothing here ever shows NaN, Infinity or an empty value.
function UnitEconomicsPanel({ calculator }: { calculator: CalculatorInput }) {
  const economics = computeUnitEconomics(calculator, rulesV1);
  const costUnknown = economics.cacCents === null && !hasNoNewCustomers(economics);
  return (
    <aside
      aria-live="polite"
      data-aioson-id="calc-output"
      className="rounded-lg border border-line-strong bg-surface p-6 lg:sticky lg:top-26"
    >
      <h3 className="mb-2">Seus números, calculados</h3>
      {costUnknown ? (
        <p className="text-sm text-text-muted">
          Sem o gasto ou o número de clientes novos, o app não calcula o custo de um cliente. Tudo bem: isso vira a
          primeira ação do seu plano.
        </p>
      ) : null}
      <dl className="m-0">
        <Figure
          label="Custo para conquistar um cliente"
          value={moneyOrNotCalculated(economics.cacCents)}
          note={costNote(economics)}
        />
        <Figure
          label="Quanto um cliente deixa de lucro"
          value={moneyOrNotCalculated(economics.ltvCents)}
          note={economics.ltvCents === null ? "Preencha a compra típica" : "Valor × compras por ano × tempo × margem"}
        />
        <Figure label="Relação entre os dois" value={formatRatioWithBand(economics.ratio)} note={ratioNote(economics)} />
        <Figure
          label="Tempo para o cliente se pagar"
          value={formatPayback(economics.neverPaysBack ? "never" : economics.paybackMonths)}
          note={paybackNote(economics)}
        />
      </dl>
    </aside>
  );
}

export { UnitEconomicsPanel };
