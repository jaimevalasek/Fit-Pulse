import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import type { UsageMode } from "@/api/preferencesApi";
import { cn } from "@/lib/utils";

// The mode picked here travels in the address to the next step; it is saved only when the company
// is created, so going back and choosing again leaves nothing behind.
const MODE_PARAM = "modo";

const STEPS = ["1. Como vai usar", "2. Sua empresa", "3. Primeiro diagnóstico"] as const;

function WizardSteps({ current }: { current: number }) {
  return (
    <ol
      aria-label="Etapas do primeiro uso"
      className="mt-2 mb-8 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 font-mono text-xs tracking-[0.1em] text-text-muted uppercase"
    >
      {STEPS.map((label, index) => (
        <li key={label} aria-current={index === current ? "step" : undefined} className={cn(index === current && "text-bronze")}>
          {label}
        </li>
      ))}
    </ol>
  );
}

function StoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-7 text-bronze">
      <path d="M3 9.5 4.6 4h14.8L21 9.5" />
      <path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
      <path d="M5 12.2V20h14v-7.8" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-7 text-bronze">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
      <path d="M18.5 14a6.5 6.5 0 0 1 3 6" />
    </svg>
  );
}

interface ModeCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  dataId: string;
  onChoose: () => void;
}

function ModeCard({ icon, title, description, dataId, onChoose }: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onChoose}
      data-aioson-id={dataId}
      className={cn(
        "cursor-pointer rounded-lg border border-line-strong bg-surface p-6 text-left text-text",
        "transition-[border-color,transform] duration-(--fast) ease-app hover:-translate-y-0.5 hover:border-bronze",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      {icon}
      <h2 className="mt-4 mb-2">{title}</h2>
      <p className="text-sm text-text-soft">{description}</p>
    </button>
  );
}

// #/boas-vindas: first screen of a new installation (BR-dm-11, AC-dm-01)
function WelcomeModePage() {
  const navigate = useNavigate();

  function choose(mode: UsageMode) {
    navigate(`/boas-vindas/empresa?${MODE_PARAM}=${mode}`);
  }

  return (
    <div data-aioson-id="wizard-mode" className="mx-auto mt-8 max-w-[760px]">
      <h1 className="text-[clamp(2.25rem,1.6rem+2.6vw,3.5rem)] leading-[1.04] tracking-[-0.035em]">
        Vamos descobrir em que <em className="voice-human text-bronze">degrau</em> a sua empresa está
      </h1>
      <p className="mt-4 mb-4 max-w-[54ch] text-lg text-text-soft">
        O FitPulse faz um diagnóstico de crescimento em cerca de 12 minutos e mostra o que trava o próximo passo. Os dados
        ficam só neste computador.
      </p>
      <WizardSteps current={0} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          icon={<StoreIcon />}
          title="Para a minha empresa"
          description="Você é dono ou sócio e quer entender onde o seu negócio está."
          dataId="wizard-mode-empresa"
          onChoose={() => choose("owner")}
        />
        <ModeCard
          icon={<PeopleIcon />}
          title="Atendo várias empresas"
          description="Você é consultor e acompanha a evolução de cada cliente."
          dataId="wizard-mode-consultoria"
          onChoose={() => choose("consultant")}
        />
      </div>
    </div>
  );
}

export { MODE_PARAM, WelcomeModePage, WizardSteps };
