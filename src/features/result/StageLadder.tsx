import type { ReactNode } from "react";
import { getStage, LOCK_PHRASES, STAGES } from "../../../shared/content/stageContent";
import type { LockKey, StageNumber } from "../../../shared/domain/types";
import { cn } from "@/lib/utils";

interface StageLadderProps {
  stage: StageNumber;
  // Stage of the diagnosis completed before this one; drawn as a dashed step
  previousStage?: StageNumber | null;
  // First unmet criterion of the next stage; the padlock sits on the next step
  lock?: LockKey | null;
  caption?: ReactNode;
  className?: string;
}

const RISER_HEIGHTS: Record<StageNumber, string> = { 1: "28%", 2: "48%", 3: "68%", 4: "88%" };

const STEP_TAG = "absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-surface px-1.5 py-0.5 font-mono text-xs uppercase tracking-[0.08em]";

// "Estágio 2 de 4: Ajuste. Diagnóstico anterior no estágio 1. Trava para subir: …" (AC-dm-28)
function describeLadder(stage: StageNumber, previousStage?: StageNumber | null, lock?: LockKey | null): string {
  const parts = [`Estágio ${stage} de 4: ${getStage(stage).name}.`];
  if (previousStage) parts.push(`Diagnóstico anterior no estágio ${previousStage}.`);
  if (lock) parts.push(`Trava para subir: ${LOCK_PHRASES[lock]}.`);
  return parts.join(" ");
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3">
      <path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function StepMarker({ step, stage, previousStage, lock }: { step: StageNumber } & StageLadderProps) {
  if (step === stage) {
    return (
      <span className={cn(STEP_TAG, "-top-8 inline-flex items-center gap-1 text-bronze")}>
        <PinIcon />
        <span className="hidden sm:inline">Você está&nbsp;</span>aqui
      </span>
    );
  }
  if (previousStage && step === previousStage) {
    return <span className={cn(STEP_TAG, "-top-7 text-text-muted")}>antes</span>;
  }
  if (lock && step === stage + 1) {
    return (
      <span
        data-aioson-id="ladder-lock"
        className="absolute -top-5 left-1/2 grid size-10 -translate-x-1/2 place-items-center rounded-full border border-line-strong bg-solid text-text"
      >
        <LockIcon className="size-[18px]" />
      </span>
    );
  }
  return null;
}

function riserTone(step: StageNumber, stage: StageNumber, previousStage?: StageNumber | null): string {
  if (step === stage) return "border-bronze bg-bronze";
  if (previousStage && step === previousStage) {
    return "border-dashed border-line-strong bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--bronze)_20%,transparent)_0_6px,transparent_6px_12px)]";
  }
  if (step < stage) return "border-line bg-[color-mix(in_oklab,var(--bronze)_22%,var(--surface-raised))]";
  return "border-line bg-surface-raised";
}

// The four-step ladder of the result; the home screen reuses it
function StageLadder({ stage, previousStage, lock, caption, className }: StageLadderProps) {
  const trail = previousStage && previousStage !== stage ? previousStage : null;
  const steps = STAGES.map((info) => info.number);

  return (
    <figure
      data-aioson-id="escada"
      className={cn("relative m-0 rounded-lg border border-line-strong bg-surface px-4 pt-8 pb-4 sm:px-6", className)}
    >
      <div
        role="img"
        aria-label={describeLadder(stage, trail, lock)}
        data-aioson-id="ladder-steps"
        className="grid h-[180px] grid-cols-4 items-end gap-3 px-2 sm:h-[210px]"
      >
        {steps.map((step) => (
          <div
            key={step}
            data-step={step}
            data-state={step === stage ? "current" : step === trail ? "trail" : step < stage ? "below" : "above"}
            className="relative flex h-full flex-col justify-end"
          >
            <div
              className={cn("relative rounded-t-sm border border-b-0", riserTone(step, stage, trail))}
              style={{ height: RISER_HEIGHTS[step] }}
            >
              <StepMarker step={step} stage={stage} previousStage={trail} lock={lock} />
            </div>
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="relative mx-2 h-6 border-l-2 border-bronze bg-[repeating-linear-gradient(to_bottom,var(--line-strong)_0_1px,transparent_1px_6px)]"
      />
      <div className="grid grid-cols-4 gap-3 px-2 pt-2">
        {STAGES.map((info) => (
          <div key={info.number} className="text-sm leading-tight text-text-muted">
            <b className={cn("block font-semibold break-words", info.number === stage ? "text-bronze" : "text-text-soft")}>
              {info.number}. {info.name}
            </b>
          </div>
        ))}
      </div>
      {caption ? (
        <figcaption className="mt-3 flex flex-wrap justify-between gap-3 border-t border-line pt-3">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

export { describeLadder, LockIcon, StageLadder };
export type { StageLadderProps };
