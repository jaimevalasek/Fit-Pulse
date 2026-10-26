import { useRef, type KeyboardEvent } from "react";
import type { TimelineEntry } from "@/api/historyApi";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/features/companies/CompanyPage";
import { cn } from "@/lib/utils";
import { getStage } from "../../../shared/content/stageContent";

type ReportType = "diagnosis" | "evolution";

// "De" and "Até" of the evolution: two completed diagnoses of the company, "Até" after "De"
interface EvolutionRange {
  fromId: string;
  toId: string;
}

// BR-ra-02: the evolution compares two completed diagnoses of the same company
const EVOLUTION_MINIMUM = 2;
const EVOLUTION_NEEDS_TWO = "A evolução precisa de 2 diagnósticos concluídos da mesma empresa.";
const EVOLUTION_LATER = "O relatório de evolução entra numa próxima versão desta central.";
const EVOLUTION_SAME_MATH =
  "Usa a mesma conta da tela de comparação. Se as regras mudaram entre os dois, o diagnóstico anterior é recalculado.";
const ANSWERS_REASON =
  "Vem desligado porque as respostas mostram valores em reais, como gastos e preço médio. Ligue só se quem vai ler pode ver esses números.";

const SELECT_CLASS = cn(
  "h-(--control) w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text",
  "hover:border-text-soft focus:border-bronze max-sm:h-(--touch)",
);

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M4 17l6-6 4 4 6-7" />
      <path d="M15 8h5v5" />
    </svg>
  );
}

function diagnosisLabel(entry: TimelineEntry): string {
  return `${formatDate(entry.completedAt)} · Estágio ${entry.stage}, ${getStage(entry.stage).name}`;
}

// `diagnoses` come newest first: index 0 is the latest, so "later" means a smaller index

// AC-ra-12: by default the evolution goes from the second latest diagnosis to the latest one
function defaultEvolutionRange(diagnoses: TimelineEntry[]): EvolutionRange | null {
  if (diagnoses.length < EVOLUTION_MINIMUM) return null;
  return { fromId: diagnoses[1].id, toId: diagnoses[0].id };
}

// AC-ra-14: "Até" only offers the diagnoses after the one picked in "De"
function diagnosesAfter(diagnoses: TimelineEntry[], fromId: string): TimelineEntry[] {
  const fromIndex = diagnoses.findIndex((entry) => entry.id === fromId);
  return fromIndex <= 0 ? [] : diagnoses.slice(0, fromIndex);
}

// AC-ra-14: a new "De" keeps "Até" when it is still later; otherwise "Até" moves to the diagnosis
// right after the new "De"
function rangeWithFrom(diagnoses: TimelineEntry[], range: EvolutionRange, fromId: string): EvolutionRange {
  const later = diagnosesAfter(diagnoses, fromId);
  if (later.length === 0) return range;
  const toId = later.some((entry) => entry.id === range.toId) ? range.toId : later[later.length - 1].id;
  return { fromId, toId };
}

interface ReportTypePickerProps {
  value: ReportType;
  completedCount: number;
  evolutionSupported: boolean;
  onChange: (type: ReportType) => void;
}

// The type of report. The evolution stays off, with the reason, when the company has fewer than
// 2 completed diagnoses (AC-ra-03) or while the screen above does not offer it yet
function ReportTypePicker({ value, completedCount, evolutionSupported, onChange }: ReportTypePickerProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const canEvolve = completedCount >= EVOLUTION_MINIMUM && evolutionSupported;
  const selected: ReportType = canEvolve ? value : "diagnosis";
  const evolutionNote =
    completedCount < EVOLUTION_MINIMUM ? `${EVOLUTION_NEEDS_TWO} Esta tem ${completedCount}.` : evolutionSupported ? null : EVOLUTION_LATER;

  // Radio group keys: the arrows move between the options that can be picked and select them
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    if (!canEvolve) return;
    const next: ReportType = selected === "diagnosis" ? "evolution" : "diagnosis";
    onChange(next);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-report-type="${next}"]`)?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={groupRef} className="report-types" role="radiogroup" aria-label="Tipo de relatório" onKeyDown={handleKeyDown}>
        <button
          type="button"
          role="radio"
          className="report-type"
          aria-checked={selected === "diagnosis"}
          tabIndex={selected === "diagnosis" ? 0 : -1}
          onClick={() => onChange("diagnosis")}
          data-report-type="diagnosis"
          data-aioson-id="report-type-diagnosis"
        >
          <FileIcon />
          Relatório do diagnóstico
        </button>
        <button
          type="button"
          role="radio"
          className="report-type"
          aria-checked={selected === "evolution"}
          aria-disabled={!canEvolve || undefined}
          aria-describedby={evolutionNote ? "report-evolution-note" : undefined}
          tabIndex={selected === "evolution" ? 0 : -1}
          onClick={() => {
            if (canEvolve) onChange("evolution");
          }}
          data-report-type="evolution"
          data-aioson-id="report-type-evolution"
        >
          <TrendIcon />
          Relatório de evolução
        </button>
      </div>
      {evolutionNote ? (
        <p id="report-evolution-note" className="text-sm text-text-muted" data-aioson-id="report-evolution-note">
          {evolutionNote}
        </p>
      ) : null}
    </div>
  );
}

interface EvolutionFieldsProps {
  diagnoses: TimelineEntry[];
  range: EvolutionRange;
  onRangeChange: (range: EvolutionRange) => void;
}

// "De" lists every diagnosis but the latest; "Até" only the ones after "De" (AC-ra-12, AC-ra-14)
function EvolutionFields({ diagnoses, range, onRangeChange }: EvolutionFieldsProps) {
  const fromOptions = diagnoses.slice(1);
  const toOptions = diagnosesAfter(diagnoses, range.fromId);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-from">De</Label>
          <select
            id="report-from"
            className={SELECT_CLASS}
            value={range.fromId}
            onChange={(event) => onRangeChange(rangeWithFrom(diagnoses, range, event.target.value))}
            data-aioson-id="report-from"
          >
            {fromOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {diagnosisLabel(entry)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="report-to">Até</Label>
          <select
            id="report-to"
            className={SELECT_CLASS}
            value={range.toId}
            onChange={(event) => onRangeChange({ fromId: range.fromId, toId: event.target.value })}
            data-aioson-id="report-to"
          >
            {toOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {diagnosisLabel(entry)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-sm text-text-muted" data-aioson-id="report-evolution-math">
        {EVOLUTION_SAME_MATH}
      </p>
    </>
  );
}

interface ReportOptionsProps {
  // Completed diagnoses that count, newest first
  diagnoses: TimelineEntry[];
  diagnosisId: string;
  includeAnswers: boolean;
  onDiagnosisChange: (diagnosisId: string) => void;
  onIncludeAnswersChange: (includeAnswers: boolean) => void;
  // The evolution is offered once the screen above sends `{ kind: "evolution", fromId, toId }`
  // (IF-001); until then the option stays off
  evolutionSupported?: boolean;
  reportType?: ReportType;
  onReportTypeChange?: (type: ReportType) => void;
  evolutionRange?: EvolutionRange | null;
  onEvolutionRangeChange?: (range: EvolutionRange) => void;
}

// Left side of the center: the type, then the diagnosis and "Incluir as respostas do questionário",
// or "De" and "Até" for the evolution. Every change goes straight to the preview (AC-ra-02).
function ReportOptions(props: ReportOptionsProps) {
  const { diagnoses, diagnosisId, includeAnswers, onDiagnosisChange, onIncludeAnswersChange } = props;
  const { evolutionSupported = false, reportType = "diagnosis", onReportTypeChange, evolutionRange, onEvolutionRangeChange } = props;
  const range = evolutionRange ?? defaultEvolutionRange(diagnoses);
  const supported = evolutionSupported && Boolean(onReportTypeChange && onEvolutionRangeChange);
  const showEvolution = supported && reportType === "evolution" && range !== null;

  return (
    <div className="report-options" data-aioson-id="report-options">
      <ReportTypePicker
        value={reportType}
        completedCount={diagnoses.length}
        evolutionSupported={supported}
        onChange={(type) => onReportTypeChange?.(type)}
      />
      {showEvolution && onEvolutionRangeChange ? (
        <EvolutionFields diagnoses={diagnoses} range={range} onRangeChange={onEvolutionRangeChange} />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <Label htmlFor="report-diagnosis">Diagnóstico</Label>
            <select
              id="report-diagnosis"
              className={SELECT_CLASS}
              value={diagnosisId}
              onChange={(event) => onDiagnosisChange(event.target.value)}
              data-aioson-id="report-diagnosis"
            >
              {diagnoses.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {diagnosisLabel(entry)}
                </option>
              ))}
            </select>
          </div>
          <label className="report-switch" data-aioson-id="report-include-answers">
            <input type="checkbox" checked={includeAnswers} onChange={(event) => onIncludeAnswersChange(event.target.checked)} />
            <span>
              <b>Incluir as respostas do questionário</b>
              <small>{ANSWERS_REASON}</small>
            </span>
          </label>
        </>
      )}
    </div>
  );
}

export { ReportOptions, defaultEvolutionRange, diagnosesAfter, rangeWithFrom };
export type { EvolutionRange, ReportOptionsProps, ReportType };
