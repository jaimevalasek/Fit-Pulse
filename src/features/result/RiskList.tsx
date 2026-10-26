import { getRiskInfo } from "../../../shared/content/riskCatalog";
import { rulesV1 } from "../../../shared/rules/rulesV1";
import type { RiskLevel, RiskResult } from "../../../shared/domain/types";
import { cn } from "@/lib/utils";

const LEVEL_LABELS: Record<RiskLevel, string> = { high: "Alto", medium: "Médio", low: "Baixo" };

const LEVEL_TONES: Record<RiskLevel, string> = {
  high: "border-danger/45 bg-danger-wash text-danger",
  medium: "border-warn/40 bg-warn-wash text-warn",
  low: "border-line text-text-soft",
};

// Each label stays whole; the line breaks between labels, at 1280 px and at 390 px (AC-ra-24)
const RISK_LABEL_CLASS = "font-mono text-xs whitespace-nowrap text-text-muted";

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 shrink-0 text-bronze"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

function RiskItem({ risk }: { risk: RiskResult }) {
  const info = getRiskInfo(risk.signalId);
  return (
    <li
      data-risk-id={risk.signalId}
      data-level={risk.level}
      className="grid grid-cols-1 gap-2 border-b border-line py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-4"
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 sm:flex-col">
        <span
          className={cn(
            "inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium tracking-[0.06em] uppercase",
            LEVEL_TONES[risk.level],
          )}
        >
          {LEVEL_LABELS[risk.level]} · {risk.score}
        </span>
        <span className={RISK_LABEL_CLASS}>Probabilidade {risk.probability} de 5</span>
        <span className={RISK_LABEL_CLASS}>Impacto {risk.impact} de 5</span>
        <span className={RISK_LABEL_CLASS}>
          Nota {risk.probability} × {risk.impact} = {risk.score}
        </span>
      </div>
      <div className="min-w-0">
        <b className="block">{info.title}</b>
        <p className="text-sm text-text-soft">{info.cause}</p>
        <p className="mt-2 text-sm text-text-soft">
          <b className="inline">Como reduzir:</b> {info.howToReduce}
        </p>
      </div>
    </li>
  );
}

// Up to five risks with probability, impact, score and level, or the no-risk state (RULE-dm-07)
function RiskList({ risks }: { risks: readonly RiskResult[] }) {
  return (
    <section aria-labelledby="result-risks-title">
      <h3 id="result-risks-title" className="mt-8 mb-1">
        Riscos
      </h3>
      <p className="mb-3 text-sm text-text-muted">
        Probabilidade e impacto de 1 a 5. A partir de {rulesV1.risk.highFrom}, o risco é alto.
      </p>
      {risks.length > 0 ? (
        <ul data-aioson-id="result-risks" className="m-0 list-none border-t border-line p-0">
          {risks.map((risk) => (
            <RiskItem key={risk.signalId} risk={risk} />
          ))}
        </ul>
      ) : (
        <div
          data-state="empty"
          data-aioson-id="result-no-risks"
          className="flex items-start gap-4 rounded-lg border border-dashed border-line-strong bg-surface p-6"
        >
          <CheckIcon />
          <div>
            <b className="mb-0.5 block text-base">Nenhum risco encontrado nas suas respostas</b>
            <p className="text-sm text-text-soft">
              Continue medindo os seus números: um risco novo aparece aqui no próximo diagnóstico.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export { RiskList };
