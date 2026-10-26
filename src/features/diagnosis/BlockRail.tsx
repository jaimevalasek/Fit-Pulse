import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BLOCKS } from "../../../shared/content/questionBank";
import type { BlockNumber } from "../../../shared/domain/types";
import type { SaveState } from "./useDraftAutosave";

const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

function blockHref(diagnosisId: string, block: BlockNumber): string {
  return `/diagnostico/${encodeURIComponent(diagnosisId)}?bloco=${block}`;
}

interface BlockRailProps {
  diagnosisId: string;
  currentBlock: BlockNumber;
  isBlockDone: (block: BlockNumber) => boolean;
}

// The eight blocks with their number, a mark when answered and a link to each one (AC-dm-10)
function BlockRail({ diagnosisId, currentBlock, isBlockDone }: BlockRailProps) {
  return (
    <nav aria-label="Blocos do diagnóstico">
      <ol className="m-0 list-none p-0 max-lg:flex max-lg:gap-1 max-lg:overflow-x-auto max-lg:pb-2">
        {BLOCKS.map((block) => {
          const done = isBlockDone(block.number);
          const current = block.number === currentBlock;
          return (
            <li key={block.number}>
              <Link
                to={blockHref(diagnosisId, block.number)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  // relative keeps the sr-only "(respondido)" inside the scrolling rail at narrow widths
                  "relative flex min-h-(--touch) items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm text-text-soft no-underline hover:bg-surface max-lg:whitespace-nowrap",
                  current && "border-line bg-surface font-semibold text-text",
                )}
              >
                <span
                  className={cn(
                    "grid size-[22px] flex-none place-items-center rounded-full border border-line-strong font-mono text-xs",
                    done && "border-bronze bg-bronze text-bronze-contrast",
                  )}
                >
                  {block.number}
                </span>
                {block.title}
                {done ? <span className="sr-only"> (respondido)</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

interface SaveStatusProps {
  saveState: SaveState;
  savedAt: Date | null;
  saveError: string | null;
  onRetry: () => void;
}

// "Salvo automaticamente às HH:MM", or the failure with a new attempt (AC-dm-12)
function SaveStatus({ saveState, savedAt, saveError, onRetry }: SaveStatusProps) {
  if (saveState === "error") {
    return (
      <div role="alert" data-state="error" className="mt-4 grid gap-2 text-sm text-danger">
        <p>{saveError ?? "Não foi possível salvar."}</p>
        <Button variant="default" size="sm" onClick={onRetry}>
          Tentar salvar de novo
        </Button>
      </div>
    );
  }
  // While a save runs the last saved time stays, so the line does not flicker on every click
  const text = savedAt === null ? "Salvando…" : `Salvo automaticamente às ${TIME_FORMAT.format(savedAt)}`;
  return (
    <p
      aria-live="polite"
      data-aioson-id="draft-saved"
      data-state={saveState}
      className="mt-4 flex items-center gap-1.5 font-mono text-xs tracking-wide text-text-muted"
    >
      <span aria-hidden="true" className="text-ok">
        ✓
      </span>
      {text}
    </p>
  );
}

export { BlockRail, SaveStatus, blockHref };
