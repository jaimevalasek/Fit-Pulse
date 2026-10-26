import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { completeDiagnosis, readPendingBlocks } from "@/api/diagnosesApi";
import { BLOCKS } from "../../../shared/content/questionBank";
import { pendingBlocks } from "../../../shared/domain/completeness";
import type { Answers, BlockNumber, CalculatorInput } from "../../../shared/domain/types";
import { blockHref } from "./BlockRail";

interface CompletionGateProps {
  diagnosisId: string;
  companyName?: string;
  answers: Answers;
  calculator: CalculatorInput;
  // Sends the changes still waiting to be saved before the draft is concluded
  flush: () => Promise<void>;
  // Left side of the footer (the "Bloco anterior" link)
  leading?: ReactNode;
}

const COMPLETE_ERROR = "Não foi possível concluir agora. Suas respostas continuam salvas; tente de novo.";

function blockTitle(block: BlockNumber): string {
  return BLOCKS.find((info) => info.number === block)?.title ?? `Bloco ${block}`;
}

function PendingAlert({ diagnosisId, blocks }: { diagnosisId: string; blocks: BlockNumber[] }) {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    alertRef.current?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <div
      ref={alertRef}
      role="alert"
      data-state="error"
      data-aioson-id="quiz-missing"
      className="mt-6 flex items-start gap-3 rounded-lg border border-danger/40 bg-danger-wash p-4"
    >
      <span aria-hidden="true" className="mt-0.5 font-bold text-danger">
        !
      </span>
      <div>
        <b className="block">Faltam respostas para concluir</b>
        <ul className="mt-1 grid gap-1 pl-5">
          {blocks.map((block) => (
            <li key={block}>
              <Link to={blockHref(diagnosisId, block)} className="inline-flex min-h-(--touch) items-center">
                {blockTitle(block)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CalculatingView({ companyName }: { companyName?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      data-state="loading"
      data-aioson-id="diagnosis-calculating"
      className="fixed inset-0 z-50 grid place-items-center bg-ground p-6"
    >
      <div className="grid gap-3 text-center">
        {companyName ? <p className="meta-line justify-center">{companyName}</p> : null}
        <h1>Calculando o seu diagnóstico</h1>
        <p className="text-text-soft">Isso leva só alguns segundos.</p>
      </div>
    </div>
  );
}

// "Ver meu resultado": lists the pending blocks or opens the gold confirmation (AC-dm-14)
function CompletionGate({ diagnosisId, companyName, answers, calculator, flush, leading }: CompletionGateProps) {
  const navigate = useNavigate();
  // Each click on "Ver meu resultado" remounts the alert, so it scrolls into view and is announced again
  const [pendingAttempt, setPendingAttempt] = useState(0);
  const [serverPending, setServerPending] = useState<BlockNumber[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = pendingBlocks(answers, calculator);
  const shownPending = pending.length > 0 ? pending : serverPending;

  function handleFinish() {
    setError(null);
    if (pending.length > 0) {
      setPendingAttempt((value) => value + 1);
      return;
    }
    setPendingAttempt(0);
    setConfirmOpen(true);
  }

  async function runCompletion() {
    setCalculating(true);
    setError(null);
    try {
      await flush();
      await completeDiagnosis(diagnosisId);
      navigate(`/resultado/${encodeURIComponent(diagnosisId)}`, { replace: true });
    } catch (caught) {
      const serverBlocks = readPendingBlocks(caught);
      if (serverBlocks) {
        setServerPending(serverBlocks);
        setPendingAttempt((value) => value + 1);
      } else {
        setError(COMPLETE_ERROR);
      }
      setCalculating(false);
    }
  }

  return (
    <>
      {pendingAttempt > 0 && shownPending.length > 0 ? (
        <PendingAlert key={pendingAttempt} diagnosisId={diagnosisId} blocks={shownPending} />
      ) : null}
      {error ? (
        <p role="alert" data-state="error" className="mt-6 rounded-lg border border-danger/40 bg-danger-wash p-4">
          {error}
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        {leading ?? <span />}
        <Button variant="gate" onClick={handleFinish} data-aioson-id="quiz-finish">
          Ver meu resultado <span aria-hidden="true">→</span>
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        tone="gate"
        title="Concluir o diagnóstico?"
        consequence="Depois de concluído, as respostas ficam guardadas como estão e o resultado não muda. Para mudar algo, você faz um novo diagnóstico."
        confirmLabel="Concluir e ver resultado"
        onConfirm={() => void runCompletion()}
        dataId="diagnosis-complete-confirm"
      />
      {calculating ? <CalculatingView companyName={companyName} /> : null}
    </>
  );
}

export { CompletionGate };
