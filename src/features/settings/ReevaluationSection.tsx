// "Lembrete de reavaliação" in Configurações (AC-ra-34): how many days go between diagnoses. The choice is saved
// on change, so the home counts with it right away and after the app reopens.
import { useState } from "react";
import { isApiError } from "@/api/httpClient";
import type { ReevaluationIntervalDays } from "@/api/preferencesApi";
import { Label } from "@/components/ui/label";
import { usePreferences } from "@/features/preferences/PreferencesProvider";
import { cn } from "@/lib/utils";

type SaveState = { kind: "idle" } | { kind: "saved" } | { kind: "error"; message: string };

const INTERVAL_OPTIONS: ReevaluationIntervalDays[] = [60, 90, 120, 180];
const RECOMMENDED_INTERVAL: ReevaluationIntervalDays = 90;

const SELECT_CLASS = cn(
  "h-(--control) w-full min-w-0 rounded-md border border-line-strong bg-ground-sunken px-3 text-base text-text",
  "hover:border-text-soft focus:border-bronze max-sm:h-(--touch)",
);

function parseInterval(value: string): ReevaluationIntervalDays | null {
  const days = Number(value);
  return INTERVAL_OPTIONS.find((option) => option === days) ?? null;
}

function intervalLabel(days: ReevaluationIntervalDays): string {
  return days === RECOMMENDED_INTERVAL ? `${days} dias (recomendado)` : `${days} dias`;
}

function saveErrorMessage(error: unknown): string {
  if (isApiError(error) && error.code === "network_error") return error.message;
  return "Não foi possível salvar o intervalo. Tente de novo.";
}

function ReevaluationSection() {
  const { preferences, savePreferences } = usePreferences();
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  function handleChange(value: string) {
    const days = parseInterval(value);
    if (!days) return;
    setSaveState({ kind: "idle" });
    savePreferences({ reevaluationIntervalDays: days }).then(
      () => setSaveState({ kind: "saved" }),
      (error: unknown) => setSaveState({ kind: "error", message: saveErrorMessage(error) }),
    );
  }

  return (
    <div className="flex max-w-[360px] flex-col gap-1">
      <Label htmlFor="settings-reevaluation">Refazer o diagnóstico a cada</Label>
      <select
        id="settings-reevaluation"
        data-aioson-id="settings-reevaluation-interval"
        className={SELECT_CLASS}
        value={String(preferences.reevaluationIntervalDays)}
        aria-invalid={saveState.kind === "error" ? true : undefined}
        aria-describedby={saveState.kind === "error" ? "settings-reevaluation-error" : undefined}
        onChange={(event) => handleChange(event.target.value)}
      >
        {INTERVAL_OPTIONS.map((days) => (
          <option key={days} value={days}>
            {intervalLabel(days)}
          </option>
        ))}
      </select>
      <p role="status" className="mt-1 min-h-[1.25em] text-sm text-ok">
        {saveState.kind === "saved" ? "Salvo neste computador." : ""}
      </p>
      {saveState.kind === "error" ? (
        <p id="settings-reevaluation-error" role="alert" className="text-sm text-danger" data-state="error">
          {saveState.message}
        </p>
      ) : null}
    </div>
  );
}

export { ReevaluationSection };
