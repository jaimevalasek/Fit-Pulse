import type { HomeLatestDiagnosis, HomeReevaluation } from "@/api/homeApi";
import { cn } from "@/lib/utils";
import { LAST_STEP_PHRASE, LOCK_PHRASES } from "../../../shared/content/stageContent";
import { daysBetweenIsoDates, reevaluationCountdown, reevaluationTimeline } from "../../../shared/domain/followUp";
import { localIsoDate } from "../../../shared/format/dates";

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Share of the interval already gone, 0 to 1; the bar stays full once the due day has passed
function elapsedShare(lastDay: string, today: string, dueAt: string): number {
  const span = daysBetweenIsoDates(lastDay, dueAt);
  const passed = daysBetweenIsoDates(lastDay, today);
  if (span === null || passed === null || span <= 0) return 1;
  return Math.min(1, Math.max(0, passed / span));
}

function TimelineBar({ share }: { share: number }) {
  const percent = `${(share * 100).toFixed(2)}%`;
  return (
    <div aria-hidden="true" className="relative mt-1 h-7">
      <div className="absolute inset-x-0 top-3 h-1 rounded-full border border-line bg-surface-raised" />
      <div className="absolute top-3 left-0 h-1 rounded-full bg-bronze" style={{ width: percent }} />
      <div className="absolute top-1 h-5 w-0.5 bg-gold" style={{ left: `calc(${percent} - 1px)` }} />
    </div>
  );
}

function LockLine({ latest }: { latest: HomeLatestDiagnosis }) {
  return (
    <div data-aioson-id="home-trava" className="rounded-md border border-line bg-surface px-4 py-3.5">
      {latest.lock ? (
        <>
          <p className="text-sm text-text-soft">Para subir de degrau:</p>
          <p className="voice-human text-lg leading-snug">{capitalize(LOCK_PHRASES[latest.lock])}.</p>
        </>
      ) : (
        <p className="voice-human text-lg leading-snug">{LAST_STEP_PHRASE}</p>
      )}
    </div>
  );
}

// The focal panel of the owner home: days until (or past) the next diagnosis, the Último / Hoje /
// Próximo line, the chosen interval, the padlock and the in-app-only reminder (AC-ra-33)
function ReevaluationCountdown({ reevaluation, latest }: { reevaluation: HomeReevaluation; latest: HomeLatestDiagnosis }) {
  const late = reevaluation.daysUntil < 0;
  const countdown = reevaluationCountdown({
    dueDate: reevaluation.dueAt,
    daysUntil: reevaluation.daysUntil,
    late,
    daysLate: late ? Math.max(reevaluation.daysOverdue, -reevaluation.daysUntil) : 0,
  });
  const lastDay = localIsoDate(new Date(reevaluation.lastAt)) ?? reevaluation.today;
  const timeline = reevaluationTimeline(lastDay, reevaluation.today, reevaluation.dueAt);
  return (
    <section
      data-aioson-id="home-reeval"
      data-state={late ? "late" : "on-time"}
      aria-labelledby="home-reeval-title"
      className="flex min-w-0 flex-col gap-4.5 rounded-lg border border-line bg-surface p-6 max-sm:p-4"
    >
      <h2 id="home-reeval-title" className="text-xl">
        Refazer o diagnóstico
      </h2>
      {countdown ? (
        <p data-aioson-id="home-reeval-count" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={cn("font-mono text-[clamp(2.75rem,2.4rem+1.5vw,3.5rem)] leading-none font-medium tracking-[-0.03em]", late && "text-danger")}>
            {countdown.amount}
          </span>
          <span className="text-text-soft">
            {countdown.relation}, <span data-aioson-id="home-reeval-interval">a cada {reevaluation.intervalDays} dias</span>
          </span>
        </p>
      ) : null}
      {timeline ? (
        <div>
          <TimelineBar share={elapsedShare(lastDay, reevaluation.today, reevaluation.dueAt)} />
          <p
            data-aioson-id="home-reeval-timeline"
            aria-label={timeline.text}
            className="flex flex-wrap justify-between gap-x-3 font-mono text-xs font-medium text-text-muted"
          >
            <span>Último: {timeline.last}</span>
            <span>Hoje: {timeline.today}</span>
            <span>Próximo: {timeline.next}</span>
          </p>
        </div>
      ) : null}
      <LockLine latest={latest} />
      <p data-aioson-id="home-reeval-reminder" className="text-[0.9375rem] text-text-soft">
        Refazer mostra se as ações funcionaram. O lembrete aparece aqui no app; ele não manda aviso para o computador.
      </p>
    </section>
  );
}

export { ReevaluationCountdown };
