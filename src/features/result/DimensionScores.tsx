import { useEffect, useRef, useState } from "react";
import { DIMENSIONS } from "../../../shared/content/stageContent";
import type { DimensionKey, DimensionResult } from "../../../shared/domain/types";
import { cn } from "@/lib/utils";

interface DimensionScoresProps {
  title: string;
  keys: readonly DimensionKey[];
  dimensions: Record<DimensionKey, DimensionResult>;
  dataId?: string;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

// The bars fill once the group scrolls into view. With reduced motion, or without
// IntersectionObserver, they start already filled (AC-dm-47).
function useReveal<T extends Element>() {
  const ref = useRef<T>(null);
  const [isRevealed, setRevealed] = useState(() => prefersReducedMotion() || typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const element = ref.current;
    if (isRevealed || !element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [isRevealed]);

  return { ref, isRevealed };
}

function DimensionRow({ dimensionKey, result }: { dimensionKey: DimensionKey; result: DimensionResult }) {
  const info = DIMENSIONS[dimensionKey];
  return (
    <div data-aioson-id={`dim-${dimensionKey}`} className="border-b border-line py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">{info.name}</div>
          <div className="text-sm text-text-muted">{info.question}</div>
        </div>
        <div className="font-mono text-2xl font-medium text-text">{result.score}</div>
      </div>
      <div
        role="img"
        aria-label={`${result.score} de 100`}
        className="mt-2 h-1.5 overflow-hidden rounded-md bg-surface-raised"
      >
        <i
          data-bar
          className={cn(
            "block h-full origin-left rounded-md transition-transform duration-700 ease-app group-data-[revealed=false]:scale-x-0 motion-reduce:transition-none",
            result.belowWarning ? "bg-warn" : "bg-bronze",
          )}
          style={{ width: `${result.score}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-sm border border-line px-2 py-0.5 text-xs font-medium tracking-[0.06em] text-text-soft uppercase">
          Sustentaria o estágio {result.supportsStage}
        </span>
        {result.belowWarning ? (
          <span className="inline-flex items-center rounded-sm border border-warn/40 bg-warn-wash px-2 py-0.5 text-xs font-medium tracking-[0.06em] text-warn uppercase">
            Abaixo de 50
          </span>
        ) : null}
      </div>
    </div>
  );
}

// One group of dimension bars: the business fits or the growth fronts
function DimensionScores({ title, keys, dimensions, dataId }: DimensionScoresProps) {
  const { ref, isRevealed } = useReveal<HTMLDivElement>();
  const headingId = `${dataId ?? "dimensions"}-title`;

  return (
    <section aria-labelledby={headingId} data-aioson-id={dataId}>
      <h3 id={headingId} className="mt-8 mb-1">
        {title}
      </h3>
      <div
        ref={ref}
        data-reveal
        data-revealed={isRevealed}
        className="group grid grid-cols-1 gap-x-12 sm:grid-cols-2"
      >
        {keys.map((key) => (
          <DimensionRow key={key} dimensionKey={key} result={dimensions[key]} />
        ))}
      </div>
    </section>
  );
}

export { DimensionScores, prefersReducedMotion };
